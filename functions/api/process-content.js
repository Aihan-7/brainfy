// Cloudflare Pages Function — POST /api/process-content
// Takes raw content (note text, YouTube transcript, image upload, etc.) and
// asks the AI to extract flashcards + summary + outline in one shot. Returns
// parsed JSON to the client.
//
// Auth: requires a valid Firebase ID token. Each call burns thousands of
// tokens — unauthenticated traffic here is direct billing pain.

import { requireAuth } from './_lib/auth.js';

// Default text models. Vision-capable counterparts are picked when the
// request carries an image; both can be overridden via env vars.
const DEFAULT_MODELS = {
  groq:             'llama-3.3-70b-versatile',
  groqVision:       'meta-llama/llama-4-scout-17b-16e-instruct',
  anthropic:        'claude-3-5-haiku-20241022',
  anthropicVision:  'claude-haiku-4-5-20251001',
};

// Study mode (default) — auto-generated on the processing screen. Flashcards
// + outline only; the summary is generated lazily later (summary mode).
const STUDY_PROMPT = `You are an expert study assistant. Analyze the provided content and return a JSON object with exactly this structure:
{
  "flashcards": [{"q": "question", "a": "answer"}, ...],
  "outline": ["Topic 1", "  • Subtopic 1a", "  • Subtopic 1b", "Topic 2", ...]
}

Rules:
- Generate AT LEAST 15 high-quality flashcards covering key concepts (aim for 15-25). Never return fewer than 15.
- Flashcard questions should test real understanding, not trivial facts
- Outline should be a flat string array representing hierarchy with indentation
- Do NOT include a summary field
- Return ONLY the JSON, no markdown fences`;

// Summary mode — generated on demand when the user clicks "Generate summary".
const SUMMARY_PROMPT = `You are an expert study assistant. Analyze the provided content and return a JSON object with exactly this structure:
{
  "summary": "A comprehensive, well-structured markdown study summary. 700-1000 words."
}

Rules:
- Write a thorough, in-depth summary of 700-1000 words — never fewer than 700 words.
- Organize it into MULTIPLE sections using ## headings (e.g. Overview, Key Concepts, Important Details, Examples, Takeaways). Use as many sections as the content needs.
- Under each heading use bullet points (- ) for facts, lists, and steps, and short paragraphs for explanations.
- Define every important term, explain the reasoning behind key ideas, and include concrete examples where relevant.
- Bold the most important keywords with **double asterisks**.
- Cover the material comprehensively — do not omit significant topics from the source content.
- Return ONLY the JSON object, no markdown fences, no commentary.`;

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// userMsg shape — either a plain string (text path) or
//   { text: string, image: { b64: string, mime: string } } (vision path).
// Returning a single string vs. a multimodal content array is the only thing
// that differs in the body structure per provider.
async function callAI(systemPrompt, userMsg, env) {
  const provider = env.GROQ_API_KEY ? 'groq' : env.ANTHROPIC_API_KEY ? 'anthropic' : null;
  if (!provider) throw new Error('AI not configured');

  const isImage = typeof userMsg !== 'string';
  const visionModelKey = provider === 'groq' ? 'groqVision' : 'anthropicVision';
  const textModelKey   = provider;
  const model = isImage
    ? (env.AI_VISION_MODEL || DEFAULT_MODELS[visionModelKey])
    : (env.AI_MODEL        || DEFAULT_MODELS[textModelKey]);

  if (provider === 'groq') {
    const userContent = isImage
      ? [
          { type: 'text',      text: userMsg.text },
          { type: 'image_url', image_url: { url: `data:${userMsg.image.mime};base64,${userMsg.image.b64}` } },
        ]
      : userMsg;

    // Groq supports server-enforced JSON mode on text models. The vision
    // models don't accept response_format=json_object — relying on the
    // prompt + the retry-once fallback in onRequestPost for those.
    const reqBody = {
      model,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent  },
      ],
    };
    if (!isImage) reqBody.response_format = { type: 'json_object' };

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(reqBody),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `AI error ${res.status}`);
    return data.choices?.[0]?.message?.content || '';
  }

  // Anthropic — no response_format equivalent, so we prefill the assistant
  // with an opening "{" to force a JSON-object completion (works with both
  // text-only and image inputs). Need to re-prepend the { on the way out.
  const userContent = isImage
    ? [
        { type: 'text',  text: userMsg.text },
        { type: 'image', source: { type: 'base64', media_type: userMsg.image.mime, data: userMsg.image.b64 } },
      ]
    : userMsg;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type':      'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system:     systemPrompt,
      messages: [
        { role: 'user',      content: userContent },
        { role: 'assistant', content: '{'         },
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

  const { content, contentType, title, subjName, image, mode } = body;
  const systemPrompt = mode === 'summary' ? SUMMARY_PROMPT : STUDY_PROMPT;

  // Build the user message in our internal shape (string vs multimodal).
  let userMsg;
  if (contentType === 'image') {
    if (!image || !image.b64) return jsonResponse({ error: 'Missing image data' }, 400);
    userMsg = {
      text: `Image: "${title}"\nSubject: ${subjName}\n\nExtract the readable content from this image and produce study materials about it. If the image contains text (notes, slides, a textbook page), use that text. If it shows a diagram or scene, describe what's depicted and build flashcards around the concepts it illustrates.`,
      image: { b64: image.b64, mime: image.mime || 'image/png' },
    };
  } else if (contentType === 'youtube') {
    userMsg = `Video title: "${title}"\nSubject: ${subjName}\n\nTranscript:\n${content || '(transcript unavailable — generate from title)'}`;
  } else {
    userMsg = `Document: "${title}"\nSubject: ${subjName}\n\nContent:\n${content}`;
  }

  // Two-attempt strategy. Attempt 1 uses the standard prompt; if parse fails
  // (most often: a long markdown summary missing escaping), attempt 2 retries
  // with a stricter prompt. Avoids burning the user's request on a single
  // bad token-stream.
  function tryParse(text) {
    const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(clean);
  }

  try {
    const text = await callAI(systemPrompt, userMsg, env);
    let parsed;
    try {
      parsed = tryParse(text);
    } catch (firstErr) {
      const stricter = systemPrompt + `

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
