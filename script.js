/* =========================
   Brainfy – Core Script
   ========================= */

/* ---------- Elements ---------- */
const startBtn = document.getElementById("startBtn");
const focusRoom = document.getElementById("focusRoom");
const timerDisplay = document.getElementById("timer");
const resetBtn = document.getElementById("resetBtn");
const sessionsText = document.getElementById("sessionsText");
const modeText = document.getElementById("modeText");

/* ---------- Time Settings ---------- */
const FOCUS_TIME = 25 * 60; // 25 minutes
const BREAK_TIME = 5 * 60;  // 5 minutes

/* ---------- State ---------- */
let time = FOCUS_TIME;
let interval = null;
let mode = "focus";

/* ---------- Load Saved Sessions ---------- */
let sessions = localStorage.getItem("sessions")
  ? parseInt(localStorage.getItem("sessions"))
  : 0;

sessionsText.textContent = `Sessions completed: ${sessions}`;
modeText.textContent = "Focus";

/* ---------- Utility Functions ---------- */
function updateTimer() {
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;
  timerDisplay.textContent =
    `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
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

function vibrate(type = "soft") {
  if (!navigator.vibrate) return;

  if (type === "soft") {
    navigator.vibrate([15]);
  } else if (type === "firm") {
    navigator.vibrate([20, 30, 20]);
  }
}


/* ---------- Timer Logic ---------- */
function startTimer() {
  if (interval) return;

  interval = setInterval(() => {
    if (time > 0) {
      time--;
      updateTimer();
    } else {
      clearInterval(interval);
      interval = null;

      if (mode === "focus") {
        // Focus finished → Break
        sessions++;
        localStorage.setItem("sessions", sessions);
        sessionsText.textContent = `Sessions completed: ${sessions}`;

        playSound("focus");
        vibrate();

        mode = "break";
        time = BREAK_TIME;
        modeText.textContent = "Break";
        startTimer();
      } else {
        // Break finished → Focus
        playSound("break");
        vibrate();

        mode = "focus";
        time = FOCUS_TIME;
        modeText.textContent = "Focus";
        startTimer();
      }
    }
  }, 1000);
}

/* ---------- Events ---------- */
startBtn.addEventListener("click", () => {
  focusRoom.classList.remove("hidden");
  startBtn.style.display = "none";
  updateTimer();
  startTimer();
});

resetBtn.addEventListener("click", () => {
  clearInterval(interval);
  interval = null;
  mode = "focus";
  time = FOCUS_TIME;
  modeText.textContent = "Focus";
  updateTimer();
});

/* ---------- Init ---------- */
updateTimer();

/* =========================
   Liquid Glass Interaction
========================= */

const card = document.querySelector(".card");

function liquidPulse() {
  card.classList.add("active");
  setTimeout(() => {
    card.classList.remove("active");
  }, 300);
}

// Apply to all buttons
document.querySelectorAll("button").forEach(btn => {
  btn.addEventListener("click", liquidPulse);
});

/* =========================
   Liquid Ripple (Tap-based)
========================= */
document.querySelectorAll("button").forEach(button => {
  button.addEventListener("click", e => {
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    button.style.setProperty("--x", `${x}px`);
    button.style.setProperty("--y", `${y}px`);

    button.classList.add("ripple");
    setTimeout(() => button.classList.remove("ripple"), 600);
  });
});
/* =========================
   Smart Notes – Auto Save
========================= */

const notesInput = document.getElementById("notesInput");

// Load saved notes
const savedNotes = localStorage.getItem("brainfy_notes");
if (savedNotes) {
  notesInput.value = savedNotes;
}

// Save as user types (debounced feel)
let notesTimer = null;

notesInput.addEventListener("input", () => {
  clearTimeout(notesTimer);
  notesTimer = setTimeout(() => {
    localStorage.setItem("brainfy_notes", notesInput.value);
  }, 300);
});
/* =========================
   Live Markdown Preview
========================= */

const preview = document.getElementById("notesPreview");

function parseMarkdown(text) {
  return text
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
    .replace(/^- (.*$)/gim, "<ul><li>$1</li></ul>")
    .replace(/\n$/gim, "<br>");
}

function updatePreview() {

  preview.innerHTML = parseMarkdown(notesInput.value);
  preview.classList.add("visible");
}

// Initial render
updatePreview();

notesInput.addEventListener("input", () => {
  updatePreview();
});
/* =========================
   Flashcards Logic
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
  if (!cards.length) return;

  flashcardView.classList.remove("hidden");
  flashcard.classList.remove("flipped");

  cardQuestion.textContent = cards[current].q;
  cardAnswer.textContent = cards[current].a;
}

addCardBtn.addEventListener("click", () => {
  if (!questionInput.value || !answerInput.value) return;

  cards.push({
    q: questionInput.value,
    a: answerInput.value
  });

  saveCards();
  questionInput.value = "";
  answerInput.value = "";
  current = cards.length - 1;
  showCard();
});

flipBtn.addEventListener("click", () => {
  flashcard.classList.toggle("flipped");
});

prevBtn.addEventListener("click", () => {
  if (!cards.length) return;
  current = (current - 1 + cards.length) % cards.length;
  showCard();
});

nextBtn.addEventListener("click", () => {
  if (!cards.length) return;
  current = (current + 1) % cards.length;
  showCard();
});

if (cards.length) {
  showCard();
}
/* App Navigation */
function goTo(view) {
  document.querySelectorAll(".view").forEach(v =>
    v.classList.add("hidden")
  );
  document.getElementById(view + "View").classList.remove("hidden");
}
