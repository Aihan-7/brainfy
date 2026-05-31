// Dynamic sitemap for community decks: /decks-sitemap.xml
// Lists every indexable /decks/<id> URL straight from Firestore, so Google
// discovers/recrawls deck pages as the library grows — no static file to
// regenerate. Referenced as a second Sitemap: line in robots.txt.

import { parseDeckDoc, fsBase, ORIGIN } from './decks/_render.js';

export async function onRequestGet(context) {
  const { env } = context;
  const { url, key } = fsBase(env);
  const urls = [];
  let token = '';
  try {
    for (let page = 0; page < 6; page++) {   // up to ~1800 decks; sitemaps allow 50k
      const q = `${url}/publicDecks?key=${key}&pageSize=300${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`;
      const res = await fetch(q);
      if (!res.ok) break;
      const data = await res.json();
      for (const d of (data.documents || [])) {
        const deck = parseDeckDoc(d.fields);
        if (!deck || deck.cardCount < 4) continue;   // match the noindex thin-guard
        const id = (d.name || '').split('/').pop();
        if (!/^[A-Za-z0-9_-]{6,64}$/.test(id)) continue;
        const lastmod = (d.updateTime || '').slice(0, 10);
        urls.push(
          `  <url><loc>${ORIGIN}/decks/${id}</loc>` +
          (/^\d{4}-\d{2}-\d{2}$/.test(lastmod) ? `<lastmod>${lastmod}</lastmod>` : '') +
          `<changefreq>weekly</changefreq><priority>0.6</priority></url>`
        );
      }
      token = data.nextPageToken || '';
      if (!token) break;
    }
  } catch (_) { /* emit whatever we have (possibly empty) */ }

  // Always lead with the /decks index so this sitemap is never empty — an empty
  // <urlset> reads as broken in a browser and trips "Sitemap is empty" warnings
  // in Search Console. Individual deck URLs (once any are published) follow.
  const entries = [
    `  <url><loc>${ORIGIN}/decks</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`,
    ...urls,
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=3600',
    },
  });
}
