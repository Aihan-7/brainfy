/* =========================
   Brainfy – Core Script
   STABLE RECOVERY VERSION
========================= */

/* =========================
   Constants
========================= */
const FOCUS_TIME = 25 * 60;

/* =========================
   DOM
========================= */
const card = document.querySelector(".card");
const views = document.querySelectorAll(".view");

/* Navigation */
const enterBtn = document.getElementById("enterBtn");
const spaceBtns = document.querySelectorAll("[data-go]");
const backBtns = document.querySelectorAll(".back-btn");

/* Focus */
const startBtn = document.getElementById("startBtn");
const intentSheet = document.getElementById("intentSheet");
const intentInput = document.getElementById("intentInput");
const beginFocusBtn = document.getElementById("beginFocusBtn");
const focusRoom = document.getElementById("focusRoom");
const modeText = document.getElementById("modeText");
const timerDisplay = document.getElementById("timer");
const resetBtn = document.getElementById("resetBtn");
const sessionsText = document.getElementById("sessionsText");

/* Notes */
const notesInput = document.getElementById("notesInput");
const genCardsBtn = document.getElementById("genCardsBtn");

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
   Navigation
========================= */
function goTo(view) {
  if (card.classList.contains("focus-active")) return;

  views.forEach(v => v.classList.remove("active"));
  const target = document.getElementById(view + "View");
  if (!target) return;
  target.classList.add("active");

  if (view === "splash") {
    card.classList.add("compact");
    card.classList.remove("spacious");
  } else {
    card.classList.remove("compact");
    card.classList.add("spacious");
  }
}

window.addEventListener("load", () => {
  card.classList.add("compact");
  goTo("splash");
});

enterBtn?.addEventListener("click", () => goTo("home"));

spaceBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.go;
    if (target) goTo(target);
  });
});

backBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    if (card.classList.contains("focus-active")) return;
    goTo("home");
  });
});

/* =========================
   Focus Logic
========================= */
let timer = null;
let timeLeft = FOCUS_TIME;
let sessions = 0;

function updateTimer() {
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  timerDisplay.textContent = `${m}:${s < 10 ? "0" : ""}${s}`;
}

function startTimer() {
  if (timer) return;
  timer = setInterval(() => {
    if (timeLeft <= 0) {
      sessions++;
      sessionsText.textContent = `Sessions completed: ${sessions}`;
      exitFocusMode();
      return;
    }
    timeLeft--;
    updateTimer();
  }, 1000);
}

function stopTimer() {
  clearInterval(timer);
  timer = null;
}

function enterFocusMode(intent) {
  card.classList.remove("intent-active");
  card.classList.add("focus-active");

  modeText.textContent = intent || "Focus";
  focusRoom.classList.remove("hidden");

  timeLeft = FOCUS_TIME;
  updateTimer();
  startTimer();
}

function exitFocusMode() {
  stopTimer();
  card.classList.remove("focus-active", "intent-active");
  focusRoom.classList.add("hidden");
  timeLeft = FOCUS_TIME;
  updateTimer();
}

/* Intent flow */
startBtn?.addEventListener("click", () => {
  card.classList.add("intent-active");
  intentSheet.classList.remove("hidden");
  requestAnimationFrame(() => {
    intentSheet.classList.add("show");
    intentInput.focus();
  });
});

beginFocusBtn?.addEventListener("click", () => {
  const intent = intentInput.value.trim() || "Focus";
  intentInput.value = "";
  intentSheet.classList.remove("show");
  intentSheet.classList.add("hidden");
  enterFocusMode(intent);
});

resetBtn?.addEventListener("click", exitFocusMode);

updateTimer();
intentInput?.addEventListener("focus", () => {
  card.classList.add("typing");
});

intentInput?.addEventListener("blur", () => {
  card.classList.remove("typing");
});

/* =========================
   Flashcards Core
========================= */
let cards = [];
let cardIndex = 0;

function updateFlashcardMode() {
  const hasCards = cards.length > 0;
  document.querySelector(".flashcard-inputs")
    ?.classList.toggle("hidden", hasCards);
  flashcardView?.classList.toggle("hidden", !hasCards);
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
  const q = questionInput.value.trim();
  const a = answerInput.value.trim();
  if (!q || !a) return;

  cards.push({ q, a });
  cardIndex = cards.length - 1;

  questionInput.value = "";
  answerInput.value = "";

  updateFlashcardMode();
  showCard();
});

flipBtn?.addEventListener("click", () => {
  if (!cards.length) return;
  flashcard.classList.toggle("flipped");
});

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

/* =========================
   Notes → Generate Flashcards
========================= */
genCardsBtn?.addEventListener("click", () => {
  const text = notesInput.value.trim();
  if (!text) return;

  const lines = text
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  let created = 0;

  lines.forEach(line => {
    if (line.includes(":")) {
      const [q, ...rest] = line.split(":");
      const a = rest.join(":").trim();
      if (q && a) {
        cards.push({ q: q.trim(), a });
        created++;
      }
    }
  });

  if (!created) return;

  cardIndex = cards.length - created;
  updateFlashcardMode();
  showCard();
  goTo("cards");

  genCardsBtn.textContent = `Created ${created} cards`;
  setTimeout(() => {
    genCardsBtn.textContent = "Generate Flashcards";
  }, 1400);
});

/* =========================
   Button Ripple
========================= */
document.querySelectorAll("button").forEach(btn => {
  btn.addEventListener("click", e => {
    if (btn.disabled || btn.offsetParent === null) return;
    const rect = btn.getBoundingClientRect();
    btn.style.setProperty("--x", `${e.clientX - rect.left}px`);
    btn.style.setProperty("--y", `${e.clientY - rect.top}px`);
    btn.classList.remove("ripple");
    void btn.offsetWidth;
    btn.classList.add("ripple");
    setTimeout(() => btn.classList.remove("ripple"), 600);
  });
});
