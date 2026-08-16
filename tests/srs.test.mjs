// Tests for the SM-2 scheduler — the engine the whole product rests on, and
// until now the largest untested surface in the codebase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBundle, DAY_MS, startOfDay } from './_bundle.mjs';

const { srsSchedule, srsIsDue } = loadBundle();

const newCard = () => ({ q: 'What is the capital of France?', a: 'Paris' });

test('a new card graded "good" gets the 3-day first interval', () => {
  const c = srsSchedule(newCard(), 'good');
  assert.equal(c.interval, 3);
  assert.equal(c.reps, 1);
  assert.equal(c.lapses, 0);
  assert.equal(c.ease, 2.5);
});

test('new-card intervals differ by grade', () => {
  assert.equal(srsSchedule(newCard(), 'hard').interval, 1);
  assert.equal(srsSchedule(newCard(), 'good').interval, 3);
  assert.equal(srsSchedule(newCard(), 'easy').interval, 7);
});

test('due dates land on a local day boundary, not a wall-clock offset', () => {
  // The regression: scheduling `now + 3 days` meant a card graded at 21:00 was
  // not due until 21:00 three days later, so an evening session an hour earlier
  // showed "nothing due". Every scheduled card must now come due at midnight.
  const c = srsSchedule(newCard(), 'good');
  const due = new Date(c.dueAt);
  assert.equal(due.getHours(), 0, 'due time should be local midnight');
  assert.equal(due.getMinutes(), 0);
  assert.equal(due.getSeconds(), 0);
  assert.equal(c.dueAt, startOfDay(Date.now() + 3 * DAY_MS));
});

test('a card scheduled tonight is due the next morning, not 24h later', () => {
  // Grade at 23:00 with a 1-day interval…
  const at2300 = new Date(); at2300.setHours(23, 0, 0, 0);
  const card = srsSchedule(newCard(), 'hard');            // interval 1
  const dueAt = startOfDay(at2300.getTime() + DAY_MS);    // what the engine computes
  assert.equal(card.interval, 1);

  // …and it should be due during the next morning's session (09:00), which the
  // old exact-timestamp scheduling would have deferred until 23:00 that night.
  const nextMorning = new Date(at2300.getTime() + DAY_MS);
  nextMorning.setHours(9, 0, 0, 0);
  assert.equal(srsIsDue({ ...card, dueAt }, nextMorning.getTime()), true);
});

test('"again" makes the card due immediately and resets the streak', () => {
  const mature = { ...newCard(), interval: 10, ease: 2.5, reps: 4, lapses: 0 };
  const now = Date.now();
  const c = srsSchedule(mature, 'again');
  assert.equal(c.interval, 0);
  assert.equal(c.reps, 0);
  assert.equal(c.lapses, 1, 'a mature card failing counts as a lapse');
  assert.ok(c.dueAt <= now + 1000, 'should be due right away, not at midnight');
  assert.equal(srsIsDue(c, now), true);
});

test('failing a brand-new card is not counted as a lapse', () => {
  assert.equal(srsSchedule(newCard(), 'again').lapses, 0);
});

test('"easy" can actually raise ease above the default', () => {
  // Ease default and ceiling were both 2.5, so this bonus was clamped away and
  // ease could only ever ratchet downward.
  const c = srsSchedule({ ...newCard(), interval: 10, ease: 2.5, reps: 3, lapses: 0 }, 'easy');
  assert.ok(c.ease > 2.5, `expected ease above 2.5, got ${c.ease}`);
});

test('ease stays inside its clamps under repeated grading', () => {
  let hard = { ...newCard(), interval: 10, ease: 2.5, reps: 3, lapses: 0 };
  for (let i = 0; i < 20; i++) hard = srsSchedule(hard, 'again');
  assert.ok(hard.ease >= 1.3, `floor breached: ${hard.ease}`);

  let easy = { ...newCard(), interval: 10, ease: 2.5, reps: 3, lapses: 0 };
  for (let i = 0; i < 20; i++) easy = srsSchedule(easy, 'easy');
  assert.ok(easy.ease <= 3.0, `ceiling breached: ${easy.ease}`);
});

test('a mature card graded "good" multiplies its interval by ease', () => {
  const c = srsSchedule({ ...newCard(), interval: 10, ease: 2.0, reps: 3, lapses: 0 }, 'good');
  assert.equal(c.interval, 20);
});

test('intervals only ever grow forward for a passing grade', () => {
  let c = { ...newCard() };
  let prev = 0;
  for (let i = 0; i < 8; i++) {
    c = srsSchedule(c, 'good');
    assert.ok(c.interval >= prev, `interval went backwards: ${prev} → ${c.interval}`);
    prev = c.interval;
  }
});

test('a never-reviewed card is always due', () => {
  assert.equal(srsIsDue(newCard(), Date.now()), true);
});
