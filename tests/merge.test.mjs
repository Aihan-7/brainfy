// Tests for mergeStates() — the function standing between a user and losing
// work when guest data meets an existing account, or when a device reconnects
// holding edits the cloud never saw. Its whole contract is "lose nothing".
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBundle, plain } from './_bundle.mjs';

const { mergeStates } = loadBundle();

const card = (q, a) => ({ q, a });

// `base` = the cloud copy (authoritative for settings), `incoming` = local work.
const cloud = () => ({
  userName: 'Aihan',
  subjects: [{ id: 1, name: 'Biology', desc: '', color: '#7c3aed', docs: 0, cards: [card('Mitochondria?', 'Powerhouse')] }],
  sessions: [{ date: 'Mon Aug 10 2026', duration: 1500 }],
  tasks: [{ id: 2, text: 'Revise chapter 3', done: false }],
  timetable: [],
  focusDuration: 1500,
  dailyGoal: 120,
  streak: 4,
  bestStreak: 9,
  nextId: 3,
});

test('subjects unique to each side both survive', () => {
  const local = { subjects: [{ id: 1, name: 'Chemistry', desc: '', color: '#0891b2', docs: 0, cards: [card('pH of water?', '7')] }], nextId: 2 };
  const m = mergeStates(cloud(), local);
  const names = plain(m.subjects.map(s => s.name).sort());
  assert.deepEqual(names, ['Biology', 'Chemistry']);
});

test('a colliding subject id from the guest side is reallocated, never overwritten', () => {
  // Both sides call their first subject id 1 — the classic silent-clobber case.
  const local = { subjects: [{ id: 1, name: 'Chemistry', desc: '', color: '#0891b2', docs: 0, cards: [] }], nextId: 2 };
  const m = mergeStates(cloud(), local);
  const ids = m.subjects.map(s => s.id);
  assert.equal(new Set(ids).size, ids.length, `duplicate subject ids: ${ids}`);
  assert.ok(m.nextId > Math.max(...ids), 'nextId must stay ahead of every allocated id');
});

test('same-named subjects merge their cards instead of duplicating the deck', () => {
  const local = { subjects: [{ id: 7, name: '  biology ', desc: '', color: '#7c3aed', docs: 0, cards: [card('Ribosome?', 'Protein synthesis')] }], nextId: 8 };
  const m = mergeStates(cloud(), local);
  assert.equal(m.subjects.length, 1, 'name match should be case- and whitespace-insensitive');
  assert.deepEqual(plain(m.subjects[0].cards.map(c => c.q).sort()), ['Mitochondria?', 'Ribosome?']);
});

test('identical cards are not duplicated by a merge', () => {
  const local = { subjects: [{ id: 7, name: 'Biology', desc: '', color: '#7c3aed', docs: 0, cards: [card('Mitochondria?', 'Powerhouse')] }], nextId: 8 };
  const m = mergeStates(cloud(), local);
  assert.equal(m.subjects[0].cards.length, 1);
});

test('merging is idempotent — running it twice changes nothing', () => {
  // The reconnect path can merge the same local copy more than once; a merge
  // that grew the deck each time would quietly duplicate a user's whole library.
  const local = { subjects: [{ id: 7, name: 'Chemistry', desc: '', color: '#0891b2', docs: 0, cards: [card('pH of water?', '7')] }], sessions: [{ date: 'Tue Aug 11 2026', duration: 600 }], nextId: 8 };
  const once  = mergeStates(cloud(), local);
  const twice = mergeStates(once, local);
  assert.equal(twice.subjects.length, once.subjects.length);
  assert.equal(twice.sessions.length, once.sessions.length);
  assert.deepEqual(
    plain(twice.subjects.flatMap(s => s.cards.map(c => c.q)).sort()),
    plain(once.subjects.flatMap(s => s.cards.map(c => c.q)).sort()),
  );
});

test('sessions and tasks dedupe but keep genuinely distinct entries', () => {
  const local = {
    sessions: [{ date: 'Mon Aug 10 2026', duration: 1500 }, { date: 'Tue Aug 11 2026', duration: 600 }],
    tasks:    [{ id: 1, text: 'Revise chapter 3', done: false }, { id: 2, text: 'Past paper', done: false }],
    nextId: 3,
  };
  const m = mergeStates(cloud(), local);
  assert.equal(m.sessions.length, 2, 'the identical session should collapse');
  assert.equal(m.tasks.length, 2, 'the identical task should collapse');
});

test('account-level settings come from the cloud, not the guest device', () => {
  const local = { focusDuration: 60, dailyGoal: 5, subjects: [], nextId: 1 };
  const m = mergeStates(cloud(), local);
  assert.equal(m.focusDuration, 1500);
  assert.equal(m.dailyGoal, 120);
});

test('streaks take the better of the two sides', () => {
  const m = mergeStates(cloud(), { streak: 11, bestStreak: 2, subjects: [], nextId: 1 });
  assert.equal(m.streak, 11);
  assert.equal(m.bestStreak, 9);
});

test('no card from either side is ever dropped', () => {
  const local = {
    subjects: [
      { id: 1, name: 'Biology',   desc: '', color: '#7c3aed', docs: 0, cards: [card('Ribosome?', 'Protein synthesis')] },
      { id: 2, name: 'Chemistry', desc: '', color: '#0891b2', docs: 0, cards: [card('pH of water?', '7'), card('Avogadro?', '6.022e23')] },
    ],
    nextId: 3,
  };
  const m = mergeStates(cloud(), local);
  const merged = plain(m.subjects.flatMap(s => s.cards.map(c => `${c.q}|${c.a}`)).sort());
  assert.deepEqual(merged, [
    'Avogadro?|6.022e23',
    'Mitochondria?|Powerhouse',
    'Ribosome?|Protein synthesis',
    'pH of water?|7',
  ]);
});

test('an empty incoming state leaves the cloud copy intact', () => {
  const base = cloud();
  const m = mergeStates(base, { subjects: [], sessions: [], tasks: [], timetable: [], nextId: 1 });
  assert.equal(m.subjects.length, base.subjects.length);
  assert.equal(m.sessions.length, base.sessions.length);
  assert.equal(m.tasks.length, base.tasks.length);
});
