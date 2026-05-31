// Shared rendering for SSR community-deck pages (/decks/* Cloudflare Functions).
// Decks live in Firestore publicDecks (world-readable rule), fetched per request
// via the REST API and rendered to crawlable HTML — always fresh, no build step.

export const ORIGIN = 'https://brainfy.online';

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Firestore REST document.fields → a plain deck object (or null if unusable).
export function parseDeckDoc(fields) {
  if (!fields) return null;
  const str = (f) => (f && typeof f.stringValue === 'string') ? f.stringValue : '';
  const num = (f) => f ? Number(f.integerValue ?? f.doubleValue ?? 0) : 0;
  const arr = fields.cards && fields.cards.arrayValue && fields.cards.arrayValue.values || [];
  const cards = arr.map(v => {
    const cf = v && v.mapValue && v.mapValue.fields || {};
    return { q: str(cf.q), a: str(cf.a) };
  }).filter(c => c.q && c.a);
  const name = str(fields.name).trim();
  if (!name || !cards.length) return null;
  return {
    name,
    desc: str(fields.desc).trim(),
    ownerName: str(fields.ownerName).trim() || 'A student',
    color: /^#[0-9a-fA-F]{6}$/.test(str(fields.color)) ? str(fields.color) : '#7c3aed',
    cards,
    cardCount: num(fields.cardCount) || cards.length,
  };
}

const CSS = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0b1326;--card:rgba(255,255,255,0.04);--border:rgba(255,255,255,0.08);--primary:#7c3aed;--plight:#a78bfa;--cyan:#4cd7f6;--text:#dae2fd;--muted:#94a3b8;--green:#4ede9a}
body{background:var(--bg);color:var(--text);font-family:'Manrope',sans-serif;line-height:1.7;-webkit-font-smoothing:antialiased}
.page{max-width:780px;margin:0 auto;padding:56px 24px 96px}
.back{display:inline-flex;align-items:center;gap:6px;color:var(--plight);text-decoration:none;font-size:14px;font-weight:600;margin-bottom:32px;opacity:.85}
.back::before{content:'\\2190';font-size:16px}
nav.crumbs{font-size:12px;color:var(--muted);margin-bottom:14px;font-family:'Space Grotesk',sans-serif;letter-spacing:0.04em}
nav.crumbs a{color:var(--plight);text-decoration:none}
.eyebrow{font-family:'Space Grotesk',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.18em;color:var(--plight);margin-bottom:14px;text-transform:uppercase}
h1{font-size:clamp(1.8rem,4vw,2.6rem);font-weight:900;letter-spacing:-0.025em;line-height:1.12;color:#fff;margin-bottom:14px}
.meta{font-size:13px;color:var(--muted);margin-bottom:24px}
.lede{font-size:1.05rem;color:#c8d4ec;margin-bottom:28px}
.btn{padding:13px 22px;border-radius:12px;font-family:'Manrope',sans-serif;font-size:14px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,var(--primary),#6d28d9);color:#fff;box-shadow:0 10px 30px rgba(124,58,237,0.32)}
.btn-ghost{background:var(--card);border:1px solid var(--border);color:var(--text);box-shadow:none}
.cta-row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:44px}
h2{font-size:1.3rem;font-weight:800;color:#fff;margin:40px 0 16px}
.fc{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:10px}
.fc .q{font-size:13px;font-weight:700;color:#fff;margin-bottom:6px}
.fc .a{font-size:14px;color:#b8c5dd}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin:18px 0}
.grid a{display:block;padding:18px;border-radius:14px;background:var(--card);border:1px solid var(--border);color:var(--text);text-decoration:none}
.grid a:hover{border-color:rgba(124,58,237,0.4)}
.grid strong{display:block;color:#fff;font-size:15px;margin-bottom:6px}
.grid span{color:var(--muted);font-size:12px}
hr{border:none;border-top:1px solid var(--border);margin:44px 0 24px}
.foot{color:var(--muted);font-size:13px}
.empty{text-align:center;padding:48px 24px;background:rgba(7,15,31,0.4);border:1px dashed var(--border);border-radius:16px}`;

// Escape a JSON string for safe embedding inside a <script> tag. Without this,
// user-controlled deck text containing "</script>" would break out of the
// JSON-LD block (stored XSS). < etc. parse back to the same JSON but never
// close the tag or open a new one.
function jsonForScript(s) {
  return String(s).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

function head(title, desc, canonical, robots, jsonLd) {
  jsonLd = jsonForScript(jsonLd);
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"/>
<meta name="robots" content="${robots}"/>
<meta name="theme-color" content="#0b1326"/>
<link rel="canonical" href="${canonical}"/>
<link rel="icon" type="image/svg+xml" href="/icon.svg"/>
<meta property="og:type" content="website"/><meta property="og:site_name" content="Brainfy"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(desc)}"/>
<meta property="og:image" content="${ORIGIN}/og-image.png"/><meta property="og:image:type" content="image/png"/>
<meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/>
<meta name="twitter:card" content="summary_large_image"/><meta name="twitter:image" content="${ORIGIN}/og-image.png"/>
<script type="application/ld+json">${jsonLd}</script>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@600;700;800&display=swap" rel="stylesheet"/>
<style>${CSS}</style></head><body>`;
}

const ORG = { "@type": "Organization", "@id": `${ORIGIN}/#org`, name: "Brainfy", url: `${ORIGIN}/`, logo: { "@type": "ImageObject", url: `${ORIGIN}/og-image.png`, width: 1200, height: 630 } };
const WEBSITE = { "@type": "WebSite", "@id": `${ORIGIN}/#website`, url: `${ORIGIN}/`, name: "Brainfy", publisher: { "@id": `${ORIGIN}/#org` }, inLanguage: "en" };

export function renderDeckPage(id, deck) {
  const url = `${ORIGIN}/decks/${id}`;
  const title = `${deck.name} — Free Flashcards | Brainfy`.slice(0, 70);
  const desc = (deck.desc || `Study "${deck.name}" — a free ${deck.cardCount}-card flashcard deck with spaced repetition on Brainfy.`).slice(0, 160);
  // Thin decks shouldn't be indexed; real ones (>=4 cards) get full indexing.
  const robots = deck.cardCount >= 4 ? 'index, follow, max-image-preview:large' : 'noindex, follow';
  const jsonLd = JSON.stringify({ "@context": "https://schema.org", "@graph": [
    ORG, WEBSITE,
    { "@type": "LearningResource", "@id": `${url}#deck`, name: deck.name, description: desc, url,
      learningResourceType: "Flashcard deck", educationalUse: "self-study", numberOfItems: deck.cardCount,
      isPartOf: { "@id": `${ORIGIN}/#website` }, provider: { "@id": `${ORIGIN}/#org` }, inLanguage: "en",
      author: { "@type": "Person", name: deck.ownerName } },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${ORIGIN}/` },
      { "@type": "ListItem", position: 2, name: "Shared decks", item: `${ORIGIN}/decks` },
      { "@type": "ListItem", position: 3, name: deck.name, item: url } ] },
  ] });
  const cards = deck.cards.slice(0, 200).map(c =>
    `<div class="fc"><div class="q">${esc(c.q)}</div><div class="a">${esc(c.a)}</div></div>`).join('\n');
  return head(title, desc, url, robots, jsonLd) + `
  <div class="page">
    <a class="back" href="/decks">All shared decks</a>
    <nav class="crumbs"><a href="/">Home</a> &nbsp;›&nbsp; <a href="/decks">Shared decks</a> &nbsp;›&nbsp; <span>${esc(deck.name)}</span></nav>
    <p class="eyebrow">Community deck</p>
    <h1>${esc(deck.name)}</h1>
    <p class="meta">${deck.cardCount} cards · shared by ${esc(deck.ownerName)} · free spaced-repetition study</p>
    ${deck.desc ? `<p class="lede">${esc(deck.desc)}</p>` : ''}
    <div class="cta-row">
      <a class="btn" href="/?deck=${esc(id)}">Study this deck free →</a>
      <a class="btn btn-ghost" href="/">Make your own deck</a>
    </div>
    <h2>What's in this deck</h2>
    ${cards}
    <hr><p class="foot">Add this deck to your library and study it with spaced repetition, free on <a href="/">Brainfy</a>.</p>
  </div></body></html>`;
}

export function renderDecksIndex(decks) {
  const url = `${ORIGIN}/decks`;
  const title = 'Free Community Flashcard Decks | Brainfy';
  const desc = 'Browse free flashcard decks shared by students — study any deck with spaced repetition, or create your own on Brainfy.';
  const jsonLd = JSON.stringify({ "@context": "https://schema.org", "@graph": [
    ORG, WEBSITE,
    { "@type": "CollectionPage", "@id": `${url}#page`, url, name: "Community Flashcard Decks", description: desc, isPartOf: { "@id": `${ORIGIN}/#website` }, inLanguage: "en" },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${ORIGIN}/` },
      { "@type": "ListItem", position: 2, name: "Shared decks", item: url } ] },
  ] });
  const body = decks.length
    ? `<div class="grid">${decks.map(d => `<a href="/decks/${esc(d.id)}"><strong>${esc(d.name)} →</strong><span>${d.cardCount} cards · by ${esc(d.ownerName)}</span></a>`).join('')}</div>`
    : `<div class="empty"><div style="font-size:14px;color:var(--text);font-weight:600;margin-bottom:6px;">No public decks yet</div><div style="font-size:12px;color:var(--muted);max-width:380px;margin:0 auto;line-height:1.55;">Be the first — open a deck's <strong>Cards</strong> tab in Brainfy and tap <strong>Share publicly</strong>.</div></div>`;
  return head(title, desc, url, 'index, follow, max-image-preview:large', jsonLd) + `
  <div class="page">
    <a class="back" href="/resources.html">Back to resources</a>
    <nav class="crumbs"><a href="/">Home</a> &nbsp;›&nbsp; <span>Shared decks</span></nav>
    <p class="eyebrow">Community</p>
    <h1>Free Community Flashcard Decks</h1>
    <p class="lede">Study decks shared by other students — add any to your library and review it with spaced repetition, free. Or <a href="/">build your own</a> from your notes, a PDF, or a photo.</p>
    ${body}
    <hr><p class="foot">Powered by <a href="/">Brainfy</a> — a free AI study app.</p>
  </div></body></html>`;
}

// Firestore REST helpers (public read; web API key is client-public).
export function fsBase(env) {
  const project = (env && env.FIREBASE_PROJECT_ID) || 'brainfy-65b7a';
  const key = (env && env.FIREBASE_API_KEY) || 'AIzaSyAZ34uI2ELFomc2k7hXdVn6Yjy64iOezRE';
  return { url: `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`, key };
}
