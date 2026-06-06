// ────────────────────────────────────────────────────────────────────────────
//  Tests for the Cloudflare Pages Function endpoints.
//
//  These exercise the request → response CONTRACT and the security/cost wiring
//  of each handler (auth gate, body-size guard, rate limit, max_tokens clamp,
//  provider selection) without hitting Groq/Anthropic/YouTube. fetch is stubbed
//  with a URL router; auth is satisfied with a real RS256 token whose public
//  JWK the router serves. The exact crypto pipeline is covered by auth.test.mjs;
//  here we only assert the handlers honour their guards.
//
//  Run: `node --test tests/endpoints.test.mjs`  (or `npm test`)
// ────────────────────────────────────────────────────────────────────────────

import { test, describe, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { _resetJwksCacheForTests } from '../functions/api/_lib/auth.js';
import { onRequestPost as chat }     from '../functions/api/chat.js';
import { onRequestPost as process_ } from '../functions/api/process-content.js';
import { onRequestPost as youtube }  from '../functions/api/youtube.js';
import { onRequestGet  as aiStatus } from '../functions/api/ai-status.js';
import { onRequestPost as log }      from '../functions/api/log.js';

import {
  PROJECT_ID, makeAuthToken, router, jwksRoute, jsonStub, textStub, bearer, mkRequest, makeKV,
} from './helpers.mjs';

// One token reused across the suite (keypair generation is the slow part).
let AUTH;
before(async () => { AUTH = await makeAuthToken({ sub: 'uid-test', projectId: PROJECT_ID }); });

const realFetch = globalThis.fetch;
beforeEach(() => { _resetJwksCacheForTests(); });
afterEach(() => { globalThis.fetch = realFetch; });

// Route matchers for the upstreams the handlers call.
const groqRoute   = (handler) => ({ test: (u) => u.includes('api.groq.com'),      handler });
const claudeRoute = (handler) => ({ test: (u) => u.includes('api.anthropic.com'), handler });

// ── /api/ai-status (no auth) ─────────────────────────────────────────────────

describe('GET /api/ai-status', () => {
  test('reports groq when GROQ_API_KEY is set', async () => {
    const res = await aiStatus({ env: { GROQ_API_KEY: 'x' } });
    const body = await res.json();
    assert.deepEqual(body, { configured: true, provider: 'groq', model: 'llama-3.3-70b-versatile' });
  });

  test('prefers groq over anthropic when both are set', async () => {
    const body = await (await aiStatus({ env: { GROQ_API_KEY: 'x', ANTHROPIC_API_KEY: 'y' } })).json();
    assert.equal(body.provider, 'groq');
  });

  test('reports anthropic when only ANTHROPIC_API_KEY is set', async () => {
    const body = await (await aiStatus({ env: { ANTHROPIC_API_KEY: 'y' } })).json();
    assert.equal(body.provider, 'anthropic');
    assert.equal(body.model, 'claude-3-5-haiku-20241022');
  });

  test('reports not-configured when no keys are present', async () => {
    const body = await (await aiStatus({ env: {} })).json();
    assert.deepEqual(body, { configured: false, provider: null, model: '' });
  });

  test('honours an AI_MODEL override', async () => {
    const body = await (await aiStatus({ env: { GROQ_API_KEY: 'x', AI_MODEL: 'custom-model' } })).json();
    assert.equal(body.model, 'custom-model');
  });
});

// ── /api/log (no auth) ───────────────────────────────────────────────────────

describe('POST /api/log', () => {
  let logged;
  const realLog = console.log;
  beforeEach(() => { logged = []; console.log = (...a) => logged.push(a); });
  afterEach(() => { console.log = realLog; });

  test('returns 204 and records the event', async () => {
    const res = await log({ request: mkRequest({ json: { event: 'sync.error', message: 'boom' } }) });
    assert.equal(res.status, 204);
    const line = JSON.stringify(logged);
    assert.ok(line.includes('sync.error'));
    assert.ok(line.includes('boom'));
  });

  test('returns 204 even on an unparseable body', async () => {
    const res = await log({ request: mkRequest({ json: '__throw__' }) });
    assert.equal(res.status, 204);
    assert.ok(JSON.stringify(logged).includes('unknown')); // event defaults to 'unknown'
  });

  test('clips an over-long field', async () => {
    const huge = 'a'.repeat(5000);
    await log({ request: mkRequest({ json: { event: 'x', message: huge } }) });
    const entry = JSON.parse(logged[0][1]); // ['[brainfy-log]', '<json>']
    assert.ok(entry.message.length < huge.length);
    assert.ok(entry.message.endsWith('…'));
  });
});

// ── /api/chat ────────────────────────────────────────────────────────────────

describe('POST /api/chat', () => {
  test('401 when the Authorization header is missing', async () => {
    globalThis.fetch = router([]); // any network call would throw
    const res = await chat({ request: mkRequest({ json: {} }), env: { GROQ_API_KEY: 'x' } });
    assert.equal(res.status, 401);
  });

  test('503 when no AI provider is configured', async () => {
    globalThis.fetch = router([jwksRoute(AUTH.jwk)]);
    const res = await chat({ request: mkRequest({ headers: bearer(AUTH.token), json: {} }), env: {} });
    assert.equal(res.status, 503);
  });

  test('400 on an invalid JSON body', async () => {
    globalThis.fetch = router([jwksRoute(AUTH.jwk)]);
    const res = await chat({
      request: mkRequest({ headers: bearer(AUTH.token), json: '__throw__' }),
      env: { GROQ_API_KEY: 'x' },
    });
    assert.equal(res.status, 400);
  });

  test('413 when the body exceeds the size cap', async () => {
    globalThis.fetch = router([jwksRoute(AUTH.jwk)]);
    const res = await chat({
      request: mkRequest({ headers: { ...bearer(AUTH.token), 'content-length': String(512 * 1024 + 1) }, json: {} }),
      env: { GROQ_API_KEY: 'x' },
    });
    assert.equal(res.status, 413);
  });

  test('429 when the rate limiter rejects', async () => {
    globalThis.fetch = router([jwksRoute(AUTH.jwk)]);
    const env = { GROQ_API_KEY: 'x', RATE_LIMIT_KV: { get: async () => '999', put: async () => {} } };
    const res = await chat({ request: mkRequest({ headers: bearer(AUTH.token), json: {} }), env });
    assert.equal(res.status, 429);
  });

  test('clamps client max_tokens before calling the provider', async () => {
    let sent;
    globalThis.fetch = router([
      jwksRoute(AUTH.jwk),
      groqRoute((_u, opts) => {
        sent = JSON.parse(opts.body);
        return jsonStub({ choices: [{ message: { content: 'hi' } }], usage: { prompt_tokens: 3, completion_tokens: 5 } });
      }),
    ]);
    const res = await chat({
      request: mkRequest({ headers: bearer(AUTH.token), json: { messages: [{ role: 'user', content: 'hello' }], max_tokens: 999999 } }),
      env: { GROQ_API_KEY: 'x' },
    });
    assert.equal(sent.max_tokens, 2048);                  // clamped to the ceiling
    const body = await res.json();
    assert.deepEqual(body.content, [{ type: 'text', text: 'hi' }]);
    assert.deepEqual(body.usage, { input_tokens: 3, output_tokens: 5 });
  });
});

// ── /api/process-content ─────────────────────────────────────────────────────

describe('POST /api/process-content', () => {
  test('401 without auth', async () => {
    globalThis.fetch = router([]);
    const res = await process_({ request: mkRequest({ json: {} }), env: { GROQ_API_KEY: 'x' } });
    assert.equal(res.status, 401);
  });

  test('413 for an oversized base64 image', async () => {
    globalThis.fetch = router([jwksRoute(AUTH.jwk)]);
    const res = await process_({
      request: mkRequest({
        headers: bearer(AUTH.token),
        json: { contentType: 'image', image: { b64: 'a'.repeat(7_000_001), mime: 'image/png' } },
      }),
      env: { GROQ_API_KEY: 'x' },
    });
    assert.equal(res.status, 413);
  });

  test('400 when an image request carries no image data', async () => {
    globalThis.fetch = router([jwksRoute(AUTH.jwk)]);
    const res = await process_({
      request: mkRequest({ headers: bearer(AUTH.token), json: { contentType: 'image' } }),
      env: { GROQ_API_KEY: 'x' },
    });
    assert.equal(res.status, 400);
  });

  test('returns parsed flashcards for a text document', async () => {
    let sent;
    const payload = { flashcards: [{ q: 'Q', a: 'A' }], outline: ['Topic'] };
    globalThis.fetch = router([
      jwksRoute(AUTH.jwk),
      groqRoute((_u, opts) => {
        sent = JSON.parse(opts.body);
        return jsonStub({ choices: [{ message: { content: JSON.stringify(payload) } }] });
      }),
    ]);
    const res = await process_({
      request: mkRequest({ headers: bearer(AUTH.token), json: { title: 'Notes', subjName: 'Bio', content: 'cells...' } }),
      env: { GROQ_API_KEY: 'x' },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), payload);
    assert.equal(sent.model, 'llama-3.3-70b-versatile');           // text model
    assert.deepEqual(sent.response_format, { type: 'json_object' }); // JSON mode on for text
  });

  test('picks the vision model for image content', async () => {
    let sent;
    globalThis.fetch = router([
      jwksRoute(AUTH.jwk),
      groqRoute((_u, opts) => {
        sent = JSON.parse(opts.body);
        return jsonStub({ choices: [{ message: { content: '{"flashcards":[],"outline":[]}' } }] });
      }),
    ]);
    await process_({
      request: mkRequest({
        headers: bearer(AUTH.token),
        json: { contentType: 'image', title: 'Pic', subjName: 'Bio', image: { b64: 'abc', mime: 'image/png' } },
      }),
      env: { GROQ_API_KEY: 'x' },
    });
    assert.equal(sent.model, 'meta-llama/llama-4-scout-17b-16e-instruct');
    assert.equal(sent.response_format, undefined); // vision models don't get JSON mode
  });

  test('retries once with a stricter prompt when the first response is unparseable', async () => {
    const good = { flashcards: [{ q: 'Q', a: 'A' }], outline: [] };
    const responses = [
      jsonStub({ choices: [{ message: { content: 'this is not json' } }] }),
      jsonStub({ choices: [{ message: { content: JSON.stringify(good) } }] }),
    ];
    let calls = 0;
    globalThis.fetch = router([
      jwksRoute(AUTH.jwk),
      groqRoute(() => responses[calls++]),
    ]);
    const res = await process_({
      request: mkRequest({ headers: bearer(AUTH.token), json: { title: 'N', subjName: 'S', content: 'x' } }),
      env: { GROQ_API_KEY: 'x' },
    });
    assert.equal(calls, 2);
    assert.deepEqual(await res.json(), good);
  });
});

// ── /api/youtube ─────────────────────────────────────────────────────────────

describe('POST /api/youtube', () => {
  test('401 without auth', async () => {
    globalThis.fetch = router([]);
    const res = await youtube({ request: mkRequest({ json: { url: 'https://youtu.be/abcdefghijk' } }), env: {} });
    assert.equal(res.status, 401);
  });

  test('400 for a URL with no extractable video id', async () => {
    globalThis.fetch = router([jwksRoute(AUTH.jwk)]);
    const res = await youtube({
      request: mkRequest({ headers: bearer(AUTH.token), json: { url: 'https://example.com/not-a-video' } }),
      env: {},
    });
    assert.equal(res.status, 400);
  });

  test('extracts metadata and a cleaned transcript', async () => {
    const captionUrl = 'https://www.youtube.com/api/timedtext?lang=en';
    const watchHtml = `<html>...{"captionTracks":[{"baseUrl":"${captionUrl}"}]}...</html>`;
    const xml = '<transcript><text start="0">Hello &amp; world</text><text start="1"><b>Second</b> line</text></transcript>';
    globalThis.fetch = router([
      jwksRoute(AUTH.jwk),
      { test: (u) => u.includes('/oembed'),   handler: jsonStub({ title: 'My Video', author_name: 'Creator' }) },
      { test: (u) => u.includes('/watch'),    handler: textStub(watchHtml) },
      { test: (u) => u.includes('timedtext'), handler: textStub(xml) },
    ]);
    const res = await youtube({
      request: mkRequest({ headers: bearer(AUTH.token), json: { url: 'https://www.youtube.com/watch?v=abcdefghijk' } }),
      env: {},
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.videoId, 'abcdefghijk');
    assert.equal(body.title, 'My Video');
    assert.equal(body.author, 'Creator');
    assert.ok(body.thumbnail.includes('abcdefghijk'));
    assert.equal(body.transcript, 'Hello & world Second line');
  });

  test('returns an empty transcript (not an error) when the watch page has no captions', async () => {
    globalThis.fetch = router([
      jwksRoute(AUTH.jwk),
      { test: (u) => u.includes('/oembed'), handler: jsonStub({ title: 'No Caps', author_name: 'Nobody' }) },
      { test: (u) => u.includes('/watch'),  handler: textStub('<html>no captiontracks here</html>') },
    ]);
    const res = await youtube({
      request: mkRequest({ headers: bearer(AUTH.token), json: { url: 'https://youtu.be/abcdefghijk' } }),
      env: {},
    });
    const body = await res.json();
    assert.equal(body.transcript, '');
    assert.equal(body.title, 'No Caps');
  });
});
