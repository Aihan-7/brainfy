// SSR the community decks index: /decks
// Lists public decks (newest first, thin ones skipped) so crawlers discover the
// individual /decks/<id> pages, and visitors can browse shared decks.

import { parseDeckDoc, renderDecksIndex, fsBase } from './_render.js';

export async function onRequestGet(context) {
  const { env } = context;
  const { url, key } = fsBase(env);
  const decks = [];
  try {
    const res = await fetch(`${url}/publicDecks?key=${key}&pageSize=200`);
    if (res.ok) {
      const data = await res.json();
      for (const d of (data.documents || [])) {
        const deck = parseDeckDoc(d.fields);
        if (!deck || deck.cardCount < 4) continue;   // skip thin/empty decks
        decks.push({
          id: (d.name || '').split('/').pop(),
          name: deck.name, ownerName: deck.ownerName, cardCount: deck.cardCount,
          updated: d.updateTime || '',
        });
      }
      decks.sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
    }
  } catch (_) { /* render the empty state on any error */ }

  return new Response(renderDecksIndex(decks), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=1800',
    },
  });
}
