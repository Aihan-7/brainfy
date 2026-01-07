/* =========================
   Brainfy – Core Script
   ========================= */

/* =========================
   App Navigation (iOS-style)
========================= */

window.goTo = function (view) {
  const views = document.querySelectorAll(".view");

  views.forEach(v => v.classList.remove("active"));

  const target = document.getElementById(view + "View");
  if (target) {
    requestAnimationFrame(() => {
      target.classList.add("active");
    });
  }
};

window.addEventListener("load", () => {
  goTo("splash");
});


/* ---------- Elements ---------- */
const startBtn = document.getElementById("startBtn");
const focusRoom = document.getElementById("focusRoom");
const timerDisplay = document.getElementById("timer");
const resetBtn = document.getElementById("resetBtn");
const sessionsText = document.getElementById("sessionsText");
const modeText = document.getElementById("modeText");

/* ---------- Time Settings ---------- */
const FOCUS_TIME = 25 * 60;
const BREAK_TIME = 5 * 60;

/* ---------- State ---------- */
let time = FOCUS_TIME;
let interval = null;
let mode = "focus";

/* =========================
   Study Sessions
========================= */

let currentSession = null;

// Load all past sessions
let sessionsData = JSON.parse(localStorage.getItem("brainfy_sessions")) || [];

function startNewSession() {
  currentSession = {
    id: Date.now(),
    startTime: new Date().toISOString(),
    notes: ""
  };
}

function saveCurrentSession() {
  if (!currentSession) return;

  sessionsData.push(currentSession);
  localStorage.setItem("brainfy_sessions", JSON.stringify(sessionsData));
  currentSession = null;
}

/* ---------- Sessions ---------- */
let sessions = parseInt(localStorage.getItem("sessions")) || 0;
if (sessionsText) sessionsText.textContent = `Sessions completed: ${sessions}`;
if (modeText) modeText.textContent = "Focus";

/* ---------- Timer Utils ---------- */
function updateTimer() {
  if (!timerDisplay) return;
  const m = Math.floor(time / 60);
  const s = time % 60;
  timerDisplay.textContent = `${m}:${s < 10 ? "0" : ""}${s}`;
}

function playSound(type) {
  const audio = new Audio(
    type === "focus"
      ? "https://actions.google.com/sounds/v1/alarms/soft_bell.ogg"
      : "https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg"
  );
  audio.volume = 0.6;
  audio.play();
}

function vibrate(pattern = [15]) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

/* ---------- Timer Logic ---------- */
function startTimer() {
  if (interval) return;

  interval = setInterval(() => {
    if (time > 0) {
      time--;
      updateTimer();
      return;
    }

    clearInterval(interval);
    interval = null;

    if (mode === "focus") {
  // Save study session
  saveCurrentSession();

  sessions++;
  localStorage.setItem("sessions", sessions);
  sessionsText.textContent = `Sessions completed: ${sessions}`;

  playSound("focus");
  vibrate();

  mode = "break";
  time = BREAK_TIME;
  modeText.textContent = "Break";
  startTimer();
}else {
      playSound("break");
      vibrate([20, 30, 20]);

      mode = "focus";
      time = FOCUS_TIME;
      if (modeText) modeText.textContent = "Focus";
      startTimer();
    }
  }, 1000);
}

/* ---------- Focus Events ---------- */
if (startBtn && focusRoom) {
  startBtn.addEventListener("click", () => {
    startNewSession();              // 👈 NEW
    notesInput.value = "";          // fresh notes

    focusRoom.classList.remove("hidden");
    startBtn.style.display = "none";
    updateTimer();
    startTimer();
  });
}


if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    clearInterval(interval);
    interval = null;
    mode = "focus";
    time = FOCUS_TIME;
    if (modeText) modeText.textContent = "Focus";
    updateTimer();
  });
}

updateTimer();

/* =========================
   Smart Notes
========================= */

const notesInput = document.getElementById("notesInput");
const preview = document.getElementById("notesPreview");

if (notesInput) {
  notesInput.value = localStorage.getItem("brainfy_notes") || "";

  notesInput.addEventListener("input", () => {
    localStorage.setItem("brainfy_notes", notesInput.value);
    updatePreview();
  });
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
  if (!preview || !notesInput) return;
  preview.innerHTML = parseMarkdown(notesInput.value);
  preview.classList.add("visible");
}

updatePreview();

/* =========================
   Flashcards
========================= */

const questionInput = document.getElementById("questionInput");
const answerInput = document.getElementById("answerInput");
const addCardBtn = document.getElementById("addCardBtn");
const flashcardView = document.querySelector(".flashcard-view");
const flashcard = document.getElementById("flashcard");
const cardQuestion = document.getElementById("cardQuestion");
const cardAnswer = document.getElementById("cardAnswer");
const prevBtn = document.getElementById("prevCard");
const nextBtn = document.getElementById("nextCard");
const flipBtn = document.getElementById("flipCard");

let cards = JSON.parse(localStorage.getItem("brainfy_cards")) || [];
let current = 0;

function saveCards() {
  localStorage.setItem("brainfy_cards", JSON.stringify(cards));
}

function showCard() {
  if (!cards.length || !flashcardView) return;

  flashcardView.classList.remove("hidden");
  flashcard.classList.remove("flipped");
  cardQuestion.textContent = cards[current].q;
  cardAnswer.textContent = cards[current].a;
}

if (addCardBtn) {
  addCardBtn.addEventListener("click", () => {
    if (!questionInput.value || !answerInput.value) return;
    cards.push({ q: questionInput.value, a: answerInput.value });
    saveCards();
    current = cards.length - 1;
    questionInput.value = "";
    answerInput.value = "";
    showCard();
  });
}

if (flipBtn) flipBtn.addEventListener("click", () => flashcard.classList.toggle("flipped"));
if (prevBtn) prevBtn.addEventListener("click", () => {
  if (!cards.length) return;
  current = (current - 1 + cards.length) % cards.length;
  showCard();
});
if (nextBtn) nextBtn.addEventListener("click", () => {
  if (!cards.length) return;
  current = (current + 1) % cards.length;
  showCard();
});

showCard();

/* =========================
   Liquid Glass Effects
========================= */

const card = document.querySelector(".card");

document.querySelectorAll("button").forEach(btn => {
  btn.addEventListener("click", e => {
    if (card) {
      card.classList.add("active");
      setTimeout(() => card.classList.remove("active"), 300);
    }

    const rect = btn.getBoundingClientRect();
    btn.style.setProperty("--x", `${e.clientX - rect.left}px`);
    btn.style.setProperty("--y", `${e.clientY - rect.top}px`);
    btn.classList.add("ripple");
    setTimeout(() => btn.classList.remove("ripple"), 600);
  });
});
