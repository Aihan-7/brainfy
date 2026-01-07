/* =========================
   Brainfy – Core Script (Polished)
   ========================= */

/* =========================
   Constants & Storage Keys
========================= */

const STORAGE = {
  SESSION_COUNT: "brainfy_session_count",
  SESSIONS: "brainfy_sessions",
  CARDS: "brainfy_cards",
  NOTES_DRAFT: "brainfy_notes_draft"
};

const FOCUS_TIME = 25 * 60;
const BREAK_TIME = 5 * 60;

/* =========================
   Navigation (iOS-style)
========================= */

let currentView = "splash";

window.goTo = function (view) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const target = document.getElementById(view + "View");
  if (!target) return;

  currentView = view;
  requestAnimationFrame(() => target.classList.add("active"));
};

window.addEventListener("load", () => {
  goTo("splash");
});

/* =========================
   Timer State
========================= */

const timerState = {
  mode: "focus",
  timeLeft: FOCUS_TIME,
  running: false,
  interval: null
};

/* =========================
   DOM Elements
========================= */

const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const timerDisplay = document.getElementById("timer");
const modeText = document.getElementById("modeText");
const sessionsText = document.getElementById("sessionsText");

/* =========================
   Session Tracking
========================= */

let sessionCount = parseInt(localStorage.getItem(STORAGE.SESSION_COUNT)) || 0;
let sessionsData = JSON.parse(localStorage.getItem(STORAGE.SESSIONS)) || [];
let currentSession = null;

if (sessionsText) sessionsText.textContent = `Sessions completed: ${sessionCount}`;
if (modeText) modeText.textContent = "Focus";

function startNewSession() {
  currentSession = {
    id: Date.now(),
    mode: "focus",
    startTime: Date.now(),
    endTime: null,
    notes: ""
  };
}

function saveCurrentSession() {
  if (!currentSession) return;
  currentSession.endTime = Date.now();
  sessionsData.push(currentSession);
  localStorage.setItem(STORAGE.SESSIONS, JSON.stringify(sessionsData));
  currentSession = null;
}

/* =========================
   Timer Functions
========================= */

function updateTimerUI() {
  if (!timerDisplay) return;
  const m = Math.floor(timerState.timeLeft / 60);
  const s = timerState.timeLeft % 60;
  timerDisplay.textContent = `${m}:${s < 10 ? "0" : ""}${s}`;
}

function playSound(url) {
  const audio = new Audio(url);
  audio.volume = 0.6;
  audio.play().catch(() => {});
}

function vibrate(pattern = [15]) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

function switchMode() {
  if (timerState.mode === "focus") {
    saveCurrentSession();

    sessionCount++;
    localStorage.setItem(STORAGE.SESSION_COUNT, sessionCount);
    if (sessionsText) sessionsText.textContent = `Sessions completed: ${sessionCount}`;

    playSound("https://actions.google.com/sounds/v1/alarms/soft_bell.ogg");
    vibrate();

    timerState.mode = "break";
    timerState.timeLeft = BREAK_TIME;
    if (modeText) modeText.textContent = "Break";
  } else {
    playSound("https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg");
    vibrate([20, 30, 20]);

    timerState.mode = "focus";
    timerState.timeLeft = FOCUS_TIME;
    if (modeText) modeText.textContent = "Focus";
  }
}

function tick() {
  if (!timerState.running) return;

  if (timerState.timeLeft > 0) {
    timerState.timeLeft--;
    requestAnimationFrame(updateTimerUI);
  } else {
    switchMode();
  }
}

function startTimer() {
  if (timerState.running) return;

  timerState.running = true;
  startBtn && (startBtn.disabled = true);

  timerState.interval = setInterval(tick, 1000);
}

function resetTimer() {
  clearInterval(timerState.interval);
  timerState.running = false;
  timerState.interval = null;

  timerState.mode = "focus";
  timerState.timeLeft = FOCUS_TIME;

  if (modeText) modeText.textContent = "Focus";
  startBtn && (startBtn.disabled = false);
  updateTimerUI();
}

/* =========================
   Timer Events
========================= */

startBtn?.addEventListener("click", () => {
  startNewSession();
  timerState.timeLeft = FOCUS_TIME;
  updateTimerUI();
  startTimer();
});

resetBtn?.addEventListener("click", resetTimer);

updateTimerUI();

/* =========================
   Notes (Safe Markdown)
========================= */

const notesInput = document.getElementById("notesInput");
const notesPreview = document.getElementById("notesPreview");

function escapeHTML(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function parseMarkdown(text) {
  return text
    .replace(/^### (.*)$/gim, "<h3>$1</h3>")
    .replace(/^## (.*)$/gim, "<h2>$1</h2>")
    .replace(/^# (.*)$/gim, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
    .replace(/^- (.*)$/gim, "<ul><li>$1</li></ul>")
    .replace(/\n/gim, "<br>");
}

function updatePreview() {
  if (!notesInput || !notesPreview) return;
  const safe = escapeHTML(notesInput.value);
  notesPreview.innerHTML = parseMarkdown(safe);
}

if (notesInput) {
  notesInput.value = localStorage.getItem(STORAGE.NOTES_DRAFT) || "";
  updatePreview();

  notesInput.addEventListener("input", () => {
    localStorage.setItem(STORAGE.NOTES_DRAFT, notesInput.value);
    if (currentSession) currentSession.notes = notesInput.value;
    updatePreview();
  });
}

/* =========================
   Flashcards (Future-proof)
========================= */

const questionInput = document.getElementById("questionInput");
const answerInput = document.getElementById("answerInput");
const addCardBtn = document.getElementById("addCardBtn");
const flashcard = document.getElementById("flashcard");
const cardQuestion = document.getElementById("cardQuestion");
const cardAnswer = document.getElementById("cardAnswer");
const prevBtn = document.getElementById("prevCard");
const nextBtn = document.getElementById("nextCard");
const flipBtn = document.getElementById("flipCard");

let cards = JSON.parse(localStorage.getItem(STORAGE.CARDS)) || [];
let currentCardIndex = 0;

function saveCards() {
  localStorage.setItem(STORAGE.CARDS, JSON.stringify(cards));
}

function showCard() {
  if (!cards.length || !flashcard) return;
  const card = cards[currentCardIndex];
  cardQuestion.textContent = card.q;
  cardAnswer.textContent = card.a;
  flashcard.classList.remove("flipped");
}

addCardBtn?.addEventListener("click", () => {
  if (!questionInput.value || !answerInput.value) return;

  cards.push({
    id: Date.now(),
    q: questionInput.value,
    a: answerInput.value,
    strength: 0,
    lastReviewed: null,
    sourceSessionId: currentSession?.id || null
  });

  saveCards();
  currentCardIndex = cards.length - 1;
  questionInput.value = "";
  answerInput.value = "";
  showCard();
});

flipBtn?.addEventListener("click", () => flashcard.classList.toggle("flipped"));
prevBtn?.addEventListener("click", () => {
  if (!cards.length) return;
  currentCardIndex = (currentCardIndex - 1 + cards.length) % cards.length;
  showCard();
});
nextBtn?.addEventListener("click", () => {
  if (!cards.length) return;
  currentCardIndex = (currentCardIndex + 1) % cards.length;
  showCard();
});

showCard();

/* =========================
   Liquid Button Ripple
========================= */

document.querySelectorAll("button").forEach(btn => {
  btn.addEventListener("click", e => {
    const rect = btn.getBoundingClientRect();
    btn.style.setProperty("--x", `${e.clientX - rect.left}px`);
    btn.style.setProperty("--y", `${e.clientY - rect.top}px`);
    btn.classList.add("ripple");
    setTimeout(() => btn.classList.remove("ripple"), 600);
  });
});
