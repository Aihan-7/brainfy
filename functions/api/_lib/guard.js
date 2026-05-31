// Shared request guards for the token-burning AI endpoints (/api/chat,
// /api/process-content). Every call bills our Groq/Anthropic accounts, so an
// authenticated caller — or a leaked ID token — must not be able to fire
// unbounded or oversized requests. These guards contain cost amplification:
//
//   • tooLarge()       — reject oversized bodies before we even parse them.
//   • clampMaxTokens() — never trust the client's max_tokens (it sets output cost).
//   • rateLimit()      — best-effort per-UID request cap, backed by Workers KV.
//
// The rate limiter is OPTIONAL infra: bind a KV namespace as RATE_LIMIT_KV in
// the Pages project to activate it. Until then it no-ops (fails open) so the
// endpoints keep working. For a hard volume cap without app code, also add a
// Cloudflare Rate Limiting rule on /api/* in the dashboard.

// Reject bodies larger than maxBytes using the Content-Length header, before
// JSON parsing. Returns a 413 Response if too large, else null.
export function tooLarge(request, maxBytes) {
  const len = parseInt(request.headers.get('content-length') || '0', 10);
  if (len && len > maxBytes) {
    return new Response(JSON.stringify({ error: 'Request too large' }), {
      status: 413,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}

// Clamp a client-supplied max_tokens to a hard server ceiling. Falls back to
// the ceiling when the value is missing or invalid.
export function clampMaxTokens(value, ceiling) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return ceiling;
  return Math.min(Math.floor(n), ceiling);
}

// Best-effort per-UID rate limiter backed by a Workers KV namespace bound as
// env.RATE_LIMIT_KV. No-ops (fails open) when the binding is absent or KV
// errors — we never block legitimate users on missing/broken infra. Returns
// { ok:true } or { ok:false, retryAfter }.
export async function rateLimit(env, uid, { limit = 30, windowSec = 60, prefix = 'rl' } = {}) {
  const kv = env && env.RATE_LIMIT_KV;
  if (!kv || !uid) return { ok: true, skipped: true };
  const bucket = Math.floor(Date.now() / 1000 / windowSec);
  const key = `${prefix}:${uid}:${bucket}`;
  try {
    const cur = await kv.get(key);
    const count = cur ? (parseInt(cur, 10) || 0) : 0;
    if (count >= limit) return { ok: false, retryAfter: windowSec };
    // TTL slightly beyond the window so stale buckets self-expire.
    await kv.put(key, String(count + 1), { expirationTtl: windowSec + 5 });
    return { ok: true, remaining: Math.max(0, limit - count - 1) };
  } catch (_) {
    return { ok: true, skipped: true };
  }
}

export function tooMany(retryAfter) {
  return new Response(JSON.stringify({ error: 'Too many requests — slow down a moment and try again.' }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfter || 60) },
  });
}
