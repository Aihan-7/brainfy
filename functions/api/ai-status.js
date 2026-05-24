// Cloudflare Pages Function — GET /api/ai-status
// Mirrors the local server.js handler so the client doesn't need to know
// which backend is responding. Reads keys from the Pages env (Settings →
// Environment variables in the Pages project dashboard).

const DEFAULT_MODELS = {
  groq:      'llama-3.3-70b-versatile',
  anthropic: 'claude-3-5-haiku-20241022',
};

export async function onRequestGet(context) {
  const { env } = context;
  const provider = env.GROQ_API_KEY
    ? 'groq'
    : env.ANTHROPIC_API_KEY
      ? 'anthropic'
      : null;
  const model = env.AI_MODEL || (provider ? DEFAULT_MODELS[provider] : '');

  return new Response(JSON.stringify({
    configured: !!provider,
    provider,
    model,
    firebase:   false, // direct-from-client Firestore now (no server middleman)
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
