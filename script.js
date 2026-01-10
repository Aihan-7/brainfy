/* =========================
   Brainfy – Core Script
   Flow Lock Mode (Final)
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
   Navigation
========================= */

function goTo(view) {
  // Block navigation during focus
  if (card.classList.contains("focus-active")) return;

  views.forEach(v => v.classList.remove("active"));
  document.getElementById(view + "View")?.classList.add("active");

  // Card sizing
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
  btn.addEventListener("click", () => goTo(btn.dataset.go));
});

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
   Focus State
========================= */

let timer = null;
let timeLeft = FOCUS_TIME;
let sessions = 0;

function updateTimer() {
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  timerDisplay.textContent = `${m}:${s < 10 ? "0" : ""}${s}`;
}

function enterFocusMode(intent) {
  card.classList.add("focus-active");
  modeText.textContent = intent;
  focusRoom.classList.remove("hidden");
}

function exitFocusMode() {
  clearInterval(timer);
  timer = null;
  timeLeft = FOCUS_TIME;
  card.classList.remove("focus-active");
  focusRoom.classList.add("hidden");
  intentSheet.classList.add("hidden");
  modeText.textContent = "Focus";
  updateTimer();
}

/* =========================
   Intent Flow
========================= */

startBtn?.addEventListener("click", () => {
  intentSheet.classList.remove("hidden");
  intentInput.focus();
});

beginFocusBtn?.addEventListener("click", () => {
  const intent = intentInput.value.trim() || "Focus";

  intentInput.value = "";
  intentSheet.classList.add("hidden");

  enterFocusMode(intent);

  timeLeft = FOCUS_TIME;
  updateTimer();

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
});

resetBtn?.addEventListener("click", exitFocusMode);

updateTimer();

/* =========================
   Exit Confirmation (Flow Lock)
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
  notesInput.addEventListener("input", () => {
    notesPreview.innerHTML = parseMarkdown(
      escapeHTML(notesInput.value)
    );
  });
}

/* =========================
   Flashcards
========================= */

let cards = [];
let cardIndex = 0;

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
    q: questionInput.value,
    a: answerInput.value
  });

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

    setTimeout(() => {
      btn.classList.remove("ripple");
    }, 600);
  });
});
