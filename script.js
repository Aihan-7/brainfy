/* =========================
   Brainfy – Core Script
   Clean & Stable Build
========================= */

const FOCUS_TIME = 25 * 60;

/* =========================
   DOM REFERENCES
========================= */

const card = document.querySelector(".card");
const views = document.querySelectorAll(".view");
const focusView = document.getElementById("focusView");

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
   NAVIGATION
========================= */

function goTo(view) {
  if (card.classList.contains("focus-active")) return;

  views.forEach(v => v.classList.remove("active"));
  const target = document.getElementById(view + "View");
  if (!target) return;
  target.classList.add("active");

  card.classList.toggle("compact", view === "splash");
  card.classList.toggle("spacious", view !== "splash");
}

window.addEventListener("load", () => {
  goTo("splash");
});

enterBtn?.addEventListener("click", () => goTo("home"));

spaceBtns.forEach(btn =>
  btn.addEventListener("click", () => goTo(btn.dataset.go))
);

backBtns.forEach(btn =>
  btn.addEventListener("click", () => {
    if (card.classList.contains("focus-active")) {
      showExitConfirm();
    } else {
      goTo("home");
    }
  })
);

/* =========================
   FOCUS STATE
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

/* ---------- Focus Flow ---------- */

startBtn?.addEventListener("click", () => {
  card.classList.add("intent-active");
  focusView.classList.add("intent-active");

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

  card.classList.remove("intent-active");
  focusView.classList.remove("intent-active");
  card.classList.add("focus-active");

  modeText.textContent = intent;
  focusRoom.classList.remove("hidden");

  timeLeft = FOCUS_TIME;
  updateTimer();
  startTimer();
});

resetBtn?.addEventListener("click", exitFocusMode);

function exitFocusMode() {
  stopTimer();

  card.classList.remove("focus-active", "intent-active");
  focusView.classList.remove("focus-active", "intent-active");
  focusRoom.classList.add("hidden");

  timeLeft = FOCUS_TIME;
  updateTimer();
}

/* =========================
   EXIT CONFIRMATION
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

cancelExit.addEventListener("click", () =>
  exitConfirm.classList.add("hidden")
);

confirmExit.addEventListener("click", () => {
  exitConfirm.classList.add("hidden");
  exitFocusMode();
});

/* =========================
   FLASHCARDS
========================= */

let cards = [];
let cardIndex = 0;

function updateFlashcardMode() {
  document.querySelector(".flashcard-inputs")
    ?.classList.toggle("hidden", cards.length > 0);

  flashcardView?.classList.toggle("hidden", !cards.length);
}

function showCard() {
  if (!cards.length) return;

  const c = cards[cardIndex];
  cardQuestion.textContent = c.q;
  cardAnswer.textContent = c.a;
  flashcard.classList.remove("flipped");
}

/* Add card manually */
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

/* Controls */
flipBtn?.addEventListener("click", () =>
  flashcard.classList.toggle("flipped")
);

prevBtn?.addEventListener("click", () => {
  cardIndex = (cardIndex - 1 + cards.length) % cards.length;
  showCard();
});

nextBtn?.addEventListener("click", () => {
  cardIndex = (cardIndex + 1) % cards.length;
  showCard();
});

/* =========================
   NOTES → FLASHCARDS
========================= */

genCardsBtn?.addEventListener("click", () => {
  const text = notesInput.value.trim();
  if (!text) return;

  const lines = text
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.includes(":"));

  lines.forEach(line => {
    const [q, ...rest] = line.split(":");
    const a = rest.join(":").trim();
    if (q && a) {
      cards.push({ q: q.trim(), a });
    }
  });

  if (!cards.length) return;

  cardIndex = 0;
  updateFlashcardMode();
  showCard();
  goTo("cards");
});

/* =========================
   BUTTON RIPPLE
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

/* =========================
   INIT
========================= */

updateTimer();
updateFlashcardMode();
