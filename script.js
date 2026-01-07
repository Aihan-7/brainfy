/* =========================
   Brainfy – Core Script
   Intent-Driven + Focus State
========================= */

/* =========================
   Constants
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
   DOM
========================= */

const card = document.querySelector(".card");
const views = document.querySelectorAll(".view");

/* Focus UI */
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const focusRoom = document.getElementById("focusRoom");
const timerDisplay = document.getElementById("timer");
const modeText = document.getElementById("modeText");
const sessionsText = document.getElementById("sessionsText");

/* Intent */
const intentSheet = document.getElementById("intentSheet");
const intentInput = document.getElementById("intentInput");
const beginFocusBtn = document.getElementById("beginFocusBtn");

/* Notes */
const notesInput = document.getElementById("notesInput");
const notesPreview = document.getElementById("notesPreview");

/* Flashcards */
const questionInput = document.getElementById("questionInput");
const answerInput = document.getElementById("answerInput");
const addCardBtn = document.getElementById("addCardBtn");
const flashcard = document.getElementById("flashcard");
const cardQuestion = document.getElementById("cardQuestion");
const cardAnswer = document.getElementById("cardAnswer");
const prevBtn = document.getElementById("prevCard");
const nextBtn = document.getElementById("nextCard");
const flipBtn = document.getElementById("flipCard");
const flashcardView = document.querySelector(".flashcard-view");

/* =========================
   Navigation + Card Modes
========================= */

let currentView = "splash";

window.goTo = function (view) {
  views.forEach(v => v.classList.remove("active"));

  const target = document.getElementById(view + "View");
  if (!target) return;

  currentView = view;

  // Card sizing
  if (view === "home") {
    card.classList.remove("compact");
    card.classList.add("spacious");
  }

  if (view === "splash") {
    card.classList.remove("spacious");
    card.classList.add("compact");
  }

  requestAnimationFrame(() => target.classList.add("active"));
};

window.addEventListener("load", () => {
  card.classList.add("compact");
  goTo("splash");
});

/* =========================
   Focus State Helpers
========================= */

function enterFocusMode() {
  card.classList.add("focus-active");
}

function exitFocusMode() {
  card.classList.remove("focus-active");
  focusRoom.classList.add("hidden");
  intentSheet.classList.add("hidden");
}

/* =========================
   Timer State
========================= */

const timer = {
  mode: "focus",
  timeLeft: FOCUS_TIME,
  running: false,
  interval: null
};

/* =========================
   Sessions
========================= */

let sessionCount =
  parseInt(localStorage.getItem(STORAGE.SESSION_COUNT)) || 0;

let sessions =
  JSON.parse(localStorage.getItem(STORAGE.SESSIONS)) || [];

let currentSession = null;

if (sessionsText) {
  sessionsText.textContent = `Sessions completed: ${sessionCount}`;
}

function startSession(intent) {
  currentSession = {
    id: Date.now(),
    intent,
    startTime: Date.now(),
    endTime: null,
    notes: ""
  };
}

function saveSession() {
  if (!currentSession) return;
  currentSession.endTime = Date.now();
  sessions.push(currentSession);
  localStorage.setItem(STORAGE.SESSIONS, JSON.stringify(sessions));
  currentSession = null;
}

/* =========================
   Timer Logic
========================= */

function updateTimerUI() {
  const m = Math.floor(timer.timeLeft / 60);
  const s = timer.timeLeft % 60;
  timerDisplay.textContent = `${m}:${s < 10 ? "0" : ""}${s}`;
}

function switchMode() {
  if (timer.mode === "focus") {
    saveSession();

    sessionCount++;
    localStorage.setItem(STORAGE.SESSION_COUNT, sessionCount);
    sessionsText.textContent = `Sessions completed: ${sessionCount}`;

    timer.mode = "break";
    timer.timeLeft = BREAK_TIME;
    modeText.textContent = "Break";
  } else {
    timer.mode = "focus";
    timer.timeLeft = FOCUS_TIME;
    modeText.textContent = currentSession?.intent || "Focus";
  }
}

function tick() {
  if (!timer.running) return;

  if (timer.timeLeft > 0) {
    timer.timeLeft--;
    requestAnimationFrame(updateTimerUI);
  } else {
    switchMode();
  }
}

function startTimer() {
  if (timer.running) return;
  timer.running = true;
  timer.interval = setInterval(tick, 1000);
}

function resetTimer() {
  clearInterval(timer.interval);
  timer.running = false;
  timer.mode = "focus";
  timer.timeLeft = FOCUS_TIME;
  modeText.textContent = "Focus";
  exitFocusMode();
  updateTimerUI();
}

/* =========================
   Intent-Driven Focus Flow
========================= */

startBtn?.addEventListener("click", () => {
  intentSheet.classList.remove("hidden");
  intentInput.focus();
});

beginFocusBtn?.addEventListener("click", () => {
  const intent = intentInput.value.trim() || "Focus";

  startSession(intent);
  modeText.textContent = intent;

  intentInput.value = "";
  intentSheet.classList.add("hidden");
  focusRoom.classList.remove("hidden");

  enterFocusMode();

  timer.timeLeft = FOCUS_TIME;
  updateTimerUI();
  startTimer();
});

resetBtn?.addEventListener("click", resetTimer);

updateTimerUI();

/* =========================
   Notes (Safe Markdown)
========================= */

function escapeHTML(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

if (notesInput) {
  notesInput.value =
    localStorage.getItem(STORAGE.NOTES_DRAFT) || "";

  notesInput.addEventListener("input", () => {
    localStorage.setItem(STORAGE.NOTES_DRAFT, notesInput.value);
    if (currentSession) currentSession.notes = notesInput.value;
    notesPreview.innerHTML = parseMarkdown(
      escapeHTML(notesInput.value)
    );
  });
}

/* =========================
   Flashcards
========================= */

let cards =
  JSON.parse(localStorage.getItem(STORAGE.CARDS)) || [];

let cardIndex = 0;

function saveCards() {
  localStorage.setItem(STORAGE.CARDS, JSON.stringify(cards));
}

function showCard() {
  if (!cards.length) return;
  const c = cards[cardIndex];
  cardQuestion.textContent = c.q;
  cardAnswer.textContent = c.a;
  flashcard.classList.remove("flipped");
  flashcardView.classList.remove("hidden");
}

addCardBtn?.addEventListener("click", () => {
  if (!questionInput.value || !answerInput.value) return;

  cards.push({
    id: Date.now(),
    q: questionInput.value,
    a: answerInput.value,
    sourceIntent: currentSession?.intent || null
  });

  saveCards();
  cardIndex = cards.length - 1;
  questionInput.value = "";
  answerInput.value = "";
  showCard();
});

flipBtn?.addEventListener("click", () =>
  flashcard.classList.toggle("flipped")
);

prevBtn?.addEventListener("click", () => {
  if (!cards.length) return;
  cardIndex = (cardIndex - 1 + cards.length) % cards.length;
  showCard();
});

nextBtn?.addEventListener("click", () => {
  if (!cards.length) return;
  cardIndex = (cardIndex + 1) % cards.length;
  showCard();
});

showCard();

/* =========================
   Button Ripple
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
