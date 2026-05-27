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
        max_tokens: 2048,
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

  // Anthropic
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type':      'application/json',
    },
    body: JSON.stringify({
      model:      env.AI_MODEL || DEFAULT_MODELS.anthropic,
      max_tokens: 2048,
      system:     systemPrompt,
      messages: [{ role: 'user', content: userMsg }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `AI error ${res.status}`);
  return data.content?.[0]?.text || '';
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

  try {
    const text = await callAI(SYSTEM_PROMPT, userMsg, env);
    // Strip potential ```json fences the model might wrap output in
    const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(clean);
    return jsonResponse(parsed);
  } catch (e) {
    return jsonResponse({ error: e.message || String(e) }, 500);
  }
}
