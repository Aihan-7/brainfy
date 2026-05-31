// ══════════════════════════════════════════════════
//  Brainfy — main.ts
// ══════════════════════════════════════════════════

// ── Firebase global (loaded via CDN compat build) ─
declare const firebase: any;

// ── Types ────────────────────────────────────────────────────────────────────

interface FlashCard {
  q: string;
  a: string;
  // ── SRS scheduling (all optional for backward compat) ──
  // A card with none of these fields set is treated as a brand-new card
  // by the scheduler — see srs.ts-style functions below.
  dueAt?:    number;   // ms timestamp. Missing = due now (new card).
  interval?: number;   // days until next review after the last rating.
  ease?:     number;   // SM-2 ease factor. Default 2.5. Clamped to [1.3, 2.5].
  reps?:     number;   // successful reviews ("good" or "easy") in a row.
  lapses?:   number;   // times rated "again" after the card graduated.
  lastReviewedAt?: number;  // ms timestamp of most recent rating — for stats.
}

interface Doc {
  id:           number;
  name:         string;
  type:         'note' | 'link' | 'file';
  // For 'note' → the markdown body
  // For 'link' → the URL
  // For 'file' (legacy small files) → base64 data URI
  // For 'file' (storage-backed) → empty (use storagePath/downloadURL)
  content:      string;
  mime?:        string;
  size?:        number;          // bytes
  date:         number;
  storagePath?: string;          // Firebase Storage object path (for large files)
  downloadURL?: string;          // Cached signed URL for fetching from Storage
  // Plain text the AI can read (extracted PDF/text, or a YouTube transcript).
  // Persisted on AI-imported source docs so a summary can be generated later,
  // after the import modal has been closed. Absent for images (vision uses the
  // data URL in `content`) and for plain uploads with no extractable text.
  aiText?:      string;
}

interface Subject {
  id:        number;
  name:      string;
  desc:      string;
  docs:      number;
  color:     string;
  accessed:  number;
  cards?:    FlashCard[];
  documents?: Doc[];
}

interface Task {
  id:   number;
  text: string;
  done: boolean;
}

interface Milestone {
  id:   number;
  text: string;
  done: boolean;
}

interface Session {
  date:      string;   // ISO string
  duration:  number;   // seconds
  subjectId: number | null;
}

interface TimetableBlock {
  id:    number;
  title: string;
  day:   number;   // 0=Mon … 6=Sun
  start: string;   // "HH:MM"
  end:   string;   // "HH:MM"
  color: string;
}

interface AmbientState {
  lofi:   number;
  rain:   number;
  white:  number;
  forest: number;
}

interface AppState {
  userName:      string;
  subjects:      Subject[];
  tasks:         Task[];
  milestones:    Milestone[];
  sessions:      Session[];
  focusDuration: number;
  breakDuration: number;
  ambient:       AmbientState;
  sessionNotes:  string;
  dailyGoal:     number;
  streak:        number;
  bestStreak:    number;
  nextId:        number;
  timetable:     TimetableBlock[];
  tourSeen?:     boolean;        // first-run guided tour completion flag
}

interface Quote {
  t: string;
  a: string;
}

interface AmbientNode {
  gainNode: GainNode;
  sources:  AudioNode[];
}

type AmbientKey = 'lofi' | 'rain' | 'white' | 'forest';
// Anki-style 4-button rating. The values map 1:1 onto the SM-2 inputs:
//   again — total recall failure                 → relapse, due immediately
//   hard  — recalled but with significant effort → smaller interval growth
//   good  — recalled correctly                   → standard interval growth
//   easy  — trivially recalled                   → boosted interval growth
type FcRating   = 'again' | 'hard' | 'good' | 'easy';
type ViewName   = 'splash' | 'signin' | 'signup' | 'home' | 'focus' | 'library' | 'flashcards' | 'stats' | 'tasks' | 'timetable' | 'settings';

const STORAGE_KEY = 'brainfy_v3';
// Lightweight "did this device sign in before?" hint, separate from STORAGE_KEY
// (which we wipe on sign-out / clear-cache). Lets the splash personalise its
// CTA to "Continue as <name>" without waiting for the Firebase SDK to load.
const USER_HINT_KEY = 'brainfy_user_hint';
const TIMER_C = 754;   // 2π × 120  (timer ring circumference)
const SCORE_C = 339;   // 2π × 54   (score ring circumference)

// 24 quotes = once-a-day uniqueness when the dashboard rotates hourly
// (renderHomeQuote picks index = hour-of-epoch % length). Keep this list
// curated — every entry should earn its slot. Mix philosophy, focus,
// learning, persistence; avoid generic hustle bromides.
const QUOTES = [
  { t: '"The important thing is not to stop questioning. Curiosity has its own reason for existence."', a: 'Albert Einstein' },
  { t: '"An investment in knowledge pays the best interest."', a: 'Benjamin Franklin' },
  { t: '"Live as if you were to die tomorrow. Learn as if you were to live forever."', a: 'Mahatma Gandhi' },
  { t: '"It is not that I\'m so smart. But I stay with the questions much longer."', a: 'Albert Einstein' },
  { t: '"The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice."', a: 'Brian Herbert' },
  { t: '"Education is not the filling of a pail, but the lighting of a fire."', a: 'W.B. Yeats' },
  { t: '"The beautiful thing about learning is that no one can take it away from you."', a: 'B.B. King' },
  { t: '"Tell me and I forget. Teach me and I remember. Involve me and I learn."', a: 'Benjamin Franklin' },
  { t: '"What we learn with pleasure we never forget."', a: 'Alfred Mercier' },
  { t: '"The expert in anything was once a beginner."', a: 'Helen Hayes' },
  { t: '"You don\'t have to be great to start, but you have to start to be great."', a: 'Zig Ziglar' },
  { t: '"Discipline is choosing between what you want now and what you want most."', a: 'Abraham Lincoln' },
  { t: '"Concentration is the secret of strength."', a: 'Ralph Waldo Emerson' },
  { t: '"The mind is not a vessel to be filled, but a fire to be kindled."', a: 'Plutarch' },
  { t: '"It always seems impossible until it\'s done."', a: 'Nelson Mandela' },
  { t: '"We are what we repeatedly do. Excellence, then, is not an act, but a habit."', a: 'Will Durant' },
  { t: '"Knowing is not enough; we must apply. Willing is not enough; we must do."', a: 'Goethe' },
  { t: '"The roots of education are bitter, but the fruit is sweet."', a: 'Aristotle' },
  { t: '"Success is the sum of small efforts, repeated day in and day out."', a: 'Robert Collier' },
  { t: '"Do not be embarrassed by your failures, learn from them and start again."', a: 'Richard Branson' },
  { t: '"The only way to do great work is to love what you do."', a: 'Steve Jobs' },
  { t: '"A year from now you may wish you had started today."', a: 'Karen Lamb' },
  { t: '"Quality is not an act, it is a habit."', a: 'Aristotle' },
  { t: '"The best way to predict the future is to create it."', a: 'Peter Drucker' },
];

const SUBJECT_COLORS = ['#7c3aed','#0891b2','#065f46','#9a3412','#1e40af','#b45309','#be185d'];

// ── Flashcard data sets ──────────────────────────────────────────────────────
// Cards are stored per-subject in S.subjects[].cards (added by AI or user).
// This default set is shown when a subject has no cards yet.
const FLASHCARD_SETS: Record<string, FlashCard[]> = {
  default: [
    { q:'What is spaced repetition?', a:'A learning technique that schedules reviews at increasing intervals over time, exploiting the spacing effect to maximize long-term retention.' },
    { q:'Define active recall', a:'Deliberately retrieving information from memory (vs. passively re-reading), which strengthens neural pathways and dramatically improves retention.' },
    { q:'What is the Feynman Technique?', a:'(1) Pick a concept. (2) Explain it in plain language. (3) Identify gaps. (4) Simplify further. Exposes true understanding.' },
    { q:'What is deliberate practice?', a:'Focused practice at the edge of your ability, with clear goals, immediate feedback, and systematic attention to weaknesses.' },
    { q:'Define working memory', a:'A cognitive system with limited capacity that temporarily holds and manipulates information for immediate use in thinking and reasoning.' },
    { q:'What is the Pomodoro Technique?', a:'Work in focused 25-minute blocks (pomodoros) separated by 5-minute breaks. After 4 pomodoros, take a 15–30 minute long break.' },
  ],
};

// ── Default state ───────────────────────────────────────────────────────────
const DEFAULT_STATE = {
  userName: '',
  subjects:   [],
  tasks:      [],
  milestones: [],
  sessions:   [],
  focusDuration: 25*60,
  breakDuration:  5*60,
  ambient: { lofi:0, rain:0, white:0, forest:0 },
  sessionNotes: '',
  dailyGoal: 120,
  streak: 0,
  bestStreak: 0,
  nextId: 1,
  timetable: [] as TimetableBlock[],
  tourSeen: false,
};

// ── Runtime state ───────────────────────────────────────────────────────────
let S: AppState = { ...DEFAULT_STATE };
let currentView: ViewName = 'splash';
let fcModalHTML = ''; // saved on first open; restored when modal closes

const timer: {
  interval:  ReturnType<typeof setInterval> | undefined;
  timeLeft:  number;
  totalTime: number;
  running:   boolean;
  mode:      'focus' | 'break';
  subjectId: number | null;
  intent:    string;
} = {
  interval:  undefined,
  timeLeft:  25 * 60,
  totalTime: 25 * 60,
  running:   false,
  mode:      'focus',
  subjectId: null,
  intent:    '',
};

// ── Firebase auth state ──────────────────────────────────────────────────────
let firebaseUser: any = null;   // current Firebase user object
let idToken:      string | null = null;  // cached ID token (refreshed automatically)

// ── Web Audio Ambient Engine ─────────────────────────────────────────────────
let audioCtx: AudioContext | null = null;
const ambientNodes: Partial<Record<AmbientKey, AmbientNode>> = {};

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const len = 3 * ctx.sampleRate;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d   = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function startAmbientKey(key: AmbientKey, vol: number): void {
  const ctx = getCtx();
  if (ambientNodes[key]) { setAmbientVol(key, vol); return; }

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(vol / 100 * 0.35, ctx.currentTime + 1);
  gain.connect(ctx.destination);

  const sources = [];

  if (key === 'white') {
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx);
    src.loop = true;
    src.connect(gain);
    src.start();
    sources.push(src);

  } else if (key === 'rain') {
    // Layered bandpass noise = realistic rain
    [700, 1400, 2800].forEach((freq, i) => {
      const src = ctx.createBufferSource();
      src.buffer = makeNoiseBuffer(ctx);
      src.loop = true;
      const bpf = ctx.createBiquadFilter();
      bpf.type = 'bandpass';
      bpf.frequency.value = freq;
      bpf.Q.value = 0.6;
      const g2 = ctx.createGain();
      g2.gain.value = i === 0 ? 0.6 : 0.35 - i * 0.05;
      src.connect(bpf); bpf.connect(g2); g2.connect(gain);
      src.start();
      sources.push(src, bpf, g2);
    });
    // Slow amplitude swell (rain variation)
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.value = 0.12; lfoG.gain.value = 0.08;
    lfo.connect(lfoG); lfoG.connect(gain.gain);
    lfo.start(); sources.push(lfo, lfoG);

  } else if (key === 'forest') {
    // Layered high-pass noise + slow LFO = wind through trees
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx);
    src.loop = true;
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass'; hpf.frequency.value = 800; hpf.Q.value = 0.3;
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass'; lpf.frequency.value = 3500;
    src.connect(hpf); hpf.connect(lpf); lpf.connect(gain);
    src.start();
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.value = 0.08; lfoG.gain.value = 0.12;
    lfo.connect(lfoG); lfoG.connect(gain.gain);
    lfo.start(); sources.push(src, hpf, lpf, lfo, lfoG);

  } else if (key === 'lofi') {
    // Warm detuned triangle oscillators + heavy lowpass = lo-fi hum
    const freqs = [110, 138.6, 165, 220]; // A2, C#3, E3, A3
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f + (Math.random() - 0.5) * 2; // slight detune
      const g2 = ctx.createGain();
      g2.gain.value = [0.28, 0.18, 0.18, 0.12][i];
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass'; lpf.frequency.value = 900; lpf.Q.value = 1.2;
      osc.connect(g2); g2.connect(lpf); lpf.connect(gain);
      osc.start(); sources.push(osc, g2, lpf);
    });
    // Tremolo
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.value = 0.6; lfoG.gain.value = 0.06;
    lfo.connect(lfoG); lfoG.connect(gain.gain);
    lfo.start(); sources.push(lfo, lfoG);
  }

  ambientNodes[key] = { gainNode: gain, sources };
}

function stopAmbientKey(key: AmbientKey): void {
  const node = ambientNodes[key];
  if (!node || !audioCtx) return;
  const { gainNode, sources } = node;
  gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.4);
  setTimeout(() => {
    sources.forEach(s => { try { if ((s as AudioScheduledSourceNode).stop) (s as AudioScheduledSourceNode).stop(); else s.disconnect(); } catch(_){} });
    try { gainNode.disconnect(); } catch(_){}
    delete ambientNodes[key];
  }, 1500);
}

function setAmbientVol(key: AmbientKey, vol: number): void {
  const node = ambientNodes[key];
  if (!node || !audioCtx) return;
  node.gainNode.gain.setTargetAtTime(vol / 100 * 0.35, audioCtx.currentTime, 0.2);
}

function syncAmbient(): void {
  (['lofi','rain','white','forest'] as AmbientKey[]).forEach(k => {
    const v = S.ambient[k] || 0;
    if (v > 0) startAmbientKey(k, v);
    else       stopAmbientKey(k);
  });
}

// ── Flashcard SRS (SM-2 lite) ───────────────────────────────────────────────
// Anki-style spaced repetition. The four buttons map onto these intervals:
//
//   New card (no `interval` yet):
//     again → due in 0 min (relapse — see it again this session)
//     hard  → 1 day
//     good  → 3 days
//     easy  → 7 days
//
//   Review card (has `interval`):
//     again → 0 min (relapse), ease -= 0.2, lapses++,  interval reset
//     hard  → interval × 1.2,  ease -= 0.15
//     good  → interval × ease, ease unchanged
//     easy  → interval × ease × 1.3, ease += 0.15
//
// Ease factor is clamped to [1.3, 2.5] so a hot streak doesn't blow the
// schedule out, and a bad streak doesn't trap a card in same-day repetition.
const SRS_NEW_INTERVALS: Record<FcRating, number> = {
  again: 0,
  hard:  1,
  good:  3,
  easy:  7,
};
const SRS_EASE_MIN     = 1.3;
const SRS_EASE_MAX     = 2.5;
const SRS_EASE_DEFAULT = 2.5;
const DAY_MS           = 86400000;

// Anki-style daily cap on NEW cards (never-reviewed) per session. Without
// this, a user with a freshly-imported 500-card deck would be shown all 500
// at once — guaranteed burnout. The 20 default matches Anki's out-of-the-
// box value; expose as a setting later if requested.
const SRS_NEW_PER_SESSION = 20;

function srsSchedule(card: FlashCard, rating: FcRating): FlashCard {
  const now = Date.now();
  let interval = card.interval ?? 0;
  let ease     = card.ease     ?? SRS_EASE_DEFAULT;
  let reps     = card.reps     ?? 0;
  let lapses   = card.lapses   ?? 0;

  // First exposure — no interval recorded yet
  const isNew = card.interval == null;

  if (rating === 'again') {
    interval = 0;             // due immediately, will re-appear this session
    ease     = Math.max(SRS_EASE_MIN, ease - 0.20);
    reps     = 0;
    if (!isNew) lapses += 1;
  } else if (isNew) {
    interval = SRS_NEW_INTERVALS[rating];
    if (rating === 'easy') ease = Math.min(SRS_EASE_MAX, ease + 0.15);
    if (rating === 'hard') ease = Math.max(SRS_EASE_MIN, ease - 0.15);
    reps = 1;
  } else {
    // Mature card — multiply forward.
    const mult = rating === 'hard' ? 1.2
               : rating === 'good' ? ease
               : /* easy */          ease * 1.3;
    interval = Math.max(1, Math.round(interval * mult));
    if (rating === 'easy') ease = Math.min(SRS_EASE_MAX, ease + 0.15);
    if (rating === 'hard') ease = Math.max(SRS_EASE_MIN, ease - 0.15);
    reps += 1;
  }

  return {
    ...card,
    dueAt:    now + Math.round(interval * DAY_MS),
    interval,
    ease,
    reps,
    lapses,
    lastReviewedAt: now,
  };
}

// Predict the next interval for a card+rating without mutating. Used for the
// labels on the rating buttons ("Good · 3d").
function srsPreview(card: FlashCard, rating: FcRating): number {
  const next = srsSchedule(card, rating);
  return next.interval ?? 0;
}

function srsIsDue(card: FlashCard, now: number = Date.now()): boolean {
  // No dueAt → never reviewed → due
  return card.dueAt == null || card.dueAt <= now;
}

// Pretty-print an interval in days as a human label: 0d → "<1d", 1 → "1d",
// 30 → "1mo", 365 → "1y". Used for button labels.
function srsLabel(days: number): string {
  if (days < 1)    return '<1d';
  if (days < 30)   return Math.round(days) + 'd';
  if (days < 365)  return Math.round(days / 30) + 'mo';
  return Math.round(days / 365) + 'y';
}

// Walk every subject's cards and return the ones that are due, paired with
// the subject they belong to so the UI can label them and we can persist
// back. Demo cards (FLASHCARD_SETS.default) are not included — they're
// onboarding content, not part of the user's actual study queue.
interface DueEntry { card: FlashCard; subjectId: number; }
function srsAllDue(now: number = Date.now()): DueEntry[] {
  const out: DueEntry[] = [];
  for (const subj of S.subjects) {
    if (!subj.cards?.length) continue;
    for (const card of subj.cards) {
      if (srsIsDue(card, now)) out.push({ card, subjectId: subj.id });
    }
  }
  return out;
}

// What the user will actually see in a review session = every due REVIEW
// card (already-seen) plus at most SRS_NEW_PER_SESSION new ones. This is
// the single source of truth — Home tile, sidebar badge, openReviewSession
// all use this number so the user is never told "12 due" then shown 8.
function srsSessionQueue(now: number = Date.now()): DueEntry[] {
  const isNew = (c: FlashCard) => c.interval == null;
  const all   = srsAllDue(now);
  const review = all.filter(d => !isNew(d.card));
  const news   = all.filter(d =>  isNew(d.card)).slice(0, SRS_NEW_PER_SESSION);
  return [...review, ...news];
}

// Count cards rated within the last 24h, across all decks. Used for the
// Stats tile. We anchor to a rolling 24h window rather than "since midnight
// local time" so the number doesn't snap to zero at midnight while the user
// is mid-session.
function srsReviewedToday(now: number = Date.now()): number {
  const cutoff = now - DAY_MS;
  let n = 0;
  for (const subj of S.subjects) {
    if (!subj.cards?.length) continue;
    for (const card of subj.cards) {
      if (card.lastReviewedAt && card.lastReviewedAt >= cutoff) n++;
    }
  }
  return n;
}

// ── Flashcard State ──────────────────────────────────────────────────────────
// `mode` controls the deck source and persistence behavior:
//   'browse' — show every card in a single subject's deck, no scheduling.
//              Mutations are skipped — useful for the demo deck or a
//              user-initiated "just flip through everything" pass.
//   'review' — only due cards. Ratings update SRS state and persist via save().
//   'session' — cross-deck review queue (Home tile entry point).
type FcMode = 'browse' | 'review' | 'session';
const fc: {
  cards:    FlashCard[];
  idx:      number;
  flipped:  boolean;
  scores:   Record<FcRating, number>;
  mode:     FcMode;
  subjectId: number | null;  // null = cross-deck session or demo deck
} = {
  cards: [],
  idx: 0,
  flipped: false,
  scores: { again: 0, hard: 0, good: 0, easy: 0 },
  mode: 'browse',
  subjectId: null,
};

function openFlashcards(subjectId: number, mode: FcMode = 'review'): void {
  const subj = S.subjects.find(s => s.id === subjectId);
  const hasOwn = !!subj?.cards?.length;

  // Pick the deck source. Demo cards always force browse mode — we don't
  // want SRS state attaching itself to module-level constants.
  let set: FlashCard[];
  let realMode: FcMode;
  if (hasOwn) {
    const all = subj!.cards!;
    if (mode === 'review') {
      set = all.filter(c => srsIsDue(c));
      // If nothing's due, gracefully fall back to browse so the user isn't
      // confronted with an empty deck after tapping a subject.
      if (set.length === 0) { set = all; realMode = 'browse'; }
      else                   realMode = 'review';
    } else {
      set = all;
      realMode = 'browse';
    }
  } else {
    set = FLASHCARD_SETS.default!;
    realMode = 'browse';
  }

  fc.cards     = set;          // reference, not clone — so SRS mutates persist
  fc.idx       = 0;
  fc.flipped   = false;
  fc.scores    = { again: 0, hard: 0, good: 0, easy: 0 };
  fc.mode      = realMode;
  fc.subjectId = subjectId;

  showFlashcardModal(subj ? subj.name.toUpperCase() : 'FLASHCARDS');
}

// Cross-deck review — pulls all due cards from every subject and walks
// them in due-time order. Entry point: Home "Due now" tile.
function openReviewSession(): void {
  // srsSessionQueue caps new cards at SRS_NEW_PER_SESSION (default 20). A
  // user with 200 freshly-imported cards sees 20 today, not 200 → no burnout.
  const due = srsSessionQueue();
  if (due.length === 0) {
    showToast('No cards are due right now. Nice!', 'success');
    return;
  }
  // Oldest-due-first so the most overdue cards get cleared first
  due.sort((a, b) => (a.card.dueAt ?? 0) - (b.card.dueAt ?? 0));

  fc.cards     = due.map(d => d.card);  // references — mutating updates the originals
  fc.idx       = 0;
  fc.flipped   = false;
  fc.scores    = { again: 0, hard: 0, good: 0, easy: 0 };
  fc.mode      = 'session';
  fc.subjectId = null;

  showFlashcardModal('REVIEW SESSION');
}

function showFlashcardModal(title: string): void {
  const modal = document.getElementById('flashcardModal');
  if (!modal) return;
  if (!fcModalHTML) fcModalHTML = modal.innerHTML; // capture original structure once
  else modal.innerHTML = fcModalHTML;              // restore if previously replaced
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  const label = document.getElementById('fcSubjectLabel');
  if (label) label.textContent = title;

  renderFC();
}

function closeFlashcards(): void {
  const modal = document.getElementById('flashcardModal');
  if (modal && fcModalHTML) modal.innerHTML = fcModalHTML;
  modal?.classList.remove('open');
  document.body.style.overflow = '';
  // Home shows the "Due now" tile based on srsAllDue() — refresh if we're
  // looking at it so the count updates after a review session.
  if (currentView === 'home') renderHome();
}

function renderFC() {
  const card  = fc.cards[fc.idx];
  const total = fc.cards.length;
  if (!card) return;

  // Reset flip
  fc.flipped = false;
  const fcCard = document.getElementById('fcCard');
  if (fcCard) fcCard.classList.remove('flipped');
  const fcRating = document.getElementById('fcRating');
  if (fcRating) { fcRating.style.display = 'none'; }

  // Text
  const front = document.getElementById('fcFrontText');
  const back  = document.getElementById('fcBackText');
  if (front) front.textContent = card.q;
  if (back)  back.textContent  = card.a;

  // Progress
  const pct = ((fc.idx + 1) / total * 100).toFixed(1);
  const bar = document.getElementById('fcProgressBar');
  if (bar) bar.style.width = pct + '%';
  const lbl = document.getElementById('fcProgressLabel');
  if (lbl) lbl.textContent = `${fc.idx + 1} / ${total}`;

  // Dots
  const dotsEl = document.getElementById('fcDots');
  if (dotsEl) {
    dotsEl.innerHTML = fc.cards.map((_, i) => {
      const color = i < fc.idx ? 'var(--primary)' : i === fc.idx ? 'var(--cyan)' : 'rgba(255,255,255,0.15)';
      return `<div style="width:7px;height:7px;border-radius:50%;background:${color};transition:background 0.3s;"></div>`;
    }).join('');
  }

  // Score counters
  (['again','hard','good','easy'] as FcRating[]).forEach(k => {
    const elId = document.getElementById('fc' + k.charAt(0).toUpperCase() + k.slice(1) + 'Count');
    if (elId) elId.textContent = String(fc.scores[k]);
  });

  // Predicted intervals on rating buttons. Only shown in review/session
  // modes (browse mode hides them entirely).
  if (fc.mode === 'browse') {
    const rating = document.getElementById('fcRating');
    if (rating) rating.setAttribute('data-mode', 'browse');
  } else {
    const rating = document.getElementById('fcRating');
    if (rating) rating.setAttribute('data-mode', 'srs');
    (['again','hard','good','easy'] as FcRating[]).forEach(k => {
      const span = document.getElementById('fcInterval_' + k);
      if (span) span.textContent = srsLabel(srsPreview(card, k));
    });
  }
}

function flipCard() {
  fc.flipped = !fc.flipped;
  const card = document.getElementById('fcCard');
  if (card) card.classList.toggle('flipped', fc.flipped);
  const rating = document.getElementById('fcRating');
  if (rating) rating.style.display = fc.flipped ? 'flex' : 'none';
}

function fcNav(dir: number): void {
  // Only useful in browse mode — review/session modes advance via rateCard.
  if (fc.mode !== 'browse') return;
  fc.idx = Math.max(0, Math.min(fc.cards.length - 1, fc.idx + dir));
  renderFC();
}

function rateCard(rating: FcRating): void {
  fc.scores[rating]++;

  // Browse mode — just advance, no scheduling
  if (fc.mode === 'browse') {
    if (fc.idx < fc.cards.length - 1) { fc.idx++; renderFC(); }
    else                                fcFinishSession();
    return;
  }

  // Review / session mode — schedule + persist
  const current = fc.cards[fc.idx]!;
  const updated = srsSchedule(current, rating);
  // Mutate the card in place so the reference in S.subjects[…].cards
  // sees the same updated values
  Object.assign(current, updated);
  save();

  // "again" cards bubble back to the end of the queue so the user sees
  // them once more this session (until they get a non-"again" rating).
  // Skip the bubble when we're already at the last slot — splicing and
  // pushing would just land the card right back at fc.idx and the user
  // would see the same card again, looking like a broken button. The
  // card's dueAt was set to "now" by srsSchedule, so it'll resurface on
  // the next session anyway.
  const isLast = fc.idx >= fc.cards.length - 1;
  if (rating === 'again' && !isLast) {
    const c = fc.cards.splice(fc.idx, 1)[0]!;
    fc.cards.push(c);
    // idx stays put — the card that was at idx+1 slides into this slot
    renderFC();
    return;
  }

  if (!isLast) { fc.idx++; renderFC(); }
  else          fcFinishSession();
}

function fcFinishSession(): void {
  const { again, hard, good, easy } = fc.scores;
  const total = again + hard + good + easy;
  const accuracy = total ? Math.round(((good + easy) / total) * 100) : 0;
  const modal = document.getElementById('flashcardModal');
  if (!modal) return;
  modal.innerHTML = `
    <div style="max-width:500px;margin:80px auto;text-align:center;">
      <div style="font-size:56px;margin-bottom:20px;">🎉</div>
      <h2 style="font-size:28px;font-weight:900;color:white;margin-bottom:12px;">Session Complete!</h2>
      <p style="font-size:15px;color:var(--muted);margin-bottom:32px;">You reviewed ${total} card${total === 1 ? '' : 's'} · ${accuracy}% accuracy</p>
      <div style="display:flex;gap:12px;justify-content:center;margin-bottom:36px;flex-wrap:wrap;">
        <div style="padding:14px 22px;border-radius:14px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);">
          <div style="font-size:26px;font-weight:900;color:#f87171;">${again}</div>
          <div style="font-size:10px;color:var(--muted);letter-spacing:0.1em;margin-top:4px;">AGAIN</div>
        </div>
        <div style="padding:14px 22px;border-radius:14px;background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.2);">
          <div style="font-size:26px;font-weight:900;color:#fb923c;">${hard}</div>
          <div style="font-size:10px;color:var(--muted);letter-spacing:0.1em;margin-top:4px;">HARD</div>
        </div>
        <div style="padding:14px 22px;border-radius:14px;background:rgba(76,215,246,0.1);border:1px solid rgba(76,215,246,0.2);">
          <div style="font-size:26px;font-weight:900;color:var(--cyan);">${good}</div>
          <div style="font-size:10px;color:var(--muted);letter-spacing:0.1em;margin-top:4px;">GOOD</div>
        </div>
        <div style="padding:14px 22px;border-radius:14px;background:rgba(78,222,163,0.1);border:1px solid rgba(78,222,163,0.2);">
          <div style="font-size:26px;font-weight:900;color:var(--green);">${easy}</div>
          <div style="font-size:10px;color:var(--muted);letter-spacing:0.1em;margin-top:4px;">EASY</div>
        </div>
      </div>
      <button onclick="closeFlashcards()" style="padding:13px 44px;background:linear-gradient(135deg,var(--primary),#6d28d9);border:none;border-radius:12px;color:white;font-size:15px;font-weight:700;cursor:pointer;font-family:'Manrope',sans-serif;box-shadow:0 6px 24px rgba(124,58,237,0.4);">Done</button>
    </div>`;
}

// Keyboard handler for flashcards
document.addEventListener('keydown', e => {
  const modal = document.getElementById('flashcardModal');
  if (!modal?.classList.contains('open')) return;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flipCard(); }
  if (e.key === 'ArrowRight') fcNav(1);
  if (e.key === 'ArrowLeft')  fcNav(-1);
  if (e.key === 'Escape')     closeFlashcards();
});

// ── Sync state machine ──────────────────────────────────────────────────────
// Drives the sidebar chip. Five visible states; the chip text + dot colour
// reflect the current value. State transitions are also logged so the
// "Synced 12s ago" relative timestamp can refresh on a ticker.
type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';
let syncState: SyncState = 'idle';
let lastSyncedAt: number | null = null;
let _pendingSaveTimer: number | undefined;

function setSyncState(next: SyncState): void {
  syncState = next;
  if (next === 'synced') lastSyncedAt = Date.now();
  renderSyncChip();
}

function timeSince(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 5)    return 'just now';
  if (s < 60)   return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60)   return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24)   return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function renderSyncChip(): void {
  const chip = el('syncStatus');
  const txt  = el('syncStatusText');
  if (!chip || !txt) return;

  let label = '';
  switch (syncState) {
    case 'idle':    label = idToken ? 'Idle'      : 'Local only';            break;
    case 'syncing': label = 'Syncing…';                                       break;
    case 'synced':  label = lastSyncedAt ? `Synced ${timeSince(lastSyncedAt)}` : 'Synced'; break;
    case 'error':   label = 'Sync failed — tap to retry';                     break;
    case 'offline': label = 'Offline · saved locally';                        break;
  }
  chip.setAttribute('data-state', syncState);
  txt.textContent = label;
}

// Refresh "Synced Xs ago" text every 15 s without re-firing a sync
window.setInterval(() => {
  if (syncState === 'synced') renderSyncChip();
}, 15000);

// Online / offline events
window.addEventListener('online',  () => { if (syncState === 'offline') setSyncState(idToken ? 'idle' : 'idle'); });
window.addEventListener('offline', () => setSyncState('offline'));

// ── Telemetry ───────────────────────────────────────────────────────────────
// Fire-and-forget POST to /api/log. Used at every silent failure site (sync
// rejected, AI fetch failed, etc.) so the first user to hit a problem
// generates a Cloudflare log entry — we don't have to wait for a bug report.
//
// Invariants:
//   • Never throws. Telemetry breaking the caller would be the worst
//     possible failure mode — it runs inside catch handlers.
//   • Never blocks. Uses sendBeacon when available (survives page unload),
//     falls back to keepalive fetch.
//   • Local-only client throttle: collapses identical events fired within
//     5 s into one, so a runaway retry loop can't flood the endpoint.
const _trackSeen: Record<string, number> = {};
function track(event: string, data?: Record<string, unknown>): void {
  try {
    const key = event + '|' + (data?.['code'] ?? '');
    const now = Date.now();
    if (_trackSeen[key] && now - _trackSeen[key]! < 5000) return;
    _trackSeen[key] = now;

    const payload = JSON.stringify({
      event,
      ...data,
      url: location?.pathname || null,
      ua:  navigator?.userAgent || null,
      v:   (window as any).APP_VERSION || null,
    });

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      // sendBeacon survives page unload and won't be blocked by CSP fetch
      // restrictions in the same way. Returns false if the browser refused;
      // we don't care either way — fire and forget.
      navigator.sendBeacon('/api/log', new Blob([payload], { type: 'application/json' }));
    } else {
      // keepalive lets the request outlive the page; ignore the promise
      fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => { /* swallow — telemetry must never break the caller */ });
    }
  } catch (_) {
    /* swallow everything — telemetry is best-effort */
  }
}

// Catch-all: unhandled promise rejections + uncaught errors. These are the
// bugs we don't know to wrap yet — the kind that show up as a console red
// line and nothing else. The 5-second client-side dedupe in track() keeps
// a tight loop from flooding the endpoint.
window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  const r: any = e.reason;
  track('uncaught.rejection', { code: r?.code, message: r?.message || String(r) });
});
window.addEventListener('error', (e: ErrorEvent) => {
  track('uncaught.error', {
    message: e.message,
    extra: { filename: e.filename, lineno: e.lineno, colno: e.colno },
  });
});

// ── Persistence ─────────────────────────────────────────────────────────────
// Talks to Firestore DIRECTLY via the Web SDK — no server middleman. The
// browser authenticates as the signed-in user, and Firestore rules enforce
// that users can only read/write their own users/{uid} document.

// Tiny helper — returns the user's Firestore doc reference or null if the
// SDK isn't ready / not signed in.
function userDoc(): any | null {
  if (!firebaseUser || typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') return null;
  return firebase.firestore().collection('users').doc(firebaseUser.uid);
}

// Sidebar "Flashcards" link gets a cyan count badge whenever cards are
// due. We re-compute on every save() so the badge stays in sync with the
// SRS state without scattering update calls across every mutation site.
// The CSS attribute selector `.nav-badge[data-count]:not([data-count="0"])`
// handles show/hide — we just set the number.
function renderSidebarBadges(): void {
  const badge = el('sidebarDueBadge');
  if (!badge) return;
  // Single source of truth: the same capped count the user will see when
  // they tap into a review session. Avoids the "badge says 50, session
  // shows 12" mismatch.
  const count = srsSessionQueue().length;
  badge.setAttribute('data-count', String(count));
  badge.textContent = String(count);
}

function save() {
  // Always save locally for instant access
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); } catch(_) {}

  // Sidebar badge — recompute on every state change. Cheap (one walk of
  // S.subjects + one DOM write) and the right semantic: any save() means
  // SRS state could have moved, so refresh the count.
  renderSidebarBadges();

  // Not signed in → no cloud sync to attempt
  if (!firebaseUser) { if (syncState !== 'offline') setSyncState('idle'); return; }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setSyncState('offline');
    return;
  }
  const ref = userDoc();
  if (!ref) { setSyncState('idle'); return; }

  // Debounce so rapid edits collapse into one cloud write
  setSyncState('syncing');
  window.clearTimeout(_pendingSaveTimer);
  _pendingSaveTimer = window.setTimeout(() => {
    ref.set({ state: S, updatedAt: new Date().toISOString() })
      .then(() => setSyncState('synced'))
      .catch((err: any) => { console.error('[sync] save failed', err?.code, err?.message, err); track('sync.save.error', { code: err?.code, message: err?.message }); setSyncState('error'); });
  }, 400);
}

// Manual retry (called when user clicks the chip in error state)
function retrySync(): void {
  if (!firebaseUser) return;
  if (syncState !== 'error') return;
  const ref = userDoc();
  if (!ref) return;
  setSyncState('syncing');
  ref.set({ state: S, updatedAt: new Date().toISOString() })
    .then(() => { setSyncState('synced'); showToast('Synced to cloud', 'success'); })
    .catch((err: any) => { console.error('[sync] retry failed', err?.code, err?.message, err); track('sync.retry.error', { code: err?.code, message: err?.message }); setSyncState('error');  showToast('Still offline. Will retry on next change.', 'warning'); });
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) S = { ...DEFAULT_STATE, ...JSON.parse(raw) };
    else      S = structuredClone(DEFAULT_STATE);
  } catch(_) {
    S = structuredClone(DEFAULT_STATE);
  }
}

// Load state from Firestore (called once after sign-in / on auth restoration)
// ── Cloud state resolution ────────────────────────────────────────────────
// Reconcile cloud state with whatever is local after Firebase auth resolves —
// WITHOUT silently destroying work. Three cases:
//   • cloud empty                  → keep local (a guest who just signed up
//                                    keeps everything; save() pushes it up).
//   • cloud has data, no guest work → load cloud (normal returning user).
//   • cloud has data AND guest work → ASK: merge the guest work in, or use the
//                                    account's data only. Never overwrite silently.

let authResolution: Promise<void> | null = null;  // resolve once; concurrent callers share it
let pendingAuthName: string | null = null;         // name captured at signup time

function hasUserData(st: AppState | null | undefined): boolean {
  if (!st) return false;
  return (st.subjects?.length  || 0) > 0
      || (st.sessions?.length  || 0) > 0
      || (st.tasks?.length     || 0) > 0
      || (st.timetable?.length || 0) > 0;
}

function describeGuestData(st: AppState): string {
  const parts: string[] = [];
  if (st.subjects?.length) parts.push(`${st.subjects.length} subject${st.subjects.length > 1 ? 's' : ''}`);
  const cards = (st.subjects || []).reduce((n, s) => n + (s.cards?.length || 0), 0);
  if (cards)               parts.push(`${cards} flashcard${cards > 1 ? 's' : ''}`);
  if (st.sessions?.length) parts.push(`${st.sessions.length} focus session${st.sessions.length > 1 ? 's' : ''}`);
  if (st.tasks?.length)    parts.push(`${st.tasks.length} task${st.tasks.length > 1 ? 's' : ''}`);
  if (!parts.length) return 'work';
  if (parts.length === 1) return parts[0]!;
  return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
}

// Merge guest state INTO a copy of the cloud state without losing either side.
// Account-level settings (durations, goal, ambient, milestones, tourSeen) stay
// from the cloud; the guest's subjects/cards/documents/sessions/tasks/timetable
// are merged in, with fresh ids allocated to avoid collisions.
function mergeStates(base: AppState, incoming: AppState): AppState {
  const merged: AppState = { ...DEFAULT_STATE, ...base } as AppState;
  let nextId = Math.max(base.nextId || 1, incoming.nextId || 1);
  const alloc = () => nextId++;

  const cardKey = (c: FlashCard) => `${c.q} ${c.a}`;
  const docKey  = (d: Doc)       => `${d.type} ${d.name} ${d.date || ''}`;

  const subjects: Subject[] = (base.subjects || []).map(s => ({ ...s }));
  for (const gs of (incoming.subjects || [])) {
    const match = subjects.find(s => (s.name || '').trim().toLowerCase() === (gs.name || '').trim().toLowerCase());
    if (match) {
      const seenC = new Set((match.cards || []).map(cardKey));
      match.cards = [...(match.cards || [])];
      for (const c of (gs.cards || [])) if (!seenC.has(cardKey(c))) { seenC.add(cardKey(c)); match.cards.push({ ...c }); }
      const seenD = new Set((match.documents || []).map(docKey));
      match.documents = [...(match.documents || [])];
      for (const d of (gs.documents || [])) if (!seenD.has(docKey(d))) { seenD.add(docKey(d)); match.documents!.push({ ...d, id: alloc() }); }
      match.docs = match.documents!.length;
    } else {
      const copy: Subject = { ...gs, id: alloc() };
      if (copy.documents) copy.documents = copy.documents.map(d => ({ ...d, id: alloc() }));
      copy.docs = copy.documents?.length || 0;
      subjects.push(copy);
    }
  }
  merged.subjects = subjects;

  const seenS = new Set<string>();
  merged.sessions = [...(base.sessions || []), ...(incoming.sessions || [])].filter(s => {
    const k = `${s.date} ${s.duration}`; if (seenS.has(k)) return false; seenS.add(k); return true;
  });

  const seenT = new Set<string>();
  merged.tasks = [...(base.tasks || []), ...(incoming.tasks || [])].filter((t: any) => {
    const k = t && t.text != null ? String(t.text) : JSON.stringify(t);
    if (seenT.has(k)) return false; seenT.add(k); return true;
  });

  const seenB = new Set<string>();
  merged.timetable = [...(base.timetable || []), ...(incoming.timetable || [])].filter((b: any) => {
    const k = JSON.stringify([b?.day, b?.start, b?.startMin, b?.title, b?.subjectId]);
    if (seenB.has(k)) return false; seenB.add(k); return true;
  });

  merged.streak     = Math.max(base.streak     || 0, incoming.streak     || 0);
  merged.bestStreak = Math.max(base.bestStreak || 0, incoming.bestStreak || 0);
  merged.nextId     = nextId;
  return merged;
}

// Single entry point for "auth just resolved — decide what S should be." Both
// the auth observer and the explicit sign-in handlers call this; the memoized
// promise guarantees the reconcile (and any merge prompt) runs exactly once,
// and late callers await the same result before navigating.
function resolveStateAfterAuth(user: any, displayName?: string): Promise<void> {
  if (authResolution) {
    // Already resolving/resolved this session (observer re-fired, or the other
    // caller started it). Just keep the token fresh, then share the result.
    return authResolution.then(async () => { try { idToken = await user.getIdToken(); } catch (_) {} });
  }
  authResolution = (async () => {
    firebaseUser = user;
    try { idToken = await user.getIdToken(); } catch (_) {}
    // Refresh the token before it expires (every 55 min).
    setInterval(async () => { if (firebaseUser) idToken = await firebaseUser.getIdToken(true); }, 55 * 60 * 1000);
    setSyncState('syncing');

    const wasGuest     = sessionStorage.getItem('brainfyGuest') === '1';
    const localState   = S;
    const localHasData = hasUserData(localState);

    // Peek the cloud doc.
    let cloudState: AppState | null = null;
    try {
      const ref  = userDoc();
      const snap = ref && await ref.get();
      if (snap && snap.exists) cloudState = (snap.data() || {}).state || null;
    } catch (err: any) {
      console.error('[sync] load failed', err?.code, err?.message);
      track('sync.load.error', { code: err?.code, message: err?.message });
      // Network/rules error — keep local; chip surfaces the error on next save.
    }
    const cloudHasData = hasUserData(cloudState);

    if (cloudHasData && wasGuest && localHasData) {
      const merge = await showConfirm({
        title:        'Bring your guest work along?',
        message:      `This account already has saved data. Merge in the ${describeGuestData(localState)} you created as a guest, or use only your account's data?`,
        confirmLabel: 'Merge guest work',
        cancelLabel:  'Use account only',
      });
      S = merge ? mergeStates(cloudState as AppState, localState) : { ...DEFAULT_STATE, ...(cloudState as AppState) };
    } else if (cloudHasData) {
      S = { ...DEFAULT_STATE, ...(cloudState as AppState) };
    } else {
      // Cloud empty → keep local (guest keeps their work; brand-new user starts clean).
      S = localHasData ? localState : { ...DEFAULT_STATE, ...(cloudState || {}) };
    }

    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); } catch (_) {}
    sessionStorage.removeItem('brainfyGuest');   // authed now, no longer a guest

    const realName = displayName || pendingAuthName || user.displayName || user.email?.split('@')[0] || 'Student';
    pendingAuthName = null;
    S.userName = realName;
    setSigninHint(realName);

    save();                 // push the resolved state to the cloud
    setSyncState('synced');
  })();
  return authResolution;
}

// ── Splash personalisation ──────────────────────────────────────────────────
// If we've remembered a previous sign-in on this device, swap the splash
// CTA from generic "Enter Brainfy" → personalised "Continue as <name>" and
// route it straight to the home view instead of the sign-in form. The
// Firebase auth observer (running in parallel as the SDK lazy-loads) will
// resolve the actual session; if the cached identity is stale, the observer
// will detect it and bounce the user back to splash. Worst case the user
// sees one wrong button click — much better than always forcing a fresh
// "go through sign-in" trip for returning users.
//
// Called from the router whenever splash is shown, so sign-out + account-
// deletion (both navigate to splash) revert the button to generic on the
// same render pass.
function applySigninHint(): void {
  const btn = el('enterBrainBtn');
  if (!btn) return;

  let hint: { name?: string } | null = null;
  try {
    const raw = localStorage.getItem(USER_HINT_KEY);
    if (raw) hint = JSON.parse(raw);
  } catch (_) { /* malformed — treat as no hint */ }

  // Clone-and-replace the node to drop any previously-attached listener so
  // we don't end up with stacked handlers on repeat splash visits.
  const fresh = btn.cloneNode(true) as HTMLElement;
  btn.parentNode?.replaceChild(fresh, btn);

  if (hint?.name) {
    fresh.textContent = `Continue as ${hint.name} →`;
    fresh.addEventListener('click', () => goTo('home'));
  } else {
    fresh.textContent = 'Enter Brainfy →';
    fresh.addEventListener('click', () => goTo('signin'));
  }
}

function setSigninHint(name: string): void {
  try { localStorage.setItem(USER_HINT_KEY, JSON.stringify({ name })); } catch (_) {}
}
function clearSigninHint(): void {
  try { localStorage.removeItem(USER_HINT_KEY); } catch (_) {}
}

// ── Router ──────────────────────────────────────────────────────────────────
function goTo(view: ViewName): void {
  // Smooth exit: fade out current view slightly before switching
  const prevEl = document.querySelector<HTMLElement>('.view.active');
  if (prevEl && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    prevEl.style.transition = 'opacity 0.12s ease, transform 0.12s ease';
    prevEl.style.opacity    = '0';
    prevEl.style.transform  = 'translateY(-6px) scale(0.99)';
  }

  setTimeout(() => {
    // Reset styles in case this view was previously animated
    if (prevEl) { prevEl.style.transition = ''; prevEl.style.opacity = ''; prevEl.style.transform = ''; }
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(view + 'View');
    if (!target) return;
    target.classList.add('active');
    // Scroll to top on view change
    window.scrollTo({ top: 0, behavior: 'instant' });
    _goToFinish(view);
  }, prevEl ? 100 : 0);
}

function _goToFinish(view: ViewName): void {
  currentView = view;

  const isApp = !(['splash', 'signin', 'signup'] as ViewName[]).includes(view);
  document.body.classList.toggle('app-active', isApp);

  document.querySelectorAll<HTMLElement>('[data-go]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset['go'] === view);
  });

  if (view === 'splash')     applySigninHint();
  if (view === 'home')       renderHome();
  if (view === 'focus')      renderFocus();
  if (view === 'library')    renderLibrary();
  if (view === 'flashcards') renderFlashcards();
  if (view === 'stats')      renderStats();
  if (view === 'tasks')      renderTasks();
  if (view === 'timetable')  renderTimetable();
  if (view === 'settings')   renderSettings();

  // Re-trigger stagger animations on stat cards
  if (view === 'home') {
    document.querySelectorAll<HTMLElement>('.hd-stat').forEach(c => {
      c.style.animation = 'none';
      void c.offsetWidth;
      c.style.animation = '';
    });
  }

  save();
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function todayStr(): string { return new Date().toDateString(); }

function todayFocusSec(): number {
  return S.sessions
    .filter(s => new Date(s.date).toDateString() === todayStr())
    .reduce((n, s) => n + s.duration, 0);
}

function calcScore(): number {
  const hrs   = todayFocusSec() / 3600;
  const strk  = Math.min(40, (S.streak || 0) * 3);
  const focus = Math.min(40, hrs * 10);
  const sess  = Math.min(20, S.sessions.filter(s => new Date(s.date).toDateString() === todayStr()).length * 5);
  return Math.round(strk + focus + sess);
}

function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return h + 'h ' + m + 'm';
  if (m > 0) return m + 'm';
  return '<1m';
}

function el(id: string): HTMLElement | null { return document.getElementById(id); }
function elInput(id: string): HTMLInputElement | null { return document.getElementById(id) as HTMLInputElement | null; }
function elSel(id: string): HTMLSelectElement | null { return document.getElementById(id) as HTMLSelectElement | null; }
function elBtn(id: string): HTMLButtonElement | null { return document.getElementById(id) as HTMLButtonElement | null; }

// ── XSS-safe HTML escaper ────────────────────────────────────────────────
// Use this on EVERY piece of user-controlled text that gets interpolated
// into an innerHTML template literal (subject names, task text, doc names,
// flashcard Q/A, AI-generated content, etc.). Without it, a subject named
// `<img src=x onerror=alert(1)>` executes in the page.
function escapeHtml(s: unknown): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}
// Short alias for inline use in templates
const _e = escapeHtml;

// Convert a small markdown subset (## / ### headings, * and - bullet lists,
// **bold**, blank-line paragraphs) to HTML. The input is HTML-escaped FIRST so
// any raw HTML/JS inside the content (AI output OR user-authored notes) is
// inert — only our own generated tags survive. Used for AI summaries and the
// in-app note viewer.
function mdToHtml(md: string): string {
  return _e(md)
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h2>$1</h2>')
    .replace(/^\*\s+(.+)$/gm, '<li>$1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hup])/gm, '<p>')
    .replace(/<p><\/p>/g, '');
}

// ── Icon registry (replaces Material Symbols font) ──────────────────────────
// Lucide-style stroke icons (MIT). Keyed by the old Material Symbols names so
// callers don't have to change. Path bodies only — the icon() helper wraps
// them in a standard <svg> element. Adding a new icon = drop a path here.
const ICONS: Record<string, string> = {
  add:                     '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  add_task:                '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  arrow_back:              '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  article:                 '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
  auto_awesome:            '<path d="M12 3l1.9 5.8H20l-4.9 3.6L17 18l-5-3.6L7 18l1.9-5.6L4 8.8h6.1z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
  auto_stories:            '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  bar_chart:               '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  biotech:                 '<path d="M10 2v7.31"/><path d="M14 9.3V2"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.58 16.5h12.85"/>',
  bolt:                    '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  book:                    '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  calculate:               '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="8" y2="18"/><line x1="12" y1="18" x2="12" y2="18"/><line x1="16" y1="18" x2="16" y2="18"/>',
  calendar_month:          '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  calendar_today:          '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  check:                   '<polyline points="20 6 9 17 4 12"/>',
  check_circle:            '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  checklist:               '<polyline points="9 6 11 8 15 4"/><polyline points="9 12 11 14 15 10"/><polyline points="9 18 11 20 15 16"/><path d="M3 6h2"/><path d="M3 12h2"/><path d="M3 18h2"/>',
  close:                   '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  cloud_off:               '<path d="M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6M5 5a8 8 0 0 0 4 15h9a5 5 0 0 0 1.7-.3"/><line x1="1" y1="1" x2="23" y2="23"/>',
  cloud_upload:            '<path d="M16 16l-4-4-4 4"/><path d="M12 12v9"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/><polyline points="16 16 12 12 8 16"/>',
  delete:                  '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  description:             '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  draft:                   '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  error:                   '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  favorite:                '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  flag:                    '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  forest:                  '<path d="M12 2L3 14h4l-3 6h16l-3-6h4z"/>',
  format_list_bulleted:    '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6"  r="0.8"/><circle cx="3.5" cy="12" r="0.8"/><circle cx="3.5" cy="18" r="0.8"/>',
  format_quote:            '<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2-1 0-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2-1 0-1 .008-1 1.031V20c0 1 0 1 1 1z"/>',
  home:                    '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  info:                    '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  lightbulb:               '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c1 .7 1.5 1.5 1.5 2.3v1a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1c0-.8.5-1.6 1.5-2.3A7 7 0 0 0 12 2z"/>',
  link:                    '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  local_fire_department:   '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  logout:                  '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  menu_book:               '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  monitoring:              '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  music_note:              '<path d="M9 18V5l12-2v13"/><circle cx="6"  cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  play_arrow:              '<polygon points="6 4 20 12 6 20 6 4"/>',
  psychology:              '<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2z"/>',
  quiz:                    '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  refresh:                 '<polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>',
  remove_circle:           '<circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>',
  save:                    '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  schedule:                '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  search:                  '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  send:                    '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  settings:                '<path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/><circle cx="12" cy="12" r="3"/>',
  sticky_note_2:           '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/>',
  style:                   '<polyline points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  timer:                   '<line x1="10" y1="2" x2="14" y2="2"/><line x1="12" y1="14" x2="15" y2="11"/><circle cx="12" cy="14" r="8"/>',
  touch_app:               '<path d="M9 11.24V7.5a2.5 2.5 0 1 1 5 0v3.74"/><path d="M18 14.74V11.5a2.5 2.5 0 1 0-5 0v3.24"/><path d="M14 7.5V3.5a2.5 2.5 0 1 0-5 0v11.74"/><path d="M9 15.5L5.62 14a2 2 0 0 0-2.62 2.27L4.5 22h13l2-7.5"/>',
  trending_up:             '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  tune:                    '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8"  x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8"  x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  upload_file:             '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/>',
  visibility_off:          '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
  warning:                 '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9"  x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  water_drop:              '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
  waves:                   '<path d="M2 6c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
};

interface IconOpts { size?: number; color?: string; cls?: string; style?: string; strokeWidth?: number; }
function icon(name: string, opts: IconOpts = {}): string {
  const body = ICONS[name];
  if (!body) {
    // Fallback: small dot so the spot isn't empty and the missing-name is obvious
    return `<svg width="${opts.size||16}" height="${opts.size||16}" viewBox="0 0 24 24" aria-label="${_e(name)}"><circle cx="12" cy="12" r="3" fill="${opts.color||'currentColor'}"/></svg>`;
  }
  const sz = opts.size ?? 18;
  const sw = opts.strokeWidth ?? 2;
  return `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="${opts.color||'currentColor'}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${opts.cls?` class="${opts.cls}"`:''}${opts.style?` style="${opts.style}"`:''} aria-hidden="true">${body}</svg>`;
}

// Hydrate one <span class="ms">icon_name</span> in-place. Reads the size from
// the element's inline font-size (we set those when we wrote the markup), and
// lets the SVG inherit the color via currentColor.
function hydrateOneIcon(span: HTMLElement): void {
  if (span.dataset['msHydrated'] === '1') return;
  const name = (span.textContent || '').trim();
  if (!name) return;
  if (!ICONS[name]) {
    // Unknown icon — mark hydrated to avoid retry loops; leave text in place
    span.dataset['msHydrated'] = '?';
    return;
  }
  // Pull the size from the inline font-size string (e.g. "18px") so we still
  // know it even though .ms in the stylesheet now hides text via font-size:0.
  const inlineFs = (span.style && span.style.fontSize) ? parseFloat(span.style.fontSize) : NaN;
  const size = Number.isFinite(inlineFs) && inlineFs > 0 ? inlineFs : 18;
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;">${ICONS[name]}</svg>`;
  span.dataset['msHydrated'] = '1';
}

function hydrateIcons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('.ms').forEach(hydrateOneIcon);
}

// Watch the DOM for any newly-inserted .ms spans (innerHTML re-renders in
// renderHome / renderLibrary / etc) and hydrate them automatically.
if (typeof MutationObserver !== 'undefined') {
  const _iconObs = new MutationObserver(mutations => {
    for (const m of mutations) {
      m.addedNodes.forEach(node => {
        if (!(node instanceof HTMLElement)) return;
        if (node.classList && node.classList.contains('ms')) hydrateOneIcon(node);
        if (typeof node.querySelectorAll === 'function') {
          node.querySelectorAll<HTMLElement>('.ms').forEach(hydrateOneIcon);
        }
      });
    }
  });
  // Works whether the script is parse-time loaded OR lazy-injected after
  // DOMContentLoaded has already fired. Without this readyState check the
  // hydration never runs on lazy-load and every static .ms span renders
  // its literal icon name as plain text (psychology, schedule, …).
  const _startHydration = () => {
    hydrateIcons();
    _iconObs.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _startHydration);
  } else {
    _startHydration();
  }
}

// ── Modal helpers (replace native window.confirm / window.prompt) ───────────
// These return Promises so callers can `await` them. The shared modals live
// in index.html with ids #cfmModal and #prmModal. Globally exposed via
// (window as any).cfmDismiss / prmDismiss / prmSubmit at module level so the
// inline button onclicks in the HTML always have something to call.

let _cfmResolver: ((v: boolean) => void) | null = null;
let _prmResolver: ((v: Record<string,string> | null) => void) | null = null;
let _prmFields: { id: string; required?: boolean }[] = [];

interface ConfirmOpts {
  title?:        string;
  message?:      string;
  confirmLabel?: string;
  cancelLabel?:  string;
  dangerous?:    boolean;   // styles confirm button red
}
function showConfirm(opts: ConfirmOpts = {}): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    _cfmResolver = resolve;
    const modal      = el('cfmModal')      as HTMLElement | null;
    const titleEl    = el('cfmTitle')      as HTMLElement | null;
    const msgEl      = el('cfmMessage')    as HTMLElement | null;
    const confirmBtn = el('cfmConfirmBtn') as HTMLElement | null;
    const cancelBtn  = el('cfmCancelBtn')  as HTMLElement | null;
    if (!modal || !titleEl || !msgEl || !confirmBtn || !cancelBtn) { resolve(false); return; }

    titleEl.textContent  = opts.title   || 'Are you sure?';
    msgEl.textContent    = opts.message || '';
    msgEl.style.display  = opts.message ? 'block' : 'none';
    confirmBtn.textContent = opts.confirmLabel || 'Confirm';
    cancelBtn.textContent  = opts.cancelLabel  || 'Cancel';
    confirmBtn.classList.toggle('danger', !!opts.dangerous);

    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('open'));
    setTimeout(() => confirmBtn.focus(), 80);
  });
}
function cfmDismiss(result: boolean): void {
  const modal = el('cfmModal') as HTMLElement | null;
  if (!modal) return;
  modal.classList.remove('open');
  setTimeout(() => { modal.style.display = 'none'; }, 220);
  if (_cfmResolver) { _cfmResolver(result); _cfmResolver = null; }
}

interface PromptField {
  id:           string;        // key in the returned object
  label:        string;        // placeholder text
  defaultValue?: string;
  required?:    boolean;
  type?:        'text' | 'number';
}
interface PromptOpts {
  title?:   string;
  message?: string;
  okLabel?: string;
  fields:   PromptField[];     // 1 or 2 fields
}
function showPrompt(opts: PromptOpts): Promise<Record<string,string> | null> {
  return new Promise<Record<string,string> | null>(resolve => {
    _prmResolver = resolve;
    _prmFields   = opts.fields.map(f => ({ id: f.id, required: f.required }));

    const modal   = el('prmModal')   as HTMLElement | null;
    const titleEl = el('prmTitle')   as HTMLElement | null;
    const msgEl   = el('prmMessage') as HTMLElement | null;
    const f1      = el('prmField1')  as HTMLInputElement | null;
    const f2      = el('prmField2')  as HTMLInputElement | null;
    const okBtn   = el('prmOkBtn')   as HTMLElement | null;
    if (!modal || !titleEl || !msgEl || !f1 || !f2 || !okBtn) { resolve(null); return; }

    titleEl.textContent = opts.title || 'Enter value';
    if (opts.message) {
      msgEl.textContent   = opts.message;
      msgEl.style.display = 'block';
    } else {
      msgEl.style.display = 'none';
    }
    okBtn.textContent = opts.okLabel || 'Save';

    // Field 1 (always present)
    const fOne = opts.fields[0];
    f1.type        = fOne.type === 'number' ? 'number' : 'text';
    f1.placeholder = fOne.label;
    f1.value       = fOne.defaultValue ?? '';

    // Field 2 (optional)
    if (opts.fields[1]) {
      const fTwo = opts.fields[1];
      f2.style.display = 'block';
      f2.type        = fTwo.type === 'number' ? 'number' : 'text';
      f2.placeholder = fTwo.label;
      f2.value       = fTwo.defaultValue ?? '';
    } else {
      f2.style.display = 'none';
      f2.value = '';
    }

    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('open'));
    setTimeout(() => f1.focus(), 80);
  });
}
function prmSubmit(): void {
  const f1 = el('prmField1') as HTMLInputElement | null;
  const f2 = el('prmField2') as HTMLInputElement | null;
  if (!f1) return;
  const out: Record<string,string> = {};
  out[_prmFields[0].id] = f1.value.trim();
  if (_prmFields[1] && f2 && f2.style.display !== 'none') {
    out[_prmFields[1].id] = f2.value.trim();
  }
  // Required check
  for (const f of _prmFields) {
    if (f.required && !out[f.id]) {
      const target = f === _prmFields[0] ? f1 : f2;
      target?.focus();
      target?.classList.add('shake');
      setTimeout(() => target?.classList.remove('shake'), 320);
      return;
    }
  }
  prmDismiss(out);
}
function prmDismiss(result: Record<string,string> | null): void {
  const modal = el('prmModal') as HTMLElement | null;
  if (!modal) return;
  modal.classList.remove('open');
  setTimeout(() => { modal.style.display = 'none'; }, 220);
  if (_prmResolver) { _prmResolver(result); _prmResolver = null; }
}

// Expose at module level so inline onclick handlers in HTML can call them
(window as any).cfmDismiss = cfmDismiss;
(window as any).prmDismiss = prmDismiss;
(window as any).prmSubmit  = prmSubmit;

// Esc closes both modals; Enter submits prompt / confirms confirm
document.addEventListener('keydown', e => {
  const cfm = el('cfmModal');
  const prm = el('prmModal');
  if (cfm && cfm.classList.contains('open')) {
    if (e.key === 'Escape') { e.preventDefault(); cfmDismiss(false); }
    if (e.key === 'Enter')  { e.preventDefault(); cfmDismiss(true);  }
    return;
  }
  if (prm && prm.classList.contains('open')) {
    if (e.key === 'Escape') { e.preventDefault(); prmDismiss(null); }
    if (e.key === 'Enter')  { e.preventDefault(); prmSubmit(); }
  }
});

// ── HOME ────────────────────────────────────────────────────────────────────
function renderHome() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Onboarding card shows until the user has completed all three setup steps
  // (a subject, a doc, and a focus session). When the account is genuinely
  // empty it also takes over the screen, hiding the wall-of-zeros metrics;
  // once there's real data the card just sits above the live dashboard as a
  // progress nudge.
  const hasSubject     = S.subjects.length > 0;
  const hasDoc         = S.subjects.some(s => (s.docs || 0) > 0);
  const hasSession     = S.sessions.length > 0;
  const onboardingDone = hasSubject && hasDoc && hasSession;
  const isEmpty        = !hasSubject && !hasSession;
  renderHomeOnboarding(!onboardingDone, isEmpty);

  // The 3-step onboarding card is now the first-run experience, so the guided
  // tour no longer auto-launches (its spotlight targets — stat cards, goal bar,
  // focus chart — are hidden during the empty-state takeover anyway). The tour
  // remains available on demand via window.startTour().

  // Greeting
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const g = el('homeGreeting');
  if (g) g.textContent = greet + ', ' + S.userName;

  // Streak label
  const sl = el('homeStreakLabel');
  const streak = S.streak || 0;
  if (sl) sl.textContent = streak + ' DAY STREAK';

  // Dynamic subtitle
  const sub = el('homeSubtitle');
  if (sub) {
    const todayMins = Math.round(todayFocusSec() / 60);
    const goal      = S.dailyGoal || 120;
    const pct       = Math.round((todayMins / goal) * 100);
    if (todayMins === 0) {
      sub.textContent = 'Ready for a deep focus session? Your first session starts the streak.';
    } else if (pct >= 100) {
      sub.textContent = `Goal crushed! ${todayMins} min of deep focus today — exceptional work.`;
    } else if (pct >= 60) {
      sub.textContent = `${todayMins} min in — ${goal - todayMins} min left to hit your daily goal. Keep going.`;
    } else {
      sub.textContent = `${todayMins} min focused today. ${goal - todayMins} min left to reach your goal.`;
    }
  }

  // Focus time
  const secs = todayFocusSec();
  const ft = el('homeFocusTime');
  if (ft) ft.textContent = secs > 0 ? fmtTime(secs) : '0m';

  // Sessions today
  const todaySessions = S.sessions.filter(s => new Date(s.date).toDateString() === todayStr());
  const sc = el('homeSessionCount');
  if (sc) sc.textContent = String(todaySessions.length);

  // Streak num
  const sn2 = el('homeStreakNum');
  if (sn2) sn2.textContent = String(streak);

  // ── Score ring + badges ───────────────────────
  const score = calcScore();
  const ringC = 2 * Math.PI * 58;
  const ringOffset = String(ringC * (1 - score / 100));
  const ring = el('focusScoreRing');
  if (ring) ring.setAttribute('stroke-dashoffset', ringOffset);
  const glowRing = el('focusScoreGlow');
  if (glowRing) glowRing.setAttribute('stroke-dashoffset', ringOffset);

  function countUp(elId: string, target: number, duration: number): void {
    const node = el(elId);
    if (!node) return;
    if (reduced) { node.textContent = String(target); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      node.textContent = String(Math.round(eased * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  countUp('focusScoreNum', score, 900);
  countUp('homeScoreStatNum', score, 900);

  // ── Focus trend badge (today vs yesterday) ────
  const trend = el('homeFocusTrend');
  if (trend) {
    const todaySec     = todayFocusSec();
    const yesterdayStr = new Date(Date.now() - 86400000).toDateString();
    const yesterdaySec = S.sessions
      .filter(s => new Date(s.date).toDateString() === yesterdayStr)
      .reduce((n, s) => n + s.duration, 0);
    if (todaySec > 0 && yesterdaySec > 0) {
      const pct = Math.round(((todaySec - yesterdaySec) / yesterdaySec) * 100);
      const up  = pct >= 0;
      trend.textContent        = (up ? '↑ ' : '↓ ') + Math.abs(pct) + '%';
      trend.style.color        = up ? 'var(--green)' : '#f97316';
      trend.style.background   = up ? 'rgba(78,222,163,0.1)' : 'rgba(249,115,22,0.1)';
      trend.style.display      = 'inline';
    } else {
      trend.style.display = 'none';
    }
  }

  // ── Score rank badge ──────────────────────────
  const rankBadge = el('homeScoreRankBadge');
  if (rankBadge) {
    if (score >= 80) {
      rankBadge.textContent = 'EXCELLENT'; rankBadge.style.color = 'var(--cyan)'; rankBadge.style.background = 'rgba(76,215,246,0.1)';
    } else if (score >= 60) {
      rankBadge.textContent = 'GREAT';     rankBadge.style.color = 'var(--green)'; rankBadge.style.background = 'rgba(78,222,163,0.1)';
    } else if (score >= 40) {
      rankBadge.textContent = 'GOOD';      rankBadge.style.color = 'var(--plight)'; rankBadge.style.background = 'rgba(124,58,237,0.12)';
    } else if (score > 0) {
      rankBadge.textContent = 'BUILDING';  rankBadge.style.color = 'var(--muted)'; rankBadge.style.background = 'rgba(255,255,255,0.05)';
    }
    rankBadge.style.display = score > 0 ? 'inline' : 'none';
  }

  // ── Best streak badge ─────────────────────────
  const bestBadge = el('homeStreakBestBadge');
  if (bestBadge) {
    const best = S.bestStreak || 0;
    bestBadge.style.display = best > 0 ? 'inline' : 'none';
    if (best > 0) bestBadge.textContent = 'BEST ' + best;
  }

  // ── Sessions goal badge ───────────────────────
  const sessGoalBadge = el('homeSessionGoalBadge');
  if (sessGoalBadge) {
    const sessGoal = Math.max(1, Math.ceil(S.dailyGoal / (S.focusDuration / 60)));
    const todaySessCount = S.sessions.filter(s => new Date(s.date).toDateString() === todayStr()).length;
    sessGoalBadge.textContent = `GOAL: ${sessGoal}`;
    sessGoalBadge.style.display = 'inline';
    if (todaySessCount >= sessGoal) {
      sessGoalBadge.textContent = 'DONE ✓';
      sessGoalBadge.style.color = 'var(--green)';
    }
  }

  // ── Cognitive state label + tip ───────────────
  const stateLabel = el('homeFocusStateLabel');
  const scoreTip   = el('focusScoreTip');
  type ScoreTier = { label: string; tip: string };
  const tiers: ScoreTier[] = [
    { label: 'Getting Started',  tip: 'Complete your first session to begin building your score.' },
    { label: 'Building Momentum', tip: 'Good start — consistency is key.' },
    { label: 'Focus Mode',        tip: 'Solid effort today. Keep your sessions going.' },
    { label: 'Deep Focus',        tip: 'Strong consistency — you\'re in a great rhythm.' },
    { label: 'Flow State',        tip: 'Peak performance today. Outstanding work.' },
  ];
  const tier = score === 0 ? tiers[0] : score < 25 ? tiers[1] : score < 50 ? tiers[2] : score < 75 ? tiers[3] : tiers[4];
  if (stateLabel) stateLabel.textContent = tier.label;
  if (scoreTip)   scoreTip.textContent   = tier.tip;

  renderFocusTimeChart();
  renderHomeDueCards();
  renderHomeSubjects();
  renderHomeTasks();
  renderHomeQuote();
  renderGoalProgress();
}

// Onboarding card lifecycle:
//   showCard  — display the 3-step "Get Started" card (until all steps done).
//   takeover  — also hide the metrics dashboard (only when truly empty, so a
//               brand-new user isn't staring at a wall of zeros). Once there's
//               real data the card just sits above the live dashboard.
function renderHomeOnboarding(showCard: boolean, takeover: boolean): void {
  const card  = el('homeOnboarding');
  const stats = el('homeStatsGrid');
  const goal  = el('homeGoalBar');
  const main  = el('homeMainGrid');
  if (!card) return;

  card.style.display = showCard ? 'block' : 'none';
  if (stats) stats.style.display = takeover ? 'none' : 'grid';
  if (goal)  goal.style.display  = takeover ? 'none' : 'flex';
  if (main)  main.style.display  = takeover ? 'none' : 'grid';

  if (!showCard) return;

  // Mark completed steps with a check so the card doubles as a progress tracker.
  const hasSubject = S.subjects.length > 0;
  const hasDoc     = S.subjects.some(s => (s.docs || 0) > 0);
  const hasSession = S.sessions.length > 0;
  el('onbStep1')?.classList.toggle('is-done', hasSubject);
  el('onbStep2')?.classList.toggle('is-done', hasDoc);
  el('onbStep3')?.classList.toggle('is-done', hasSession);

  // Adapt the heading once they're partway through.
  const heading = el('onbHeading');
  if (heading) {
    const remaining = [hasSubject, hasDoc, hasSession].filter(d => !d).length;
    heading.textContent = remaining === 3
      ? 'Three steps to your first study session'
      : `Almost there — ${remaining} step${remaining === 1 ? '' : 's'} left to set up Brainfy`;
  }
}

function renderGoalProgress() {
  const goal    = S.dailyGoal || 120;           // minutes
  const doneSec = todayFocusSec();
  const doneMin = Math.round(doneSec / 60);
  const pct     = Math.min(100, (doneMin / goal) * 100);

  const bar  = el('goalProgressBar');
  const txt  = el('goalProgressText');
  const badge = el('goalBadge');
  if (!bar || !txt) return;

  bar.style.width = pct + '%';
  txt.textContent = `${doneMin} / ${goal} min`;

  if (pct >= 100) {
    bar.style.background = 'linear-gradient(90deg,var(--green),#22c55e)';
    if (badge) { badge.textContent = '🎉 DONE'; badge.style.color = 'var(--green)'; badge.style.borderColor = 'rgba(78,222,163,0.3)'; }
  } else if (pct >= 60) {
    if (badge) { badge.textContent = 'ON TRACK'; badge.style.color = 'var(--cyan)'; badge.style.borderColor = 'rgba(76,215,246,0.25)'; }
  } else {
    if (badge) { badge.textContent = 'START NOW'; badge.style.color = 'var(--muted)'; }
  }
}

async function promptGoal() {
  const cur = S.dailyGoal || 120;
  const res = await showPrompt({
    title:   'Daily focus goal',
    message: 'Total focus minutes per day. Tip: also editable in Settings.',
    okLabel: 'Save',
    fields:  [{ id: 'goal', label: 'Minutes', type: 'number', defaultValue: String(cur), required: true }],
  });
  const parsed = parseInt(res?.['goal'] ?? '', 10);
  if (!isNaN(parsed) && parsed > 0) {
    S.dailyGoal = Math.max(5, Math.min(1440, parsed));
    save();
    renderGoalProgress();
    showToast(`Daily goal set to ${S.dailyGoal} minutes`, 'success');
  }
}

function renderFocusTimeChart() {
  const chart  = el('focusTimeChart');
  const labels = el('focusTimeLabels');
  if (!chart) return;

  const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const now = new Date();
  const todayDow = (now.getDay() + 6) % 7; // 0=Mon

  const data = dayNames.map((name, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - ((todayDow - i + 7) % 7));
    const secs = S.sessions
      .filter(s => new Date(s.date).toDateString() === d.toDateString())
      .reduce((n, s) => n + s.duration, 0);
    return { name, hrs: secs / 3600, isToday: i === todayDow };
  });

  const maxH = Math.max(...data.map(d => d.hrs), 1);

  chart.innerHTML = data.map((d, i) => {
    const h = Math.max(4, (d.hrs / maxH) * 100);
    const bg = d.isToday
      ? 'var(--cyan);box-shadow:0 0 14px rgba(76,215,246,0.5)'
      : 'rgba(124,58,237,0.38)';
    const delay = `animation-delay:${0.05 + i * 0.06}s`;
    return `<div class="chart-bar" style="flex:1;height:${h}%;background:${bg};border-radius:5px 5px 0 0;min-height:4px;${delay};"></div>`;
  }).join('');

  if (labels) {
    labels.innerHTML = data.map(d => {
      const c = d.isToday ? 'color:var(--cyan);font-weight:700' : 'color:var(--muted)';
      const n = d.isToday ? 'TODAY' : d.name.toUpperCase();
      return `<span style="font-size:10px;letter-spacing:0.08em;${c}">${n}</span>`;
    }).join('');
  }
}

// Show / hide the "Due now" tile based on the live srsSessionQueue() count.
// Called from renderHome and after closeFlashcards() so the count updates
// the moment a session finishes. Same capped count as the sidebar badge
// and the review session itself.
function renderHomeDueCards() {
  const tile  = el('homeDueCard');
  if (!tile) return;
  const due   = srsSessionQueue();
  const count = due.length;
  if (count === 0) {
    tile.style.display = 'none';
    return;
  }
  tile.style.display = 'flex';
  const num = el('homeDueCount');
  const plr = el('homeDuePlural');
  if (num) num.textContent = String(count);
  if (plr) plr.textContent = count === 1 ? '' : 's';
}

function renderHomeSubjects() {
  const c = el('homeSubjectCards');
  if (!c) return;
  const recent = [...S.subjects].sort((a,b) => b.accessed - a.accessed).slice(0, 4);
  if (!recent.length) {
    c.innerHTML = '<p style="color:var(--muted);font-size:13px;grid-column:span 2;">No subjects yet — add some in the Library.</p>';
    return;
  }
  c.innerHTML = recent.map(s => {
    const subjSessions = S.sessions.filter(x => x.subjectId === s.id);
    const subjMins     = Math.round(subjSessions.reduce((n, x) => n + x.duration, 0) / 60);
    const timeLabel    = subjMins >= 60 ? `${Math.floor(subjMins/60)}h ${subjMins % 60}m` : subjMins > 0 ? `${subjMins}m` : null;
    const metaLabel    = timeLabel
      ? `${timeLabel} · ${subjSessions.length} session${subjSessions.length !== 1 ? 's' : ''}`
      : subjSessions.length > 0
        ? `${subjSessions.length} session${subjSessions.length !== 1 ? 's' : ''}`
        : 'Not started yet';
    const progressPct  = Math.min(100, (subjSessions.length / 10) * 100);
    return `
    <div class="subj-card" data-id="${s.id}" onclick="startSubject(${s.id})"
      onmouseenter="this.style.borderColor='${s.color}55';this.style.boxShadow='0 8px 32px ${s.color}22'"
      onmouseleave="this.style.borderColor='';this.style.boxShadow=''">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
        <div style="width:34px;height:34px;border-radius:9px;background:${s.color}20;border:1px solid ${s.color}35;display:flex;align-items:center;justify-content:center;">
          <span class="ms" style="font-size:17px;color:${s.color};">menu_book</span>
        </div>
        <span style="font-size:10px;letter-spacing:0.06em;color:var(--muted);font-family:'Space Grotesk';padding:3px 8px;background:rgba(255,255,255,0.04);border-radius:6px;border:1px solid rgba(255,255,255,0.07);">${metaLabel}</span>
      </div>
      <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:var(--text);">${_e(s.name)}</div>
      <div style="font-size:12px;color:var(--muted);line-height:1.4;margin-bottom:14px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${_e(s.desc)}</div>
      <div style="height:3px;background:rgba(255,255,255,0.07);border-radius:2px;overflow:hidden;">
        <div style="width:${progressPct}%;height:100%;background:${s.color};border-radius:2px;transition:width 0.6s ease;opacity:0.85;"></div>
      </div>
    </div>
  `}).join('');
}

function startSubject(id: number): void {
  timer.subjectId = id;
  const s = S.subjects.find(x => x.id === id);
  if (s) s.accessed = Date.now();
  save();
  goTo('focus');
}

function renderHomeTasks() {
  const list = el('homeTasksList');
  if (!list) return;
  // Update task count badge
  const done = S.tasks.filter(t => t.done).length;
  const badge = el('taskCountBadge');
  if (badge) badge.textContent = `${done} done`;
  const visible = S.tasks.filter(t => !t.done).slice(0, 5);
  if (!visible.length) {
    list.innerHTML = '<p style="font-size:13px;color:var(--muted);text-align:center;padding:12px 0;">All done! 🎉</p>';
    return;
  }
  list.innerHTML = visible.map(t => `
    <div class="task-row">
      <input type="checkbox" data-id="${t.id}" ${t.done ? 'checked' : ''}>
      <span style="font-size:13px;flex:1;${t.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${_e(t.text)}</span>
    </div>
  `).join('');

  list.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = +(cb.dataset['id'] ?? '');
      const t = S.tasks.find(x => x.id === id);
      if (t) { t.done = cb.checked; save(); renderHomeTasks(); if (currentView === 'tasks') renderTasks(); }
    });
  });
}

function renderLearningMap() {
  const map = el('learningMap');
  if (!map) return;
  const subjects = S.subjects.slice(0, 6);
  if (!subjects.length) {
    map.innerHTML = '<p style="text-align:center;color:var(--muted);padding:40px 0;font-size:13px;">Add subjects to see your learning map</p>';
    return;
  }

  const w = map.offsetWidth || 580, h = 150;
  const cx = w / 2, cy = h / 2 - 10;
  const r = Math.min(cx, cy) * 0.65;

  const nodes = subjects.map((s, i) => {
    const angle = (i / subjects.length) * Math.PI * 2 - Math.PI / 2;
    return { ...s, x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  });

  const lines = nodes.map(n =>
    `<line x1="${cx}" y1="${cy}" x2="${n.x}" y2="${n.y}" stroke="rgba(124,58,237,0.18)" stroke-width="1"/>`
  ).join('');

  const circles = nodes.map(n => `
    <g>
      <circle cx="${n.x}" cy="${n.y}" r="9" fill="${n.color}" opacity="0.85"/>
      <text x="${n.x}" y="${n.y + 22}" text-anchor="middle" fill="#64748b" font-size="10" font-family="Manrope,sans-serif">${_e(n.name.split(' ')[0])}</text>
    </g>
  `).join('');

  const hub = `<circle cx="${cx}" cy="${cy}" r="11" fill="var(--primary)"/>
    <text x="${cx}" y="${cy+5}" text-anchor="middle" fill="white" font-size="12" font-family="Manrope">⚡</text>`;

  map.innerHTML = `<svg width="100%" height="${h}">${lines}${hub}${circles}</svg>`;
}

// ── FOCUS ────────────────────────────────────────────────────────────────────
function renderFocus() {
  const idle   = el('focusIdleContent');
  const active = el('focusActiveLayout');
  if (!idle || !active) return;

  const isActive = timer.running || timer.timeLeft < timer.totalTime;
  document.body.classList.toggle('focus-active', isActive);

  if (isActive) {
    renderFocusActive();
  } else {
    // Populate subject select
    const sel = el('focusSubjectSelect');
    if (sel) {
      sel.innerHTML = '<option value="" style="background:#0d1628;">Select a subject...</option>'
        + S.subjects.map(s => `<option value="${s.id}" style="background:#0d1628;" ${s.id === timer.subjectId ? 'selected' : ''}>${_e(s.name)}</option>`).join('');
    }
    // Reset preset buttons
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active-preset'));
    const def = document.querySelector(`.preset-btn[data-focus="${Math.round(S.focusDuration/60)}"]`);
    if (def) def.classList.add('active-preset');
  }
}

function renderFocusActive() {
  updateTimerDisplay();
  renderAmbient();
  syncAmbient();   // resume any active ambient sounds
  renderMilestones();
  renderQuote();

  const ti = el('focusTitle');
  const ts = el('focusSubtitle');
  if (ti) ti.textContent = timer.intent || 'Focus Session';
  if (ts) {
    const s = S.subjects.find(x => x.id === timer.subjectId);
    ts.textContent = s ? 'Deep Work: ' + s.name : 'Deep Work';
  }

  const notes = el('quickNotesInput') as HTMLTextAreaElement | null;
  if (notes) notes.value = S.sessionNotes;
}

function renderAmbient() {
  const list = el('ambientList');
  if (!list) return;

  const sounds: { key: AmbientKey; label: string; icon: string; color: string; bg: string }[] = [
    { key:'lofi',   label:'Lo-Fi Beats',   icon:'music_note',      color:'var(--plight)',  bg:'rgba(124,58,237,0.12)' },
    { key:'rain',   label:'Rain Shower',   icon:'water_drop',      color:'var(--cyan)',    bg:'rgba(76,215,246,0.1)'  },
    { key:'forest', label:'Forest Wind',   icon:'forest',          color:'var(--green)',   bg:'rgba(78,222,163,0.1)'  },
    { key:'white',  label:'White Noise',   icon:'waves',           color:'#94a3b8',        bg:'rgba(148,163,184,0.08)'},
  ];

  list.innerHTML = sounds.map(s => {
    const v      = S.ambient[s.key] || 0;
    const active = v > 0;
    return `
      <div style="margin-bottom:10px;">
        <button class="amb-btn ${active ? 'playing' : ''}" data-amb="${s.key}" title="Toggle ${s.label}">
          <div class="amb-btn-icon" style="background:${active ? s.bg : 'rgba(255,255,255,0.05)'};">
            <span class="ms" style="font-size:15px;color:${active ? s.color : 'var(--muted)'};">${s.icon}</span>
          </div>
          <span style="flex:1;">${s.label}</span>
          <span style="font-size:11px;font-family:'Space Grotesk';font-weight:600;color:${active ? s.color : 'var(--muted2)'};">${active ? v+'%' : 'OFF'}</span>
        </button>
        ${active ? `
          <div style="padding:6px 12px 0;">
            <input type="range" min="5" max="100" value="${v}" data-sound="${s.key}"
              style="width:100%;accent-color:${s.color};">
          </div>` : ''}
      </div>
    `;
  }).join('');

  // Toggle on button click
  list.querySelectorAll<HTMLElement>('.amb-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const k = (btn as HTMLElement).dataset['amb'] as AmbientKey;
      if ((S.ambient[k] || 0) > 0) {
        S.ambient[k] = 0;
        stopAmbientKey(k);
      } else {
        S.ambient[k] = 65;
        startAmbientKey(k, 65);
      }
      save(); renderAmbient();
    });
  });

  // Volume slider
  list.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(sl => {
    sl.addEventListener('input', e => {
      e.stopPropagation();
      const k = sl.dataset['sound'] as AmbientKey;
      const v = +sl.value;
      S.ambient[k] = v;
      setAmbientVol(k, v);
      save();
    });
    sl.addEventListener('click', e => e.stopPropagation());
  });
}

function renderMilestones() {
  const list = el('milestonesList');
  if (!list) return;
  if (!S.milestones.length) {
    list.innerHTML = '<p style="font-size:12px;color:var(--muted);">No milestones yet.</p>';
    return;
  }
  list.innerHTML = S.milestones.map(m => `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:9px;background:${m.done ? 'rgba(124,58,237,0.14)' : 'rgba(255,255,255,0.03)'};border-left:${m.done ? '2px solid var(--primary)' : '2px solid transparent'};">
      <input type="checkbox" data-id="${m.id}" ${m.done ? 'checked' : ''} style="accent-color:var(--primary);width:14px;height:14px;cursor:pointer;margin-top:2px;flex-shrink:0;">
      <div>
        <div style="font-size:12px;font-weight:600;${m.done ? 'text-decoration:line-through;color:var(--muted)' : 'color:var(--text)'}">${_e(m.text)}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px;">${m.done ? 'Completed' : 'Next milestone'}</div>
      </div>
    </div>
  `).join('');

  list.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const m = S.milestones.find(x => x.id === +(cb.dataset['id'] ?? ''));
      if (m) { m.done = cb.checked; save(); renderMilestones(); }
    });
  });
}

function renderQuote() {
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  const t = el('quoteText');
  const a = el('quoteAuthor');
  if (t) t.textContent = q.t;
  if (a) a.textContent = '— ' + q.a.toUpperCase();
}

// Dashboard quote — deterministic per hour (every user sees the same quote
// during a given UTC hour, communal feel). Self-perpetuating: each render
// schedules its own next refresh at the top of the next hour, so a user
// who leaves the dashboard open for hours still sees fresh quotes. Clearing
// the existing timer first keeps repeated renders idempotent.
let homeQuoteTimer: ReturnType<typeof setTimeout> | null = null;
function renderHomeQuote(): void {
  const idx = Math.floor(Date.now() / 3_600_000) % QUOTES.length;
  const q   = QUOTES[idx];
  const t   = el('dailyQuoteText');
  const a   = el('dailyQuoteAuthor');
  if (t) t.textContent = q.t;
  if (a) a.textContent = '— ' + q.a.toUpperCase();
  if (homeQuoteTimer) clearTimeout(homeQuoteTimer);
  // +50ms cushion so we definitely land in the next hour bucket.
  const msToNextHour = 3_600_000 - (Date.now() % 3_600_000) + 50;
  homeQuoteTimer = setTimeout(renderHomeQuote, msToNextHour);
}

// ── TIMER ENGINE ─────────────────────────────────────────────────────────────
function updateTimerDisplay() {
  const m = Math.floor(timer.timeLeft / 60);
  const s = timer.timeLeft % 60;
  const disp = el('timerDisplay');
  if (disp) disp.textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');

  const ring = el('timerRing');
  if (ring) {
    const pct = timer.timeLeft / timer.totalTime;
    ring.setAttribute('stroke-dashoffset', String(TIMER_C * (1 - pct)));
    ring.setAttribute('stroke', timer.mode === 'break' ? 'var(--green)' : 'var(--cyan)');
  }

  const lbl = el('timerLabel');
  if (lbl) lbl.textContent = timer.mode === 'break' ? 'BREAK' : 'REMAINING';
}

function setTimerBtn(running: boolean): void {
  const icon = el('playPauseIcon');
  if (!icon) return;
  if (running) {
    icon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    (icon as unknown as SVGElement).setAttribute('viewBox', '0 0 24 24');
  } else {
    icon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
    (icon as unknown as SVGElement).setAttribute('viewBox', '0 0 24 24');
  }
}

function startTimer() {
  if (timer.interval) return;
  timer.running = true;
  document.body.classList.add('timer-running');
  setTimerBtn(true);
  timer.interval = setInterval(() => {
    timer.timeLeft = Math.max(0, timer.timeLeft - 1);
    updateTimerDisplay();
    if (timer.timeLeft === 0) {
      clearInterval(timer.interval!);
      timer.interval = undefined;
      timer.running  = false;
      setTimerBtn(false);
      if (timer.mode === 'focus') logSession();
      // Flash green
      const disp = el('timerDisplay');
      if (disp) { disp.style.color = 'var(--green)'; setTimeout(() => { disp.style.color = 'white'; }, 2500); }
      // Auto switch mode
      if (timer.mode === 'focus') {
        timer.mode = 'break';
        timer.totalTime = S.breakDuration;
        timer.timeLeft  = S.breakDuration;
      } else {
        timer.mode = 'focus';
        timer.totalTime = S.focusDuration;
        timer.timeLeft  = S.focusDuration;
      }
      updateTimerDisplay();
    }
  }, 1000);
}

function pauseTimer() {
  clearInterval(timer.interval);
  timer.interval = undefined;
  timer.running  = false;
  document.body.classList.remove('timer-running');
  setTimerBtn(false);
}

function resetTimer() {
  pauseTimer();
  timer.timeLeft  = timer.totalTime;
  updateTimerDisplay();
}

function skipTimer() {
  if (timer.mode === 'focus') logSession();
  pauseTimer();
  timer.mode      = timer.mode === 'focus' ? 'break' : 'focus';
  timer.totalTime = timer.mode === 'focus' ? S.focusDuration : S.breakDuration;
  timer.timeLeft  = timer.totalTime;
  updateTimerDisplay();
}

function logSession() {
  const dur = timer.totalTime - timer.timeLeft;
  if (dur < 30) return;
  S.sessions.push({ date: new Date().toISOString(), duration: dur, subjectId: timer.subjectId });
  if (timer.subjectId) {
    const s = S.subjects.find(x => x.id === timer.subjectId);
    // Mark the subject recently-accessed. Do NOT touch s.docs here — it tracks
    // document count (derived from s.documents.length in addDocToSubject/
    // deleteDoc/saveAIResults). Bumping it per session inflated the Library doc
    // counts + the stats donut and falsely completed the onboarding
    // "add a document" step (which checks s.docs > 0).
    if (s) s.accessed = Date.now();
  }

  // ── Update streak ──────────────────────────────
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  // Sessions before the one we just added
  const prev = S.sessions.slice(0, -1);
  const hadToday     = prev.some(s => new Date(s.date).toDateString() === today);
  const hadYesterday = prev.some(s => new Date(s.date).toDateString() === yesterday);

  if (!hadToday) {
    // First session of this day
    S.streak = hadYesterday ? (S.streak || 0) + 1 : 1;
    S.bestStreak = Math.max(S.bestStreak || 0, S.streak);
  }

  save();
  if (currentView === 'home') renderGoalProgress();
}

function beginFocusSession(): void {
  const intentEl = el('focusIntentInput') as HTMLInputElement | null;
  const subjEl   = el('focusSubjectSelect') as HTMLSelectElement | null;
  timer.intent    = intentEl?.value?.trim() || 'Focus Session';
  timer.subjectId = subjEl?.value ? +subjEl.value : null;
  timer.mode      = 'focus';
  timer.totalTime = S.focusDuration;
  timer.timeLeft  = S.focusDuration;

  if (!S.milestones.length) {
    S.milestones = [
      { id: S.nextId++, text: 'Complete reading', done: false },
      { id: S.nextId++, text: 'Take notes',       done: false },
    ];
  }
  save();
  document.body.classList.add('focus-active');
  renderFocusActive();
  startTimer();
}

async function exitFocusSession() {
  const ok = await showConfirm({
    title:        'End this focus session?',
    message:      'Your time so far will be logged.',
    confirmLabel: 'End session',
  });
  if (!ok) return;
  logSession();
  pauseTimer();
  timer.timeLeft  = S.focusDuration;
  timer.totalTime = S.focusDuration;
  timer.mode      = 'focus';
  S.milestones    = [];
  save();
  document.body.classList.remove('focus-active');
  renderFocus();
  updateTimerDisplay();
}

// ── LIBRARY ──────────────────────────────────────────────────────────────────
// ── Document helpers ─────────────────────────────
function docIcon(type: Doc['type']): string {
  if (type === 'note') return 'sticky_note_2';
  if (type === 'link') return 'link';
  return 'draft';
}

function docSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ── FLASHCARDS VIEW ─────────────────────────────────────────────────────────
// Top-level view that lists every subject as a deck card. Click "Review" on
// a deck → opens the existing flashcard modal (openFlashcards(subjectId)).
function renderFlashcards(): void {
  const strip = el('fcStatStrip');
  const list  = el('fcDeckList');
  if (!strip || !list) return;

  // Build decks list: prefer subject.cards, fall back to the built-in default
  // deck so a brand-new user has at least one set to try.
  const decks = S.subjects
    .map(s => ({
      id:    s.id,
      name:  s.name,
      desc:  s.desc || '',
      color: s.color,
      count: (s.cards && s.cards.length) ? s.cards.length : 0,
    }))
    .filter(d => d.count > 0);

  // Always offer the bundled starter deck (8 study-science cards) so the
  // view never feels empty — labelled clearly so it's not mistaken for user data
  const starterCount = (FLASHCARD_SETS.default || []).length;

  // Stat strip — total decks, total cards, starter cards
  const totalCards = decks.reduce((n, d) => n + d.count, 0);
  strip.innerHTML = `
    <div style="border-radius:14px;padding:14px 16px;background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.18);">
      <div style="font-size:22px;font-weight:800;color:var(--plight);letter-spacing:-0.03em;line-height:1;">${decks.length}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:4px;font-family:'Space Grotesk';letter-spacing:0.08em;font-weight:600;">YOUR DECKS</div>
    </div>
    <div style="border-radius:14px;padding:14px 16px;background:rgba(76,215,246,0.06);border:1px solid rgba(76,215,246,0.16);">
      <div style="font-size:22px;font-weight:800;color:var(--cyan);letter-spacing:-0.03em;line-height:1;">${totalCards}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:4px;font-family:'Space Grotesk';letter-spacing:0.08em;font-weight:600;">TOTAL CARDS</div>
    </div>
    <div style="border-radius:14px;padding:14px 16px;background:rgba(78,222,163,0.06);border:1px solid rgba(78,222,163,0.16);">
      <div style="font-size:22px;font-weight:800;color:var(--green);letter-spacing:-0.03em;line-height:1;">${starterCount}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:4px;font-family:'Space Grotesk';letter-spacing:0.08em;font-weight:600;">STARTER DECK</div>
    </div>`;

  // Deck cards
  const deckCards = decks.map(d => `
    <div class="fc-deck" style="border-radius:16px;padding:18px 18px 14px;background:rgba(7,15,31,0.55);border:1px solid ${d.color}33;backdrop-filter:blur(20px);cursor:pointer;transition:transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;"
      onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 28px ${d.color}33';this.style.borderColor='${d.color}66';"
      onmouseout="this.style.transform='';this.style.boxShadow='';this.style.borderColor='${d.color}33';"
      onclick="openFlashcards(${d.id})">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;">
        <div style="width:38px;height:38px;border-radius:11px;background:${d.color}1f;border:1px solid ${d.color}40;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          ${icon('style', { size: 18, color: d.color })}
        </div>
        <span style="font-family:'Space Grotesk';font-size:10px;color:${d.color};font-weight:700;letter-spacing:0.06em;">${d.count} CARD${d.count !== 1 ? 'S' : ''}</span>
      </div>
      <div style="font-size:15px;font-weight:700;color:var(--text);letter-spacing:-0.01em;line-height:1.25;margin-bottom:4px;">${_e(d.name)}</div>
      <div style="font-size:12px;color:var(--muted);line-height:1.45;min-height:34px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${_e(d.desc || 'Study deck')}</div>
      <button type="button" onclick="event.stopPropagation();openFlashcards(${d.id})"
        style="margin-top:14px;width:100%;padding:9px;background:${d.color}22;border:1px solid ${d.color}45;border-radius:10px;color:${d.color};font-family:'Manrope',sans-serif;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:-0.005em;transition:background 0.15s;"
        onmouseover="this.style.background='${d.color}36';" onmouseout="this.style.background='${d.color}22';">
        Review deck →
      </button>
    </div>
  `).join('');

  // Bundled starter deck — always present
  const starterCard = `
    <div class="fc-deck" style="border-radius:16px;padding:18px 18px 14px;background:rgba(7,15,31,0.55);border:1px solid rgba(78,222,163,0.25);backdrop-filter:blur(20px);cursor:pointer;transition:transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;"
      onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 28px rgba(78,222,163,0.22)';this.style.borderColor='rgba(78,222,163,0.5)';"
      onmouseout="this.style.transform='';this.style.boxShadow='';this.style.borderColor='rgba(78,222,163,0.25)';"
      onclick="openFlashcards(-1)">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;">
        <div style="width:38px;height:38px;border-radius:11px;background:rgba(78,222,163,0.12);border:1px solid rgba(78,222,163,0.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          ${icon('lightbulb', { size: 18, color: 'var(--green)' })}
        </div>
        <span style="font-family:'Space Grotesk';font-size:10px;color:var(--green);font-weight:700;letter-spacing:0.06em;">${starterCount} CARDS</span>
      </div>
      <div style="font-size:15px;font-weight:700;color:var(--text);letter-spacing:-0.01em;line-height:1.25;margin-bottom:4px;">Study Science Starter</div>
      <div style="font-size:12px;color:var(--muted);line-height:1.45;min-height:34px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">Spaced repetition, active recall, the Feynman technique — the core study-science vocabulary every learner should know.</div>
      <button type="button" onclick="event.stopPropagation();openFlashcards(-1)"
        style="margin-top:14px;width:100%;padding:9px;background:rgba(78,222,163,0.14);border:1px solid rgba(78,222,163,0.32);border-radius:10px;color:var(--green);font-family:'Manrope',sans-serif;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:-0.005em;transition:background 0.15s;"
        onmouseover="this.style.background='rgba(78,222,163,0.24)';" onmouseout="this.style.background='rgba(78,222,163,0.14)';">
        Review deck →
      </button>
    </div>
  `;

  if (decks.length === 0) {
    // Empty state for user decks
    list.innerHTML = `
      ${starterCard}
      <div style="grid-column:1/-1;text-align:center;padding:48px 24px;background:rgba(7,15,31,0.4);border:1px dashed var(--border);border-radius:16px;">
        <div style="font-size:14px;color:var(--text);font-weight:600;margin-bottom:6px;">No personal decks yet</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.55;max-width:360px;margin:0 auto;">Add a subject in the Library and write notes — Brainfy AI auto-generates flashcards from them. Or paste notes into the AI tutor and pick "Import as flashcards".</div>
        <button type="button" onclick="goTo('library')"
          style="margin-top:14px;padding:9px 18px;background:var(--primary);border:none;border-radius:10px;color:white;font-family:'Manrope',sans-serif;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:-0.005em;">
          Open Library
        </button>
      </div>`;
  } else {
    list.innerHTML = starterCard + deckCards;
  }
}

function renderLibrary() {
  const grid   = el('libraryGrid');
  const search = (elInput('libSearchInput')?.value ?? '').toLowerCase();
  if (!grid) return;

  const filtered = S.subjects.filter(s =>
    !search || s.name.toLowerCase().includes(search) || s.desc.toLowerCase().includes(search)
  );

  grid.innerHTML = `
    <div onclick="showAddSubject()" style="min-height:200px;border-radius:14px;border:2px dashed rgba(255,255,255,0.1);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;cursor:pointer;transition:border-color 0.2s;padding:24px;"
      onmouseover="this.style.borderColor='rgba(124,58,237,0.4)'"
      onmouseout="this.style.borderColor='rgba(255,255,255,0.1)'">
      <div style="width:44px;height:44px;background:rgba(124,58,237,0.12);border-radius:50%;display:flex;align-items:center;justify-content:center;">
        <span class="ms" style="color:var(--plight);">add</span>
      </div>
      <div style="font-weight:600;font-size:14px;color:var(--text);">New Subject</div>
    </div>
    ${filtered.map(s => {
      const docs = s.documents || [];
      const previewDocs = docs.slice(0, 3);
      return `
      <div class="subj-card" style="min-height:200px;position:relative;display:flex;flex-direction:column;" onclick="startSubject(${s.id})">
        <!-- Header -->
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;">
          <div style="width:44px;height:44px;background:${s.color}20;border-radius:12px;display:flex;align-items:center;justify-content:center;border:1px solid ${s.color}30;">
            <span class="ms" style="font-size:24px;color:${s.color};">menu_book</span>
          </div>
          <button onclick="event.stopPropagation();deleteSubject(${s.id})"
            style="background:transparent;border:none;color:rgba(255,255,255,0.18);cursor:pointer;padding:4px;line-height:1;display:flex;align-items:center;"
            onmouseover="this.style.color='#f87171'" onmouseout="this.style.color='rgba(255,255,255,0.18)'">
            <span class="ms" style="font-size:16px;">close</span>
          </button>
        </div>
        <!-- Title + desc -->
        <div style="font-weight:700;font-size:15px;margin-bottom:5px;">${_e(s.name)}</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:12px;flex:1;">${_e(s.desc)}</div>

        <!-- Documents section -->
        <div style="border-top:1px solid rgba(255,255,255,0.07);padding-top:12px;margin-bottom:10px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <span style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:var(--muted);font-family:'Space Grotesk';">DOCUMENTS · ${docs.length}</span>
            <button id="addDocBtn_${s.id}" onclick="event.stopPropagation();openAIImportPicker(${s.id}, this)"
              style="display:flex;align-items:center;gap:4px;background:rgba(124,58,237,0.12);border:1px solid rgba(124,58,237,0.25);border-radius:6px;color:var(--plight);font-size:11px;font-weight:600;cursor:pointer;padding:3px 8px;font-family:'Manrope',sans-serif;transition:background 0.15s;"
              onmouseover="this.style.background='rgba(124,58,237,0.22)'" onmouseout="this.style.background='rgba(124,58,237,0.12)'">
              <span class="ms" style="font-size:14px;">add</span> Add
            </button>
          </div>
          ${docs.length === 0 ? `
            <p style="font-size:11px;color:var(--muted);text-align:center;padding:8px 0;opacity:0.6;">No documents yet</p>
          ` : `
            <div style="display:flex;flex-direction:column;gap:4px;">
              ${previewDocs.map(d => `
                <div onclick="event.stopPropagation();openDoc(${s.id},${d.id})"
                  style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);cursor:pointer;transition:background 0.15s;group"
                  onmouseover="this.style.background='rgba(255,255,255,0.07)'" onmouseout="this.style.background='rgba(255,255,255,0.03)'">
                  <span class="ms" style="font-size:15px;color:${s.color};flex-shrink:0;">${docIcon(d.type)}</span>
                  <span style="font-size:12px;font-weight:500;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_e(d.name)}</span>
                  ${canSummarize(d) ? `
                  <button onclick="event.stopPropagation();generateSummaryForDoc(${s.id},${d.id})" title="Generate AI summary" aria-label="Generate AI summary"
                    style="background:transparent;border:none;color:rgba(255,255,255,0.35);cursor:pointer;padding:2px;display:flex;align-items:center;flex-shrink:0;"
                    onmouseover="this.style.color='var(--plight)'" onmouseout="this.style.color='rgba(255,255,255,0.35)'">
                    <span class="ms" style="font-size:14px;${d.id === summarizingDocId ? 'animation:beamSpin 0.9s linear infinite;' : ''}">${d.id === summarizingDocId ? 'refresh' : 'auto_awesome'}</span>
                  </button>` : ''}
                  <button onclick="event.stopPropagation();deleteDoc(${s.id},${d.id})" aria-label="Delete document"
                    style="background:transparent;border:none;color:rgba(255,255,255,0.2);cursor:pointer;padding:2px;display:flex;align-items:center;flex-shrink:0;"
                    onmouseover="this.style.color='#f87171'" onmouseout="this.style.color='rgba(255,255,255,0.2)'">
                    <span class="ms" style="font-size:13px;">close</span>
                  </button>
                </div>
              `).join('')}
              ${docs.length > 3 ? `<p style="font-size:11px;color:var(--muted);text-align:center;padding:4px 0;cursor:pointer;" onclick="event.stopPropagation();openDocModal(${s.id})">+${docs.length - 3} more</p>` : ''}
            </div>
          `}
        </div>

        <!-- Flashcards button -->
        <button onclick="event.stopPropagation();openFlashcards(${s.id})"
          style="width:100%;padding:8px;border-radius:8px;background:${s.color}18;border:1px solid ${s.color}35;color:${s.color};font-size:12px;font-weight:600;cursor:pointer;font-family:'Manrope',sans-serif;display:flex;align-items:center;justify-content:center;gap:6px;transition:all 0.15s;"
          onmouseover="this.style.background='${s.color}28'" onmouseout="this.style.background='${s.color}18'">
          <span class="ms" style="font-size:15px;">style</span> Review Flashcards
        </button>
      </div>
    `}).join('')}
  `;
}

// ── Doc modal state ──────────────────────────────
let docModalSubjId: number | null = null;
let docModalTab: 'file' | 'note' | 'link' = 'file';

function openDocModal(subjId: number): void {
  docModalSubjId = subjId;
  docModalTab = 'file';
  const s = S.subjects.find(x => x.id === subjId);
  if (!s) return;
  const modal = el('docModal');
  const title = el('docModalTitle');
  if (title) title.textContent = s.name;
  renderDocModal();
  if (modal) { modal.style.display = 'flex'; requestAnimationFrame(() => modal.classList.add('open')); }
  document.body.style.overflow = 'hidden';
}

function closeDocModal(): void {
  const modal = el('docModal');
  if (!modal) return;
  modal.classList.remove('open');
  setTimeout(() => { modal.style.display = 'none'; }, 220);
  document.body.style.overflow = '';
  docModalSubjId = null;
}

// ── FOOTER MODAL ─────────────────────────────────────────────────────────────

const FOOTER_CONTENT: Record<string, { title: string; html: string }> = {
  privacy: {
    title: 'Privacy Policy',
    html: `
      <p>Last updated: May 2026</p>
      <h3>What we collect</h3>
      <p>Brainfy collects only what you give us: your name, email address, and the study data you create (subjects, flashcards, sessions, tasks). No tracking pixels, no ad networks.</p>
      <h3>How we use it</h3>
      <p>Your data is used solely to power your personal study experience — syncing across devices via Firebase and generating AI summaries via the LLM you've configured. We never sell or share your data with third parties.</p>
      <h3>Data storage</h3>
      <p>Study data is stored in Firebase Firestore under your user ID. It is encrypted at rest and in transit. You can delete your account at any time and all associated data will be removed.</p>
      <h3>AI processing</h3>
      <p>When you use AI import features, document content is sent to the configured LLM provider (Groq or Anthropic) for processing. Please review their respective privacy policies for how they handle inference data.</p>
      <h3>Contact</h3>
      <p>Questions? Email us at <a href="mailto:help@brainfy.online">help@brainfy.online</a></p>
    `,
  },
  terms: {
    title: 'Terms of Service',
    html: `
      <p>Last updated: May 2026</p>
      <h3>Use of the service</h3>
      <p>Brainfy is a personal productivity and study tool. You may use it for lawful educational purposes. You may not use it to process or store content that infringes copyright, is harmful, or violates any applicable law.</p>
      <h3>Your content</h3>
      <p>You retain full ownership of any notes, flashcards, and documents you create. By storing them with Brainfy you grant us a limited licence to process them solely for the purpose of providing the service to you.</p>
      <h3>AI features</h3>
      <p>AI-generated summaries and flashcards are provided as study aids. Always verify important information from authoritative sources. We are not responsible for inaccuracies in AI output.</p>
      <h3>Availability</h3>
      <p>We aim for high availability but do not guarantee uninterrupted service. We reserve the right to modify or discontinue features with reasonable notice.</p>
      <h3>Limitation of liability</h3>
      <p>Brainfy is provided "as is". To the maximum extent permitted by law we are not liable for any indirect, incidental, or consequential damages arising from use of the service.</p>
      <h3>Contact</h3>
      <p>Questions? Email <a href="mailto:help@brainfy.online">help@brainfy.online</a></p>
    `,
  },
};

function openFooterLink(page: string): void {
  if (page === 'privacy') {
    window.open('/privacy.html', '_blank', 'noopener');
    return;
  }
  if (page === 'terms') {
    window.open('/terms.html', '_blank', 'noopener');
    return;
  }
  if (page === 'community') {
    window.open('https://github.com/Aihan-7/brainfy', '_blank', 'noopener');
    return;
  }
  if (page === 'contact') {
    window.location.href = 'mailto:help@brainfy.online';
    return;
  }
  const data = FOOTER_CONTENT[page];
  if (!data) return;
  const modal = el('footerModal');
  const title = el('footerModalTitle');
  const body  = el('footerModalBody');
  if (!modal || !title || !body) return;
  title.textContent = data.title;
  body.innerHTML    = data.html;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => modal.classList.add('open'));
}

function closeFooterModal(): void {
  const modal = el('footerModal') as HTMLElement;
  if (!modal) return;
  modal.classList.remove('open');
  setTimeout(() => { modal.style.display = 'none'; }, 220);
  document.body.style.overflow = '';
}

// Allow Escape key to close footer modal
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') closeFooterModal();
});

function setDocTab(tab: 'file' | 'note' | 'link'): void {
  docModalTab = tab;
  renderDocModal();
}

function renderDocModal(): void {
  const body = el('docModalBody');
  if (!body) return;

  const tabs: { key: 'file' | 'note' | 'link'; label: string; icon: string }[] = [
    { key: 'file', label: 'File', icon: 'upload_file' },
    { key: 'note', label: 'Note', icon: 'sticky_note_2' },
    { key: 'link', label: 'Link', icon: 'link' },
  ];

  body.innerHTML = `
    <!-- Tabs -->
    <div style="display:flex;gap:6px;margin-bottom:20px;">
      ${tabs.map(t => `
        <button onclick="setDocTab('${t.key}')"
          style="flex:1;padding:8px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:'Manrope',sans-serif;transition:all 0.15s;
            ${docModalTab === t.key
              ? 'background:rgba(124,58,237,0.2);border:1px solid rgba(124,58,237,0.4);color:var(--plight);'
              : 'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--muted);'}
          display:flex;align-items:center;justify-content:center;gap:6px;">
          <span class="ms" style="font-size:16px;">${t.icon}</span>${t.label}
        </button>
      `).join('')}
    </div>

    ${docModalTab === 'file' ? `
      <!-- File upload -->
      <div id="docDropZone"
        style="border:2px dashed rgba(255,255,255,0.12);border-radius:12px;padding:32px;text-align:center;cursor:pointer;transition:border-color 0.2s,background 0.2s;"
        onclick="el('docFileInput').click()"
        ondragover="event.preventDefault();this.style.borderColor='rgba(124,58,237,0.5)';this.style.background='rgba(124,58,237,0.06)'"
        ondragleave="this.style.borderColor='rgba(255,255,255,0.12)';this.style.background=''"
        ondrop="event.preventDefault();this.style.borderColor='rgba(255,255,255,0.12)';this.style.background='';handleDocDrop(event)">
        <span class="ms" style="font-size:40px;color:var(--plight);display:block;margin-bottom:10px;">cloud_upload</span>
        <div style="font-weight:600;font-size:14px;margin-bottom:6px;">Drop files here or click to browse</div>
        <div style="font-size:12px;color:var(--muted);">PDF, images, text, video — up to 1 GB</div>
      </div>
      <input type="file" id="docFileInput" style="display:none;" multiple accept="*/*" onchange="handleDocFileSelect(this)">
      <div id="docFilePreview" style="margin-top:12px;display:flex;flex-direction:column;gap:6px;"></div>
    ` : docModalTab === 'note' ? `
      <!-- Note -->
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--muted);letter-spacing:0.06em;display:block;margin-bottom:6px;">TITLE</label>
          <input id="docNoteTitle" type="text" placeholder="e.g. Chapter 3 Summary" class="auth-input" style="background:rgba(255,255,255,0.05);">
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--muted);letter-spacing:0.06em;display:block;margin-bottom:6px;">CONTENT</label>
          <textarea id="docNoteContent" placeholder="Write your notes here..." class="auth-input" style="height:140px;resize:vertical;background:rgba(255,255,255,0.05);"></textarea>
        </div>
        <button onclick="saveDocNote()" class="btn-primary" style="padding:10px;font-size:14px;border-radius:10px;">Save Note</button>
      </div>
    ` : `
      <!-- Link -->
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--muted);letter-spacing:0.06em;display:block;margin-bottom:6px;">LABEL</label>
          <input id="docLinkLabel" type="text" placeholder="e.g. Khan Academy Video" class="auth-input" style="background:rgba(255,255,255,0.05);">
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--muted);letter-spacing:0.06em;display:block;margin-bottom:6px;">URL</label>
          <input id="docLinkUrl" type="url" placeholder="https://..." class="auth-input" style="background:rgba(255,255,255,0.05);">
        </div>
        <button onclick="saveDocLink()" class="btn-primary" style="padding:10px;font-size:14px;border-radius:10px;">Save Link</button>
      </div>
    `}

    <!-- Existing docs list -->
    ${(() => {
      if (docModalSubjId === null) return '';
      const s = S.subjects.find(x => x.id === docModalSubjId);
      const docs = s?.documents || [];
      if (!docs.length) return '';
      return `
        <div style="margin-top:20px;border-top:1px solid rgba(255,255,255,0.07);padding-top:16px;">
          <p style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:var(--muted);font-family:'Space Grotesk';margin-bottom:10px;">ALL DOCUMENTS · ${docs.length}</p>
          <div style="display:flex;flex-direction:column;gap:5px;">
            ${docs.map(d => `
              <div onclick="openDoc(${docModalSubjId},${d.id})"
                style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:9px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);cursor:pointer;transition:background 0.15s;"
                onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='rgba(255,255,255,0.04)'">
                <span class="ms" style="font-size:17px;color:var(--plight);flex-shrink:0;">${docIcon(d.type)}</span>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_e(d.name)}</div>
                  <div style="font-size:10px;color:var(--muted);">${d.type.toUpperCase()}${d.size ? ' · ' + docSize(d.size) : ''} · ${timeAgo(d.date)}</div>
                </div>
                ${canSummarize(d) ? `
                <button onclick="event.stopPropagation();generateSummaryForDoc(${docModalSubjId},${d.id})" title="Generate AI summary" aria-label="Generate AI summary"
                  style="background:transparent;border:none;color:rgba(255,255,255,0.4);cursor:pointer;padding:4px;display:flex;align-items:center;"
                  onmouseover="this.style.color='var(--plight)'" onmouseout="this.style.color='rgba(255,255,255,0.4)'">
                  <span class="ms" style="font-size:16px;${d.id === summarizingDocId ? 'animation:beamSpin 0.9s linear infinite;' : ''}">${d.id === summarizingDocId ? 'refresh' : 'auto_awesome'}</span>
                </button>` : ''}
                <button onclick="event.stopPropagation();deleteDoc(${docModalSubjId},${d.id});renderDocModal()" aria-label="Delete document"
                  style="background:transparent;border:none;color:rgba(255,255,255,0.2);cursor:pointer;padding:4px;display:flex;align-items:center;"
                  onmouseover="this.style.color='#f87171'" onmouseout="this.style.color='rgba(255,255,255,0.2)'">
                  <span class="ms" style="font-size:15px;">delete</span>
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    })()}
  `;
}

function handleDocFileSelect(input: HTMLInputElement): void {
  const files = Array.from(input.files || []);
  files.forEach(file => readAndAddDoc(file));
  input.value = '';
}

function handleDocDrop(e: DragEvent): void {
  const files = Array.from(e.dataTransfer?.files || []);
  files.forEach(file => readAndAddDoc(file));
}

// Two-tier upload strategy:
//   • Files < 200 KB stay inline as base64 (instant, no Storage round-trip, works offline)
//   • Files ≥ 200 KB go to Firebase Storage with resumable upload + progress UI
//   • Hard cap: 1 GB
const DOC_INLINE_MAX  = 200 * 1024;            // 200 KB
const DOC_HARD_MAX    = 1024 * 1024 * 1024;    // 1 GB

function readAndAddDoc(file: File): void {
  if (docModalSubjId === null) return;

  if (file.size > DOC_HARD_MAX) {
    showToast(`${file.name} is too large (max 1 GB)`, 'warning');
    return;
  }

  // Small file → keep inline as base64 (current behaviour)
  if (file.size < DOC_INLINE_MAX) {
    const reader = new FileReader();
    reader.onload = () => {
      addDocToSubject({
        id:      S.nextId++,
        name:    file.name,
        type:    'file',
        content: reader.result as string,
        mime:    file.type,
        size:    file.size,
        date:    Date.now(),
      });
    };
    reader.readAsDataURL(file);
    return;
  }

  // Large file → Firebase Storage. Requires sign-in.
  if (!firebaseUser) {
    showToast('Please sign in to upload files larger than 200 KB', 'warning');
    return;
  }
  if (typeof firebase.storage !== 'function') {
    showToast('Storage SDK not loaded — refresh the page', 'error');
    return;
  }

  uploadFileToStorage(file, docModalSubjId);
}

function uploadFileToStorage(file: File, subjectId: number): void {
  const uid       = firebaseUser.uid;
  const safeName  = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  const path      = `users/${uid}/docs/${subjectId}/${Date.now()}-${safeName}`;
  const storageRef = firebase.storage().ref(path);

  const task = storageRef.put(file, {
    contentType:    file.type || 'application/octet-stream',
    customMetadata: { originalName: file.name },
  });

  const prog = showUploadToast(file.name);

  task.on('state_changed',
    (snap: any) => {
      const pct = snap.totalBytes ? (snap.bytesTransferred / snap.totalBytes) * 100 : 0;
      prog.update(pct);
    },
    (err: any) => {
      prog.dismiss();
      const msg = err?.code === 'storage/unauthorized'
        ? 'Upload blocked: enable Storage rules for signed-in users'
        : (err?.message || 'Upload failed');
      showToast(msg, 'error');
    },
    async () => {
      try {
        const downloadURL = await task.snapshot.ref.getDownloadURL();
        prog.dismiss();
        addDocToSubject({
          id:          S.nextId++,
          name:        file.name,
          type:        'file',
          content:     '',                  // empty for Storage-backed
          mime:        file.type,
          size:        file.size,
          date:        Date.now(),
          storagePath: path,
          downloadURL: downloadURL,
        }, subjectId);                      // bind to the subject id captured at upload start
      } catch (e: any) {
        prog.dismiss();
        showToast(`Could not finalise upload: ${e?.message || e}`, 'error');
      }
    }
  );
}

// Persistent progress toast: one bar + label + cancel.
// Stacks vertically if multiple uploads run concurrently.
interface UploadProgress {
  update: (pct: number) => void;
  dismiss: () => void;
}
function showUploadToast(fileName: string): UploadProgress {
  const toast = document.createElement('div');
  toast.style.cssText = [
    'position:relative','margin-bottom:8px','min-width:300px','max-width:380px',
    'background:rgba(7,15,31,0.96)','border:1px solid rgba(124,58,237,0.4)',
    'border-radius:12px','padding:13px 18px',
    'color:var(--text)','font-size:13px',
    'backdrop-filter:blur(16px)',
    'box-shadow:0 8px 28px rgba(0,0,0,0.5)',
    'display:flex','flex-direction:column','gap:8px',
    'font-family:Manrope,sans-serif',
    'animation:toastSpringIn 0.28s cubic-bezier(0.34,1.2,0.64,1) both',
  ].join(';');

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;';
  const nameEl = document.createElement('div');
  nameEl.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;font-size:13px;';
  nameEl.textContent = `Uploading ${fileName}`;
  const pctEl = document.createElement('div');
  pctEl.style.cssText = 'font-family:Space Grotesk,monospace;font-size:11px;color:var(--plight);font-weight:700;letter-spacing:0.04em;flex-shrink:0;';
  pctEl.textContent = '0%';
  header.appendChild(nameEl);
  header.appendChild(pctEl);
  toast.appendChild(header);

  const barWrap = document.createElement('div');
  barWrap.style.cssText = 'height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;';
  const bar = document.createElement('div');
  bar.style.cssText = 'height:100%;background:linear-gradient(90deg,var(--primary),var(--cyan));border-radius:2px;width:0%;transition:width 0.18s linear;';
  barWrap.appendChild(bar);
  toast.appendChild(barWrap);

  // Lazily-created stack container so multiple uploads stack neatly bottom-right
  let stack = document.getElementById('brainfy-upload-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'brainfy-upload-stack';
    stack.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;';
    document.body.appendChild(stack);
  }
  stack.appendChild(toast);

  return {
    update: (pct: number) => {
      const clamped = Math.max(0, Math.min(100, pct));
      bar.style.width = clamped + '%';
      pctEl.textContent = clamped.toFixed(0) + '%';
    },
    dismiss: () => {
      toast.style.transition = 'opacity 0.25s, transform 0.25s';
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => {
        toast.remove();
        if (stack && stack.children.length === 0) stack.remove();
      }, 280);
    },
  };
}

function saveDocNote(): void {
  const title   = (elInput('docNoteTitle')?.value ?? '').trim();
  const content = (document.getElementById('docNoteContent') as HTMLTextAreaElement | null)?.value.trim() ?? '';
  if (!title) { showToast('Please enter a title', 'warning'); return; }
  addDocToSubject({ id: S.nextId++, name: title, type: 'note', content, date: Date.now() });
}

function saveDocLink(): void {
  const label = (elInput('docLinkLabel')?.value ?? '').trim();
  const url   = (elInput('docLinkUrl')?.value ?? '').trim();
  if (!label || !url) { showToast('Please enter both a label and URL', 'warning'); return; }
  const name = label || url;
  addDocToSubject({ id: S.nextId++, name, type: 'link', content: url, date: Date.now() });
}

// Add a Doc to a subject. If subjectIdOverride is omitted, uses the currently-
// open doc modal's subject (legacy callers). Long-running uploads should pass
// the explicit subject id they captured at upload start, since the modal may
// have been closed or switched by the time the upload completes.
function addDocToSubject(doc: Doc, subjectIdOverride?: number): void {
  const targetId = subjectIdOverride ?? docModalSubjId;
  if (targetId == null) return;
  const s = S.subjects.find(x => x.id === targetId);
  if (!s) return;
  if (!s.documents) s.documents = [];
  s.documents.unshift(doc);
  s.docs = s.documents.length;
  save();
  // Only refresh the modal if it's still showing the same subject
  if (docModalSubjId === targetId) renderDocModal();
  renderLibrary();
  showToast(`"${doc.name}" added`, 'success');
}

// ── Generate a summary from an already-saved document ────────────────
// Lets the user produce (or re-produce) the AI summary after the import
// modal has been closed. We can only summarise docs that carry readable
// content: AI-imported files/links keep their text in `aiText`, image files
// are summarised via vision (the data URL in `content`), and notes are text
// already. Generated "AI Summary" notes are excluded so they don't recurse.
let summarizingDocId: number | null = null;

function canSummarize(d: Doc): boolean {
  if (d.name.startsWith('AI Summary')) return false;
  if (d.type === 'note') return !!d.content;
  if (d.type === 'link') return !!d.aiText;
  if (d.type === 'file') return !!d.aiText || (d.mime || '').startsWith('image/');
  return false;
}

async function generateSummaryForDoc(subjId: number, docId: number): Promise<void> {
  if (summarizingDocId !== null) return;  // one at a time
  const s = S.subjects.find(x => x.id === subjId);
  const d = s?.documents?.find(x => x.id === docId);
  if (!s || !d) return;

  // Build the summary-mode payload from whatever the doc carries.
  let payload: Record<string, unknown> | null = null;
  const isImage = d.type === 'file' && (d.mime || '').startsWith('image/');
  if (isImage && d.content) {
    const b64 = d.content.replace(/^data:[^;]+;base64,/, '');
    payload = { contentType: 'image', title: d.name, subjName: s.name, image: { b64, mime: d.mime || 'image/png' }, mode: 'summary' };
  } else if (d.aiText) {
    payload = { contentType: d.type === 'link' ? 'youtube' : 'file', title: d.name, subjName: s.name, content: d.aiText, mode: 'summary' };
  } else if (d.type === 'note') {
    payload = { contentType: 'file', title: d.name, subjName: s.name, content: d.content, mode: 'summary' };
  }
  if (!payload) { showToast('No readable text in this document to summarize', 'warning'); return; }

  summarizingDocId = docId;
  renderLibrary();
  if (docModalSubjId === subjId) renderDocModal();
  showToast('Generating summary…', 'info');
  try {
    const res = await fetch('/api/process-content', {
      method: 'POST', headers: await aiHeaders(), body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Summary generation failed');
    const summary = (result.summary || '').trim();
    if (!summary) throw new Error('Empty summary returned');
    // Saved as a note doc — it then shows in the docs list and opens in the
    // existing note viewer. addDocToSubject re-renders + toasts on its own.
    const noteName = (`AI Summary — ${d.name}`).slice(0, 80);
    addDocToSubject({ id: S.nextId++, name: noteName, type: 'note', content: summary, date: Date.now() }, subjId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    track('ai.summary.error', { message: msg });
    showToast('Error: ' + msg, 'error');
  } finally {
    summarizingDocId = null;
    renderLibrary();
    if (docModalSubjId === subjId) renderDocModal();
  }
}

function deleteDoc(subjId: number, docId: number): void {
  const s = S.subjects.find(x => x.id === subjId);
  if (!s) return;
  const target = (s.documents || []).find(d => d.id === docId);

  // If file lives in Firebase Storage, delete the object too (fire-and-forget).
  // We don't block UI removal on this; even if it fails the local ref is gone.
  if (target?.storagePath && firebaseUser && typeof firebase.storage === 'function') {
    firebase.storage().ref(target.storagePath).delete().catch(() => {});
  }

  s.documents = (s.documents || []).filter(d => d.id !== docId);
  s.docs = s.documents.length;
  save();
  renderLibrary();
}

// Render a note (including AI-generated summaries) inline in the shared footer
// modal instead of spawning a new browser tab. Content is markdown-rendered via
// mdToHtml, which HTML-escapes first so note text can't inject markup/JS.
function openNoteViewer(name: string, content: string): void {
  const modal = el('footerModal');
  const title = el('footerModalTitle');
  const body  = el('footerModalBody');
  if (!modal || !title || !body) return;
  title.textContent = name;
  body.innerHTML = `<div class="ai-summary">${mdToHtml(content)}</div>`;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => modal.classList.add('open'));
}

function openDoc(subjId: number, docId: number): void {
  const s = S.subjects.find(x => x.id === subjId);
  const d = s?.documents?.find(x => x.id === docId);
  if (!d) return;
  if (d.type === 'link') {
    window.open(d.content, '_blank', 'noopener');
  } else if (d.type === 'note') {
    openNoteViewer(d.name, d.content);
  } else {
    // File — open in a new tab. Two cases:
    //   • Storage-backed (downloadURL set) → cross-origin URL, just navigate
    //   • Legacy inline base64 (data URI in d.content)
    const href = d.downloadURL || d.content;
    if (!href) { showToast('File missing — not available locally', 'warning'); return; }

    // For viewable types (images, PDFs) open in a tab; otherwise force download.
    const viewable = /^image\//.test(d.mime || '') || (d.mime || '') === 'application/pdf';
    if (viewable) {
      window.open(href, '_blank', 'noopener');
    } else {
      const a = document.createElement('a');
      a.href     = href;
      a.download = d.name;
      a.target   = '_blank';
      a.rel      = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }
}

async function showAddSubject() {
  const res = await showPrompt({
    title:   'New subject',
    okLabel: 'Create',
    fields:  [
      { id: 'name', label: 'Subject name (e.g. Physics)', required: true },
      { id: 'desc', label: 'Brief description (optional)' },
    ],
  });
  if (!res?.['name']) return;
  S.subjects.push({
    id:       S.nextId++,
    name:     res['name'],
    desc:     res['desc'] || '',
    docs:     0,
    color:    SUBJECT_COLORS[S.subjects.length % SUBJECT_COLORS.length],
    accessed: Date.now(),
  });
  save();
  renderLibrary();
  showToast(`Created "${res['name']}"`, 'success');
}

async function deleteSubject(id: number): Promise<void> {
  const subj = S.subjects.find(s => s.id === id);
  const ok = await showConfirm({
    title:        'Remove subject?',
    message:      subj ? `"${subj.name}" and all its notes will be removed from this device.` : 'This subject will be removed.',
    confirmLabel: 'Remove',
    dangerous:    true,
  });
  if (!ok) return;
  S.subjects = S.subjects.filter(s => s.id !== id);
  save();
  renderLibrary();
}

// ══════════════════════════════════════════════════
//  AI IMPORT — file & YouTube → flashcards + notes
// ══════════════════════════════════════════════════

interface AIImportResult {
  flashcards: { q: string; a: string }[];
  summary:    string;   // empty until the user generates it on the summary tab
  outline:    string[];
}

let aiImportSubjId: number | null = null;
let aiImportSource: 'file' | 'youtube' | null = null;
let aiImportResult: AIImportResult | null = null;
let aiImportResultTab: 'flashcards' | 'summary' | 'outline' = 'flashcards';
// Source payload kept around after study-mode processing so the summary can be
// generated lazily (same content, mode:'summary') when the user asks for it.
let aiImportSourcePayload: Record<string, unknown> | null = null;
let aiSummaryLoading = false;

// ── Picker popup ─────────────────────────────────
function openAIImportPicker(subjId: number, anchorEl: HTMLElement): void {
  aiImportSubjId = subjId;
  const picker   = el('aiImportPicker');
  if (!picker) return;

  // Close if already open for same button
  if (picker.classList.contains('open')) { closeAIImportPicker(); return; }

  const rect = anchorEl.getBoundingClientRect();
  picker.style.top  = (rect.bottom + 8 + window.scrollY) + 'px';
  picker.style.left = Math.min(rect.left, window.innerWidth - 240) + 'px';
  picker.classList.add('open');

  // Click-outside to close
  setTimeout(() => {
    document.addEventListener('click', handlePickerOutside, { once: true, capture: true });
  }, 10);
}

function handlePickerOutside(e: MouseEvent): void {
  const picker = el('aiImportPicker');
  if (picker && !picker.contains(e.target as Node)) closeAIImportPicker();
}

function closeAIImportPicker(): void {
  const picker = el('aiImportPicker');
  if (!picker) return;
  picker.style.animation = 'none';
  picker.style.opacity   = '0';
  picker.style.transform = 'scale(0.9) translateY(-6px)';
  picker.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
  setTimeout(() => {
    picker.classList.remove('open');
    picker.style.cssText = '';
  }, 160);
}

// ── Modal open/close ─────────────────────────────
function startAIImport(source: 'file' | 'youtube'): void {
  closeAIImportPicker();
  aiImportSource = source;
  aiImportResult = null;
  aiImportSourcePayload = null;
  aiSummaryLoading = false;
  const s      = S.subjects.find(x => x.id === aiImportSubjId);
  const nameEl = el('aiImportSubjName');
  if (nameEl && s) nameEl.textContent = s.name;
  const modal = el('aiImportModal');
  if (!modal) return;
  modal.style.display = 'flex';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => modal.classList.add('visible'));
  });
  document.body.style.overflow = 'hidden';
  renderAIImportStep('input');
}

function closeAIImport(): void {
  const modal = el('aiImportModal');
  if (!modal) return;
  modal.classList.remove('visible');
  setTimeout(() => { modal.style.display = 'none'; }, 220);
  document.body.style.overflow = '';
}

// ── Step renderer ────────────────────────────────
type AIImportStep = 'input' | 'processing' | 'result';

function renderAIImportStep(step: AIImportStep): void {
  const body = el('aiImportBody');
  if (!body) return;

  if (step === 'input') {
    body.innerHTML = aiImportSource === 'youtube' ? renderYTInput() : renderFileInput();
  } else if (step === 'processing') {
    body.innerHTML = renderProcessing();
  } else {
    body.innerHTML = renderResult();
  }
}

function renderYTInput(): string {
  return `
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.18);border-radius:12px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="#ef4444"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text);">YouTube → Study Materials</div>
          <div style="font-size:11px;color:var(--muted);">AI reads the transcript and generates flashcards + notes</div>
        </div>
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:var(--muted);display:block;margin-bottom:8px;">VIDEO URL</label>
        <input id="ytUrlInput" type="url" class="auth-input" placeholder="https://www.youtube.com/watch?v=..." style="background:rgba(255,255,255,0.05);" onkeydown="if(event.key==='Enter')processYouTube()">
      </div>
      <button onclick="processYouTube()" class="btn-primary" style="padding:12px;font-size:14px;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:8px;">
        <span class="ms" style="font-size:18px;">auto_awesome</span> Generate Study Materials
      </button>
    </div>
  `;
}

function renderFileInput(): string {
  return `
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div
        id="aiDropZone"
        style="border:2px dashed rgba(124,58,237,0.25);border-radius:16px;padding:36px 24px;text-align:center;cursor:pointer;transition:all 0.2s;"
        onclick="el('aiFileInput').click()"
        ondragover="event.preventDefault();this.style.borderColor='rgba(124,58,237,0.6)';this.style.background='rgba(124,58,237,0.06)'"
        ondragleave="this.style.borderColor='rgba(124,58,237,0.25)';this.style.background=''"
        ondrop="event.preventDefault();this.style.borderColor='rgba(124,58,237,0.25)';this.style.background='';handleAIFileDrop(event)">
        <div style="width:56px;height:56px;background:rgba(124,58,237,0.12);border:1px solid rgba(124,58,237,0.25);border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;">
          <span class="ms" style="font-size:28px;color:var(--plight);">cloud_upload</span>
        </div>
        <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:6px;">Drop your file here</div>
        <div style="font-size:12px;color:var(--muted);">PDF, TXT, MD, PNG, JPG · up to 1 GB</div>
      </div>
      <input type="file" id="aiFileInput" style="display:none;" accept=".txt,.md,.csv,.json,text/*,.pdf,application/pdf,image/png,image/jpeg,image/webp,image/gif" onchange="handleAIFileSelect(this)">
      <div id="aiFileChosen" style="display:none;align-items:center;gap:12px;padding:12px 14px;background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:12px;">
        <span class="ms" style="font-size:22px;color:var(--plight);">draft</span>
        <div style="flex:1;min-width:0;">
          <div id="aiFileName" style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></div>
          <div id="aiFileSize" style="font-size:11px;color:var(--muted);"></div>
        </div>
        <button onclick="clearAIFile()" style="background:transparent;border:none;color:var(--muted);cursor:pointer;display:flex;align-items:center;"><span class="ms" style="font-size:18px;">close</span></button>
      </div>
      <button id="aiFileProcessBtn" onclick="processFile()" class="btn-primary" style="padding:12px;font-size:14px;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:8px;opacity:0.4;cursor:not-allowed;" disabled>
        <span class="ms" style="font-size:18px;">auto_awesome</span> Generate Study Materials
      </button>
    </div>
  `;
}

function renderProcessing(): string {
  return `
    <div style="text-align:center;padding:20px 0 10px;">
      <!-- Orbiting dots animation -->
      <div style="position:relative;width:80px;height:80px;margin:0 auto 24px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);"></div>
        <div style="position:absolute;inset:50%;margin:-12px 0 0 -12px;">
          <div class="proc-dot" style="background:var(--primary);"></div>
          <div class="proc-dot" style="background:var(--cyan);"></div>
          <div class="proc-dot" style="background:var(--green);"></div>
        </div>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
          <span class="ms" style="font-size:26px;color:var(--plight);">auto_awesome</span>
        </div>
      </div>
      <div id="procStepLabel" class="step-label" style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px;">Reading content…</div>
      <div id="procStepSub" class="step-label" style="font-size:12px;color:var(--muted);">Hang tight — this takes about 10 seconds</div>
      <!-- Step dots -->
      <div style="display:flex;justify-content:center;gap:6px;margin-top:24px;">
        ${['Reading','Analysing','Flashcards','Outline'].map((s,i) => `
          <div style="display:flex;flex-direction:column;align-items:center;gap:5px;">
            <div id="stepDot${i}" style="width:8px;height:8px;border-radius:50%;background:${i===0?'var(--primary)':'rgba(255,255,255,0.12)'};transition:background 0.3s ease;"></div>
            <div style="font-size:9px;color:var(--muted);font-family:'Space Grotesk';letter-spacing:0.04em;">${s.toUpperCase()}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderResult(): string {
  if (!aiImportResult) return '<p style="color:var(--muted);">No results.</p>';
  const r = aiImportResult;
  const tabs: { key: typeof aiImportResultTab; label: string; icon: string }[] = [
    { key: 'flashcards', label: `Flashcards (${r.flashcards.length})`, icon: 'style' },
    { key: 'summary',    label: 'Summary',  icon: 'article' },
    { key: 'outline',    label: 'Outline',  icon: 'format_list_bulleted' },
  ];

  let tabContent = '';
  if (aiImportResultTab === 'flashcards') {
    tabContent = `<div style="display:flex;flex-direction:column;gap:8px;max-height:320px;overflow-y:auto;padding-right:4px;">
      ${r.flashcards.map((fc, i) => `
        <div class="fc-result-item" style="animation-delay:${i*0.04}s">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;color:var(--plight);font-family:'Space Grotesk';margin-bottom:5px;">Q</div>
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;">${_e(fc.q)}</div>
          <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;color:var(--green);font-family:'Space Grotesk';margin-bottom:5px;">A</div>
          <div style="font-size:13px;color:var(--muted);line-height:1.5;">${_e(fc.a)}</div>
        </div>
      `).join('')}
    </div>`;
  } else if (aiImportResultTab === 'summary') {
    if (aiSummaryLoading) {
      tabContent = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:48px 24px;text-align:center;">
        <span class="ms" style="font-size:32px;color:var(--plight);animation:beamSpin 0.9s linear infinite;">refresh</span>
        <div style="font-size:13px;font-weight:600;color:var(--text);">Writing your summary…</div>
        <div style="font-size:11px;color:var(--muted);">This takes about 10 seconds</div>
      </div>`;
    } else if (!r.summary) {
      tabContent = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:40px 24px;text-align:center;">
        <div style="width:52px;height:52px;background:rgba(124,58,237,0.12);border:1px solid rgba(124,58,237,0.25);border-radius:14px;display:flex;align-items:center;justify-content:center;">
          <span class="ms" style="font-size:26px;color:var(--plight);">article</span>
        </div>
        <div style="font-size:14px;font-weight:700;color:var(--text);">No summary yet</div>
        <div style="font-size:12px;color:var(--muted);max-width:320px;line-height:1.5;">Generate a structured markdown summary of this content whenever you need it.</div>
        <button onclick="generateSummary()" class="btn-primary" style="margin-top:4px;padding:10px 18px;font-size:13px;border-radius:10px;display:flex;align-items:center;gap:7px;">
          <span class="ms" style="font-size:17px;">auto_awesome</span> Generate summary
        </button>
      </div>`;
    } else {
      tabContent = `<div class="ai-summary" style="max-height:320px;overflow-y:auto;padding-right:4px;">${mdToHtml(r.summary)}</div>`;
    }
  } else {
    tabContent = `<div style="max-height:320px;overflow-y:auto;padding-right:4px;display:flex;flex-direction:column;gap:3px;">
      ${r.outline.map(line => {
        const isSub = line.startsWith('  ') || line.startsWith('\t') || line.startsWith('•') || line.startsWith('-');
        return `<div class="outline-item ${isSub ? 'outline-sub' : 'outline-topic'}">${line.replace(/^[\s•\-]+/, isSub ? '· ' : '')}</div>`;
      }).join('')}
    </div>`;
  }

  return `
    <div style="display:flex;flex-direction:column;gap:16px;">
      <!-- Success banner -->
      <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(78,222,163,0.08);border:1px solid rgba(78,222,163,0.2);border-radius:12px;">
        <span class="ms" style="font-size:22px;color:var(--green);">check_circle</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--green);">Study materials ready!</div>
          <div style="font-size:11px;color:var(--muted);">${r.flashcards.length} flashcards · outline generated${r.summary ? ' · summary' : ''}</div>
        </div>
      </div>
      <!-- Tabs -->
      <div style="display:flex;gap:6px;">
        ${tabs.map(t => `
          <button class="ai-result-tab ${aiImportResultTab === t.key ? 'active' : ''}" onclick="setAIResultTab('${t.key}')">
            <span class="ms" style="font-size:14px;display:block;margin-bottom:2px;">${t.icon}</span>${t.label}
          </button>
        `).join('')}
      </div>
      <!-- Tab content -->
      <div id="aiResultContent">${tabContent}</div>
      <!-- Save button -->
      <button onclick="saveAIResults()" class="btn-primary" style="padding:12px;font-size:14px;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,var(--primary),#6d28d9);box-shadow:0 0 24px rgba(124,58,237,0.4);">
        <span class="ms" style="font-size:18px;">save</span> Save to Subject
      </button>
    </div>
  `;
}

function setAIResultTab(tab: typeof aiImportResultTab): void {
  aiImportResultTab = tab;
  renderAIImportStep('result');
}

// Lazily generate the summary from the cached source content (summary mode).
async function generateSummary(): Promise<void> {
  if (!aiImportResult || !aiImportSourcePayload || aiSummaryLoading) return;
  aiSummaryLoading = true;
  aiImportResultTab = 'summary';
  renderAIImportStep('result');
  try {
    const res = await fetch('/api/process-content', {
      method: 'POST', headers: await aiHeaders(),
      body: JSON.stringify({ ...aiImportSourcePayload, mode: 'summary' }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Summary generation failed');
    aiImportResult.summary = result.summary || '';
    if (!aiImportResult.summary) throw new Error('Empty summary returned');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    track('ai.summary.error', { message: msg });
    showToast('Error: ' + msg, 'error');
  } finally {
    aiSummaryLoading = false;
    renderAIImportStep('result');
  }
}

// ── File handling ────────────────────────────────
// Tagged union — each kind carries only the fields it needs.
//   text  → readAsText, send the string to /api/process-content as before
//   pdf   → text was extracted client-side via PDF.js; dataUrl preserves the
//           original file so we can save it to the doc library unchanged.
//   image → base64 payload sent to a vision model; dataUrl serves both as
//           the AI input (data:<mime>;base64,...) and the saved doc.
type AIFileKind = 'text' | 'pdf' | 'image';
interface AIImportFileData {
  kind:    AIFileKind;
  name:    string;
  size:    number;
  mime:    string;
  text?:   string;   // text/pdf — extracted plain text for the AI
  dataUrl?: string;  // pdf/image — original file as data: URL for the doc
}
let aiImportFileData: AIImportFileData | null = null;

// PDF.js — vendored via cdnjs. Lazy-loaded on first PDF pick so the splash
// page stays unaware of it. Pinned version; bump intentionally.
declare const pdfjsLib: any;
const PDFJS_VERSION = '3.11.174';
const PDFJS_BASE    = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;
let pdfJsPromise: Promise<any> | null = null;
function loadPdfJs(): Promise<any> {
  if ((window as any).pdfjsLib) return Promise.resolve((window as any).pdfjsLib);
  if (pdfJsPromise) return pdfJsPromise;
  pdfJsPromise = new Promise<any>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `${PDFJS_BASE}/pdf.min.js`;
    s.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (!lib) { reject(new Error('PDF.js failed to load')); return; }
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.js`;
      resolve(lib);
    };
    s.onerror = () => reject(new Error('Could not fetch PDF.js'));
    document.head.appendChild(s);
  });
  return pdfJsPromise;
}

// Pull plain text out of every page. Capped at 30 pages to keep extraction
// snappy and the resulting prompt within model token budgets — beyond ~30
// pages of dense text we'd be truncating in /api/process-content anyway.
const PDF_MAX_PAGES = 30;
async function extractPdfText(buf: ArrayBuffer): Promise<{ text: string; pages: number; extracted: number }> {
  const lib = await loadPdfJs();
  const pdf = await lib.getDocument({ data: buf }).promise;
  const extracted = Math.min(pdf.numPages, PDF_MAX_PAGES);
  const chunks: string[] = [];
  for (let i = 1; i <= extracted; i++) {
    const page = await pdf.getPage(i);
    const tc   = await page.getTextContent();
    const text = tc.items.map((it: any) => it.str || '').join(' ');
    chunks.push(text);
  }
  return { text: chunks.join('\n\n').trim(), pages: pdf.numPages, extracted };
}

function handleAIFileSelect(input: HTMLInputElement): void {
  const file = input.files?.[0];
  if (!file) return;
  readAIFile(file);
  input.value = '';
}

function handleAIFileDrop(e: DragEvent): void {
  const file = e.dataTransfer?.files?.[0];
  if (file) readAIFile(file);
}

// Classifier — returns null for unsupported types (e.g. .docx, .pptx).
// Order matters: image MIME is checked before extension so a .png that
// the OS mislabels still routes correctly via the extension fallback.
function classifyAIFile(file: File): AIFileKind | null {
  if (file.type.startsWith('text/')) return 'text';
  if (/\.(txt|md|csv|json)$/i.test(file.name)) return 'text';
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'pdf';
  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(file.name)) return 'image';
  return null;
}

function readFileAs(file: File, as: 'text' | 'dataurl' | 'arraybuffer'): Promise<string | ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result as string | ArrayBuffer);
    r.onerror = () => reject(r.error || new Error('File read failed'));
    if      (as === 'text')        r.readAsText(file);
    else if (as === 'dataurl')     r.readAsDataURL(file);
    else                           r.readAsArrayBuffer(file);
  });
}

async function readAIFile(file: File): Promise<void> {
  // Matches DOC_HARD_MAX (1 GB) — the Storage-rules cap. We keep the file
  // entirely in memory on this path, so very large uploads can stall the
  // tab before the limit kicks in; route huge files through the
  // Storage-streaming path in Library instead.
  if (file.size > DOC_HARD_MAX) { showToast('File too large (max 1 GB)', 'warning'); return; }

  const kind = classifyAIFile(file);
  if (!kind) {
    showToast(
      'Unsupported file type. Use TXT, MD, CSV, JSON, PDF, or an image (PNG/JPG/WEBP).',
      'warning',
    );
    return;
  }

  showFileChosenUI(file, kind === 'pdf' ? 'Reading PDF…' : undefined);

  try {
    if (kind === 'text') {
      const content = await readFileAs(file, 'text') as string;
      aiImportFileData = { kind, name: file.name, size: file.size, mime: file.type, text: content };
    } else if (kind === 'image') {
      const dataUrl = await readFileAs(file, 'dataurl') as string;
      aiImportFileData = { kind, name: file.name, size: file.size, mime: file.type || guessImageMime(file.name), dataUrl };
    } else {
      // PDF — read twice: once as ArrayBuffer for PDF.js, once as data URL
      // for the doc library. Both come from a single File reference so the
      // tab keeps only one copy in memory at a time.
      const buf     = await readFileAs(file, 'arraybuffer') as ArrayBuffer;
      const result  = await extractPdfText(buf);
      // Scanned PDFs have negligible text-layer content. Threshold is
      // intentionally generous — a 1-page PDF with a single paragraph still
      // clears it. Below this we'd be feeding the AI noise + page-number
      // fragments and getting fabricated cards back.
      if (result.text.length < 40) {
        clearAIFile();
        showToast(
          'This looks like a scanned PDF (no extractable text). Image-based PDF support is coming soon.',
          'warning',
        );
        return;
      }
      const dataUrl = await readFileAs(file, 'dataurl') as string;
      aiImportFileData = {
        kind, name: file.name, size: file.size, mime: 'application/pdf',
        text: result.text, dataUrl,
      };
      if (result.pages > result.extracted) {
        showToast(`Read first ${result.extracted} of ${result.pages} pages. The rest will be ignored.`, 'info');
      }
      // Swap the spinner sublabel back to file size now that extraction succeeded.
      const sizeEl = el('aiFileSize'); if (sizeEl) sizeEl.textContent = docSize(file.size);
    }
    enableAIProcessBtn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    track('ai.file.read.error', { kind, message: msg });
    showToast(`Couldn't read file: ${msg}`, 'error');
    clearAIFile();
  }
}

function guessImageMime(name: string): string {
  const m = name.toLowerCase().match(/\.(png|jpe?g|webp|gif)$/);
  if (!m) return 'image/png';
  return m[1] === 'jpg' || m[1] === 'jpeg' ? 'image/jpeg' : `image/${m[1]}`;
}

function showFileChosenUI(file: File, sizeOverride?: string): void {
  const chosen = el('aiFileChosen');
  const nameEl = el('aiFileName');
  const sizeEl = el('aiFileSize');
  const zone   = el('aiDropZone');
  if (chosen) chosen.style.display = 'flex';
  if (nameEl) nameEl.textContent = file.name;
  if (sizeEl) sizeEl.textContent = sizeOverride || docSize(file.size);
  if (zone)   zone.style.display  = 'none';
}

function enableAIProcessBtn(): void {
  const btn = el('aiFileProcessBtn') as HTMLButtonElement | null;
  if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer'; }
}

function clearAIFile(): void {
  aiImportFileData = null;
  const chosen = el('aiFileChosen');
  const zone   = el('aiDropZone');
  const btn    = el('aiFileProcessBtn') as HTMLButtonElement | null;
  if (chosen) chosen.style.display = 'none';
  if (zone)   zone.style.display = '';
  if (btn)    { btn.disabled = true; btn.style.opacity = '0.4'; btn.style.cursor = 'not-allowed'; }
}

// ── Processing ───────────────────────────────────
function advanceProcStep(step: number, label: string, sub: string): void {
  const labelEl = el('procStepLabel');
  const subEl   = el('procStepSub');
  if (labelEl) { labelEl.style.animation = 'none'; labelEl.textContent = label; labelEl.style.animation = ''; }
  if (subEl)   { subEl.style.animation   = 'none'; subEl.textContent   = sub;   subEl.style.animation   = ''; }
  for (let i = 0; i <= 3; i++) {
    const dot = el('stepDot' + i);
    if (dot) dot.style.background = i <= step ? 'var(--primary)' : 'rgba(255,255,255,0.12)';
  }
}

async function processYouTube(): Promise<void> {
  const url = (elInput('ytUrlInput')?.value ?? '').trim();
  if (!url) { showToast('Please enter a YouTube URL', 'warning'); return; }

  renderAIImportStep('processing');
  advanceProcStep(0, 'Fetching video info…', 'Getting transcript from YouTube');

  try {
    const infoRes  = await fetch('/api/youtube', { method:'POST', headers: await aiHeaders(), body: JSON.stringify({ url }) });
    const info     = await infoRes.json();
    if (!infoRes.ok) throw new Error(info.error || 'YouTube fetch failed');

    advanceProcStep(1, 'Analysing content…', `"${info.title}" · ${info.transcript ? 'transcript loaded' : 'using title only'}`);
    await new Promise(r => setTimeout(r, 600));

    advanceProcStep(2, 'Generating flashcards…', 'AI is extracting key concepts');

    const s = S.subjects.find(x => x.id === aiImportSubjId);
    const payload = { content: info.transcript, contentType: 'youtube', title: info.title, subjName: s?.name || '' };
    aiImportSourcePayload = payload;
    const procRes = await fetch('/api/process-content', {
      method: 'POST', headers: await aiHeaders(),
      body: JSON.stringify({ ...payload, mode: 'study' }),
    });
    const result = await procRes.json();
    if (!procRes.ok) throw new Error(result.error || 'AI processing failed');

    advanceProcStep(3, 'Building outline…', 'Almost done!');
    await new Promise(r => setTimeout(r, 400));

    aiImportResult = { flashcards: result.flashcards || [], outline: result.outline || [], summary: '' };
    aiImportResultTab = 'flashcards';

    // Auto-save the YouTube video as a link doc. Pass aiImportSubjId
    // explicitly (the import flow never opens the doc modal, so the
    // docModalSubjId fallback would be null). Keep the transcript as aiText
    // so a summary can be generated later from the saved doc.
    if (aiImportSubjId !== null) {
      const doc: Doc = { id: S.nextId++, name: info.title, type: 'link', content: url, date: Date.now() };
      if (info.transcript) doc.aiText = String(info.transcript).slice(0, 12000);
      addDocToSubject(doc, aiImportSubjId);
    }

    renderAIImportStep('result');
  } catch(e) {
    const msg = e instanceof Error ? e.message : String(e);
    track('ai.youtube.error', { message: msg });
    showToast('Error: ' + msg, 'error');
    renderAIImportStep('input');
  }
}

async function processFile(): Promise<void> {
  if (!aiImportFileData) return;
  const fd = aiImportFileData;
  const { name, size, mime, kind } = fd;

  renderAIImportStep('processing');
  advanceProcStep(0, 'Reading file…', name);
  await new Promise(r => setTimeout(r, 300));

  const analyseSub = kind === 'image' ? 'Looking at your image' :
                     kind === 'pdf'   ? 'Reading your PDF'        :
                                        'Extracting key concepts';
  advanceProcStep(1, 'Analysing content…', analyseSub);

  try {
    const s = S.subjects.find(x => x.id === aiImportSubjId);

    // Build the request body per kind. Backend distinguishes by contentType:
    //   'image'           → vision model, image:{ b64, mime } payload
    //   'file' / 'youtube' → text path (unchanged)
    let body: Record<string, unknown>;
    if (kind === 'image') {
      // Strip the "data:<mime>;base64," prefix — backend wants raw b64.
      const b64 = (fd.dataUrl || '').replace(/^data:[^;]+;base64,/, '');
      body = {
        contentType: 'image',
        title: name,
        subjName: s?.name || '',
        image: { b64, mime: mime || 'image/png' },
      };
    } else {
      // text or pdf — both carry .text. 12 KB cap keeps prompt size bounded
      // (~3 K tokens). Going much higher trades latency for marginal gains.
      const textContent = (fd.text || '').slice(0, 12000);
      body = {
        contentType: 'file',
        title: name,
        subjName: s?.name || '',
        content: textContent,
      };
    }

    aiImportSourcePayload = body;
    const procRes = await fetch('/api/process-content', {
      method: 'POST', headers: await aiHeaders(),
      body: JSON.stringify({ ...body, mode: 'study' }),
    });

    advanceProcStep(2, 'Generating flashcards…', 'AI is creating study cards');
    const result = await procRes.json();
    if (!procRes.ok) throw new Error(result.error || 'Processing failed');

    advanceProcStep(3, 'Building outline…', 'Finishing up');
    await new Promise(r => setTimeout(r, 400));

    aiImportResult = { flashcards: result.flashcards || [], outline: result.outline || [], summary: '' };
    aiImportResultTab = 'flashcards';

    // Auto-save the original file as a doc. For text we save the text itself;
    // for PDFs/images we save the data URL so the user can re-open the file
    // unchanged from the library. Pass aiImportSubjId explicitly — the import
    // flow never opens the doc modal, so addDocToSubject's docModalSubjId
    // fallback would be null and silently drop the doc.
    if (aiImportSubjId !== null) {
      const docContent = kind === 'text' ? (fd.text || '') : (fd.dataUrl || '');
      const doc: Doc = { id: S.nextId++, name, type: 'file', content: docContent, mime, size, date: Date.now() };
      if (kind !== 'image' && fd.text) doc.aiText = fd.text.slice(0, 12000);
      addDocToSubject(doc, aiImportSubjId);
    }

    renderAIImportStep('result');
  } catch(e) {
    const msg = e instanceof Error ? e.message : String(e);
    track('ai.file.error', { kind, message: msg });
    showToast('Error: ' + msg, 'error');
    renderAIImportStep('input');
  }
}

function saveAIResults(): void {
  if (!aiImportResult || aiImportSubjId === null) return;
  const s = S.subjects.find(x => x.id === aiImportSubjId);
  if (!s) return;

  // Merge flashcards into subject
  if (!s.cards) s.cards = [];
  const newCards = aiImportResult.flashcards.map(fc => ({ q: fc.q, a: fc.a }));
  s.cards.push(...newCards);

  // Save summary as a note doc
  if (aiImportResult.summary) {
    if (!s.documents) s.documents = [];
    s.documents.unshift({
      id:      S.nextId++,
      name:    'AI Summary',
      type:    'note',
      content: aiImportResult.summary,
      date:    Date.now(),
    });
    s.docs = s.documents.length;
  }

  save();
  renderLibrary();
  closeAIImport();
  const savedSummary = !!aiImportResult.summary;
  showToast(`${newCards.length} flashcards${savedSummary ? ' + summary' : ''} saved to ${s.name}`, 'success');
}

// ── STATS ────────────────────────────────────────────────────────────────────
function renderStats() {
  renderStatsDate();
  renderStatsBar();
  renderDonut();
  renderHeatmap();
  renderSessionLog();
  renderStatsInsight();
  renderMilestoneCards();
}

function renderMilestoneCards(): void {
  const totalSess = S.sessions.length;
  const totalMins = Math.round(S.sessions.reduce((n, s) => n + s.duration, 0) / 60);
  const bestStreak = S.bestStreak || 0;

  // Streak record
  const streakEl = el('statBestStreak');
  if (streakEl) streakEl.textContent = bestStreak > 0 ? `${bestStreak} Day${bestStreak !== 1 ? 's' : ''}` : '0 Days';

  // Total focus time
  const focusEl = el('statTotalFocus');
  if (focusEl) {
    if (totalMins >= 60) {
      const hrs = (totalMins / 60).toFixed(1).replace(/\.0$/, '');
      focusEl.textContent = `${hrs} Hr${+hrs !== 1 ? 's' : ''}`;
    } else {
      focusEl.textContent = `${totalMins} Min${totalMins !== 1 ? 's' : ''}`;
    }
  }

  // Total sessions
  const sessEl = el('statTotalSessions');
  if (sessEl) sessEl.textContent = String(totalSess);

  // SRS — cards reviewed in the last 24h. Reads from card.lastReviewedAt
  // (set in srsSchedule). Stays at 0 for users who never opened the
  // flashcard modal — fine, the tile just shows 0.
  const cardsEl = el('statCardsReviewed');
  if (cardsEl) cardsEl.textContent = String(srsReviewedToday());

  // Focus level based on total sessions
  const levelEl = el('statFocusLevel');
  if (levelEl) {
    const level = totalSess >= 100 ? 'Master'
                : totalSess >= 50  ? 'Advanced'
                : totalSess >= 20  ? 'Focused'
                : totalSess >= 5   ? 'Learner'
                : totalSess >= 1   ? 'Starter'
                : '—';
    levelEl.textContent = level;
  }
}

function renderStatsInsight() {
  const title = el('statsInsightTitle');
  const body  = el('statsInsightBody');
  if (!title || !body) return;

  const totalSess  = S.sessions.length;
  const totalMins  = Math.round(S.sessions.reduce((n, s) => n + s.duration, 0) / 60);
  const streak     = S.streak || 0;
  const bestStreak = S.bestStreak || 0;

  if (totalSess === 0) {
    title.textContent = 'Your journey starts with the first session.';
    body.textContent  = 'Complete a focus session to begin building your personal study insights. Your data stays here — no fake numbers.';
    return;
  }

  // Find most studied subject
  const subjCounts: Record<number, number> = {};
  S.sessions.forEach(s => { if (s.subjectId != null) subjCounts[s.subjectId] = (subjCounts[s.subjectId] || 0) + 1; });
  const topSubjId   = Object.entries(subjCounts).sort((a, b) => +b[1] - +a[1])[0]?.[0];
  const topSubj     = S.subjects.find(s => s.id === +topSubjId);

  if (streak >= 3) {
    title.textContent = `${streak}-day streak — real consistency.`;
    body.textContent  = `You've studied ${totalMins} minutes across ${totalSess} session${totalSess !== 1 ? 's' : ''}${bestStreak > streak ? ` — your personal best is ${bestStreak} days` : ''}.${topSubj ? ` ${topSubj.name} is your most visited subject.` : ''}`;
  } else if (totalSess >= 5) {
    title.textContent = `${totalSess} sessions logged — you're building a habit.`;
    body.textContent  = `${totalMins} total minutes of focused study.${topSubj ? ` ${topSubj.name} is your most studied subject.` : ''} Keep your streak alive to unlock your best performance.`;
  } else {
    title.textContent = `${totalSess} session${totalSess !== 1 ? 's' : ''} logged — great start.`;
    body.textContent  = `You've put in ${totalMins} focused minutes so far. Study consistently every day to build your streak and improve your focus score.`;
  }
}

function renderSessionLog() {
  const list    = el('sessionLogList');
  const countEl = el('sessLogCount');
  if (!list) return;

  // Get last 15 sessions, newest first
  const recent = [...S.sessions].reverse().slice(0, 15);
  if (countEl) countEl.textContent = `${recent.length} of ${S.sessions.length}`;

  if (!recent.length) {
    list.innerHTML = `<p style="font-size:13px;color:var(--muted);padding:12px 0;">No sessions yet — complete your first focus session to see history here.</p>`;
    return;
  }

  const subjectMap: Record<number, Subject> = {};
  S.subjects.forEach(s => { subjectMap[s.id] = s; });

  list.innerHTML = recent.map((sess, i) => {
    const d     = new Date(sess.date);
    const subj  = sess.subjectId != null ? subjectMap[sess.subjectId] : undefined;
    const mins  = Math.round(sess.duration / 60);
    const color = subj?.color || 'var(--primary)';
    const name  = subj?.name  || 'Free Study';
    const dateStr = d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });

    // Mini score bar (based on duration: 25min = 100%)
    const pct = Math.min(100, (mins / 25) * 100);

    return `
      <div class="sess-row" style="animation-delay:${i * 0.04}s;">
        <div style="width:32px;height:32px;border-radius:8px;background:${color}22;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid ${color}35;">
          <span class="ms" style="font-size:15px;color:${color};">menu_book</span>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</div>
          <div style="height:3px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:2px;opacity:0.7;"></div>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:13px;font-weight:700;color:white;margin-bottom:2px;">${mins}m</div>
          <div style="font-size:10px;color:var(--muted);">${dateStr} · ${timeStr}</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderStatsDate() {
  const e = el('statsDateRange');
  if (!e) return;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  e.textContent = start.toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' – ' +
    now.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}

function renderStatsBar() {
  const chart  = el('statsBarChart');
  const labels = el('statsBarLabels');
  if (!chart) return;

  // Generate 6 weekly chunks + today
  const now = new Date();
  const buckets = [];
  for (let i = 5; i >= 0; i--) {
    const from = new Date(now); from.setDate(now.getDate() - (i+1)*5);
    const to   = new Date(now); to.setDate(now.getDate() - i*5);
    const hrs  = S.sessions
      .filter(s => { const d = new Date(s.date); return d >= from && d < to; })
      .reduce((n, s) => n + s.duration/3600, 0);
    buckets.push({ hrs, label: from.toLocaleDateString('en-US',{month:'short',day:'numeric'}), isToday: false });
  }
  const todayH = todayFocusSec() / 3600;
  buckets.push({ hrs: todayH, label: 'Today', isToday: true });

  const maxH = Math.max(...buckets.map(b => b.hrs), 0.1);
  chart.innerHTML = buckets.map(b => {
    const pct = b.hrs > 0 ? Math.max(4, (b.hrs / maxH) * 100) : 4;
    const bg  = b.isToday ? 'var(--cyan)' : 'rgba(124,58,237,0.48)';
    const op  = b.hrs === 0 ? '0.18' : '1';
    return `<div style="flex:1;height:${pct}%;background:${bg};border-radius:4px 4px 0 0;min-height:4px;transition:height 0.4s;opacity:${op};"></div>`;
  }).join('');

  if (labels) labels.innerHTML = buckets.map(b => `<span style="font-size:10px;">${b.label}</span>`).join('');
}

function renderDonut() {
  const svg    = el('subjectDonut');
  const legend = el('subjectLegend');
  const total  = el('totalHrsNum');
  if (!svg) return;

  const subjects = S.subjects;

  const r = 55, cx = 75, cy = 75;
  const C = 2 * Math.PI * r;
  const totalHrs = Math.round(S.sessions.reduce((n, s) => n + s.duration/3600, 0));
  if (total) total.textContent = String(totalHrs);

  if (!subjects.length) {
    svg.setAttribute('viewBox', '0 0 150 150');
    svg.innerHTML = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="16"/>`;
    if (legend) legend.innerHTML = `<p style="font-size:12px;color:var(--muted);text-align:center;">No subjects yet</p>`;
    return;
  }

  const tot = subjects.reduce((n, s) => n + s.docs, 0) || 1;
  let offset = C * 0.25;

  const arcs = subjects.map(s => {
    const arc = (s.docs / tot) * C;
    const off = C - offset;
    offset -= arc;
    return { ...s, arc, off };
  });

  svg.setAttribute('viewBox', '0 0 150 150');
  svg.innerHTML =
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="16"/>` +
    arcs.map(a =>
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${a.color}" stroke-width="16"
        stroke-dasharray="${a.arc} ${C - a.arc}" stroke-dashoffset="${a.off}"/>`
    ).join('');

  if (legend) {
    legend.innerHTML = subjects.map(s => `
      <div style="display:flex;align-items:center;gap:8px;font-size:12px;">
        <div style="width:8px;height:8px;border-radius:50%;background:${s.color};flex-shrink:0;"></div>
        <span style="color:var(--muted);flex:1;">${_e(s.name)}</span>
        <span style="font-weight:600;">${Math.round(s.docs/tot*100)}%</span>
      </div>
    `).join('');
  }
}

function renderHeatmap() {
  const grid = el('heatmapGrid') as HTMLElement;
  if (!grid) return;

  // 24-hour × 14-day heatmap  (cols = hours 0–23, rows = days oldest→newest)
  const HOURS = 24, DAYS = 14;

  grid.style.gridTemplateColumns = `repeat(${HOURS}, 1fr)`;
  grid.style.gridAutoRows        = '1fr';
  grid.style.height              = '154px';
  grid.style.justifyContent      = '';

  // Build lookup: "dateKey|hour" → total focus minutes
  const now = new Date();
  const intensity: Record<string, number> = {};
  S.sessions.forEach(s => {
    const d   = new Date(s.date);
    const key = `${d.toDateString()}|${d.getHours()}`;
    intensity[key] = (intensity[key] || 0) + s.duration / 60;
  });

  const maxMins = Math.max(...Object.values(intensity), 1);

  const cells: string[] = [];
  for (let day = DAYS - 1; day >= 0; day--) {
    const d = new Date(now);
    d.setDate(now.getDate() - day);
    const dayStr  = d.toDateString();
    const dayLabel = d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });

    for (let h = 0; h < HOURS; h++) {
      const mins  = intensity[`${dayStr}|${h}`] || 0;
      const ratio = mins / maxMins;
      const alpha = mins === 0 ? '0.06'
        : ratio < 0.25 ? '0.25'
        : ratio < 0.5  ? '0.5'
        : ratio < 0.75 ? '0.75'
        : '1';
      const hourLabel = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h-12} PM`;
      cells.push(
        `<div style="border-radius:2px;background:rgba(124,58,237,${alpha});" ` +
        `title="${dayLabel} · ${hourLabel}: ${Math.round(mins)} min"></div>`
      );
    }
  }
  grid.innerHTML = cells.join('');
}

// ── TASKS ────────────────────────────────────────────────────────────────────
function renderTasks() {
  const list = el('fullTasksList');
  if (!list) return;

  if (!S.tasks.length) {
    list.innerHTML = '<p style="text-align:center;color:var(--muted);padding:40px;font-size:14px;">No tasks yet. Add one above!</p>';
    return;
  }

  list.innerHTML = S.tasks.map(t => `
    <div class="task-row" data-id="${t.id}">
      <input type="checkbox" data-id="${t.id}" ${t.done ? 'checked' : ''}>
      <span style="flex:1;font-size:14px;${t.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${_e(t.text)}</span>
      <button onclick="deleteTask(${t.id})"
        style="background:transparent;border:none;color:rgba(255,255,255,0.2);cursor:pointer;padding:4px;display:flex;align-items:center;"
        onmouseover="this.style.color='#f87171'"
        onmouseout="this.style.color='rgba(255,255,255,0.2)'">
        <span class="ms" style="font-size:16px;">close</span>
      </button>
    </div>
  `).join('');

  list.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const t = S.tasks.find(x => x.id === +(cb.dataset['id'] ?? ''));
      if (t) { t.done = cb.checked; save(); renderTasks(); if (currentView === 'home') renderHomeTasks(); }
    });
  });
}

function addTask(text: string | undefined): void {
  if (!text?.trim()) return;
  S.tasks.push({ id: S.nextId++, text: text.trim(), done: false });
  save();
  renderTasks();
  if (currentView === 'home') renderHomeTasks();
}

function deleteTask(id: number): void {
  S.tasks = S.tasks.filter(t => t.id !== id);
  save();
  renderTasks();
}

// ── TOAST ────────────────────────────────────────────────────────────────────
function showToast(msg: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
  document.querySelector('.brainfy-toast')?.remove();
  const colors = {
    info:    'var(--plight)',
    success: 'var(--green)',
    warning: '#f59e0b',
    error:   '#f87171',
  };
  const icons = { info: 'info', success: 'check_circle', warning: 'warning', error: 'error' };
  const toast = document.createElement('div');
  toast.className = 'brainfy-toast';
  toast.style.cssText = [
    'position:fixed','bottom:28px','left:50%','transform:translateX(-50%) translateY(0)',
    'background:rgba(7,15,31,0.96)','border:1px solid rgba(255,255,255,0.12)',
    'border-radius:12px','padding:12px 20px','font-size:14px','font-weight:500',
    `color:${colors[type] || colors.info}`,
    'z-index:9999','backdrop-filter:blur(16px)',
    'box-shadow:0 8px 32px rgba(0,0,0,0.5)','white-space:nowrap',
    'display:flex','align-items:center','gap:10px',
    'animation:toastSpringIn 0.28s cubic-bezier(0.34,1.2,0.64,1) both',
    'font-family:Manrope,sans-serif',
  ].join(';');
  // icons[type] is a static set of known values, but msg comes from caller
  // (possibly with user-controlled fragments like subject names) → escape it.
  // Inline SVG via icon() so we don't depend on the Material Symbols font.
  toast.innerHTML = `${icon(icons[type], { size: 18, color: colors[type] || colors.info })}<span style="line-height:1.2;">${_e(msg)}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(8px)';
    setTimeout(() => toast.remove(), 320);
  }, 3000);
}

// ── LOGOUT ───────────────────────────────────────────────────────────────────
// Kept as a fallback; the primary sign-out is now in the Settings view.
async function handleLogout() {
  const ok = await showConfirm({
    title:        'Sign out of Brainfy?',
    message:      'Your local data stays on this device.',
    confirmLabel: 'Sign out',
    dangerous:    true,
  });
  if (!ok) return;
  pauseTimer();
  document.body.classList.remove('focus-active');
  handleSignOut();
}

// ── DELETE ACCOUNT ───────────────────────────────────────────────────────────
// Three-step destructive flow, in this order — auth deletion must come LAST
// because the user needs to be authenticated to delete their own
// Firestore doc and Storage files (rules enforce auth.uid == userId).
//
//   1. Storage    — recursively listAll + delete every file under users/{uid}/
//   2. Firestore  — delete users/{uid} document
//   3. Auth       — firebase.auth().currentUser.delete()
//
// Idempotency: Storage and Firestore are best-effort. If Storage delete
// fails partway, we still try Firestore and Auth — the user gets out from
// under us, even if a few orphan files remain. (Firebase Storage doesn't
// charge for orphan files we can't trace; the user is unbillable anyway
// after auth deletion.)
//
// "requires-recent-login": Firebase Auth refuses to delete a user whose
// last sign-in was > ~5 min ago. We catch this, sign them out, and ask
// them to sign back in and retry. The Storage + Firestore data is already
// gone at that point — only Auth remains, which is fine for the next try.
async function deleteStorageFolderRecursive(ref: any): Promise<void> {
  // Firebase Storage has no "delete folder" — list then delete each file,
  // and recurse into each prefix (sub-"folder").
  const result = await ref.listAll();
  await Promise.all([
    ...result.items.map((item: any) => item.delete().catch(() => { /* tolerate missing */ })),
    ...result.prefixes.map((prefix: any) => deleteStorageFolderRecursive(prefix)),
  ]);
}

async function deleteAccount(): Promise<void> {
  if (!firebaseUser) {
    showToast('Not signed in', 'warning');
    return;
  }

  // Two-stage confirm. First: explain what will happen. Second: typed phrase.
  // Both required — the explainer alone is too easy to misclick past.
  const ok = await showConfirm({
    title:        'Delete your account?',
    message:      'This permanently removes your Brainfy account, all study data (subjects, flashcards, sessions, tasks) and uploaded files. This cannot be undone.',
    confirmLabel: 'Continue',
    dangerous:    true,
  });
  if (!ok) return;

  const typed = await showPrompt({
    title:   'Type DELETE to confirm',
    message: 'Last chance — once you submit this, your account and everything in it is gone.',
    okLabel: 'Delete forever',
    fields:  [{ id: 'confirm', label: 'Type DELETE', required: true }],
  });
  if (!typed) return;
  if (typed.confirm !== 'DELETE') {
    showToast('You must type DELETE exactly to confirm.', 'warning');
    return;
  }

  const uid = firebaseUser.uid;
  showToast('Deleting your account…', 'info');

  // ── 1) Storage ──
  try {
    if (typeof firebase.storage === 'function') {
      await deleteStorageFolderRecursive(firebase.storage().ref(`users/${uid}`));
    }
  } catch (err: any) {
    console.error('[delete] storage failed', err?.code, err?.message);
    track('account.delete.storage.error', { code: err?.code, message: err?.message });
    // Continue — Firestore + Auth deletion still matters more than orphan files.
  }

  // ── 2) Firestore ──
  try {
    const ref = userDoc();
    if (ref) await ref.delete();
  } catch (err: any) {
    console.error('[delete] firestore failed', err?.code, err?.message);
    track('account.delete.firestore.error', { code: err?.code, message: err?.message });
    // Continue — we still want to delete the Auth user.
  }

  // ── 3) Auth (the part that can fail with requires-recent-login) ──
  try {
    await firebaseUser.delete();
  } catch (err: any) {
    console.error('[delete] auth failed', err?.code, err?.message);
    track('account.delete.auth.error', { code: err?.code, message: err?.message });
    if (err?.code === 'auth/requires-recent-login') {
      showToast('Please sign in again, then try delete one more time.', 'warning');
      try { await firebase.auth().signOut(); } catch (_) {}
      firebaseUser = null;
      idToken      = null;
      goTo('signin');
      return;
    }
    showToast('Account deletion failed: ' + (err?.message || 'unknown error'), 'error');
    return;
  }

  // ── 4) Local cleanup + navigate ──
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  clearSigninHint();
  S = structuredClone(DEFAULT_STATE);
  firebaseUser = null;
  idToken      = null;
  track('account.delete.success');
  showToast('Account deleted. Goodbye.', 'success');
  goTo('splash');
}

// ── AUTH ─────────────────────────────────────────────────────────────────────
function passwordStrength(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8)  s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

function showAuthError(id: string, msg: string): void {
  const e = el(id);
  if (!e) return;
  e.textContent = msg;
  e.style.display = msg ? 'block' : 'none';
}

function setAuthLoading(btnId: string, loading: boolean): void {
  const btn = elBtn(btnId);
  if (!btn) return;
  btn.disabled    = loading;
  btn.textContent = loading ? 'Please wait…' : (btnId === 'signinSubmitBtn' ? 'Sign In' : 'Create Account');
  btn.style.opacity = loading ? '0.7' : '1';
}

// ── Firebase auth error → friendly message ────────
function friendlyAuthError(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/invalid-credential':   return 'No account found with that email or password.';
    case 'auth/wrong-password':       return 'Incorrect password. Please try again.';
    case 'auth/email-already-in-use': return 'An account already exists with that email.';
    case 'auth/weak-password':        return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':        return 'Please enter a valid email address.';
    case 'auth/too-many-requests':    return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed': return 'Network error. Check your connection and try again.';
    case 'auth/unauthorized-domain':    return 'This domain is not authorised for sign-in. Contact support.';
    case 'auth/popup-blocked':          return 'Pop-up blocked by your browser. Allow pop-ups and try again.';
    default: return 'Something went wrong. Please try again.';
  }
}

// Called after successful Firebase sign-in — reconciles cloud state (merging
// any guest work) then navigates. The reconcile is memoized in
// resolveStateAfterAuth, so the auth observer firing in parallel is harmless.
async function onFirebaseSignIn(user: any, displayName?: string): Promise<void> {
  await resolveStateAfterAuth(user, displayName);
  goTo('home');
}

function handleSignIn(): void {
  const email = elInput('signinEmail')?.value?.trim();
  const pw    = elInput('signinPassword')?.value;
  showAuthError('signinError', '');

  if (!email || !email.includes('@')) { showAuthError('signinError', 'Please enter a valid email address.'); return; }
  if (!pw || pw.length < 6)           { showAuthError('signinError', 'Password must be at least 6 characters.'); return; }

  setAuthLoading('signinSubmitBtn', true);
  firebase.auth().signInWithEmailAndPassword(email, pw)
    .then((cred: any) => onFirebaseSignIn(cred.user))
    .catch((err: any) => {
      setAuthLoading('signinSubmitBtn', false);
      showAuthError('signinError', friendlyAuthError(err.code));
    });
}

function handleSignup(): void {
  const name  = elInput('signupName')?.value?.trim();
  const email = elInput('signupEmail')?.value?.trim();
  const pw    = elInput('signupPassword')?.value;
  showAuthError('signupError', '');

  if (!name)                          { showAuthError('signupError', 'Please enter your name.'); return; }
  if (!email || !email.includes('@')) { showAuthError('signupError', 'Please enter a valid email address.'); return; }
  if (!pw || pw.length < 8)           { showAuthError('signupError', 'Password must be at least 8 characters.'); return; }

  setAuthLoading('signupSubmitBtn', true);
  // Capture the name synchronously: the auth observer can fire and resolve
  // state before this .then() runs, and a brand-new user object has no
  // displayName yet (updateProfile below is async), so the resolver reads this.
  pendingAuthName = name || null;
  firebase.auth().createUserWithEmailAndPassword(email, pw)
    .then((cred: any) => {
      // Save display name in Firebase profile (non-blocking)
      cred.user.updateProfile({ displayName: name }).catch(() => {});
      return onFirebaseSignIn(cred.user, name);
    })
    .catch((err: any) => {
      setAuthLoading('signupSubmitBtn', false);
      showAuthError('signupError', friendlyAuthError(err.code));
    });
}

function handleGoogleSignIn(): void {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider)
    .then((result: any) => onFirebaseSignIn(result.user, result.user.displayName || undefined))
    .catch((err: any) => {
      if (err.code !== 'auth/popup-closed-by-user') {
        showAuthError('signinError', friendlyAuthError(err.code));
      }
    });
}

function handleSignOut(): void {
  firebase.auth().signOut().then(() => {
    firebaseUser = null;
    idToken      = null;
    authResolution = null;       // allow a fresh cloud-reconcile on the next sign-in
    S = structuredClone(DEFAULT_STATE);
    try { localStorage.removeItem(STORAGE_KEY); } catch(_) {}
    clearSigninHint();           // forget "Continue as X" — next tab opens generic splash
    goTo('splash');
  });
}

function showForgot(): void {
  const email = elInput('signinEmail')?.value?.trim();
  if (!email || !email.includes('@')) {
    showAuthError('signinError', 'Enter your email address above first, then click Forgot password.');
    return;
  }
  firebase.auth().sendPasswordResetEmail(email)
    .then(() => {
      showAuthError('signinError', `Reset link sent to ${email} — check your inbox.`);
      const errEl = el('signinError');
      if (errEl) {
        errEl.style.background  = 'rgba(76,215,246,0.08)';
        errEl.style.borderColor = 'rgba(76,215,246,0.2)';
        errEl.style.color       = 'var(--cyan)';
        errEl.style.display     = 'block';
      }
    })
    .catch((err: any) => showAuthError('signinError', friendlyAuthError(err.code)));
}

// ── EVENT LISTENERS ──────────────────────────────────────────────────────────
function initEvents() {
  // Splash CTAs
  el('splashEnterBtn')?.addEventListener('click', () => goTo('signin'));
  // Note: enterBrainBtn click is wired up by applySigninHint() — it picks
  // the right destination (signin vs home) based on whether we have a
  // cached identity from a previous sign-in on this device.
  el('getStartedBtn')?.addEventListener('click', () => goTo('signup'));

  // ── Auth ──────────────────────────────────────────
  el('googleSignInBtn')?.addEventListener('click', handleGoogleSignIn);
  el('signinSubmitBtn')?.addEventListener('click', handleSignIn);
  el('signupSubmitBtn')?.addEventListener('click', handleSignup);

  // Password visibility toggles
  el('signinTogglePw')?.addEventListener('click', () => {
    const inp  = elInput('signinPassword');
    const icon = el('signinPwIcon');
    if (!inp || !icon) return;
    const show = inp.type === 'password';
    inp.type   = show ? 'text' : 'password';
    icon.textContent = show ? 'visibility' : 'visibility_off';
  });
  el('signupTogglePw')?.addEventListener('click', () => {
    const inp  = elInput('signupPassword');
    const icon = el('signupPwIcon');
    if (!inp || !icon) return;
    const show = inp.type === 'password';
    inp.type   = show ? 'text' : 'password';
    icon.textContent = show ? 'visibility' : 'visibility_off';
  });

  // Password strength meter
  el('signupPassword')?.addEventListener('input', e => {
    const v   = (e.target as HTMLInputElement).value;
    const str = passwordStrength(v);
    const bar = el('signupStrengthBar');
    if (!bar) return;
    const colors = ['', '#ef4444', '#f97316', '#eab308', '#4edea3'];
    const widths  = ['0%', '25%', '50%', '75%', '100%'];
    bar.style.width      = widths[str];
    bar.style.background = colors[str];
  });

  // Enter-key on auth inputs
  el('signinPassword')?.addEventListener('keydown', e => { if (e.key === 'Enter') handleSignIn(); });
  el('signupPassword')?.addEventListener('keydown', e => { if (e.key === 'Enter') handleSignup(); });

  // Sidebar nav — close the mobile drawer after picking a destination
  document.querySelectorAll<HTMLElement>('[data-go]').forEach(btn => {
    btn.addEventListener('click', () => {
      goTo(btn.dataset['go'] as ViewName);
      document.body.classList.remove('sidebar-open');
    });
  });

  // Sidebar Start Session (also closes the drawer on mobile)
  el('sidebarStartBtn')?.addEventListener('click', () => {
    goTo('focus');
    document.body.classList.remove('sidebar-open');
  });

  // If the viewport grows back past the mobile breakpoint, make sure the
  // drawer-open class isn't stuck (otherwise the scrim stays up on desktop).
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) document.body.classList.remove('sidebar-open');
  });

  // Esc closes the mobile sidebar drawer
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.body.classList.contains('sidebar-open')) {
      document.body.classList.remove('sidebar-open');
    }
  });

  // Home add task → navigate to tasks view with focus on input
  el('homeAddTaskBtn')?.addEventListener('click', () => {
    goTo('tasks');
    setTimeout(() => el('newTaskInput')?.focus(), 100);
  });

  // View all library
  el('viewAllBtn')?.addEventListener('click', () => goTo('library'));

  // First-run onboarding step CTAs. Each step opens the natural entry point
  // for that action; renderHomeOnboarding() flips the card off once the user
  // has any subject + session, so these handlers only fire during first-run.
  el('onbStep1')?.addEventListener('click', () => { void showAddSubject(); });
  el('onbStep2')?.addEventListener('click', () => goTo('library'));
  el('onbStep3')?.addEventListener('click', () => goTo('focus'));

  // Focus: preset buttons. The active style (.preset-btn.active-preset) is
  // defined in index.html — don't re-inject a style block here, it just
  // confuses anyone reading the CSS chain.
  document.querySelectorAll<HTMLElement>('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active-preset', 'btn-primary'));
      btn.classList.add('active-preset');
      S.focusDuration = +(btn.dataset['focus'] ?? '25') * 60;
      S.breakDuration = +(btn.dataset['break'] ?? '5') * 60;
      save();
    });
  });

  // Focus: begin
  el('beginFocusBtn')?.addEventListener('click', beginFocusSession);

  // Focus: intent input enter
  el('focusIntentInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') beginFocusSession();
  });

  // Timer controls
  el('timerPlayPauseBtn')?.addEventListener('click', () => {
    if (timer.running) pauseTimer();
    else startTimer();
  });
  el('timerResetBtn')?.addEventListener('click', async () => {
    const ok = await showConfirm({
      title:        'Reset timer?',
      message:      'The current countdown will jump back to the start.',
      confirmLabel: 'Reset',
    });
    if (ok) resetTimer();
  });
  el('timerSkipBtn')?.addEventListener('click', skipTimer);

  // Exit session
  el('exitSessionBtn')?.addEventListener('click', exitFocusSession);

  // Add milestone
  el('addMilestoneBtn')?.addEventListener('click', async () => {
    const res = await showPrompt({
      title:   'New milestone',
      message: 'Something you want to finish this session.',
      okLabel: 'Add',
      fields:  [{ id: 'text', label: 'Milestone', required: true }],
    });
    const text = res?.['text'];
    if (text) {
      S.milestones.push({ id: S.nextId++, text, done: false });
      save();
      renderMilestones();
    }
  });

  // Note tags
  document.querySelectorAll<HTMLElement>('.note-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = el('quickNotesInput') as HTMLTextAreaElement | null;
      if (input) {
        input.value += (input.value ? '\n' : '') + btn.dataset['tag'] + ' ';
        S.sessionNotes = input.value;
        save();
        input.focus();
      }
    });
  });

  // Quick notes autosave
  el('quickNotesInput')?.addEventListener('input', e => {
    S.sessionNotes = (e.target as HTMLTextAreaElement).value;
    save();
  });

  // Library: search
  el('libSearchInput')?.addEventListener('input', renderLibrary);

  // Library: tabs
  document.querySelectorAll('.lib-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.lib-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  // Tasks: add
  el('addNewTaskBtn')?.addEventListener('click', () => {
    const input = elInput('newTaskInput');
    addTask(input?.value);
    if (input) input.value = '';
  });
  elInput('newTaskInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      addTask((e.target as HTMLInputElement).value);
      (e.target as HTMLInputElement).value = '';
    }
  });

  // ── Sidebar: legacy Logout button (now in Settings; kept as a safety net) ──
  el('sidebarLogoutBtn')?.addEventListener('click', handleLogout);

  // ── Sidebar: sync status chip — click to retry when in error state ────────
  el('syncStatus')?.addEventListener('click', () => {
    if (syncState === 'error')   retrySync();
    if (syncState === 'offline') showToast('You appear to be offline. Changes are saved locally.', 'info');
  });

  // ── Splash: View Pricing ───────────────────────────
  el('viewPricingBtn')?.addEventListener('click', () => {
    document.getElementById('splash-pricing')?.scrollIntoView({ behavior: 'smooth' });
  });

  // ── Focus active: Notifications & Settings ─────────
  // ── Fullscreen toggle ──────────────────────────────
  const fsBtn  = el('focusFullscreenBtn');
  const fsIcon = el('fsExpandIcon');
  const fsTarget = el('focusActiveLayout') as HTMLElement;

  const FS_EXPAND = `<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>`;
  const FS_SHRINK = `<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="20" x2="3" y2="13"/><line x1="21" y1="3" x2="14" y2="10"/>`;

  function isFullscreen(): boolean {
    return !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
  }

  function updateFsIcon(): void {
    if (fsIcon) fsIcon.innerHTML = isFullscreen() ? FS_SHRINK : FS_EXPAND;
  }

  fsBtn?.addEventListener('click', async () => {
    try {
      if (!isFullscreen()) {
        if (fsTarget.requestFullscreen) await fsTarget.requestFullscreen();
        else if ((fsTarget as any).webkitRequestFullscreen) (fsTarget as any).webkitRequestFullscreen();
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
      }
    } catch(_) {}
    updateFsIcon();
  });

  document.addEventListener('fullscreenchange', updateFsIcon);
  document.addEventListener('webkitfullscreenchange', updateFsIcon);

  // ── Fullscreen idle cursor/UI hide after 5 s ───────
  let fsIdleTimer: ReturnType<typeof setTimeout> | null = null;

  function fsWake(): void {
    fsTarget.classList.remove('fs-idle');
    if (fsIdleTimer) clearTimeout(fsIdleTimer);
    if (isFullscreen()) {
      fsIdleTimer = setTimeout(() => fsTarget.classList.add('fs-idle'), 5000);
    }
  }

  function fsCleanup(): void {
    fsTarget.classList.remove('fs-idle');
    if (fsIdleTimer) { clearTimeout(fsIdleTimer); fsIdleTimer = null; }
  }

  fsTarget.addEventListener('mousemove', fsWake);
  fsTarget.addEventListener('mousedown', fsWake);
  fsTarget.addEventListener('keydown',   fsWake);

  document.addEventListener('fullscreenchange', () => {
    if (isFullscreen()) fsWake(); else fsCleanup();
  });
  document.addEventListener('webkitfullscreenchange', () => {
    if (isFullscreen()) fsWake(); else fsCleanup();
  });

  el('focusNotifBtn')?.addEventListener('click', () => {
    showToast('No new notifications', 'info');
  });
  el('focusSettingsBtn')?.addEventListener('click', () => {
    // Sends users to the Settings view where focus/break/goal all live now.
    goTo('settings');
  });

  // ── Focus: Add custom ambient track ───────────────
  el('addCustomTrackBtn')?.addEventListener('click', () => {
    showToast('Custom audio tracks coming in the next update!', 'info');
  });

  // ── Library: Filter button ────────────────────────
  el('libFilterBtn')?.addEventListener('click', () => {
    showToast('Sorting by: Recently accessed', 'info');
  });

  // ── Stats: Optimize schedule ──────────────────────
  el('optimizeScheduleBtn')?.addEventListener('click', () => {
    const hr = new Date().getHours();
    const peak = hr < 12 ? '9:00 AM – 11:30 AM' : '2:00 PM – 5:00 PM';
    showToast(`Your peak focus window today: ${peak}. Schedule deep work now!`, 'success');
  });
}

// ── INIT ─────────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════
//  AI STUDY COMPANION
//  API key lives in .env on the server — students
//  never see it. All calls go through /api/chat.
// ══════════════════════════════════════════════════

interface AIMessage { role: 'user' | 'assistant'; content: string; }
let aiHistory:   AIMessage[]        = [];
let aiTypingEl:  HTMLElement | null = null;
let aiIsOpen     = false;
let aiAvailable  = false;

// Headers for any AI/content-processing endpoint. Includes the live
// Firebase ID token so Cloudflare Functions can verify the caller is a
// real signed-in user (see functions/api/_lib/auth.js).
//
// Returns just Content-Type if there's no current token — that case will
// be rejected by the server with a 401, which is the right UX (the catch
// already shows "Something went wrong" + telemetry fires).
async function aiHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  // Always fetch a fresh token: the in-memory `idToken` could be up to 55
  // minutes stale (auto-refresh interval), and Firebase SDK getIdToken()
  // returns the cached token unless it's near expiry. Cheap call.
  try {
    if (firebaseUser && typeof firebaseUser.getIdToken === 'function') {
      const t = await firebaseUser.getIdToken();
      if (t) h.Authorization = `Bearer ${t}`;
    }
  } catch (_) { /* swallow — endpoint will 401 and the UI will tell the user */ }
  return h;
}

// ── Check if server has AI configured ──────────
async function checkAIStatus() {
  try {
    const res  = await fetch('/api/ai-status');
    const data = await res.json();
    aiAvailable = !!data.configured;
  } catch(err: any) {
    aiAvailable = false;
    track('ai.status.error', { message: err?.message });
  }
  // Sidebar dot: green = ready, grey = offline
  const dot = document.querySelector<HTMLElement>('#aiNavBtn .ai-dot');
  if (dot) dot.style.background = aiAvailable ? 'var(--green)' : 'var(--muted)';
}

// ── Panel toggle ────────────────────────────────
function toggleAIPanel() {
  const panel = document.getElementById('aiPanel');
  const btn   = document.getElementById('aiNavBtn');
  if (!panel) return;
  aiIsOpen = !aiIsOpen;
  panel.classList.toggle('open', aiIsOpen);
  btn?.classList.toggle('ai-active', aiIsOpen);

  if (aiIsOpen) {
    if (!aiAvailable) {
      showAIOffline();
    } else if (aiHistory.length === 0) {
      showAIWelcome();
    }
    setTimeout(() => document.getElementById('aiInput')?.focus(), 350);
  }
}

// ── System prompt — context-aware ──────────────
function buildSystemPrompt() {
  const todayMin  = Math.round(todayFocusSec() / 60);
  const score     = calcScore();
  const subjectList = S.subjects.map(s => s.name).join(', ') || 'None yet';
  const pending   = S.tasks.filter(t => !t.done).length;
  const today     = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });

  return `You are Brainfy AI — a brilliant, concise, and encouraging study coach & tutor embedded inside the Brainfy deep-focus study app.

## User Context
- **Name:** ${S.userName}
- **Date:** ${today}
- **Focus score:** ${score}/100 (higher = better session quality)
- **Focus time today:** ${todayMin} minutes
- **Day streak:** ${S.streak || 0} days
- **Subjects:** ${subjectList}
- **Pending tasks:** ${pending}

## Your Role
- Answer academic questions clearly with examples and analogies
- Generate flashcards in **exactly** this format when asked:
  Q: [question]
  A: [answer]
  (one per line pair, no numbering)
- Give concise study plans, memory techniques, and motivation
- Keep responses focused — no filler, no unnecessary disclaimers
- Use **bold** for key terms, bullet points for lists
- Be warm, smart, and direct — like a brilliant tutor who respects the user's time`;
}

// ── API call → /api/chat proxy (streaming) ──────
// SSE consumer. The server normalizes Groq + Anthropic deltas down to
//   data: {"text":"<token>"}    ← repeating
//   data: {"error":"..."}       ← optional, surfaces upstream errors
//   data: [DONE]                ← terminator
// Tokens accumulate into the open bubble; we re-render via formatAIText
// at most once per animation frame to keep markdown formatting cheap.
async function callClaude(userText: string): Promise<void> {
  if (!aiAvailable) { showAIOffline(); return; }

  aiHistory.push({ role: 'user', content: userText });
  appendAIMsg('user', userText);
  clearAIInput();
  showAITyping();

  let stream: StreamingBubble | null = null;
  let accumulated = '';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: await aiHeaders(),
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        system: buildSystemPrompt(),
        messages: aiHistory,
        stream: true,
      }),
    });

    if (!res.ok || !res.body) {
      // Server rejected before the stream started. Map common statuses to a
      // calm, human message instead of leaking a raw "Server error 503" — that
      // number reads as "the app is broken" at a core trust moment. Genuine
      // validation errors (400) keep the server's own explanation.
      let errMsg: string;
      switch (res.status) {
        case 401:
        case 403: errMsg = 'Your session expired. Refresh the page and sign back in to keep chatting.'; break;
        case 429: errMsg = 'Too many messages too fast — give it a few seconds and try again.'; break;
        case 500:
        case 502:
        case 503: errMsg = "The tutor's a bit busy right now. Give it a few seconds and try again."; break;
        default:  errMsg = 'Something interrupted that reply. Try again — your messages are safe.';
      }
      if (res.status === 400) {
        try { const j = await res.json(); if (j && typeof j.error === 'string' && j.error) errMsg = j.error; } catch (_) {}
      }
      throw new Error(errMsg);
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      // SSE events are \n\n-separated. Process every complete one.
      let nl: number;
      while ((nl = buf.indexOf('\n\n')) !== -1) {
        const event = buf.slice(0, nl);
        buf = buf.slice(nl + 2);
        for (const line of event.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const obj = JSON.parse(payload);
            if (obj.error) throw new Error(obj.error);
            if (typeof obj.text === 'string') {
              if (!stream) { hideAITyping(); stream = appendAIMsgStreaming(); }
              accumulated += obj.text;
              stream.update(accumulated);
            }
          } catch (_) { /* swallow malformed lines, keep streaming */ }
        }
      }
    }

    // No tokens ever arrived (provider returned an empty stream). Don't
    // leave the bubble blank — surface as an error so the user knows.
    if (!stream) {
      hideAITyping();
      throw new Error('Hmm, no answer came through. Try rephrasing or send it again.');
    }

    stream.finalize();
    aiHistory.push({ role: 'assistant', content: accumulated });

    // Offer to import if flashcard format detected.
    if (/^Q:/m.test(accumulated)) {
      appendAIAction('➕ Import as flashcards', () => importAIFlashcards(accumulated));
    }

  } catch(e) {
    hideAITyping();
    stream?.cancel();
    const raw = e instanceof Error ? e.message : String(e);
    track('ai.chat.error', { message: raw });
    // Network failures surface as a TypeError ("Failed to fetch"). Show an
    // offline-friendly line; otherwise the thrown message is already
    // human-readable (mapped above), so render it as-is.
    const isNetwork = e instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(raw);
    appendAIMsg('error', isNetwork
      ? "Couldn't reach the tutor — check your connection and try again."
      : raw);
  }
}

// ── Quick actions ────────────────────────────────
const AI_QUICK = {
  quiz: () => {
    const s = S.subjects[0]?.name || 'my current subject';
    return `Quiz me on **${s}** — give me 5 challenging questions one at a time. Start with the first question.`;
  },
  explain: async () => {
    const res = await showPrompt({
      title:   'Explain a concept',
      message: 'Brainfy AI will explain with an analogy and a real-world example.',
      okLabel: 'Ask AI',
      fields:  [{ id: 'topic', label: 'What concept?', required: true }],
    });
    return res?.['topic']
      ? `Explain **${res['topic']}** clearly with an analogy and a real-world example.`
      : null;
  },
  flashcards: async () => {
    const res = await showPrompt({
      title:   'Generate flashcards from notes',
      message: 'Paste study notes, I\'ll turn them into Q/A flashcards.',
      okLabel: 'Generate',
      fields:  [{ id: 'notes', label: 'Paste notes here', required: true }],
    });
    return res?.['notes']
      ? `Generate 8 flashcards from these notes. Use exactly this format:\nQ: [question]\nA: [answer]\n\nNotes:\n${res['notes']}`
      : null;
  },
  plan: () => `Create a focused 7-day study plan for these subjects: **${S.subjects.map(s=>s.name).join(', ')}**. Be specific with daily time blocks and topics.`,
  tips: () => `Based on my ${Math.round(todayFocusSec()/60)} minutes of focus today and a score of ${calcScore()}/100 — give me 3 sharp, actionable tips to improve my study performance.`,
};

async function aiQuickAction(type: keyof typeof AI_QUICK): Promise<void> {
  const result = AI_QUICK[type]?.();
  const msg = result instanceof Promise ? await result : result;
  if (msg) callClaude(msg);
}

// ── Message rendering ────────────────────────────
function appendAIMsg(role: 'user' | 'assistant' | 'error', text: string): void {
  const feed = document.getElementById('aiMessages');
  if (!feed) return;

  const isUser  = role === 'user';
  const isError = role === 'error';

  const wrap = document.createElement('div');
  wrap.className = 'ai-msg-wrap';
  wrap.style.cssText = `display:flex;gap:10px;align-items:flex-start;margin-bottom:14px;${isUser ? 'flex-direction:row-reverse;' : ''}`;

  const av = document.createElement('div');
  av.className = 'ai-avatar ' + (isUser ? 'ai-avatar-user' : isError ? 'ai-avatar-error' : 'ai-avatar-bot');
  if (isUser) {
    // Username could be anything; textContent prevents tag injection.
    av.textContent = (S.userName || '?').charAt(0).toUpperCase();
  } else {
    av.innerHTML = isError ? '<span class="ms" style="font-size:15px;color:#f87171;">error</span>' :
                             '<span class="ms" style="font-size:16px;color:var(--plighter);">auto_awesome</span>';
  }

  const bub = document.createElement('div');
  bub.className = 'ai-bubble ' + (isUser ? 'ai-bubble-user' : isError ? 'ai-bubble-error' : '');
  bub.innerHTML = formatAIText(text);

  wrap.appendChild(av);
  wrap.appendChild(bub);
  feed.appendChild(wrap);
  feed.scrollTop = feed.scrollHeight;
}

function appendAIAction(label: string, fn: () => void): void {
  const feed = document.getElementById('aiMessages');
  if (!feed) return;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'text-align:center;margin-bottom:14px;';
  const btn = document.createElement('button');
  btn.className = 'ai-chip';
  btn.innerHTML = label;
  btn.onclick = () => { fn(); wrap.remove(); };
  wrap.appendChild(btn);
  feed.appendChild(wrap);
  feed.scrollTop = feed.scrollHeight;
}

// Streaming-bubble handle. `update(text)` is rAF-throttled so we don't burn
// CPU re-formatting the full markdown string on every SSE delta. `finalize`
// removes the caret and does a final flush; `cancel` removes the bubble
// entirely (used on error so we don't leave a half-written ghost).
interface StreamingBubble {
  update:   (text: string) => void;
  finalize: () => void;
  cancel:   () => void;
}

function appendAIMsgStreaming(): StreamingBubble {
  const feed = document.getElementById('aiMessages');
  if (!feed) {
    return { update: () => {}, finalize: () => {}, cancel: () => {} };
  }

  const wrap = document.createElement('div');
  wrap.className = 'ai-msg-wrap';
  wrap.style.cssText = 'display:flex;gap:10px;align-items:flex-start;margin-bottom:14px;';

  const av = document.createElement('div');
  av.className = 'ai-avatar ai-avatar-bot';
  av.innerHTML = '<span class="ms" style="font-size:16px;color:var(--plighter);">auto_awesome</span>';

  const bub = document.createElement('div');
  bub.className = 'ai-bubble';

  wrap.appendChild(av);
  wrap.appendChild(bub);
  feed.appendChild(wrap);

  let latest = '';
  let frame  = 0;
  let cancelled = false;

  const render = (withCaret: boolean) => {
    bub.innerHTML = formatAIText(latest) + (withCaret ? '<span class="ai-caret"></span>' : '');
    feed.scrollTop = feed.scrollHeight;
  };
  render(true);

  return {
    update(text) {
      if (cancelled) return;
      latest = text;
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; render(true); });
    },
    finalize() {
      if (cancelled) return;
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      render(false);
    },
    cancel() {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
      wrap.remove();
    },
  };
}

function showAITyping() {
  const feed = document.getElementById('aiMessages');
  if (!feed || aiTypingEl) return;
  aiTypingEl = document.createElement('div');
  aiTypingEl.style.cssText = 'display:flex;gap:10px;align-items:center;margin-bottom:14px;';
  aiTypingEl.innerHTML = `
    <div class="ai-avatar ai-avatar-bot">
      <span class="ms" style="font-size:16px;color:var(--plighter);">auto_awesome</span>
    </div>
    <div class="ai-bubble" style="padding:12px 16px;display:flex;gap:5px;align-items:center;">
      <span class="typing-dot"></span>
      <span class="typing-dot" style="animation-delay:0.18s;"></span>
      <span class="typing-dot" style="animation-delay:0.36s;"></span>
    </div>`;
  feed.appendChild(aiTypingEl);
  feed.scrollTop = feed.scrollHeight;
}

function hideAITyping() {
  aiTypingEl?.remove();
  aiTypingEl = null;
}

// ── Markdown → safe HTML ─────────────────────────
// Two-pass to keep bullets tight: first run the inline + heading replacements,
// then collapse consecutive bullet/numbered lines into a single <div class="ai-list">
// wrapper so the surviving newlines never insert a <br/> between items. The old
// version produced a visible blank line between every bullet because it ran
// `\n → <br/>` after the per-line bullet replacement.
function formatAIText(raw: string): string {
  // 1. Escape + inline + block-level (non-list) transforms.
  let html = raw
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`([^`]+)`/g,'<code style="background:rgba(124,58,237,0.18);padding:1px 5px;border-radius:3px;font-size:11px;font-family:monospace;">$1</code>')
    .replace(/^### (.+)$/gm,'<div style="font-size:12px;font-weight:800;color:var(--plighter);margin:10px 0 4px;letter-spacing:0.04em;text-transform:uppercase;">$1</div>')
    .replace(/^## (.+)$/gm,'<div style="font-weight:800;color:white;margin:10px 0 5px;font-size:14px;">$1</div>')
    .replace(/^# (.+)$/gm,'<div style="font-weight:900;color:white;margin:10px 0 6px;font-size:15px;">$1</div>')
    .replace(/^Q:\s*(.+)$/gm,'<div style="margin:6px 0 2px;color:var(--plight);font-weight:700;">Q: $1</div>')
    .replace(/^A:\s*(.+)$/gm,'<div style="margin:0 0 8px;color:var(--text);">A: $1</div>');

  // 2. Group consecutive bullet lines into a single <div class="ai-list">.
  //    Pattern matches one or more `\n?[-*•] ...` lines in a row.
  html = html.replace(/(?:^|\n)((?:[-*•] [^\n]+\n?)+)/g, (_m, block: string) => {
    const items = block
      .split(/\n/)
      .filter(line => /^[-*•] /.test(line))
      .map(line => `<div class="ai-list-item">${line.replace(/^[-*•] /, '')}</div>`)
      .join('');
    return `<div class="ai-list">${items}</div>`;
  });

  // 3. Same for numbered lists.
  html = html.replace(/(?:^|\n)((?:\d+\. [^\n]+\n?)+)/g, (_m, block: string) => {
    const items = block
      .split(/\n/)
      .filter(line => /^\d+\. /.test(line))
      .map(line => `<div class="ai-list-item" style="padding-left:18px;">${line}</div>`)
      .join('');
    return `<div class="ai-list">${items}</div>`;
  });

  // 4. Remaining newlines become <br/>. Collapse \n\n → \n first so paragraph
  //    breaks aren't doubled. Strip newlines directly adjacent to block-level
  //    wrappers so we don't get phantom blank lines after a heading or list.
  html = html
    .replace(/\n\n+/g, '\n\n')
    .replace(/\n+(<div )/g, '$1')
    .replace(/(<\/div>)\n+/g, '$1')
    .replace(/\n\n/g, '<br/>')
    .replace(/\n/g, '<br/>');

  return html;
}

// ── Welcome screen ───────────────────────────────
// Short greeting only — the chip row below the feed already advertises the
// available actions (Quiz me / Explain / Flashcards / Study plan / Tips),
// so repeating them as a bulleted manifesto inside the bubble was noise.
function showAIWelcome() {
  const feed = document.getElementById('aiMessages');
  if (!feed) return;
  feed.innerHTML = '';
  aiHistory = [];
  const hour  = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  appendAIMsg('assistant',
    `${greet}, **${S.userName}** 👋\n\nI'm your study coach. Ask me anything — or tap a shortcut below to get going.`
  );
}

// ── Offline / not-configured screen ─────────────
function showAIOffline() {
  const feed = document.getElementById('aiMessages');
  if (!feed) return;
  feed.innerHTML = `
    <div style="padding:40px 24px;text-align:center;">
      <div style="width:56px;height:56px;background:rgba(255,255,255,0.04);border-radius:16px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;">
        <span class="ms" style="font-size:28px;color:var(--muted);">cloud_off</span>
      </div>
      <h3 style="font-size:15px;font-weight:800;color:var(--text);margin-bottom:8px;">AI not configured</h3>
      <p style="font-size:12px;color:var(--muted);line-height:1.7;">
        Set <strong>one</strong> of these env vars on the server, then restart:
      </p>
      <div style="display:flex;flex-direction:column;gap:8px;margin:14px auto 0;max-width:260px;">
        <code style="background:rgba(124,58,237,0.12);padding:8px 12px;border-radius:8px;font-size:11px;color:var(--plight);text-align:left;font-family:'Space Grotesk',monospace;">GROQ_API_KEY=gsk_...</code>
        <div style="font-size:10px;color:var(--muted2);letter-spacing:0.1em;font-family:'Space Grotesk';">— OR —</div>
        <code style="background:rgba(76,215,246,0.10);padding:8px 12px;border-radius:8px;font-size:11px;color:var(--cyan);text-align:left;font-family:'Space Grotesk',monospace;">ANTHROPIC_API_KEY=sk-ant-...</code>
      </div>
      <p style="font-size:11px;color:var(--muted2);margin-top:18px;line-height:1.55;">
        On Railway: project → service → <strong>Variables</strong> tab → add key → it auto-redeploys.<br/>
        Locally: add to <code style="background:rgba(255,255,255,0.07);padding:1px 5px;border-radius:4px;">.env</code> and restart <code style="background:rgba(255,255,255,0.07);padding:1px 5px;border-radius:4px;">node server.js</code>.
      </p>
    </div>`;
}

function clearAIChat() {
  aiHistory = [];
  const feed = document.getElementById('aiMessages');
  if (feed) { feed.innerHTML = ''; showAIWelcome(); }
}

function clearAIInput(): void {
  const inp = document.getElementById('aiInput') as HTMLTextAreaElement | null;
  if (inp) { inp.value = ''; inp.style.height = 'auto'; }
}

function handleAISend(): void {
  const inp = document.getElementById('aiInput') as HTMLTextAreaElement | null;
  const text = inp?.value?.trim();
  if (!text) return;
  callClaude(text);
}

// ── Import AI-generated flashcards ───────────────
function importAIFlashcards(text: string): void {
  const pairs: FlashCard[] = [];
  const lines = text.split('\n');
  let q: string | null = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('Q:')) { q = trimmed.slice(2).trim(); }
    else if (trimmed.startsWith('A:') && q) {
      pairs.push({ q, a: trimmed.slice(2).trim() });
      q = null;
    }
  }
  if (!pairs.length) { showToast('No flashcard pairs found in response', 'warning'); return; }

  // Create or reuse an "AI Generated" subject and persist the cards ONTO it.
  // Previously these were written to the in-memory FLASHCARD_SETS map, which
  // save() never serializes and the deck never reads (decks read subj.cards) —
  // so the imported cards showed the starter deck instead and vanished on
  // reload. Persist to subj.cards + save(), mirroring saveAIResults().
  let aiSubj = S.subjects.find(s => s.name === 'AI Generated');
  if (!aiSubj) {
    aiSubj = { id: S.nextId++, name: 'AI Generated', desc: 'Flashcards created by AI', docs: 0, color: '#7c3aed', accessed: Date.now() };
    S.subjects.push(aiSubj);
  }
  if (!aiSubj.cards) aiSubj.cards = [];
  aiSubj.cards.push(...pairs.map(p => ({ q: p.q, a: p.a })));
  save();
  renderLibrary();

  showToast(`${pairs.length} flashcards imported! Find them in Library → AI Generated`, 'success');
  appendAIMsg('assistant', `✅ **${pairs.length} flashcards imported** into your Library! Open the **AI Generated** subject in Library to review them.`);
}

// ── Auto-resize textarea ─────────────────────────
// Re-entrant: if the script is lazy-loaded after DOMContentLoaded, run now.
function _wireAIInput(): void {
  setTimeout(() => {
    const inp = document.getElementById('aiInput');
    if (!inp) return;
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !(e as KeyboardEvent).shiftKey) { e.preventDefault(); handleAISend(); }
    });
    inp.addEventListener('input', () => {
      (inp as HTMLTextAreaElement).style.height = 'auto';
      (inp as HTMLTextAreaElement).style.height = Math.min((inp as HTMLTextAreaElement).scrollHeight, 120) + 'px';
    });
  }, 500);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _wireAIInput);
} else {
  _wireAIInput();
}

/* ── Splash page scroll-reveal (IntersectionObserver) ── */
function initSplashObserver() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    document.querySelectorAll('.bento-card, .phil-item, .phil-head, .phil-right')
      .forEach(el => el.classList.add('revealed'));
    return;
  }

  // Enable CSS scroll-reveal hiding now that JS is confirmed running
  document.documentElement.classList.add('js-animations');

  const opts = { threshold: 0.12, rootMargin: '0px 0px -40px 0px' };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, opts);

  // Bento cards — stagger via CSS transition-delay (already set inline)
  document.querySelectorAll('#splash-bento .bento-card').forEach(card => observer.observe(card));

  // Philosophy headings
  document.querySelectorAll<HTMLElement>('#splash-phil .phil-head').forEach((el, i) => {
    el.style.transitionDelay = (i * 0.1) + 's';
    observer.observe(el);
  });

  // Philosophy principle items — already have inline transition-delay
  document.querySelectorAll('#splash-phil .phil-item').forEach(el => observer.observe(el));

  // Philosophy right panel
  const philRight = document.querySelector('.phil-right');
  if (philRight) observer.observe(philRight);
}

function init() {
  load();
  timer.timeLeft  = S.focusDuration;
  timer.totalTime = S.focusDuration;
  // Sidebar badge needs a paint before the user touches anything that
  // would call save() — render once at boot from the loaded localStorage state.
  renderSidebarBadges();
  initEvents();
  // Splash is the initial view (no goTo call fires at boot), so personalise
  // its CTA now — after initEvents has registered the default click handler
  // that applySigninHint may override.
  applySigninHint();
  initSplashObserver();
  initTimetable();
  initSettings();
  initSearch();
  checkAIStatus();

  // ── Firebase auth observer ────────────────────
  // Fires once on load: if user was already signed in, skip splash and
  // load their cloud state. If not, show splash as normal.
  firebase.auth().onAuthStateChanged(async (user: any) => {
    if (user) {
      // Reconcile cloud state (merging any guest work). Memoized, so if an
      // explicit sign-in handler is also resolving, we await the same result.
      await resolveStateAfterAuth(user);
      // Auto-navigate ONLY from active auth flows (signin/signup) — NOT from
      // splash. Splash exists so returning users can click their personalised
      // "Continue as <name>" button intentionally; auto-redirecting them
      // would skip that click and create an "I never clicked anything" UX.
      const navAwayFrom: ViewName[] = ['signin', 'signup'];
      if (navAwayFrom.includes(currentView)) goTo('home');
    } else {
      firebaseUser = null;
      idToken      = '';
      setSyncState('idle');
      // Guest mode escape hatch — if the URL contains #guest (or sessionStorage
      // has guestMode set), don't bounce signed-out users back to splash.
      // Lets us preview the dashboard without going through auth.
      const isGuest = location.hash === '#guest' || sessionStorage.getItem('brainfyGuest') === '1';
      if (isGuest) {
        sessionStorage.setItem('brainfyGuest', '1');
        if (!S.userName) S.userName = 'Guest';
        const authViews: ViewName[] = ['splash', 'signin', 'signup'];
        if (authViews.includes(currentView)) goTo('home');
        return;
      }
      // Only redirect to splash from app views — don't bounce users off sign-in/sign-up
      const authViews: ViewName[] = ['splash', 'signin', 'signup'];
      if (!authViews.includes(currentView)) goTo('splash');
    }
  });

  // Initial paint of the chip (before auth resolves)
  renderSyncChip();
}

// Expose a quick guest-mode toggle so users can also enter from the console
// or from a button on the splash. Once activated it persists for the session.
// Seed a single demo subject (with the starter deck + a welcome note) so a
// brand-new guest lands on a populated Library/Flashcards instead of empty
// screens — the fastest path to the "aha". Only runs when there's no data yet,
// so it never clobbers a returning guest's work.
function seedDemoData(): void {
  if (S.subjects.length) return;
  const docId = S.nextId + 1;
  const demo: Subject = {
    id:       S.nextId,
    name:     'Study Science (demo)',
    desc:     'A sample deck to explore — add your own subjects anytime.',
    docs:     1,
    color:    SUBJECT_COLORS[0]!,
    accessed: Date.now(),
    cards:    (FLASHCARD_SETS.default || []).map(c => ({ q: c.q, a: c.a })),
    documents: [{
      id:      docId,
      name:    'Welcome to Brainfy',
      type:    'note',
      content: '## Welcome 👋\n\nThis is a demo subject so you can look around.\n\n- Open **Flashcards** to review this deck with spaced repetition\n- Start a **Focus session** from Home\n- Add your own subject from the **Library** — drop in a PDF, paste notes, or link a lecture and the AI builds flashcards for you\n\nWhen you sign up, everything you create here comes with you.',
      date:    Date.now(),
    }],
  };
  S.subjects.push(demo);
  S.nextId = docId + 1;
}

function enterGuestMode(): void {
  sessionStorage.setItem('brainfyGuest', '1');
  if (!S.userName) S.userName = 'Guest';
  seedDemoData();
  save();                 // persist the demo so it survives a reload
  setSyncState('idle');
  goTo('home');
  showToast('Demo mode — data stays on this device. Sign up to back it up.', 'info');
}
(window as any).enterGuestMode = enterGuestMode;

// Boot — works whether the script is loaded at parse time (deferred) OR
// injected later by the inline lazy-loader (after DOMContentLoaded has
// already fired). The readyState check covers both cases.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ── TIMETABLE ────────────────────────────────────────────────────────────────

const TT_DAYS  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const TT_HOURS = Array.from({length:17}, (_,i) => i + 6); // 06:00 – 23:00
const TT_ROW_H = 52; // px per hour
let ttEditId: number | null = null;
let ttSelectedColor = '#7c3aed';

function renderTimetable(): void {
  if (!S.timetable) S.timetable = [];
  renderTTGrid();
  renderTTToday();
  renderTTWeekSummary();
}

function renderTTGrid(): void {
  const headers = el('ttDayHeaders');
  const grid    = el('ttGrid') as HTMLElement | null;
  if (!headers || !grid) return;

  const today = (new Date().getDay() + 6) % 7; // 0=Mon
  const baseHour    = TT_HOURS[0];                  // 6
  const visibleMins = TT_HOURS.length * 60;          // 17 * 60
  const totalH      = TT_HOURS.length * TT_ROW_H;    // total grid height

  // ── Day headers ─────────────────────────────
  headers.innerHTML = `<div></div>` +
    TT_DAYS.map((d, i) => `
      <div style="padding:13px 6px 11px;text-align:center;border-left:1px solid rgba(255,255,255,0.04);${i===today?'background:rgba(124,58,237,0.05);':''}">
        <div style="display:inline-flex;flex-direction:column;align-items:center;gap:3px;">
          <span style="font-size:10px;font-weight:700;letter-spacing:0.08em;font-family:'Space Grotesk';color:${i===today?'var(--plight)':'var(--muted)'};opacity:${i===today?'1':'0.7'};">${d.toUpperCase()}</span>
          ${i===today?`<span style="width:4px;height:4px;border-radius:50%;background:var(--plight);display:block;box-shadow:0 0 6px rgba(167,139,250,0.6);"></span>`:''}
        </div>
      </div>`).join('');

  // ── Switch grid container to absolute-positioning layout ──
  grid.style.cssText =
    `display:block;position:relative;height:${totalH}px;` +
    `max-height:540px;overflow-y:auto;`;

  // ── Background: hour labels + 7 day columns ──
  const bgParts: string[] = [];
  TT_HOURS.forEach((h, hi) => {
    const label = h === 0 ? '12 AM'
                : h < 12  ? `${h} AM`
                : h === 12 ? '12 PM'
                : `${h-12} PM`;
    bgParts.push(
      `<div style="position:absolute;left:0;top:${hi*TT_ROW_H}px;width:52px;height:${TT_ROW_H}px;` +
      `font-size:9.5px;color:var(--muted);padding:0 10px;line-height:${TT_ROW_H}px;text-align:right;` +
      `font-family:'Space Grotesk';font-weight:600;letter-spacing:0.03em;opacity:0.45;` +
      `border-top:1px solid rgba(255,255,255,0.04);box-sizing:border-box;">${label}</div>`
    );
    for (let di = 0; di < 7; di++) {
      bgParts.push(
        `<div style="position:absolute;` +
        `left:calc(52px + (100% - 52px) / 7 * ${di});` +
        `top:${hi*TT_ROW_H}px;` +
        `width:calc((100% - 52px) / 7);` +
        `height:${TT_ROW_H}px;` +
        `border-left:1px solid rgba(255,255,255,0.04);` +
        `border-top:1px solid rgba(255,255,255,0.04);` +
        `${di===today?'background:rgba(124,58,237,0.03);':''}` +
        `box-sizing:border-box;"></div>`
      );
    }
  });

  // ── "Now" indicator line (today column only, current visible hour) ──
  if (today >= 0) {
    const now      = new Date();
    const nowMins  = now.getHours() * 60 + now.getMinutes();
    const baseMins = baseHour * 60;
    const nowTop   = (nowMins - baseMins) / 60 * TT_ROW_H;
    if (nowTop >= 0 && nowTop <= totalH) {
      bgParts.push(
        `<div style="position:absolute;` +
        `left:calc(52px + (100% - 52px) / 7 * ${today});` +
        `top:${nowTop}px;` +
        `width:calc((100% - 52px) / 7);` +
        `height:2px;` +
        `background:linear-gradient(90deg,transparent,#f87171,transparent);` +
        `pointer-events:none;z-index:3;">` +
        `<span style="position:absolute;left:-6px;top:-4px;width:10px;height:10px;border-radius:50%;background:#f87171;box-shadow:0 0 10px #f87171;"></span>` +
        `</div>`
      );
    }
  }

  // ── Event blocks (absolute, properly span multi-hour ranges) ──
  const blocksHtml = S.timetable.map((b: TimetableBlock) => {
    const [sh, sm] = b.start.split(':').map(Number);
    const [eh, em] = b.end.split(':').map(Number);
    const startMins = sh * 60 + sm;
    const endMins   = eh * 60 + em;
    const baseMins  = baseHour * 60;

    // Clamp to visible window so out-of-range blocks still appear at the edge
    const clampedStart = Math.max(0, startMins - baseMins);
    const clampedEnd   = Math.min(visibleMins, endMins - baseMins);
    if (clampedEnd <= 0 || clampedStart >= visibleMins) return ''; // entirely outside

    const topPx    = (clampedStart / 60) * TT_ROW_H + 2;
    const heightPx = Math.max(((clampedEnd - clampedStart) / 60) * TT_ROW_H - 4, 22);
    const isShort  = heightPx < 38;

    return (
      `<div onclick="openTTModal(${b.id})" ` +
      `style="position:absolute;` +
        `top:${topPx}px;` +
        `left:calc(52px + (100% - 52px) / 7 * ${b.day} + 3px);` +
        `width:calc((100% - 52px) / 7 - 6px);` +
        `height:${heightPx}px;` +
        `padding:${isShort?'4px 9px':'7px 10px'};` +
        `border-radius:9px;` +
        `background:${b.color}22;` +
        `border:1px solid ${b.color}3a;` +
        `cursor:pointer;` +
        `transition:transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;` +
        `z-index:5;overflow:hidden;box-sizing:border-box;` +
        `display:flex;flex-direction:column;justify-content:${isShort?'center':'flex-start'};gap:${isShort?'0':'2px'};" ` +
      `onmouseover="this.style.background='${b.color}38';this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 18px ${b.color}44'" ` +
      `onmouseout="this.style.background='${b.color}22';this.style.transform='';this.style.boxShadow=''">` +
        `<div style="font-size:${isShort?'10.5px':'11.5px'};font-weight:700;color:${b.color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-0.01em;line-height:1.2;">${_e(b.title)}</div>` +
        (isShort ? '' :
          `<div style="font-size:10px;color:${b.color};opacity:0.7;font-family:'Space Grotesk';letter-spacing:0.01em;">${b.start}–${b.end}</div>`
        ) +
      `</div>`
    );
  }).join('');

  grid.innerHTML = bgParts.join('') + blocksHtml;

  // Auto-scroll to current hour on first paint (helps when working mid-day)
  const targetScroll = Math.max(0, ((new Date().getHours() - baseHour - 1) * TT_ROW_H));
  if (targetScroll > 0 && grid.scrollTop === 0) grid.scrollTop = targetScroll;
}

function renderTTToday(): void {
  const list = el('ttTodayList');
  if (!list) return;
  const today = (new Date().getDay() + 6) % 7;
  const blocks: TimetableBlock[] = (S.timetable || []).filter(b => b.day === today)
    .sort((a, b) => a.start.localeCompare(b.start));
  if (!blocks.length) {
    list.innerHTML = `<p style="font-size:13px;color:var(--muted);font-weight:400;opacity:0.6;">Nothing scheduled for today.</p>`;
    return;
  }
  list.innerHTML = blocks.map((b, i) => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;${i < blocks.length-1 ? 'border-bottom:1px solid rgba(255,255,255,0.04);' : ''}">
      <div style="width:9px;height:9px;border-radius:50%;background:${b.color};flex-shrink:0;box-shadow:0 0 8px ${b.color}60;"></div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;color:var(--text);letter-spacing:-0.015em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.3;">${_e(b.title)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;font-family:'Space Grotesk';letter-spacing:0.02em;opacity:0.7;">${b.start} – ${b.end}</div>
      </div>
      <div style="width:28px;height:28px;border-radius:8px;background:${b.color}14;border:1px solid ${b.color}22;display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;transition:all 0.15s;"
        onclick="openTTModal(${b.id})"
        onmouseover="this.style.background='${b.color}28'" onmouseout="this.style.background='${b.color}14'">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${b.color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </div>
    </div>`).join('');
}

function renderTTWeekSummary(): void {
  const box = el('ttWeekSummary');
  if (!box) return;
  const timetable: TimetableBlock[] = S.timetable || [];

  let totalMins = 0;
  timetable.forEach(b => {
    const [sh,sm] = b.start.split(':').map(Number);
    const [eh,em] = b.end.split(':').map(Number);
    totalMins += (eh*60+em) - (sh*60+sm);
  });
  const hrs = totalMins ? (totalMins/60).toFixed(1).replace(/\.0$/,'') : '0';

  // Two icon stat cards side by side
  box.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div style="border-radius:12px;background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.15);padding:12px 14px;display:flex;flex-direction:column;gap:8px;">
        <div style="width:28px;height:28px;border-radius:8px;background:rgba(124,58,237,0.18);display:flex;align-items:center;justify-content:center;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--plight)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <div>
          <div style="font-size:22px;font-weight:800;color:var(--plight);letter-spacing:-0.04em;line-height:1;">${timetable.length}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:3px;font-family:'Space Grotesk';letter-spacing:0.06em;font-weight:600;opacity:0.7;">BLOCKS</div>
        </div>
      </div>
      <div style="border-radius:12px;background:rgba(76,215,246,0.06);border:1px solid rgba(76,215,246,0.12);padding:12px 14px;display:flex;flex-direction:column;gap:8px;">
        <div style="width:28px;height:28px;border-radius:8px;background:rgba(76,215,246,0.12);display:flex;align-items:center;justify-content:center;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div>
          <div style="font-size:22px;font-weight:800;color:var(--cyan);letter-spacing:-0.04em;line-height:1;">${hrs}<span style="font-size:13px;font-weight:600;opacity:0.7;">h</span></div>
          <div style="font-size:10px;color:var(--muted);margin-top:3px;font-family:'Space Grotesk';letter-spacing:0.06em;font-weight:600;opacity:0.7;">HOURS</div>
        </div>
      </div>
    </div>`;
}

function openTTModal(id?: number): void {
  ttEditId = id ?? null;
  const modal     = el('ttModal') as HTMLElement;
  const titleEl   = el('ttModalTitle') as HTMLElement;
  const deleteBtn = el('ttDeleteBtn') as HTMLElement;
  if (!modal || !titleEl || !deleteBtn) return;

  const titleInp = el('ttBlockTitle') as HTMLInputElement;
  const dayInp   = el('ttBlockDay')   as HTMLSelectElement;
  const startInp = el('ttBlockStart') as HTMLInputElement;
  const endInp   = el('ttBlockEnd')   as HTMLInputElement;

  if (id != null) {
    const block = (S.timetable || []).find(b => b.id === id);
    if (!block) return;
    titleInp.value  = block.title;
    dayInp.value    = String(block.day);
    startInp.value  = block.start;
    endInp.value    = block.end;
    ttSelectedColor = block.color;
    titleEl.textContent     = 'Edit Block';
    deleteBtn.style.display = 'block';
  } else {
    // Sensible defaults: today + current hour rounded down → +1h
    const now     = new Date();
    const todayIx = (now.getDay() + 6) % 7;        // 0=Mon
    const sh      = Math.min(22, now.getHours()); // never start at 23 (so we always have a sane +1h end)
    const eh      = sh + 1;
    const pad     = (n: number) => String(n).padStart(2, '0');

    titleInp.value  = '';
    dayInp.value    = String(todayIx);
    startInp.value  = `${pad(sh)}:00`;
    endInp.value    = `${pad(eh)}:00`;
    ttSelectedColor = '#7c3aed';
    titleEl.textContent     = 'Add Block';
    deleteBtn.style.display = 'none';
  }
  updateTTColorPicker();
  modal.style.display = 'flex';
  requestAnimationFrame(() => modal.classList.add('open'));
  // Focus title input so user can type immediately
  setTimeout(() => titleInp.focus(), 60);
}

function closeTTModal(): void {
  const modal = el('ttModal') as HTMLElement;
  modal.classList.remove('open');
  setTimeout(() => { modal.style.display = 'none'; }, 220);
}

function updateTTColorPicker(): void {
  document.querySelectorAll<HTMLElement>('.tt-color').forEach(dot => {
    const c = dot.dataset['color'] || '';
    const selected = c === ttSelectedColor;
    dot.style.boxShadow = selected ? `0 0 0 2.5px #fff, 0 0 0 4.5px ${c}` : 'none';
    dot.style.transform = selected ? 'scale(1.12)' : 'scale(1)';
    dot.style.opacity   = selected ? '1' : '0.75';
  });
}

function saveTTBlock(): void {
  const title = (el('ttBlockTitle') as HTMLInputElement).value.trim();
  const day   = +(el('ttBlockDay')   as HTMLSelectElement).value;
  const start = (el('ttBlockStart') as HTMLInputElement).value;
  const end   = (el('ttBlockEnd')   as HTMLInputElement).value;
  if (!title)       { showToast('Please enter a title', 'error');           return; }
  if (!start||!end) { showToast('Please pick a start and end time', 'error'); return; }
  if (start >= end) { showToast('End time must be after start',  'error');  return; }

  if (!S.timetable) S.timetable = [];

  if (ttEditId != null) {
    const idx = S.timetable.findIndex(b => b.id === ttEditId);
    if (idx !== -1) S.timetable[idx] = { id: ttEditId, title, day, start, end, color: ttSelectedColor };
  } else {
    S.timetable.push({ id: S.nextId++, title, day, start, end, color: ttSelectedColor });
  }
  save();
  closeTTModal();
  renderTimetable();
  showToast(ttEditId != null ? 'Block updated' : 'Block added', 'success');
}

async function deleteTTBlock(): Promise<void> {
  if (ttEditId == null) return;
  const block = (S.timetable || []).find(b => b.id === ttEditId);
  const ok = await showConfirm({
    title:        'Remove this block?',
    message:      block ? `"${block.title}" will be removed from your timetable.` : '',
    confirmLabel: 'Remove',
    dangerous:    true,
  });
  if (!ok) return;
  S.timetable = (S.timetable || []).filter(b => b.id !== ttEditId);
  save();
  closeTTModal();
  renderTimetable();
  showToast('Block removed', 'info');
}

// Wire up timetable events (called once from init)
function initTimetable(): void {
  el('addBlockBtn')?.addEventListener('click', () => openTTModal());

  document.querySelectorAll<HTMLElement>('.tt-color').forEach(dot => {
    dot.addEventListener('click', () => {
      ttSelectedColor = dot.dataset['color'] || '#7c3aed';
      updateTTColorPicker();
    });
  });

  // Auto-bump end time if start moves past end
  el('ttBlockStart')?.addEventListener('change', () => {
    const startInp = el('ttBlockStart') as HTMLInputElement;
    const endInp   = el('ttBlockEnd')   as HTMLInputElement;
    if (startInp.value && endInp.value && startInp.value >= endInp.value) {
      const [sh, sm] = startInp.value.split(':').map(Number);
      const eh = Math.min(23, sh + 1);
      endInp.value = `${String(eh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
    }
  });

  // Keyboard shortcuts while modal is open
  document.addEventListener('keydown', (e) => {
    const modal = el('ttModal') as HTMLElement | null;
    if (!modal || !modal.classList.contains('open')) return;
    if (e.key === 'Escape') { e.preventDefault(); closeTTModal(); }
    else if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      saveTTBlock();
    }
  });

}

// Expose globals needed by inline onclick handlers — at module level so
// they're available even if initTimetable() never runs (e.g. earlier init
// throws). The + button's inline onclick relies on this.
(window as any).openTTModal   = openTTModal;
(window as any).closeTTModal  = closeTTModal;
(window as any).saveTTBlock   = saveTTBlock;
(window as any).deleteTTBlock = deleteTTBlock;


// ── SETTINGS ─────────────────────────────────────────────────────────────────
function renderSettings(): void {
  // Profile
  const name      = el('setName');
  const email     = el('setEmail');
  const avatar    = el('setAvatar');
  const displayName = (S.userName || firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'Signed-out');
  if (name)   name.textContent   = displayName;
  if (email)  email.textContent  = firebaseUser?.email || '';
  if (avatar) avatar.textContent = displayName.charAt(0).toUpperCase();

  // Focus / break / goal
  const fd = elInput('setFocusDuration');
  const bd = elInput('setBreakDuration');
  const dg = elInput('setDailyGoal');
  if (fd) fd.value = String(Math.round(S.focusDuration / 60));
  if (bd) bd.value = String(Math.round(S.breakDuration / 60));
  if (dg) dg.value = String(S.dailyGoal);
}

let _settingsDirtyTimer: number | undefined;
function settingsCommitDirty(): void {
  // Debounce so we don't fire save() on every keystroke
  window.clearTimeout(_settingsDirtyTimer);
  _settingsDirtyTimer = window.setTimeout(() => {
    save();
    showToast('Settings saved', 'success');
  }, 600);
}

function initSettings(): void {
  // Focus duration
  el('setFocusDuration')?.addEventListener('input', () => {
    const v = +(elInput('setFocusDuration')?.value || 0);
    if (v >= 1 && v <= 180) {
      S.focusDuration = v * 60;
      // If timer is idle and on focus view, reflect the new duration
      if (!timer.running) {
        timer.timeLeft  = S.focusDuration;
        timer.totalTime = S.focusDuration;
        if (currentView === 'focus') renderFocus();
      }
      settingsCommitDirty();
    }
  });

  // Break duration
  el('setBreakDuration')?.addEventListener('input', () => {
    const v = +(elInput('setBreakDuration')?.value || 0);
    if (v >= 1 && v <= 60) {
      S.breakDuration = v * 60;
      settingsCommitDirty();
    }
  });

  // Daily goal
  el('setDailyGoal')?.addEventListener('input', () => {
    const v = +(elInput('setDailyGoal')?.value || 0);
    if (v >= 15 && v <= 1440) {
      S.dailyGoal = v;
      settingsCommitDirty();
      // Reflect on home if visible
      if (currentView === 'home') renderHome();
    }
  });

  // Edit name
  el('setEditNameBtn')?.addEventListener('click', async () => {
    const res = await showPrompt({
      title:    'Update display name',
      message:  'Shown across Brainfy and used by your AI tutor for greetings.',
      okLabel:  'Save',
      fields:   [{ id: 'name', label: 'Your name', defaultValue: S.userName, required: true }],
    });
    if (!res) return;
    S.userName = res['name'];
    save();
    renderSettings();
    if (currentView === 'home') renderHome();
    showToast('Name updated', 'success');
  });

  // Sign out
  el('setSignOutBtn')?.addEventListener('click', async () => {
    const ok = await showConfirm({
      title:        'Sign out of Brainfy?',
      message:      'Your local data stays on this device. You can sign back in anytime.',
      confirmLabel: 'Sign out',
      dangerous:    true,
    });
    if (!ok) return;
    try { await firebase.auth().signOut(); } catch (_) {}
    firebaseUser = null;
    idToken      = '';
    goTo('splash');
  });

  // Export
  el('setExportBtn')?.addEventListener('click', () => {
    try {
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
      const a    = document.createElement('a');
      a.href     = URL.createObjectURL(blob);
      a.download = `brainfy-export-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      showToast('Exported your data', 'success');
    } catch (e: any) {
      showToast('Export failed: ' + (e?.message || e), 'error');
    }
  });

  // Clear local cache
  el('setClearLocalBtn')?.addEventListener('click', async () => {
    const ok = await showConfirm({
      title:        'Clear local cache?',
      message:      'Removes data stored on this device only. Cloud-synced data is unaffected and will reload on next sign-in.',
      confirmLabel: 'Clear cache',
      dangerous:    true,
    });
    if (!ok) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    showToast('Local cache cleared — reloading', 'info');
    setTimeout(() => location.reload(), 600);
  });

  // Delete account — irreversibly removes Storage files, Firestore doc, Auth user.
  el('setDeleteAccountBtn')?.addEventListener('click', deleteAccount);
}


// ── GLOBAL SEARCH (⌘K command palette) ───────────────────────────────────────
interface SearchResult {
  group:     string;        // section heading
  iconName:  string;        // icon() name
  iconColor: string;
  title:     string;
  subtitle:  string;
  action:    () => void;    // run on select
}

let searchFlat:   SearchResult[] = [];   // currently-rendered (filtered) list
let searchSelIdx = 0;

// Collect everything searchable into one flat list. Rebuilt each open() so it
// always reflects current state — the data set is small enough that this is free.
function buildSearchIndex(): SearchResult[] {
  const out: SearchResult[] = [];

  S.subjects.forEach(s => {
    out.push({
      group: 'Subjects', iconName: 'book', iconColor: s.color || 'var(--plight)',
      title: s.name, subtitle: s.desc || 'Subject',
      action: () => { goTo('library'); window.setTimeout(() => openDocModal(s.id), 220); },
    });
    (s.documents || []).forEach(d => {
      out.push({
        group: 'Documents', iconName: docIcon(d.type), iconColor: 'var(--cyan)',
        title: d.name, subtitle: `in ${s.name}`,
        action: () => { goTo('library'); window.setTimeout(() => openDocModal(s.id), 220); },
      });
    });
  });

  S.tasks.forEach(t => {
    out.push({
      group: 'Tasks',
      iconName:  t.done ? 'check_circle' : 'checklist',
      iconColor: t.done ? 'var(--green)'  : 'var(--plight)',
      title: t.text, subtitle: t.done ? 'Task · completed' : 'Task',
      action: () => goTo('tasks'),
    });
  });

  S.milestones.forEach(m => {
    out.push({
      group: 'Milestones', iconName: 'flag', iconColor: 'var(--plight)',
      title: m.text, subtitle: 'Session milestone',
      action: () => goTo('focus'),
    });
  });

  (S.timetable || []).forEach(b => {
    out.push({
      group: 'Timetable', iconName: 'calendar_today', iconColor: b.color || 'var(--cyan)',
      title: b.title, subtitle: `${TT_DAYS[b.day]} · ${b.start}–${b.end}`,
      action: () => { goTo('timetable'); window.setTimeout(() => openTTModal(b.id), 220); },
    });
  });

  return out;
}

function renderSearchResults(query: string): void {
  const box = el('searchResults');
  if (!box) return;
  const all = buildSearchIndex();
  const q   = query.trim().toLowerCase();

  const matches = q
    ? all.filter(r => (r.title + ' ' + r.subtitle).toLowerCase().includes(q))
    : all;

  searchFlat   = matches;
  searchSelIdx = 0;

  if (all.length === 0) {
    box.innerHTML = `<div style="padding:36px 20px;text-align:center;color:var(--muted);font-size:13px;">Nothing to search yet — add subjects, tasks or blocks first.</div>`;
    return;
  }
  if (matches.length === 0) {
    box.innerHTML = `<div style="padding:36px 20px;text-align:center;color:var(--muted);font-size:13px;">No results for “${_e(query)}”</div>`;
    return;
  }

  let html = '';
  let lastGroup = '';
  matches.forEach((r, i) => {
    if (r.group !== lastGroup) {
      html += `<div class="search-group-label">${r.group}</div>`;
      lastGroup = r.group;
    }
    html += `
      <div class="search-result${i === 0 ? ' selected' : ''}" data-idx="${i}">
        <div class="sr-icon">${icon(r.iconName, { size: 15, color: r.iconColor })}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13.5px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-0.01em;">${_e(r.title)}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_e(r.subtitle)}</div>
        </div>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.4;"><polyline points="9 18 15 12 9 6"/></svg>
      </div>`;
  });
  box.innerHTML = html;

  box.querySelectorAll<HTMLElement>('.search-result').forEach(row => {
    row.addEventListener('click', () => fireSearchResult(+(row.dataset['idx'] || '0')));
    row.addEventListener('mousemove', () => {
      const idx = +(row.dataset['idx'] || '0');
      if (idx !== searchSelIdx) { searchSelIdx = idx; paintSearchSelection(); }
    });
  });
}

function paintSearchSelection(): void {
  const box = el('searchResults');
  if (!box) return;
  box.querySelectorAll<HTMLElement>('.search-result').forEach(row => {
    const idx = +(row.dataset['idx'] || '0');
    const on  = idx === searchSelIdx;
    row.classList.toggle('selected', on);
    if (on) row.scrollIntoView({ block: 'nearest' });
  });
}

function fireSearchResult(idx: number): void {
  const r = searchFlat[idx];
  if (!r) return;
  closeSearch();
  r.action();
}

function openSearch(): void {
  const modal = el('searchModal') as HTMLElement | null;
  const input = el('searchInput') as HTMLInputElement | null;
  if (!modal || !input) return;
  input.value = '';
  renderSearchResults('');
  modal.style.display = 'flex';
  requestAnimationFrame(() => modal.classList.add('open'));
  setTimeout(() => input.focus(), 60);
}

function closeSearch(): void {
  const modal = el('searchModal') as HTMLElement | null;
  if (!modal) return;
  modal.classList.remove('open');
  setTimeout(() => { modal.style.display = 'none'; }, 200);
}

function initSearch(): void {
  const input = el('searchInput') as HTMLInputElement | null;
  input?.addEventListener('input', () => renderSearchResults(input.value));

  document.addEventListener('keydown', e => {
    // ⌘K / Ctrl+K toggles the palette — only inside the app
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      if (!document.body.classList.contains('app-active')) return;
      e.preventDefault();
      const m = el('searchModal');
      if (m && m.classList.contains('open')) closeSearch();
      else openSearch();
      return;
    }
    // Navigation while the palette is open
    const m = el('searchModal');
    if (!m || !m.classList.contains('open')) return;
    if (e.key === 'Escape') {
      e.preventDefault(); closeSearch();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (searchSelIdx < searchFlat.length - 1) { searchSelIdx++; paintSearchSelection(); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (searchSelIdx > 0) { searchSelIdx--; paintSearchSelection(); }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      fireSearchResult(searchSelIdx);
    }
  });
}

// Exposed so the sidebar / mobile-top-bar inline onclicks can reach them
(window as any).openSearch  = openSearch;
(window as any).closeSearch = closeSearch;


// ── GUIDED TOUR (first-run) ──────────────────────────────────────────────────
// Walks new users through the Home dashboard. Each step highlights a real
// element with a glowing spotlight + scale and pops a tooltip next to it.

interface TourStep {
  target: string;        // CSS selector — first match wins
  title:  string;
  body:   string;
  side?:  'auto' | 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
  {
    // Target the inner flex row, NOT the padded wrapper. The wrapper sits
    // flush at (0,0) of the viewport so the .tour-target outline + glow
    // (extends ~15px outward) gets clipped at the top/left edges. The inner
    // row sits inside 22px top / 18px left padding — comfortable clearance.
    target: '#appSidebar > div:first-child > div',
    title:  'Welcome to Brainfy',
    body:   'Your private, AI-powered study companion. A 90-second tour so you know where everything lives.',
    side:   'right',
  },
  {
    target: '#sidebarSearchBtn',
    title:  'Search anything · ⌘K',
    body:   'Find any subject, document, task, milestone or timetable block — from anywhere in the app. Press ⌘K (or Ctrl+K).',
    side:   'right',
  },
  {
    target: '#homeView .hd-stat:first-child',
    title:  'Today\'s focus, at a glance',
    body:   'Four cards show today\'s focused minutes, your cognitive score, your current streak, and sessions completed.',
    side:   'bottom',
  },
  {
    target: '#goalProgressBar',
    title:  'Daily focus goal',
    body:   'Set a daily target you can actually hit. Edit it any time from Settings → Focus & Breaks.',
    side:   'bottom',
  },
  {
    target: '#focusTimeChart',
    title:  'Your week, visualised',
    body:   'Focus minutes per day across the last week. Today\'s bar lights up cyan.',
    side:   'top',
  },
  {
    target: '#focusScoreNum',
    title:  'Cognitive state',
    body:   'Your composite focus score — builds with consistency, not single big sessions.',
    side:   'left',
  },
  {
    target: '#aiNavBtn',
    title:  'Stuck? Ask Brainfy AI',
    body:   'Explain any concept, generate flashcards from your notes, quiz yourself, or plan your week. It knows your subjects.',
    side:   'right',
  },
  {
    target: '#sidebarStartBtn',
    title:  'Ready? Start a session',
    body:   'Pick a subject, set an intention, and begin deep work. That\'s where the data above starts to come alive.',
    side:   'right',
  },
];

let tourIdx     = 0;
let tourActive  = false;
let tourTarget: HTMLElement | null = null;
let _tourKeyHandler: ((e: KeyboardEvent) => void) | null = null;
let _tourResizeHandler: (() => void) | null = null;

function startTour(): void {
  if (tourActive) return;
  tourActive = true;
  tourIdx    = 0;

  // If we're not on Home, switch — every step assumes home/sidebar are visible.
  if (currentView !== 'home') goTo('home');

  // Build the step dots
  const dots = document.getElementById('tourDots');
  if (dots) {
    dots.innerHTML = '';
    for (let i = 0; i < TOUR_STEPS.length; i++) {
      const d = document.createElement('span');
      dots.appendChild(d);
    }
  }

  // Keyboard: Esc skip, Enter / → advance, ← back
  _tourKeyHandler = (e: KeyboardEvent) => {
    if (!tourActive) return;
    if (e.key === 'Escape') { e.preventDefault(); endTour(false); }
    else if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); nextTourStep(); }
    else if (e.key === 'ArrowLeft' && tourIdx > 0) { e.preventDefault(); tourIdx -= 2; nextTourStep(); }
  };
  document.addEventListener('keydown', _tourKeyHandler);

  // Reposition on resize/scroll so the spotlight tracks the target
  _tourResizeHandler = () => paintTourStep();
  window.addEventListener('resize', _tourResizeHandler, { passive: true });
  window.addEventListener('scroll',  _tourResizeHandler, { passive: true });

  // Show strips + first step
  document.body.classList.add('tour-active');
  paintTourStep();
}

// Position the 4 dark strips so they frame the target's bounding rect,
// leaving a transparent "hole" of brightness over the target itself.
function paintTourStrips(rect: DOMRect): void {
  const pad = 10;
  const top    = Math.max(0, rect.top    - pad);
  const left   = Math.max(0, rect.left   - pad);
  const right  = Math.min(window.innerWidth,  rect.right  + pad);
  const bottom = Math.min(window.innerHeight, rect.bottom + pad);

  const sTop    = document.getElementById('tourStripTop')    as HTMLElement | null;
  const sBottom = document.getElementById('tourStripBottom') as HTMLElement | null;
  const sLeft   = document.getElementById('tourStripLeft')   as HTMLElement | null;
  const sRight  = document.getElementById('tourStripRight')  as HTMLElement | null;
  if (!sTop || !sBottom || !sLeft || !sRight) return;

  // Top strip — full width, from page top down to target's top
  sTop.style.top    = '0px';
  sTop.style.left   = '0px';
  sTop.style.width  = '100vw';
  sTop.style.height = `${top}px`;

  // Bottom strip — full width, from target's bottom to page bottom
  sBottom.style.top    = `${bottom}px`;
  sBottom.style.left   = '0px';
  sBottom.style.width  = '100vw';
  sBottom.style.height = `${Math.max(0, window.innerHeight - bottom)}px`;

  // Left strip — between top and bottom strips, from page left to target's left
  sLeft.style.top    = `${top}px`;
  sLeft.style.left   = '0px';
  sLeft.style.width  = `${left}px`;
  sLeft.style.height = `${bottom - top}px`;

  // Right strip — between top and bottom strips, from target's right to page right
  sRight.style.top    = `${top}px`;
  sRight.style.left   = `${right}px`;
  sRight.style.width  = `${Math.max(0, window.innerWidth - right)}px`;
  sRight.style.height = `${bottom - top}px`;
}

function nextTourStep(): void {
  if (!tourActive) return;
  tourIdx++;
  if (tourIdx >= TOUR_STEPS.length) { endTour(true); return; }
  paintTourStep();
}

function paintTourStep(): void {
  if (!tourActive) return;
  const step = TOUR_STEPS[tourIdx];
  if (!step) return;

  // Clear ALL stray targets — defensive against rapid Next clicks where
  // multiple paintTourStep calls overlap and their deferred classList.add
  // would otherwise leave previous targets still tagged.
  document.querySelectorAll<HTMLElement>('.tour-target').forEach(el => el.classList.remove('tour-target'));
  tourTarget = null;

  const target = document.querySelector<HTMLElement>(step.target);
  if (!target) {
    // Couldn't find this step's target — skip it
    nextTourStep();
    return;
  }

  // Bring the target into view, then highlight + position the tooltip
  target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  // Give the scroll a moment so getBoundingClientRect is accurate
  setTimeout(() => {
    if (!tourActive) return;
    target.classList.add('tour-target');
    tourTarget = target;
    paintTourStrips(target.getBoundingClientRect());
    positionTourTooltip(target, step);
  }, 280);
}

function positionTourTooltip(target: HTMLElement, step: TourStep): void {
  const tooltip = document.getElementById('tourTooltip') as HTMLElement | null;
  const titleEl = document.getElementById('tourTitle');
  const bodyEl  = document.getElementById('tourBody');
  const stepEl  = document.getElementById('tourStepLabel');
  const nextBtn = document.getElementById('tourNextBtn');
  const dots    = document.getElementById('tourDots');
  if (!tooltip || !titleEl || !bodyEl || !stepEl || !nextBtn) return;

  // Populate content
  titleEl.textContent = step.title;
  bodyEl.textContent  = step.body;
  stepEl.textContent  = `STEP ${tourIdx + 1} / ${TOUR_STEPS.length}`;
  nextBtn.textContent = tourIdx === TOUR_STEPS.length - 1 ? 'Finish' : 'Next';
  if (dots) {
    Array.from(dots.children).forEach((d, i) => {
      d.classList.toggle('on', i === tourIdx);
    });
  }

  // Compute placement. Need actual tooltip size before deciding.
  tooltip.style.left = '-9999px'; tooltip.style.top = '0px';
  tooltip.classList.add('visible');
  const tt = tooltip.getBoundingClientRect();
  const r  = target.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gap = 14;

  // Auto-pick the side with the most room — preferring the step's hint
  const space = {
    top:    r.top,
    bottom: vh - r.bottom,
    left:   r.left,
    right:  vw - r.right,
  };
  const sideOrder: ('bottom'|'top'|'right'|'left')[] = step.side && step.side !== 'auto'
    ? [step.side as any, 'bottom', 'right', 'top', 'left']
    : ['bottom', 'right', 'top', 'left'];
  let chosen: 'top'|'bottom'|'left'|'right' = 'bottom';
  for (const s of sideOrder) {
    if (s === 'top'    && space.top    >= tt.height + gap) { chosen = 'top';    break; }
    if (s === 'bottom' && space.bottom >= tt.height + gap) { chosen = 'bottom'; break; }
    if (s === 'left'   && space.left   >= tt.width  + gap) { chosen = 'left';   break; }
    if (s === 'right'  && space.right  >= tt.width  + gap) { chosen = 'right';  break; }
  }

  // Compute position based on chosen side
  let x = 0, y = 0;
  if (chosen === 'bottom') {
    y = r.bottom + gap;
    x = r.left + r.width / 2 - tt.width / 2;
  } else if (chosen === 'top') {
    y = r.top - gap - tt.height;
    x = r.left + r.width / 2 - tt.width / 2;
  } else if (chosen === 'right') {
    x = r.right + gap;
    y = r.top + r.height / 2 - tt.height / 2;
  } else { // left
    x = r.left - gap - tt.width;
    y = r.top + r.height / 2 - tt.height / 2;
  }

  // Clamp to viewport
  x = Math.max(12, Math.min(x, vw - tt.width  - 12));
  y = Math.max(12, Math.min(y, vh - tt.height - 12));

  tooltip.style.left = `${x}px`;
  tooltip.style.top  = `${y}px`;
}

function endTour(completed: boolean): void {
  if (!tourActive) return;
  tourActive = false;

  // Belt-and-braces cleanup of any tagged targets
  document.querySelectorAll<HTMLElement>('.tour-target').forEach(el => el.classList.remove('tour-target'));
  tourTarget = null;
  document.body.classList.remove('tour-active');
  const tooltip = document.getElementById('tourTooltip');
  if (tooltip) tooltip.classList.remove('visible');

  if (_tourKeyHandler)    document.removeEventListener('keydown', _tourKeyHandler);
  if (_tourResizeHandler) {
    window.removeEventListener('resize', _tourResizeHandler);
    window.removeEventListener('scroll', _tourResizeHandler);
  }
  _tourKeyHandler = null;
  _tourResizeHandler = null;

  // Mark seen so we never auto-show again (skip counts as "seen" too — they
  // can always replay it from Settings).
  S.tourSeen = true;
  save();

  if (completed) showToast('Tour complete — happy studying.', 'success');
}

// Expose for inline onclicks (Settings re-run + tooltip buttons)
(window as any).startTour    = startTour;
(window as any).nextTourStep = nextTourStep;
(window as any).endTour      = endTour;
