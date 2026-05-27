// ────────────────────────────────────────────────────────────────────────────
//  Firebase ID-token verification for Cloudflare Pages Functions
//
//  Without this, every /api/* endpoint accepts any POST from anyone on the
//  internet — and the AI endpoints (/api/chat, /api/process-content,
//  /api/youtube) silently bill our Groq/Anthropic accounts. Verifying the
//  ID token forces the caller to be a real signed-in Brainfy user.
//
//  Algorithm:
//    1. Parse the JWT (header.payload.signature, base64url-encoded).
//    2. Validate cheap claims first: exp, iat, iss, aud.
//    3. Fetch Google's signing keys in JWK form (cached ~1h in module
//       memory — they rotate ~daily).
//    4. Find the JWK matching the token's `kid`, import it via Web Crypto.
//    5. Verify the RS256 signature with crypto.subtle.verify.
//
//  Throws an Error with a `code` property on any failure. Helpers below
//  turn that into a 401 response.
// ────────────────────────────────────────────────────────────────────────────

const JWK_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

// In-Worker memory cache. Cloudflare may reuse a Worker isolate across many
// requests, so caching here typically lasts minutes-to-hours. We still
// re-fetch when older than 1h to pick up Google's key rotation.
const KEY_TTL_MS = 60 * 60 * 1000;
let _keyCache = { fetchedAt: 0, keysByKid: /** @type {Record<string, JsonWebKey>} */ ({}) };

// Test-only escape hatch — resets the in-memory key cache so a unit test
// can swap in a mocked fetch and have the verifier actually call it instead
// of using a previously-cached real-Google JWKS. NOT for prod code paths.
export function _resetJwksCacheForTests() {
  _keyCache = { fetchedAt: 0, keysByKid: {} };
}

async function fetchJwks() {
  const now = Date.now();
  if (now - _keyCache.fetchedAt < KEY_TTL_MS && Object.keys(_keyCache.keysByKid).length) {
    return _keyCache.keysByKid;
  }
  const res = await fetch(JWK_URL, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!res.ok) throw err('jwks-fetch-failed', `JWKS endpoint returned ${res.status}`);
  const data = await res.json();
  const keys = data.keys || [];
  const byKid = {};
  for (const k of keys) if (k.kid) byKid[k.kid] = k;
  _keyCache = { fetchedAt: now, keysByKid: byKid };
  return byKid;
}

// base64url → Uint8Array
function b64uDecode(s) {
  // base64url uses -/_ and omits padding
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function err(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

/**
 * Verifies a Firebase ID token. Returns the decoded payload (uid, email, etc.)
 * on success; throws with .code on failure.
 *
 * @param {string} idToken — the raw "Bearer <token>" value (without the prefix)
 * @param {string} projectId — Firebase project ID; must match the token's `aud`
 */
export async function verifyFirebaseToken(idToken, projectId) {
  if (!idToken) throw err('missing-token', 'No token provided');
  if (!projectId) throw err('config', 'projectId not configured');

  const parts = idToken.split('.');
  if (parts.length !== 3) throw err('malformed', 'JWT must have 3 segments');

  const [headerB64, payloadB64, sigB64] = parts;
  let header, payload;
  try {
    header  = JSON.parse(new TextDecoder().decode(b64uDecode(headerB64)));
    payload = JSON.parse(new TextDecoder().decode(b64uDecode(payloadB64)));
  } catch (_) {
    throw err('malformed', 'JWT header/payload not valid JSON');
  }

  // ── Cheap claim checks first — no point doing crypto if these fail ──
  if (header.alg !== 'RS256') throw err('bad-alg', 'Expected RS256');
  if (!header.kid)            throw err('no-kid',  'Token header missing kid');

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now)
    throw err('expired', 'Token expired');
  // Allow 60s clock skew on iat / auth_time
  if (typeof payload.iat === 'number' && payload.iat > now + 60)
    throw err('future-iat', 'Token issued in the future');
  if (payload.aud !== projectId)
    throw err('bad-aud', `Expected aud=${projectId}, got ${payload.aud}`);
  if (payload.iss !== `https://securetoken.google.com/${projectId}`)
    throw err('bad-iss', `Bad issuer: ${payload.iss}`);
  if (!payload.sub) throw err('no-sub', 'Token missing subject (uid)');

  // ── Signature verification ──
  const keys = await fetchJwks();
  const jwk  = keys[header.kid];
  if (!jwk) throw err('unknown-kid', `No matching key for kid=${header.kid}`);

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    // Web Crypto rejects 'alg' on imported JWKs in some runtimes; strip it.
    { kty: jwk.kty, n: jwk.n, e: jwk.e, use: 'sig' },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  // Signed data is the ASCII bytes of `${headerB64}.${payloadB64}`
  const signedBytes = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sigBytes    = b64uDecode(sigB64);

  const ok = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    cryptoKey,
    sigBytes,
    signedBytes,
  );
  if (!ok) throw err('bad-signature', 'Signature verification failed');

  return payload; // { sub: uid, email, name, ... }
}

/**
 * Pull the Bearer token off a Request's Authorization header. Returns the
 * raw token string, or null if the header is missing/malformed. Tolerates
 * "Bearer X", "bearer X", and stray whitespace.
 */
export function extractBearer(request) {
  const h = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!h) return null;
  const m = h.match(/^\s*Bearer\s+(.+?)\s*$/i);
  return m ? m[1] : null;
}

/**
 * Standard 401 JSON response. Used by every protected endpoint when auth
 * fails — same shape across the board so the client can show a single
 * "your session expired, please sign in" message.
 */
export function unauthorized(code, message) {
  return new Response(JSON.stringify({ error: 'unauthorized', code, message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Convenience wrapper: extract + verify in one call. Returns the decoded
 * payload on success, or a Response (401) on failure. Endpoints that
 * receive a Response should return it directly.
 *
 * Usage:
 *   const auth = await requireAuth(request, env);
 *   if (auth instanceof Response) return auth;
 *   const uid = auth.sub;
 */
export async function requireAuth(request, env) {
  const projectId = env.FIREBASE_PROJECT_ID || 'brainfy-65b7a';
  const token = extractBearer(request);
  if (!token) return unauthorized('missing-token', 'No Authorization header');
  try {
    return await verifyFirebaseToken(token, projectId);
  } catch (e) {
    return unauthorized(e.code || 'invalid-token', e.message || 'Token verification failed');
  }
}
