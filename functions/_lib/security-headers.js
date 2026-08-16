// Security headers for Pages **Functions** responses.
//
// WHY THIS EXISTS
// ───────────────
// The root `_headers` file only decorates static assets. Responses produced by
// Pages Functions get none of it — verified against production on 2026-08-16:
//
//   curl -D- https://brainfy.online/        → CSP, XFO, HSTS, nosniff  ✅
//   curl -D- https://brainfy.online/decks   → none of them             ❌
//
// So the two surfaces that most need a safety net — the SSR pages that render
// other users' deck text, and the JSON API — were running bare. See
// AUDIT-2026-08-16.md, P1-2.
//
// These CSPs are deliberately TIGHTER than the app's: neither surface loads the
// Firebase SDK, and neither makes any fetch() call at all.

// SSR deck pages: inline <script>/style="" of our own, Google Fonts, no fetching.
export const DECK_CSP =
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline'; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src https://fonts.gstatic.com; " +
  "img-src 'self' data:; " +
  "connect-src 'none'; " +
  "frame-src 'none'; frame-ancestors 'none'; " +
  "base-uri 'self'; form-action 'none'; object-src 'none'";

// JSON/XML endpoints render nothing and load nothing.
export const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";

/**
 * Return a copy of `res` carrying the standard header set. Existing headers are
 * never overwritten — an endpoint that deliberately set its own Cache-Control
 * (or a stricter CSP) keeps it.
 */
export function withSecurityHeaders(res, csp = API_CSP) {
  // Response headers coming back from next() can be immutable; re-wrap so the
  // body (including an in-flight SSE stream) passes through untouched.
  const out = new Response(res.body, res);
  const set = (k, v) => { if (!out.headers.has(k)) out.headers.set(k, v); };

  set('Content-Security-Policy', csp);
  set('X-Content-Type-Options', 'nosniff');
  set('X-Frame-Options', 'DENY');
  set('Referrer-Policy', 'strict-origin-when-cross-origin');
  set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  set('Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=(), magnetometer=(), midi=(), interest-cohort=()');

  return out;
}
