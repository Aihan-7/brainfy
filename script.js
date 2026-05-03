// ══════════════════════════════════════════════════
//  Brainfy — script.js
// ══════════════════════════════════════════════════

const STORAGE_KEY = 'brainfy_v3';
const TIMER_C = 754;   // 2π × 120  (timer ring circumference)
const SCORE_C = 339;   // 2π × 54   (score ring circumference)

const QUOTES = [
  { t: '"The important thing is not to stop questioning. Curiosity has its own reason for existence."', a: 'Albert Einstein' },
  { t: '"An investment in knowledge pays the best interest."', a: 'Benjamin Franklin' },
  { t: '"Live as if you were to die tomorrow. Learn as if you were to live forever."', a: 'Mahatma Gandhi' },
  { t: '"It is not that I\'m so smart. But I stay with the questions much longer."', a: 'Albert Einstein' },
  { t: '"The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice."', a: 'Brian Herbert' },
  { t: '"Education is not the filling of a pail, but the lighting of a fire."', a: 'W.B. Yeats' },
  { t: '"The beautiful thing about learning is that no one can take it away from you."', a: 'B.B. King' },
  { t: '"Tell me and I forget. Teach me and I remember. Involve me and I learn."', a: 'Benjamin Franklin' },
];

const SUBJECT_COLORS = ['#7c3aed','#0891b2','#065f46','#9a3412','#1e40af','#b45309','#be185d'];

// ── Flashcard data sets ──────────────────────────────────────────────────────
const FLASHCARD_SETS = {
  1: [
    { q:'What is a stereocenter?', a:'A carbon atom bonded to four different groups, creating non-superimposable mirror images called enantiomers.' },
    { q:'Define an SN2 reaction', a:'Bimolecular nucleophilic substitution — the nucleophile attacks from the back in a single concerted step, inverting the stereocenter (Walden inversion).' },
    { q:"What is Markovnikov's Rule?", a:'In electrophilic addition, hydrogen adds to the carbon that already has more hydrogens, while the electrophile adds to the more substituted carbon.' },
    { q:"Define aromaticity (Hückel's Rule)", a:'A cyclic, planar, fully conjugated system with 4n+2 π electrons (n = 0,1,2…) is aromatic and unusually stable.' },
    { q:'What distinguishes R from S configuration?', a:'Using CIP priority rules, if the remaining three groups decrease in priority clockwise = R; counter-clockwise = S (with lowest-priority group pointing away).' },
    { q:'What is a resonance structure?', a:'One of two or more Lewis structures for the same molecule differing only in electron distribution — the actual molecule is a hybrid of all.' },
  ],
  2: [
    { q:'Define GDP', a:'Gross Domestic Product — total market value of all final goods and services produced within a country in a period. GDP = C + I + G + (X−M).' },
    { q:'What is the Phillips Curve?', a:'An empirical inverse relationship between unemployment and inflation — as unemployment falls, inflation tends to rise, and vice versa.' },
    { q:'Define monetary policy', a:'Central bank actions (adjusting interest rates, open market operations, reserve requirements) to control money supply and achieve macroeconomic stability.' },
    { q:'What is the multiplier effect?', a:'An initial change in spending triggers a larger total change in income. Multiplier = 1 / (1 − MPC), where MPC is marginal propensity to consume.' },
    { q:'Define an inflationary gap', a:'When actual GDP exceeds potential GDP, pushing the economy above full employment and creating upward price pressure.' },
    { q:'What is the liquidity trap?', a:'When interest rates are near zero and monetary policy loses effectiveness because people hoard cash instead of investing or spending.' },
  ],
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
  userName: 'Alex',
  subjects: [
    { id:1, name:'Organic Chemistry', desc:'Stereochemistry & Reaction Mechanisms', docs:32, color:'#7c3aed', accessed: Date.now()-86400000 },
    { id:2, name:'Macroeconomics',    desc:'Monetary Policy & Inflationary Gaps',  docs:18, color:'#0891b2', accessed: Date.now()-3600000  },
    { id:3, name:'Exam Prep',         desc:'Final semester comprehensive review',  docs:24, color:'#065f46', accessed: Date.now()-7200000  },
    { id:4, name:'Research Papers',   desc:'Peer-reviewed journals & metadata',    docs:12, color:'#9a3412', accessed: Date.now()-172800000 },
  ],
  tasks: [
    { id:1, text:'Review Benzene notes',   done:false },
    { id:2, text:'Quiz: GDP Components',   done:false },
    { id:3, text:'Schedule mock exam',     done:false },
  ],
  milestones: [
    { id:1, text:'Review Lecture 4',   done:true  },
    { id:2, text:'Derive Equation X',  done:false },
  ],
  sessions: [],          // { date:ISO, duration:s, subjectId }
  focusDuration: 25*60,
  breakDuration:  5*60,
  ambient: { lofi:0, rain:0, white:0, forest:0 },
  sessionNotes: '',
  dailyGoal: 120,        // minutes
  nextId: 20,
};

// ── Runtime state ───────────────────────────────────────────────────────────
let S = {};          // persisted state (copy of DEFAULT_STATE + localStorage)
let currentView = 'splash';

const timer = {
  interval: null,
  timeLeft: 25*60,
  totalTime: 25*60,
  running: false,
  mode: 'focus',     // 'focus' | 'break'
  subjectId: null,
  intent: '',
};

// ── Web Audio Ambient Engine ─────────────────────────────────────────────────
let audioCtx = null;
const ambientNodes = {};   // key → { gainNode, sources[] }

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function makeNoiseBuffer(ctx) {
  const len = 3 * ctx.sampleRate;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d   = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function startAmbientKey(key, vol) {
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

function stopAmbientKey(key) {
  const node = ambientNodes[key];
  if (!node || !audioCtx) return;
  const { gainNode, sources } = node;
  gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.4);
  setTimeout(() => {
    sources.forEach(s => { try { if (s.stop) s.stop(); else s.disconnect(); } catch(_){} });
    try { gainNode.disconnect(); } catch(_){}
    delete ambientNodes[key];
  }, 1500);
}

function setAmbientVol(key, vol) {
  const node = ambientNodes[key];
  if (!node || !audioCtx) return;
  node.gainNode.gain.setTargetAtTime(vol / 100 * 0.35, audioCtx.currentTime, 0.2);
}

function syncAmbient() {
  ['lofi','rain','white','forest'].forEach(k => {
    const v = S.ambient[k] || 0;
    if (v > 0) startAmbientKey(k, v);
    else       stopAmbientKey(k);
  });
}

// ── Flashcard State ──────────────────────────────────────────────────────────
const fc = { cards: [], idx: 0, flipped: false, scores: { easy:0, ok:0, hard:0 } };

function openFlashcards(subjectId) {
  const subj  = S.subjects.find(s => s.id === subjectId);
  const set   = FLASHCARD_SETS[subjectId] || FLASHCARD_SETS.default;
  fc.cards   = [...set];
  fc.idx     = 0;
  fc.flipped = false;
  fc.scores  = { easy:0, ok:0, hard:0 };

  const modal = document.getElementById('flashcardModal');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  const label = document.getElementById('fcSubjectLabel');
  if (label) label.textContent = subj ? subj.name.toUpperCase() : 'FLASHCARDS';

  renderFC();
}

function closeFlashcards() {
  document.getElementById('flashcardModal').classList.remove('open');
  document.body.style.overflow = '';
}

function renderFC() {
  const card  = fc.cards[fc.idx];
  const total = fc.cards.length;

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
  ['easy','ok','hard'].forEach(k => {
    const el = document.getElementById('fc' + k.charAt(0).toUpperCase() + k.slice(1) + 'Count');
    if (el) el.textContent = fc.scores[k];
  });
}

function flipCard() {
  fc.flipped = !fc.flipped;
  const card = document.getElementById('fcCard');
  if (card) card.classList.toggle('flipped', fc.flipped);
  const rating = document.getElementById('fcRating');
  if (rating) rating.style.display = fc.flipped ? 'flex' : 'none';
}

function fcNav(dir) {
  fc.idx = Math.max(0, Math.min(fc.cards.length - 1, fc.idx + dir));
  renderFC();
}

function rateCard(rating) {
  fc.scores[rating]++;
  if (fc.idx < fc.cards.length - 1) {
    fc.idx++;
    renderFC();
  } else {
    // Session complete
    const { easy, ok, hard } = fc.scores;
    const total = easy + ok + hard;
    document.getElementById('flashcardModal').innerHTML = `
      <div style="max-width:500px;margin:80px auto;text-align:center;">
        <div style="font-size:56px;margin-bottom:20px;">🎉</div>
        <h2 style="font-size:28px;font-weight:900;color:white;margin-bottom:12px;">Session Complete!</h2>
        <p style="font-size:15px;color:var(--muted);margin-bottom:32px;">You reviewed all ${total} cards.</p>
        <div style="display:flex;gap:16px;justify-content:center;margin-bottom:36px;">
          <div style="padding:16px 24px;border-radius:14px;background:rgba(78,222,163,0.1);border:1px solid rgba(78,222,163,0.2);">
            <div style="font-size:28px;font-weight:900;color:var(--green);">${easy}</div>
            <div style="font-size:10px;color:var(--muted);letter-spacing:0.1em;margin-top:4px;">EASY</div>
          </div>
          <div style="padding:16px 24px;border-radius:14px;background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.2);">
            <div style="font-size:28px;font-weight:900;color:#fb923c;">${ok}</div>
            <div style="font-size:10px;color:var(--muted);letter-spacing:0.1em;margin-top:4px;">MEDIUM</div>
          </div>
          <div style="padding:16px 24px;border-radius:14px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);">
            <div style="font-size:28px;font-weight:900;color:#f87171;">${hard}</div>
            <div style="font-size:10px;color:var(--muted);letter-spacing:0.1em;margin-top:4px;">HARD</div>
          </div>
        </div>
        <button onclick="closeFlashcards()" style="padding:13px 44px;background:linear-gradient(135deg,var(--primary),#6d28d9);border:none;border-radius:12px;color:white;font-size:15px;font-weight:700;cursor:pointer;font-family:'Manrope',sans-serif;box-shadow:0 6px 24px rgba(124,58,237,0.4);">Done</button>
      </div>`;
  }
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

// ── Persistence ─────────────────────────────────────────────────────────────
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); } catch(_) {}
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

// ── Router ──────────────────────────────────────────────────────────────────
function goTo(view) {
  // Smooth exit: fade out current view slightly before switching
  const prevEl = document.querySelector('.view.active');
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

function _goToFinish(view) {
  currentView = view;

  const isApp = !['splash', 'signin', 'signup'].includes(view);
  document.body.classList.toggle('app-active', isApp);

  document.querySelectorAll('[data-go]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.go === view);
  });

  if (view === 'home')    renderHome();
  if (view === 'focus')   renderFocus();
  if (view === 'library') renderLibrary();
  if (view === 'stats')   renderStats();
  if (view === 'tasks')   renderTasks();

  // Re-trigger stagger animations on stat cards
  if (view === 'home') {
    document.querySelectorAll('.hd-stat').forEach(c => {
      c.style.animation = 'none';
      void c.offsetWidth; // reflow
      c.style.animation = '';
    });
  }

  save();
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function todayStr() { return new Date().toDateString(); }

function todayFocusSec() {
  return S.sessions
    .filter(s => new Date(s.date).toDateString() === todayStr())
    .reduce((n, s) => n + s.duration, 0);
}

function calcScore() {
  const hrs   = todayFocusSec() / 3600;
  const strk  = Math.min(40, (S.streak || 0) * 3);
  const focus = Math.min(40, hrs * 10);
  const sess  = Math.min(20, S.sessions.filter(s => new Date(s.date).toDateString() === todayStr()).length * 5);
  const total = Math.round(strk + focus + sess);
  return total || 82;
}

function timeAgo(ts) {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

function fmtTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return h + 'h ' + m + 'm';
  if (m > 0) return m + 'm';
  return '<1m';
}

function el(id) { return document.getElementById(id); }

// ── HOME ────────────────────────────────────────────────────────────────────
function renderHome() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Greeting
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const g = el('homeGreeting');
  if (g) g.textContent = greet + ', ' + S.userName;

  // Streak label
  const sl = el('homeStreakLabel');
  const streak = S.streak || 3;
  if (sl) sl.textContent = streak + ' DAY STREAK';

  // Focus time
  const secs = todayFocusSec();
  const ft = el('homeFocusTime');
  if (ft) ft.textContent = secs > 0 ? fmtTime(secs) : '0m';

  // Sessions today
  const todaySessions = S.sessions.filter(s => new Date(s.date).toDateString() === todayStr());
  const sc = el('homeSessionCount');
  if (sc) sc.textContent = todaySessions.length;

  // Streak num
  const sn2 = el('homeStreakNum');
  if (sn2) sn2.textContent = streak;

  // Score — animated countUp on ring + both stat displays
  const score = calcScore();
  const ringC = 2 * Math.PI * 58; // r=58 new ring
  const ring = el('focusScoreRing');
  if (ring) ring.setAttribute('stroke-dashoffset', ringC * (1 - score / 100));

  function countUp(elId, target, duration) {
    const node = el(elId);
    if (!node) return;
    if (reduced) { node.textContent = target; return; }
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      node.textContent = Math.round(eased * target);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  countUp('focusScoreNum', score, 900);
  countUp('homeScoreStatNum', score, 900);

  renderFocusTimeChart();
  renderHomeSubjects();
  renderHomeTasks();
  renderHomeHeatmap();
  renderGoalProgress();
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

function promptGoal() {
  const cur = S.dailyGoal || 120;
  const input = prompt(`Daily focus goal (minutes):\nCurrent: ${cur} min`, cur);
  const parsed = parseInt(input, 10);
  if (!isNaN(parsed) && parsed > 0) {
    S.dailyGoal = Math.max(5, Math.min(480, parsed));
    save();
    renderGoalProgress();
    showToast(`Daily goal set to ${S.dailyGoal} minutes`, 'success');
  }
}

function renderHomeHeatmap() {
  const wrap = el('homeHeatmap');
  const labels = el('homeHeatmapLabels');
  if (!wrap) return;

  const COLS = 84; // 12 weeks × 7 days
  const ROWS = 7;
  const now  = new Date();

  // Build day-indexed session counts for last 84 days
  const counts = {};
  S.sessions.forEach(s => {
    const key = new Date(s.date).toDateString();
    counts[key] = (counts[key] || 0) + 1;
  });

  // Generate 12 columns (weeks), each containing 7 day-cells stacked vertically
  const weeks = [];
  for (let w = 11; w >= 0; w--) {
    const cells = [];
    for (let d = 6; d >= 0; d--) {
      const day = new Date(now);
      day.setDate(now.getDate() - (w * 7 + d));
      const c = counts[day.toDateString()] || 0;
      const isToday = day.toDateString() === now.toDateString();
      const level = c === 0 ? 0 : c === 1 ? 1 : c <= 3 ? 2 : c <= 5 ? 3 : 4;
      const alphas = ['0.07', '0.25', '0.48', '0.72', '1'];
      const bg = isToday
        ? `rgba(76,215,246,${alphas[Math.max(level, 1)]})`
        : `rgba(124,58,237,${alphas[level]})`;
      const title = `${day.toLocaleDateString('en-US',{month:'short',day:'numeric'})}: ${c} session${c !== 1 ? 's' : ''}`;
      cells.push(`<div style="width:10px;height:10px;border-radius:2px;background:${bg};margin-bottom:3px;${isToday ? 'box-shadow:0 0 6px rgba(76,215,246,0.5);' : ''}" title="${title}"></div>`);
    }
    weeks.push(`<div style="display:flex;flex-direction:column;">${cells.join('')}</div>`);
  }
  wrap.innerHTML = weeks.join('');

  // Month labels
  if (labels) {
    const months = [];
    for (let w = 11; w >= 0; w--) {
      const day = new Date(now);
      day.setDate(now.getDate() - w * 7);
      months.push(day.toLocaleDateString('en-US', { month: 'short' }));
    }
    // Deduplicate adjacent same-month labels
    labels.innerHTML = months.map((m, i) => {
      const show = i === 0 || months[i - 1] !== m;
      return `<span style="${show ? '' : 'visibility:hidden'}">${m}</span>`;
    }).join('');
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

function renderHomeSubjects() {
  const c = el('homeSubjectCards');
  if (!c) return;
  const recent = [...S.subjects].sort((a,b) => b.accessed - a.accessed).slice(0, 4);
  if (!recent.length) {
    c.innerHTML = '<p style="color:var(--muted);font-size:13px;grid-column:span 2;">No subjects yet — add some in the Library.</p>';
    return;
  }
  c.innerHTML = recent.map(s => `
    <div class="subj-card" data-id="${s.id}" onclick="startSubject(${s.id})"
      onmouseenter="this.style.borderColor='${s.color}66';this.style.boxShadow='0 4px 24px ${s.color}22'"
      onmouseleave="this.style.borderColor='';this.style.boxShadow=''">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
        <span style="font-size:10px;letter-spacing:0.08em;color:var(--muted);">ETA: ${Math.ceil(s.docs/8)} HRS</span>
        <div style="width:28px;height:28px;border-radius:7px;background:${s.color}22;display:flex;align-items:center;justify-content:center;">
          <span class="ms" style="font-size:16px;color:${s.color};">menu_book</span>
        </div>
      </div>
      <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${s.name}</div>
      <div style="font-size:12px;color:var(--muted);line-height:1.4;margin-bottom:14px;">${s.desc}</div>
      <div style="height:2px;background:rgba(255,255,255,0.07);border-radius:2px;">
        <div style="width:${Math.min(85, s.docs % 100)}%;height:100%;background:${s.color};border-radius:2px;"></div>
      </div>
    </div>
  `).join('');
}

function startSubject(id) {
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
      <span style="font-size:13px;flex:1;${t.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${t.text}</span>
    </div>
  `).join('');

  list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = +cb.dataset.id;
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
      <text x="${n.x}" y="${n.y + 22}" text-anchor="middle" fill="#64748b" font-size="10" font-family="Manrope,sans-serif">${n.name.split(' ')[0]}</text>
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
        + S.subjects.map(s => `<option value="${s.id}" style="background:#0d1628;" ${s.id === timer.subjectId ? 'selected' : ''}>${s.name}</option>`).join('');
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

  const notes = el('quickNotesInput');
  if (notes) notes.value = S.sessionNotes;
}

function renderAmbient() {
  const list = el('ambientList');
  if (!list) return;

  const sounds = [
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
  list.querySelectorAll('.amb-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.amb;
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
  list.querySelectorAll('input[type="range"]').forEach(sl => {
    sl.addEventListener('input', e => {
      e.stopPropagation();
      const k = sl.dataset.sound;
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
        <div style="font-size:12px;font-weight:600;${m.done ? 'text-decoration:line-through;color:var(--muted)' : 'color:var(--text)'}">${m.text}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px;">${m.done ? 'Completed' : 'Next milestone'}</div>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const m = S.milestones.find(x => x.id === +cb.dataset.id);
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

// ── TIMER ENGINE ─────────────────────────────────────────────────────────────
function updateTimerDisplay() {
  const m = Math.floor(timer.timeLeft / 60);
  const s = timer.timeLeft % 60;
  const disp = el('timerDisplay');
  if (disp) disp.textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');

  const ring = el('timerRing');
  if (ring) {
    const pct = timer.timeLeft / timer.totalTime;
    ring.setAttribute('stroke-dashoffset', TIMER_C * (1 - pct));
    ring.setAttribute('stroke', timer.mode === 'break' ? 'var(--green)' : 'var(--cyan)');
  }

  const lbl = el('timerLabel');
  if (lbl) lbl.textContent = timer.mode === 'break' ? 'BREAK' : 'REMAINING';
}

function setTimerBtn(running) {
  const icon = el('playPauseIcon');
  if (icon) icon.textContent = running ? 'pause' : 'play_arrow';
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
      clearInterval(timer.interval);
      timer.interval = null;
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
  timer.interval = null;
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
    if (s) { s.accessed = Date.now(); s.docs++; }
  }
  save();
  // Update goal progress if home is visible
  if (currentView === 'home') renderGoalProgress();
}

function beginFocusSession() {
  const intentEl = el('focusIntentInput');
  const subjEl   = el('focusSubjectSelect');
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

function exitFocusSession() {
  if (!confirm('End this focus session?')) return;
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
function renderLibrary() {
  const grid   = el('libraryGrid');
  const search = el('libSearchInput')?.value?.toLowerCase() || '';
  if (!grid) return;

  const filtered = S.subjects.filter(s =>
    !search || s.name.toLowerCase().includes(search) || s.desc.toLowerCase().includes(search)
  );

  grid.innerHTML = `
    <div onclick="showAddSubject()" style="min-height:170px;border-radius:14px;border:2px dashed rgba(255,255,255,0.1);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;cursor:pointer;transition:border-color 0.2s;padding:24px;"
      onmouseover="this.style.borderColor='rgba(124,58,237,0.4)'"
      onmouseout="this.style.borderColor='rgba(255,255,255,0.1)'">
      <div style="width:44px;height:44px;background:rgba(124,58,237,0.12);border-radius:50%;display:flex;align-items:center;justify-content:center;">
        <span class="ms" style="color:var(--plight);">add</span>
      </div>
      <div style="font-weight:600;font-size:14px;color:var(--text);">New Subject</div>
    </div>
    ${filtered.map(s => `
      <div class="subj-card" style="min-height:200px;position:relative;display:flex;flex-direction:column;" onclick="startSubject(${s.id})">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;">
          <div style="width:44px;height:44px;background:${s.color}20;border-radius:12px;display:flex;align-items:center;justify-content:center;">
            <span class="ms" style="font-size:24px;color:${s.color};">menu_book</span>
          </div>
          <button onclick="event.stopPropagation();deleteSubject(${s.id})"
            style="background:transparent;border:none;color:rgba(255,255,255,0.18);cursor:pointer;padding:4px;line-height:1;display:flex;align-items:center;"
            onmouseover="this.style.color='#f87171'" onmouseout="this.style.color='rgba(255,255,255,0.18)'">
            <span class="ms" style="font-size:16px;">close</span>
          </button>
        </div>
        <div style="font-weight:700;font-size:15px;margin-bottom:5px;">${s.name}</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:12px;flex:1;">${s.desc}</div>
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted);margin-bottom:12px;">
          <span class="ms" style="font-size:14px;">description</span>
          <span>${s.docs} Documents</span>
          <span style="margin-left:auto;">${timeAgo(s.accessed)}</span>
        </div>
        <button onclick="event.stopPropagation();openFlashcards(${s.id})"
          style="width:100%;padding:8px;border-radius:8px;background:${s.color}18;border:1px solid ${s.color}35;color:${s.color};font-size:12px;font-weight:600;cursor:pointer;font-family:'Manrope',sans-serif;display:flex;align-items:center;justify-content:center;gap:6px;transition:all 0.15s;"
          onmouseover="this.style.background='${s.color}28'" onmouseout="this.style.background='${s.color}18'">
          <span class="ms" style="font-size:15px;">style</span> Review Flashcards
        </button>
      </div>
    `).join('')}
  `;
}

function showAddSubject() {
  const name = prompt('Subject name:');
  if (!name?.trim()) return;
  const desc = prompt('Brief description:') || '';
  S.subjects.push({
    id:       S.nextId++,
    name:     name.trim(),
    desc:     desc.trim(),
    docs:     0,
    color:    SUBJECT_COLORS[S.subjects.length % SUBJECT_COLORS.length],
    accessed: Date.now(),
  });
  save();
  renderLibrary();
}

function deleteSubject(id) {
  if (!confirm('Remove this subject?')) return;
  S.subjects = S.subjects.filter(s => s.id !== id);
  save();
  renderLibrary();
}

// ── STATS ────────────────────────────────────────────────────────────────────
function renderStats() {
  renderStatsDate();
  renderStatsBar();
  renderDonut();
  renderHeatmap();
  renderSessionLog();
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

  const subjectMap = {};
  S.subjects.forEach(s => { subjectMap[s.id] = s; });

  list.innerHTML = recent.map((sess, i) => {
    const d     = new Date(sess.date);
    const subj  = subjectMap[sess.subjectId];
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
    buckets.push({ hrs: hrs || (Math.random()*5+1), label: from.toLocaleDateString('en-US',{month:'short',day:'numeric'}), isToday: false });
  }
  const todayH = todayFocusSec() / 3600;
  buckets.push({ hrs: todayH || 5.7, label: 'Today', isToday: true });

  const maxH = Math.max(...buckets.map(b => b.hrs));
  chart.innerHTML = buckets.map(b => {
    const pct = Math.max(5, (b.hrs / maxH) * 100);
    const bg  = b.isToday ? 'var(--cyan)' : 'rgba(124,58,237,0.48)';
    return `<div style="flex:1;height:${pct}%;background:${bg};border-radius:4px 4px 0 0;min-height:4px;transition:height 0.4s;"></div>`;
  }).join('');

  if (labels) labels.innerHTML = buckets.map(b => `<span style="font-size:10px;">${b.label}</span>`).join('');
}

function renderDonut() {
  const svg    = el('subjectDonut');
  const legend = el('subjectLegend');
  const total  = el('totalHrsNum');
  if (!svg) return;

  const subjects = S.subjects.length ? S.subjects : [
    { name:'Untracked', color:'#7c3aed', docs:40 },
    { name:'Deep Focus', color:'#4cd7f6', docs:30 },
    { name:'Research',   color:'#4edea3', docs:20 },
  ];

  const r = 55, cx = 75, cy = 75;
  const C = 2 * Math.PI * r;
  const tot = subjects.reduce((n, s) => n + s.docs, 0);
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
        <span style="color:var(--muted);flex:1;">${s.name}</span>
        <span style="font-weight:600;">${Math.round(s.docs/tot*100)}%</span>
      </div>
    `).join('');
  }

  const totalHrs = Math.round(S.sessions.reduce((n, s) => n + s.duration/3600, 0));
  if (total) total.textContent = totalHrs || 124;
}

function renderHeatmap() {
  const grid = el('heatmapGrid');
  if (!grid) return;
  // 7 rows × 30 cols  (rows = days of week, cols = time slots)
  const rows = 7, cols = 30;
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.innerHTML = Array.from({ length: rows * cols }, (_, i) => {
    const col  = i % cols;
    const isMidDay = col > 5 && col < 22;
    const raw  = isMidDay ? Math.random() : Math.random() * 0.25;
    const show = Math.random() < (isMidDay ? 0.55 : 0.15);
    const a    = show ? raw.toFixed(2) : '0.04';
    return `<div style="aspect-ratio:1;border-radius:2px;background:rgba(124,58,237,${a});"></div>`;
  }).join('');
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
      <span style="flex:1;font-size:14px;${t.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${t.text}</span>
      <button onclick="deleteTask(${t.id})"
        style="background:transparent;border:none;color:rgba(255,255,255,0.2);cursor:pointer;padding:4px;display:flex;align-items:center;"
        onmouseover="this.style.color='#f87171'"
        onmouseout="this.style.color='rgba(255,255,255,0.2)'">
        <span class="ms" style="font-size:16px;">close</span>
      </button>
    </div>
  `).join('');

  list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const t = S.tasks.find(x => x.id === +cb.dataset.id);
      if (t) { t.done = cb.checked; save(); renderTasks(); if (currentView === 'home') renderHomeTasks(); }
    });
  });
}

function addTask(text) {
  if (!text?.trim()) return;
  S.tasks.push({ id: S.nextId++, text: text.trim(), done: false });
  save();
  renderTasks();
  if (currentView === 'home') renderHomeTasks();
}

function deleteTask(id) {
  S.tasks = S.tasks.filter(t => t.id !== id);
  save();
  renderTasks();
}

// ── TOAST ────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
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
  toast.innerHTML = `<span style="font-family:'Material Symbols Outlined';font-size:18px;line-height:1;">${icons[type]}</span>${msg}`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(8px)';
    setTimeout(() => toast.remove(), 320);
  }, 3000);
}

// ── LOGOUT ───────────────────────────────────────────────────────────────────
function handleLogout() {
  if (!confirm('Sign out of Brainfy?')) return;
  // Preserve timer state — stop if running
  pauseTimer();
  document.body.classList.remove('focus-active');
  S = structuredClone(DEFAULT_STATE);
  save();
  goTo('splash');
}

// ── AUTH ─────────────────────────────────────────────────────────────────────
function passwordStrength(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8)  s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

function showAuthError(id, msg) {
  const e = el(id);
  if (!e) return;
  e.textContent = msg;
  e.style.display = msg ? 'block' : 'none';
}

function setAuthLoading(btnId, loading) {
  const btn = el(btnId);
  if (!btn) return;
  btn.disabled    = loading;
  btn.textContent = loading ? 'Please wait…' : (btnId === 'signinSubmitBtn' ? 'Sign In' : 'Create Account');
  btn.style.opacity = loading ? '0.7' : '1';
}

function handleSignIn() {
  const email = el('signinEmail')?.value?.trim();
  const pw    = el('signinPassword')?.value;
  showAuthError('signinError', '');

  if (!email || !email.includes('@')) { showAuthError('signinError', 'Please enter a valid email address.'); return; }
  if (!pw || pw.length < 6)           { showAuthError('signinError', 'Password must be at least 6 characters.'); return; }

  setAuthLoading('signinSubmitBtn', true);
  // Simulate async auth (replace with real backend call)
  setTimeout(() => {
    setAuthLoading('signinSubmitBtn', false);
    const stored = localStorage.getItem('brainfy_users');
    const users  = stored ? JSON.parse(stored) : [];
    const user   = users.find(u => u.email === email && u.pw === pw);
    if (!user && users.length > 0 && users.some(u => u.email === email)) {
      showAuthError('signinError', 'Incorrect password. Please try again.');
      return;
    }
    // Accept any credentials (demo mode) or found user
    S.userName = user?.name || email.split('@')[0];
    save();
    goTo('home');
  }, 800);
}

function handleSignup() {
  const name  = el('signupName')?.value?.trim();
  const email = el('signupEmail')?.value?.trim();
  const pw    = el('signupPassword')?.value;
  showAuthError('signupError', '');

  if (!name)                          { showAuthError('signupError', 'Please enter your name.'); return; }
  if (!email || !email.includes('@')) { showAuthError('signupError', 'Please enter a valid email address.'); return; }
  if (!pw || pw.length < 8)           { showAuthError('signupError', 'Password must be at least 8 characters.'); return; }

  setAuthLoading('signupSubmitBtn', true);
  setTimeout(() => {
    setAuthLoading('signupSubmitBtn', false);
    // Persist user (demo)
    const stored = localStorage.getItem('brainfy_users');
    const users  = stored ? JSON.parse(stored) : [];
    users.push({ name, email, pw });
    localStorage.setItem('brainfy_users', JSON.stringify(users));
    S.userName = name;
    save();
    goTo('home');
  }, 800);
}

function handleGoogleSignIn() {
  // Demo: just navigate in
  S.userName = 'Alex';
  save();
  goTo('home');
}

function showForgot() {
  const email = el('signinEmail')?.value?.trim();
  const msg   = email
    ? `Password reset link sent to ${email} (demo mode — no email actually sent).`
    : 'Enter your email address above first, then click Forgot password.';
  showAuthError('signinError', msg);
  if (el('signinError')) el('signinError').style.background = 'rgba(76,215,246,0.08)';
  if (el('signinError')) el('signinError').style.borderColor = 'rgba(76,215,246,0.2)';
  if (el('signinError')) el('signinError').style.color = 'var(--cyan)';
  if (el('signinError')) el('signinError').style.display = 'block';
}

// ── EVENT LISTENERS ──────────────────────────────────────────────────────────
function initEvents() {
  // Splash CTAs
  el('splashEnterBtn')?.addEventListener('click', () => goTo('signin'));
  el('enterBrainBtn')?.addEventListener('click', () => goTo('signin'));
  el('getStartedBtn')?.addEventListener('click', () => goTo('signup'));

  // ── Auth ──────────────────────────────────────────
  el('googleSignInBtn')?.addEventListener('click', handleGoogleSignIn);
  el('signinSubmitBtn')?.addEventListener('click', handleSignIn);
  el('signupSubmitBtn')?.addEventListener('click', handleSignup);

  // Password visibility toggles
  el('signinTogglePw')?.addEventListener('click', () => {
    const inp  = el('signinPassword');
    const icon = el('signinPwIcon');
    const show = inp.type === 'password';
    inp.type   = show ? 'text' : 'password';
    icon.textContent = show ? 'visibility' : 'visibility_off';
  });
  el('signupTogglePw')?.addEventListener('click', () => {
    const inp  = el('signupPassword');
    const icon = el('signupPwIcon');
    const show = inp.type === 'password';
    inp.type   = show ? 'text' : 'password';
    icon.textContent = show ? 'visibility' : 'visibility_off';
  });

  // Password strength meter
  el('signupPassword')?.addEventListener('input', e => {
    const v   = e.target.value;
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

  // Sidebar nav
  document.querySelectorAll('[data-go]').forEach(btn => {
    btn.addEventListener('click', () => goTo(btn.dataset.go));
  });

  // Sidebar Start Session
  el('sidebarStartBtn')?.addEventListener('click', () => goTo('focus'));

  // Home add task → navigate to tasks view with focus on input
  el('homeAddTaskBtn')?.addEventListener('click', () => {
    goTo('tasks');
    setTimeout(() => el('newTaskInput')?.focus(), 100);
  });

  // View all library
  el('viewAllBtn')?.addEventListener('click', () => goTo('library'));

  // Focus: preset buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active-preset', 'btn-primary'));
      btn.classList.add('active-preset');
      S.focusDuration = +btn.dataset.focus * 60;
      S.breakDuration = +btn.dataset.break * 60;
      save();
    });
  });

  // Style active-preset button
  const style = document.createElement('style');
  style.textContent = '.active-preset { background: var(--primary) !important; color: white !important; border-color: var(--primary) !important; }';
  document.head.appendChild(style);

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
  el('timerResetBtn')?.addEventListener('click', () => { if (confirm('Reset timer?')) resetTimer(); });
  el('timerSkipBtn')?.addEventListener('click', skipTimer);

  // Exit session
  el('exitSessionBtn')?.addEventListener('click', exitFocusSession);

  // Add milestone
  el('addMilestoneBtn')?.addEventListener('click', () => {
    const text = prompt('Milestone:');
    if (text?.trim()) {
      S.milestones.push({ id: S.nextId++, text: text.trim(), done: false });
      save();
      renderMilestones();
    }
  });

  // Note tags
  document.querySelectorAll('.note-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = el('quickNotesInput');
      if (input) {
        input.value += (input.value ? '\n' : '') + btn.dataset.tag + ' ';
        S.sessionNotes = input.value;
        save();
        input.focus();
      }
    });
  });

  // Quick notes autosave
  el('quickNotesInput')?.addEventListener('input', e => {
    S.sessionNotes = e.target.value;
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
    const input = el('newTaskInput');
    addTask(input?.value);
    if (input) input.value = '';
  });
  el('newTaskInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      addTask(e.target.value);
      e.target.value = '';
    }
  });

  // ── Sidebar: Logout & Support ──────────────────────
  el('sidebarLogoutBtn')?.addEventListener('click', handleLogout);
  el('sidebarSupportBtn')?.addEventListener('click', () => {
    showToast('Support chat coming soon! Email us at hello@brainfy.app', 'info');
  });

  // ── Splash: View Pricing ───────────────────────────
  el('viewPricingBtn')?.addEventListener('click', () => {
    showToast('Brainfy is free forever. No pricing tiers.', 'success');
  });

  // ── Home: Exploration View ─────────────────────────
  el('explorationViewBtn')?.addEventListener('click', () => goTo('stats'));

  // ── Focus active: Notifications & Settings ─────────
  el('focusNotifBtn')?.addEventListener('click', () => {
    showToast('No new notifications', 'info');
  });
  el('focusSettingsBtn')?.addEventListener('click', () => {
    const dur = prompt(`Focus duration (minutes):`, Math.round(S.focusDuration / 60));
    if (!dur || isNaN(+dur) || +dur < 1) return;
    const brk = prompt(`Break duration (minutes):`, Math.round(S.breakDuration / 60));
    if (!brk || isNaN(+brk) || +brk < 1) return;
    S.focusDuration = +dur * 60;
    S.breakDuration = +brk * 60;
    save();
    showToast(`Updated: ${dur}m focus / ${brk}m break`, 'success');
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

let aiHistory  = [];
let aiTypingEl = null;
let aiIsOpen   = false;
let aiAvailable = false;   // set after /api/ai-status check

// ── Check if server has AI configured ──────────
async function checkAIStatus() {
  try {
    const res  = await fetch('/api/ai-status');
    const data = await res.json();
    aiAvailable = !!data.configured;

    // Update model badge in panel header
    const badge = document.getElementById('aiModelBadge');
    if (badge && data.model) {
      const providerIcon = data.provider === 'groq' ? '⚡' : '🤖';
      badge.textContent  = `${providerIcon} ${data.model}`;
      badge.title        = `Provider: ${data.provider}`;
    }
  } catch(_) {
    aiAvailable = false;
  }
  // Sidebar dot: green = ready, grey = offline
  const dot = document.querySelector('#aiNavBtn .ai-dot');
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

// ── API call → /api/chat proxy ──────────────────
async function callClaude(userText) {
  if (!aiAvailable) { showAIOffline(); return; }

  aiHistory.push({ role: 'user', content: userText });
  appendAIMsg('user', userText);
  clearAIInput();
  showAITyping();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        system: buildSystemPrompt(),
        messages: aiHistory,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Server error ${res.status}`);
    }

    const reply = data.content?.[0]?.text || '(empty response)';
    aiHistory.push({ role: 'assistant', content: reply });

    hideAITyping();
    appendAIMsg('assistant', reply);

    // Token count
    if (data.usage) {
      const tc = el('aiTokenCount');
      if (tc) tc.textContent = `${(data.usage.input_tokens + data.usage.output_tokens).toLocaleString()} tokens`;
    }

    // Offer to import if flashcard format detected
    if (/^Q:/m.test(reply)) {
      appendAIAction('➕ Import as flashcards', () => importAIFlashcards(reply));
    }

  } catch(e) {
    hideAITyping();
    appendAIMsg('error', `**Something went wrong:** ${e.message}`);
  }
}

// ── Quick actions ────────────────────────────────
const AI_QUICK = {
  quiz: () => {
    const s = S.subjects[0]?.name || 'my current subject';
    return `Quiz me on **${s}** — give me 5 challenging questions one at a time. Start with the first question.`;
  },
  explain: () => {
    const topic = prompt('What concept should I explain?');
    return topic ? `Explain **${topic.trim()}** clearly with an analogy and a real-world example.` : null;
  },
  flashcards: () => {
    const notes = prompt('Paste your notes here and I\'ll generate flashcards:');
    return notes ? `Generate 8 flashcards from these notes. Use exactly this format:\nQ: [question]\nA: [answer]\n\nNotes:\n${notes.trim()}` : null;
  },
  plan: () => `Create a focused 7-day study plan for these subjects: **${S.subjects.map(s=>s.name).join(', ')}**. Be specific with daily time blocks and topics.`,
  tips: () => `Based on my ${Math.round(todayFocusSec()/60)} minutes of focus today and a score of ${calcScore()}/100 — give me 3 sharp, actionable tips to improve my study performance.`,
};

function aiQuickAction(type) {
  const prompt = AI_QUICK[type]?.();
  if (prompt) callClaude(prompt);
}

// ── Message rendering ────────────────────────────
function appendAIMsg(role, text) {
  const feed = document.getElementById('aiMessages');
  if (!feed) return;

  const isUser  = role === 'user';
  const isError = role === 'error';

  const wrap = document.createElement('div');
  wrap.className = 'ai-msg-wrap';
  wrap.style.cssText = `display:flex;gap:9px;align-items:flex-start;margin-bottom:16px;${isUser ? 'flex-direction:row-reverse;' : ''}`;

  // Avatar
  const av = document.createElement('div');
  av.style.cssText = `width:28px;height:28px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;font-family:'Space Grotesk';${
    isUser  ? 'background:var(--primary);color:white;' :
    isError ? 'background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.25);' :
    'background:linear-gradient(135deg,rgba(124,58,237,0.3),rgba(76,215,246,0.15));border:1px solid rgba(124,58,237,0.35);'
  }`;
  av.innerHTML = isUser  ? S.userName.charAt(0).toUpperCase() :
                 isError ? '<span class="ms" style="font-size:14px;color:#f87171;">error</span>' :
                 '<span class="ms" style="font-size:14px;color:var(--plight);">auto_awesome</span>';

  // Bubble
  const bub = document.createElement('div');
  bub.style.cssText = `max-width:290px;padding:10px 13px;font-size:13px;line-height:1.65;word-break:break-word;border-radius:${isUser ? '14px 3px 14px 14px' : '3px 14px 14px 14px'};${
    isUser  ? 'background:linear-gradient(135deg,var(--primary),#6d28d9);color:white;' :
    isError ? 'background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);color:#f87171;' :
    'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07);color:var(--text);'
  }`;
  bub.innerHTML = formatAIText(text);

  wrap.appendChild(av);
  wrap.appendChild(bub);
  feed.appendChild(wrap);
  feed.scrollTop = feed.scrollHeight;
}

function appendAIAction(label, fn) {
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

function showAITyping() {
  const feed = document.getElementById('aiMessages');
  if (!feed || aiTypingEl) return;
  aiTypingEl = document.createElement('div');
  aiTypingEl.style.cssText = 'display:flex;gap:9px;align-items:center;margin-bottom:16px;';
  aiTypingEl.innerHTML = `
    <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,rgba(124,58,237,0.3),rgba(76,215,246,0.15));border:1px solid rgba(124,58,237,0.35);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
      <span class="ms" style="font-size:14px;color:var(--plight);">auto_awesome</span>
    </div>
    <div style="padding:10px 14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07);border-radius:3px 14px 14px 14px;display:flex;gap:5px;align-items:center;">
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
function formatAIText(raw) {
  return raw
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`([^`]+)`/g,'<code style="background:rgba(124,58,237,0.18);padding:1px 5px;border-radius:3px;font-size:11px;font-family:monospace;">$1</code>')
    .replace(/^### (.+)$/gm,'<div style="font-size:12px;font-weight:800;color:var(--plighter);margin:10px 0 4px;letter-spacing:0.04em;text-transform:uppercase;">$1</div>')
    .replace(/^## (.+)$/gm,'<div style="font-weight:800;color:white;margin:10px 0 5px;font-size:14px;">$1</div>')
    .replace(/^# (.+)$/gm,'<div style="font-weight:900;color:white;margin:10px 0 6px;font-size:15px;">$1</div>')
    .replace(/^[-*•]\s+(.+)$/gm,'<div style="padding-left:14px;margin:2px 0;">• $1</div>')
    .replace(/^\d+\.\s+(.+)$/gm,'<div style="padding-left:4px;margin:3px 0;">$&</div>')
    .replace(/^Q:\s*(.+)$/gm,'<div style="margin:6px 0 2px;color:var(--plight);font-weight:700;">Q: $1</div>')
    .replace(/^A:\s*(.+)$/gm,'<div style="margin:0 0 8px;color:var(--text);">A: $1</div>')
    .replace(/\n\n/g,'<br/>')
    .replace(/\n/g,'<br/>');
}

// ── Welcome screen ───────────────────────────────
function showAIWelcome() {
  const feed = document.getElementById('aiMessages');
  if (!feed) return;
  feed.innerHTML = '';
  aiHistory = [];
  const hour  = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  appendAIMsg('assistant',
    `${greet}, **${S.userName}**! 🧠\n\nI'm **Brainfy AI** — your personal study coach.\n\nI can:\n- **Explain** any concept with analogies\n- **Generate flashcards** from your notes\n- **Quiz you** on any subject\n- **Build** a personalised study plan\n- **Analyse** your focus patterns\n\nWhat would you like to work on?`
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
        Add your Anthropic API key to <code style="background:rgba(255,255,255,0.07);padding:1px 6px;border-radius:4px;font-size:11px;">.env</code> on the server:<br/><br/>
        <code style="background:rgba(124,58,237,0.12);padding:6px 10px;border-radius:6px;font-size:11px;display:inline-block;color:var(--plight);">ANTHROPIC_API_KEY=sk-ant-...</code>
      </p>
      <p style="font-size:11px;color:var(--muted2);margin-top:16px;">Then restart the server — students won't see this screen.</p>
    </div>`;
}

function clearAIChat() {
  aiHistory = [];
  const feed = document.getElementById('aiMessages');
  if (feed) { feed.innerHTML = ''; showAIWelcome(); }
}

function clearAIInput() {
  const inp = document.getElementById('aiInput');
  if (inp) { inp.value = ''; inp.style.height = 'auto'; }
}

function handleAISend() {
  const inp = document.getElementById('aiInput');
  const text = inp?.value?.trim();
  if (!text) return;
  callClaude(text);
}

// ── Import AI-generated flashcards ───────────────
function importAIFlashcards(text) {
  const pairs = [];
  const lines = text.split('\n');
  let q = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('Q:')) { q = trimmed.slice(2).trim(); }
    else if (trimmed.startsWith('A:') && q) {
      pairs.push({ q, a: trimmed.slice(2).trim() });
      q = null;
    }
  }
  if (!pairs.length) { showToast('No flashcard pairs found in response', 'warning'); return; }

  // Store in a special "AI Generated" flashcard set
  const aiSet = pairs.map(p => ({ q: p.q, a: p.a }));
  FLASHCARD_SETS['ai_generated'] = aiSet;

  // Create or reuse an AI subject
  let aiSubj = S.subjects.find(s => s.name === 'AI Generated');
  if (!aiSubj) {
    aiSubj = { id: S.nextId++, name: 'AI Generated', desc: 'Flashcards created by AI', docs: 0, color: '#7c3aed', accessed: Date.now() };
    S.subjects.push(aiSubj);
    save();
  }
  FLASHCARD_SETS[aiSubj.id] = aiSet;

  showToast(`${pairs.length} flashcards imported! Find them in Library → AI Generated`, 'success');
  appendAIMsg('assistant', `✅ **${pairs.length} flashcards imported** into your Library! Open the **AI Generated** subject in Library to review them.`);
}

// ── Auto-resize textarea ─────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Wire up AI input events after DOM ready
  setTimeout(() => {
    const inp = document.getElementById('aiInput');
    if (!inp) return;
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAISend(); }
    });
    inp.addEventListener('input', () => {
      inp.style.height = 'auto';
      inp.style.height = Math.min(inp.scrollHeight, 120) + 'px';
    });
  }, 500);
});

/* ── Splash page scroll-reveal (IntersectionObserver) ── */
function initSplashObserver() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    // Immediately reveal all animated elements
    document.querySelectorAll('.bento-card, .phil-item, .phil-head, .phil-right')
      .forEach(el => el.classList.add('revealed'));
    return;
  }

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
  document.querySelectorAll('#splash-phil .phil-head').forEach((el, i) => {
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
  initEvents();
  goTo('splash');
  initSplashObserver();
  checkAIStatus();   // probe server for AI availability (no API key on client)
}

document.addEventListener('DOMContentLoaded', init);
