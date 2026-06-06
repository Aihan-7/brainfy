// ────────────────────────────────────────────────────────────────────────────
//  Shared test helpers for the endpoint + guard suites.
//
//  These let a test:
//    • mint a REAL Firebase-shaped ID token that `requireAuth` will accept
//      (RSA keypair via Web Crypto, signed RS256), paired with the matching
//      JWK so a mocked fetch can serve it — see makeAuthToken() + jwksRoute().
//    • stub global fetch with a small URL router so endpoints never touch the
//      network and tests stay deterministic — see router().
//    • build a minimal Request-like object the Cloudflare handlers accept —
//      see mkRequest().
// ────────────────────────────────────────────────────────────────────────────

// Default Firebase project the verifier falls back to when env.FIREBASE_PROJECT_ID
// is unset (matches functions/api/_lib/auth.js).
export const PROJECT_ID = 'brainfy-65b7a';

// Substring identifying Google's securetoken JWKS endpoint (auth.js JWK_URL).
export const JWK_URL_SUBSTR = 'securetoken@system.gserviceaccount.com';

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlJson = (obj) => b64url(JSON.stringify(obj));

// Generate an RSA keypair, sign a valid Firebase-shaped ID token with it, and
// return { token, jwk, sub }. `jwk` is the PUBLIC key (with a kid) to be served
// by a mocked JWKS fetch so verifyFirebaseToken's signature check passes.
export async function makeAuthToken({ kid = 'test-kid', projectId = PROJECT_ID, sub = 'uid-test' } = {}) {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const jwk = await crypto.subtle.exportKey('jwk', publicKey);
  jwk.kid = kid;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', kid, typ: 'JWT' };
  const payload = {
    aud: projectId,
    iss: `https://securetoken.google.com/${projectId}`,
    sub,
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${b64urlJson(header)}.${b64urlJson(payload)}`;
  const sig = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    new TextEncoder().encode(signingInput),
  );
  return { token: `${signingInput}.${b64url(new Uint8Array(sig))}`, jwk, sub };
}

// A fetch-router response stub shaped like the slice of the Fetch Response API
// the handlers actually use: { ok, status, json(), text() }.
export function jsonStub(obj, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => obj, text: async () => JSON.stringify(obj) };
}
export function textStub(str, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    text: async () => str,
    json: async () => JSON.parse(str),
  };
}

// Build a fetch replacement from an ordered list of { test, handler } routes.
// First matching route wins; an unmatched URL throws so tests never silently
// hit the real network. `handler` may be a value or a (url, opts) => value fn.
export function router(routes) {
  return async (url, opts) => {
    const u = String(url);
    for (const r of routes) {
      if (r.test(u)) return typeof r.handler === 'function' ? r.handler(u, opts) : r.handler;
    }
    throw new Error(`Unexpected fetch in test: ${u}`);
  };
}

// Route that serves a single-key JWKS for the securetoken endpoint.
export function jwksRoute(jwk) {
  return { test: (u) => u.includes(JWK_URL_SUBSTR), handler: () => jsonStub({ keys: [jwk] }) };
}

// Authorization header carrying a bearer token.
export const bearer = (token) => ({ authorization: `Bearer ${token}` });

// Minimal Request-like object the handlers consume. Pass `json` for a parsed
// body; pass json:'__throw__' to simulate an unparseable body (request.json()
// rejects). Extra `headers` (e.g. content-length) are matched case-insensitively.
export function mkRequest({ headers = {}, json } = {}) {
  const h = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
  return {
    headers: {
      get: (k) => {
        const v = h.get(String(k).toLowerCase());
        return v === undefined ? null : v;
      },
    },
    json: async () => {
      if (json === '__throw__') throw new SyntaxError('Unexpected token in JSON');
      return json;
    },
  };
}

// A Workers-KV stub backed by a Map (for rateLimit tests).
export function makeKV(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    _store: store,
    get: async (k) => (store.has(k) ? store.get(k) : null),
    put: async (k, v) => { store.set(k, v); },
  };
}
