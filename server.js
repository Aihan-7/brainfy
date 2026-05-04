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

  // ── POST /api/youtube ─────────────────────────
  //  Body: { url: string }
  //  Fetches transcript + title, returns { title, transcript, author }
  if (req.method === 'POST' && pathname === '/api/youtube') {
    if (!PROVIDER) { json(503, { error: 'AI not configured' }); return; }
    try {
      const { url: ytUrl } = await readBody(req);
      const videoIdMatch = ytUrl.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
      if (!videoIdMatch) { json(400, { error: 'Invalid YouTube URL' }); return; }
      const videoId = videoIdMatch[1];

      // Fetch title via oEmbed (no API key needed)
      const { YoutubeTranscript } = require('youtube-transcript');
      const oembedRes = await new Promise((resolve, reject) => {
        const req2 = https.get(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
          res2 => { let d = ''; res2.on('data', c => d += c); res2.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } }); }
        );
        req2.on('error', reject);
      });

      // Fetch transcript
      let transcriptText = '';
      try {
        const segments = await YoutubeTranscript.fetchTranscript(videoId);
        transcriptText = segments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim();
        // Trim to ~12 000 chars to stay within token limits
        if (transcriptText.length > 12000) transcriptText = transcriptText.slice(0, 12000) + '…';
      } catch(_) {
        transcriptText = ''; // transcript unavailable — AI will use title only
      }

      json(200, {
        videoId,
        title:      oembedRes.title      || 'YouTube Video',
        author:     oembedRes.author_name || '',
        thumbnail:  `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        transcript: transcriptText,
      });
    } catch(e) {
      json(500, { error: e.message });
    }
    return;
  }

  // ── POST /api/process-content ─────────────────
  //  Body: { content, contentType, title, subjName }
  //  Returns: { flashcards:[{q,a}], summary, outline }
  if (req.method === 'POST' && pathname === '/api/process-content') {
    if (!PROVIDER) { json(503, { error: 'AI not configured' }); return; }
    try {
      const { content, contentType, title, subjName } = await readBody(req);

      const systemPrompt = `You are an expert study assistant. Analyze the provided content and return a JSON object with exactly this structure:
{
  "flashcards": [{"q": "question", "a": "answer"}, ...],
  "summary": "A well-structured markdown summary with headings, bullet points and key concepts. 300-500 words.",
  "outline": ["Topic 1", "  • Subtopic 1a", "  • Subtopic 1b", "Topic 2", ...]
}

Rules:
- Generate 8-15 high-quality flashcards covering key concepts
- Flashcard questions should test real understanding, not trivial facts
- Summary should use ## headings and bullet points
- Outline should be a flat string array representing hierarchy with indentation
- Return ONLY the JSON, no markdown fences`;

      const userMsg = contentType === 'youtube'
        ? `Video title: "${title}"\nSubject: ${subjName}\n\nTranscript:\n${content || '(transcript unavailable — generate from title)'}`
        : `Document: "${title}"\nSubject: ${subjName}\n\nContent:\n${content}`;

      const aiBody = {
        system: systemPrompt,
        messages: [{ role: 'user', content: userMsg }],
        max_tokens: 2048,
      };

      const result = await callAI(aiBody);
      if (result.status !== 200) { json(result.status, result.body); return; }

      const text = result.body.content?.[0]?.text || '';
      // Strip potential markdown fences
      const clean = text.replace(/^```(?:json)?\n?/,'').replace(/\n?```$/,'').trim();
      const parsed = JSON.parse(clean);
      json(200, parsed);
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
