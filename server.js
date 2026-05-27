// ══════════════════════════════════════════════════
//  Brainfy — server.js
//  Local-dev Node.js server with:
//   • Static file serving
//   • AI proxy (Groq or Anthropic)
//
//  Production runs on Cloudflare Pages, which can't
//  execute Node — the AI endpoints live in
//  functions/api/ as Pages Functions, and Firestore
//  sync happens browser → Firestore directly via the
//  Web SDK (see firestore.rules).
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

// ── Provider detection (AI) ────────────────────────
const GROQ_KEY      = process.env.GROQ_API_KEY      || '';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const PROVIDER = GROQ_KEY ? 'groq' : ANTHROPIC_KEY ? 'anthropic' : null;

const DEFAULT_MODELS = {
  groq:            'llama-3.3-70b-versatile',
  groqVision:      'meta-llama/llama-4-scout-17b-16e-instruct',
  anthropic:       'claude-3-5-haiku-20241022',
  anthropicVision: 'claude-haiku-4-5-20251001',
};
const MODEL        = process.env.AI_MODEL        || (PROVIDER ? DEFAULT_MODELS[PROVIDER] : '');
const VISION_MODEL = process.env.AI_VISION_MODEL || (PROVIDER ? DEFAULT_MODELS[PROVIDER + 'Vision'] : '');

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
  '.txt':  'text/plain; charset=utf-8',
  '.xml':  'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
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
// body.model (when set) overrides the default — used by the image path to
// route to a vision-capable model. body.messages may contain multimodal
// content arrays (OpenAI shape: [{type:'text'},{type:'image_url'}]).
async function callGroq(body) {
  const messages = [];
  if (body.system) messages.push({ role: 'system', content: body.system });
  messages.push(...(body.messages || []));

  const result = await httpsPost(
    'api.groq.com',
    '/openai/v1/chat/completions',
    { Authorization: `Bearer ${GROQ_KEY}` },
    { model: body.model || MODEL, messages, max_tokens: body.max_tokens || 1024 }
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
    { ...body, model: body.model || MODEL }
  );
}

function callAI(body) {
  return PROVIDER === 'groq' ? callGroq(body) : callAnthropic(body);
}

// ── Streaming chat (mirrors functions/api/chat.js) ─
// Opens an SSE upstream to the provider and re-emits each token delta in a
// normalized shape (`data: {"text":"..."}`) so the client doesn't care which
// provider is in use. Ends with `data: [DONE]`.
function streamChat(body, res) {
  let upstreamHost, upstreamPath, upstreamHeaders, upstreamPayload;

  if (PROVIDER === 'groq') {
    const messages = [];
    if (body.system) messages.push({ role: 'system', content: body.system });
    messages.push(...(body.messages || []));
    upstreamHost    = 'api.groq.com';
    upstreamPath    = '/openai/v1/chat/completions';
    upstreamHeaders = { Authorization: `Bearer ${GROQ_KEY}` };
    upstreamPayload = { model: MODEL, messages, max_tokens: body.max_tokens || 1024, stream: true };
  } else {
    upstreamHost    = 'api.anthropic.com';
    upstreamPath    = '/v1/messages';
    upstreamHeaders = { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' };
    upstreamPayload = { ...body, model: MODEL, stream: true };
  }

  const buf = Buffer.from(JSON.stringify(upstreamPayload));
  const upstream = https.request(
    { hostname: upstreamHost, port: 443, path: upstreamPath, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length, ...upstreamHeaders } },
    provRes => {
      if (provRes.statusCode !== 200) {
        let err = '';
        provRes.on('data', c => err += c);
        provRes.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
          res.write(`data: ${JSON.stringify({ error: err || `Upstream ${provRes.statusCode}` })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        });
        return;
      }

      res.writeHead(200, {
        'Content-Type':      'text/event-stream',
        'Cache-Control':     'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      });

      let leftover = '';
      provRes.on('data', chunk => {
        leftover += chunk.toString();
        let nl;
        while ((nl = leftover.indexOf('\n\n')) !== -1) {
          const event = leftover.slice(0, nl);
          leftover = leftover.slice(nl + 2);
          for (const line of event.split('\n')) {
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (payload === '[DONE]') continue;        // Groq end marker — swallow; we emit our own
            try {
              const obj = JSON.parse(payload);
              const text = PROVIDER === 'groq'
                ? (obj.choices?.[0]?.delta?.content || '')
                : (obj.type === 'content_block_delta' && obj.delta?.type === 'text_delta' ? (obj.delta.text || '') : '');
              if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
            } catch (_) { /* swallow malformed SSE lines */ }
          }
        }
      });
      provRes.on('end',   () => { res.write('data: [DONE]\n\n'); res.end(); });
      provRes.on('error', e  => { res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`); res.write('data: [DONE]\n\n'); res.end(); });
    }
  );
  upstream.on('error', e => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  });
  upstream.write(buf);
  upstream.end();
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

  // ── POST /api/log ─────────────────────────────
  //  Local-dev mirror of functions/api/log.js — just prints the payload
  //  to terminal so you can see telemetry events while developing.
  //  Prod logs go to Cloudflare Pages → Real-time logs.
  if (req.method === 'POST' && pathname === '/api/log') {
    try {
      const body = await readBody(req);
      console.log('[brainfy-log]', JSON.stringify({ t: new Date().toISOString(), ...body }));
    } catch(_) { /* swallow — telemetry must never break the caller */ }
    res.writeHead(204);
    res.end();
    return;
  }

  // ── GET /api/ai-status ────────────────────────
  if (req.method === 'GET' && pathname === '/api/ai-status') {
    json(200, {
      configured: !!PROVIDER,
      provider:   PROVIDER,
      model:      MODEL,
    });
    return;
  }

  // ── POST /api/chat ────────────────────────────
  //  body.stream:true → returns text/event-stream with normalized
  //    `data: {"text":"..."}` events terminated by `data: [DONE]`.
  //  Anything else → single JSON response in Anthropic's shape.
  if (req.method === 'POST' && pathname === '/api/chat') {
    if (!PROVIDER) {
      json(503, { error: 'AI not configured. Add GROQ_API_KEY or ANTHROPIC_API_KEY to .env' });
      return;
    }
    try {
      const body = await readBody(req);
      if (body.stream === true) {
        streamChat(body, res);
        return;
      }
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
  //  Body: { content, contentType, title, subjName, image? }
  //   contentType: 'file' | 'youtube' | 'image'
  //   image (only when contentType==='image'): { b64, mime }
  //  Returns: { flashcards:[{q,a}], summary, outline }
  if (req.method === 'POST' && pathname === '/api/process-content') {
    if (!PROVIDER) { json(503, { error: 'AI not configured' }); return; }
    try {
      const { content, contentType, title, subjName, image } = await readBody(req);

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

      const isImage = contentType === 'image';
      if (isImage && (!image || !image.b64)) {
        json(400, { error: 'Missing image data' });
        return;
      }

      const userText = isImage
        ? `Image: "${title}"\nSubject: ${subjName}\n\nExtract the readable content from this image and produce study materials about it. If the image contains text (notes, slides, a textbook page), use that text. If it shows a diagram or scene, describe what's depicted and build flashcards around the concepts it illustrates.`
        : (contentType === 'youtube'
            ? `Video title: "${title}"\nSubject: ${subjName}\n\nTranscript:\n${content || '(transcript unavailable — generate from title)'}`
            : `Document: "${title}"\nSubject: ${subjName}\n\nContent:\n${content}`);

      // Provider-specific user-content shape for multimodal input.
      let userContent;
      if (isImage) {
        userContent = PROVIDER === 'groq'
          ? [
              { type: 'text',      text: userText },
              { type: 'image_url', image_url: { url: `data:${image.mime || 'image/png'};base64,${image.b64}` } },
            ]
          : [
              { type: 'text',  text: userText },
              { type: 'image', source: { type: 'base64', media_type: image.mime || 'image/png', data: image.b64 } },
            ];
      } else {
        userContent = userText;
      }

      const aiBody = {
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
        max_tokens: 4096,
      };
      if (isImage) aiBody.model = VISION_MODEL;

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

  // ── Unknown /api/* — don't fall through to SPA static handler ─
  if (pathname.startsWith('/api/')) {
    json(404, { error: 'Not found' });
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
  console.log('');
});
