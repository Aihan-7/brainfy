# Brainfy

> AI-powered study app for deep focus. Pomodoro timer, spaced-repetition
> flashcards, smart library, weekly timetable, focus analytics — all in
> one calm, distraction-free workspace.

**Try it:** [brainfy.online](https://brainfy.online)
**Built by:** [Aihan Mifthas](https://github.com/Aihan-7)

---

## What it does

- **Focus timer** — Pomodoro (25/5), Extended (50/10), Deep Work (90/20) with
  ambient sound mixing (lofi / rain / white noise / forest).
- **SRS flashcards** — Anki-style SM-2 lite scheduling. Daily review queue
  across all decks. New-card cap to prevent burnout.
- **AI Import** — paste a YouTube URL or drop a text file; AI extracts
  flashcards, a markdown summary, and an outline in one shot.
- **AI tutor** — context-aware chat that knows your subjects, score, and
  streak. Powered by Groq (Llama 3.3) or Anthropic (Claude).
- **Smart library** — organise notes, links, and uploaded files per
  subject. Inline base64 for small files; Firebase Storage for the rest.
- **Honest analytics** — focus hours, streak, focus-score ring, weekly
  heatmap. No fake vanity stats.
- **Cross-device sync** — Firestore-backed. Works offline; syncs when
  back online.

## Tech stack

- **Frontend** — TypeScript (strict), no framework. Compiled to a single
  `script.js`, minified with terser. ~150 KB on the wire.
- **Backend** — Cloudflare Pages Functions (Web Crypto, no Node) for the
  AI proxy and telemetry endpoints. Firebase Auth + Firestore + Storage
  for users + data + uploads.
- **AI** — Groq (preferred, free quota) with Anthropic fallback.
  Server-enforced JSON mode + retry-once on parse failure.
- **Splash code-split** — landing page loads zero Firebase / zero app JS
  until the user clicks Enter. First paint is HTML + ~3 KB of icons.
- **CI** — GitHub Actions: typecheck + `node --test` + drift-check that
  the committed `script.js` matches what `src/main.ts` compiles to.
- **Security** — Firestore rules + Storage rules (per-uid), CSP headers,
  Firebase ID-token verification on all cost-incurring `/api/*`
  endpoints (Web Crypto RSA verify, JWKS cached in Worker memory).

## Run it locally

```bash
git clone https://github.com/Aihan-7/brainfy
cd brainfy
npm install
npm run build      # tsc + terser
npm start          # node server.js → http://localhost:3456
```

The dev server is `server.js` — a tiny Node HTTP server that serves the
static files and mirrors a few `/api/*` endpoints. Production runs on
Cloudflare Pages (which doesn't execute Node — the `functions/api/*`
files are the ones that actually serve in prod).

You'll need:
- A `.env` with `GROQ_API_KEY=...` or `ANTHROPIC_API_KEY=...` for the AI
  endpoints to work in dev.
- A Firebase project of your own if you want sync/auth to work. Update
  `FB_CONFIG` in `index.html`. Publish `firestore.rules` and
  `storage.rules` in the Firebase Console (or via
  `firebase deploy --only firestore:rules,storage`).

## Licensing

Code is **MIT-licensed** — fork it, study it, ship your own thing with
it. See [LICENSE](./LICENSE) for the full text.

The **"Brainfy" name, logo, domain, and social handles are reserved.**
If you fork this and launch publicly, please use a different name so
users aren't confused about who built what. See the BRAND NOTICE at
the bottom of LICENSE for the specifics.

## Contributing

I'm not actively soliciting contributions yet — Brainfy is still in the
"one person, one obsession" phase — but bug reports and ideas are
welcome via [GitHub Issues](https://github.com/Aihan-7/brainfy/issues).

If you spot a security issue, please email **help@brainfy.online**
instead of filing a public issue.
