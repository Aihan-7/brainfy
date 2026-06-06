// ────────────────────────────────────────────────────────────────────────────
//  Tests for functions/api/_lib/guard.js
//
//  These guards are the cost-abuse firewall in front of the token-burning AI
//  endpoints. A regression here means a leaked ID token can run up an unbounded
//  Groq/Anthropic bill — so each guard gets explicit coverage:
//
//    clampMaxTokens — never trust the client's output-cost knob
//    tooLarge       — reject oversized bodies before we parse them
//    rateLimit      — per-UID cap, fails OPEN on missing/broken KV
//    tooMany        — the 429 response shape
//
//  Run: `node --test tests/guard.test.mjs`  (or `npm test`)
// ────────────────────────────────────────────────────────────────────────────

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { tooLarge, clampMaxTokens, rateLimit, tooMany } from '../functions/api/_lib/guard.js';
import { mkRequest, makeKV } from './helpers.mjs';

// ── clampMaxTokens ───────────────────────────────────────────────────────────

describe('clampMaxTokens', () => {
  test('caps values above the ceiling', () => {
    assert.equal(clampMaxTokens(999999, 2048), 2048);
    assert.equal(clampMaxTokens(2049, 2048), 2048);
  });

  test('passes values at or below the ceiling through', () => {
    assert.equal(clampMaxTokens(1000, 2048), 1000);
    assert.equal(clampMaxTokens(2048, 2048), 2048);
    assert.equal(clampMaxTokens(1, 2048), 1);
  });

  test('floors fractional values', () => {
    assert.equal(clampMaxTokens(100.9, 2048), 100);
  });

  test('falls back to the ceiling for missing / non-positive / non-finite input', () => {
    assert.equal(clampMaxTokens(undefined, 2048), 2048);
    assert.equal(clampMaxTokens(null, 2048), 2048);
    assert.equal(clampMaxTokens(0, 2048), 2048);
    assert.equal(clampMaxTokens(-5, 2048), 2048);
    assert.equal(clampMaxTokens(NaN, 2048), 2048);
    assert.equal(clampMaxTokens('not-a-number', 2048), 2048);
    assert.equal(clampMaxTokens(Infinity, 2048), 2048);
  });

  test('accepts numeric strings (Number-coercible)', () => {
    assert.equal(clampMaxTokens('500', 2048), 500);
    assert.equal(clampMaxTokens('50000', 2048), 2048);
  });
});

// ── tooLarge ─────────────────────────────────────────────────────────────────

describe('tooLarge', () => {
  const MAX = 512 * 1024;

  test('returns a 413 Response when Content-Length exceeds the cap', async () => {
    const res = tooLarge(mkRequest({ headers: { 'content-length': String(MAX + 1) } }), MAX);
    assert.ok(res instanceof Response);
    assert.equal(res.status, 413);
    const body = await res.json();
    assert.equal(body.error, 'Request too large');
  });

  test('returns null when Content-Length is at or under the cap', () => {
    assert.equal(tooLarge(mkRequest({ headers: { 'content-length': String(MAX) } }), MAX), null);
    assert.equal(tooLarge(mkRequest({ headers: { 'content-length': '10' } }), MAX), null);
  });

  test('returns null when Content-Length header is absent (cannot pre-check)', () => {
    assert.equal(tooLarge(mkRequest({}), MAX), null);
  });
});

// ── rateLimit ────────────────────────────────────────────────────────────────

describe('rateLimit', () => {
  test('fails open (skipped) when no KV namespace is bound', async () => {
    const r = await rateLimit({}, 'uid', { limit: 5 });
    assert.deepEqual(r, { ok: true, skipped: true });
  });

  test('fails open when uid is missing', async () => {
    const r = await rateLimit({ RATE_LIMIT_KV: makeKV() }, null, { limit: 5 });
    assert.deepEqual(r, { ok: true, skipped: true });
  });

  test('allows requests under the limit and reports remaining', async () => {
    const env = { RATE_LIMIT_KV: makeKV() };
    const first  = await rateLimit(env, 'uid', { limit: 3, prefix: 't' });
    const second = await rateLimit(env, 'uid', { limit: 3, prefix: 't' });
    assert.equal(first.ok, true);
    assert.equal(first.remaining, 2);
    assert.equal(second.ok, true);
    assert.equal(second.remaining, 1);
  });

  test('blocks once the limit is reached, with a retryAfter', async () => {
    const env = { RATE_LIMIT_KV: makeKV() };
    await rateLimit(env, 'uid', { limit: 2, windowSec: 60, prefix: 't' });
    await rateLimit(env, 'uid', { limit: 2, windowSec: 60, prefix: 't' });
    const third = await rateLimit(env, 'uid', { limit: 2, windowSec: 60, prefix: 't' });
    assert.equal(third.ok, false);
    assert.equal(third.retryAfter, 60);
  });

  test('isolates counters per uid', async () => {
    const env = { RATE_LIMIT_KV: makeKV() };
    await rateLimit(env, 'a', { limit: 1, prefix: 't' });
    const aBlocked = await rateLimit(env, 'a', { limit: 1, prefix: 't' });
    const bAllowed = await rateLimit(env, 'b', { limit: 1, prefix: 't' });
    assert.equal(aBlocked.ok, false);
    assert.equal(bAllowed.ok, true);
  });

  test('fails open when the KV store throws', async () => {
    const env = { RATE_LIMIT_KV: { get: async () => { throw new Error('KV down'); }, put: async () => {} } };
    const r = await rateLimit(env, 'uid', { limit: 1 });
    assert.deepEqual(r, { ok: true, skipped: true });
  });
});

// ── tooMany ──────────────────────────────────────────────────────────────────

describe('tooMany', () => {
  test('returns a 429 with a Retry-After header', async () => {
    const res = tooMany(42);
    assert.equal(res.status, 429);
    assert.equal(res.headers.get('Retry-After'), '42');
    const body = await res.json();
    assert.match(body.error, /too many requests/i);
  });

  test('defaults Retry-After to 60 when omitted', () => {
    assert.equal(tooMany().headers.get('Retry-After'), '60');
  });
});
