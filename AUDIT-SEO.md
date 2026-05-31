# SEO Audit Report — brainfy.online

**Brainfy — AI Study App** · Audit date: 2026-05-31 · Method: full repo + live-output inspection

Modeled on the laserskincarehome.com audit methodology (evidence → finding → *why it
matters* → fix), adapted from a YMYL medical site to an edtech/SaaS context. Every
finding below was verified against the actual HTML/output, not assumed.

---

## Executive Summary

**Overall SEO health: Strong foundations, now hardened for ranking power.**

Unlike the laser-skin site (contaminated index, www/non-www canonical mismatch, thin
200-word pages, broken data fields), Brainfy started clean: self-referential canonicals
on one consistent host, no placeholder/template leaks, unique titles + descriptions,
full OG/Twitter cards, a real sitemap, and substantive content. The audit surfaced a
small set of genuine ranking-power gaps — chiefly **schema entity references that didn't
resolve on-page** and **missing E-E-A-T author attribution** — all now fixed. The site
also expanded from ~8 to ~54 interlinked indexable pages this cycle.

## Severity legend
🔴 Critical — blocks rankings / destroys trust · 🟠 High — significant suppression ·
🟡 Medium — noticeable impact over time · 🟢 Low — minor debt / missed optimisation

---

## Section 1 — Schema & Structured Data

### FINDING 1 — Dangling schema @id references on every non-home page  🟠 High → ✅ FIXED
**Source:** JSON-LD inspection across all 52 non-home pages.
Every landing/guide page referenced `author`/`publisher` as `{ "@id": ".../#aihan" }` and
`{ "@id": ".../#org" }`, but those entities were **defined only on `index.html`**. Google
resolves `@id` within a page's own graph and does not reliably follow cross-page
references, so on 52 pages the author and publisher were unresolved — weakening rich-result
eligibility and the Organization/Person trust signals.
**Why it matters:** Structured data is how Google attributes content to a credible
publisher/author. An unresolved publisher is, in effect, no publisher.
**Fix:** The page generator now embeds the full **Organization + Person + WebSite** entity
graph on *every* generated page, and the 5 hand-authored feature pages were patched the
same way. Author/publisher now resolve on-page. JSON-LD validated on all 54 pages.

### FINDING 2 — No FAQ/Breadcrumb/Article schema depth on some pages  🟡 Medium → ✅ FIXED
**Source:** JSON-LD inspection.
**Fix:** All generated pages emit `SoftwareApplication` **or** `Article` + `BreadcrumbList`
+ `FAQPage`; guides now also carry `datePublished`/`dateModified` and an `image`. The
resources hub gained `CollectionPage` + `WebSite` + `Organization`. (Note: Brainfy's schema
is in static HTML — not JS-injected — so it is crawlable without rendering, avoiding the
laser-skin "schema not detected" risk.)

---

## Section 2 — E-E-A-T & Trust

### FINDING 3 — No visible author attribution on guide content  🟠 High → ✅ FIXED
**Source:** Content audit of guide pages.
Guides emitted `Article` schema but showed **no visible byline** — a gap the laser-skin
audit flagged as an E-E-A-T deficiency (Experience/Expertise).
**Fix:** Every guide now shows *"By Aihan Mifthas, founder of Brainfy · Updated <date>"*
under the H1, backed by the resolved `Person` entity (with `sameAs` to GitHub/Instagram)
and `dateModified` for freshness.
**Context:** Brainfy is **not** YMYL (edtech, not medical/financial), so Google's E-E-A-T
scrutiny is lower than for the clinic — but author attribution + a real founder page +
`Organization.sameAs` social proof still strengthen trust.

### FINDING 4 — Trust pages present  🟢 (Working)
Privacy and Terms exist and are linked in the footer; the founder page provides a real
"who's behind this" entity — the trust-page gap the laser-skin site had does **not** apply.

---

## Section 3 — Technical SEO

### FINDING 5 — No custom 404 page  🟡 Medium → ✅ FIXED
**Source:** `ls 404.html` — absent. Unknown URLs fell back to the host default.
**Why it matters:** The laser-skin audit rated a dead-ending URL **Critical** — broken
landing points waste crawl and leak users/equity.
**Fix:** Added a branded `404.html` (`noindex,follow`) with recovery links to home, the
resources hub, and the top pages, so a bad URL routes users/crawlers back into the site.

### FINDING 6 — No www→apex redirect rule  🟡 Medium → ✅ FIXED
**Source:** `_headers`/`_redirects` inspection — no host-canonicalisation rule.
Brainfy's canonicals were already consistent (`https://brainfy.online/`, non-www) — it did
**not** have the laser-skin www/non-www *mismatch* (which was Critical there). But the
redirect itself was unenforced in-repo.
**Fix:** Added `_redirects` 301 forcing `www.brainfy.online/* → brainfy.online/:splat`, so
the two hosts can never serve duplicate content. **User action:** confirm `www` is routed
to the Pages project in the Cloudflare custom-domain settings.

### FINDING 7 — Deprecated `<meta name="keywords">` site-wide  🟢 Low → ✅ FIXED
**Source:** Present in 54 files. Google has ignored this tag since 2009; it only exposes
keyword strategy to competitors (the laser-skin audit flagged the same, Low).
**Fix:** Removed from every page and from the generator; replaced with a single
`<meta name="author">`.

### FINDING 8 — robots.txt + sitemap  🟢 (Working)
`robots.txt` allows crawl, disallows `/api/` and `/stitch/`, and references the sitemap.
`sitemap.xml` lists all 57 URLs and is regenerated automatically. (Contrast: the laser-skin
robots/sitemap were unverifiable and it had a duplicate `/laser-skin-care-blog/` URL tree.)

---

## Section 4 — On-Page & Content

### FINDING 9 — Content depth & thin-page risk  🟢 (Working)
The laser-skin site's **Critical** issue was ~200-word service pages. Brainfy's landing/
guide pages are 350–600+ words of unique, structured content (sections, steps, tables,
FAQ) — validated: **zero thin pages**, **zero duplicate titles**, all titles ≤62 chars.

### FINDING 10 — Homepage H1 carries target keywords  🟢 (Working)
H1 = *"Turn your notes into flashcards. Then actually focus."* (keywords: flashcards,
focus), with "free AI study app" in the subhead — the keyword-bearing-headline gap the
laser-skin site had (its H1 was a bare tagline) does not apply.

### FINDING 11 — Identical OG image across all pages  🟡 Medium → OPEN
**Source:** Every page uses `/og-image.png`. Same as the laser-skin Medium finding — social
previews don't differentiate by page type.
**Status:** Deferred. Per-page (or per-category) OG images would lift social CTR; needs an
image-generation step. Low urgency vs. the schema/E-E-A-T fixes.

### FINDING 12 — "Intersection" / long-tail coverage  🟢 (Working)
The laser-skin site had **no location×treatment** pages. Brainfy's analogue —
**subject/exam × use-case** pages (NCLEX, pharmacology, AP Bio, GCSE, organic chem, …) plus
comparison and tool pages — was built this cycle (36 new pages), with a hub + cross-links.

---

## Section 5 — Architecture notes (by design, not defects)

- **SPA app views** (`/` home, library, flashcards, etc.) are JS-rendered and auth-gated, so
  only the **splash + static landing pages** are indexable. This is intentional — the app
  isn't meant to be indexed — and the splash's marketing content **is** in static HTML
  (crawlable). The indexable surface is the ~54 static pages.
- **Shared community deck pages** are not yet prerendered (Firestore-backed); a build-time
  prerender step is the path once decks exist (currently 0 published).

---

## What is working (Section 6)

| Area | Status |
|---|---|
| HTTPS / SSL | ✅ all pages |
| Canonicals | ✅ self-referential, single non-www host (no mismatch) |
| Titles / descriptions | ✅ unique, in-length, all pages |
| OG + Twitter cards | ✅ full set + real 1200×630 PNG |
| Structured data | ✅ valid JSON-LD w/ resolved Org/Person/WebSite on all key pages |
| robots.txt + sitemap | ✅ correct, 57 URLs, api+stitch disallowed |
| Mobile viewport | ✅ site-wide |
| Security headers / CSP | ✅ strong (HSTS, CSP, nosniff, frame-ancestors) |
| No placeholder/template leaks | ✅ verified |
| Internal linking | ✅ hub + per-page cross-links + footer link |
| PWA / service worker | ✅ installable + offline shell |

---

## Issue Summary Table

| # | Finding | Severity | Category | Status |
|---|---------|----------|----------|--------|
| 1 | Dangling schema @id (author/publisher) on 52 pages | 🟠 High | Schema | ✅ Fixed |
| 2 | Article/FAQ/Breadcrumb + dates depth | 🟡 Medium | Schema | ✅ Fixed |
| 3 | No visible author byline on guides | 🟠 High | E-E-A-T | ✅ Fixed |
| 4 | No custom 404 page | 🟡 Medium | Technical | ✅ Fixed |
| 5 | No www→apex redirect rule | 🟡 Medium | Technical | ✅ Fixed |
| 6 | Deprecated meta keywords tag | 🟢 Low | Technical | ✅ Fixed |
| 7 | Identical OG image across pages | 🟡 Medium | On-Page | ⬜ Open (deferred) |
| 8 | Community deck pages not prerendered | 🟡 Medium | Architecture | ⬜ Open (infra) |
| — | OG image SVG→PNG | 🟡 Medium | On-Page | ✅ Fixed (earlier) |
| — | Thin pages / intersection pages | 🔴/🟠 (theirs) | Content | ✅ N/A — already strong |

## User actions (outside the repo)
1. Submit `sitemap.xml` in Google Search Console (57 URLs) after deploy.
2. Confirm `www.brainfy.online` is routed to the Pages project so the 301 takes effect.
3. (Optional) Run PageSpeed Insights for Core Web Vitals — LCP is likely healthy (CSS hero,
   `font-display:swap`, preconnect), but worth confirming on the live domain.

## Methodology / scope
Inspected: every static HTML page (index, 5 feature pages, 47 generated pages, hub, founder,
legal), `robots.txt`, `sitemap.xml`, `_headers`, JSON-LD on all pages, canonicals, titles,
H1s, internal links. Tools: repo grep + Node HTML/JSON-LD parsing + the live preview.
Not in scope: Google Search Console data, live Core Web Vitals, competitor rank tracking.
