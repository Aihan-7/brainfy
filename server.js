// ══════════════════════════════════════════════════
//  Brainfy — server.js
//  Node.js server with:
//   • Static file serving
//   • AI proxy (Groq or Anthropic)
//   • Firebase Admin — Auth verification + Firestore
// ══════════════════════════════════════════════════

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT = 3456;
const DIR  = __dirname;

// ── Load .env ──────────────────────────────────────
const envFile = path.join(DIR, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (k && !(k in process.env)) process.env[k] = v;
  });
}

// ── Firebase Admin ─────────────────────────────────
let db   = null;   // Firestore instance
let auth = null;   // Auth instance

const SA_PATH = path.join(DIR, 'serviceAccountKey.json');
if (fs.existsSync(SA_PATH)) {
  try {
    const admin = require('firebase-admin');
    const serviceAccount = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    db   = admin.firestore();
    auth = admin.auth();
    console.log('  🔥  Firebase Admin ready');
  } catch (e) {
    console.warn('  ⚠️   Firebase Admin failed to init:', e.message);
  }
} else {
  console.log('  ℹ️   No serviceAccountKey.json — Firebase disabled');
}

// ── Helper: verify Firebase ID token ──────────────
async function verifyToken(idToken) {
  if (!auth) throw new Error('Firebase not configured');
  const decoded = await auth.verifyIdToken(idToken);
  return decoded; // { uid, email, name, ... }
}

// ── Provider detection (AI) ────────────────────────
const GROQ_KEY      = process.env.GROQ_API_KEY      || '';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const PROVIDER = GROQ_KEY ? 'groq' : ANTHROPIC_KEY ? 'anthropic' : null;

const DEFAULT_MODELS = {
  groq:      'llama-3.3-70b-versatile',
  anthropic: 'claude-3-5-haiku-20241022',
};
const MODEL = process.env.AI_MODEL || (PROVIDER ? DEFAULT_MODELS[PROVIDER] : '');

// ── MIME types ─────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
};

// ── HTTPS helper ───────────────────────────────────
function httpsPost(hostname, reqPath, headers, payload) {
  return new Promise((resolve, reject) => {
    const buf = Buffer.from(JSON.stringify(payload));
    const req = https.request(
      { hostname, port: 443, path: reqPath, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length, ...headers } },
      res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch(e) { reject(new Error('Bad JSON from provider')); }
        });
      }
    );
    req.on('error', reject);
    req.write(buf);
    req.end();
  });
}

// ── Groq ───────────────────────────────────────────
async function callGroq(body) {
  const messages = [];
  if (body.system) messages.push({ role: 'system', content: body.system });
  messages.push(...(body.messages || []));

  const result = await httpsPost(
    'api.groq.com',
    '/openai/v1/chat/completions',
    { Authorization: `Bearer ${GROQ_KEY}` },
    { model: MODEL, messages, max_tokens: body.max_tokens || 1024 }
  );

  if (result.status === 200) {
    const choice = result.body.choices?.[0];
    const usage  = result.body.usage || {};
    result.body = {
      content: [{ type: 'text', text: choice?.message?.content || '' }],
      usage: {
        input_tokens:  usage.prompt_tokens     || 0,
        output_tokens: usage.completion_tokens || 0,
      },
    };
  }
  return result;
}

// ── Anthropic ──────────────────────────────────────
async function callAnthropic(body) {
  return httpsPost(
    'api.anthropic.com',
    '/v1/messages',
    { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    { ...body, model: MODEL }
  );
}

function callAI(body) {
  return PROVIDER === 'groq' ? callGroq(body) : callAnthropic(body);
}

// ── Read request body ──────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch(e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

// ── HTTP Server ────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const { pathname } = url.parse(req.url);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const json = (status, obj) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  // ── GET /api/ai-status ────────────────────────
  if (req.method === 'GET' && pathname === '/api/ai-status') {
    json(200, {
      configured: !!PROVIDER,
      provider:   PROVIDER,
      model:      MODEL,
      firebase:   !!db,
    });
    return;
  }

  // ── POST /api/chat ────────────────────────────
  if (req.method === 'POST' && pathname === '/api/chat') {
    if (!PROVIDER) {
      json(503, { error: 'AI not configured. Add GROQ_API_KEY or ANTHROPIC_API_KEY to .env' });
      return;
    }
    try {
      const body   = await readBody(req);
      const result = await callAI(body);
      json(result.status, result.body);
    } catch(e) {
      json(500, { error: e.message });
    }
    return;
  }

  // ── POST /api/auth/verify ─────────────────────
  //  Body: { idToken: string }
  //  Returns: { uid, email, name }
  if (req.method === 'POST' && pathname === '/api/auth/verify') {
    if (!auth) { json(503, { error: 'Firebase not configured' }); return; }
    try {
      const { idToken } = await readBody(req);
      const decoded = await verifyToken(idToken);
      json(200, { uid: decoded.uid, email: decoded.email, name: decoded.name || '' });
    } catch(e) {
      json(401, { error: 'Invalid or expired token' });
    }
    return;
  }

  // ── POST /api/data/save ───────────────────────
  //  Body: { idToken: string, state: AppState }
  //  Saves state to Firestore users/{uid}/data
  if (req.method === 'POST' && pathname === '/api/data/save') {
    if (!db) { json(503, { error: 'Firebase not configured' }); return; }
    try {
      const { idToken, state } = await readBody(req);
      const decoded = await verifyToken(idToken);
      await db.collection('users').doc(decoded.uid).set({
        state,
        updatedAt: new Date().toISOString(),
      });
      json(200, { ok: true });
    } catch(e) {
      json(e.message === 'Invalid or expired token' ? 401 : 500, { error: e.message });
    }
    return;
  }

  // ── POST /api/data/load ───────────────────────
  //  Body: { idToken: string }
  //  Returns: { state: AppState | null }
  if (req.method === 'POST' && pathname === '/api/data/load') {
    if (!db) { json(503, { error: 'Firebase not configured' }); return; }
    try {
      const { idToken } = await readBody(req);
      const decoded = await verifyToken(idToken);
      const doc = await db.collection('users').doc(decoded.uid).get();
      json(200, { state: doc.exists ? doc.data().state : null });
    } catch(e) {
      json(e.message === 'Invalid or expired token' ? 401 : 500, { error: e.message });
    }
    return;
  }

  // ── Static files ──────────────────────────────
  let filePath = path.join(DIR, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(DIR)) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(DIR, 'index.html'), (e2, d2) => {
          if (e2) { res.writeHead(404); res.end('Not found'); return; }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(d2);
        });
      } else { res.writeHead(500); res.end('Server error'); }
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  🧠  Brainfy is running!');
  console.log(`  →   http://localhost:${PORT}`);
  console.log('');
  if (!PROVIDER) {
    console.log('  ⚠️   AI disabled — add a key to .env:');
    console.log('       GROQ_API_KEY=gsk_...');
    console.log('       ANTHROPIC_API_KEY=sk-ant-...');
  } else {
    const badge = PROVIDER === 'groq' ? '⚡ Groq' : '🤖 Anthropic';
    console.log(`  ✅  AI ready — ${badge} · ${MODEL}`);
  }
  if (!db) {
    console.log('  ⚠️   Firebase disabled — add serviceAccountKey.json');
  }
  console.log('');
});
