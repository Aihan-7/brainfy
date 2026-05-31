// SSR a single community deck page: /decks/<id>
// Fetches publicDecks/<id> from Firestore (public-read rule) per request and
// renders crawlable HTML. CDN-cached so it doesn't hit Firestore every view.

import { parseDeckDoc, renderDeckPage, fsBase } from './_render.js';

function notFound() {
  return new Response(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Deck not found | Brainfy</title>' +
    '<meta name="robots" content="noindex,follow"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{font-family:system-ui,sans-serif;background:#0b1326;color:#dae2fd;text-align:center;padding:80px 24px}' +
    'a{color:#a78bfa}</style></head><body><h1>Deck not found</h1>' +
    '<p>This shared deck doesn&#39;t exist or was removed. <a href="/decks">Browse shared decks</a> · <a href="/">Open Brainfy</a></p>' +
    '</body></html>',
    { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

export async function onRequestGet(context) {
  const { params, env } = context;
  const id = params.id;
  // Firestore auto-ids are [A-Za-z0-9] (~20 chars); bound it defensively.
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(id || '')) return notFound();

  const { url, key } = fsBase(env);
  let deck = null;
  try {
    const res = await fetch(`${url}/publicDecks/${encodeURIComponent(id)}?key=${key}`);
    if (res.ok) { const doc = await res.json(); deck = parseDeckDoc(doc.fields); }
  } catch (_) { /* network/Firestore error → treat as not found */ }
  if (!deck) return notFound();

  return new Response(renderDeckPage(id, deck), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Edge-cache the rendered page; refreshes within the hour if the deck changes.
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
}
