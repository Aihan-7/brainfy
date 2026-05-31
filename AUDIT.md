# Brainfy — Full Website Audit (2026-05-30)

Comprehensive multi-dimensional audit: SEO, UX, accessibility, performance, competitive
positioning/features, security, and conversion. Every finding is traced to code with
file:line evidence. Severity: **P0** (fix now / breaking) → **P3** (polish).

---

## Executive verdict

Brainfy is a **genuinely well-engineered product on a strong foundation** — sound auth
crypto, locked Firestore/Storage rules, a full CSP, disciplined XSS escaping, a real SM-2
SRS engine, code-split loading, and unusually honest copy. It is **not** a weak site.

But it is being held back by a handful of **high-leverage, mostly small problems** that
several independent audits flagged at once:

1. **The funnel has a hard signup wall** even though a working guest mode exists in code but
   is wired to no button — and five landing pages *promise* "no signup needed to try." This
   is the single biggest, cheapest-to-fix conversion + trust leak. *(UX P0/P1, Content P0)*
2. **Guest work is silently destroyed at signup** — no local→cloud merge. Classic churn trap. *(UX P0)*
3. **Zero cost controls on AI endpoints** — one free account can run unbounded Groq/Anthropic
   bills. Existential for a solo founder. *(Security CRITICAL, Strategy P0)*
4. **The OG image is an SVG**, so every shared link shows a blank social card across FB/X/
   LinkedIn/Slack/iMessage. *(SEO P0, cross-confirmed)*
5. **The hero sells a mood, not the job-to-be-done** — a student googling "pdf to flashcards"
   can't tell in 5s that Brainfy does that. *(Content P0)*

Fix those five and the existing quality shines through. The strategic layer (study modes,
deck import/export, reminders, monetization) is what takes it from "good" to "top."

---

## What is already excellent (don't break these)

- **Auth verification is cryptographically sound** — `functions/api/_lib/auth.js` does full
  RS256 JWKS signature verification + aud/iss/exp/iat checks, with a test suite incl. a
  forged-signature rejection test (`tests/auth.test.mjs:211`). No bypass.
- **Authorization rules are correct** — Firestore `users/{uid}` and Storage `users/{uid}/**`
  are locked to `request.auth.uid`, catch-all deny. (`firestore.rules`, `storage.rules`)
- **Security headers are thorough** — CSP w/ `default-src 'self'`, locked `connect-src`,
  `frame-ancestors 'none'`, HSTS, nosniff, Referrer-Policy, Permissions-Policy. (`_headers`)
- **XSS discipline** — `escapeHtml`/`_e` everywhere; `mdToHtml` & `formatAIText` escape
  *before* markdown; flashcards/usernames use `textContent`. No unescaped sink found.
- **Real SM-2 SRS with burnout guards** — 4-button grading, ease clamp, new-card/day cap
  (`src/main.ts:356-385`). A real differentiator vs the AI-quiz crowd.
- **Secrets clean** — `.env` + `serviceAccountKey.json` gitignored and never committed.
- **Strong SEO base** — unique titles/descriptions, canonicals, JSON-LD (WebSite/Person/Org/
  SoftwareApplication + FAQPage + BreadcrumbList on landing pages), llms.txt, sitemap, robots.
- **Honest, on-brand microcopy** — empty states, onboarding, friendly auth errors are
  model-grade. The founder manifesto is the best trust asset in the funnel.

---

## P0 — Fix now (breaking / highest leverage)

| # | Area | Finding | Evidence | Fix |
|---|------|---------|----------|-----|
| 1 | UX/Content | **Guest mode unreachable + landing pages promise "try without signup."** `enterGuestMode()` exists but no visible button calls it; all splash CTAs route to auth. | `src/main.ts:5136`; CTAs `index.html:1451,1932`, wiring `:4164`; promises `pdf-to-flashcards.html:123`, `pomodoro-timer.html:123`, `ai-flashcards.html:7` | Add a "Try it first — no account →" CTA on splash + SEO pages wired to `enterGuestMode()`; seed a demo subject + starter deck. |
| 2 | UX | **Guest data silently destroyed at signup** — no local→cloud merge; `loadFromCloud` overwrites in-memory `S`; `handleSignOut` wipes localStorage. | `src/main.ts:956,4121,4185` | On sign-in: if cloud doc empty + local has data, push local→cloud; if both exist, prompt to merge. Never silently overwrite non-empty local state. |
| 3 | Security | **No rate limit / quota / size cap on any AI endpoint** — unbounded cost amplification by any authed user or leaked token. | `functions/api/chat.js`, `process-content.js`, `youtube.js` (no throttle anywhere) | Per-UID rate limit (Cloudflare Rate Limiting rule on `/api/*` + KV counter on `auth.sub`) + daily token budget → `429`. |
| 4 | Security | **`chat.js` spreads raw `...body`** → client controls `max_tokens`, `system`, `messages`; no body-size/image cap. | `chat.js:69,146`; `process-content.js:147` | Whitelist forwarded fields; clamp `max_tokens` server-side; reject `content-length` > ~1–2MB before `request.json()`. |
| 5 | SEO | **og:image is an SVG** — social platforms don't render SVG OG images; every shared link = blank card. | `index.html:23,32`; `og-image.svg`; all 5 landing pages | Rasterize to 1200×630 `og-image.png`; update all `og:image`/`twitter:image`; add `og:image:type`. |
| 6 | SEO | **Orphan `stitch/*` pages are deployable, indexable, title-less duplicates.** | `stitch/landing-page.html:1` (no title/canonical/robots); not in robots.txt/sitemap | `Disallow: /stitch/` + `X-Robots-Tag: noindex` in `_headers`, or stop deploying the folder. |
| 7 | Content | **Hero H1 sells a mood, not the product.** "Focus deeply. Study calmly." — no WHAT/WHO/why. | `index.html:1438-1446` | Job-to-be-done H1 (e.g. "Turn your notes into flashcards. Then actually focus."); demote tagline to eyebrow. |
| 8 | a11y | **No visible keyboard focus indicator anywhere** — `outline:none` globally, zero `:focus-visible`. | `index.html:966` + 18 inline `outline:none` | Global `:focus-visible{outline:2px solid var(--plight);outline-offset:2px}`; scope the blanket removal to `:focus:not(:focus-visible)`. |
| 9 | a11y | **Icon-only buttons unlabeled** (modal ×, password toggles, doc summarize/delete) → SR announces only "button." | `index.html:3636,3675,3697,2006,2079`; `src/main.ts:2546,2551` | Add `aria-label` to each (pattern already used at `:2120,:2615`). |

---

## P1 — High impact

| # | Area | Finding | Evidence | Fix |
|---|------|---------|----------|-----|
| 10 | UX | **AI-tutor "Import as flashcards" silently loses cards** — written to non-persisted `FLASHCARD_SETS`, never `subj.cards`, never saved. Reload = gone. | `src/main.ts:4995-5004` vs deck reads `subj.cards` `:2174,523` | Push into `aiSubj.cards` + `save()`, mirroring `saveAIResults` (`:3565`). |
| 11 | UX | **`logSession` does `s.docs++`** → completing a focus session falsely marks the "add a document" onboarding step done and inflates Library doc counts. | `src/main.ts:2083`; onboarding `:1434,1612` | Derive `s.docs` from `s.documents.length` only; remove the `++`. Track session counts separately. |
| 12 | UX | **Guests see green "AI ready" dot, then 401 on every AI action** after a 10s spinner; no "sign in to use AI." | `checkAIStatus` `:4540`; `aiHeaders` `:4525`; errors `:3530,3554,4638` | Gate AI entry points when `!firebaseUser` with a "Sign up to unlock AI" prompt instead of letting it 401. |
| 13 | UX | **`deleteDoc` deletes doc + Storage file on one click — no confirm, no undo, no toast** (inconsistent with subject/account delete). | `src/main.ts:2833`; trigger `:2323` | Add `showConfirm` (or undo toast) before deleting docs. |
| 14 | Perf | **script.js not top-level mangled** — leaves ~26% on the table. | `package.json:6` (no `--toplevel`); 168KB→119KB raw, 47KB→35KB gzip | Add `--toplevel` to the terser command. −12.4KB gzip, source map preserved. |
| 15 | Perf | **Serial Firebase load chain** — 5 sequential fetches before app boots. | `index.html:4101-4106` | `Promise.all` the 3 non-app compat scripts; consider modular v10 SDK. Saves ~300–600ms mobile. |
| 16 | a11y | **`--muted`/`--muted2` body text fails contrast** (3.6–4.0:1 / 2.4:1), used 270+×. | `index.html:133-134` | Lighten `--muted`→~`#8b99b3`, `--muted2`→~`#7e8aa0` (≥4.5:1). Fixes 270 usages at once. |
| 17 | a11y | **No live regions** — toasts, sync, AI progress, form errors silent to SR. | `showToast` `src/main.ts:3908`; errors `index.html:2013` | `role="status"`/`aria-live` on toasts; `role="alert"` on auth errors. |
| 18 | a11y | **Modals lack dialog semantics / focus trap / focus return.** | `index.html:3269,3288,3316,3406,3632,3685` | `role="dialog" aria-modal aria-labelledby`; trap Tab; restore focus on close. |
| 19 | Content | **Raw "Server error 503/401" shown in AI tutor** — breaks the calm brand at a core moment. | `src/main.ts:4638-4640,4678` | Map to human messages per status (overloaded/expired/empty/generic). |
| 20 | Content | **Fabricated bento stats next to "no fake vanity stats" promise** ("94% focus rate", "+18% vs last week"). | `index.html:1534-1543` vs `:1790`; static `3 DAY STREAK` `:2231` | Label demo metrics `EXAMPLE`/`DEMO`; add an honest beta-proof line. |
| 21 | SEO | **Homepage H1 targets zero keywords** (ties to #7). Missing **HowTo** schema (content already exists) and **AggregateRating** (when real ratings exist). | `index.html:1438`; landing how-it-works sections | Keyword H1; add HowTo JSON-LD to the 4 step-based pages. |

---

## P2 — Meaningful

| # | Area | Finding | Evidence | Fix |
|---|------|---------|----------|-----|
| 22 | Perf | **style.css (73KB) referenced by nothing** — dead weight/repo cruft. | `grep` finds zero `<link>` to it | Delete or confirm stale. |
| 23 | Perf/Strategy | **No service worker** despite PWA framing — not installable/offline; README "works offline" is false. | no `serviceWorker`/`sw.js`/`workbox` anywhere; `site.webmanifest` | Add SW: network-first index.html, precache shell, runtime-cache Firebase CDN. |
| 24 | Perf | **index.html 276KB un-minified, no-cache, re-downloaded every visit**; 174KB eager splash DOM. | `wc -c index.html`=276051 | Minify HTML in build; lazy-render below-fold splash sections. |
| 25 | Perf | **3 always-on document-wide MutationObservers** (subtree+characterData). | `icons.js:120`; `index.html:4302,4344,4396` | Scope to app root; disconnect splash-only observers after splash. |
| 26 | UX | **Stats view has no empty state** — all-zero bars/donut/heatmap for new users. | `src/main.ts:3590` | Add empty state gated on `S.sessions.length===0`. |
| 27 | UX | **Running timer invisible off Focus view; no nav-away warning mid-session.** | `goTo`/`_goToFinish` `src/main.ts:1034` | Persistent mini-timer chip in sidebar when `timer.running`. |
| 28 | a11y | **No `<main>` landmark, no per-view `<h1>`, no skip link, title never updates on nav.** | `<main>`=0; only splash `<h1>`; `document.title`=0 in main.ts | Wrap views in `<main>`, one `<h1>`/view, skip link, set `document.title` on nav. |
| 29 | SEO | **Sitemap lastmod stale/inaccurate**; PWA manifest icons SVG-only (need 192/512 PNG). | `sitemap.xml`; `site.webmanifest` | Regenerate lastmod on deploy; add raster maskable icons. |
| 30 | Content | **No FAQ on splash** (objections answered only on sub-pages); differentiation vs Quizlet/Anki/Notion only on founder page. | `index.html` splash; `founder.html:222` | Add splash FAQ + a "vs usual study apps" block; pull founder manifesto into splash. |
| 31 | SEO/Perf | **`founder.jpg` 404** — referenced, not in repo; one `<img>` lacks src+alt. | `index.html:1816,1016` | Add optimized photo w/ width/height + alt, or remove. |

---

## P3 — Polish

- Destructive `deleteTask` also instant, no confirm (`src/main.ts:3901`).
- Toasts: single-at-a-time (rapid ones overwrite) + `white-space:nowrap` overflows on mobile (`src/main.ts:3909,3925`).
- Clickable `<div onclick>` cards without keyboard role (`homeDueCard` `index.html:2358`, `fc-card-wrap` `:3448`).
- Touch targets <44px on icon buttons (desktop); fonts not preloaded (render-blocking CSS hop); `_headers` cache rules miss CSS/SVG/manifest/landing HTML; no `404.html`/`_redirects`; `meta keywords` legacy cruft; `founder.html` could use `ProfilePage` schema; emoji inside rating-button accessible names; open `/api/log` endpoint (low — throttle via IP); self-XSS via unescaped `color` style fields (validate `/^#[0-9a-f]{6}$/i` on sync load).

---

## Strategic layer — how to "be top"

**Competitive reality:** "All-in-one free AI study app" is a crowded me-too position; Brainfy
loses on each single axis to a specialist (Anki/SRS, Quizlet/Knowt/study-modes, NotebookLM/AI,
Forest/focus). **Feature breadth is not a moat.**

**The one defensible wedge:** Brainfy uniquely holds *focus-session telemetry* + *SRS
retention data* + *an AI tutor that already ingests both* (`buildSystemPrompt` `src/main.ts:4574`).
A "study coach that knows you focus best at 9am, keep failing photosynthesis cards, and
auto-schedules a focus block to drill them" is something competitors structurally can't ship.

### Missing table-stakes (prioritized)
- **P0** Anki/Quizlet/CSV import + export (the proven acquisition wedge; removes lock-in objection).
- **P0** Study modes beyond flip+SRS: MCQ "Learn", Match, Test/typed, Cloze (baseline now).
- **P1** Review reminders / streak-save (push + email) — SRS without a trigger is a leaky bucket.
- **P1** True offline/installable PWA (service worker).
- **P1** Public/shared decks + starter library (growth flywheel + SEO).
- **P2** Image occlusion (unlocks high-LTV med/anatomy cohort); native apps later.

### Top features to build (impact × effort)
1. Quizlet/Anki/CSV import-export — very high / low-med. **Build first.**
2. Multi-mode study (MCQ/Match/Test/Cloze) — high / med (LLM generates distractors).
3. Review reminders + streak-freeze (push/email) — very high / low. Cheapest high-ROI.
4. **Focus-aware study coach (the moat)** — high / med. Turn focus telemetry into proactive coaching + auto-scheduled review blocks.
5. Installable PWA + offline shell — high / med.
6. Public/shared decks + SEO-able deck pages — high / med-high.
7. Image occlusion — med-high (segment) / med.
8. Auto-earned milestones + tasteful streak-freeze — med / low-med.

### Retention loop gaps
No external trigger (no notifications/email), no loss-aversion (no streak freeze), no social/
accountability, milestones are manual not earned. **Fix order:** reminder → streak freeze →
auto-milestones → weekly email digest → opt-in social.

### Monetization (current model is unsustainable)
100% free with token-burning AI and zero gating. Recommend **"free core, credit-gated AI
compute" freemium:** keep timer/manual cards/SRS/library/import-export/sync free forever; meter
AI imports + tutor messages (free: ~3–5 imports/mo + ~20 msgs/day); **Brainfy Plus ~$5–7/mo
(student-discounted)** for unlimited AI + vision OCR + priority model. Meter in *outcomes
("imports left")*, not tokens. Add the per-user AI cap **regardless** of pricing (P0 survival).

---

## Recommended sequencing

1. **Quick wins (hours):** `--toplevel` mangle (#14), og PNG (#5), noindex stitch (#6),
   delete dead style.css (#22), focus-visible ring (#8), aria-labels (#9), humanize tutor
   errors (#19), label/remove fake stats (#20).
2. **Funnel + safety (days):** guest CTA + seeded demo (#1), local→cloud merge (#2),
   AI rate limiting + body caps + max_tokens clamp (#3,#4), hero rewrite (#7,#21),
   deleteDoc confirm (#13), fix `s.docs++` + AI-import persistence bugs (#10,#11,#12).
3. **A11y pass (days):** contrast (#16), live regions (#17), dialog semantics/focus trap (#18),
   landmarks/skip link/titles (#28).
4. **Perf pass (days):** parallel Firebase (#15), HTML minify + lazy splash (#24), service
   worker (#23), observer scoping (#25), font preload + cache headers.
5. **Strategic build (weeks):** import/export → study modes → reminders/streak-freeze →
   focus-aware coach → shared decks → monetization.
