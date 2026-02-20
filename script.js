/* =========================
   Brainfy - Core Script
========================= */

const FOCUS_TIME = 25 * 60;

/* DOM */
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
const focusComplete = document.getElementById("focusComplete");
const modeText = document.getElementById("modeText");
const timerDisplay = document.getElementById("timer");
const resetBtn = document.getElementById("resetBtn");
const sessionsText = document.getElementById("sessionsText");

/* Notes */
const notesInput = document.getElementById("notesInput");
const genCardsBtn = document.getElementById("genCardsBtn");

/* Flashcards */
const flashcardsWrapper = document.querySelector(".flashcards");
const questionInput = document.getElementById("questionInput");
const answerInput = document.getElementById("answerInput");
const addCardBtn = document.getElementById("addCardBtn");
const flashcard = document.getElementById("flashcard");
const cardQuestion = document.getElementById("cardQuestion");
const cardAnswer = document.getElementById("cardAnswer");
const flashcardFeedback = document.getElementById("flashcardFeedback");
const flashcardFeedbackIcon = document.getElementById("flashcardFeedbackIcon");
const prevBtn = document.getElementById("prevCard");
const nextBtn = document.getElementById("nextCard");
const recallGoodBtn = document.getElementById("recallGood");
const recallOkayBtn = document.getElementById("recallOkay");
const recallMissBtn = document.getElementById("recallMiss");
const recallSummary = document.getElementById("recallSummary");
const flashcardView = document.querySelector(".flashcard-view");

/* State */
let timer = null;
let timeLeft = FOCUS_TIME;
let sessions = 0;
let cards = [];
let cardIndex = 0;
let startX = 0;
let cardMotionDirection = "none";
let nextCardId = 1;
const recallByCardId = new Map();
const recallStats = { good: 0, okay: 0, miss: 0 };
let feedbackTimer = null;
let feedbackLocked = false;

function updateRecallSummary() {
  if (!recallSummary) return;
  recallSummary.textContent = `Right: ${recallStats.good}  Okay: ${recallStats.okay}  Wrong: ${recallStats.miss}`;
}

function updateRecallSelectionUI(cardId) {
  const rating = recallByCardId.get(cardId) || "";
  recallGoodBtn?.classList.toggle("selected", rating === "good");
  recallOkayBtn?.classList.toggle("selected", rating === "okay");
  recallMissBtn?.classList.toggle("selected", rating === "miss");
}

function setCardRecall(cardId, kind) {
  const prev = recallByCardId.get(cardId);
  if (prev === kind) return;

  if (prev && prev in recallStats) {
    recallStats[prev] = Math.max(0, recallStats[prev] - 1);
  }

  recallByCardId.set(cardId, kind);

  if (kind in recallStats) {
    recallStats[kind] += 1;
  }
}

function syncCardHeight() {
  if (!card) return;
  const activeView = document.querySelector(".view.active");
  if (!activeView) return;

  const baseHeight = card.classList.contains("compact") ? 300 : 460;
  let contentNode = null;

  if (activeView.id === "splashView") {
    contentNode = activeView.querySelector("h1");
  } else if (activeView.id === "homeView") {
    contentNode = activeView.querySelector(".space-list");
  } else if (activeView.id === "focusView") {
    if (card.classList.contains("focus-active")) {
      contentNode = focusRoom;
    } else if (!intentSheet?.classList.contains("hidden")) {
      contentNode = intentSheet;
    } else {
      contentNode = startBtn;
    }
  } else if (activeView.id === "notesView") {
    contentNode = activeView.querySelector(".notes");
  } else if (activeView.id === "cardsView") {
    contentNode = activeView.querySelector(".flashcards");
  }

  const measured = contentNode?.getBoundingClientRect().height || baseHeight - 120;
  const contentHeight = measured + 142;
  card.style.minHeight = `${Math.max(baseHeight, contentHeight)}px`;
}

function isFocusLocked() {
  return !!card?.classList.contains("focus-active");
}

function goTo(view) {
  if (!card) return;
  if (isFocusLocked() && view !== "focus") return;

  views.forEach(v => v.classList.remove("active"));

  const target = document.getElementById(`${view}View`);
  if (!target) return;
  target.classList.add("active");

  if (view === "splash") {
    card.classList.add("compact");
    card.classList.remove("spacious");
  } else {
    card.classList.remove("compact");
    card.classList.add("spacious");
  }

  requestAnimationFrame(syncCardHeight);
}

function updateTimer() {
  if (!timerDisplay) return;
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  timerDisplay.textContent = `${m}:${s < 10 ? "0" : ""}${s}`;
}

function stopTimer() {
  clearInterval(timer);
  timer = null;
}

function exitFocusMode() {
  stopTimer();

  focusComplete?.classList.remove("show");
  focusComplete?.classList.add("hidden");

  if (focusRoom) {
    focusRoom.style.opacity = "";
    focusRoom.style.transform = "";
    focusRoom.classList.add("hidden");
  }

  card?.classList.remove("focus-active", "intent-active", "typing");
  timeLeft = FOCUS_TIME;
  updateTimer();
  syncCardHeight();
}

function endFocusSession() {
  stopTimer();

  if (!focusRoom || !focusComplete) {
    sessions += 1;
    sessionsText.textContent = `Sessions completed: ${sessions}`;
    exitFocusMode();
    return;
  }

  focusRoom.style.opacity = "0";
  focusRoom.style.transform = "scale(0.96)";

  setTimeout(() => {
    focusRoom.classList.add("hidden");

    focusComplete.classList.remove("hidden");
    requestAnimationFrame(() => focusComplete.classList.add("show"));

    sessions += 1;
    sessionsText.textContent = `Sessions completed: ${sessions}`;

    setTimeout(() => {
      focusComplete.classList.remove("show");
      focusComplete.classList.add("hidden");
      exitFocusMode();
    }, 1400);

    syncCardHeight();
  }, 350);
}

function startTimer() {
  if (timer) return;

  timer = setInterval(() => {
    if (timeLeft <= 0) {
      endFocusSession();
      return;
    }

    timeLeft -= 1;
    updateTimer();
  }, 1000);
}

function enterFocusMode(intent) {
  card?.classList.remove("intent-active", "typing");
  card?.classList.add("focus-active");

  if (modeText) modeText.textContent = intent || "Focus";
  focusRoom?.classList.remove("hidden");

  timeLeft = FOCUS_TIME;
  updateTimer();
  startTimer();
  syncCardHeight();
}

function animateCardChange(direction = "none") {
  if (!flashcard) return;
  flashcard.classList.remove("slide-prev", "slide-next");
  if (direction === "prev") flashcard.classList.add("slide-prev");
  if (direction === "next") flashcard.classList.add("slide-next");
  flashcard.classList.add("switching");
  setTimeout(() => {
    flashcard.classList.remove("switching", "slide-prev", "slide-next");
  }, 220);
}

function updateFlashcardMode() {
  if (!flashcardsWrapper) return;
  flashcardsWrapper.classList.toggle("has-cards", cards.length > 0);
  flashcardView?.classList.toggle("hidden", cards.length === 0);
  requestAnimationFrame(syncCardHeight);
}

function showCard() {
  if (!cards.length || !cardQuestion || !cardAnswer || !flashcardView) return;

  animateCardChange(cardMotionDirection);
  cardMotionDirection = "none";

  const current = cards[cardIndex];
  cardQuestion.textContent = current.q;
  cardAnswer.textContent = current.a;

  if (feedbackTimer) {
    clearTimeout(feedbackTimer);
    feedbackTimer = null;
  }
  feedbackLocked = false;
  flashcard?.classList.remove("feedback-show", "feedback-good", "feedback-okay", "feedback-miss");

  flashcard?.classList.remove("flipped");
  if (current?.id) updateRecallSelectionUI(current.id);
  updateRecallSummary();
  flashcardView.classList.remove("hidden");
  requestAnimationFrame(syncCardHeight);
}

/* Navigation events */
enterBtn?.addEventListener("click", () => goTo("home"));

spaceBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.go;
    if (target) goTo(target);
  });
});

backBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    if (isFocusLocked()) return;
    goTo("home");
  });
});

/* Focus events */
startBtn?.addEventListener("click", () => {
  card?.classList.add("intent-active");
  intentSheet?.classList.remove("hidden");

  requestAnimationFrame(() => {
    intentSheet?.classList.add("show");
    intentInput?.focus();
    syncCardHeight();
  });
});

beginFocusBtn?.addEventListener("click", () => {
  const intent = intentInput?.value.trim() || "Focus";
  if (intentInput) intentInput.value = "";

  intentSheet?.classList.remove("show");
  intentSheet?.classList.add("hidden");
  enterFocusMode(intent);
});

resetBtn?.addEventListener("click", exitFocusMode);

intentInput?.addEventListener("focus", () => {
  card?.classList.add("typing");
});

intentInput?.addEventListener("blur", () => {
  card?.classList.remove("typing");
});

/* Flashcards events */
addCardBtn?.addEventListener("click", () => {
  const q = questionInput?.value.trim() || "";
  const a = answerInput?.value.trim() || "";
  if (!q || !a) return;

  cards.push({ id: nextCardId++, q, a });
  cardIndex = cards.length - 1;

  if (questionInput) questionInput.value = "";
  if (answerInput) answerInput.value = "";

  updateFlashcardMode();
  showCard();
});

nextBtn?.addEventListener("click", () => {
  if (!cards.length) return;
  cardMotionDirection = "next";
  cardIndex = (cardIndex + 1) % cards.length;
  showCard();
});

prevBtn?.addEventListener("click", () => {
  if (!cards.length) return;
  cardMotionDirection = "prev";
  cardIndex = (cardIndex - 1 + cards.length) % cards.length;
  showCard();
});

function rateAndAdvance(kind) {
  if (!cards.length || !flashcard || !flashcardFeedback || !flashcardFeedbackIcon) return;
  if (feedbackLocked) return;
  feedbackLocked = true;

  const current = cards[cardIndex];
  if (current?.id) {
    setCardRecall(current.id, kind);
    updateRecallSummary();
    updateRecallSelectionUI(current.id);
  }

  const iconMap = { good: "✓", okay: "😐", miss: "✕" };
  flashcardFeedbackIcon.textContent = iconMap[kind] || "•";

  flashcard.classList.remove("feedback-good", "feedback-okay", "feedback-miss", "feedback-show");
  flashcard.classList.add(`feedback-${kind}`);
  requestAnimationFrame(() => {
    flashcard.classList.add("feedback-show");
  });

  feedbackTimer = setTimeout(() => {
    flashcard.classList.remove("feedback-show", "feedback-good", "feedback-okay", "feedback-miss");
    cardMotionDirection = "next";
    cardIndex = (cardIndex + 1) % cards.length;
    showCard();
  }, 750);
}

recallGoodBtn?.addEventListener("click", () => rateAndAdvance("good"));
recallOkayBtn?.addEventListener("click", () => rateAndAdvance("okay"));
recallMissBtn?.addEventListener("click", () => rateAndAdvance("miss"));

flashcard?.addEventListener("click", () => {
  if (!cards.length) return;
  flashcard.classList.toggle("flipped");
});

flashcard?.addEventListener("keydown", e => {
  if (!cards.length) return;
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    flashcard.classList.toggle("flipped");
  }
});

flashcard?.addEventListener("touchstart", e => {
  startX = e.touches[0].clientX;
});

flashcard?.addEventListener("touchend", e => {
  if (!cards.length) return;

  const dx = e.changedTouches[0].clientX - startX;
  if (Math.abs(dx) < 50) return;

  if (dx < 0) {
    cardIndex = (cardIndex + 1) % cards.length;
  } else {
    cardIndex = (cardIndex - 1 + cards.length) % cards.length;
  }

  showCard();
});

/* Notes -> cards */
genCardsBtn?.addEventListener("click", () => {
  const text = notesInput?.value.trim() || "";
  if (!text) return;

  const lines = text
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  let created = 0;

  lines.forEach(line => {
    if (!line.includes(":")) return;
    const [q, ...rest] = line.split(":");
      const a = rest.join(":").trim();
      if (!q?.trim() || !a) return;

      cards.push({ id: nextCardId++, q: q.trim(), a });
      created += 1;
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

/* Ripple */
document.querySelectorAll("button").forEach(btn => {
  let lastHapticAt = 0;
  const triggerHaptic = () => {
    // Best-effort web haptics: mobile/coarse pointer only, throttled.
    if (!("vibrate" in navigator)) return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const now = Date.now();
    if (now - lastHapticAt < 60) return;
    lastHapticAt = now;
    navigator.vibrate(8);
  };

  const triggerRipple = (clientX, clientY) => {
    if (btn.disabled || btn.offsetParent === null) return;

    const rect = btn.getBoundingClientRect();
    const x = Number.isFinite(clientX) ? clientX - rect.left : rect.width / 2;
    const y = Number.isFinite(clientY) ? clientY - rect.top : rect.height / 2;

    btn.style.setProperty("--x", `${x}px`);
    btn.style.setProperty("--y", `${y}px`);

    btn.classList.remove("ripple");
    void btn.offsetWidth;
    btn.classList.add("ripple");
    setTimeout(() => btn.classList.remove("ripple"), 1200);
    triggerHaptic();
  };

  btn.addEventListener("pointerdown", e => {
    triggerRipple(e.clientX, e.clientY);
  });

  btn.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      triggerRipple(NaN, NaN);
    }
  });
});

window.addEventListener("load", () => {
  card?.classList.remove("focus-active", "intent-active", "typing");
  card?.classList.add("compact");
  goTo("splash");
  updateTimer();
  updateFlashcardMode();
  updateRecallSummary();
  syncCardHeight();
});

window.addEventListener("resize", syncCardHeight);
