// Cloudflare Pages Function — POST /api/log
//
// Tiny client-error sink. The client `track(event, data)` helper POSTs
// here whenever a silent failure happens (sync rejected, AI fetch failed,
// etc.) so we don't depend on user reports to know something's broken.
//
// Storage: just `console.log` with a JSON line per event. Visible in
// Cloudflare Pages → your project → Functions → Real-time logs (or the
// historical Logpush feed if you wire one up). No KV / durable storage —
// keep it minimal until we actually want querying.
//
// Body shape (all optional except `event`):
//   {
//     event:   'sync.save.error',          // required, short dotted name
//     code:    'permission-denied',        // FirebaseError.code etc.
//     message: 'Missing or insufficient…', // human-readable
//     url:     '/home',                    // pathname at time of error
//     ua:      'Mozilla/5.0 …',            // navigator.userAgent
//     v:       '1779148800',               // APP_VERSION
//     extra:   { /* arbitrary */ }
//   }
//
// Returns 204 No Content always (success OR malformed) so the client's
// fire-and-forget POST never throws on the happy path and we don't waste
// bytes on response bodies. Errors here would only re-error the client
// inside its own error handler — bad spiral.

const MAX_FIELD_LEN = 2000;   // cap each string field
const MAX_TOTAL_LEN = 8000;   // cap total JSON size we'll log

function clip(v) {
  if (typeof v !== 'string') return v;
  return v.length > MAX_FIELD_LEN ? v.slice(0, MAX_FIELD_LEN) + '…' : v;
}

export async function onRequestPost(context) {
  const { request } = context;

  let body = {};
  try { body = await request.json(); } catch (_) { /* fall through with {} */ }

  // Only `event` is required. Everything else is optional — clip strings
  // so a single bad payload can't flood the log line.
  const entry = {
    t:       new Date().toISOString(),
    event:   clip(body.event)   || 'unknown',
    code:    clip(body.code)    || null,
    message: clip(body.message) || null,
    url:     clip(body.url)     || null,
    ua:      clip(body.ua)      || null,
    v:       clip(body.v)       || null,
    extra:   body.extra && typeof body.extra === 'object' ? body.extra : null,
    ip:      request.headers.get('cf-connecting-ip') || null,
    country: request.cf?.country || null,
  };

  let serialised = JSON.stringify(entry);
  if (serialised.length > MAX_TOTAL_LEN) {
    // Drop `extra` first — it's the most likely culprit for size blowups
    serialised = JSON.stringify({ ...entry, extra: '[truncated]' }).slice(0, MAX_TOTAL_LEN);
  }

  // Single-line prefix makes Cloudflare logs greppable: `wrangler tail`,
  // log feed search for "[brainfy-log]", etc.
  console.log('[brainfy-log]', serialised);

  return new Response(null, { status: 204 });
}
