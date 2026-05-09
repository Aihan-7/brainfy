"use strict";
// ══════════════════════════════════════════════════
//  Brainfy — main.ts
// ══════════════════════════════════════════════════
const STORAGE_KEY = 'brainfy_v3';
const TIMER_C = 754; // 2π × 120  (timer ring circumference)
const SCORE_C = 339; // 2π × 54   (score ring circumference)
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
const SUBJECT_COLORS = ['#7c3aed', '#0891b2', '#065f46', '#9a3412', '#1e40af', '#b45309', '#be185d'];
// ── Flashcard data sets ──────────────────────────────────────────────────────
// Cards are stored per-subject in S.subjects[].cards (added by AI or user).
// This default set is shown when a subject has no cards yet.
const FLASHCARD_SETS = {
    default: [
        { q: 'What is spaced repetition?', a: 'A learning technique that schedules reviews at increasing intervals over time, exploiting the spacing effect to maximize long-term retention.' },
        { q: 'Define active recall', a: 'Deliberately retrieving information from memory (vs. passively re-reading), which strengthens neural pathways and dramatically improves retention.' },
        { q: 'What is the Feynman Technique?', a: '(1) Pick a concept. (2) Explain it in plain language. (3) Identify gaps. (4) Simplify further. Exposes true understanding.' },
        { q: 'What is deliberate practice?', a: 'Focused practice at the edge of your ability, with clear goals, immediate feedback, and systematic attention to weaknesses.' },
        { q: 'Define working memory', a: 'A cognitive system with limited capacity that temporarily holds and manipulates information for immediate use in thinking and reasoning.' },
        { q: 'What is the Pomodoro Technique?', a: 'Work in focused 25-minute blocks (pomodoros) separated by 5-minute breaks. After 4 pomodoros, take a 15–30 minute long break.' },
    ],
};
// ── Default state ───────────────────────────────────────────────────────────
const DEFAULT_STATE = {
    userName: '',
    subjects: [],
    tasks: [],
    milestones: [],
    sessions: [],
    focusDuration: 25 * 60,
    breakDuration: 5 * 60,
    ambient: { lofi: 0, rain: 0, white: 0, forest: 0 },
    sessionNotes: '',
    dailyGoal: 120,
    streak: 0,
    bestStreak: 0,
    nextId: 1,
};
// ── Runtime state ───────────────────────────────────────────────────────────
let S = { ...DEFAULT_STATE };
let currentView = 'splash';
let fcModalHTML = ''; // saved on first open; restored when modal closes
const timer = {
    interval: undefined,
    timeLeft: 25 * 60,
    totalTime: 25 * 60,
    running: false,
    mode: 'focus',
    subjectId: null,
    intent: '',
};
// ── Firebase auth state ──────────────────────────────────────────────────────
let firebaseUser = null; // current Firebase user object
let idToken = null; // cached ID token (refreshed automatically)
// ── Web Audio Ambient Engine ─────────────────────────────────────────────────
let audioCtx = null;
const ambientNodes = {};
function getCtx() {
    if (!audioCtx)
        audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended')
        audioCtx.resume();
    return audioCtx;
}
function makeNoiseBuffer(ctx) {
    const len = 3 * ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++)
        d[i] = Math.random() * 2 - 1;
    return buf;
}
function startAmbientKey(key, vol) {
    const ctx = getCtx();
    if (ambientNodes[key]) {
        setAmbientVol(key, vol);
        return;
    }
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
    }
    else if (key === 'rain') {
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
            src.connect(bpf);
            bpf.connect(g2);
            g2.connect(gain);
            src.start();
            sources.push(src, bpf, g2);
        });
        // Slow amplitude swell (rain variation)
        const lfo = ctx.createOscillator();
        const lfoG = ctx.createGain();
        lfo.frequency.value = 0.12;
        lfoG.gain.value = 0.08;
        lfo.connect(lfoG);
        lfoG.connect(gain.gain);
        lfo.start();
        sources.push(lfo, lfoG);
    }
    else if (key === 'forest') {
        // Layered high-pass noise + slow LFO = wind through trees
        const src = ctx.createBufferSource();
        src.buffer = makeNoiseBuffer(ctx);
        src.loop = true;
        const hpf = ctx.createBiquadFilter();
        hpf.type = 'highpass';
        hpf.frequency.value = 800;
        hpf.Q.value = 0.3;
        const lpf = ctx.createBiquadFilter();
        lpf.type = 'lowpass';
        lpf.frequency.value = 3500;
        src.connect(hpf);
        hpf.connect(lpf);
        lpf.connect(gain);
        src.start();
        const lfo = ctx.createOscillator();
        const lfoG = ctx.createGain();
        lfo.frequency.value = 0.08;
        lfoG.gain.value = 0.12;
        lfo.connect(lfoG);
        lfoG.connect(gain.gain);
        lfo.start();
        sources.push(src, hpf, lpf, lfo, lfoG);
    }
    else if (key === 'lofi') {
        // Warm detuned triangle oscillators + heavy lowpass = lo-fi hum
        const freqs = [110, 138.6, 165, 220]; // A2, C#3, E3, A3
        freqs.forEach((f, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = f + (Math.random() - 0.5) * 2; // slight detune
            const g2 = ctx.createGain();
            g2.gain.value = [0.28, 0.18, 0.18, 0.12][i];
            const lpf = ctx.createBiquadFilter();
            lpf.type = 'lowpass';
            lpf.frequency.value = 900;
            lpf.Q.value = 1.2;
            osc.connect(g2);
            g2.connect(lpf);
            lpf.connect(gain);
            osc.start();
            sources.push(osc, g2, lpf);
        });
        // Tremolo
        const lfo = ctx.createOscillator();
        const lfoG = ctx.createGain();
        lfo.frequency.value = 0.6;
        lfoG.gain.value = 0.06;
        lfo.connect(lfoG);
        lfoG.connect(gain.gain);
        lfo.start();
        sources.push(lfo, lfoG);
    }
    ambientNodes[key] = { gainNode: gain, sources };
}
function stopAmbientKey(key) {
    const node = ambientNodes[key];
    if (!node || !audioCtx)
        return;
    const { gainNode, sources } = node;
    gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.4);
    setTimeout(() => {
        sources.forEach(s => { try {
            if (s.stop)
                s.stop();
            else
                s.disconnect();
        }
        catch (_) { } });
        try {
            gainNode.disconnect();
        }
        catch (_) { }
        delete ambientNodes[key];
    }, 1500);
}
function setAmbientVol(key, vol) {
    const node = ambientNodes[key];
    if (!node || !audioCtx)
        return;
    node.gainNode.gain.setTargetAtTime(vol / 100 * 0.35, audioCtx.currentTime, 0.2);
}
function syncAmbient() {
    ['lofi', 'rain', 'white', 'forest'].forEach(k => {
        const v = S.ambient[k] || 0;
        if (v > 0)
            startAmbientKey(k, v);
        else
            stopAmbientKey(k);
    });
}
// ── Flashcard State ──────────────────────────────────────────────────────────
const fc = { cards: [], idx: 0, flipped: false, scores: { easy: 0, ok: 0, hard: 0 } };
function openFlashcards(subjectId) {
    const subj = S.subjects.find(s => s.id === subjectId);
    const set = (subj?.cards?.length ? subj.cards : null) || FLASHCARD_SETS.default;
    fc.cards = [...set];
    fc.idx = 0;
    fc.flipped = false;
    fc.scores = { easy: 0, ok: 0, hard: 0 };
    const modal = document.getElementById('flashcardModal');
    if (!modal)
        return;
    if (!fcModalHTML)
        fcModalHTML = modal.innerHTML; // capture original structure once
    else
        modal.innerHTML = fcModalHTML; // restore if previously replaced
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    const label = document.getElementById('fcSubjectLabel');
    if (label)
        label.textContent = subj ? subj.name.toUpperCase() : 'FLASHCARDS';
    renderFC();
}
function closeFlashcards() {
    const modal = document.getElementById('flashcardModal');
    if (modal && fcModalHTML)
        modal.innerHTML = fcModalHTML;
    modal?.classList.remove('open');
    document.body.style.overflow = '';
}
function renderFC() {
    const card = fc.cards[fc.idx];
    const total = fc.cards.length;
    // Reset flip
    fc.flipped = false;
    const fcCard = document.getElementById('fcCard');
    if (fcCard)
        fcCard.classList.remove('flipped');
    const fcRating = document.getElementById('fcRating');
    if (fcRating) {
        fcRating.style.display = 'none';
    }
    // Text
    const front = document.getElementById('fcFrontText');
    const back = document.getElementById('fcBackText');
    if (front)
        front.textContent = card.q;
    if (back)
        back.textContent = card.a;
    // Progress
    const pct = ((fc.idx + 1) / total * 100).toFixed(1);
    const bar = document.getElementById('fcProgressBar');
    if (bar)
        bar.style.width = pct + '%';
    const lbl = document.getElementById('fcProgressLabel');
    if (lbl)
        lbl.textContent = `${fc.idx + 1} / ${total}`;
    // Dots
    const dotsEl = document.getElementById('fcDots');
    if (dotsEl) {
        dotsEl.innerHTML = fc.cards.map((_, i) => {
            const color = i < fc.idx ? 'var(--primary)' : i === fc.idx ? 'var(--cyan)' : 'rgba(255,255,255,0.15)';
            return `<div style="width:7px;height:7px;border-radius:50%;background:${color};transition:background 0.3s;"></div>`;
        }).join('');
    }
    // Score counters
    ['easy', 'ok', 'hard'].forEach(k => {
        const elId = document.getElementById('fc' + k.charAt(0).toUpperCase() + k.slice(1) + 'Count');
        if (elId)
            elId.textContent = String(fc.scores[k]);
    });
}
function flipCard() {
    fc.flipped = !fc.flipped;
    const card = document.getElementById('fcCard');
    if (card)
        card.classList.toggle('flipped', fc.flipped);
    const rating = document.getElementById('fcRating');
    if (rating)
        rating.style.display = fc.flipped ? 'flex' : 'none';
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
    }
    else {
        // Session complete
        const { easy, ok, hard } = fc.scores;
        const total = easy + ok + hard;
        const modal = document.getElementById('flashcardModal');
        if (!modal)
            return;
        modal.innerHTML = `
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
    if (!modal?.classList.contains('open'))
        return;
    if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        flipCard();
    }
    if (e.key === 'ArrowRight')
        fcNav(1);
    if (e.key === 'ArrowLeft')
        fcNav(-1);
    if (e.key === 'Escape')
        closeFlashcards();
});
// ── Persistence ─────────────────────────────────────────────────────────────
function save() {
    // Always save locally for instant access
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
    }
    catch (_) { }
    // Push to Firestore if signed in (fire-and-forget)
    if (idToken) {
        fetch('/api/data/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken, state: S }),
        }).catch(() => { }); // silent — local copy is always the fallback
    }
}
function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw)
            S = { ...DEFAULT_STATE, ...JSON.parse(raw) };
        else
            S = structuredClone(DEFAULT_STATE);
    }
    catch (_) {
        S = structuredClone(DEFAULT_STATE);
    }
}
// Load state from Firestore (called after sign-in)
async function loadFromCloud() {
    if (!idToken)
        return;
    try {
        const res = await fetch('/api/data/load', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
        });
        const data = await res.json();
        if (data.state) {
            S = { ...DEFAULT_STATE, ...data.state };
            // Keep local copy in sync
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
            }
            catch (_) { }
        }
    }
    catch (_) {
        // Network issue — keep local state as-is
    }
}
// ── Router ──────────────────────────────────────────────────────────────────
function goTo(view) {
    // Smooth exit: fade out current view slightly before switching
    const prevEl = document.querySelector('.view.active');
    if (prevEl && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        prevEl.style.transition = 'opacity 0.12s ease, transform 0.12s ease';
        prevEl.style.opacity = '0';
        prevEl.style.transform = 'translateY(-6px) scale(0.99)';
    }
    setTimeout(() => {
        // Reset styles in case this view was previously animated
        if (prevEl) {
            prevEl.style.transition = '';
            prevEl.style.opacity = '';
            prevEl.style.transform = '';
        }
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const target = document.getElementById(view + 'View');
        if (!target)
            return;
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
        btn.classList.toggle('active', btn.dataset['go'] === view);
    });
    if (view === 'home')
        renderHome();
    if (view === 'focus')
        renderFocus();
    if (view === 'library')
        renderLibrary();
    if (view === 'stats')
        renderStats();
    if (view === 'tasks')
        renderTasks();
    // Re-trigger stagger animations on stat cards
    if (view === 'home') {
        document.querySelectorAll('.hd-stat').forEach(c => {
            c.style.animation = 'none';
            void c.offsetWidth;
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
    const hrs = todayFocusSec() / 3600;
    const strk = Math.min(40, (S.streak || 0) * 3);
    const focus = Math.min(40, hrs * 10);
    const sess = Math.min(20, S.sessions.filter(s => new Date(s.date).toDateString() === todayStr()).length * 5);
    return Math.round(strk + focus + sess);
}
function timeAgo(ts) {
    const d = Date.now() - ts;
    const m = Math.floor(d / 60000);
    if (m < 60)
        return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24)
        return h + 'h ago';
    return Math.floor(h / 24) + 'd ago';
}
function fmtTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0)
        return h + 'h ' + m + 'm';
    if (m > 0)
        return m + 'm';
    return '<1m';
}
function el(id) { return document.getElementById(id); }
function elInput(id) { return document.getElementById(id); }
function elSel(id) { return document.getElementById(id); }
function elBtn(id) { return document.getElementById(id); }
// ── HOME ────────────────────────────────────────────────────────────────────
function renderHome() {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Greeting
    const hr = new Date().getHours();
    const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
    const g = el('homeGreeting');
    if (g)
        g.textContent = greet + ', ' + S.userName;
    // Streak label
    const sl = el('homeStreakLabel');
    const streak = S.streak || 0;
    if (sl)
        sl.textContent = streak + ' DAY STREAK';
    // Dynamic subtitle
    const sub = el('homeSubtitle');
    if (sub) {
        const todayMins = Math.round(todayFocusSec() / 60);
        const goal = S.dailyGoal || 120;
        const pct = Math.round((todayMins / goal) * 100);
        if (todayMins === 0) {
            sub.textContent = 'Ready for a deep focus session? Your first session starts the streak.';
        }
        else if (pct >= 100) {
            sub.textContent = `Goal crushed! ${todayMins} min of deep focus today — exceptional work.`;
        }
        else if (pct >= 60) {
            sub.textContent = `${todayMins} min in — ${goal - todayMins} min left to hit your daily goal. Keep going.`;
        }
        else {
            sub.textContent = `${todayMins} min focused today. ${goal - todayMins} min left to reach your goal.`;
        }
    }
    // Focus time
    const secs = todayFocusSec();
    const ft = el('homeFocusTime');
    if (ft)
        ft.textContent = secs > 0 ? fmtTime(secs) : '0m';
    // Sessions today
    const todaySessions = S.sessions.filter(s => new Date(s.date).toDateString() === todayStr());
    const sc = el('homeSessionCount');
    if (sc)
        sc.textContent = String(todaySessions.length);
    // Streak num
    const sn2 = el('homeStreakNum');
    if (sn2)
        sn2.textContent = String(streak);
    // ── Score ring + badges ───────────────────────
    const score = calcScore();
    const ringC = 2 * Math.PI * 58;
    const ring = el('focusScoreRing');
    if (ring)
        ring.setAttribute('stroke-dashoffset', String(ringC * (1 - score / 100)));
    function countUp(elId, target, duration) {
        const node = el(elId);
        if (!node)
            return;
        if (reduced) {
            node.textContent = String(target);
            return;
        }
        const start = performance.now();
        const tick = (now) => {
            const p = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            node.textContent = String(Math.round(eased * target));
            if (p < 1)
                requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }
    countUp('focusScoreNum', score, 900);
    countUp('homeScoreStatNum', score, 900);
    // ── Focus trend badge (today vs yesterday) ────
    const trend = el('homeFocusTrend');
    if (trend) {
        const todaySec = todayFocusSec();
        const yesterdayStr = new Date(Date.now() - 86400000).toDateString();
        const yesterdaySec = S.sessions
            .filter(s => new Date(s.date).toDateString() === yesterdayStr)
            .reduce((n, s) => n + s.duration, 0);
        if (todaySec > 0 && yesterdaySec > 0) {
            const pct = Math.round(((todaySec - yesterdaySec) / yesterdaySec) * 100);
            const up = pct >= 0;
            trend.textContent = (up ? '↑ ' : '↓ ') + Math.abs(pct) + '%';
            trend.style.color = up ? 'var(--green)' : '#f97316';
            trend.style.background = up ? 'rgba(78,222,163,0.1)' : 'rgba(249,115,22,0.1)';
            trend.style.display = 'inline';
        }
        else {
            trend.style.display = 'none';
        }
    }
    // ── Score rank badge ──────────────────────────
    const rankBadge = el('homeScoreRankBadge');
    if (rankBadge) {
        if (score >= 80) {
            rankBadge.textContent = 'EXCELLENT';
            rankBadge.style.color = 'var(--cyan)';
            rankBadge.style.background = 'rgba(76,215,246,0.1)';
        }
        else if (score >= 60) {
            rankBadge.textContent = 'GREAT';
            rankBadge.style.color = 'var(--green)';
            rankBadge.style.background = 'rgba(78,222,163,0.1)';
        }
        else if (score >= 40) {
            rankBadge.textContent = 'GOOD';
            rankBadge.style.color = 'var(--plight)';
            rankBadge.style.background = 'rgba(124,58,237,0.12)';
        }
        else if (score > 0) {
            rankBadge.textContent = 'BUILDING';
            rankBadge.style.color = 'var(--muted)';
            rankBadge.style.background = 'rgba(255,255,255,0.05)';
        }
        rankBadge.style.display = score > 0 ? 'inline' : 'none';
    }
    // ── Best streak badge ─────────────────────────
    const bestBadge = el('homeStreakBestBadge');
    if (bestBadge) {
        const best = S.bestStreak || 0;
        bestBadge.style.display = best > 0 ? 'inline' : 'none';
        if (best > 0)
            bestBadge.textContent = 'BEST ' + best;
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
    const scoreTip = el('focusScoreTip');
    const tiers = [
        { label: 'Getting Started', tip: 'Complete your first session to begin building your score.' },
        { label: 'Building Momentum', tip: 'Good start — consistency is key.' },
        { label: 'Focus Mode', tip: 'Solid effort today. Keep your sessions going.' },
        { label: 'Deep Focus', tip: 'Strong consistency — you\'re in a great rhythm.' },
        { label: 'Flow State', tip: 'Peak performance today. Outstanding work.' },
    ];
    const tier = score === 0 ? tiers[0] : score < 25 ? tiers[1] : score < 50 ? tiers[2] : score < 75 ? tiers[3] : tiers[4];
    if (stateLabel)
        stateLabel.textContent = tier.label;
    if (scoreTip)
        scoreTip.textContent = tier.tip;
    renderFocusTimeChart();
    renderHomeSubjects();
    renderHomeTasks();
    renderHomeHeatmap();
    renderGoalProgress();
}
function renderGoalProgress() {
    const goal = S.dailyGoal || 120; // minutes
    const doneSec = todayFocusSec();
    const doneMin = Math.round(doneSec / 60);
    const pct = Math.min(100, (doneMin / goal) * 100);
    const bar = el('goalProgressBar');
    const txt = el('goalProgressText');
    const badge = el('goalBadge');
    if (!bar || !txt)
        return;
    bar.style.width = pct + '%';
    txt.textContent = `${doneMin} / ${goal} min`;
    if (pct >= 100) {
        bar.style.background = 'linear-gradient(90deg,var(--green),#22c55e)';
        if (badge) {
            badge.textContent = '🎉 DONE';
            badge.style.color = 'var(--green)';
            badge.style.borderColor = 'rgba(78,222,163,0.3)';
        }
    }
    else if (pct >= 60) {
        if (badge) {
            badge.textContent = 'ON TRACK';
            badge.style.color = 'var(--cyan)';
            badge.style.borderColor = 'rgba(76,215,246,0.25)';
        }
    }
    else {
        if (badge) {
            badge.textContent = 'START NOW';
            badge.style.color = 'var(--muted)';
        }
    }
}
function promptGoal() {
    const cur = S.dailyGoal || 120;
    const input = prompt(`Daily focus goal (minutes):\nCurrent: ${cur} min`, String(cur));
    const parsed = parseInt(input ?? '', 10);
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
    if (!wrap)
        return;
    const COLS = 84; // 12 weeks × 7 days
    const ROWS = 7;
    const now = new Date();
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
            const title = `${day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${c} session${c !== 1 ? 's' : ''}`;
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
    const chart = el('focusTimeChart');
    const labels = el('focusTimeLabels');
    if (!chart)
        return;
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
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
    if (!c)
        return;
    const recent = [...S.subjects].sort((a, b) => b.accessed - a.accessed).slice(0, 4);
    if (!recent.length) {
        c.innerHTML = '<p style="color:var(--muted);font-size:13px;grid-column:span 2;">No subjects yet — add some in the Library.</p>';
        return;
    }
    c.innerHTML = recent.map(s => {
        const subjSessions = S.sessions.filter(x => x.subjectId === s.id);
        const subjMins = Math.round(subjSessions.reduce((n, x) => n + x.duration, 0) / 60);
        const timeLabel = subjMins >= 60 ? `${Math.floor(subjMins / 60)}h ${subjMins % 60}m` : subjMins > 0 ? `${subjMins}m` : null;
        const metaLabel = timeLabel
            ? `${timeLabel} · ${subjSessions.length} session${subjSessions.length !== 1 ? 's' : ''}`
            : subjSessions.length > 0
                ? `${subjSessions.length} session${subjSessions.length !== 1 ? 's' : ''}`
                : 'Not started yet';
        const progressPct = Math.min(100, (subjSessions.length / 10) * 100);
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
      <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:var(--text);">${s.name}</div>
      <div style="font-size:12px;color:var(--muted);line-height:1.4;margin-bottom:14px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${s.desc}</div>
      <div style="height:3px;background:rgba(255,255,255,0.07);border-radius:2px;overflow:hidden;">
        <div style="width:${progressPct}%;height:100%;background:${s.color};border-radius:2px;transition:width 0.6s ease;opacity:0.85;"></div>
      </div>
    </div>
  `;
    }).join('');
}
function startSubject(id) {
    timer.subjectId = id;
    const s = S.subjects.find(x => x.id === id);
    if (s)
        s.accessed = Date.now();
    save();
    goTo('focus');
}
function renderHomeTasks() {
    const list = el('homeTasksList');
    if (!list)
        return;
    // Update task count badge
    const done = S.tasks.filter(t => t.done).length;
    const badge = el('taskCountBadge');
    if (badge)
        badge.textContent = `${done} done`;
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
            const id = +(cb.dataset['id'] ?? '');
            const t = S.tasks.find(x => x.id === id);
            if (t) {
                t.done = cb.checked;
                save();
                renderHomeTasks();
                if (currentView === 'tasks')
                    renderTasks();
            }
        });
    });
}
function renderLearningMap() {
    const map = el('learningMap');
    if (!map)
        return;
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
    const lines = nodes.map(n => `<line x1="${cx}" y1="${cy}" x2="${n.x}" y2="${n.y}" stroke="rgba(124,58,237,0.18)" stroke-width="1"/>`).join('');
    const circles = nodes.map(n => `
    <g>
      <circle cx="${n.x}" cy="${n.y}" r="9" fill="${n.color}" opacity="0.85"/>
      <text x="${n.x}" y="${n.y + 22}" text-anchor="middle" fill="#64748b" font-size="10" font-family="Manrope,sans-serif">${n.name.split(' ')[0]}</text>
    </g>
  `).join('');
    const hub = `<circle cx="${cx}" cy="${cy}" r="11" fill="var(--primary)"/>
    <text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="white" font-size="12" font-family="Manrope">⚡</text>`;
    map.innerHTML = `<svg width="100%" height="${h}">${lines}${hub}${circles}</svg>`;
}
// ── FOCUS ────────────────────────────────────────────────────────────────────
function renderFocus() {
    const idle = el('focusIdleContent');
    const active = el('focusActiveLayout');
    if (!idle || !active)
        return;
    const isActive = timer.running || timer.timeLeft < timer.totalTime;
    document.body.classList.toggle('focus-active', isActive);
    if (isActive) {
        renderFocusActive();
    }
    else {
        // Populate subject select
        const sel = el('focusSubjectSelect');
        if (sel) {
            sel.innerHTML = '<option value="" style="background:#0d1628;">Select a subject...</option>'
                + S.subjects.map(s => `<option value="${s.id}" style="background:#0d1628;" ${s.id === timer.subjectId ? 'selected' : ''}>${s.name}</option>`).join('');
        }
        // Reset preset buttons
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active-preset'));
        const def = document.querySelector(`.preset-btn[data-focus="${Math.round(S.focusDuration / 60)}"]`);
        if (def)
            def.classList.add('active-preset');
    }
}
function renderFocusActive() {
    updateTimerDisplay();
    renderAmbient();
    syncAmbient(); // resume any active ambient sounds
    renderMilestones();
    renderQuote();
    const ti = el('focusTitle');
    const ts = el('focusSubtitle');
    if (ti)
        ti.textContent = timer.intent || 'Focus Session';
    if (ts) {
        const s = S.subjects.find(x => x.id === timer.subjectId);
        ts.textContent = s ? 'Deep Work: ' + s.name : 'Deep Work';
    }
    const notes = el('quickNotesInput');
    if (notes)
        notes.value = S.sessionNotes;
}
function renderAmbient() {
    const list = el('ambientList');
    if (!list)
        return;
    const sounds = [
        { key: 'lofi', label: 'Lo-Fi Beats', icon: 'music_note', color: 'var(--plight)', bg: 'rgba(124,58,237,0.12)' },
        { key: 'rain', label: 'Rain Shower', icon: 'water_drop', color: 'var(--cyan)', bg: 'rgba(76,215,246,0.1)' },
        { key: 'forest', label: 'Forest Wind', icon: 'forest', color: 'var(--green)', bg: 'rgba(78,222,163,0.1)' },
        { key: 'white', label: 'White Noise', icon: 'waves', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
    ];
    list.innerHTML = sounds.map(s => {
        const v = S.ambient[s.key] || 0;
        const active = v > 0;
        return `
      <div style="margin-bottom:10px;">
        <button class="amb-btn ${active ? 'playing' : ''}" data-amb="${s.key}" title="Toggle ${s.label}">
          <div class="amb-btn-icon" style="background:${active ? s.bg : 'rgba(255,255,255,0.05)'};">
            <span class="ms" style="font-size:15px;color:${active ? s.color : 'var(--muted)'};">${s.icon}</span>
          </div>
          <span style="flex:1;">${s.label}</span>
          <span style="font-size:11px;font-family:'Space Grotesk';font-weight:600;color:${active ? s.color : 'var(--muted2)'};">${active ? v + '%' : 'OFF'}</span>
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
            const k = btn.dataset['amb'];
            if ((S.ambient[k] || 0) > 0) {
                S.ambient[k] = 0;
                stopAmbientKey(k);
            }
            else {
                S.ambient[k] = 65;
                startAmbientKey(k, 65);
            }
            save();
            renderAmbient();
        });
    });
    // Volume slider
    list.querySelectorAll('input[type="range"]').forEach(sl => {
        sl.addEventListener('input', e => {
            e.stopPropagation();
            const k = sl.dataset['sound'];
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
    if (!list)
        return;
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
            const m = S.milestones.find(x => x.id === +(cb.dataset['id'] ?? ''));
            if (m) {
                m.done = cb.checked;
                save();
                renderMilestones();
            }
        });
    });
}
function renderQuote() {
    const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    const t = el('quoteText');
    const a = el('quoteAuthor');
    if (t)
        t.textContent = q.t;
    if (a)
        a.textContent = '— ' + q.a.toUpperCase();
}
// ── TIMER ENGINE ─────────────────────────────────────────────────────────────
function updateTimerDisplay() {
    const m = Math.floor(timer.timeLeft / 60);
    const s = timer.timeLeft % 60;
    const disp = el('timerDisplay');
    if (disp)
        disp.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    const ring = el('timerRing');
    if (ring) {
        const pct = timer.timeLeft / timer.totalTime;
        ring.setAttribute('stroke-dashoffset', String(TIMER_C * (1 - pct)));
        ring.setAttribute('stroke', timer.mode === 'break' ? 'var(--green)' : 'var(--cyan)');
    }
    const lbl = el('timerLabel');
    if (lbl)
        lbl.textContent = timer.mode === 'break' ? 'BREAK' : 'REMAINING';
}
function setTimerBtn(running) {
    const icon = el('playPauseIcon');
    if (icon)
        icon.textContent = running ? 'pause' : 'play_arrow';
}
function startTimer() {
    if (timer.interval)
        return;
    timer.running = true;
    document.body.classList.add('timer-running');
    setTimerBtn(true);
    timer.interval = setInterval(() => {
        timer.timeLeft = Math.max(0, timer.timeLeft - 1);
        updateTimerDisplay();
        if (timer.timeLeft === 0) {
            clearInterval(timer.interval);
            timer.interval = undefined;
            timer.running = false;
            setTimerBtn(false);
            if (timer.mode === 'focus')
                logSession();
            // Flash green
            const disp = el('timerDisplay');
            if (disp) {
                disp.style.color = 'var(--green)';
                setTimeout(() => { disp.style.color = 'white'; }, 2500);
            }
            // Auto switch mode
            if (timer.mode === 'focus') {
                timer.mode = 'break';
                timer.totalTime = S.breakDuration;
                timer.timeLeft = S.breakDuration;
            }
            else {
                timer.mode = 'focus';
                timer.totalTime = S.focusDuration;
                timer.timeLeft = S.focusDuration;
            }
            updateTimerDisplay();
        }
    }, 1000);
}
function pauseTimer() {
    clearInterval(timer.interval);
    timer.interval = undefined;
    timer.running = false;
    document.body.classList.remove('timer-running');
    setTimerBtn(false);
}
function resetTimer() {
    pauseTimer();
    timer.timeLeft = timer.totalTime;
    updateTimerDisplay();
}
function skipTimer() {
    if (timer.mode === 'focus')
        logSession();
    pauseTimer();
    timer.mode = timer.mode === 'focus' ? 'break' : 'focus';
    timer.totalTime = timer.mode === 'focus' ? S.focusDuration : S.breakDuration;
    timer.timeLeft = timer.totalTime;
    updateTimerDisplay();
}
function logSession() {
    const dur = timer.totalTime - timer.timeLeft;
    if (dur < 30)
        return;
    S.sessions.push({ date: new Date().toISOString(), duration: dur, subjectId: timer.subjectId });
    if (timer.subjectId) {
        const s = S.subjects.find(x => x.id === timer.subjectId);
        if (s) {
            s.accessed = Date.now();
            s.docs++;
        }
    }
    // ── Update streak ──────────────────────────────
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    // Sessions before the one we just added
    const prev = S.sessions.slice(0, -1);
    const hadToday = prev.some(s => new Date(s.date).toDateString() === today);
    const hadYesterday = prev.some(s => new Date(s.date).toDateString() === yesterday);
    if (!hadToday) {
        // First session of this day
        S.streak = hadYesterday ? (S.streak || 0) + 1 : 1;
        S.bestStreak = Math.max(S.bestStreak || 0, S.streak);
    }
    save();
    if (currentView === 'home')
        renderGoalProgress();
}
function beginFocusSession() {
    const intentEl = el('focusIntentInput');
    const subjEl = el('focusSubjectSelect');
    timer.intent = intentEl?.value?.trim() || 'Focus Session';
    timer.subjectId = subjEl?.value ? +subjEl.value : null;
    timer.mode = 'focus';
    timer.totalTime = S.focusDuration;
    timer.timeLeft = S.focusDuration;
    if (!S.milestones.length) {
        S.milestones = [
            { id: S.nextId++, text: 'Complete reading', done: false },
            { id: S.nextId++, text: 'Take notes', done: false },
        ];
    }
    save();
    document.body.classList.add('focus-active');
    renderFocusActive();
    startTimer();
}
function exitFocusSession() {
    if (!confirm('End this focus session?'))
        return;
    logSession();
    pauseTimer();
    timer.timeLeft = S.focusDuration;
    timer.totalTime = S.focusDuration;
    timer.mode = 'focus';
    S.milestones = [];
    save();
    document.body.classList.remove('focus-active');
    renderFocus();
    updateTimerDisplay();
}
// ── LIBRARY ──────────────────────────────────────────────────────────────────
// ── Document helpers ─────────────────────────────
function docIcon(type) {
    if (type === 'note')
        return 'sticky_note_2';
    if (type === 'link')
        return 'link';
    return 'draft';
}
function docSize(bytes) {
    if (bytes < 1024)
        return bytes + ' B';
    if (bytes < 1024 * 1024)
        return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
function renderLibrary() {
    const grid = el('libraryGrid');
    const search = (elInput('libSearchInput')?.value ?? '').toLowerCase();
    if (!grid)
        return;
    const filtered = S.subjects.filter(s => !search || s.name.toLowerCase().includes(search) || s.desc.toLowerCase().includes(search));
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
        <div style="font-weight:700;font-size:15px;margin-bottom:5px;">${s.name}</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:12px;flex:1;">${s.desc}</div>

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
                  <span style="font-size:12px;font-weight:500;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.name}</span>
                  <button onclick="event.stopPropagation();deleteDoc(${s.id},${d.id})"
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
    `;
    }).join('')}
  `;
}
// ── Doc modal state ──────────────────────────────
let docModalSubjId = null;
let docModalTab = 'file';
function openDocModal(subjId) {
    docModalSubjId = subjId;
    docModalTab = 'file';
    const s = S.subjects.find(x => x.id === subjId);
    if (!s)
        return;
    const modal = el('docModal');
    const title = el('docModalTitle');
    if (title)
        title.textContent = s.name;
    renderDocModal();
    if (modal) {
        modal.style.display = 'flex';
        requestAnimationFrame(() => modal.classList.add('open'));
    }
    document.body.style.overflow = 'hidden';
}
function closeDocModal() {
    const modal = el('docModal');
    if (!modal)
        return;
    modal.classList.remove('open');
    setTimeout(() => { modal.style.display = 'none'; }, 220);
    document.body.style.overflow = '';
    docModalSubjId = null;
}
// ── FOOTER MODAL ─────────────────────────────────────────────────────────────
const FOOTER_CONTENT = {
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
      <p>Questions? Email us at <a href="mailto:aihan@mifthas.com">aihan@mifthas.com</a></p>
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
      <p>Questions? Email <a href="mailto:aihan@mifthas.com">aihan@mifthas.com</a></p>
    `,
    },
};
function openFooterLink(page) {
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
        window.location.href = 'mailto:aihan@mifthas.com';
        return;
    }
    const data = FOOTER_CONTENT[page];
    if (!data)
        return;
    const modal = el('footerModal');
    const title = el('footerModalTitle');
    const body = el('footerModalBody');
    if (!modal || !title || !body)
        return;
    title.textContent = data.title;
    body.innerHTML = data.html;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => modal.classList.add('open'));
}
function closeFooterModal() {
    const modal = el('footerModal');
    if (!modal)
        return;
    modal.classList.remove('open');
    setTimeout(() => { modal.style.display = 'none'; }, 220);
    document.body.style.overflow = '';
}
// Allow Escape key to close footer modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape')
        closeFooterModal();
});
function setDocTab(tab) {
    docModalTab = tab;
    renderDocModal();
}
function renderDocModal() {
    const body = el('docModalBody');
    if (!body)
        return;
    const tabs = [
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
        <div style="font-size:12px;color:var(--muted);">PDF, images, text files — up to 5 MB</div>
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
        if (docModalSubjId === null)
            return '';
        const s = S.subjects.find(x => x.id === docModalSubjId);
        const docs = s?.documents || [];
        if (!docs.length)
            return '';
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
                  <div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.name}</div>
                  <div style="font-size:10px;color:var(--muted);">${d.type.toUpperCase()}${d.size ? ' · ' + docSize(d.size) : ''} · ${timeAgo(d.date)}</div>
                </div>
                <button onclick="event.stopPropagation();deleteDoc(${docModalSubjId},${d.id});renderDocModal()"
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
function handleDocFileSelect(input) {
    const files = Array.from(input.files || []);
    files.forEach(file => readAndAddDoc(file));
    input.value = '';
}
function handleDocDrop(e) {
    const files = Array.from(e.dataTransfer?.files || []);
    files.forEach(file => readAndAddDoc(file));
}
function readAndAddDoc(file) {
    if (docModalSubjId === null)
        return;
    const MAX = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX) {
        showToast(`${file.name} is too large (max 5 MB)`, 'warning');
        return;
    }
    const reader = new FileReader();
    reader.onload = () => {
        addDocToSubject({
            id: S.nextId++,
            name: file.name,
            type: 'file',
            content: reader.result,
            mime: file.type,
            size: file.size,
            date: Date.now(),
        });
    };
    reader.readAsDataURL(file);
}
function saveDocNote() {
    const title = (elInput('docNoteTitle')?.value ?? '').trim();
    const content = document.getElementById('docNoteContent')?.value.trim() ?? '';
    if (!title) {
        showToast('Please enter a title', 'warning');
        return;
    }
    addDocToSubject({ id: S.nextId++, name: title, type: 'note', content, date: Date.now() });
}
function saveDocLink() {
    const label = (elInput('docLinkLabel')?.value ?? '').trim();
    const url = (elInput('docLinkUrl')?.value ?? '').trim();
    if (!label || !url) {
        showToast('Please enter both a label and URL', 'warning');
        return;
    }
    const name = label || url;
    addDocToSubject({ id: S.nextId++, name, type: 'link', content: url, date: Date.now() });
}
function addDocToSubject(doc) {
    if (docModalSubjId === null)
        return;
    const s = S.subjects.find(x => x.id === docModalSubjId);
    if (!s)
        return;
    if (!s.documents)
        s.documents = [];
    s.documents.unshift(doc);
    s.docs = s.documents.length;
    save();
    renderDocModal();
    renderLibrary();
    showToast(`"${doc.name}" added`, 'success');
}
function deleteDoc(subjId, docId) {
    const s = S.subjects.find(x => x.id === subjId);
    if (!s)
        return;
    s.documents = (s.documents || []).filter(d => d.id !== docId);
    s.docs = s.documents.length;
    save();
    renderLibrary();
}
function openDoc(subjId, docId) {
    const s = S.subjects.find(x => x.id === subjId);
    const d = s?.documents?.find(x => x.id === docId);
    if (!d)
        return;
    if (d.type === 'link') {
        window.open(d.content, '_blank', 'noopener');
    }
    else if (d.type === 'note') {
        const w = window.open('', '_blank');
        if (w) {
            w.document.write(`<html><head><title>${d.name}</title><style>body{font-family:sans-serif;max-width:700px;margin:40px auto;padding:20px;line-height:1.7;color:#1e293b;}</style></head><body><h2>${d.name}</h2><pre style="white-space:pre-wrap;">${d.content}</pre></body></html>`);
            w.document.close();
        }
    }
    else {
        // File — trigger download
        const a = document.createElement('a');
        a.href = d.content;
        a.download = d.name;
        a.click();
    }
}
function showAddSubject() {
    const name = prompt('Subject name:');
    if (!name?.trim())
        return;
    const desc = prompt('Brief description:') || '';
    S.subjects.push({
        id: S.nextId++,
        name: name.trim(),
        desc: desc.trim(),
        docs: 0,
        color: SUBJECT_COLORS[S.subjects.length % SUBJECT_COLORS.length],
        accessed: Date.now(),
    });
    save();
    renderLibrary();
}
function deleteSubject(id) {
    if (!confirm('Remove this subject?'))
        return;
    S.subjects = S.subjects.filter(s => s.id !== id);
    save();
    renderLibrary();
}
let aiImportSubjId = null;
let aiImportSource = null;
let aiImportResult = null;
let aiImportResultTab = 'flashcards';
// ── Picker popup ─────────────────────────────────
function openAIImportPicker(subjId, anchorEl) {
    aiImportSubjId = subjId;
    const picker = el('aiImportPicker');
    if (!picker)
        return;
    // Close if already open for same button
    if (picker.classList.contains('open')) {
        closeAIImportPicker();
        return;
    }
    const rect = anchorEl.getBoundingClientRect();
    picker.style.top = (rect.bottom + 8 + window.scrollY) + 'px';
    picker.style.left = Math.min(rect.left, window.innerWidth - 240) + 'px';
    picker.classList.add('open');
    // Click-outside to close
    setTimeout(() => {
        document.addEventListener('click', handlePickerOutside, { once: true, capture: true });
    }, 10);
}
function handlePickerOutside(e) {
    const picker = el('aiImportPicker');
    if (picker && !picker.contains(e.target))
        closeAIImportPicker();
}
function closeAIImportPicker() {
    const picker = el('aiImportPicker');
    if (!picker)
        return;
    picker.style.animation = 'none';
    picker.style.opacity = '0';
    picker.style.transform = 'scale(0.9) translateY(-6px)';
    picker.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
    setTimeout(() => {
        picker.classList.remove('open');
        picker.style.cssText = '';
    }, 160);
}
// ── Modal open/close ─────────────────────────────
function startAIImport(source) {
    closeAIImportPicker();
    aiImportSource = source;
    aiImportResult = null;
    const s = S.subjects.find(x => x.id === aiImportSubjId);
    const nameEl = el('aiImportSubjName');
    if (nameEl && s)
        nameEl.textContent = s.name;
    const modal = el('aiImportModal');
    if (!modal)
        return;
    modal.style.display = 'flex';
    requestAnimationFrame(() => {
        requestAnimationFrame(() => modal.classList.add('visible'));
    });
    document.body.style.overflow = 'hidden';
    renderAIImportStep('input');
}
function closeAIImport() {
    const modal = el('aiImportModal');
    if (!modal)
        return;
    modal.classList.remove('visible');
    setTimeout(() => { modal.style.display = 'none'; }, 220);
    document.body.style.overflow = '';
}
function renderAIImportStep(step) {
    const body = el('aiImportBody');
    if (!body)
        return;
    if (step === 'input') {
        body.innerHTML = aiImportSource === 'youtube' ? renderYTInput() : renderFileInput();
    }
    else if (step === 'processing') {
        body.innerHTML = renderProcessing();
    }
    else {
        body.innerHTML = renderResult();
    }
}
function renderYTInput() {
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
function renderFileInput() {
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
        <div style="font-size:12px;color:var(--muted);">PDF, TXT, MD, images · up to 10 MB</div>
      </div>
      <input type="file" id="aiFileInput" style="display:none;" accept=".pdf,.txt,.md,.csv,.doc,.docx,image/*" onchange="handleAIFileSelect(this)">
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
function renderProcessing() {
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
        ${['Reading', 'Analysing', 'Flashcards', 'Notes'].map((s, i) => `
          <div style="display:flex;flex-direction:column;align-items:center;gap:5px;">
            <div id="stepDot${i}" style="width:8px;height:8px;border-radius:50%;background:${i === 0 ? 'var(--primary)' : 'rgba(255,255,255,0.12)'};transition:background 0.3s ease;"></div>
            <div style="font-size:9px;color:var(--muted);font-family:'Space Grotesk';letter-spacing:0.04em;">${s.toUpperCase()}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
function renderResult() {
    if (!aiImportResult)
        return '<p style="color:var(--muted);">No results.</p>';
    const r = aiImportResult;
    const tabs = [
        { key: 'flashcards', label: `Flashcards (${r.flashcards.length})`, icon: 'style' },
        { key: 'summary', label: 'Summary', icon: 'article' },
        { key: 'outline', label: 'Outline', icon: 'format_list_bulleted' },
    ];
    let tabContent = '';
    if (aiImportResultTab === 'flashcards') {
        tabContent = `<div style="display:flex;flex-direction:column;gap:8px;max-height:320px;overflow-y:auto;padding-right:4px;">
      ${r.flashcards.map((fc, i) => `
        <div class="fc-result-item" style="animation-delay:${i * 0.04}s">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;color:var(--plight);font-family:'Space Grotesk';margin-bottom:5px;">Q</div>
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;">${fc.q}</div>
          <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;color:var(--green);font-family:'Space Grotesk';margin-bottom:5px;">A</div>
          <div style="font-size:13px;color:var(--muted);line-height:1.5;">${fc.a}</div>
        </div>
      `).join('')}
    </div>`;
    }
    else if (aiImportResultTab === 'summary') {
        // Convert basic markdown to HTML
        const html = r.summary
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^### (.+)$/gm, '<h2>$1</h2>')
            .replace(/^\*\s+(.+)$/gm, '<li>$1</li>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^(?!<[hup])/gm, '<p>').replace(/<p><\/p>/g, '');
        tabContent = `<div class="ai-summary" style="max-height:320px;overflow-y:auto;padding-right:4px;">${html}</div>`;
    }
    else {
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
          <div style="font-size:11px;color:var(--muted);">${r.flashcards.length} flashcards · summary · outline generated</div>
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
function setAIResultTab(tab) {
    aiImportResultTab = tab;
    renderAIImportStep('result');
}
// ── File handling ────────────────────────────────
let aiImportFileData = null;
function handleAIFileSelect(input) {
    const file = input.files?.[0];
    if (!file)
        return;
    readAIFile(file);
    input.value = '';
}
function handleAIFileDrop(e) {
    const file = e.dataTransfer?.files?.[0];
    if (file)
        readAIFile(file);
}
function readAIFile(file) {
    const MAX = 10 * 1024 * 1024;
    if (file.size > MAX) {
        showToast('File too large (max 10 MB)', 'warning');
        return;
    }
    const reader = new FileReader();
    reader.onload = () => {
        const content = reader.result;
        aiImportFileData = { name: file.name, content, size: file.size, mime: file.type };
        const chosen = el('aiFileChosen');
        const nameEl = el('aiFileName');
        const sizeEl = el('aiFileSize');
        const btn = el('aiFileProcessBtn');
        const zone = el('aiDropZone');
        if (chosen) {
            chosen.style.display = 'flex';
        }
        if (nameEl)
            nameEl.textContent = file.name;
        if (sizeEl)
            sizeEl.textContent = docSize(file.size);
        if (zone)
            zone.style.display = 'none';
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }
    };
    // Read as text for text files, dataURL for others
    if (file.type.startsWith('text/') || /\.(txt|md|csv|json)$/i.test(file.name)) {
        reader.readAsText(file);
    }
    else {
        reader.readAsDataURL(file);
    }
}
function clearAIFile() {
    aiImportFileData = null;
    const chosen = el('aiFileChosen');
    const zone = el('aiDropZone');
    const btn = el('aiFileProcessBtn');
    if (chosen)
        chosen.style.display = 'none';
    if (zone)
        zone.style.display = '';
    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.4';
        btn.style.cursor = 'not-allowed';
    }
}
// ── Processing ───────────────────────────────────
function advanceProcStep(step, label, sub) {
    const labelEl = el('procStepLabel');
    const subEl = el('procStepSub');
    if (labelEl) {
        labelEl.style.animation = 'none';
        labelEl.textContent = label;
        labelEl.style.animation = '';
    }
    if (subEl) {
        subEl.style.animation = 'none';
        subEl.textContent = sub;
        subEl.style.animation = '';
    }
    for (let i = 0; i <= 3; i++) {
        const dot = el('stepDot' + i);
        if (dot)
            dot.style.background = i <= step ? 'var(--primary)' : 'rgba(255,255,255,0.12)';
    }
}
async function processYouTube() {
    const url = (elInput('ytUrlInput')?.value ?? '').trim();
    if (!url) {
        showToast('Please enter a YouTube URL', 'warning');
        return;
    }
    renderAIImportStep('processing');
    advanceProcStep(0, 'Fetching video info…', 'Getting transcript from YouTube');
    try {
        const infoRes = await fetch('/api/youtube', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
        const info = await infoRes.json();
        if (!infoRes.ok)
            throw new Error(info.error || 'YouTube fetch failed');
        advanceProcStep(1, 'Analysing content…', `"${info.title}" · ${info.transcript ? 'transcript loaded' : 'using title only'}`);
        await new Promise(r => setTimeout(r, 600));
        advanceProcStep(2, 'Generating flashcards…', 'AI is extracting key concepts');
        const s = S.subjects.find(x => x.id === aiImportSubjId);
        const procRes = await fetch('/api/process-content', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: info.transcript, contentType: 'youtube', title: info.title, subjName: s?.name || '' }),
        });
        const result = await procRes.json();
        if (!procRes.ok)
            throw new Error(result.error || 'AI processing failed');
        advanceProcStep(3, 'Preparing notes…', 'Almost done!');
        await new Promise(r => setTimeout(r, 400));
        aiImportResult = result;
        aiImportResultTab = 'flashcards';
        // Auto-save the YouTube video as a link doc
        if (aiImportSubjId !== null) {
            addDocToSubject({ id: S.nextId++, name: info.title, type: 'link', content: url, date: Date.now() });
        }
        renderAIImportStep('result');
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        showToast('Error: ' + msg, 'error');
        renderAIImportStep('input');
    }
}
async function processFile() {
    if (!aiImportFileData)
        return;
    const { name, content, size, mime } = aiImportFileData;
    renderAIImportStep('processing');
    advanceProcStep(0, 'Reading file…', name);
    await new Promise(r => setTimeout(r, 300));
    advanceProcStep(1, 'Analysing content…', 'Extracting key concepts');
    try {
        const s = S.subjects.find(x => x.id === aiImportSubjId);
        // For base64 files, send just the data (AI can handle images too if provider supports it)
        const textContent = content.startsWith('data:') ? `[File: ${name}]` : content.slice(0, 12000);
        const procRes = await fetch('/api/process-content', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: textContent, contentType: 'file', title: name, subjName: s?.name || '' }),
        });
        advanceProcStep(2, 'Generating flashcards…', 'AI is creating study cards');
        const result = await procRes.json();
        if (!procRes.ok)
            throw new Error(result.error || 'Processing failed');
        advanceProcStep(3, 'Preparing notes…', 'Finishing up');
        await new Promise(r => setTimeout(r, 400));
        aiImportResult = result;
        aiImportResultTab = 'flashcards';
        // Auto-save the file as a doc
        if (aiImportSubjId !== null) {
            addDocToSubject({ id: S.nextId++, name, type: 'file', content, mime, size, date: Date.now() });
        }
        renderAIImportStep('result');
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        showToast('Error: ' + msg, 'error');
        renderAIImportStep('input');
    }
}
function saveAIResults() {
    if (!aiImportResult || aiImportSubjId === null)
        return;
    const s = S.subjects.find(x => x.id === aiImportSubjId);
    if (!s)
        return;
    // Merge flashcards into subject
    if (!s.cards)
        s.cards = [];
    const newCards = aiImportResult.flashcards.map(fc => ({ q: fc.q, a: fc.a }));
    s.cards.push(...newCards);
    // Save summary as a note doc
    if (aiImportResult.summary) {
        if (!s.documents)
            s.documents = [];
        s.documents.unshift({
            id: S.nextId++,
            name: 'AI Summary',
            type: 'note',
            content: aiImportResult.summary,
            date: Date.now(),
        });
        s.docs = s.documents.length;
    }
    save();
    renderLibrary();
    closeAIImport();
    showToast(`${newCards.length} flashcards + summary saved to ${s.name}`, 'success');
}
// ── STATS ────────────────────────────────────────────────────────────────────
function renderStats() {
    renderStatsDate();
    renderStatsBar();
    renderDonut();
    renderHeatmap();
    renderSessionLog();
    renderStatsInsight();
}
function renderStatsInsight() {
    const title = el('statsInsightTitle');
    const body = el('statsInsightBody');
    if (!title || !body)
        return;
    const totalSess = S.sessions.length;
    const totalMins = Math.round(S.sessions.reduce((n, s) => n + s.duration, 0) / 60);
    const streak = S.streak || 0;
    const bestStreak = S.bestStreak || 0;
    if (totalSess === 0) {
        title.textContent = 'Your journey starts with the first session.';
        body.textContent = 'Complete a focus session to begin building your personal study insights. Your data stays here — no fake numbers.';
        return;
    }
    // Find most studied subject
    const subjCounts = {};
    S.sessions.forEach(s => { if (s.subjectId != null)
        subjCounts[s.subjectId] = (subjCounts[s.subjectId] || 0) + 1; });
    const topSubjId = Object.entries(subjCounts).sort((a, b) => +b[1] - +a[1])[0]?.[0];
    const topSubj = S.subjects.find(s => s.id === +topSubjId);
    if (streak >= 3) {
        title.textContent = `${streak}-day streak — real consistency.`;
        body.textContent = `You've studied ${totalMins} minutes across ${totalSess} session${totalSess !== 1 ? 's' : ''}${bestStreak > streak ? ` — your personal best is ${bestStreak} days` : ''}.${topSubj ? ` ${topSubj.name} is your most visited subject.` : ''}`;
    }
    else if (totalSess >= 5) {
        title.textContent = `${totalSess} sessions logged — you're building a habit.`;
        body.textContent = `${totalMins} total minutes of focused study.${topSubj ? ` ${topSubj.name} is your most studied subject.` : ''} Keep your streak alive to unlock your best performance.`;
    }
    else {
        title.textContent = `${totalSess} session${totalSess !== 1 ? 's' : ''} logged — great start.`;
        body.textContent = `You've put in ${totalMins} focused minutes so far. Study consistently every day to build your streak and improve your focus score.`;
    }
}
function renderSessionLog() {
    const list = el('sessionLogList');
    const countEl = el('sessLogCount');
    if (!list)
        return;
    // Get last 15 sessions, newest first
    const recent = [...S.sessions].reverse().slice(0, 15);
    if (countEl)
        countEl.textContent = `${recent.length} of ${S.sessions.length}`;
    if (!recent.length) {
        list.innerHTML = `<p style="font-size:13px;color:var(--muted);padding:12px 0;">No sessions yet — complete your first focus session to see history here.</p>`;
        return;
    }
    const subjectMap = {};
    S.subjects.forEach(s => { subjectMap[s.id] = s; });
    list.innerHTML = recent.map((sess, i) => {
        const d = new Date(sess.date);
        const subj = sess.subjectId != null ? subjectMap[sess.subjectId] : undefined;
        const mins = Math.round(sess.duration / 60);
        const color = subj?.color || 'var(--primary)';
        const name = subj?.name || 'Free Study';
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
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
    if (!e)
        return;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    e.textContent = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' – ' +
        now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function renderStatsBar() {
    const chart = el('statsBarChart');
    const labels = el('statsBarLabels');
    if (!chart)
        return;
    // Generate 6 weekly chunks + today
    const now = new Date();
    const buckets = [];
    for (let i = 5; i >= 0; i--) {
        const from = new Date(now);
        from.setDate(now.getDate() - (i + 1) * 5);
        const to = new Date(now);
        to.setDate(now.getDate() - i * 5);
        const hrs = S.sessions
            .filter(s => { const d = new Date(s.date); return d >= from && d < to; })
            .reduce((n, s) => n + s.duration / 3600, 0);
        buckets.push({ hrs, label: from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), isToday: false });
    }
    const todayH = todayFocusSec() / 3600;
    buckets.push({ hrs: todayH, label: 'Today', isToday: true });
    const maxH = Math.max(...buckets.map(b => b.hrs), 0.1);
    chart.innerHTML = buckets.map(b => {
        const pct = b.hrs > 0 ? Math.max(4, (b.hrs / maxH) * 100) : 4;
        const bg = b.isToday ? 'var(--cyan)' : 'rgba(124,58,237,0.48)';
        const op = b.hrs === 0 ? '0.18' : '1';
        return `<div style="flex:1;height:${pct}%;background:${bg};border-radius:4px 4px 0 0;min-height:4px;transition:height 0.4s;opacity:${op};"></div>`;
    }).join('');
    if (labels)
        labels.innerHTML = buckets.map(b => `<span style="font-size:10px;">${b.label}</span>`).join('');
}
function renderDonut() {
    const svg = el('subjectDonut');
    const legend = el('subjectLegend');
    const total = el('totalHrsNum');
    if (!svg)
        return;
    const subjects = S.subjects;
    const r = 55, cx = 75, cy = 75;
    const C = 2 * Math.PI * r;
    const totalHrs = Math.round(S.sessions.reduce((n, s) => n + s.duration / 3600, 0));
    if (total)
        total.textContent = String(totalHrs);
    if (!subjects.length) {
        svg.setAttribute('viewBox', '0 0 150 150');
        svg.innerHTML = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="16"/>`;
        if (legend)
            legend.innerHTML = `<p style="font-size:12px;color:var(--muted);text-align:center;">No subjects yet</p>`;
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
            arcs.map(a => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${a.color}" stroke-width="16"
        stroke-dasharray="${a.arc} ${C - a.arc}" stroke-dashoffset="${a.off}"/>`).join('');
    if (legend) {
        legend.innerHTML = subjects.map(s => `
      <div style="display:flex;align-items:center;gap:8px;font-size:12px;">
        <div style="width:8px;height:8px;border-radius:50%;background:${s.color};flex-shrink:0;"></div>
        <span style="color:var(--muted);flex:1;">${s.name}</span>
        <span style="font-weight:600;">${Math.round(s.docs / tot * 100)}%</span>
      </div>
    `).join('');
    }
}
function renderHeatmap() {
    const grid = el('heatmapGrid');
    if (!grid)
        return;
    // 7 rows (days of week Mon–Sun) × 12 cols (weeks)
    const WEEKS = 12, DAYS = 7;
    grid.style.gridTemplateColumns = `repeat(${WEEKS}, 16px)`;
    grid.style.justifyContent = 'start';
    const now = new Date();
    const counts = {};
    S.sessions.forEach(s => {
        const key = new Date(s.date).toDateString();
        counts[key] = (counts[key] || 0) + 1;
    });
    const cells = [];
    for (let w = WEEKS - 1; w >= 0; w--) {
        for (let d = 0; d < DAYS; d++) {
            const day = new Date(now);
            day.setDate(now.getDate() - (w * 7 + (DAYS - 1 - d)));
            const c = counts[day.toDateString()] || 0;
            const level = c === 0 ? 0 : c === 1 ? 1 : c <= 3 ? 2 : c <= 5 ? 3 : 4;
            const alphas = ['0.06', '0.28', '0.52', '0.76', '1'];
            const title = `${day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${c} session${c !== 1 ? 's' : ''}`;
            cells.push(`<div style="aspect-ratio:1;border-radius:2px;background:rgba(124,58,237,${alphas[level]});" title="${title}"></div>`);
        }
    }
    grid.innerHTML = cells.join('');
}
// ── TASKS ────────────────────────────────────────────────────────────────────
function renderTasks() {
    const list = el('fullTasksList');
    if (!list)
        return;
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
            const t = S.tasks.find(x => x.id === +(cb.dataset['id'] ?? ''));
            if (t) {
                t.done = cb.checked;
                save();
                renderTasks();
                if (currentView === 'home')
                    renderHomeTasks();
            }
        });
    });
}
function addTask(text) {
    if (!text?.trim())
        return;
    S.tasks.push({ id: S.nextId++, text: text.trim(), done: false });
    save();
    renderTasks();
    if (currentView === 'home')
        renderHomeTasks();
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
        info: 'var(--plight)',
        success: 'var(--green)',
        warning: '#f59e0b',
        error: '#f87171',
    };
    const icons = { info: 'info', success: 'check_circle', warning: 'warning', error: 'error' };
    const toast = document.createElement('div');
    toast.className = 'brainfy-toast';
    toast.style.cssText = [
        'position:fixed', 'bottom:28px', 'left:50%', 'transform:translateX(-50%) translateY(0)',
        'background:rgba(7,15,31,0.96)', 'border:1px solid rgba(255,255,255,0.12)',
        'border-radius:12px', 'padding:12px 20px', 'font-size:14px', 'font-weight:500',
        `color:${colors[type] || colors.info}`,
        'z-index:9999', 'backdrop-filter:blur(16px)',
        'box-shadow:0 8px 32px rgba(0,0,0,0.5)', 'white-space:nowrap',
        'display:flex', 'align-items:center', 'gap:10px',
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
    if (!confirm('Sign out of Brainfy?'))
        return;
    pauseTimer();
    document.body.classList.remove('focus-active');
    handleSignOut();
}
// ── AUTH ─────────────────────────────────────────────────────────────────────
function passwordStrength(pw) {
    if (!pw)
        return 0;
    let s = 0;
    if (pw.length >= 8)
        s++;
    if (/[A-Z]/.test(pw))
        s++;
    if (/[0-9]/.test(pw))
        s++;
    if (/[^A-Za-z0-9]/.test(pw))
        s++;
    return s;
}
function showAuthError(id, msg) {
    const e = el(id);
    if (!e)
        return;
    e.textContent = msg;
    e.style.display = msg ? 'block' : 'none';
}
function setAuthLoading(btnId, loading) {
    const btn = elBtn(btnId);
    if (!btn)
        return;
    btn.disabled = loading;
    btn.textContent = loading ? 'Please wait…' : (btnId === 'signinSubmitBtn' ? 'Sign In' : 'Create Account');
    btn.style.opacity = loading ? '0.7' : '1';
}
// ── Firebase auth error → friendly message ────────
function friendlyAuthError(code) {
    switch (code) {
        case 'auth/user-not-found':
        case 'auth/invalid-credential': return 'No account found with that email or password.';
        case 'auth/wrong-password': return 'Incorrect password. Please try again.';
        case 'auth/email-already-in-use': return 'An account already exists with that email.';
        case 'auth/weak-password': return 'Password must be at least 6 characters.';
        case 'auth/invalid-email': return 'Please enter a valid email address.';
        case 'auth/too-many-requests': return 'Too many attempts. Please wait a moment and try again.';
        case 'auth/network-request-failed': return 'Network error. Check your connection and try again.';
        case 'auth/unauthorized-domain': return 'This domain is not authorised for sign-in. Contact support.';
        case 'auth/popup-blocked': return 'Pop-up blocked by your browser. Allow pop-ups and try again.';
        default: return 'Something went wrong. Please try again.';
    }
}
// Called after successful Firebase sign-in — syncs cloud state then navigates
async function onFirebaseSignIn(user, displayName) {
    firebaseUser = user;
    idToken = await user.getIdToken();
    // Refresh token automatically before it expires (every 55 min)
    setInterval(async () => {
        if (firebaseUser)
            idToken = await firebaseUser.getIdToken(true);
    }, 55 * 60 * 1000);
    // Load cloud state; if none, seed with local or default
    await loadFromCloud();
    // Always sync name from the real Firebase user — overrides any stale cloud value
    const realName = displayName || user.displayName || user.email?.split('@')[0] || 'Student';
    S.userName = realName;
    save();
    goTo('home');
}
function handleSignIn() {
    const email = elInput('signinEmail')?.value?.trim();
    const pw = elInput('signinPassword')?.value;
    showAuthError('signinError', '');
    if (!email || !email.includes('@')) {
        showAuthError('signinError', 'Please enter a valid email address.');
        return;
    }
    if (!pw || pw.length < 6) {
        showAuthError('signinError', 'Password must be at least 6 characters.');
        return;
    }
    setAuthLoading('signinSubmitBtn', true);
    firebase.auth().signInWithEmailAndPassword(email, pw)
        .then((cred) => onFirebaseSignIn(cred.user))
        .catch((err) => {
        setAuthLoading('signinSubmitBtn', false);
        showAuthError('signinError', friendlyAuthError(err.code));
    });
}
function handleSignup() {
    const name = elInput('signupName')?.value?.trim();
    const email = elInput('signupEmail')?.value?.trim();
    const pw = elInput('signupPassword')?.value;
    showAuthError('signupError', '');
    if (!name) {
        showAuthError('signupError', 'Please enter your name.');
        return;
    }
    if (!email || !email.includes('@')) {
        showAuthError('signupError', 'Please enter a valid email address.');
        return;
    }
    if (!pw || pw.length < 8) {
        showAuthError('signupError', 'Password must be at least 8 characters.');
        return;
    }
    setAuthLoading('signupSubmitBtn', true);
    firebase.auth().createUserWithEmailAndPassword(email, pw)
        .then((cred) => {
        // Save display name in Firebase profile (non-blocking)
        cred.user.updateProfile({ displayName: name }).catch(() => { });
        return onFirebaseSignIn(cred.user, name);
    })
        .catch((err) => {
        setAuthLoading('signupSubmitBtn', false);
        showAuthError('signupError', friendlyAuthError(err.code));
    });
}
function handleGoogleSignIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then((result) => onFirebaseSignIn(result.user, result.user.displayName || undefined))
        .catch((err) => {
        if (err.code !== 'auth/popup-closed-by-user') {
            showAuthError('signinError', friendlyAuthError(err.code));
        }
    });
}
function handleSignOut() {
    firebase.auth().signOut().then(() => {
        firebaseUser = null;
        idToken = null;
        S = structuredClone(DEFAULT_STATE);
        try {
            localStorage.removeItem(STORAGE_KEY);
        }
        catch (_) { }
        goTo('splash');
    });
}
function showForgot() {
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
            errEl.style.background = 'rgba(76,215,246,0.08)';
            errEl.style.borderColor = 'rgba(76,215,246,0.2)';
            errEl.style.color = 'var(--cyan)';
            errEl.style.display = 'block';
        }
    })
        .catch((err) => showAuthError('signinError', friendlyAuthError(err.code)));
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
        const inp = elInput('signinPassword');
        const icon = el('signinPwIcon');
        if (!inp || !icon)
            return;
        const show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        icon.textContent = show ? 'visibility' : 'visibility_off';
    });
    el('signupTogglePw')?.addEventListener('click', () => {
        const inp = elInput('signupPassword');
        const icon = el('signupPwIcon');
        if (!inp || !icon)
            return;
        const show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        icon.textContent = show ? 'visibility' : 'visibility_off';
    });
    // Password strength meter
    el('signupPassword')?.addEventListener('input', e => {
        const v = e.target.value;
        const str = passwordStrength(v);
        const bar = el('signupStrengthBar');
        if (!bar)
            return;
        const colors = ['', '#ef4444', '#f97316', '#eab308', '#4edea3'];
        const widths = ['0%', '25%', '50%', '75%', '100%'];
        bar.style.width = widths[str];
        bar.style.background = colors[str];
    });
    // Enter-key on auth inputs
    el('signinPassword')?.addEventListener('keydown', e => { if (e.key === 'Enter')
        handleSignIn(); });
    el('signupPassword')?.addEventListener('keydown', e => { if (e.key === 'Enter')
        handleSignup(); });
    // Sidebar nav
    document.querySelectorAll('[data-go]').forEach(btn => {
        btn.addEventListener('click', () => goTo(btn.dataset['go']));
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
            S.focusDuration = +(btn.dataset['focus'] ?? '25') * 60;
            S.breakDuration = +(btn.dataset['break'] ?? '5') * 60;
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
        if (e.key === 'Enter')
            beginFocusSession();
    });
    // Timer controls
    el('timerPlayPauseBtn')?.addEventListener('click', () => {
        if (timer.running)
            pauseTimer();
        else
            startTimer();
    });
    el('timerResetBtn')?.addEventListener('click', () => { if (confirm('Reset timer?'))
        resetTimer(); });
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
                input.value += (input.value ? '\n' : '') + btn.dataset['tag'] + ' ';
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
        const input = elInput('newTaskInput');
        addTask(input?.value);
        if (input)
            input.value = '';
    });
    elInput('newTaskInput')?.addEventListener('keydown', e => {
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
        document.getElementById('splash-pricing')?.scrollIntoView({ behavior: 'smooth' });
    });
    // ── Home: Exploration View ─────────────────────────
    el('explorationViewBtn')?.addEventListener('click', () => goTo('stats'));
    // ── Focus active: Notifications & Settings ─────────
    el('focusNotifBtn')?.addEventListener('click', () => {
        showToast('No new notifications', 'info');
    });
    el('focusSettingsBtn')?.addEventListener('click', () => {
        const dur = prompt(`Focus duration (minutes):`, String(Math.round(S.focusDuration / 60)));
        if (!dur || isNaN(+dur) || +dur < 1)
            return;
        const brk = prompt(`Break duration (minutes):`, String(Math.round(S.breakDuration / 60)));
        if (!brk || isNaN(+brk) || +brk < 1)
            return;
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
let aiHistory = [];
let aiTypingEl = null;
let aiIsOpen = false;
let aiAvailable = false;
// ── Check if server has AI configured ──────────
async function checkAIStatus() {
    try {
        const res = await fetch('/api/ai-status');
        const data = await res.json();
        aiAvailable = !!data.configured;
        // Update model badge in panel header
        const badge = document.getElementById('aiModelBadge');
        if (badge && data.model) {
            const providerIcon = data.provider === 'groq' ? '⚡' : '🤖';
            badge.textContent = `${providerIcon} ${data.model}`;
            badge.title = `Provider: ${data.provider}`;
        }
    }
    catch (_) {
        aiAvailable = false;
    }
    // Sidebar dot: green = ready, grey = offline
    const dot = document.querySelector('#aiNavBtn .ai-dot');
    if (dot)
        dot.style.background = aiAvailable ? 'var(--green)' : 'var(--muted)';
}
// ── Panel toggle ────────────────────────────────
function toggleAIPanel() {
    const panel = document.getElementById('aiPanel');
    const btn = document.getElementById('aiNavBtn');
    if (!panel)
        return;
    aiIsOpen = !aiIsOpen;
    panel.classList.toggle('open', aiIsOpen);
    btn?.classList.toggle('ai-active', aiIsOpen);
    if (aiIsOpen) {
        if (!aiAvailable) {
            showAIOffline();
        }
        else if (aiHistory.length === 0) {
            showAIWelcome();
        }
        setTimeout(() => document.getElementById('aiInput')?.focus(), 350);
    }
}
// ── System prompt — context-aware ──────────────
function buildSystemPrompt() {
    const todayMin = Math.round(todayFocusSec() / 60);
    const score = calcScore();
    const subjectList = S.subjects.map(s => s.name).join(', ') || 'None yet';
    const pending = S.tasks.filter(t => !t.done).length;
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
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
    if (!aiAvailable) {
        showAIOffline();
        return;
    }
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
            if (tc)
                tc.textContent = `${(data.usage.input_tokens + data.usage.output_tokens).toLocaleString()} tokens`;
        }
        // Offer to import if flashcard format detected
        if (/^Q:/m.test(reply)) {
            appendAIAction('➕ Import as flashcards', () => importAIFlashcards(reply));
        }
    }
    catch (e) {
        hideAITyping();
        const msg = e instanceof Error ? e.message : String(e);
        appendAIMsg('error', `**Something went wrong:** ${msg}`);
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
    plan: () => `Create a focused 7-day study plan for these subjects: **${S.subjects.map(s => s.name).join(', ')}**. Be specific with daily time blocks and topics.`,
    tips: () => `Based on my ${Math.round(todayFocusSec() / 60)} minutes of focus today and a score of ${calcScore()}/100 — give me 3 sharp, actionable tips to improve my study performance.`,
};
function aiQuickAction(type) {
    const msg = AI_QUICK[type]?.();
    if (msg)
        callClaude(msg);
}
// ── Message rendering ────────────────────────────
function appendAIMsg(role, text) {
    const feed = document.getElementById('aiMessages');
    if (!feed)
        return;
    const isUser = role === 'user';
    const isError = role === 'error';
    const wrap = document.createElement('div');
    wrap.className = 'ai-msg-wrap';
    wrap.style.cssText = `display:flex;gap:9px;align-items:flex-start;margin-bottom:16px;${isUser ? 'flex-direction:row-reverse;' : ''}`;
    // Avatar
    const av = document.createElement('div');
    av.style.cssText = `width:28px;height:28px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;font-family:'Space Grotesk';${isUser ? 'background:var(--primary);color:white;' :
        isError ? 'background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.25);' :
            'background:linear-gradient(135deg,rgba(124,58,237,0.3),rgba(76,215,246,0.15));border:1px solid rgba(124,58,237,0.35);'}`;
    av.innerHTML = isUser ? S.userName.charAt(0).toUpperCase() :
        isError ? '<span class="ms" style="font-size:14px;color:#f87171;">error</span>' :
            '<span class="ms" style="font-size:14px;color:var(--plight);">auto_awesome</span>';
    // Bubble
    const bub = document.createElement('div');
    bub.style.cssText = `max-width:290px;padding:10px 13px;font-size:13px;line-height:1.65;word-break:break-word;border-radius:${isUser ? '14px 3px 14px 14px' : '3px 14px 14px 14px'};${isUser ? 'background:linear-gradient(135deg,var(--primary),#6d28d9);color:white;' :
        isError ? 'background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);color:#f87171;' :
            'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07);color:var(--text);'}`;
    bub.innerHTML = formatAIText(text);
    wrap.appendChild(av);
    wrap.appendChild(bub);
    feed.appendChild(wrap);
    feed.scrollTop = feed.scrollHeight;
}
function appendAIAction(label, fn) {
    const feed = document.getElementById('aiMessages');
    if (!feed)
        return;
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
    if (!feed || aiTypingEl)
        return;
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
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code style="background:rgba(124,58,237,0.18);padding:1px 5px;border-radius:3px;font-size:11px;font-family:monospace;">$1</code>')
        .replace(/^### (.+)$/gm, '<div style="font-size:12px;font-weight:800;color:var(--plighter);margin:10px 0 4px;letter-spacing:0.04em;text-transform:uppercase;">$1</div>')
        .replace(/^## (.+)$/gm, '<div style="font-weight:800;color:white;margin:10px 0 5px;font-size:14px;">$1</div>')
        .replace(/^# (.+)$/gm, '<div style="font-weight:900;color:white;margin:10px 0 6px;font-size:15px;">$1</div>')
        .replace(/^[-*•]\s+(.+)$/gm, '<div style="padding-left:14px;margin:2px 0;">• $1</div>')
        .replace(/^\d+\.\s+(.+)$/gm, '<div style="padding-left:4px;margin:3px 0;">$&</div>')
        .replace(/^Q:\s*(.+)$/gm, '<div style="margin:6px 0 2px;color:var(--plight);font-weight:700;">Q: $1</div>')
        .replace(/^A:\s*(.+)$/gm, '<div style="margin:0 0 8px;color:var(--text);">A: $1</div>')
        .replace(/\n\n/g, '<br/>')
        .replace(/\n/g, '<br/>');
}
// ── Welcome screen ───────────────────────────────
function showAIWelcome() {
    const feed = document.getElementById('aiMessages');
    if (!feed)
        return;
    feed.innerHTML = '';
    aiHistory = [];
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    appendAIMsg('assistant', `${greet}, **${S.userName}**! 🧠\n\nI'm **Brainfy AI** — your personal study coach.\n\nI can:\n- **Explain** any concept with analogies\n- **Generate flashcards** from your notes\n- **Quiz you** on any subject\n- **Build** a personalised study plan\n- **Analyse** your focus patterns\n\nWhat would you like to work on?`);
}
// ── Offline / not-configured screen ─────────────
function showAIOffline() {
    const feed = document.getElementById('aiMessages');
    if (!feed)
        return;
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
    if (feed) {
        feed.innerHTML = '';
        showAIWelcome();
    }
}
function clearAIInput() {
    const inp = document.getElementById('aiInput');
    if (inp) {
        inp.value = '';
        inp.style.height = 'auto';
    }
}
function handleAISend() {
    const inp = document.getElementById('aiInput');
    const text = inp?.value?.trim();
    if (!text)
        return;
    callClaude(text);
}
// ── Import AI-generated flashcards ───────────────
function importAIFlashcards(text) {
    const pairs = [];
    const lines = text.split('\n');
    let q = null;
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('Q:')) {
            q = trimmed.slice(2).trim();
        }
        else if (trimmed.startsWith('A:') && q) {
            pairs.push({ q, a: trimmed.slice(2).trim() });
            q = null;
        }
    }
    if (!pairs.length) {
        showToast('No flashcard pairs found in response', 'warning');
        return;
    }
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
        if (!inp)
            return;
        inp.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAISend();
            }
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
    document.querySelectorAll('#splash-phil .phil-head').forEach((el, i) => {
        el.style.transitionDelay = (i * 0.1) + 's';
        observer.observe(el);
    });
    // Philosophy principle items — already have inline transition-delay
    document.querySelectorAll('#splash-phil .phil-item').forEach(el => observer.observe(el));
    // Philosophy right panel
    const philRight = document.querySelector('.phil-right');
    if (philRight)
        observer.observe(philRight);
}
function init() {
    load();
    timer.timeLeft = S.focusDuration;
    timer.totalTime = S.focusDuration;
    initEvents();
    initSplashObserver();
    checkAIStatus();
    // ── Firebase auth observer ────────────────────
    // Fires once on load: if user was already signed in, skip splash and
    // load their cloud state. If not, show splash as normal.
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            firebaseUser = user;
            idToken = await user.getIdToken();
            await loadFromCloud();
            // Always use real Firebase identity — never let stale Firestore data override the name
            S.userName = user.displayName || user.email?.split('@')[0] || 'Student';
            // Only auto-navigate if we're still on splash/signin/signup
            const authViews = ['splash', 'signin', 'signup'];
            if (authViews.includes(currentView))
                goTo('home');
        }
        else {
            // Only redirect to splash from app views — don't bounce users off sign-in/sign-up
            const authViews = ['splash', 'signin', 'signup'];
            if (!authViews.includes(currentView))
                goTo('splash');
        }
    });
}
document.addEventListener('DOMContentLoaded', init);
//# sourceMappingURL=script.js.map