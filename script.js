/* =========================
   Brainfy - Core Script
========================= */

const DEFAULT_FOCUS_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;
const FOCUS_TIME = DEFAULT_FOCUS_MINUTES * 60;

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
const timerProgress = document.getElementById("timerProgress");
const resetBtn = document.getElementById("resetBtn");
const pauseBtn = document.getElementById("pauseBtn");
const chimeBtn = document.getElementById("chimeBtn");
const focusPresetBtns = document.querySelectorAll(".focus-preset");
const customFocusInput = document.getElementById("customFocusInput");
const customBreakInput = document.getElementById("customBreakInput");
const applyCustomPresetBtn = document.getElementById("applyCustomPresetBtn");
const focusMiniWidget = document.getElementById("focusMiniWidget");
const focusMiniProgress = document.getElementById("focusMiniProgress");
const focusMiniTime = document.getElementById("focusMiniTime");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const themeToggleIcon = document.getElementById("themeToggleIcon");
const focusTodayText = document.getElementById("focusTodayText");
const focusGoalText = document.getElementById("focusGoalText");
const focusGoalFill = document.getElementById("focusGoalFill");
const homeStreakText = document.getElementById("homeStreakText");
const homeReviewText = document.getElementById("homeReviewText");
const homeMoodTrendText = document.getElementById("homeMoodTrendText");
const homeUndoReflectionBtn = document.getElementById("homeUndoReflectionBtn");
const homeReflectionCard = document.getElementById("homeReflectionCard");
const homePlanCard = document.getElementById("homePlanCard");
const homePlanSummary = document.getElementById("homePlanSummary");

/* Notes */
const notesInput = document.getElementById("notesInput");
const genCardsBtn = document.getElementById("genCardsBtn");
const exportNotesBtn = document.getElementById("exportNotesBtn");
const clearNotesBtn = document.getElementById("clearNotesBtn");
const notesDetectedChip = document.getElementById("notesDetectedChip");
const notesLiveStructure = document.getElementById("notesLiveStructure");
const notesLiveStructureList = document.getElementById("notesLiveStructureList");
const focusCaptureCard = document.getElementById("focusCaptureCard");
const focusCaptureTitle = document.getElementById("focusCaptureTitle");
const focusCaptureMeta = document.getElementById("focusCaptureMeta");
const focusInsertQBtn = document.getElementById("focusInsertQBtn");
const focusInsertABtn = document.getElementById("focusInsertABtn");
const focusInsertKeyBtn = document.getElementById("focusInsertKeyBtn");
const focusCaptureDoneBtn = document.getElementById("focusCaptureDoneBtn");
const notesPreviewPanel = document.getElementById("notesPreviewPanel");
const notesPreviewTitle = document.getElementById("notesPreviewTitle");
const notesPreviewList = document.getElementById("notesPreviewList");
const createPreviewCardsBtn = document.getElementById("createPreviewCardsBtn");
const cancelPreviewCardsBtn = document.getElementById("cancelPreviewCardsBtn");

/* Flashcards */
const flashcardsWrapper = document.querySelector(".flashcards");
const questionInput = document.getElementById("questionInput");
const answerInput = document.getElementById("answerInput");
const addCardBtn = document.getElementById("addCardBtn");
const editCardBtn = document.getElementById("editCardBtn");
const flashcard = document.getElementById("flashcard");
const cardQuestion = document.getElementById("cardQuestion");
const cardAnswer = document.getElementById("cardAnswer");
const flashcardFeedback = document.getElementById("flashcardFeedback");
const flashcardFeedbackIcon = document.getElementById("flashcardFeedbackIcon");
const recallGoodBtn = document.getElementById("recallGood");
const recallOkayBtn = document.getElementById("recallOkay");
const recallMissBtn = document.getElementById("recallMiss");
const recallSummary = document.getElementById("recallSummary");
const sessionStatsText = document.getElementById("sessionStatsText");
const resetSessionBtn = document.getElementById("resetSessionBtn");
const dueNowBtn = document.getElementById("dueNowBtn");
const mistakesModeBtn = document.getElementById("mistakesModeBtn");
const slippingModeBtn = document.getElementById("slippingModeBtn");
const exportDeckBtn = document.getElementById("exportDeckBtn");
const importDeckBtn = document.getElementById("importDeckBtn");
const clearDeckBtn = document.getElementById("clearDeckBtn");
const importDeckInput = document.getElementById("importDeckInput");
const dailyGoalText = document.getElementById("dailyGoalText");
const dailyGoalFill = document.getElementById("dailyGoalFill");
const chartGood = document.getElementById("chartGood");
const chartOkay = document.getElementById("chartOkay");
const chartMiss = document.getElementById("chartMiss");
const chartGoodVal = document.getElementById("chartGoodVal");
const chartOkayVal = document.getElementById("chartOkayVal");
const chartMissVal = document.getElementById("chartMissVal");
const accuracyTrendText = document.getElementById("accuracyTrendText");
const trajectoryPanel = document.querySelector(".trajectory-panel");
const trajectorySummaryText = document.getElementById("trajectorySummaryText");
const trajectoryMetaText = document.getElementById("trajectoryMetaText");
const flashcardView = document.querySelector(".flashcard-view");

/* State */
let timer = null;
let timeLeft = FOCUS_TIME;
let focusDuration = FOCUS_TIME;
let focusMinutes = DEFAULT_FOCUS_MINUTES;
let breakMinutes = DEFAULT_BREAK_MINUTES;
let paused = false;
let chimeEnabled = true;
let focusSessionActive = false;
let cards = [];
let cardIndex = 0;
let startX = 0;
let cardMotionDirection = "none";
let nextCardId = 1;
let editingCardId = null;
const recallByCardId = new Map();
const recallStats = { good: 0, okay: 0, miss: 0 };
const STORAGE_KEY = "brainfy_state_v1";
const DEFAULT_DAILY_GOAL = 20;
const DEFAULT_FOCUS_DAILY_GOAL = 4;
let feedbackTimer = null;
let feedbackLocked = false;
let reviewHistory = [];
let reviewCursor = -1;
let dueNowMode = false;
let mistakesMode = false;
let slippingMode = false;
let recentResults = [];
let cardShownAt = 0;
let recallStartedAt = 0;
const trajectoryByCardId = new Map();
let notesDraft = "";
let notesSaveTimer = null;
let pendingGeneratedCards = [];
let notesEnterTimer = null;
let currentFocusIntent = "Focus";
let pendingFocusCapture = null;
let themeMode = "dark";
const focusState = {
  dateKey: new Date().toISOString().slice(0, 10),
  todaySeconds: 0,
  sessionsToday: 0,
  historyDates: []
};
const sessionState = {
  dateKey: new Date().toISOString().slice(0, 10),
  reviewedToday: 0
};
const reflectionState = {
  ratingsByDate: {}
};
const REFLECTION_START_HOUR = 20; // 8:00 PM local time
const planState = {
  plansByDate: {}
};
const PLAN_PRESETS = {
  light: { focus: 2, cards: 10, label: "Light" },
  normal: { focus: 4, cards: 20, label: "Normal" },
  deep: { focus: 6, cards: 35, label: "Deep" }
};
let dailyGoalTarget = DEFAULT_DAILY_GOAL;
let focusDailyGoalTarget = DEFAULT_FOCUS_DAILY_GOAL;
let activeGoalDateKey = "";

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function applyTheme(mode) {
  themeMode = mode === "light" ? "light" : "dark";
  document.body.classList.toggle("light-mode", themeMode === "light");
  if (themeToggleBtn) {
    themeToggleBtn.setAttribute("aria-label", themeMode === "light" ? "Switch to dark mode" : "Switch to light mode");
  }
  if (themeToggleIcon) {
    themeToggleIcon.textContent = themeMode === "light" ? "🌙" : "☀️";
  }
  updateDueModeUI();
  updateMistakesModeUI();
  updateSlippingModeUI();
}

function isReflectionWindowOpen(now = new Date()) {
  return now.getHours() >= REFLECTION_START_HOUR;
}

function dateKeyAddDays(dateKey, days) {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function dateKeyMinusDays(dateKey, days) {
  return dateKeyAddDays(dateKey, -days);
}

function clampGoal(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function applyGoalsForDate(dateKey) {
  const planned = planState.plansByDate?.[dateKey];
  if (planned) {
    dailyGoalTarget = clampGoal(planned.cards, 5, 80, DEFAULT_DAILY_GOAL);
    focusDailyGoalTarget = clampGoal(planned.focus, 1, 12, DEFAULT_FOCUS_DAILY_GOAL);
  } else {
    dailyGoalTarget = DEFAULT_DAILY_GOAL;
    focusDailyGoalTarget = DEFAULT_FOCUS_DAILY_GOAL;
  }
  activeGoalDateKey = dateKey;
}

function ensureGoalTargetsCurrentDate() {
  const today = getTodayKey();
  if (activeGoalDateKey === today) return;
  applyGoalsForDate(today);
}

function prunePlanHistory() {
  const keep = new Set(Array.from({ length: 45 }, (_, i) => dateKeyAddDays(getTodayKey(), i)));
  const next = {};
  Object.entries(planState.plansByDate || {}).forEach(([dateKey, plan]) => {
    if (!keep.has(dateKey)) return;
    if (!plan || typeof plan !== "object") return;
    if (!["light", "normal", "deep"].includes(plan.preset)) return;
    next[dateKey] = {
      preset: plan.preset,
      focus: clampGoal(plan.focus, 1, 12, PLAN_PRESETS[plan.preset].focus),
      cards: clampGoal(plan.cards, 5, 80, PLAN_PRESETS[plan.preset].cards)
    };
  });
  planState.plansByDate = next;
}

function pruneReflectionHistory() {
  const keep = new Set(Array.from({ length: 45 }, (_, i) => dateKeyMinusDays(getTodayKey(), i)));
  const next = {};
  Object.entries(reflectionState.ratingsByDate || {}).forEach(([dateKey, mood]) => {
    if (!keep.has(dateKey)) return;
    if (!["easy", "okay", "hard"].includes(mood)) return;
    next[dateKey] = mood;
  });
  reflectionState.ratingsByDate = next;
}

function updateHomeReflectionUI() {
  const today = getTodayKey();
  const todayMood = reflectionState.ratingsByDate?.[today] || "";
  const windowOpen = isReflectionWindowOpen();
  const answeredToday = !!todayMood;
  setHomeReflectionVisible(windowOpen && !answeredToday);
  setHomeUndoVisible(windowOpen && answeredToday);

  if (homeMoodTrendText) {
    const moodGlyph = { easy: "█", okay: "▄", hard: "▁" };
    const trend = Array.from({ length: 7 }, (_, i) => {
      const day = dateKeyMinusDays(today, 6 - i);
      return moodGlyph[reflectionState.ratingsByDate?.[day]] || "·";
    }).join("");
    homeMoodTrendText.textContent = `Weekly mood: ${trend}`;
  }
  requestAnimationFrame(syncCardHeight);
}

function updateHomePlanUI() {
  const windowOpen = isReflectionWindowOpen();
  if (homePlanCard) {
    homePlanCard.classList.toggle("hidden", !windowOpen);
  }
  if (!windowOpen) return;

  const today = getTodayKey();
  const tomorrow = dateKeyAddDays(today, 1);
  const planned = planState.plansByDate?.[tomorrow];
  const activePreset = planned?.preset || "";

  homePlanCard?.querySelectorAll("[data-plan]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.plan === activePreset);
  });

  const focusGoal = planned?.focus ?? DEFAULT_FOCUS_DAILY_GOAL;
  const cardsGoal = planned?.cards ?? DEFAULT_DAILY_GOAL;
  const label = PLAN_PRESETS[activePreset]?.label || "Default";
  if (homePlanSummary) {
    homePlanSummary.textContent = `${label} target: Focus ${focusGoal} • Cards ${cardsGoal}`;
  }
}

function setHomeReflectionVisible(visible) {
  if (!homeReflectionCard) return;
  document.body.classList.toggle("reflection-answered", !visible);
  if (visible) {
    homeReflectionCard.classList.remove("hidden");
    homeReflectionCard.removeAttribute("hidden");
    homeReflectionCard.style.removeProperty("display");
    return;
  }
  homeReflectionCard.classList.add("hidden");
  homeReflectionCard.setAttribute("hidden", "hidden");
  homeReflectionCard.style.setProperty("display", "none", "important");
}

function setHomeUndoVisible(visible) {
  if (!homeUndoReflectionBtn) return;
  if (visible) {
    homeUndoReflectionBtn.classList.remove("hidden");
    homeUndoReflectionBtn.removeAttribute("hidden");
    homeUndoReflectionBtn.style.removeProperty("display");
    return;
  }
  homeUndoReflectionBtn.classList.add("hidden");
  homeUndoReflectionBtn.setAttribute("hidden", "hidden");
  homeUndoReflectionBtn.style.setProperty("display", "none", "important");
}

function updateHomeReviewUI() {
  if (!homeReviewText) return;
  const totalRated = recallStats.good + recallStats.okay + recallStats.miss;
  const accuracy = totalRated ? Math.round((recallStats.good / totalRated) * 100) : 0;
  homeReviewText.textContent = `Today: Focus ${focusState.sessionsToday} • Cards ${sessionState.reviewedToday} • Accuracy ${accuracy}%`;
}

function updateRecallSummary() {
  if (!recallSummary) return;
  recallSummary.textContent = `Right: ${recallStats.good}  Okay: ${recallStats.okay}  Wrong: ${recallStats.miss}`;
}

function updateSessionStats() {
  if (!sessionStatsText) return;
  ensureGoalTargetsCurrentDate();
  const totalRated = recallStats.good + recallStats.okay + recallStats.miss;
  const accuracy = totalRated ? Math.round((recallStats.good / totalRated) * 100) : 0;
  sessionStatsText.textContent = `Cards: ${cards.length}  Reviewed today: ${sessionState.reviewedToday}  Accuracy: ${accuracy}%`;

  if (dailyGoalText && dailyGoalFill) {
    const completed = Math.min(sessionState.reviewedToday, dailyGoalTarget);
    const pct = Math.round((completed / dailyGoalTarget) * 100);
    dailyGoalText.textContent = `Daily goal: ${completed}/${dailyGoalTarget}`;
    dailyGoalFill.style.width = `${pct}%`;
  }

  const total = Math.max(1, recallStats.good + recallStats.okay + recallStats.miss);
  if (chartGood) chartGood.style.width = `${Math.round((recallStats.good / total) * 100)}%`;
  if (chartOkay) chartOkay.style.width = `${Math.round((recallStats.okay / total) * 100)}%`;
  if (chartMiss) chartMiss.style.width = `${Math.round((recallStats.miss / total) * 100)}%`;
  if (chartGoodVal) chartGoodVal.textContent = String(recallStats.good);
  if (chartOkayVal) chartOkayVal.textContent = String(recallStats.okay);
  if (chartMissVal) chartMissVal.textContent = String(recallStats.miss);
  if (accuracyTrendText) {
    const levels = "▁▂▃▄▅▆▇█";
    const TREND_WINDOW = 12;
    const trendValues = recentResults.slice(-TREND_WINDOW);
    const trend = trendValues.length
      ? trendValues.map(v => levels[Math.max(0, Math.min(7, Math.round(v * 7)))]).join("")
      : "▁";
    accuracyTrendText.textContent = `Trend: ${trend}`;
  }
  updateTrajectoryUI();
  updateHomeReviewUI();
}

function updateTrajectoryUI() {
  if (!trajectorySummaryText || !trajectoryMetaText) return;
  let fragile = 0;
  let forming = 0;
  let stable = 0;
  let slipping = 0;
  let recallTotal = 0;
  let recallCount = 0;

  cards.forEach(cardEntry => {
    const entry = trajectoryByCardId.get(cardEntry.id);
    if (!entry) return;
    const score = Number(entry.score) || 0;
    if (score < 0.45) fragile += 1;
    else if (score < 0.72) forming += 1;
    else stable += 1;

    if ((entry.avgRecallMs || 0) > 0) {
      recallTotal += entry.avgRecallMs;
      recallCount += 1;
    }
    if (isCardSlipping(cardEntry.id)) slipping += 1;
  });

  const avgSeconds = recallCount ? (recallTotal / recallCount) / 1000 : 0;
  trajectorySummaryText.textContent = `Trajectory: Fragile ${fragile} • Forming ${forming} • Stable ${stable}`;
  trajectoryMetaText.textContent = `Avg recall: ${avgSeconds.toFixed(1)}s • Slipping: ${slipping}`;
}

function updateDueModeUI() {
  if (!dueNowBtn) return;
  dueNowBtn.textContent = `Due now: ${dueNowMode ? "On" : "Off"}`;
  dueNowBtn.classList.toggle("active", dueNowMode);
  applyLightModeToggleStyle(dueNowBtn, dueNowMode, {
    bgTop: "rgba(54, 186, 121, 0.9)",
    bgBottom: "rgba(33, 156, 98, 0.84)",
    text: "#f4fff9",
    border: "rgba(122, 230, 178, 0.78)",
    glow: "rgba(54, 186, 121, 0.3)",
    shadow: "rgba(33, 156, 98, 0.34)"
  });
}

function updateMistakesModeUI() {
  if (!mistakesModeBtn) return;
  mistakesModeBtn.textContent = `Mistakes: ${mistakesMode ? "On" : "Off"}`;
  mistakesModeBtn.classList.toggle("active", mistakesMode);
  applyLightModeToggleStyle(mistakesModeBtn, mistakesMode, {
    bgTop: "rgba(239, 84, 84, 0.92)",
    bgBottom: "rgba(207, 48, 48, 0.86)",
    text: "#fff4f4",
    border: "rgba(252, 143, 143, 0.82)",
    glow: "rgba(239, 84, 84, 0.34)",
    shadow: "rgba(207, 48, 48, 0.38)"
  });
}

function updateSlippingModeUI() {
  if (!slippingModeBtn) return;
  slippingModeBtn.textContent = `Slipping: ${slippingMode ? "On" : "Off"}`;
  slippingModeBtn.classList.toggle("active", slippingMode);
  trajectoryPanel?.classList.toggle("hidden", !slippingMode);
  applyLightModeToggleStyle(slippingModeBtn, slippingMode, {
    bgTop: "rgba(86, 164, 246, 0.9)",
    bgBottom: "rgba(52, 126, 207, 0.84)",
    text: "#f4f9ff",
    border: "rgba(144, 198, 255, 0.78)",
    glow: "rgba(86, 164, 246, 0.28)",
    shadow: "rgba(52, 126, 207, 0.32)"
  });
}

function applyLightModeToggleStyle(btn, isActive, palette) {
  if (!btn) return;
  const inLightMode = document.body.classList.contains("light-mode");
  if (!inLightMode || !isActive) {
    btn.style.removeProperty("background");
    btn.style.removeProperty("color");
    btn.style.removeProperty("border-color");
    btn.style.removeProperty("box-shadow");
    return;
  }
  btn.style.setProperty(
    "background",
    `linear-gradient(180deg, ${palette.bgTop}, ${palette.bgBottom})`,
    "important"
  );
  btn.style.setProperty("color", palette.text, "important");
  btn.style.setProperty("border-color", palette.border, "important");
  btn.style.setProperty(
    "box-shadow",
    `0 12px 26px ${palette.shadow}, 0 0 24px ${palette.glow}, inset 0 1px 0 rgba(255,255,255,0.34)`,
    "important"
  );
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isCardSlipping(cardId) {
  const entry = trajectoryByCardId.get(cardId);
  if (!entry || !Array.isArray(entry.history) || entry.history.length < 2) return false;
  const last = entry.history[entry.history.length - 1];
  const prev = entry.history[entry.history.length - 2];
  if (!last || !prev) return false;
  if (last.s < prev.s - 0.05) return true;
  if (last.k === "miss" && (prev.k === "miss" || prev.k === "okay")) return true;
  if ((entry.score || 0) < 0.5 && (entry.lastDelta || 0) < 0) return true;
  return false;
}

function updateTrajectoryForCard(cardId, kind, recallMs) {
  if (!cardId) return;
  const prev = trajectoryByCardId.get(cardId) || {
    score: 0.5,
    attempts: 0,
    avgRecallMs: 0,
    lastDelta: 0,
    history: []
  };
  const ratingBase = { good: 1, okay: 0.55, miss: 0.15 }[kind] ?? 0.4;
  const timeNorm = clamp(1 - ((recallMs - 1400) / 9000), 0.2, 1.05);
  const sampleScore = (ratingBase * 0.74) + (timeNorm * 0.26);
  const nextScore = clamp((prev.score * 0.78) + (sampleScore * 0.22), 0, 1);
  const nextAvgRecall = prev.avgRecallMs > 0
    ? ((prev.avgRecallMs * 0.72) + (recallMs * 0.28))
    : recallMs;
  const nextHistory = Array.isArray(prev.history) ? prev.history.slice(-17) : [];
  nextHistory.push({
    t: Date.now(),
    k: kind,
    s: Number(nextScore.toFixed(3)),
    r: Math.round(recallMs)
  });
  trajectoryByCardId.set(cardId, {
    score: nextScore,
    attempts: (prev.attempts || 0) + 1,
    avgRecallMs: nextAvgRecall,
    lastDelta: nextScore - (prev.score || 0.5),
    history: nextHistory
  });
}

function pruneTrajectoryForCards() {
  const allowed = new Set(cards.map(c => c.id));
  for (const cardId of trajectoryByCardId.keys()) {
    if (!allowed.has(cardId)) trajectoryByCardId.delete(cardId);
  }
}

function restoreTrajectoryFromObject(rawObject) {
  trajectoryByCardId.clear();
  const source = rawObject && typeof rawObject === "object" ? rawObject : {};
  const validIds = new Set(cards.map(c => String(c.id)));
  Object.entries(source).forEach(([id, val]) => {
    if (!validIds.has(String(id))) return;
    if (!val || typeof val !== "object") return;
    const history = Array.isArray(val.history) ? val.history
      .filter(h => h && typeof h === "object")
      .map(h => ({
        t: Number(h.t) || Date.now(),
        k: ["good", "okay", "miss"].includes(h.k) ? h.k : "okay",
        s: clamp(Number(h.s) || 0, 0, 1),
        r: Math.max(0, Number(h.r) || 0)
      }))
      .slice(-18) : [];
    trajectoryByCardId.set(Number(id), {
      score: clamp(Number(val.score) || 0.5, 0, 1),
      attempts: Math.max(0, Number(val.attempts) || history.length),
      avgRecallMs: Math.max(0, Number(val.avgRecallMs) || 0),
      lastDelta: Number(val.lastDelta) || 0,
      history
    });
  });
  pruneTrajectoryForCards();
}

function ensureSessionDate() {
  const today = getTodayKey();
  if (sessionState.dateKey === today) return;
  sessionState.dateKey = today;
  sessionState.reviewedToday = 0;
}

function calculateFocusStreak() {
  const unique = Array.from(new Set(focusState.historyDates || []))
    .filter(v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v));
  if (!unique.length) return 0;
  const history = new Set(unique);
  const today = new Date().toISOString().slice(0, 10);
  let anchor = null;
  if (history.has(today)) {
    anchor = today;
  } else {
    const yesterday = dateKeyMinusDays(today, 1);
    if (history.has(yesterday)) anchor = yesterday;
  }
  if (!anchor) return 0;

  let streak = 0;
  while (history.has(dateKeyMinusDays(anchor, streak))) {
    streak += 1;
  }
  return streak;
}

function updateFocusStatsUI() {
  ensureGoalTargetsCurrentDate();
  if (focusTodayText) {
    const minutes = Math.floor(focusState.todaySeconds / 60);
    focusTodayText.textContent = `Today: ${minutes}m`;
  }
  if (focusGoalText && focusGoalFill) {
    const done = Math.min(focusState.sessionsToday, focusDailyGoalTarget);
    const pct = Math.round((done / focusDailyGoalTarget) * 100);
    focusGoalText.textContent = `Focus completed today: ${done}/${focusDailyGoalTarget}`;
    focusGoalFill.style.width = `${pct}%`;
  }
  if (homeStreakText) {
    const streak = calculateFocusStreak();
    homeStreakText.textContent = `🔥 ${streak} day streak`;
  }
  updateHomeReviewUI();
}

function ensureFocusDate() {
  const today = getTodayKey();
  if (focusState.dateKey === today) return false;
  focusState.dateKey = today;
  focusState.todaySeconds = 0;
  focusState.sessionsToday = 0;
  updateFocusStatsUI();
  return true;
}

function markFocusSessionComplete() {
  ensureFocusDate();
  focusState.sessionsToday += 1;
  focusState.todaySeconds += focusDuration;
  if (!focusState.historyDates.includes(focusState.dateKey)) {
    focusState.historyDates.push(focusState.dateKey);
    if (focusState.historyDates.length > 365) {
      focusState.historyDates = focusState.historyDates.slice(-365);
    }
  }
  updateFocusStatsUI();
  persistState();
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

function persistState() {
  try {
    const state = {
      cards,
      nextCardId,
      cardIndex,
      recallByCardId: Object.fromEntries(recallByCardId),
      dueNowMode,
      mistakesMode,
      slippingMode,
      trajectoryByCardId: Object.fromEntries(trajectoryByCardId),
      recentResults,
      notesDraft,
      focusSettings: {
        focusMinutes,
        breakMinutes,
        chimeEnabled
      },
      focusState,
      sessionState,
      reflectionState,
      planState,
      themeMode
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore persistence failures in restricted contexts.
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    if (!state || typeof state !== "object") return;

    if (Array.isArray(state.cards)) {
      cards = state.cards
        .filter(c => c && typeof c.q === "string" && typeof c.a === "string")
        .map(c => ({ id: Number(c.id) || nextCardId++, q: c.q, a: c.a }));
      if (cards.length) {
        nextCardId = Math.max(...cards.map(c => c.id)) + 1;
      }
    }

    if (typeof state.nextCardId === "number" && state.nextCardId > nextCardId) {
      nextCardId = state.nextCardId;
    }

    cardIndex = typeof state.cardIndex === "number" ? state.cardIndex : 0;
    if (!cards.length) cardIndex = 0;
    if (cardIndex >= cards.length) cardIndex = 0;

    recallByCardId.clear();
    recallStats.good = 0;
    recallStats.okay = 0;
    recallStats.miss = 0;

    const source = state.recallByCardId && typeof state.recallByCardId === "object"
      ? state.recallByCardId
      : {};
    const allowed = new Set(cards.map(c => String(c.id)));
    Object.entries(source).forEach(([id, rating]) => {
      if (!allowed.has(String(id))) return;
      if (!["good", "okay", "miss"].includes(rating)) return;
      recallByCardId.set(Number(id), rating);
      recallStats[rating] += 1;
    });

    if (state.sessionState && typeof state.sessionState === "object") {
      if (typeof state.sessionState.dateKey === "string") {
        sessionState.dateKey = state.sessionState.dateKey;
      }
      if (typeof state.sessionState.reviewedToday === "number" && state.sessionState.reviewedToday >= 0) {
        sessionState.reviewedToday = state.sessionState.reviewedToday;
      }
    }

    if (typeof state.dueNowMode === "boolean") {
      dueNowMode = state.dueNowMode;
    }
    if (typeof state.mistakesMode === "boolean") {
      mistakesMode = state.mistakesMode;
    }
    if (typeof state.slippingMode === "boolean") {
      slippingMode = state.slippingMode;
    }
    if (Array.isArray(state.recentResults)) {
      recentResults = state.recentResults
        .map(v => Number(v))
        .filter(v => Number.isFinite(v) && v >= 0 && v <= 1)
        .slice(-24);
    }
    restoreTrajectoryFromObject(state.trajectoryByCardId);
    if (typeof state.notesDraft === "string") {
      notesDraft = state.notesDraft;
    }
    if (notesInput) {
      notesInput.value = notesDraft;
    }

    if (state.focusSettings && typeof state.focusSettings === "object") {
      const fm = Number(state.focusSettings.focusMinutes);
      const bm = Number(state.focusSettings.breakMinutes);
      if (Number.isFinite(fm) && fm >= 5 && fm <= 180) focusMinutes = fm;
      if (Number.isFinite(bm) && bm >= 1 && bm <= 60) breakMinutes = bm;
      if (typeof state.focusSettings.chimeEnabled === "boolean") {
        chimeEnabled = state.focusSettings.chimeEnabled;
      }
    }
    focusDuration = Math.round(focusMinutes * 60);
    timeLeft = focusDuration;
    updateFocusPresetUI();
    syncFocusInputValues();
    updateChimeUI();

    if (state.focusState && typeof state.focusState === "object") {
      if (typeof state.focusState.dateKey === "string") {
        focusState.dateKey = state.focusState.dateKey;
      }
      if (typeof state.focusState.todaySeconds === "number" && state.focusState.todaySeconds >= 0) {
        focusState.todaySeconds = Math.floor(state.focusState.todaySeconds);
      }
      if (typeof state.focusState.sessionsToday === "number" && state.focusState.sessionsToday >= 0) {
        focusState.sessionsToday = Math.floor(state.focusState.sessionsToday);
      }
      if (Array.isArray(state.focusState.historyDates)) {
        focusState.historyDates = state.focusState.historyDates
          .filter(v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v))
          .slice(-365);
      }
    }

    if (state.reflectionState && typeof state.reflectionState === "object") {
      const source = state.reflectionState.ratingsByDate;
      if (source && typeof source === "object") {
        reflectionState.ratingsByDate = {};
        Object.entries(source).forEach(([dateKey, mood]) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
          if (!["easy", "okay", "hard"].includes(mood)) return;
          reflectionState.ratingsByDate[dateKey] = mood;
        });
      }
    }
    pruneReflectionHistory();

    if (state.planState && typeof state.planState === "object") {
      const source = state.planState.plansByDate;
      if (source && typeof source === "object") {
        planState.plansByDate = {};
        Object.entries(source).forEach(([dateKey, plan]) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
          if (!plan || typeof plan !== "object") return;
          const preset = plan.preset;
          if (!["light", "normal", "deep"].includes(preset)) return;
          planState.plansByDate[dateKey] = {
            preset,
            focus: clampGoal(plan.focus, 1, 12, PLAN_PRESETS[preset].focus),
            cards: clampGoal(plan.cards, 5, 80, PLAN_PRESETS[preset].cards)
          };
        });
      }
    }
    prunePlanHistory();
    applyGoalsForDate(getTodayKey());
    applyTheme(state.themeMode);

    ensureSessionDate();
    ensureFocusDate();
    updateFocusStatsUI();
    updateRecallSummary();
    updateSessionStats();
    updateDueModeUI();
    updateMistakesModeUI();
    updateSlippingModeUI();
    updateHomeReflectionUI();
    updateHomePlanUI();
  } catch {
    // Ignore invalid stored state.
  }
}

function pushHistory(idx) {
  if (reviewCursor < reviewHistory.length - 1) {
    reviewHistory = reviewHistory.slice(0, reviewCursor + 1);
  }
  reviewHistory.push(idx);
  reviewCursor = reviewHistory.length - 1;
}

function weightedNextIndex(currentIdx) {
  if (cards.length <= 1) return currentIdx;
  const candidates = cards
    .map((_, i) => i)
    .filter(i => i !== currentIdx);

  let total = 0;
  const weights = candidates.map(i => {
    const rating = recallByCardId.get(cards[i].id);
    const w = rating === "miss" ? 6 : rating === "okay" ? 3 : rating === "good" ? 1 : 2;
    total += w;
    return w;
  });

  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

function dueNextIndex(currentIdx) {
  if (cards.length <= 1) return currentIdx;
  const candidates = cards
    .map((_, i) => i)
    .filter(i => i !== currentIdx)
    .filter(i => {
      const rating = recallByCardId.get(cards[i].id);
      return rating === "miss" || rating === "okay";
    });

  if (!candidates.length) return weightedNextIndex(currentIdx);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function chooseNextIndex(currentIdx) {
  if (mistakesMode) {
    const missCandidates = cards
      .map((_, i) => i)
      .filter(i => i !== currentIdx)
      .filter(i => recallByCardId.get(cards[i].id) === "miss");
    if (missCandidates.length) {
      return missCandidates[Math.floor(Math.random() * missCandidates.length)];
    }
  }
  if (slippingMode) {
    const slippingCandidates = cards
      .map((_, i) => i)
      .filter(i => i !== currentIdx)
      .filter(i => isCardSlipping(cards[i].id));
    if (slippingCandidates.length) {
      return slippingCandidates[Math.floor(Math.random() * slippingCandidates.length)];
    }
  }
  return dueNowMode ? dueNextIndex(currentIdx) : weightedNextIndex(currentIdx);
}

function goNextCard() {
  if (!cards.length) return;
  cardMotionDirection = "next";
  cardIndex = chooseNextIndex(cardIndex);
  showCard();
}

function goPrevCard() {
  if (!cards.length) return;
  if (reviewCursor > 0) {
    reviewCursor -= 1;
    cardMotionDirection = "prev";
    cardIndex = reviewHistory[reviewCursor];
    showCard(false);
    return;
  }
  cardMotionDirection = "prev";
  cardIndex = (cardIndex - 1 + cards.length) % cards.length;
  showCard(true);
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
    contentNode = activeView.querySelector(".cards-shell") || activeView.querySelector(".flashcards");
  }

  let measured = contentNode?.getBoundingClientRect().height || baseHeight - 120;
  if (activeView.id === "homeView") {
    const visibleChildren = Array.from(activeView.children)
      .filter(el => !el.classList.contains("hidden"));
    if (visibleChildren.length) {
      const firstRect = visibleChildren[0].getBoundingClientRect();
      const lastRect = visibleChildren[visibleChildren.length - 1].getBoundingClientRect();
      measured = Math.max(measured, lastRect.bottom - firstRect.top);
    }
  }
  const notesExtra = activeView.id === "notesView" ? 26 : 0;
  const contentHeight = measured + 142 + notesExtra;
  card.style.minHeight = `${Math.max(baseHeight, contentHeight)}px`;
}

function goTo(view) {
  if (!card) return;

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

  if (view !== "cards") {
    setEditMode(null);
  }
  if (view !== "focus") {
    card?.classList.remove("focus-active", "intent-active", "typing", "intent-open");
    intentSheet?.classList.remove("show");
    intentSheet?.classList.add("hidden");
  }
  if (view !== "notes") {
    hideNotesPreview();
    card.classList.remove("notes-entering");
  }

  card.classList.toggle("notes-wide", view === "notes");
  document.body.classList.toggle("cards-view-open", view === "cards");

  if (view === "notes") {
    card.classList.add("notes-entering");
    if (notesEnterTimer) clearTimeout(notesEnterTimer);
    notesEnterTimer = setTimeout(() => {
      card.classList.remove("notes-entering");
      notesEnterTimer = null;
    }, 180);
  }

  if (view === "home" || view === "focus") {
    const rolled = ensureFocusDate();
    updateFocusStatsUI();
    pruneReflectionHistory();
    prunePlanHistory();
    ensureGoalTargetsCurrentDate();
    updateHomeReflectionUI();
    updateHomePlanUI();
    if (rolled) persistState();
  }

  if (view === "focus") {
    if (focusSessionActive) {
      card?.classList.add("focus-active");
      card?.classList.remove("intent-active", "typing");
      intentSheet?.classList.remove("show");
      intentSheet?.classList.add("hidden");
      focusRoom?.classList.remove("hidden");
      if (modeText) modeText.textContent = currentFocusIntent;
    } else {
      card?.classList.remove("focus-active");
      focusRoom?.classList.add("hidden");
    }
  }

  updateMiniTimerUI();

  requestAnimationFrame(syncCardHeight);
}

function updateTimer() {
  if (!timerDisplay) return;
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  timerDisplay.textContent = `${m}:${s < 10 ? "0" : ""}${s}`;
  updateTimerRing();
  updateMiniTimerUI();
}

function updateTimerRing() {
  if (!timerProgress) return;
  const r = 88;
  const circumference = 2 * Math.PI * r;
  const progress = focusDuration > 0 ? (focusDuration - timeLeft) / focusDuration : 0;
  const clamped = Math.max(0, Math.min(1, progress));
  timerProgress.style.strokeDasharray = `${circumference}`;
  timerProgress.style.strokeDashoffset = `${circumference * (1 - clamped)}`;
}

function updateMiniTimerUI() {
  if (!focusMiniWidget || !focusMiniProgress || !focusMiniTime) return;
  const visible = focusSessionActive && !!timer;
  focusMiniWidget.classList.toggle("hidden", !visible);
  if (!visible) return;

  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  focusMiniTime.textContent = `${m}:${s < 10 ? "0" : ""}${s}`;
  focusMiniWidget.classList.toggle("paused", paused);

  const r = 24;
  const circumference = 2 * Math.PI * r;
  const progress = focusDuration > 0 ? (focusDuration - timeLeft) / focusDuration : 0;
  const clamped = Math.max(0, Math.min(1, progress));
  focusMiniProgress.style.strokeDasharray = `${circumference}`;
  focusMiniProgress.style.strokeDashoffset = `${circumference * (1 - clamped)}`;
}

function stopTimer() {
  clearInterval(timer);
  timer = null;
}

function updatePauseUI() {
  if (!pauseBtn) return;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
  pauseBtn.classList.toggle("is-resume", paused);
  updateMiniTimerUI();
}

function updateChimeUI() {
  if (!chimeBtn) return;
  chimeBtn.textContent = `Chime: ${chimeEnabled ? "On" : "Off"}`;
  chimeBtn.classList.toggle("active", chimeEnabled);
}

function updateFocusPresetUI() {
  focusPresetBtns.forEach(btn => {
    const fm = Number(btn.dataset.focus);
    const bm = Number(btn.dataset.break);
    const selected = fm === focusMinutes && bm === breakMinutes;
    btn.classList.toggle("active", selected);
  });
}

function syncFocusInputValues() {
  if (customFocusInput) customFocusInput.value = String(focusMinutes);
  if (customBreakInput) customBreakInput.value = String(breakMinutes);
}

function applyFocusPreset(nextFocus, nextBreak) {
  const fm = Math.round(Number(nextFocus));
  const bm = Math.round(Number(nextBreak));
  if (!Number.isFinite(fm) || !Number.isFinite(bm)) return;
  if (fm < 5 || fm > 180 || bm < 1 || bm > 60) return;

  focusMinutes = fm;
  breakMinutes = bm;
  focusDuration = focusMinutes * 60;
  timeLeft = focusDuration;
  paused = false;
  if (card?.classList.contains("focus-active") && modeText) {
    modeText.textContent = currentFocusIntent;
  }
  updatePauseUI();
  updateFocusPresetUI();
  syncFocusInputValues();
  updateTimer();
  persistState();
}

function playChime() {
  if (!chimeEnabled) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(740, now);
  osc.frequency.exponentialRampToValueAtTime(980, now + 0.16);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.4);
  osc.onended = () => {
    ctx.close().catch(() => {});
  };
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

  focusSessionActive = false;
  card?.classList.remove("focus-active", "intent-active", "typing");
  paused = false;
  updatePauseUI();
  timeLeft = focusDuration;
  updateTimer();
  updateMiniTimerUI();
  syncCardHeight();
}

function endFocusSession() {
  stopTimer();
  paused = false;
  updatePauseUI();
  playChime();

  if (!focusRoom || !focusComplete) {
    markFocusSessionComplete();
    exitFocusMode();
    return;
  }

  focusRoom.style.opacity = "0";
  focusRoom.style.transform = "scale(0.96)";
  pendingFocusCapture = {
    intent: currentFocusIntent,
    endedAt: Date.now()
  };

  setTimeout(() => {
    focusRoom.classList.add("hidden");

    focusComplete.classList.remove("hidden");
    requestAnimationFrame(() => focusComplete.classList.add("show"));

    markFocusSessionComplete();

    setTimeout(() => {
      focusComplete.classList.remove("show");
      focusComplete.classList.add("hidden");
      exitFocusMode();
      goTo("notes");
      if (pendingFocusCapture) {
        appendTextToNotes(createSessionCaptureBlock(pendingFocusCapture));
        openFocusCapturePrompt(pendingFocusCapture);
      }
    }, 1400);

    syncCardHeight();
  }, 350);
}

function startTimer() {
  if (timer || paused) return;

  timer = setInterval(() => {
    if (timeLeft <= 0) {
      endFocusSession();
      return;
    }

    timeLeft -= 1;
    updateTimer();
  }, 1000);
  updateMiniTimerUI();
}

function enterFocusMode(intent) {
  card?.classList.remove("intent-active", "typing");
  card?.classList.add("focus-active");
  focusSessionActive = true;
  currentFocusIntent = intent || "Focus";
  if (modeText) modeText.textContent = currentFocusIntent;
  focusRoom?.classList.remove("hidden");

  paused = false;
  updatePauseUI();
  timeLeft = focusDuration;
  updateTimer();
  startTimer();
  updateMiniTimerUI();
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
  if (!cards.length) {
    editingCardId = null;
    if (addCardBtn) addCardBtn.textContent = "Add Flashcard";
    editCardBtn?.classList.remove("active");
  }
  requestAnimationFrame(syncCardHeight);
}

function setEditMode(cardToEdit = null) {
  if (!addCardBtn) return;

  if (!cardToEdit) {
    editingCardId = null;
    addCardBtn.textContent = "Add Flashcard";
    editCardBtn?.classList.remove("active");
    return;
  }

  editingCardId = cardToEdit.id;
  if (questionInput) questionInput.value = cardToEdit.q;
  if (answerInput) answerInput.value = cardToEdit.a;
  addCardBtn.textContent = "Save Card";
  editCardBtn?.classList.add("active");
  questionInput?.focus();
}

function parseNotesToCards(text) {
  const parsed = [];
  const lines = (text || "").split("\n");
  const qRegex = /^(q|question)\s*[:\-]\s*(.+)$/i;
  const aRegex = /^(a|answer)\s*[:\-]\s*(.+)$/i;

  let currentQ = "";
  let currentA = "";
  let mode = "";

  const flushCurrent = () => {
    const q = currentQ.trim();
    const a = currentA.trim();
    if (q && a) parsed.push({ q, a });
    currentQ = "";
    currentA = "";
    mode = "";
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      if (currentQ && currentA) flushCurrent();
      continue;
    }

    const qMatch = line.match(qRegex);
    if (qMatch) {
      if (currentQ && currentA) flushCurrent();
      currentQ = qMatch[2].trim();
      currentA = "";
      mode = "q";
      continue;
    }

    const aMatch = line.match(aRegex);
    if (aMatch && currentQ) {
      currentA = currentA ? `${currentA}\n${aMatch[2].trim()}` : aMatch[2].trim();
      mode = "a";
      continue;
    }

    if (currentQ) {
      if (mode === "a") {
        currentA = currentA ? `${currentA}\n${line}` : line;
      } else {
        currentQ = `${currentQ} ${line}`.trim();
      }
      continue;
    }

    if (line.includes(":")) {
      const [q, ...rest] = line.split(":");
      const a = rest.join(":").trim();
      if (q?.trim() && a) {
        parsed.push({ q: q.trim(), a });
      }
    }
  }

  if (currentQ && currentA) flushCurrent();
  return parsed;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function hideNotesPreview() {
  pendingGeneratedCards = [];
  notesPreviewPanel?.classList.add("hidden");
  if (notesPreviewList) notesPreviewList.innerHTML = "";
  requestAnimationFrame(syncCardHeight);
}

function appendTextToNotes(text) {
  if (!notesInput || !text) return;
  const start = notesInput.selectionStart ?? notesInput.value.length;
  const end = notesInput.selectionEnd ?? notesInput.value.length;
  const before = notesInput.value.slice(0, start);
  const after = notesInput.value.slice(end);
  notesInput.value = `${before}${text}${after}`;
  const cursor = start + text.length;
  notesInput.selectionStart = cursor;
  notesInput.selectionEnd = cursor;
  notesDraft = notesInput.value;
  updateNotesInsights();
  if (notesSaveTimer) clearTimeout(notesSaveTimer);
  notesSaveTimer = setTimeout(() => {
    persistState();
  }, 120);
  notesInput.focus();
}

function formatClockTime(ts) {
  const dt = new Date(ts);
  return dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function createSessionCaptureBlock(capture) {
  const ended = capture?.endedAt ? formatClockTime(capture.endedAt) : formatClockTime(Date.now());
  const intent = capture?.intent || "Focus";
  return `\nSession (${ended}) - ${intent}\nQ: \nA: \nKey idea: \n`;
}

function openFocusCapturePrompt(capture) {
  if (!focusCaptureCard) return;
  const ended = capture?.endedAt ? formatClockTime(capture.endedAt) : formatClockTime(Date.now());
  const intent = capture?.intent || "Focus";
  if (focusCaptureTitle) focusCaptureTitle.textContent = "What did you learn in this session?";
  if (focusCaptureMeta) focusCaptureMeta.textContent = `${intent} • ended ${ended}`;
  focusCaptureCard.classList.remove("hidden");
  requestAnimationFrame(syncCardHeight);
}

function closeFocusCapturePrompt() {
  focusCaptureCard?.classList.add("hidden");
  pendingFocusCapture = null;
  requestAnimationFrame(syncCardHeight);
}

function renderNotesPreviewList() {
  if (!notesPreviewList || !notesPreviewTitle) return;
  const total = pendingGeneratedCards.length;
  const kept = pendingGeneratedCards.filter(card => card.keep !== false).length;
  notesPreviewTitle.textContent = `Found ${total} card${total === 1 ? "" : "s"} • Keep ${kept}`;

  notesPreviewList.innerHTML = pendingGeneratedCards.map((card, idx) => {
    const checked = card.keep !== false ? "checked" : "";
    return `
      <li class="notes-preview-item" data-index="${idx}">
        <label class="notes-keep-toggle">
          <input type="checkbox" data-role="keep" ${checked} />
          <span>Keep</span>
        </label>
        <input data-role="q" class="notes-edit-input" value="${escapeHtml(card.q)}" placeholder="Question" />
        <textarea data-role="a" class="notes-edit-textarea" placeholder="Answer">${escapeHtml(card.a)}</textarea>
      </li>
    `;
  }).join("");
}

function showNotesPreview(cardsToPreview) {
  if (!notesPreviewPanel || !notesPreviewTitle || !notesPreviewList) return;
  pendingGeneratedCards = cardsToPreview.map(cardEntry => ({
    q: cardEntry.q,
    a: cardEntry.a,
    keep: true
  }));
  renderNotesPreviewList();

  notesPreviewPanel.classList.remove("hidden");
  requestAnimationFrame(syncCardHeight);
}

function updateNotesInsights() {
  const text = notesInput?.value || "";
  const parsed = parseNotesToCards(text);
  if (notesDetectedChip) {
    notesDetectedChip.textContent = `Detected: ${parsed.length} card${parsed.length === 1 ? "" : "s"}`;
  }

  if (!notesLiveStructure || !notesLiveStructureList) return;
  if (!parsed.length) {
    notesLiveStructure.classList.add("hidden");
    notesLiveStructureList.innerHTML = "";
    return;
  }

  notesLiveStructure.classList.remove("hidden");
  const preview = parsed.slice(0, 4);
  notesLiveStructureList.innerHTML = preview
    .map(({ q, a }) => `<li><strong>Q:</strong> ${escapeHtml(q)}<span><strong>A:</strong> ${escapeHtml(a)}</span></li>`)
    .join("");
  if (parsed.length > preview.length) {
    notesLiveStructureList.insertAdjacentHTML("beforeend", `<li class="notes-preview-more">+${parsed.length - preview.length} more detected</li>`);
  }
}

function showCard(recordHistory = true) {
  if (!cards.length || !cardQuestion || !cardAnswer || !flashcardView) return;

  if (cardIndex < 0 || cardIndex >= cards.length) cardIndex = 0;
  if (recordHistory && reviewHistory[reviewCursor] !== cardIndex) {
    pushHistory(cardIndex);
  }

  animateCardChange(cardMotionDirection);
  cardMotionDirection = "none";

  const current = cards[cardIndex];
  cardQuestion.textContent = current.q;
  cardAnswer.textContent = current.a;
  if (editingCardId !== null && editingCardId !== current.id) {
    setEditMode(null);
  }

  if (feedbackTimer) {
    clearTimeout(feedbackTimer);
    feedbackTimer = null;
  }
  feedbackLocked = false;
  flashcard?.classList.remove("feedback-show", "feedback-good", "feedback-okay", "feedback-miss");

  flashcard?.classList.remove("flipped");
  cardShownAt = Date.now();
  recallStartedAt = 0;
  if (current?.id) updateRecallSelectionUI(current.id);
  updateRecallSummary();
  updateSessionStats();
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
    goTo("home");
  });
});

/* Focus events */
startBtn?.addEventListener("click", () => {
  card?.classList.add("intent-active");
  card?.classList.add("intent-open");
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
  card?.classList.remove("intent-open");
  enterFocusMode(intent);
});

resetBtn?.addEventListener("click", exitFocusMode);

pauseBtn?.addEventListener("click", () => {
  if (!focusSessionActive) return;
  if (paused) {
    paused = false;
    updatePauseUI();
    startTimer();
    return;
  }
  paused = true;
  stopTimer();
  updatePauseUI();
});

focusMiniWidget?.addEventListener("click", () => {
  goTo("focus");
});

focusPresetBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    applyFocusPreset(btn.dataset.focus, btn.dataset.break);
  });
});

applyCustomPresetBtn?.addEventListener("click", () => {
  applyFocusPreset(customFocusInput?.value, customBreakInput?.value);
});

chimeBtn?.addEventListener("click", () => {
  chimeEnabled = !chimeEnabled;
  updateChimeUI();
  persistState();
});

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

  if (editingCardId !== null) {
    const idx = cards.findIndex(c => c.id === editingCardId);
    if (idx >= 0) {
      cards[idx].q = q;
      cards[idx].a = a;
      cardIndex = idx;
    }
    setEditMode(null);
  } else {
    cards.push({ id: nextCardId++, q, a });
    cardIndex = cards.length - 1;
  }

  if (questionInput) questionInput.value = "";
  if (answerInput) answerInput.value = "";

  updateFlashcardMode();
  showCard();
  persistState();
});

editCardBtn?.addEventListener("click", () => {
  if (!cards.length) return;
  const current = cards[cardIndex];
  if (!current) return;

  if (editingCardId === current.id) {
    setEditMode(null);
    if (questionInput) questionInput.value = "";
    if (answerInput) answerInput.value = "";
    return;
  }

  setEditMode(current);
});

function rateAndAdvance(kind) {
  if (!cards.length || !flashcard || !flashcardFeedback || !flashcardFeedbackIcon) return;
  if (feedbackLocked) return;
  feedbackLocked = true;

  const current = cards[cardIndex];
  if (current?.id) {
    setCardRecall(current.id, kind);
    const now = Date.now();
    const startedAt = recallStartedAt || cardShownAt || now;
    const recallMs = Math.max(250, now - startedAt);
    updateTrajectoryForCard(current.id, kind, recallMs);
    updateRecallSummary();
    updateRecallSelectionUI(current.id);
  }
  const scoreMap = { good: 1, okay: 0.5, miss: 0 };
  recentResults.push(scoreMap[kind] ?? 0);
  if (recentResults.length > 24) recentResults.shift();
  ensureSessionDate();
  sessionState.reviewedToday += 1;
  updateSessionStats();

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
    cardIndex = chooseNextIndex(cardIndex);
    showCard();
    persistState();
  }, 750);
}

recallGoodBtn?.addEventListener("click", () => rateAndAdvance("good"));
recallOkayBtn?.addEventListener("click", () => rateAndAdvance("okay"));
recallMissBtn?.addEventListener("click", () => rateAndAdvance("miss"));

flashcard?.addEventListener("click", () => {
  if (!cards.length) return;
  const isFlippingToBack = !flashcard.classList.contains("flipped");
  if (isFlippingToBack && !recallStartedAt) recallStartedAt = Date.now();
  flashcard.classList.toggle("flipped");
});

flashcard?.addEventListener("keydown", e => {
  if (!cards.length) return;
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    const isFlippingToBack = !flashcard.classList.contains("flipped");
    if (isFlippingToBack && !recallStartedAt) recallStartedAt = Date.now();
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

  const createdCards = parseNotesToCards(text);
  if (!createdCards.length) return;
  showNotesPreview(createdCards);
});

createPreviewCardsBtn?.addEventListener("click", () => {
  if (!pendingGeneratedCards.length) return;

  const selected = pendingGeneratedCards
    .filter(card => card.keep !== false)
    .map(card => ({ q: (card.q || "").trim(), a: (card.a || "").trim() }))
    .filter(card => card.q && card.a);

  if (!selected.length) return;

  const created = selected.length;
  selected.forEach(({ q, a }) => {
    cards.push({ id: nextCardId++, q, a });
  });

  cardIndex = cards.length - created;
  hideNotesPreview();
  updateFlashcardMode();
  showCard();
  goTo("cards");
  persistState();

  genCardsBtn.textContent = `Created ${created} cards`;
  setTimeout(() => {
    genCardsBtn.textContent = "Generate Flashcards";
  }, 1400);
});

cancelPreviewCardsBtn?.addEventListener("click", hideNotesPreview);

notesPreviewList?.addEventListener("change", e => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  const row = target.closest("[data-index]");
  if (!row) return;
  const idx = Number(row.dataset.index);
  if (!Number.isInteger(idx) || !pendingGeneratedCards[idx]) return;

  if (target instanceof HTMLInputElement && target.dataset.role === "keep") {
    pendingGeneratedCards[idx].keep = target.checked;
    renderNotesPreviewList();
    requestAnimationFrame(syncCardHeight);
  }
});

notesPreviewList?.addEventListener("input", e => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  const row = target.closest("[data-index]");
  if (!row) return;
  const idx = Number(row.dataset.index);
  if (!Number.isInteger(idx) || !pendingGeneratedCards[idx]) return;

  if (target instanceof HTMLInputElement && target.dataset.role === "q") {
    pendingGeneratedCards[idx].q = target.value;
    return;
  }
  if (target instanceof HTMLTextAreaElement && target.dataset.role === "a") {
    pendingGeneratedCards[idx].a = target.value;
  }
});

notesInput?.addEventListener("input", () => {
  notesDraft = notesInput.value || "";
  updateNotesInsights();
  if (notesSaveTimer) clearTimeout(notesSaveTimer);
  notesSaveTimer = setTimeout(() => {
    persistState();
  }, 180);
});

focusInsertQBtn?.addEventListener("click", () => {
  appendTextToNotes("Q: ");
});

focusInsertABtn?.addEventListener("click", () => {
  appendTextToNotes("A: ");
});

focusInsertKeyBtn?.addEventListener("click", () => {
  appendTextToNotes("Key idea: ");
});

focusCaptureDoneBtn?.addEventListener("click", () => {
  closeFocusCapturePrompt();
});

function setTodayReflection(mood) {
  if (!["easy", "okay", "hard"].includes(mood)) return;
  if (!reflectionState.ratingsByDate || typeof reflectionState.ratingsByDate !== "object") {
    reflectionState.ratingsByDate = {};
  }
  setHomeReflectionVisible(false);
  reflectionState.ratingsByDate[getTodayKey()] = mood;
  pruneReflectionHistory();
  updateHomeReflectionUI();
  setTimeout(() => {
    setHomeReflectionVisible(false);
    syncCardHeight();
  }, 0);
  persistState();
}

function setTomorrowPlan(preset) {
  if (!["light", "normal", "deep"].includes(preset)) return;
  const today = getTodayKey();
  const tomorrow = dateKeyAddDays(today, 1);
  const plan = PLAN_PRESETS[preset];
  planState.plansByDate[tomorrow] = {
    preset,
    focus: plan.focus,
    cards: plan.cards
  };
  prunePlanHistory();
  updateHomePlanUI();
  persistState();
}

function undoTodayReflection() {
  const today = getTodayKey();
  if (reflectionState.ratingsByDate && typeof reflectionState.ratingsByDate === "object") {
    delete reflectionState.ratingsByDate[today];
  }
  setHomeUndoVisible(false);
  setHomeReflectionVisible(true);
  updateHomeReflectionUI();
  setTimeout(() => syncCardHeight(), 0);
  persistState();
}

function resolveReflectionMood(buttonEl) {
  if (!buttonEl) return "";
  const moodFromData = buttonEl.dataset?.reflect;
  if (["easy", "okay", "hard"].includes(moodFromData)) return moodFromData;
  if (buttonEl.id === "reflectionEasyBtn") return "easy";
  if (buttonEl.id === "reflectionOkayBtn") return "okay";
  if (buttonEl.id === "reflectionHardBtn") return "hard";
  return "";
}

function handleReflectionTap(e) {
  const btn = e.target.closest("[data-reflect]");
  if (!btn || !homeReflectionCard?.contains(btn)) return;
  const mood = resolveReflectionMood(btn);
  if (!mood) return;
  e.preventDefault();
  e.stopPropagation();
  setTodayReflection(mood);
}

homeReflectionCard?.addEventListener("click", handleReflectionTap);

function handleUndoReflection(e) {
  const btn = e.target?.closest?.("#homeUndoReflectionBtn");
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  undoTodayReflection();
}

homeUndoReflectionBtn?.addEventListener("click", handleUndoReflection);

function handlePlanTap(e) {
  const btn = e.target.closest("[data-plan]");
  if (!btn || !homePlanCard?.contains(btn)) return;
  const preset = btn.dataset.plan;
  if (!["light", "normal", "deep"].includes(preset)) return;
  e.preventDefault();
  e.stopPropagation();
  setTomorrowPlan(preset);
}

homePlanCard?.addEventListener("click", handlePlanTap);

themeToggleBtn?.addEventListener("click", () => {
  applyTheme(themeMode === "light" ? "dark" : "light");
  persistState();
});

exportNotesBtn?.addEventListener("click", () => {
  const text = notesInput?.value || "";
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `brainfy-notes-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
});

clearNotesBtn?.addEventListener("click", () => {
  const hasText = (notesInput?.value || "").trim().length > 0;
  if (!hasText) return;
  const shouldClear = window.confirm("Clear all notes? This cannot be undone.");
  if (!shouldClear) return;
  if (notesInput) notesInput.value = "";
  hideNotesPreview();
  notesDraft = "";
  updateNotesInsights();
  persistState();
});

resetSessionBtn?.addEventListener("click", () => {
  recallByCardId.clear();
  recallStats.good = 0;
  recallStats.okay = 0;
  recallStats.miss = 0;
  sessionState.reviewedToday = 0;
  trajectoryByCardId.clear();
  recentResults = [];
  slippingMode = false;
  reviewHistory = [];
  reviewCursor = -1;
  cardShownAt = 0;
  recallStartedAt = 0;
  updateRecallSelectionUI(cards[cardIndex]?.id);
  updateRecallSummary();
  updateSessionStats();
  updateSlippingModeUI();
  persistState();
});

dueNowBtn?.addEventListener("click", () => {
  dueNowMode = !dueNowMode;
  updateDueModeUI();
  persistState();
});

mistakesModeBtn?.addEventListener("click", () => {
  mistakesMode = !mistakesMode;
  updateMistakesModeUI();
  persistState();
});

slippingModeBtn?.addEventListener("click", () => {
  slippingMode = !slippingMode;
  updateSlippingModeUI();
  persistState();
});

exportDeckBtn?.addEventListener("click", () => {
  const payload = {
    schema: "brainfy-export-v1",
    exportedAt: new Date().toISOString(),
    cards,
    nextCardId,
    cardIndex,
    dueNowMode,
    mistakesMode,
    slippingMode,
    recentResults,
    trajectoryByCardId: Object.fromEntries(trajectoryByCardId),
    recallByCardId: Object.fromEntries(recallByCardId),
    sessionState
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `brainfy-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

importDeckBtn?.addEventListener("click", () => {
  importDeckInput?.click();
});

clearDeckBtn?.addEventListener("click", () => {
  if (!cards.length) return;
  const shouldClear = window.confirm("Clear all flashcards? This cannot be undone.");
  if (!shouldClear) return;

  cards = [];
  cardIndex = 0;
  nextCardId = 1;
  dueNowMode = false;
  mistakesMode = false;
  slippingMode = false;
  recentResults = [];
  reviewHistory = [];
  reviewCursor = -1;
  cardShownAt = 0;
  recallStartedAt = 0;
  sessionState.reviewedToday = 0;
  recallByCardId.clear();
  trajectoryByCardId.clear();
  recallStats.good = 0;
  recallStats.okay = 0;
  recallStats.miss = 0;
  setEditMode(null);

  if (feedbackTimer) {
    clearTimeout(feedbackTimer);
    feedbackTimer = null;
  }
  feedbackLocked = false;
  flashcard?.classList.remove("feedback-show", "feedback-good", "feedback-okay", "feedback-miss", "flipped");

  updateFlashcardMode();
  updateRecallSummary();
  updateSessionStats();
  updateDueModeUI();
  updateMistakesModeUI();
  updateSlippingModeUI();
  persistState();
});

importDeckInput?.addEventListener("change", async e => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data || typeof data !== "object") return;
    if (!Array.isArray(data.cards)) return;

    cards = data.cards
      .filter(c => c && typeof c.q === "string" && typeof c.a === "string")
      .map(c => ({ id: Number(c.id) || nextCardId++, q: c.q, a: c.a }));
    nextCardId = cards.length ? Math.max(...cards.map(c => c.id)) + 1 : 1;

    cardIndex = typeof data.cardIndex === "number" ? data.cardIndex : 0;
    if (!cards.length) cardIndex = 0;
    if (cardIndex >= cards.length) cardIndex = 0;

    recallByCardId.clear();
    recallStats.good = 0;
    recallStats.okay = 0;
    recallStats.miss = 0;

    const source = data.recallByCardId && typeof data.recallByCardId === "object"
      ? data.recallByCardId
      : {};
    const allowed = new Set(cards.map(c => String(c.id)));
    Object.entries(source).forEach(([id, rating]) => {
      if (!allowed.has(String(id))) return;
      if (!["good", "okay", "miss"].includes(rating)) return;
      recallByCardId.set(Number(id), rating);
      recallStats[rating] += 1;
    });

    if (typeof data.dueNowMode === "boolean") {
      dueNowMode = data.dueNowMode;
    } else {
      dueNowMode = false;
    }
    if (typeof data.mistakesMode === "boolean") {
      mistakesMode = data.mistakesMode;
    } else {
      mistakesMode = false;
    }
    if (typeof data.slippingMode === "boolean") {
      slippingMode = data.slippingMode;
    } else {
      slippingMode = false;
    }
    if (Array.isArray(data.recentResults)) {
      recentResults = data.recentResults
        .map(v => Number(v))
        .filter(v => Number.isFinite(v) && v >= 0 && v <= 1)
        .slice(-24);
    } else {
      recentResults = [];
    }
    restoreTrajectoryFromObject(data.trajectoryByCardId);

    if (data.sessionState && typeof data.sessionState === "object") {
      if (typeof data.sessionState.dateKey === "string") {
        sessionState.dateKey = data.sessionState.dateKey;
      }
      if (typeof data.sessionState.reviewedToday === "number" && data.sessionState.reviewedToday >= 0) {
        sessionState.reviewedToday = data.sessionState.reviewedToday;
      }
    }
    ensureSessionDate();

    reviewHistory = [];
    reviewCursor = -1;
    updateFlashcardMode();
    updateRecallSummary();
    updateSessionStats();
    updateDueModeUI();
    updateMistakesModeUI();
    updateSlippingModeUI();
    if (cards.length) showCard();
    persistState();
  } catch {
    // Ignore invalid import file.
  } finally {
    importDeckInput.value = "";
  }
});

document.addEventListener("keydown", e => {
  const activeView = document.querySelector(".view.active");
  if (!activeView || activeView.id !== "cardsView") return;
  if (!cards.length) return;

  const tag = document.activeElement?.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "button") return;

  if (e.key === "ArrowLeft") {
    e.preventDefault();
    goPrevCard();
    return;
  }
  if (e.key === "ArrowRight") {
    e.preventDefault();
    goNextCard();
    return;
  }
  if (e.key === " " || e.code === "Space") {
    e.preventDefault();
    flashcard?.click();
    return;
  }
  if (e.key === "1") {
    e.preventDefault();
    recallGoodBtn?.click();
    return;
  }
  if (e.key === "2") {
    e.preventDefault();
    recallOkayBtn?.click();
    return;
  }
  if (e.key === "3") {
    e.preventDefault();
    recallMissBtn?.click();
  }
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
  loadState();
  card?.classList.add("compact");
  goTo("splash");
  updateTimer();
  updatePauseUI();
  updateChimeUI();
  updateFocusPresetUI();
  syncFocusInputValues();
  updateFocusStatsUI();
  updateMiniTimerUI();
  updateFlashcardMode();
  updateRecallSummary();
  updateSessionStats();
  updateDueModeUI();
  updateMistakesModeUI();
  updateHomeReflectionUI();
  updateHomePlanUI();
  updateNotesInsights();
  if (cards.length) showCard();
  syncCardHeight();
});

// If app stays open, refresh reflection visibility as local time passes.
setInterval(() => {
  updateHomeReflectionUI();
  ensureGoalTargetsCurrentDate();
  updateHomePlanUI();
}, 60000);

window.addEventListener("resize", syncCardHeight);
