// ──────────────────────────────────────────────────────────────────────────
//  srs.js — pure SM-2 spaced-repetition scheduling math.
//
//  Loaded NON-lazily as a plain global script (same pattern as icons.js) and
//  also importable by Node (tests/srs.test.mjs). Keeping the scheduler in one
//  small, dependency-free, side-effect-free module lets us unit-test the exact
//  code the app runs — a scheduling bug silently corrupts every user's review
//  queue, so it's the highest-value logic to lock down.
//
//  The app (script.js, compiled from src/main.ts) consumes these via the
//  global `BrainfySRS`; main.ts aliases them to srsSchedule/srsPreview/etc.
//  State-aware helpers (which cards are due across all decks) live in main.ts
//  because they read app state — these four functions take only a card.
//
//  SM-2 model:
//    New card (no `interval` yet):
//      again → due now,  ease -= 0.2 (no lapse — never graduated)
//      hard  → 1 day,    ease -= 0.15
//      good  → 3 days
//      easy  → 7 days,   ease += 0.15
//    Review card (has `interval`):
//      again → due now,  ease -= 0.2, lapses++, reps reset
//      hard  → interval × 1.2,        ease -= 0.15
//      good  → interval × ease
//      easy  → interval × ease × 1.3, ease += 0.15
//    Ease is clamped to [1.3, 2.5].
// ──────────────────────────────────────────────────────────────────────────

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();              // Node / bundler (tests)
  } else {
    root.BrainfySRS = factory();             // browser global (script.js reads this)
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // First-review intervals (days) for a brand-new card, keyed by rating.
  var SRS_NEW_INTERVALS = { again: 0, hard: 1, good: 3, easy: 7 };
  var SRS_EASE_MIN      = 1.3;
  var SRS_EASE_MAX      = 2.5;
  var SRS_EASE_DEFAULT  = 2.5;
  var DAY_MS            = 86400000;

  // Apply a rating to a card and return a NEW card object with updated SRS
  // fields (dueAt, interval, ease, reps, lapses, lastReviewedAt). Pure aside
  // from reading the clock; never mutates the input.
  function srsSchedule(card, rating) {
    var now = Date.now();
    var interval = card.interval != null ? card.interval : 0;
    var ease     = card.ease     != null ? card.ease     : SRS_EASE_DEFAULT;
    var reps     = card.reps     != null ? card.reps     : 0;
    var lapses   = card.lapses   != null ? card.lapses   : 0;

    // First exposure — no interval recorded yet.
    var isNew = card.interval == null;

    if (rating === 'again') {
      interval = 0;             // due immediately, will re-appear this session
      ease     = Math.max(SRS_EASE_MIN, ease - 0.20);
      reps     = 0;
      if (!isNew) lapses += 1;
    } else if (isNew) {
      interval = SRS_NEW_INTERVALS[rating];
      if (rating === 'easy') ease = Math.min(SRS_EASE_MAX, ease + 0.15);
      if (rating === 'hard') ease = Math.max(SRS_EASE_MIN, ease - 0.15);
      reps = 1;
    } else {
      // Mature card — multiply forward.
      var mult = rating === 'hard' ? 1.2
               : rating === 'good' ? ease
               : /* easy */          ease * 1.3;
      interval = Math.max(1, Math.round(interval * mult));
      if (rating === 'easy') ease = Math.min(SRS_EASE_MAX, ease + 0.15);
      if (rating === 'hard') ease = Math.max(SRS_EASE_MIN, ease - 0.15);
      reps += 1;
    }

    var out = {};
    for (var k in card) if (Object.prototype.hasOwnProperty.call(card, k)) out[k] = card[k];
    out.dueAt          = now + Math.round(interval * DAY_MS);
    out.interval       = interval;
    out.ease           = ease;
    out.reps           = reps;
    out.lapses         = lapses;
    out.lastReviewedAt = now;
    return out;
  }

  // Predict the next interval (days) for a card+rating without mutating. Used
  // for the labels on the rating buttons ("Good · 3d").
  function srsPreview(card, rating) {
    var next = srsSchedule(card, rating);
    return next.interval != null ? next.interval : 0;
  }

  // Is the card due for review at `now` (default: current time)? A card with
  // no dueAt has never been reviewed → always due.
  function srsIsDue(card, now) {
    if (now == null) now = Date.now();
    return card.dueAt == null || card.dueAt <= now;
  }

  // Pretty-print an interval in days as a human label: 0 → "<1d", 1 → "1d",
  // 30 → "1mo", 365 → "1y". Used for button labels.
  function srsLabel(days) {
    if (days < 1)   return '<1d';
    if (days < 30)  return Math.round(days) + 'd';
    if (days < 365) return Math.round(days / 30) + 'mo';
    return Math.round(days / 365) + 'y';
  }

  return { srsSchedule: srsSchedule, srsPreview: srsPreview, srsIsDue: srsIsDue, srsLabel: srsLabel };
});
