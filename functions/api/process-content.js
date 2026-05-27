// Cloudflare Pages Function — POST /api/process-content
// Takes raw content (note text, YouTube transcript, etc.) and asks the AI
// to extract flashcards + summary + outline in one shot. Returns parsed
// JSON to the client.
//
// Auth: requires a valid Firebase ID token. Each call burns thousands of
// tokens (max_tokens=2048 with non-trivial prompt) — unauthenticated traffic
// here is direct billing pain.

import { requireAuth } from './_lib/auth.js';

const DEFAULT_MODELS = {
  groq:      'llama-3.3-70b-versatile',
  anthropic: 'claude-3-5-haiku-20241022',
};

const SYSTEM_PROMPT = `You are an expert study assistant. Analyze the provided content and return a JSON object with exactly this structure:
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

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function callAI(systemPrompt, userMsg, env) {
  const provider = env.GROQ_API_KEY ? 'groq' : env.ANTHROPIC_API_KEY ? 'anthropic' : null;
  if (!provider) throw new Error('AI not configured');

  if (provider === 'groq') {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:      env.AI_MODEL || DEFAULT_MODELS.groq,
        max_tokens: 4096,                                  // ↑ from 2048 — 2k could truncate JSON mid-string
        response_format: { type: 'json_object' },          // server-enforced valid JSON
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMsg },
        ],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `AI error ${res.status}`);
    return data.choices?.[0]?.message?.content || '';
  }

  // Anthropic — no equivalent of response_format, so we use a prefill trick:
  // pre-supply the assistant's opening "{" so the model continues as a JSON
  // object rather than starting with prose. Need to re-prepend the { when
  // re-assembling the response.
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type':      'application/json',
    },
    body: JSON.stringify({
      model:      env.AI_MODEL || DEFAULT_MODELS.anthropic,
      max_tokens: 4096,
      system:     systemPrompt,
      messages: [
        { role: 'user',      content: userMsg },
        { role: 'assistant', content: '{' },     // prefill — forces JSON
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `AI error ${res.status}`);
  return '{' + (data.content?.[0]?.text || '');
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const provider = env.GROQ_API_KEY ? 'groq' : env.ANTHROPIC_API_KEY ? 'anthropic' : null;
  if (!provider) return jsonResponse({ error: 'AI not configured' }, 503);

  let body;
  try { body = await request.json(); }
  catch (_) { return jsonResponse({ error: 'Invalid JSON body' }, 400); }

  const { content, contentType, title, subjName } = body;
  const userMsg = contentType === 'youtube'
    ? `Video title: "${title}"\nSubject: ${subjName}\n\nTranscript:\n${content || '(transcript unavailable — generate from title)'}`
    : `Document: "${title}"\nSubject: ${subjName}\n\nContent:\n${content}`;

  // Two-attempt strategy. Attempt 1 uses the standard prompt + (for Groq)
  // server-enforced JSON mode → should succeed almost always. If parse
  // fails anyway (Anthropic edge cases, or Groq somehow emits invalid JSON
  // despite response_format), attempt 2 retries with a stricter prompt
  // that explicitly demands escaping. Avoids burning the user's request
  // entirely on a single bad token-stream from the model.
  function tryParse(text) {
    const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(clean);
  }

  try {
    const text = await callAI(SYSTEM_PROMPT, userMsg, env);
    let parsed;
    try {
      parsed = tryParse(text);
    } catch (firstErr) {
      // Retry once with a stricter prompt that hammers the escaping rules.
      // Most parse failures we've seen are missing opening quotes on long
      // markdown string values (e.g. "summary": ## Heading…). Calling this
      // out explicitly + asking to double-check has been reliable enough.
      const stricter = SYSTEM_PROMPT + `

ABSOLUTE OUTPUT REQUIREMENTS — your previous attempt produced invalid JSON.
- Every string VALUE must be wrapped in matching " quotes.
- Inside string values, escape newlines as \\n and quotes as \\".
- Do not put bare markdown after a colon. The summary field is a STRING.
- Validate your JSON mentally before emitting it.
- Output ONLY the JSON object. No prose, no fences, no commentary.`;
      const retryText = await callAI(stricter, userMsg, env);
      parsed = tryParse(retryText);
    }
    return jsonResponse(parsed);
  } catch (e) {
    return jsonResponse({ error: e.message || String(e) }, 500);
  }
}
