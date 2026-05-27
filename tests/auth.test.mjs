// ────────────────────────────────────────────────────────────────────────────
//  Tests for functions/api/_lib/auth.js
//
//  Coverage:
//    extractBearer  — 4 cases (null, valid, ws+case-tolerant, non-Bearer)
//    verifyFirebaseToken — 14 unhappy paths + 1 happy path
//
//  Happy path generates a real RSA keypair via Web Crypto, signs a JWT
//  with the private key, mocks `fetch` to return the matching JWK, and
//  verifies the verifier accepts the token. Catches regressions in the
//  signature-verification + JWK-import pipeline that the unhappy paths
//  alone can't reach.
//
//  Run: `node --test tests/auth.test.mjs`  (or `npm test`)
// ────────────────────────────────────────────────────────────────────────────

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { verifyFirebaseToken, extractBearer, _resetJwksCacheForTests }
  from '../functions/api/_lib/auth.js';

// Stub fetch with an empty JWKS by default for the whole file. This means:
//   • tests never hit the network (CI-friendly, deterministic)
//   • unknown-kid tests get an empty key-set → look-up fails → unknown-kid
//   • happy-path tests can override the stub per-test to serve a real key
// Each test resets the verifier's in-memory cache so the previous test's
// mock doesn't leak through.
const _realFetch = globalThis.fetch;
beforeEach(() => {
  _resetJwksCacheForTests();
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ keys: [] }) });
});
afterEach(() => {
  globalThis.fetch = _realFetch;
});

const PROJECT_ID = 'brainfy-65b7a';
const ISS        = `https://securetoken.google.com/${PROJECT_ID}`;

// ── Helpers ────────────────────────────────────────────────────────────────

const mkReq = (authHeader) => ({
  headers: { get: (k) => k.toLowerCase() === 'authorization' ? authHeader : null },
});

const b64url = (obj) =>
  Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fakeToken = (header, payload) => `${b64url(header)}.${b64url(payload)}.fakesig`;

// Expects verifyFirebaseToken to throw with `err.code === expectedCode`.
async function expectCode(token, projectId, expectedCode) {
  await assert.rejects(
    () => verifyFirebaseToken(token, projectId),
    (err) => {
      assert.equal(err.code, expectedCode, `expected code=${expectedCode}, got ${err.code}: ${err.message}`);
      return true;
    },
  );
}

// ── extractBearer ──────────────────────────────────────────────────────────

describe('extractBearer', () => {
  test('returns null when no Authorization header', () => {
    assert.equal(extractBearer(mkReq(null)), null);
  });

  test('parses a standard Bearer token', () => {
    assert.equal(extractBearer(mkReq('Bearer abc.def.ghi')), 'abc.def.ghi');
  });

  test('tolerates lowercase + extra whitespace', () => {
    assert.equal(extractBearer(mkReq('  bearer   xyz  ')), 'xyz');
  });

  test('rejects non-Bearer schemes', () => {
    assert.equal(extractBearer(mkReq('Token abc')), null);
    assert.equal(extractBearer(mkReq('Basic dXNlcjpwYXNz')), null);
  });
});

// ── verifyFirebaseToken — unhappy paths ────────────────────────────────────

describe('verifyFirebaseToken (failure cases)', () => {
  test('missing token → missing-token', async () => {
    await expectCode(null, PROJECT_ID, 'missing-token');
    await expectCode('',   PROJECT_ID, 'missing-token');
  });

  test('missing projectId → config', async () => {
    await expectCode('a.b.c', null, 'config');
    await expectCode('a.b.c', '',   'config');
  });

  test('wrong segment count → malformed', async () => {
    await expectCode('only-one-segment',           PROJECT_ID, 'malformed');
    await expectCode('a.b.c.d.e',                   PROJECT_ID, 'malformed');
  });

  test('non-base64 header → malformed', async () => {
    await expectCode('!!!.!!!.!!!', PROJECT_ID, 'malformed');
  });

  test('wrong algorithm → bad-alg', async () => {
    const tok = fakeToken(
      { alg: 'HS256', kid: 'x' },
      { aud: PROJECT_ID, iss: ISS, sub: 'u', exp: 9e9 },
    );
    await expectCode(tok, PROJECT_ID, 'bad-alg');
  });

  test('missing kid → no-kid', async () => {
    const tok = fakeToken({ alg: 'RS256' }, {});
    await expectCode(tok, PROJECT_ID, 'no-kid');
  });

  test('expired token → expired', async () => {
    const tok = fakeToken({ alg: 'RS256', kid: 'x' }, { exp: 1 });
    await expectCode(tok, PROJECT_ID, 'expired');
  });

  test('iat in the future (> 60s skew) → future-iat', async () => {
    const tok = fakeToken(
      { alg: 'RS256', kid: 'x' },
      { exp: 9e9, iat: 9e9, aud: PROJECT_ID, iss: ISS, sub: 'u' },
    );
    await expectCode(tok, PROJECT_ID, 'future-iat');
  });

  test('wrong aud → bad-aud', async () => {
    const tok = fakeToken(
      { alg: 'RS256', kid: 'x' },
      { exp: 9e9, aud: 'some-other-project', sub: 'u' },
    );
    await expectCode(tok, PROJECT_ID, 'bad-aud');
  });

  test('wrong iss → bad-iss', async () => {
    const tok = fakeToken(
      { alg: 'RS256', kid: 'x' },
      { exp: 9e9, aud: PROJECT_ID, iss: 'https://evil.example/' + PROJECT_ID, sub: 'u' },
    );
    await expectCode(tok, PROJECT_ID, 'bad-iss');
  });

  test('missing sub → no-sub', async () => {
    const tok = fakeToken(
      { alg: 'RS256', kid: 'x' },
      { exp: 9e9, aud: PROJECT_ID, iss: ISS },
    );
    await expectCode(tok, PROJECT_ID, 'no-sub');
  });

  test('unknown kid (not in JWKS) → unknown-kid', async () => {
    const tok = fakeToken(
      { alg: 'RS256', kid: 'definitely-not-a-real-google-kid-zzz' },
      { exp: 9e9, aud: PROJECT_ID, iss: ISS, sub: 'u' },
    );
    await expectCode(tok, PROJECT_ID, 'unknown-kid');
  });
});

// ── verifyFirebaseToken — happy path with stubbed JWKS ─────────────────────

describe('verifyFirebaseToken (happy path)', () => {
  // File-level beforeEach handles fetch stubbing + cache reset; these tests
  // just re-assign globalThis.fetch to their own per-test response.

  test('accepts a token signed by a key that matches a JWKS entry', async () => {
    // Real RSA keypair. crypto.subtle is on globalThis in Node 20+.
    const keyPair = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify'],
    );
    const pubJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

    // Mock the JWKS endpoint to serve back our public key under a known kid.
    const TEST_KID = 'test-kid-aabb';
    globalThis.fetch = async (_url) => ({
      ok: true,
      json: async () => ({ keys: [{ ...pubJwk, kid: TEST_KID, use: 'sig' }] }),
    });

    // Sign a real JWT.
    const header  = { alg: 'RS256', kid: TEST_KID, typ: 'JWT' };
    const payload = {
      sub:   'test-uid-1234',
      email: 'a@example.com',
      aud:   PROJECT_ID,
      iss:   ISS,
      iat:   Math.floor(Date.now() / 1000) - 10,
      exp:   Math.floor(Date.now() / 1000) + 3600,
    };
    const h64 = b64url(header);
    const p64 = b64url(payload);
    const signingInput = new TextEncoder().encode(`${h64}.${p64}`);
    const sigBuf = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, keyPair.privateKey, signingInput);
    const sig64 = Buffer.from(sigBuf).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

    const result = await verifyFirebaseToken(`${h64}.${p64}.${sig64}`, PROJECT_ID);
    assert.equal(result.sub,   'test-uid-1234');
    assert.equal(result.email, 'a@example.com');
    assert.equal(result.aud,   PROJECT_ID);
  });

  test('rejects a token where the signature was forged with a different key', async () => {
    // Generate TWO keypairs. We'll publish A's pubkey via JWKS but sign with B.
    const [pairA, pairB] = await Promise.all([
      crypto.subtle.generateKey(
        { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: 'SHA-256' },
        true, ['sign', 'verify']),
      crypto.subtle.generateKey(
        { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: 'SHA-256' },
        true, ['sign', 'verify']),
    ]);
    const pubJwkA = await crypto.subtle.exportKey('jwk', pairA.publicKey);

    const TEST_KID = 'forge-test-kid';
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ keys: [{ ...pubJwkA, kid: TEST_KID, use: 'sig' }] }),
    });

    const header  = { alg: 'RS256', kid: TEST_KID, typ: 'JWT' };
    const payload = {
      sub: 'attacker', aud: PROJECT_ID, iss: ISS,
      iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 3600,
    };
    const h64 = b64url(header);
    const p64 = b64url(payload);
    const signingInput = new TextEncoder().encode(`${h64}.${p64}`);
    // Sign with B (the WRONG key). JWKS only knows about A.
    const sigBuf = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, pairB.privateKey, signingInput);
    const sig64 = Buffer.from(sigBuf).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

    await expectCode(`${h64}.${p64}.${sig64}`, PROJECT_ID, 'bad-signature');
  });
});
