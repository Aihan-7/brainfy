/* =========================
   Brainfy – Core Script
   Flow Lock Mode (Clean)
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
   Navigation (Final & Safe)
========================= */

function goTo(view) {
  if (card.classList.contains("focus-active")) return;

  card.classList.add("is-navigating");

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

  setTimeout(() => {
    card.classList.remove("is-navigating");
  }, 450);
}

/* ---------- Initial Load ---------- */

window.addEventListener("load", () => {
  card.classList.add("compact");
  card.classList.remove("spacious");
  goTo("splash");
});

/* ---------- Enter App ---------- */

enterBtn?.addEventListener("click", () => {
  goTo("home");
});

/* ---------- Space Navigation ---------- */

spaceBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.go;
    if (target) goTo(target);
  });
});

/* ---------- Back Buttons ---------- */

backBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    if (card.classList.contains("focus-active")) {
      showExitConfirm();
    } else {
      goTo("home");
    }
  });
});
/* =========================
   Swipe Back (iOS-style)
========================= */

let touchStartX = 0;
let touchStartY = 0;
const SWIPE_EDGE = 30;
const SWIPE_THRESHOLD = 80;

document.addEventListener("touchstart", e => {
  if (card.classList.contains("focus-active")) return;

  const t = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
});

document.addEventListener("touchmove", e => {
  if (card.classList.contains("focus-active")) return;

  const t = e.touches[0];
  const dx = t.clientX - touchStartX;
  const dy = Math.abs(t.clientY - touchStartY);

  // Must start near left edge
  if (touchStartX > SWIPE_EDGE) return;

  // Must be horizontal
  if (dx < 0 || dx < dy) return;

  // Prevent browser back
  if (dx > 10) e.preventDefault();
}, { passive: false });

document.addEventListener("touchend", e => {
  if (card.classList.contains("focus-active")) return;

  const dx = e.changedTouches[0].clientX - touchStartX;

  // Only swipe far enough
  if (dx > SWIPE_THRESHOLD) {
    goTo("home");
  }
});


/* =========================
   Focus State (Final & Clean)
========================= */

let timer = null;
let timeLeft = FOCUS_TIME;
let sessions = 0;

/* ---------- Timer ---------- */

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

/* ---------- Focus Modes ---------- */

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

  timeLeft = FOCUS_TIME;
  updateTimer();

  card.classList.remove("focus-active");
  card.classList.remove("intent-active");
  focusRoom.classList.add("hidden");
}

/* ---------- Intent Flow ---------- */

startBtn?.addEventListener("click", () => {
  if (card.classList.contains("focus-active")) return;

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

/* =========================
   Exit Confirmation
========================= */

const exitConfirm = document.createElement("div");
exitConfirm.className = "exit-confirm hidden";
exitConfirm.innerHTML = `
  <p>End this focus session?</p>
  <div class="exit-actions">
    <button id="cancelExit">Continue</button>
    <button id="confirmExit">End Session</button>
  </div>
`;
card.appendChild(exitConfirm);

const cancelExit = exitConfirm.querySelector("#cancelExit");
const confirmExit = exitConfirm.querySelector("#confirmExit");

function showExitConfirm() {
  exitConfirm.classList.remove("hidden");
}

function hideExitConfirm() {
  exitConfirm.classList.add("hidden");
}

cancelExit.addEventListener("click", hideExitConfirm);
confirmExit.addEventListener("click", () => {
  hideExitConfirm();
  exitFocusMode();
});


/* =========================
   Notes (Markdown Lite)
========================= */

function escapeHTML(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function parseMarkdown(text) {
  return text
    .replace(/^### (.*)$/gim,"<h3>$1</h3>")
    .replace(/^## (.*)$/gim,"<h2>$1</h2>")
    .replace(/^# (.*)$/gim,"<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/gim,"<strong>$1</strong>")
    .replace(/\n/gim,"<br>");
}

notesInput?.addEventListener("input", () => {
  notesPreview.innerHTML = parseMarkdown(
    escapeHTML(notesInput.value)
  );
});

/* =========================
   Flashcards (Clean)
========================= */

let cards = [];
let cardIndex = 0;

/* ---------- UI Helpers ---------- */

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

/* ---------- Add Card ---------- */

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

/* ---------- Controls ---------- */

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
flashcard.classList.add("switching");
setTimeout(() => {
  showCard();
  flashcard.classList.remove("switching");
}, 120);

/* ---------- Init ---------- */

updateFlashcardMode();


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
startBtn?.addEventListener("click", () => {
  card.classList.add("intent-active");
  intentSheet.classList.remove("hidden");

  requestAnimationFrame(() => {
    intentSheet.classList.add("show");
    intentInput.focus();
  });
});
