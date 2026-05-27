// Cloudflare Pages Function — POST /api/chat
// Proxies to Groq (preferred — free, fast) or Anthropic. Normalises the
// response shape so the client's existing parser doesn't have to change:
//   { content: [{ type:'text', text:'...' }], usage: { input_tokens, output_tokens } }
//
// Auth: requires a valid Firebase ID token (Authorization: Bearer …). Without
// this gate, anyone on the internet can hit our endpoint and bill our Groq /
// Anthropic accounts.

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

  // Re-shape Groq's OpenAI-style response into Anthropic's content[] shape
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

export async function onRequestPost(context) {
  const { request, env } = context;

  // Auth first — refuse to spend a token on an unauthenticated request.
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const provider = env.GROQ_API_KEY ? 'groq' : env.ANTHROPIC_API_KEY ? 'anthropic' : null;
  if (!provider) {
    return jsonResponse({ error: 'AI not configured. Set GROQ_API_KEY or ANTHROPIC_API_KEY in Pages env vars.' }, 503);
  }

  let body;
  try { body = await request.json(); }
  catch (_) { return jsonResponse({ error: 'Invalid JSON body' }, 400); }

  try {
    return provider === 'groq' ? callGroq(body, env) : callAnthropic(body, env);
  } catch (e) {
    return jsonResponse({ error: e.message || String(e) }, 500);
  }
}
