/* =========================
   Brainfy – Clean Core Script
   Stable Version
   ========================= */

/* =========================
   Navigation (iOS-style)
========================= */

window.goTo = function (view) {
  document.querySelectorAll(".view").forEach(v => {
    v.classList.remove("active");
  });

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

/* =========================
   Focus Timer
========================= */

const startBtn = document.getElementById("startBtn");
const timerDisplay = document.getElementById("timer");
const resetBtn = document.getElementById("resetBtn");
const modeText = document.getElementById("modeText");
const sessionsText = document.getElementById("sessionsText");

const FOCUS_TIME = 25 * 60;
const BREAK_TIME = 5 * 60;

let time = FOCUS_TIME;
let interval = null;
let mode = "focus";

/* Sessions count */
let sessions = parseInt(localStorage.getItem("sessions")) || 0;
if (sessionsText) sessionsText.textContent = `Sessions completed: ${sessions}`;
if (modeText) modeText.textContent = "Focus";

/* =========================
   Session Storage
========================= */

let sessionsData = JSON.parse(localStorage.getItem("brainfy_sessions")) || [];
let currentSession = null;

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

/* =========================
   Timer Functions
========================= */

function updateTimer() {
  if (!timerDisplay) return;
  const m = Math.floor(time / 60);
  const s = time % 60;
  timerDisplay.textContent = `${m}:${s < 10 ? "0" : ""}${s}`;
}

function playSound(url) {
  const audio = new Audio(url);
  audio.volume = 0.6;
  audio.play();
}

function vibrate(pattern = [15]) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

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
      saveCurrentSession();

      sessions++;
      localStorage.setItem("sessions", sessions);
      if (sessionsText) sessionsText.textContent = `Sessions completed: ${sessions}`;

      playSound("https://actions.google.com/sounds/v1/alarms/soft_bell.ogg");
      vibrate();

      mode = "break";
      time = BREAK_TIME;
      if (modeText) modeText.textContent = "Break";
      startTimer();
    } else {
      playSound("https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg");
      vibrate([20, 30, 20]);

      mode = "focus";
      time = FOCUS_TIME;
      if (modeText) modeText.textContent = "Focus";
      startTimer();
    }
  }, 1000);
}

/* =========================
   Focus Events
========================= */

if (startBtn) {
  startBtn.addEventListener("click", () => {
    startNewSession();
    time = FOCUS_TIME;
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
   Notes
========================= */

const notesInput = document.getElementById("notesInput");
const notesPreview = document.getElementById("notesPreview");

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
  notesPreview.innerHTML = parseMarkdown(notesInput.value);
}

if (notesInput) {
  notesInput.addEventListener("input", () => {
    updatePreview();
    if (currentSession) currentSession.notes = notesInput.value;
  });
}

updatePreview();

/* =========================
   Flashcards
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

let cards = JSON.parse(localStorage.getItem("brainfy_cards")) || [];
let current = 0;

function saveCards() {
  localStorage.setItem("brainfy_cards", JSON.stringify(cards));
}

function showCard() {
  if (!cards.length) return;
  cardQuestion.textContent = cards[current].q;
  cardAnswer.textContent = cards[current].a;
  flashcard.classList.remove("flipped");
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
   Liquid Glass Button Effects
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
