// ────────────────────────────────────────────────────────────────────────────
//  Tests for srs.js — the SM-2 spaced-repetition scheduler.
//
//  This is the single most important pure-logic module in the product: a bug
//  here silently mis-schedules every user's reviews and is invisible until
//  cards stop appearing at the right time. We test the exact code the app runs
//  (src/main.ts aliases these via the BrainfySRS global).
//
//  Time-dependent assertions freeze Date.now via a stub so the computed dueAt
//  is deterministic.
//
//  Run: `node --test tests/srs.test.mjs`  (or `npm test`)
// ────────────────────────────────────────────────────────────────────────────

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import srs from '../srs.js';
const { srsSchedule, srsPreview, srsIsDue, srsLabel } = srs;

const DAY = 86400000;
const NOW = 1_700_000_000_000; // fixed clock for deterministic dueAt

const realNow = Date.now;
beforeEach(() => { Date.now = () => NOW; });
afterEach(() => { Date.now = realNow; });

// ── srsSchedule: new cards ───────────────────────────────────────────────────

describe('srsSchedule — new cards', () => {
  test('"good" graduates a new card to a 3-day interval', () => {
    const out = srsSchedule({ q: 'a', a: 'b' }, 'good');
    assert.equal(out.interval, 3);
    assert.equal(out.reps, 1);
    assert.equal(out.lapses, 0);
    assert.equal(out.ease, 2.5);
    assert.equal(out.dueAt, NOW + 3 * DAY);
    assert.equal(out.lastReviewedAt, NOW);
  });

  test('"easy" → 7 days and bumps ease', () => {
    const out = srsSchedule({}, 'easy');
    assert.equal(out.interval, 7);
    assert.equal(out.ease, 2.5); // already at the max, stays clamped
  });

  test('"hard" → 1 day and lowers ease', () => {
    const out = srsSchedule({}, 'hard');
    assert.equal(out.interval, 1);
    assert.equal(out.ease, 2.35);
  });

  test('"again" on a new card is due immediately and takes NO lapse', () => {
    const out = srsSchedule({}, 'again');
    assert.equal(out.interval, 0);
    assert.equal(out.lapses, 0); // never graduated → not a lapse
    assert.equal(out.reps, 0);
    assert.equal(out.ease, 2.3); // 2.5 - 0.2
    assert.equal(out.dueAt, NOW);
  });
});

// ── srsSchedule: review (mature) cards ───────────────────────────────────────

describe('srsSchedule — review cards', () => {
  const mature = { interval: 10, ease: 2.5, reps: 3, lapses: 0 };

  test('"good" multiplies interval by ease and increments reps', () => {
    const out = srsSchedule(mature, 'good');
    assert.equal(out.interval, 25); // round(10 * 2.5)
    assert.equal(out.reps, 4);
    assert.equal(out.ease, 2.5);
    assert.equal(out.dueAt, NOW + 25 * DAY);
  });

  test('"hard" multiplies by 1.2 and lowers ease', () => {
    const out = srsSchedule(mature, 'hard');
    assert.equal(out.interval, 12); // round(10 * 1.2)
    assert.equal(out.ease, 2.35);
  });

  test('"easy" multiplies by ease*1.3 and raises ease (clamped)', () => {
    const out = srsSchedule({ interval: 10, ease: 2.0, reps: 3, lapses: 0 }, 'easy');
    assert.equal(out.interval, 26); // round(10 * 2.0 * 1.3)
    assert.equal(out.ease, 2.15);   // 2.0 + 0.15
  });

  test('"again" relapses to due-now, drops ease, increments lapses, resets reps', () => {
    const out = srsSchedule(mature, 'again');
    assert.equal(out.interval, 0);
    assert.equal(out.lapses, 1);
    assert.equal(out.reps, 0);
    assert.equal(out.ease, 2.3);
    assert.equal(out.dueAt, NOW);
  });

  test('interval never collapses below 1 day for a passing rating', () => {
    const out = srsSchedule({ interval: 1, ease: 1.3, reps: 1, lapses: 0 }, 'hard');
    assert.ok(out.interval >= 1);
  });
});

// ── ease clamping ────────────────────────────────────────────────────────────

describe('srsSchedule — ease clamping', () => {
  test('ease never exceeds 2.5', () => {
    const out = srsSchedule({ interval: 5, ease: 2.5, reps: 1, lapses: 0 }, 'easy');
    assert.equal(out.ease, 2.5);
  });

  test('ease never drops below 1.3', () => {
    const out = srsSchedule({ interval: 5, ease: 1.3, reps: 1, lapses: 0 }, 'hard');
    assert.equal(out.ease, 1.3);
  });
});

// ── purity ───────────────────────────────────────────────────────────────────

describe('srsSchedule — purity', () => {
  test('does not mutate the input card', () => {
    const card = { q: 'x', a: 'y', interval: 10, ease: 2.5, reps: 3, lapses: 0 };
    const snapshot = JSON.stringify(card);
    srsSchedule(card, 'good');
    assert.equal(JSON.stringify(card), snapshot);
  });

  test('preserves non-SRS fields (q/a)', () => {
    const out = srsSchedule({ q: 'question', a: 'answer' }, 'good');
    assert.equal(out.q, 'question');
    assert.equal(out.a, 'answer');
  });
});

// ── srsPreview ───────────────────────────────────────────────────────────────

describe('srsPreview', () => {
  test('returns the interval srsSchedule would assign, without side effects', () => {
    const card = { interval: 10, ease: 2.5, reps: 3, lapses: 0 };
    assert.equal(srsPreview(card, 'good'), 25);
    assert.equal(srsPreview(card, 'hard'), 12);
    assert.equal(srsPreview({}, 'easy'), 7);
  });
});

// ── srsIsDue ─────────────────────────────────────────────────────────────────

describe('srsIsDue', () => {
  test('a card with no dueAt (never reviewed) is due', () => {
    assert.equal(srsIsDue({ q: 'a', a: 'b' }), true);
  });

  test('a card due in the past is due; in the future is not', () => {
    assert.equal(srsIsDue({ dueAt: NOW - 1 }, NOW), true);
    assert.equal(srsIsDue({ dueAt: NOW }, NOW), true); // exactly now counts as due
    assert.equal(srsIsDue({ dueAt: NOW + 1 }, NOW), false);
  });

  test('defaults the comparison to the current time', () => {
    assert.equal(srsIsDue({ dueAt: NOW - DAY }), true);  // NOW is frozen via the stub
    assert.equal(srsIsDue({ dueAt: NOW + DAY }), false);
  });
});

// ── srsLabel ─────────────────────────────────────────────────────────────────

describe('srsLabel', () => {
  test('formats sub-day, day, month, and year ranges', () => {
    assert.equal(srsLabel(0), '<1d');
    assert.equal(srsLabel(0.5), '<1d');
    assert.equal(srsLabel(1), '1d');
    assert.equal(srsLabel(29), '29d');
    assert.equal(srsLabel(30), '1mo');
    assert.equal(srsLabel(364), '12mo');
    assert.equal(srsLabel(365), '1y');
    assert.equal(srsLabel(730), '2y');
  });
});
