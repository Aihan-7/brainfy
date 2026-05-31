// Static SEO page generator for Brainfy.
//
// Programmatic SEO done safely: one shared template + a content-data array →
// consistent, fully-interlinked static HTML pages with real (non-thin) copy,
// SoftwareApplication/Article + BreadcrumbList + FAQPage JSON-LD, OG/Twitter
// cards, and an auto-regenerated sitemap + a /resources hub.
//
// Run:  node scripts/gen-pages.mjs
// Add a page: append to PAGES (and META) below, re-run. Existing hand-authored
// pages (ai-flashcards, ai-tutor, pdf-to-flashcards, pomodoro-timer,
// study-planner) are left untouched; they're listed in META + SITEMAP only so
// the new pages can link to them and the sitemap stays complete.

import { writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://brainfy.online';
const TODAY = new Date().toISOString().slice(0, 10);

const CSS = `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root { --bg:#0b1326; --card:rgba(255,255,255,0.04); --border:rgba(255,255,255,0.08); --primary:#7c3aed; --plight:#a78bfa; --cyan:#4cd7f6; --text:#dae2fd; --muted:#94a3b8; --green:#4ede9a; }
    body { background:var(--bg); color:var(--text); font-family:'Manrope',sans-serif; line-height:1.7; -webkit-font-smoothing:antialiased; }
    .page { max-width:780px; margin:0 auto; padding:56px 24px 96px; }
    .back { display:inline-flex; align-items:center; gap:6px; color:var(--plight); text-decoration:none; font-size:14px; font-weight:600; margin-bottom:32px; opacity:.85; }
    .back:hover { opacity:1; } .back::before { content:'\\2190'; font-size:16px; }
    nav.crumbs { font-size:12px; color:var(--muted); margin-bottom:14px; font-family:'Space Grotesk',sans-serif; letter-spacing:0.04em; }
    nav.crumbs a { color:var(--plight); text-decoration:none; } nav.crumbs a:hover { text-decoration:underline; }
    .eyebrow { font-family:'Space Grotesk',sans-serif; font-size:11px; font-weight:700; letter-spacing:0.18em; color:var(--plight); margin-bottom:14px; text-transform:uppercase; }
    h1 { font-size:clamp(2rem,4.5vw,2.8rem); font-weight:900; letter-spacing:-0.025em; line-height:1.12; color:#fff; margin-bottom:18px; }
    .lede { font-size:1.08rem; color:#c8d4ec; margin-bottom:32px; }
    .cta-row { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:48px; }
    .btn { padding:13px 22px; border-radius:12px; font-family:'Manrope',sans-serif; font-size:14px; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:8px; transition:transform 0.12s, box-shadow 0.18s; }
    .btn-primary { background:linear-gradient(135deg,var(--primary),#6d28d9); color:#fff; box-shadow:0 10px 30px rgba(124,58,237,0.32); }
    .btn-primary:hover { transform:translateY(-1px); box-shadow:0 14px 34px rgba(124,58,237,0.42); }
    .btn-ghost { background:rgba(255,255,255,0.04); border:1px solid var(--border); color:var(--text); }
    .btn-ghost:hover { background:rgba(255,255,255,0.08); }
    h2 { font-size:1.45rem; font-weight:800; color:#fff; letter-spacing:-0.015em; margin:48px 0 16px; }
    h3 { font-size:1.05rem; font-weight:700; color:var(--plight); margin:24px 0 8px; }
    p { color:#b8c5dd; margin-bottom:16px; }
    p strong { color:#fff; font-weight:700; }
    ul { color:#b8c5dd; padding-left:22px; margin-bottom:18px; }
    ul li { margin-bottom:8px; }
    a { color:var(--plight); }
    table.cmp { width:100%; border-collapse:collapse; margin:18px 0 24px; font-size:14px; }
    table.cmp th, table.cmp td { text-align:left; padding:11px 14px; border-bottom:1px solid var(--border); color:#b8c5dd; }
    table.cmp th { color:#fff; font-family:'Space Grotesk',sans-serif; font-size:12px; letter-spacing:0.04em; }
    table.cmp td:first-child { color:#fff; font-weight:600; }
    .steps { display:grid; gap:14px; margin:18px 0 24px; }
    .step { display:grid; grid-template-columns:auto 1fr; gap:16px; padding:18px 20px; border-radius:14px; background:var(--card); border:1px solid var(--border); }
    .step-n { width:34px; height:34px; border-radius:50%; background:rgba(124,58,237,0.18); border:1px solid rgba(124,58,237,0.35); color:var(--plight); font-family:'Space Grotesk',sans-serif; font-weight:800; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; }
    .step h3 { color:#fff; margin:0 0 4px; font-size:15px; }
    .step p { color:#a8b6d0; margin:0; font-size:14px; }
    .faq details { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:14px 18px; margin-bottom:10px; }
    .faq summary { cursor:pointer; font-weight:700; color:#fff; font-size:15px; list-style:none; outline:none; }
    .faq summary::-webkit-details-marker { display:none; }
    .faq summary::after { content:'+'; float:right; color:var(--plight); font-weight:700; transition:transform 0.2s; }
    .faq details[open] summary::after { transform:rotate(45deg); display:inline-block; }
    .faq details p { margin:12px 0 4px; font-size:14px; }
    .crosslinks { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; margin:18px 0 24px; }
    .crosslinks a { display:block; padding:16px 18px; border-radius:12px; background:var(--card); border:1px solid var(--border); color:var(--text); text-decoration:none; transition:border-color 0.15s, transform 0.12s; }
    .crosslinks a:hover { border-color:rgba(124,58,237,0.35); transform:translateY(-2px); }
    .crosslinks strong { display:block; color:#fff; font-weight:700; margin-bottom:4px; font-size:14px; }
    .crosslinks span { color:var(--muted); font-size:12px; }
    hr { border:none; border-top:1px solid var(--border); margin:44px 0 24px; }
    .byline { font-size:13px; color:var(--muted); margin:-6px 0 26px; }
    .byline a { color:var(--plight); }
    .foot { color:var(--muted); font-size:13px; }`;

// slug → { title, blurb } for every linkable page (existing + generated), used
// to render crosslink cards and the resources hub.
const META = {
  'ai-flashcards':        { title: 'AI Flashcards',            blurb: 'Turn notes, PDFs, and images into spaced-repetition decks.' },
  'pdf-to-flashcards':    { title: 'PDF to Flashcards',        blurb: 'Upload a PDF and get a full deck in seconds.' },
  'ai-tutor':             { title: 'AI Tutor',                 blurb: 'Streaming chat that explains concepts and quizzes you.' },
  'pomodoro-timer':       { title: 'Pomodoro Timer',           blurb: 'A free, distraction-free focus timer with honest analytics.' },
  'study-planner':        { title: 'Study Planner',            blurb: 'A weekly timetable that plans the focus, not just the work.' },
};

// ── Content ───────────────────────────────────────────────────────────────
const PAGES = [
  // ===== USE-CASE / SUBJECT =====
  {
    slug: 'spaced-repetition-app', cat: 'app', eyebrow: 'Use case · Spaced repetition',
    crumb: 'Spaced Repetition App',
    title: 'Free Spaced Repetition App — Brainfy',
    desc: 'Brainfy is a free spaced-repetition app: it schedules flashcard reviews at the right moment so you remember more in less time. Build decks by hand or with AI.',
    keywords: 'spaced repetition app, free spaced repetition, SRS app, spaced repetition flashcards, study app spaced repetition',
    h1: 'A Free Spaced Repetition App That Actually Schedules Your Reviews',
    lede: 'Brainfy uses <strong>spaced repetition</strong> to show each flashcard at the moment you’re about to forget it — so cards you know fade into the background and the ones you miss come back sooner. Build decks by hand, import them, or let the AI draft them from your notes.',
    body: `
      <h2>What spaced repetition does for you</h2>
      <p>Cramming fights forgetting with brute force. Spaced repetition works <em>with</em> your memory instead: each correct review pushes the next one further out (a day, then a week, then a month), while a miss resets the card to short intervals. The result is durable recall for a fraction of the review time.</p>
      <h2>How Brainfy schedules cards</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>Rate each card honestly</h3><p>After flipping a card you tap Again, Hard, Good, or Easy — the same four-button scale serious learners rely on.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>Brainfy sets the next date</h3><p>An SM-2-style algorithm grows the interval for cards you know and collapses it for cards you miss, with a daily cap so new decks never bury you.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>Review only what’s due</h3><p>Your home screen surfaces exactly the cards due today — no more, no less — so a session stays short and finishable.</p></div></div>
      </div>
      <h2>More than a scheduler</h2>
      <ul>
        <li><strong>AI deck building.</strong> Paste notes or a PDF and Brainfy drafts the cards — then they enter the same spaced-repetition queue.</li>
        <li><strong>A focus timer.</strong> Pair reviews with a Pomodoro session so the studying actually happens.</li>
        <li><strong>Honest analytics.</strong> See real retention and focus trends, not vanity stats.</li>
        <li><strong>Free during beta.</strong> No deck caps, no paywalls on the core SRS.</li>
      </ul>`,
    faq: [
      { q: 'Is Brainfy’s spaced repetition free?', a: 'Yes. The spaced-repetition engine — scheduling, the four-button rating, and daily review queue — is free during beta with no deck limits.' },
      { q: 'What algorithm does Brainfy use?', a: 'An SM-2-style algorithm (the family Anki popularised): correct reviews grow the interval via an ease factor, misses reset it, and new cards are capped per day so you don’t burn out.' },
      { q: 'Can I import existing decks?', a: 'Yes — paste or upload CSV, tab-separated, Anki plain-text, or Quizlet exports from any deck’s Cards tab, and they slot straight into the schedule.' },
      { q: 'Do I need to build cards manually?', a: 'No. You can write cards by hand, import them, or let the AI generate a deck from your notes, a PDF, or a photo — all three feed the same SRS.' },
    ],
    related: ['ai-flashcards', 'active-recall', 'pdf-to-flashcards', 'exam-prep-app'],
  },
  {
    slug: 'exam-prep-app', cat: 'app', eyebrow: 'Use case · Exam prep',
    crumb: 'Exam Prep App',
    title: 'Exam Prep App — Study Smarter for Finals | Brainfy',
    desc: 'Brainfy is a free exam-prep app: turn your notes into flashcards, drill them with spaced repetition, plan your week, and stay focused with a Pomodoro timer.',
    keywords: 'exam prep app, study app for exams, finals study app, test prep app, study planner exams',
    h1: 'An Exam-Prep App That Covers the Whole Workflow',
    lede: 'Most study apps do one thing. Brainfy connects the <strong>whole exam-prep loop</strong> — turn your material into flashcards, drill them with spaced repetition, schedule your week, and protect your focus — in one calm, free app.',
    body: `
      <h2>The exam-prep loop, in one place</h2>
      <ul>
        <li><strong>Capture</strong> — drop in lecture notes, PDFs, or textbook photos; the AI drafts a deck.</li>
        <li><strong>Drill</strong> — spaced repetition resurfaces weak cards right before you’d forget them.</li>
        <li><strong>Plan</strong> — a weekly timetable blocks out what to study and when.</li>
        <li><strong>Focus</strong> — a Pomodoro timer turns “I should study” into a finished session.</li>
      </ul>
      <h2>Why it beats a pile of tabs</h2>
      <p>Juggling a flashcard app, a timer, a to-do list, and a notes doc means four context switches and zero shared signal. Brainfy keeps it together, so your <strong>focus history and retention data inform each other</strong> — the built-in coach can literally tell you which subject is slipping and when you focus best.</p>
      <h2>Built for crunch weeks</h2>
      <p>During finals you don’t want decisions — you want a queue. Brainfy shows exactly what’s due today, caps new cards so a fresh deck doesn’t avalanche, and keeps a streak (with a freeze for the day life gets in the way).</p>`,
    faq: [
      { q: 'Is Brainfy free for students?', a: 'Yes — free during beta, with no caps on decks, sessions, or the planner. No card is paywalled.' },
      { q: 'Can it make flashcards from my lecture notes?', a: 'Yes. Paste notes or upload a PDF / photo and the AI drafts question-answer cards you can keep, edit, or discard.' },
      { q: 'Does it help me plan my study week?', a: 'Yes — the weekly timetable lets you block study sessions by subject, and the coach highlights what to prioritise.' },
      { q: 'Will it work the night before an exam?', a: 'It shines for sustained prep, but even last-minute it’s useful: generate a deck from your notes and drill the highest-yield cards with active recall.' },
    ],
    related: ['ai-flashcards', 'study-planner', 'pomodoro-timer', 'how-to-study-for-exams'],
  },
  {
    slug: 'ai-flashcards-for-medical-school', cat: 'subject', eyebrow: 'Use case · Medical school',
    crumb: 'AI Flashcards for Med School',
    title: 'AI Flashcards for Medical School — Brainfy',
    desc: 'Turn lecture slides, first-aid notes, and PDFs into spaced-repetition flashcards for medical school. Free AI deck generation built for high-volume memorisation.',
    keywords: 'medical school flashcards, AI flashcards med school, anki alternative med school, USMLE flashcards, spaced repetition medicine',
    h1: 'AI Flashcards for Medical School',
    lede: 'Med school is a memory marathon — thousands of facts, fast. Brainfy turns your <strong>lecture slides, PDFs, and notes into spaced-repetition flashcards</strong> automatically, so you spend your hours recalling rather than retyping.',
    body: `
      <h2>Why spaced repetition is non-negotiable in medicine</h2>
      <p>The volume is the whole problem. Spaced repetition is the proven answer — it’s why so many medical students live in SRS apps. Brainfy brings that same engine, plus AI that drafts the cards from your actual material so you start reviewing today instead of card-building all night.</p>
      <h2>From slide deck to study deck</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>Upload the source</h3><p>Lecture PDF, a photo of a textbook page, or pasted notes — all flow through one import.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>AI drafts grounded cards</h3><p>Cards are pulled from your source, not invented — critical when the facts have to be right.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>Drill with daily caps</h3><p>New cards are throttled per day so a 300-card lecture doesn’t bury tomorrow’s review.</p></div></div>
      </div>
      <h2>Coming from Anki?</h2>
      <p>You can import your existing decks (Anki “Notes in Plain Text”, CSV, or Quizlet exports) and export Brainfy decks back out as CSV — so there’s no lock-in. Many students keep heavy specialty decks in Anki and use Brainfy’s AI to spin up cards from new lectures fast.</p>`,
    faq: [
      { q: 'Is this a good Anki alternative for med school?', a: 'It’s a strong companion: Brainfy adds AI card generation, a focus timer, and a gentler interface, and it imports/exports decks so you’re never locked in. For massive shared specialty decks, Anki’s ecosystem is still deep — many students use both.' },
      { q: 'Are the AI cards accurate?', a: 'The generator is deliberately conservative — it extracts from your source rather than inventing facts — and every card is editable before it enters your deck. Always verify clinical facts against your source.' },
      { q: 'Can it handle hundreds of cards?', a: 'Yes. New cards are capped per day so large decks ramp up sustainably instead of overwhelming a single session.' },
      { q: 'Is it free?', a: 'Yes, free during beta with no deck limits.' },
    ],
    related: ['ai-flashcards', 'spaced-repetition-app', 'free-anki-alternative', 'pdf-to-flashcards'],
  },
  {
    slug: 'ai-flashcards-for-language-learning', cat: 'subject', eyebrow: 'Use case · Languages',
    crumb: 'AI Flashcards for Languages',
    title: 'AI Flashcards for Language Learning — Brainfy',
    desc: 'Build vocabulary fast with AI-generated, spaced-repetition flashcards for language learning. Paste a word list or notes and Brainfy drafts the deck. Free.',
    keywords: 'language learning flashcards, vocabulary flashcards app, spaced repetition vocabulary, AI language flashcards, learn vocabulary app',
    h1: 'AI Flashcards for Language Learning',
    lede: 'Vocabulary is a spaced-repetition problem — the right word at the right interval. Brainfy turns <strong>word lists, notes, and readings into review-ready flashcards</strong> and schedules them so new vocabulary actually sticks.',
    body: `
      <h2>Why SRS owns vocabulary</h2>
      <p>You don’t need to see “house → casa” every day forever — you need it exactly when it’s about to slip. Spaced repetition spaces those reviews out automatically, so 20 minutes a day compounds into a large, durable vocabulary.</p>
      <h2>Build a deck in seconds</h2>
      <ul>
        <li><strong>Paste a word list</strong> as <em>term, translation</em> per line and import it straight into a deck.</li>
        <li><strong>Drop in reading notes</strong> and let the AI pull out key vocabulary and phrases.</li>
        <li><strong>Import from Quizlet or Anki</strong> — bring decks you already have, no retyping.</li>
      </ul>
      <h2>Then make it stick</h2>
      <p>Pair a short daily review with the focus timer, keep a gentle streak going, and let the multiple study modes (multiple choice, type-the-answer, match) keep recall sharp from more than one angle.</p>`,
    faq: [
      { q: 'Can I import a vocabulary list?', a: 'Yes — paste or upload a CSV / tab-separated list (term, translation) and it imports straight into a deck. Quizlet and Anki exports work too.' },
      { q: 'Does it support multiple study modes?', a: 'Yes: classic flip + spaced repetition, multiple-choice “Learn”, type-the-answer “Test”, and a timed “Match” game — all from the same deck.' },
      { q: 'Will it handle accents and other scripts?', a: 'Yes — card text is full Unicode, and answer checking is accent-aware so typed answers are graded fairly.' },
      { q: 'Is it free?', a: 'Yes, free during beta.' },
    ],
    related: ['ai-flashcards', 'spaced-repetition-app', 'free-quizlet-alternative', 'active-recall'],
  },

  // ===== COMPARISON =====
  {
    slug: 'free-anki-alternative', cat: 'compare', eyebrow: 'Comparison · Anki',
    crumb: 'Free Anki Alternative',
    title: 'A Free Anki Alternative With AI Flashcards | Brainfy',
    desc: 'Brainfy is a free Anki alternative with the same spaced-repetition core, plus AI deck generation and a cleaner interface. Import and export decks — no lock-in.',
    keywords: 'anki alternative, free anki alternative, anki vs brainfy, spaced repetition app like anki, anki with AI',
    h1: 'A Free Anki Alternative — With AI Doing the Card-Building',
    lede: 'Love Anki’s spaced repetition, not the setup? Brainfy keeps the <strong>SM-2-style scheduling</strong> you rely on, adds <strong>AI that drafts cards from your notes</strong>, and wraps it in a calm interface — with full import/export so you’re never locked in.',
    body: `
      <h2>Brainfy vs Anki at a glance</h2>
      <table class="cmp">
        <tr><th>&nbsp;</th><th>Brainfy</th><th>Anki</th></tr>
        <tr><td>Spaced repetition</td><td>Yes (SM-2 style)</td><td>Yes</td></tr>
        <tr><td>AI card generation</td><td>Built in (notes / PDF / image)</td><td>Add-ons only</td></tr>
        <tr><td>Setup</td><td>Open the site, start</td><td>Install + configure</td></tr>
        <tr><td>Focus timer + planner</td><td>Built in</td><td>No</td></tr>
        <tr><td>Import / export</td><td>CSV, TSV, Anki text, Quizlet</td><td>Its own ecosystem</td></tr>
        <tr><td>Price</td><td>Free (beta)</td><td>Free (mobile paid on iOS)</td></tr>
      </table>
      <h2>Where Brainfy wins</h2>
      <ul>
        <li><strong>No card-building grind.</strong> Paste notes or a PDF and get a draft deck — Anki makes you build every card.</li>
        <li><strong>Zero setup.</strong> It runs in the browser; nothing to install or sync manually.</li>
        <li><strong>The whole loop.</strong> Timer, weekly planner, and a focus-aware coach live in the same app.</li>
      </ul>
      <h2>Where Anki still leads</h2>
      <p>Anki’s decade-deep add-on ecosystem and enormous shared-deck libraries are unmatched, and its scheduler is endlessly tweakable. If you live inside massive community decks, that gravity is real — which is why Brainfy <strong>imports and exports decks</strong> so you can use both.</p>`,
    faq: [
      { q: 'Is Brainfy really free like Anki?', a: 'Yes — free during beta with no deck caps. (Anki is free too, except the one-time paid iOS app.)' },
      { q: 'Can I import my Anki decks?', a: 'Yes. Export your Anki notes as “Notes in Plain Text” (tab-separated) and paste or upload them in any deck’s Cards tab. CSV works too.' },
      { q: 'Can I export back out of Brainfy?', a: 'Yes — every deck exports to CSV, which re-imports into Anki, Quizlet, or a spreadsheet. No lock-in.' },
      { q: 'Does Brainfy use the same algorithm?', a: 'It uses an SM-2-style algorithm — the same family Anki’s classic scheduler is built on — with a four-button rating and per-day new-card caps.' },
    ],
    related: ['spaced-repetition-app', 'ai-flashcards', 'free-quizlet-alternative', 'ai-flashcards-for-medical-school'],
  },
  {
    slug: 'free-quizlet-alternative', cat: 'compare', eyebrow: 'Comparison · Quizlet',
    crumb: 'Free Quizlet Alternative',
    title: 'A Free Quizlet Alternative — No Paywalls | Brainfy',
    desc: 'Brainfy is a free Quizlet alternative: flashcards, Learn / Test / Match study modes, and real spaced repetition — with AI deck generation and no feature paywalls.',
    keywords: 'quizlet alternative, free quizlet alternative, quizlet vs brainfy, study modes app, flashcards learn test match',
    h1: 'A Free Quizlet Alternative That Doesn’t Paywall Studying',
    lede: 'Brainfy gives you the study modes you came to Quizlet for — <strong>flashcards, Learn, Test, and Match</strong> — plus real <strong>spaced repetition</strong> and <strong>AI deck generation</strong>, without locking the good parts behind a subscription.',
    body: `
      <h2>Brainfy vs Quizlet at a glance</h2>
      <table class="cmp">
        <tr><th>&nbsp;</th><th>Brainfy</th><th>Quizlet</th></tr>
        <tr><td>Flashcards + Learn + Test + Match</td><td>Yes</td><td>Yes (some gated)</td></tr>
        <tr><td>True spaced repetition</td><td>Yes (SM-2 style)</td><td>Limited / paid</td></tr>
        <tr><td>AI deck generation</td><td>Built in</td><td>Paid tier</td></tr>
        <tr><td>Ads</td><td>None</td><td>Yes (free tier)</td></tr>
        <tr><td>Focus timer + planner</td><td>Built in</td><td>No</td></tr>
        <tr><td>Price</td><td>Free (beta)</td><td>Free tier + paid Plus</td></tr>
      </table>
      <h2>Same modes, no nickel-and-diming</h2>
      <ul>
        <li><strong>Learn</strong> — adaptive multiple choice that drills weak cards.</li>
        <li><strong>Test</strong> — type-the-answer with fair, accent-aware grading.</li>
        <li><strong>Match</strong> — a timed pairing game for fast recall.</li>
        <li><strong>Flashcards</strong> — flip review backed by genuine spaced repetition, not just shuffle.</li>
      </ul>
      <h2>Bring your sets with you</h2>
      <p>Export your Quizlet set (copy the term/definition text) and paste it straight into Brainfy’s import — it auto-detects the delimiter. Your set becomes a spaced-repetition deck in seconds, and you can export it back to CSV anytime.</p>`,
    faq: [
      { q: 'Is Brainfy free with no ads?', a: 'Yes — free during beta and ad-free. The study modes and spaced repetition aren’t paywalled.' },
      { q: 'Can I import my Quizlet sets?', a: 'Yes. Use Quizlet’s Export, copy the text, and paste it into a deck’s Cards tab — Brainfy auto-detects the separator. CSV and tab-separated work too.' },
      { q: 'Does it have Learn, Test, and Match?', a: 'Yes — all of them, from any deck, plus classic flip review with spaced repetition.' },
      { q: 'What does Brainfy add that Quizlet doesn’t?', a: 'Real spaced-repetition scheduling, AI deck generation from notes/PDFs, a built-in focus timer and weekly planner, and a focus-aware study coach — all free.' },
    ],
    related: ['ai-flashcards', 'spaced-repetition-app', 'free-anki-alternative', 'ai-flashcards-for-language-learning'],
  },
  {
    slug: 'brainfy-vs-notion', cat: 'compare', eyebrow: 'Comparison · Notion',
    crumb: 'Brainfy vs Notion',
    title: 'Brainfy vs Notion for Studying | Brainfy',
    desc: 'Notion organises your notes; Brainfy helps you remember them. Compare Brainfy’s spaced repetition, AI flashcards, and focus tools against Notion for studying.',
    keywords: 'brainfy vs notion, notion for studying, notion flashcards, study app vs notion, spaced repetition vs notion',
    h1: 'Brainfy vs Notion for Studying',
    lede: 'Notion is a brilliant place to <strong>organise</strong> notes. But organising isn’t remembering. Brainfy is purpose-built for the part Notion leaves to you: <strong>turning notes into recall</strong> with spaced repetition, AI flashcards, and focus tools.',
    body: `
      <h2>Different jobs</h2>
      <p>Notion is a flexible workspace — databases, docs, wikis. That flexibility is its strength and, for studying, its cost: you end up <em>building a study system</em> instead of studying. Brainfy is opinionated about one outcome — you remember the material — and ships the whole loop to get there.</p>
      <h2>Side by side</h2>
      <table class="cmp">
        <tr><th>&nbsp;</th><th>Brainfy</th><th>Notion</th></tr>
        <tr><td>Note organisation</td><td>Light (per subject)</td><td>Excellent</td></tr>
        <tr><td>Spaced-repetition review</td><td>Built in</td><td>No (templates only)</td></tr>
        <tr><td>AI flashcards from notes</td><td>Built in</td><td>No</td></tr>
        <tr><td>Focus timer + planner</td><td>Built in</td><td>Via templates</td></tr>
        <tr><td>Setup effort</td><td>None</td><td>You build it</td></tr>
      </table>
      <h2>Use them together</h2>
      <p>Keep your long-form notes and project docs in Notion. When it’s time to <strong>actually memorise</strong>, paste a section into Brainfy, generate a deck, and let spaced repetition do the rest. Notion holds the knowledge; Brainfy gets it into your head.</p>`,
    faq: [
      { q: 'Can Notion do spaced repetition?', a: 'Only through DIY templates or third-party widgets — there’s no native scheduler. Brainfy has spaced repetition built in.' },
      { q: 'Should I replace Notion with Brainfy?', a: 'Not necessarily — they do different jobs. Notion organises; Brainfy memorises. Many students keep notes in Notion and review in Brainfy.' },
      { q: 'Can I move notes from Notion into Brainfy?', a: 'Yes — paste a note or export text, and the AI drafts flashcards from it; or paste a term/definition list to import directly.' },
      { q: 'Is Brainfy free?', a: 'Yes, free during beta.' },
    ],
    related: ['ai-flashcards', 'study-planner', 'spaced-repetition-app', 'how-to-study-for-exams'],
  },

  // ===== GUIDES =====
  {
    slug: 'active-recall', cat: 'guide', eyebrow: 'Guide · Study science',
    crumb: 'Active Recall',
    title: 'Active Recall: What It Is and How to Use It | Brainfy',
    desc: 'Active recall is the most effective study technique there is. Learn what it is, why it works, and how to practise it with flashcards and spaced repetition.',
    keywords: 'active recall, active recall study, what is active recall, active recall flashcards, retrieval practice',
    h1: 'Active Recall: The Highest-Leverage Way to Study',
    lede: '<strong>Active recall</strong> — retrieving information from memory instead of re-reading it — is the single most evidence-backed study technique. Here’s what it is, why it works, and how to build it into a daily habit.',
    body: `
      <h2>What active recall is</h2>
      <p>Active recall (a.k.a. retrieval practice) means closing the book and forcing your brain to produce the answer. Re-reading and highlighting feel productive but mostly build <em>familiarity</em>, not <em>recall</em>. Every time you retrieve a fact, you strengthen the path back to it — which is exactly what an exam tests.</p>
      <h2>Why it works</h2>
      <ul>
        <li><strong>Retrieval is the rehearsal.</strong> The act of remembering is what consolidates the memory.</li>
        <li><strong>It surfaces gaps.</strong> You instantly learn what you actually know versus what just looked familiar.</li>
        <li><strong>It pairs perfectly with spacing.</strong> Recall a fact, then recall it again later — that’s spaced repetition.</li>
      </ul>
      <h2>How to practise it</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>Turn notes into questions</h3><p>Every fact becomes a question. Flashcards are active recall in its purest form.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>Answer before flipping</h3><p>Always commit to an answer out loud or on paper before checking — the effort is the point.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>Space the reviews</h3><p>Let a scheduler bring missed cards back sooner and known cards back later.</p></div></div>
      </div>
      <p>Brainfy does all three by default: the AI turns your notes into question-answer cards, the study modes force retrieval, and spaced repetition handles the timing.</p>`,
    faq: [
      { q: 'Is active recall better than re-reading?', a: 'Substantially. Decades of cognitive-science research show retrieval practice produces far stronger long-term retention than re-reading or highlighting.' },
      { q: 'How is active recall related to spaced repetition?', a: 'They’re partners: active recall is the act of retrieving; spaced repetition is the schedule that decides when to retrieve again. Flashcard apps combine both.' },
      { q: 'What’s the easiest way to start?', a: 'Make flashcards from your notes and answer each before flipping. In Brainfy you can auto-generate the cards from notes or a PDF.' },
      { q: 'How long should a session be?', a: 'Short and frequent beats long and rare. 15–25 focused minutes a day, reviewing only what’s due, compounds quickly.' },
    ],
    related: ['spaced-repetition-app', 'ai-flashcards', 'how-to-study-for-exams', 'feynman-technique'],
  },
  {
    slug: 'how-to-study-for-exams', cat: 'guide', eyebrow: 'Guide · Exam strategy',
    crumb: 'How to Study for Exams',
    title: 'How to Study for Exams: A Simple, Proven System | Brainfy',
    desc: 'A simple, evidence-based system for exam prep: active recall, spaced repetition, focused sessions, and a realistic plan. Stop cramming and start remembering.',
    keywords: 'how to study for exams, exam study tips, best way to study for finals, study techniques, study plan exams',
    h1: 'How to Study for Exams (Without Cramming)',
    lede: 'Most students study harder, not smarter. The research points to a short list of techniques that actually move the needle — here’s a simple system built on <strong>active recall, spaced repetition, and focused sessions</strong>.',
    body: `
      <h2>The four moves that matter</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>Convert material into questions</h3><p>Reading is input; questions force output. Turn each chunk of notes into a flashcard.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>Recall, don’t re-read</h3><p>Answer from memory first. Struggling to retrieve is what builds the memory.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>Space it out</h3><p>Review a little every day on a schedule, instead of one long cram. Misses come back sooner.</p></div></div>
        <div class="step"><div class="step-n">4</div><div><h3>Protect the focus</h3><p>Use 25-minute focused blocks. A finished short session beats an unfocused long one.</p></div></div>
      </div>
      <h2>A realistic weekly plan</h2>
      <ul>
        <li><strong>Daily:</strong> clear your due flashcards (10–20 min) and one focus block on the hardest subject.</li>
        <li><strong>Weekly:</strong> generate new cards from that week’s lectures; review what the analytics say is slipping.</li>
        <li><strong>Pre-exam:</strong> stop adding new cards a few days out; drill the backlog and weak spots.</li>
      </ul>
      <h2>Let the tools carry the load</h2>
      <p>You shouldn’t be tracking intervals by hand. Brainfy auto-builds the cards, schedules the reviews, plans your week, and a focus-aware coach tells you what to prioritise — so the system runs itself and you just show up.</p>`,
    faq: [
      { q: 'How far ahead should I start?', a: 'The earlier the better — spaced repetition rewards spreading reviews over weeks. But even a week of daily active recall beats a single all-nighter.' },
      { q: 'Is cramming ever worth it?', a: 'Cramming can buy a short-term bump for tomorrow’s test, but it fades fast. For anything cumulative (finals, boards), spacing wins decisively.' },
      { q: 'How many hours a day?', a: 'Consistency over volume. A couple of focused hours daily — reviews plus one or two Pomodoro blocks — outperforms erratic marathons.' },
      { q: 'What tools do I actually need?', a: 'A flashcard app with spaced repetition and a focus timer. Brainfy bundles both, plus AI to build the cards for you.' },
    ],
    related: ['active-recall', 'spaced-repetition-app', 'pomodoro-technique', 'exam-prep-app'],
  },
  {
    slug: 'pomodoro-technique', cat: 'guide', eyebrow: 'Guide · Focus',
    crumb: 'The Pomodoro Technique',
    title: 'The Pomodoro Technique: How and Why It Works | Brainfy',
    desc: 'The Pomodoro Technique breaks study into focused 25-minute blocks with short breaks. Learn how it works, why it beats marathon sessions, and how to start free.',
    keywords: 'pomodoro technique, what is pomodoro, pomodoro study method, 25 minute focus, pomodoro timer technique',
    h1: 'The Pomodoro Technique, Explained',
    lede: 'The <strong>Pomodoro Technique</strong> is dead simple: work in focused 25-minute blocks separated by short breaks. It works because it makes starting easy and distraction expensive — here’s how to use it well.',
    body: `
      <h2>The method in one paragraph</h2>
      <p>Pick one task. Set a 25-minute timer (one “pomodoro”). Work only on that task until it rings. Take a 5-minute break. After four pomodoros, take a longer 15–30 minute break. That’s the whole thing.</p>
      <h2>Why such a small trick works</h2>
      <ul>
        <li><strong>It shrinks the start.</strong> “25 minutes” is far less intimidating than “study chapter 7,” so you actually begin.</li>
        <li><strong>It makes focus a game.</strong> The running timer turns checking your phone into “breaking the pomodoro,” which you don’t want to do.</li>
        <li><strong>It builds in recovery.</strong> Breaks prevent the slow fade of attention that makes hour three useless.</li>
      </ul>
      <h2>Getting the most from it</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>One intention per block</h3><p>Name the single task before you start — vague blocks drift.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>Defend the 25 minutes</h3><p>Capture stray thoughts on paper and deal with them on the break.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>Pair it with recall</h3><p>Spend a block clearing your due flashcards — focus plus retrieval is a potent combo.</p></div></div>
      </div>
      <p>Brainfy’s built-in Pomodoro timer logs every session, so your focus history feeds the same analytics and coach as your flashcard reviews.</p>`,
    faq: [
      { q: 'Why 25 minutes?', a: 'It’s long enough for real work but short enough to stay sharp and to start without dread. You can tune the length in Brainfy if a different block suits you.' },
      { q: 'What do I do on the break?', a: 'Step away from the screen — stretch, water, look out a window. The point is to let attention recover, not to switch to another screen.' },
      { q: 'Does it work for flashcards?', a: 'Very well. A pomodoro spent clearing due cards pairs focused attention with active recall — two of the best study levers at once.' },
      { q: 'Is Brainfy’s timer free?', a: 'Yes — the Pomodoro timer (and ambient sound + session logging) is free, no signup needed to try.' },
    ],
    related: ['pomodoro-timer', 'how-to-study-for-exams', 'study-planner', 'active-recall'],
  },
  {
    slug: 'feynman-technique', cat: 'guide', eyebrow: 'Guide · Study science',
    crumb: 'The Feynman Technique',
    title: 'The Feynman Technique: Learn by Explaining | Brainfy',
    desc: 'The Feynman Technique says: if you can’t explain it simply, you don’t understand it. Learn the four steps and how to combine it with flashcards and recall.',
    keywords: 'feynman technique, learn by teaching, explain to understand, feynman method studying, understand deeply',
    h1: 'The Feynman Technique: Understand by Explaining',
    lede: 'Named after the physicist Richard Feynman, the idea is brutal and effective: <strong>if you can’t explain it in plain language, you don’t really understand it.</strong> Here are the four steps — and how to pair them with active recall.',
    body: `
      <h2>The four steps</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>Pick a concept</h3><p>Write the concept at the top of a blank page.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>Explain it simply</h3><p>Teach it as if to a curious 12-year-old — plain words, no jargon, concrete examples.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>Find the gaps</h3><p>Wherever you stall or reach for jargon, that’s a gap. Go back to the source and fill it.</p></div></div>
        <div class="step"><div class="step-n">4</div><div><h3>Simplify and refine</h3><p>Rewrite until the explanation is clean and an analogy makes it click.</p></div></div>
      </div>
      <h2>Why it works</h2>
      <p>Explaining forces you to organise ideas and exposes the difference between recognising a term and understanding it. It’s active recall aimed at <em>comprehension</em> rather than facts — which is why it pairs so well with flashcards for the facts.</p>
      <h2>Combine it with Brainfy</h2>
      <p>Use Feynman to understand the concept, then turn the key facts into flashcards (the AI can draft them from your notes) so spaced repetition keeps them. Understanding plus retention is the whole game. The AI tutor can even play the “curious student” and probe your explanation for gaps.</p>`,
    faq: [
      { q: 'Is the Feynman Technique just teaching?', a: 'It’s teaching used as a diagnostic — the goal isn’t the lesson, it’s finding the exact points where your understanding breaks down so you can fix them.' },
      { q: 'How does it differ from flashcards?', a: 'Flashcards drill discrete facts; Feynman builds conceptual understanding. Use Feynman to truly get it, then flashcards to remember it.' },
      { q: 'Can the AI tutor help?', a: 'Yes — explain a concept to Brainfy’s AI tutor and ask it to poke holes; it surfaces the gaps a 12-year-old would.' },
      { q: 'Is this free in Brainfy?', a: 'Yes — the AI tutor and flashcards are free during beta.' },
    ],
    related: ['active-recall', 'ai-tutor', 'how-to-study-for-exams', 'spaced-repetition-app'],
  },
];

// ── Rendering ───────────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function crosslinks(slugs) {
  return slugs.map(s => {
    const m = META[s];
    if (!m) return '';
    return `<a href="/${s}.html"><strong>${esc(m.title)} →</strong><span>${esc(m.blurb)}</span></a>`;
  }).join('\n      ');
}

// Shared entity nodes — DEFINED on every page so author/publisher @id
// references resolve on-page (Google doesn't reliably follow cross-page @id),
// which is what makes the Organization/Person E-E-A-T signals count.
const SAME_AS = ['https://github.com/Aihan-7', 'https://www.instagram.com/stillaihantho_/', 'https://www.facebook.com/aihan.mifthas.16'];
const ORG = {
  "@type": "Organization", "@id": `${ORIGIN}/#org`, name: "Brainfy", url: `${ORIGIN}/`,
  logo: { "@type": "ImageObject", url: `${ORIGIN}/og-image.png`, width: 1200, height: 630 },
  description: "A free AI-powered study app: AI flashcards, spaced repetition, an AI tutor, and a focus timer.",
  founder: { "@id": `${ORIGIN}/#aihan` }, sameAs: SAME_AS,
};
const PERSON = {
  "@type": "Person", "@id": `${ORIGIN}/#aihan`, name: "Aihan Mifthas", url: `${ORIGIN}/founder.html`,
  jobTitle: "Founder & CEO", worksFor: { "@id": `${ORIGIN}/#org` },
  sameAs: ['https://github.com/Aihan-7', 'https://www.instagram.com/stillaihantho_/'],
};
const WEBSITE = { "@type": "WebSite", "@id": `${ORIGIN}/#website`, url: `${ORIGIN}/`, name: "Brainfy", publisher: { "@id": `${ORIGIN}/#org` }, inLanguage: "en" };

function jsonLd(p) {
  const url = `${ORIGIN}/${p.slug}.html`;
  const primary = p.cat === 'guide'
    ? { "@type": "Article", "@id": `${url}#article`, headline: p.h1, description: p.desc,
        author: { "@id": `${ORIGIN}/#aihan` }, publisher: { "@id": `${ORIGIN}/#org` },
        isPartOf: { "@id": `${ORIGIN}/#website` }, image: `${ORIGIN}/og/${p.slug}.png`,
        datePublished: TODAY, dateModified: TODAY, inLanguage: "en", mainEntityOfPage: url }
    : { "@type": "SoftwareApplication", "@id": `${url}#app`, name: `Brainfy — ${p.crumb}`,
        applicationCategory: "EducationalApplication", operatingSystem: "Web", url, description: p.desc,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": `${ORIGIN}/#org` }, isPartOf: { "@id": `${ORIGIN}/#website` } };
  const graph = [
    ORG, WEBSITE, PERSON,
    primary,
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${ORIGIN}/` },
      { "@type": "ListItem", position: 2, name: "Resources", item: `${ORIGIN}/resources.html` },
      { "@type": "ListItem", position: 3, name: p.crumb, item: url },
    ] },
  ];
  if (p.faq?.length) {
    graph.push({ "@type": "FAQPage", mainEntity: p.faq.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) });
  }
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 2);
}

// Contextual internal linking: link the FIRST mention of each key term to its
// "money" feature page with a descriptive anchor (the linked text itself). Only
// touches plain body text — skips headings, existing links, and <summary> — and
// never self-links. Distributes authority + signals topical relevance.
const LINK_TARGETS = [
  [/\bAI[\s-]flashcards?\b/i,        'ai-flashcards'],
  [/\bflashcard (?:generator|maker)\b/i, 'free-flashcard-maker'],
  [/\bspaced[\s-]repetition\b/i,     'spaced-repetition-app'],
  [/\bPomodoro(?:\s+timer)?\b/i,     'pomodoro-timer'],
  [/\bAI tutor\b/i,                  'ai-tutor'],
  [/\bstudy planner\b/i,             'study-planner'],
  [/\bactive recall\b/i,            'active-recall'],
  [/\bPDF\b/,                        'pdf-to-flashcards'],
];
function autolink(htmlBody, selfSlug) {
  const targets = LINK_TARGETS.filter(([, slug]) => slug !== selfSlug);
  const used = new Set();
  const openProt = /^<(a|h1|h2|h3|summary)\b/i;
  const closeProt = /^<\/(a|h1|h2|h3|summary)\s*>/i;
  let prot = 0;
  return htmlBody.split(/(<[^>]+>)/).map(tok => {
    if (tok.startsWith('<')) {
      if (closeProt.test(tok)) prot = Math.max(0, prot - 1);
      else if (openProt.test(tok) && !tok.endsWith('/>')) prot++;
      return tok;
    }
    if (prot > 0 || !tok.trim()) return tok;
    let text = tok;
    for (const [re, slug] of targets) {
      if (used.has(slug)) continue;
      const m = text.match(re);
      if (m && m.index != null) {
        text = text.slice(0, m.index) + `<a href="/${slug}.html">${m[0]}</a>` + text.slice(m.index + m[0].length);
        used.add(slug);
      }
    }
    return text;
  }).join('');
}

function render(p) {
  const url = `${ORIGIN}/${p.slug}.html`;
  const faqHtml = (p.faq || []).map(f => `      <details><summary>${esc(f.q)}</summary>\n        <p>${esc(f.a)}</p>\n      </details>`).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>${esc(p.title)}</title>
  <meta name="description" content="${esc(p.desc)}" />
  <meta name="author" content="Aihan Mifthas" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta name="theme-color" content="#0b1326" />
  <link rel="canonical" href="${url}" />
  <link rel="icon" type="image/svg+xml" href="/icon.svg" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Brainfy" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${esc(p.title)}" />
  <meta property="og:description" content="${esc(p.desc)}" />
  <meta property="og:image" content="${ORIGIN}/og/${p.slug}.png" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(p.title)}" />
  <meta name="twitter:description" content="${esc(p.desc)}" />
  <meta name="twitter:image" content="${ORIGIN}/og/${p.slug}.png" />

  <script type="application/ld+json">
${jsonLd(p)}
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@600;700;800&display=swap" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@600;700;800&display=swap"></noscript>
  <style>
    ${CSS}
  </style>
</head>
<body>
  <div class="page">
    <a class="back" href="/">Back to Brainfy</a>
    <nav class="crumbs" aria-label="Breadcrumb">
      <a href="/">Home</a> &nbsp;›&nbsp; <a href="/resources.html">Resources</a> &nbsp;›&nbsp; <span>${esc(p.crumb)}</span>
    </nav>

    <p class="eyebrow">${esc(p.eyebrow)}</p>
    <h1>${esc(p.h1)}</h1>
    ${p.cat === 'guide' ? `<p class="byline">By <a href="/founder.html">Aihan Mifthas</a>, founder of Brainfy · Updated ${TODAY}</p>` : ''}
    <p class="lede">${p.lede}</p>

    <div class="cta-row">
      <a class="btn btn-primary" href="/">Open Brainfy →</a>
      <a class="btn btn-ghost" href="/resources.html">All study resources</a>
    </div>
${autolink(p.body, p.slug)}
    <h2>Frequently asked questions</h2>
    <div class="faq">
${faqHtml}
    </div>

    <h2>Explore more of Brainfy</h2>
    <div class="crosslinks">
      ${crosslinks(p.related)}
    </div>

    <hr>
    <p class="foot">Brainfy is built by <a href="/founder.html">Aihan Mifthas</a> · Last updated ${TODAY}. <a href="/">Open Brainfy →</a></p>
  </div>
</body>
</html>
`;
}

// ── Resources hub ─────────────────────────────────────────────────────────
function renderHub() {
  const groups = [
    { title: 'Features', slugs: ['ai-flashcards', 'pdf-to-flashcards', 'ai-tutor', 'pomodoro-timer', 'study-planner'] },
    { title: 'Free tools', slugs: PAGES.filter(p => p.cat === 'tool').map(p => p.slug) },
    { title: 'Use cases', slugs: PAGES.filter(p => p.cat === 'app' || p.cat === 'subject').map(p => p.slug) },
    { title: 'Compare', slugs: PAGES.filter(p => p.cat === 'compare').map(p => p.slug) },
    { title: 'Study guides', slugs: PAGES.filter(p => p.cat === 'guide').map(p => p.slug) },
  ].filter(g => g.slugs.length);
  const sections = groups.map(g => `    <h2>${g.title}</h2>
    <div class="crosslinks">
      ${crosslinks(g.slugs)}
    </div>`).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>Study Resources & Guides | Brainfy</title>
  <meta name="description" content="Brainfy’s study resources: feature guides, app comparisons, and evidence-based study techniques like spaced repetition, active recall, and the Pomodoro method." />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta name="theme-color" content="#0b1326" />
  <link rel="canonical" href="${ORIGIN}/resources.html" />
  <link rel="icon" type="image/svg+xml" href="/icon.svg" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Brainfy" />
  <meta property="og:url" content="${ORIGIN}/resources.html" />
  <meta property="og:title" content="Study Resources & Guides | Brainfy" />
  <meta property="og:description" content="Feature guides, app comparisons, and evidence-based study techniques." />
  <meta property="og:image" content="${ORIGIN}/og/resources.png" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${ORIGIN}/og/resources.png" />

  <script type="application/ld+json">
${JSON.stringify({ "@context": "https://schema.org", "@graph": [
  ORG, WEBSITE,
  { "@type": "CollectionPage", "@id": `${ORIGIN}/resources.html#page`, url: `${ORIGIN}/resources.html`, name: "Study Resources & Guides", description: "Feature guides, app comparisons, and evidence-based study techniques.", isPartOf: { "@id": `${ORIGIN}/#website` }, about: { "@id": `${ORIGIN}/#org` }, inLanguage: "en" },
  { "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${ORIGIN}/` },
    { "@type": "ListItem", position: 2, name: "Resources", item: `${ORIGIN}/resources.html` },
  ] },
] }, null, 2)}
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@600;700;800&display=swap" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@600;700;800&display=swap"></noscript>
  <style>
    ${CSS}
  </style>
</head>
<body>
  <div class="page">
    <a class="back" href="/">Back to Brainfy</a>
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> &nbsp;›&nbsp; <span>Resources</span></nav>
    <p class="eyebrow">Brainfy Resources</p>
    <h1>Study Resources &amp; Guides</h1>
    <p class="lede">Everything Brainfy can do, plus the study science behind it — feature walkthroughs, honest comparisons, and evidence-based techniques to help you remember more in less time. Or <a href="/decks">browse free community flashcard decks →</a></p>
${sections}
    <hr>
    <p class="foot">Brainfy is built by <a href="/founder.html">Aihan Mifthas</a> · Last updated ${TODAY}. <a href="/">Open Brainfy →</a></p>
  </div>
</body>
</html>
`;
}

// ── Sitemap ─────────────────────────────────────────────────────────────────
function renderSitemap() {
  const staticPages = [
    { loc: '/', priority: '1.0', freq: 'weekly' },
    { loc: '/resources.html', priority: '0.8', freq: 'weekly' },
    { loc: '/decks', priority: '0.7', freq: 'daily' },
    { loc: '/founder.html', priority: '0.7', freq: 'monthly' },
    { loc: '/ai-flashcards.html', priority: '0.9', freq: 'monthly' },
    { loc: '/pdf-to-flashcards.html', priority: '0.9', freq: 'monthly' },
    { loc: '/ai-tutor.html', priority: '0.9', freq: 'monthly' },
    { loc: '/pomodoro-timer.html', priority: '0.9', freq: 'monthly' },
    { loc: '/study-planner.html', priority: '0.9', freq: 'monthly' },
    { loc: '/privacy.html', priority: '0.3', freq: 'yearly' },
    { loc: '/terms.html', priority: '0.3', freq: 'yearly' },
  ];
  const genPages = PAGES.map(p => ({ loc: `/${p.slug}.html`, priority: '0.8', freq: 'monthly' }));
  const all = [...staticPages, ...genPages];
  const body = all.map(u => `  <url>\n    <loc>${ORIGIN}${u.loc}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>${u.freq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

// ── Load extra page modules ───────────────────────────────────────────────
// Pages can also live in scripts/pages/*.mjs (each `export default [ ...page
// objects... ]`), so large batches can be authored/added independently. A
// broken or malformed module is skipped (logged), never breaks the whole build.
const extraDir = join(ROOT, 'scripts', 'pages');
if (existsSync(extraDir)) {
  for (const f of readdirSync(extraDir).filter(f => f.endsWith('.mjs')).sort()) {
    try {
      const mod = await import(pathToFileURL(join(extraDir, f)).href);
      const arr = Array.isArray(mod.default) ? mod.default : [];
      let added = 0;
      for (const p of arr) {
        if (!p || !p.slug || !p.h1) continue;
        // Fill sensible defaults so a slightly-incomplete page still renders.
        p.cat     = p.cat || 'guide';
        p.eyebrow = p.eyebrow || 'Brainfy';
        p.crumb   = p.crumb || p.slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        p.title   = p.title || `${p.crumb} | Brainfy`;
        p.desc    = p.desc || '';
        p.keywords = p.keywords || '';
        p.lede    = p.lede || '';
        p.body    = p.body || '';
        p.faq     = Array.isArray(p.faq) ? p.faq : [];
        p.related = Array.isArray(p.related) ? p.related : [];
        if (PAGES.some(x => x.slug === p.slug)) continue;   // de-dupe
        PAGES.push(p);
        added++;
      }
      console.log(`  loaded ${added} pages from scripts/pages/${f}`);
    } catch (e) {
      console.warn(`  SKIPPED scripts/pages/${f}: ${e.message}`);
    }
  }
}

// ── Build ─────────────────────────────────────────────────────────────────
// Register generated pages in META so they can cross-link each other.
for (const p of PAGES) {
  META[p.slug] = META[p.slug] || { title: p.crumb, blurb: (p.desc || p.crumb).length > 90 ? (p.desc || p.crumb).slice(0, 88) + '…' : (p.desc || p.crumb) };
}

let count = 0;
for (const p of PAGES) {
  writeFileSync(join(ROOT, `${p.slug}.html`), render(p));
  count++;
}
writeFileSync(join(ROOT, 'resources.html'), renderHub());
writeFileSync(join(ROOT, 'sitemap.xml'), renderSitemap());

console.log(`Generated ${count} pages + resources.html + sitemap.xml`);
console.log('Pages: ' + PAGES.map(p => p.slug).join(', '));
