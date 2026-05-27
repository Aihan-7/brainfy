// Cloudflare Pages Function — POST /api/chat
// Proxies to Groq (preferred — free, fast) or Anthropic.
//
// Two modes per request body:
//   stream:false (default) → returns a single JSON object in Anthropic's shape:
//     { content:[{type:'text',text:'...'}], usage:{input_tokens,output_tokens} }
//   stream:true            → returns a normalized SSE stream where every event
//     is `data: {"text":"<delta>"}` and the stream ends with `data: [DONE]`.
//     The client never needs to know which provider produced the tokens.
//
// Auth: requires a valid Firebase ID token. Without this gate, anyone on the
// internet can hit our endpoint and bill our Groq / Anthropic accounts.

import { requireAuth } from './_lib/auth.js';

const DEFAULT_MODELS = {
  groq:      'llama-3.3-70b-versatile',
  anthropic: 'claude-3-5-haiku-20241022',
};

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Non-streaming paths (unchanged behaviour) ────────────────────────────

async function callGroq(body, env) {
  const messages = [];
  if (body.system) messages.push({ role: 'system', content: body.system });
  messages.push(...(body.messages || []));

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model:      env.AI_MODEL || DEFAULT_MODELS.groq,
      messages,
      max_tokens: body.max_tokens || 1024,
    }),
  });
  const data = await res.json();
  if (!res.ok) return jsonResponse(data, res.status);

  const choice = data.choices?.[0];
  const usage  = data.usage || {};
  return jsonResponse({
    content: [{ type: 'text', text: choice?.message?.content || '' }],
    usage: {
      input_tokens:  usage.prompt_tokens     || 0,
      output_tokens: usage.completion_tokens || 0,
    },
  });
}

async function callAnthropic(body, env) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type':      'application/json',
    },
    body: JSON.stringify({ ...body, model: env.AI_MODEL || DEFAULT_MODELS.anthropic }),
  });
  const data = await res.json();
  return jsonResponse(data, res.status);
}

// ── Streaming paths ──────────────────────────────────────────────────────
// Both providers ship SSE — different envelope shapes that we normalize down
// to one line type the client expects: `data: {"text":"<delta>"}`.

function sseEncodeText(encoder, text) {
  return encoder.encode(`data: ${JSON.stringify({ text })}\n\n`);
}

function sseDone(encoder) {
  return encoder.encode('data: [DONE]\n\n');
}

// Pulls full SSE events out of a chunked byte stream. Each event is a run of
// `field: value` lines terminated by a blank line. We only care about `data:`.
async function* readSSEEvents(stream) {
  const reader  = stream.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    // SSE events are separated by \n\n. Process every complete one in the buf.
    while ((nl = buf.indexOf('\n\n')) !== -1) {
      const event = buf.slice(0, nl);
      buf = buf.slice(nl + 2);
      for (const line of event.split('\n')) {
        if (line.startsWith('data:')) yield line.slice(5).trim();
      }
    }
  }
}

// Translate one provider data line → 0+ normalized client SSE events.
//   Groq:      data: {"choices":[{"delta":{"content":"hi"}}]}  (or [DONE])
//   Anthropic: data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"hi"}}
function extractDeltaText(providerLine, provider) {
  if (providerLine === '[DONE]') return null;            // Groq end-of-stream
  try {
    const obj = JSON.parse(providerLine);
    if (provider === 'groq') {
      return obj.choices?.[0]?.delta?.content || '';
    }
    if (obj.type === 'content_block_delta' && obj.delta?.type === 'text_delta') {
      return obj.delta.text || '';
    }
    return '';
  } catch (_) { return ''; }
}

async function streamProvider(provider, body, env) {
  const upstreamHeaders = provider === 'groq'
    ? { 'Authorization': `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' }
    : { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' };

  let upstreamBody;
  let upstreamUrl;
  if (provider === 'groq') {
    const messages = [];
    if (body.system) messages.push({ role: 'system', content: body.system });
    messages.push(...(body.messages || []));
    upstreamUrl = 'https://api.groq.com/openai/v1/chat/completions';
    upstreamBody = JSON.stringify({
      model:      env.AI_MODEL || DEFAULT_MODELS.groq,
      messages,
      max_tokens: body.max_tokens || 1024,
      stream:     true,
    });
  } else {
    upstreamUrl  = 'https://api.anthropic.com/v1/messages';
    upstreamBody = JSON.stringify({
      ...body,
      model:  env.AI_MODEL || DEFAULT_MODELS.anthropic,
      stream: true,
    });
  }

  const upstream = await fetch(upstreamUrl, { method: 'POST', headers: upstreamHeaders, body: upstreamBody });
  if (!upstream.ok || !upstream.body) {
    // Upstream rejected before streaming started — surface as a one-shot error
    // wrapped in SSE so the client's stream consumer can handle it uniformly.
    const errText = await upstream.text();
    const enc = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const w = writable.getWriter();
    await w.write(enc.encode(`data: ${JSON.stringify({ error: errText || `Upstream ${upstream.status}` })}\n\n`));
    await w.write(sseDone(enc));
    await w.close();
    return readable;
  }

  const { readable, writable } = new TransformStream();
  // Pump in the background; do NOT await — we must return the readable side
  // immediately so the client starts receiving bytes as soon as they arrive.
  (async () => {
    const writer = writable.getWriter();
    const enc    = new TextEncoder();
    try {
      for await (const line of readSSEEvents(upstream.body)) {
        const delta = extractDeltaText(line, provider);
        if (delta) await writer.write(sseEncodeText(enc, delta));
      }
    } catch (e) {
      await writer.write(enc.encode(`data: ${JSON.stringify({ error: e.message || 'Stream interrupted' })}\n\n`));
    } finally {
      await writer.write(sseDone(enc));
      await writer.close();
    }
  })();

  return readable;
}

// ── Entry point ──────────────────────────────────────────────────────────

export async function onRequestPost(context) {
  const { request, env } = context;

  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const provider = env.GROQ_API_KEY ? 'groq' : env.ANTHROPIC_API_KEY ? 'anthropic' : null;
  if (!provider) {
    return jsonResponse({ error: 'AI not configured. Set GROQ_API_KEY or ANTHROPIC_API_KEY in Pages env vars.' }, 503);
  }

  let body;
  try { body = await request.json(); }
  catch (_) { return jsonResponse({ error: 'Invalid JSON body' }, 400); }

  // Streaming path — returns text/event-stream the client can read chunk-by-chunk.
  if (body.stream === true) {
    try {
      const readable = await streamProvider(provider, body, env);
      return new Response(readable, {
        headers: {
          'Content-Type':       'text/event-stream',
          'Cache-Control':      'no-cache, no-transform',
          'X-Accel-Buffering':  'no',
        },
      });
    } catch (e) {
      return jsonResponse({ error: e.message || String(e) }, 500);
    }
  }

  // Non-streaming path — unchanged behaviour.
  try {
    return provider === 'groq' ? callGroq(body, env) : callAnthropic(body, env);
  } catch (e) {
    return jsonResponse({ error: e.message || String(e) }, 500);
  }
}
