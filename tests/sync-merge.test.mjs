// Tests for mergeSync() — what happens when two devices edit the same account
// and one of them has to put its unsynced edits on top of the other's newer
// cloud copy instead of overwriting it (AUDIT-2026-10-17.md, P0-3). The rules
// under test are documented above mergeSync() in src/main.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBundle, plain } from './_bundle.mjs';

const { mergeSync, sameData, patchInPlace, freshState, rebaseAfterWrite, renumberInPlace, repairIds } = loadBundle();
const clone = (x) => JSON.parse(JSON.stringify(x));

// The cloud copy both devices started from.
const base = () => ({
  ...freshState(),
  userName: 'Ada',
  dailyGoal: 120,
  bestStreak: 3,
  subjects: [{ id: 1, name: 'Biology', desc: '', docs: 1, color: '#7c3aed', accessed: 100,
    cards: [{ q: 'Mitochondria?', a: 'Powerhouse' }, { q: 'Ribosome?', a: 'Protein synthesis' }],
    documents: [{ id: 2, name: 'Notes', type: 'note', content: 'cells', date: 1 }] }],
  tasks: [{ id: 3, text: 'Revise', done: false }, { id: 4, text: 'Past paper', done: false }],
  sessions: [{ date: '2026-11-01T09:00:00.000Z', duration: 1500, subjectId: 1 }],
  nextId: 5,
});
// `edit` gets a copy of the base to change.
const from = (edit) => { const s = clone(base()); edit(s); return s; };
const texts = (st) => plain(st.tasks.map(t => t.text + (t.done ? '✓' : '')));
const ids = (st) => plain([...st.subjects.map(s => s.id), ...st.subjects.flatMap(s => (s.documents || []).map(d => d.id)), ...st.tasks.map(t => t.id), ...st.milestones.map(m => m.id), ...st.timetable.map(b => b.id)]);

test('sameData ignores key order and undefined properties', () => {
  assert.ok(sameData({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 }));
  assert.ok(sameData({ a: 1, x: undefined }, { a: 1 }));
  assert.ok(!sameData({ a: 1 }, { a: 1, b: null }));
  assert.ok(!sameData([1, 2], [2, 1]));
});

test('rule 1: the cloud\'s changes come through when this device changed nothing', () => {
  const remote = from(s => { s.tasks.push({ id: 5, text: 'From phone', done: false }); s.nextId = 6; s.dailyGoal = 90; });
  const m = mergeSync(base(), base(), remote);
  assert.ok(sameData(m, remote), 'an idle device must end up with exactly the cloud copy');
});

test('rule 1: this device\'s edits survive when the cloud changed nothing', () => {
  const local = from(s => { s.tasks[0].done = true; s.tasks.push({ id: 5, text: 'Mine', done: false }); s.nextId = 6; });
  const m = mergeSync(base(), local, base());
  assert.ok(sameData(m, local));
});

test('rule 1: edits to different items on each side both survive', () => {
  const local  = from(s => { s.tasks[0].done = true; s.dailyGoal = 45; });
  const remote = from(s => { s.tasks[1].text = 'Past paper 2019'; s.focusDuration = 50 * 60; });
  const m = mergeSync(base(), local, remote);
  assert.deepEqual(texts(m), ['Revise✓', 'Past paper 2019']);
  assert.equal(m.dailyGoal, 45);
  assert.equal(m.focusDuration, 3000);
});

test('rule 1: a deletion on either side carries over when the other side left the item alone', () => {
  const deletedHere  = mergeSync(base(), from(s => { s.tasks.splice(1, 1); }), from(s => { s.dailyGoal = 60; }));
  assert.deepEqual(texts(deletedHere), ['Revise']);
  const deletedThere = mergeSync(base(), from(s => { s.dailyGoal = 60; }), from(s => { s.tasks.splice(0, 1); }));
  assert.deepEqual(texts(deletedThere), ['Past paper']);
  const subjectGone  = mergeSync(base(), from(s => { s.tasks[0].done = true; }), from(s => { s.subjects = []; }));
  assert.equal(subjectGone.subjects.length, 0, 'a subject deleted on the other device must not come back');
});

test('rule 2: both devices add a task with the same next id → both kept, local one renumbered', () => {
  const local  = from(s => { s.tasks.push({ id: 5, text: 'Laptop task', done: false }); s.nextId = 6; });
  const remote = from(s => { s.tasks.push({ id: 5, text: 'Phone task', done: false }); s.nextId = 6; });
  const renumbered = new Map();
  const m = mergeSync(base(), local, remote, renumbered);
  assert.deepEqual(texts(m), ['Revise', 'Past paper', 'Phone task', 'Laptop task']);
  assert.equal(m.tasks.find(t => t.text === 'Phone task').id, 5, 'the cloud\'s item keeps its id');
  const mine = m.tasks.find(t => t.text === 'Laptop task').id;
  assert.notEqual(mine, 5);
  assert.deepEqual([...renumbered], [[5, mine]], 'the caller learns which local id changed');
  assert.equal(new Set(ids(m)).size, ids(m).length, 'ids stay unique');
  assert.ok(m.nextId > Math.max(...ids(m)), 'nextId stays ahead of every id');
});

test('rule 2: a renumbered new subject keeps its sessions pointing at it', () => {
  const local = from(s => {
    s.subjects.push({ id: 5, name: 'Chemistry', desc: '', docs: 0, color: '#0891b2', accessed: 1, cards: [] });
    s.sessions.push({ date: '2026-11-02T09:00:00.000Z', duration: 600, subjectId: 5 });
    s.nextId = 6;
  });
  const remote = from(s => { s.tasks.push({ id: 5, text: 'Phone task', done: false }); s.nextId = 6; });
  const m = mergeSync(base(), local, remote);
  const chem = m.subjects.find(s => s.name === 'Chemistry');
  assert.notEqual(chem.id, 5, 'id 5 is the phone\'s task now');
  assert.equal(m.sessions.find(x => x.duration === 600).subjectId, chem.id);
  assert.equal(m.tasks.find(t => t.text === 'Phone task').id, 5);
});

test('rule 2: the same new item added on both sides is kept once', () => {
  const add = s => { s.milestones = [{ id: 5, text: 'Complete reading', done: false }]; s.nextId = 6; };
  const m = mergeSync(base(), from(add), from(add));
  assert.equal(m.milestones.length, 1);
});

test('merging the same edits twice changes nothing (idempotent, even after a renumber)', () => {
  const local  = from(s => { s.tasks.push({ id: 5, text: 'Laptop task', done: false }); s.tasks[0].done = true; s.nextId = 6; });
  const remote = from(s => { s.tasks.push({ id: 5, text: 'Phone task', done: false }); s.nextId = 6; });
  const once  = mergeSync(base(), local, remote);
  const twice = mergeSync(base(), local, once);
  assert.ok(sameData(once, twice), `${JSON.stringify(texts(once))} vs ${JSON.stringify(texts(twice))}`);
});

test('rule 3: the same field changed on both sides → this device\'s value; other fields merge', () => {
  const local  = from(s => { s.tasks[0].text = 'Revise ch.1'; s.dailyGoal = 45; });
  const remote = from(s => { s.tasks[0].text = 'Revise ch.2'; s.tasks[0].done = true; s.dailyGoal = 75; });
  const m = mergeSync(base(), local, remote);
  assert.equal(m.tasks[0].text, 'Revise ch.1');
  assert.equal(m.tasks[0].done, true, 'the cloud\'s tick on the same task is kept');
  assert.equal(m.dailyGoal, 45);
});

test('rule 3: a subject edited on both sides merges its cards and documents item by item', () => {
  const local = from(s => {
    s.subjects[0].cards.push({ q: 'ATP?', a: 'Energy' });
    s.subjects[0].desc = 'Cells';
    s.subjects[0].accessed = 300;
  });
  const remote = from(s => {
    s.subjects[0].cards.push({ q: 'DNA?', a: 'Genes' });
    s.subjects[0].documents.push({ id: 5, name: 'Link', type: 'link', content: 'https://x.test', date: 2 });
    s.subjects[0].docs = 2;
    s.subjects[0].accessed = 200;
    s.nextId = 6;
  });
  const m = mergeSync(base(), local, remote);
  const subj = m.subjects[0];
  assert.deepEqual(plain(subj.cards.map(c => c.q)), ['Mitochondria?', 'Ribosome?', 'DNA?', 'ATP?']);
  assert.equal(subj.documents.length, 2);
  assert.equal(subj.docs, 2, 'docs follows the merged documents');
  assert.equal(subj.desc, 'Cells');
  assert.equal(subj.accessed, 300, 'accessed changed on both sides keeps the larger value');
});

test('card review progress: the most recent review wins, as one block', () => {
  const srs = (t, interval) => ({ dueAt: t + interval * 864e5, interval, ease: 2.5, reps: interval, lapses: 0, lastReviewedAt: t });
  const local  = from(s => { Object.assign(s.subjects[0].cards[0], srs(2000, 4)); Object.assign(s.subjects[0].cards[1], srs(9000, 1)); });
  const remote = from(s => { Object.assign(s.subjects[0].cards[0], srs(5000, 6)); Object.assign(s.subjects[0].cards[1], srs(3000, 2)); });
  const [c1, c2] = mergeSync(base(), local, remote).subjects[0].cards;
  assert.equal(c1.lastReviewedAt, 5000); assert.equal(c1.interval, 6);   // the cloud's later review
  assert.equal(c2.lastReviewedAt, 9000); assert.equal(c2.interval, 1);   // this device's later review
});

test('card review progress: reviewed on one side only → that side, whatever else changed', () => {
  const local  = from(s => { Object.assign(s.subjects[0].cards[0], { dueAt: 1, interval: 1, ease: 2.5, reps: 1, lapses: 0, lastReviewedAt: 10 }); });
  const remote = from(s => { s.subjects[0].cards.push({ q: 'DNA?', a: 'Genes' }); });
  const m = mergeSync(base(), local, remote);
  assert.equal(m.subjects[0].cards[0].lastReviewedAt, 10, 'offline review progress is not lost');
  assert.equal(m.subjects[0].cards.length, 3);
});

test('rule 4: an edit beats a concurrent delete, both ways', () => {
  const editedHere = mergeSync(base(), from(s => { s.tasks[0].done = true; }), from(s => { s.tasks.splice(0, 1); }));
  assert.deepEqual(texts(editedHere), ['Past paper', 'Revise✓']);
  const editedThere = mergeSync(base(), from(s => { s.tasks.splice(0, 1); }), from(s => { s.tasks[0].done = true; }));
  assert.deepEqual(texts(editedThere), ['Revise✓', 'Past paper']);
});

test('bestStreak keeps the larger value; nextId stays above every id', () => {
  const m = mergeSync(base(), from(s => { s.bestStreak = 9; }), from(s => { s.bestStreak = 5; s.nextId = 40; }));
  assert.equal(m.bestStreak, 9);
  assert.equal(m.nextId, 40);
});

test('without a base: nothing is deleted, the cloud\'s fields win, review progress by recency', () => {
  const local  = from(s => {
    s.tasks.splice(1, 1);                       // looks like a delete — or a stale copy
    s.tasks[0].done = true;                     // looks like an edit — or a stale value
    s.tasks.push({ id: 9, text: 'Offline task', done: false });
    Object.assign(s.subjects[0].cards[0], { dueAt: 1, interval: 3, ease: 2.5, reps: 2, lapses: 0, lastReviewedAt: 900 });
    s.dailyGoal = 30; s.bestStreak = 12; s.nextId = 10;
  });
  const remote = from(s => { s.subjects[0].desc = 'from the phone'; });
  const m = mergeSync(null, local, remote);
  assert.deepEqual(texts(m), ['Revise', 'Past paper', 'Offline task'], 'the tick looks like a stale value: the cloud\'s');
  assert.equal(m.subjects[0].desc, 'from the phone');
  assert.equal(m.dailyGoal, 120, 'settings: the cloud\'s');
  assert.equal(m.subjects[0].cards[0].lastReviewedAt, 900, 'the only review wins');
  assert.equal(m.bestStreak, 12);
  assert.ok(m.nextId >= 10);
});

test('without a base: two different items that took the same id are both kept, never folded into one', () => {
  // Each device added a task and a subject (with cards, a note and a study
  // session) and took the same next ids: edits from a copy whose base is unknown
  // (left unsynced by an older app version, two kept copies, ...).
  const local = from(s => {
    s.tasks.push({ id: 5, text: 'Offline task', done: false });
    s.subjects.push({ id: 6, name: 'Physics', desc: '', docs: 1, color: '#0891b2', accessed: 5,
      cards: [{ q: 'F=?', a: 'ma' }, { q: 'v=?', a: 'd/t' }], documents: [{ id: 7, name: 'Laws', type: 'note', content: 'x', date: 70 }] });
    s.sessions.push({ date: '2026-11-02T09:00:00.000Z', duration: 600, subjectId: 6 });
    s.nextId = 8;
  });
  const remote = from(s => {
    s.tasks.push({ id: 5, text: 'Phone task', done: false });
    s.subjects.push({ id: 6, name: 'Chemistry', desc: '', docs: 0, color: '#db2777', accessed: 6, cards: [{ q: 'H2O?', a: 'water' }], documents: [] });
    s.tasks.push({ id: 7, text: 'Phone task 2', done: false });
    s.nextId = 8;
  });
  const renumbered = new Map();
  const m = mergeSync(null, local, remote, renumbered);
  assert.deepEqual(texts(m), ['Revise', 'Past paper', 'Phone task', 'Phone task 2', 'Offline task']);
  const chem = m.subjects.find(s => s.name === 'Chemistry'), phys = m.subjects.find(s => s.name === 'Physics');
  assert.equal(chem.id, 6, 'the cloud\'s items keep their ids');
  assert.deepEqual(plain(chem.cards.map(c => c.q)), ['H2O?'], 'nothing of Physics folded into Chemistry');
  assert.ok(phys && phys.id !== 6, 'Physics kept, under a fresh id');
  assert.deepEqual(plain(phys.cards.map(c => c.q)), ['F=?', 'v=?']);
  assert.equal(phys.documents.length, 1);
  assert.notEqual(phys.documents[0].id, 7, 'its note moved off the id the phone\'s task has');
  assert.equal(m.sessions.find(x => x.duration === 600).subjectId, phys.id, 'its session follows it');
  assert.equal(new Set(ids(m)).size, ids(m).length, 'ids stay unique');
  assert.ok(m.nextId > Math.max(...ids(m)));
  assert.equal(renumbered.get(6), phys.id);
  // The same items on both sides (same text / name) are still one item each.
  assert.equal(m.tasks.filter(t => t.text === 'Revise').length, 1);
  assert.equal(m.subjects.filter(s => s.name === 'Biology').length, 1);
});

test('without a base: an item already in the cloud under another id (renumbered by an earlier merge) is not duplicated', () => {
  const local = from(s => { s.tasks.push({ id: 5, text: 'Offline task', done: false }); s.nextId = 6; });
  const remote = from(s => { s.tasks.push({ id: 5, text: 'Phone task', done: false }, { id: 6, text: 'Offline task', done: true }); s.nextId = 7; });
  const m = mergeSync(null, local, remote);
  assert.deepEqual(texts(m), ['Revise', 'Past paper', 'Phone task', 'Offline task✓']);
});

test('rule 2: this device\'s new item that the cloud already has (its write landed unheard) and the other device edited → one item, with that edit', () => {
  const local = from(s => { s.tasks.push({ id: 5, text: 'Laptop task', done: false });
    s.subjects.push({ id: 6, name: 'Physics', desc: '', docs: 0, color: '#0891b2', accessed: 5, cards: [{ q: 'F=?', a: 'ma' }], documents: [] }); s.nextId = 7; });
  const landed = mergeSync(base(), local, base());
  const edited = clone(landed);
  edited.tasks.find(t => t.id === 5).done = true;
  Object.assign(edited.subjects.find(s => s.id === 6).cards[0], { reps: 1, interval: 1, ease: 2.5, dueAt: 9, lapses: 0, lastReviewedAt: 99 });
  const m = mergeSync(base(), local, edited);
  assert.deepEqual(texts(m), ['Revise', 'Past paper', 'Laptop task✓']);
  assert.equal(m.subjects.filter(s => s.name === 'Physics').length, 1);
  assert.equal(m.subjects.find(s => s.name === 'Physics').cards[0].reps, 1);
});

test('rule 2: a new subject with a note, both renumbered by a merge, merged again → still one subject with one note', () => {
  const b = { ...freshState(), userName: 'A', subjects: [{ id: 1, name: 'Bio', desc: '', docs: 0, color: '#7c3aed', accessed: 1, cards: [], documents: [] }], tasks: [], nextId: 2 };
  const local = clone(b);
  local.subjects.push({ id: 2, name: 'Chem', desc: '', docs: 1, color: '#7c3aed', accessed: 0, cards: [], documents: [{ id: 3, name: 'chem note', type: 'note', content: 'x', date: 1 }] });
  local.nextId = 4;
  const remote = clone(b);
  remote.tasks.push({ id: 2, text: 'R1', done: false }, { id: 3, text: 'R2', done: false }); remote.nextId = 4;
  const m1 = mergeSync(b, local, remote);
  const shape = st => plain(st.subjects.map(s => [s.id, s.name, (s.documents || []).map(d => [d.id, d.name])]));
  assert.deepEqual(shape(m1), [[1, 'Bio', []], [4, 'Chem', [[5, 'chem note']]]]);
  const m2 = mergeSync(b, local, m1);
  assert.deepEqual(shape(m2), shape(m1));
  assert.ok(sameData(m2, m1), 'merging the same edits again changes nothing');
});

// One subject usually has a block on several days: two blocks with one title
// are one block only where day, start and end match too (rule 2).
const block = (id, title, day, start, end, color = '#7c3aed') => ({ id, title, day, start, end, color });
const slots = (st) => plain(st.timetable.map(b => `${b.title}@${b.day} ${b.start}-${b.end}`).sort());
test('rule 2: same-title timetable blocks on different days added on both sides → both kept (same id, with and without a base)', () => {
  const b = from(s => { s.timetable = [block(5, 'Maths', 0, '09:00', '10:00')]; s.nextId = 6; });
  const local  = from(s => { s.timetable = [block(5, 'Maths', 0, '09:00', '10:00'), block(6, 'Maths', 2, '14:00', '15:00', '#0891b2')]; s.nextId = 7; });
  const remote = from(s => { s.timetable = [block(5, 'Maths', 0, '09:00', '10:00'), block(6, 'Maths', 4, '11:00', '12:00')]; s.nextId = 7; });
  for (const bb of [b, null]) {
    const renumbered = new Map();
    const m = mergeSync(bb && clone(bb), clone(local), clone(remote), renumbered);
    assert.deepEqual(slots(m), ['Maths@0 09:00-10:00', 'Maths@2 14:00-15:00', 'Maths@4 11:00-12:00'], bb ? 'with a base' : 'without a base');
    assert.equal(m.timetable.find(x => x.day === 4).id, 6, 'the cloud\'s block keeps its id');
    const wed = m.timetable.find(x => x.day === 2);
    assert.ok(wed.id !== 6 && renumbered.get(6) === wed.id, 'this device\'s block moves to a fresh id');
    assert.equal(wed.color, '#0891b2', 'with its own fields');
    assert.equal(new Set(ids(m)).size, ids(m).length, 'ids stay unique');
    assert.ok(sameData(mergeSync(bb && clone(bb), clone(local), clone(m)), m), 'merging again changes nothing');
  }
});

test('rule 2: a same-title block the cloud added under another id is not taken for this device\'s block (twin search)', () => {
  // The cloud used id 4 for a Chemistry block and id 5 for its Maths block;
  // this device's Maths block (another day) also took id 5... or id 4.
  const b = from(s => { s.timetable = []; s.nextId = 4; s.tasks = []; s.subjects = []; s.sessions = []; });
  const remote = from(s => { s.tasks = []; s.subjects = []; s.sessions = []; s.timetable = [block(4, 'Chem', 1, '10:00', '11:00'), block(5, 'Maths', 4, '11:00', '12:00')]; s.nextId = 6; });
  for (const id of [4, 5, 6]) {
    const local = from(s => { s.tasks = []; s.subjects = []; s.sessions = []; s.timetable = [block(id, 'Maths', 2, '14:00', '15:00')]; s.nextId = id + 1; });
    for (const bb of [b, null]) {
      const m = mergeSync(bb && clone(bb), clone(local), clone(remote));
      assert.deepEqual(slots(m), ['Chem@1 10:00-11:00', 'Maths@2 14:00-15:00', 'Maths@4 11:00-12:00'], `id ${id}${bb ? '' : ', no base'}`);
      assert.equal(new Set(ids(m)).size, ids(m).length, 'ids stay unique');
    }
  }
});

test('rule 2: the same block (title, day and times) added on both sides is kept once; a differing colour is the cloud\'s', () => {
  const b = from(s => { s.timetable = []; });
  const local  = from(s => { s.timetable = [block(5, 'Maths', 2, '14:00', '15:00', '#0891b2')]; s.nextId = 6; });
  const remote = from(s => { s.timetable = [block(5, 'Maths', 2, '14:00', '15:00')]; s.nextId = 6; });
  for (const bb of [b, null]) {
    const m = mergeSync(bb && clone(bb), clone(local), clone(remote));
    assert.ok(sameData(m.timetable, [block(5, 'Maths', 2, '14:00', '15:00')]), bb ? 'with a base' : 'without a base');
  }
  // ...and under another id (an earlier merge renumbered it): still once.
  const moved = from(s => { s.tasks.push({ id: 5, text: 'Phone task', done: false }); s.timetable = [block(6, 'Maths', 2, '14:00', '15:00')]; s.nextId = 7; });
  const m = mergeSync(b, local, moved);
  assert.deepEqual(slots(m), ['Maths@2 14:00-15:00']);
  assert.equal(m.timetable[0].id, 6);
});

test('rule 2: a block this device added and the cloud then holds moved to another day (written unheard, moved elsewhere) → both kept, never lost', () => {
  const b = from(s => { s.timetable = []; });
  const local  = from(s => { s.timetable = [block(5, 'Maths', 2, '14:00', '15:00')]; s.nextId = 6; });
  const remote = from(s => { s.timetable = [block(5, 'Maths', 3, '14:00', '15:00')]; s.nextId = 6; });
  const m = mergeSync(b, local, remote);
  assert.deepEqual(slots(m), ['Maths@2 14:00-15:00', 'Maths@3 14:00-15:00']);
  assert.equal(new Set(ids(m)).size, ids(m).length);
});

test('idempotence: merging the same local edits onto the merge again changes nothing (randomised)', () => {
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  let tag = 0;
  const mutate = (st, side) => {
    for (let n = 1 + Math.floor(rnd() * 5); n > 0; n--) {
      const op = pick(['task', 'task', 'tick', 'del', 'subj', 'doc', 'card', 'review', 'block', 'retime', 'goal']);
      if (op === 'task') st.tasks.push({ id: st.nextId++, text: side + 'T' + (++tag), done: false });
      if (op === 'tick' && st.tasks.length) { const t = pick(st.tasks); t.done = !t.done; }
      if (op === 'del' && st.tasks.length) st.tasks.splice(Math.floor(rnd() * st.tasks.length), 1);
      if (op === 'subj') { const s = { id: st.nextId++, name: side + 'S' + (++tag), desc: '', docs: 0, color: '#7c3aed', accessed: 0, cards: [{ q: 'q' + tag, a: 'a' }], documents: [] };
        if (rnd() < 0.5) { s.documents.push({ id: st.nextId++, name: side + 'D' + (++tag), type: 'note', content: 'x', date: tag }); s.docs = 1; }
        st.subjects.push(s); st.sessions.push({ date: new Date(Date.UTC(2026, 10, 3, tag % 20)).toISOString(), duration: 60, subjectId: s.id }); }
      if (op === 'doc') { const s = pick(st.subjects); s.documents = s.documents || []; s.documents.push({ id: st.nextId++, name: side + 'D' + (++tag), type: 'note', content: 'x', date: tag }); s.docs = s.documents.length; }
      if (op === 'card') { const s = pick(st.subjects); s.cards = [...(s.cards || []), { q: side + 'q' + (++tag), a: 'x' }]; }
      if (op === 'review') { const s = pick(st.subjects); if (s.cards?.length) Object.assign(pick(s.cards), { reps: 1, interval: 1, ease: 2.5, dueAt: 5, lapses: 0, lastReviewedAt: 1 + Math.floor(rnd() * 1e6) }); }
      if (op === 'block') st.timetable.push({ id: st.nextId++, title: side + 'B' + (++tag), day: 1, start: '11:00', end: '12:00', color: '#7c3aed' });
      if (op === 'retime' && st.timetable.length) pick(st.timetable).day = Math.floor(rnd() * 7);
      if (op === 'goal') st.dailyGoal = 30 + Math.floor(rnd() * 100);
    }
  };
  for (let i = 0; i < 400; i++) {
    const b = base(); b.timetable = [{ id: 5, title: 'Maths', day: 0, start: '09:00', end: '10:00', color: '#7c3aed' }]; b.nextId = 6;
    const local = clone(b), remote = clone(b);
    mutate(local, 'L'); mutate(remote, 'R');
    for (const bb of [b, null]) {
      const m1 = mergeSync(bb && clone(bb), clone(local), clone(remote));
      const m2 = mergeSync(bb && clone(bb), clone(local), clone(m1));
      assert.ok(sameData(m2, m1), `case ${i}${bb ? '' : ' (no base)'}: merging again changed the result`);
      const I = ids(m1);
      assert.equal(new Set(I).size, I.length, `case ${i}: ids unique`);
      if (!bb) {
        // Without a base nothing is lost: every task, subject and block of either side is there.
        const names = st => [...st.tasks.map(t => 't:' + t.text), ...st.subjects.map(s => 's:' + s.name), ...st.timetable.map(x => 'b:' + x.title)];
        for (const n of [...names(local), ...names(remote)]) assert.ok(names(m1).includes(n), `case ${i}: ${n} lost without a base`);
      }
    }
  }
});

test('mergeSync leaves its inputs untouched', () => {
  const b = base(), l = from(s => { s.tasks.push({ id: 5, text: 'L', done: false }); s.nextId = 6; }), r = from(s => { s.tasks.push({ id: 5, text: 'R', done: false }); s.nextId = 6; });
  const before = JSON.stringify([b, l, r]);
  mergeSync(b, l, r, new Map());
  assert.equal(JSON.stringify([b, l, r]), before);
});

test('the result never carries undefined values (Firestore rejects them)', () => {
  const local  = from(s => { s.tasks[0].note = undefined; s.subjects[0].publicDeckId = 'abc'; });
  const remote = from(s => { s.tasks[0].done = true; delete s.subjects[0].desc; });
  const m = mergeSync(base(), local, remote);
  const walk = (v, p) => { if (v === undefined) assert.fail('undefined at ' + p); if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], p + '.' + k); };
  walk(m, 'state');
  assert.equal(m.subjects[0].desc, undefined, 'a field the cloud removed stays removed');
  assert.equal(m.subjects[0].publicDeckId, 'abc');
});

test('patchInPlace keeps the objects the UI holds while bringing in the new values', () => {
  const S = base();
  const cards = S.subjects[0].cards, card0 = cards[0], task = S.tasks[1];
  const next = from(s => {
    s.subjects[0].cards[0].interval = 7;
    s.subjects[0].cards.push({ q: 'DNA?', a: 'Genes' });
    s.tasks.splice(0, 1);
    s.dailyGoal = 99;
  });
  const out = patchInPlace(S, clone(next));
  assert.equal(out, S);
  assert.ok(sameData(S, next));
  assert.equal(S.subjects[0].cards, cards, 'a subject\'s card list stays the same array');
  assert.equal(S.subjects[0].cards[0], card0, 'an open review session\'s card stays the same object');
  assert.equal(card0.interval, 7);
  assert.equal(S.tasks[0], task);
});

// ── Rule 6: the streak ──────────────────────────────────────────────────────
const day = (n) => new Date(Date.UTC(2026, 10, 1 + n, 9)).toISOString();   // 9:00 UTC on Nov 1 + n
const studied = (s, ...days) => { for (const n of days) s.sessions.push({ date: day(n), duration: 1500, subjectId: 1 }); };
const streakBase = () => from(s => { s.streak = 4; s.bestStreak = 4; s.freezes = 0; });

test('rule 6: a device back after days away (streak reset to 0 in its copy) doesn\'t wipe a streak the other device kept', () => {
  const local  = from(s => { s.streak = 0; s.bestStreak = 4; s.freezes = 0; });           // reconcileStreak() on a stale copy
  const remote = from(s => { s.streak = 7; s.bestStreak = 7; s.freezes = 1; studied(s, 1, 2, 3); });
  const m = mergeSync(streakBase(), local, remote);
  assert.equal(m.streak, 7);
  assert.equal(m.freezes, 1, 'freezes come with the streak');
  assert.equal(m.bestStreak, 7);
  assert.equal(m.sessions.length, 4);
  // The same the other way round (the stale device's copy is the cloud's).
  const back = mergeSync(streakBase(), remote, local);
  assert.equal(back.streak, 7);
});

test('rule 6: changed on one side only → that side, even a reset to 0', () => {
  const m = mergeSync(streakBase(), from(s => { s.streak = 0; s.bestStreak = 4; s.freezes = 0; }), from(s => { s.streak = 4; s.bestStreak = 4; s.freezes = 0; s.dailyGoal = 60; }));
  assert.equal(m.streak, 0, 'nobody studied since: the reset stands');
  assert.equal(m.dailyGoal, 60);
});

test('rule 6: both studied on the same latest day → the longer streak, with its freezes', () => {
  const local  = from(s => { s.streak = 5; s.bestStreak = 5; s.freezes = 1; studied(s, 1); });
  const remote = from(s => { s.streak = 1; s.bestStreak = 4; s.freezes = 0; s.sessions.push({ date: day(1), duration: 600, subjectId: 1 }); });
  const m = mergeSync(streakBase(), local, remote);
  assert.equal(m.streak, 5);
  assert.equal(m.freezes, 1);
  const m2 = mergeSync(streakBase(), remote, local);
  assert.equal(m2.streak, 5, 'the same whichever device merges');
  assert.equal(m2.freezes, 1);
});

test('rule 6: without a base, the side that studied last', () => {
  const local  = from(s => { s.streak = 2; s.freezes = 0; studied(s, 3); });
  const remote = from(s => { s.streak = 6; s.freezes = 2; studied(s, 2); });
  const m = mergeSync(null, local, remote);
  assert.equal(m.streak, 2);
  assert.equal(m.freezes, 0);
});

// ── A write that merged while S moved on (rebaseAfterWrite) ────────────────
test('rebaseAfterWrite: a task added while the write was in flight never shares an id with the renumbered one', () => {
  const sent   = from(s => { s.tasks.push({ id: 5, text: 'MINE', done: false }); s.nextId = 6; });
  const remote = from(s => { s.tasks.push({ id: 5, text: 'THEIRS', done: false }); s.nextId = 6; });
  const renumbered = new Map();
  const written = mergeSync(base(), sent, remote, renumbered);
  assert.deepEqual([...renumbered], [[5, 6]]);
  // In flight: S took the next id, 6 — the very id the merge just gave MINE.
  const live = from(s => { s.tasks.push({ id: 5, text: 'MINE', done: false }, { id: 6, text: 'MINE2', done: false }); s.nextId = 7; });
  const before = JSON.stringify([sent, live, written]);
  const { state, ids: moved } = rebaseAfterWrite(sent, live, written, renumbered);
  assert.equal(JSON.stringify([sent, live, written]), before, 'pure');
  assert.deepEqual(texts(state), ['Revise', 'Past paper', 'THEIRS', 'MINE', 'MINE2']);
  assert.equal(new Set(ids(state)).size, ids(state).length, 'ids unique: ' + JSON.stringify(ids(state)));
  assert.ok(state.nextId > Math.max(...ids(state)));
  const id = (t) => state.tasks.find(x => x.text === t).id;
  assert.equal(id('THEIRS'), 5);
  assert.equal(id('MINE'), 6);
  assert.deepEqual(plain([...moved].sort((a, b) => a[0] - b[0])), [[5, 6], [6, id('MINE2')]]);
  // Applied to S the way applyToS does it: S matches, item for item.
  const S = clone(live), mine2 = S.tasks[3];
  renumberInPlace(S, moved);
  patchInPlace(S, clone(state));
  assert.ok(sameData(S, state));
  assert.equal(S.tasks.find(t => t.text === 'MINE2'), mine2, 'the same object, renumbered');
  // Deleting MINE2 (deleteTask filters by id) leaves MINE alone.
  assert.deepEqual(texts({ tasks: S.tasks.filter(t => t.id !== mine2.id) }), ['Revise', 'Past paper', 'THEIRS', 'MINE']);
});

test('rebaseAfterWrite: an addition in flight that took an id now in the cloud moves; edits and deletes in flight are kept', () => {
  const sent    = from(s => { s.dailyGoal = 45; });
  const remote  = from(s => { s.tasks.push({ id: 5, text: 'THEIRS', done: false }); s.nextId = 6; s.focusDuration = 3000; });
  const renumbered = new Map();
  const written = mergeSync(base(), sent, remote, renumbered);
  assert.equal(renumbered.size, 0);
  const live = from(s => { s.dailyGoal = 45; s.tasks[0].done = true; s.tasks.splice(1, 1); s.tasks.push({ id: 5, text: 'MINE2', done: false }); s.nextId = 6; });
  const { state, ids: moved } = rebaseAfterWrite(sent, live, written, renumbered);
  assert.deepEqual(texts(state), ['Revise✓', 'THEIRS', 'MINE2']);
  assert.equal(state.tasks.find(t => t.text === 'THEIRS').id, 5);
  assert.deepEqual(plain([...moved]), [[5, state.tasks.find(t => t.text === 'MINE2').id]]);
  assert.equal(new Set(ids(state)).size, ids(state).length);
  assert.equal(state.dailyGoal, 45);
  assert.equal(state.focusDuration, 3000, 'the other device\'s change is kept');
});

test('rebaseAfterWrite: nothing added in flight → no ids change beyond the merge\'s own', () => {
  const sent   = from(s => { s.tasks.push({ id: 5, text: 'MINE', done: false }); s.nextId = 6; });
  const remote = from(s => { s.tasks.push({ id: 5, text: 'THEIRS', done: false }); s.nextId = 6; });
  const renumbered = new Map();
  const written = mergeSync(base(), sent, remote, renumbered);
  const { state, ids: moved } = rebaseAfterWrite(sent, clone(sent), written, renumbered);
  assert.ok(sameData(state, written));
  assert.deepEqual(plain([...moved]), [[5, 6]]);
});

// ── repairIds ───────────────────────────────────────────────────────────────
test('repairIds: of two items with one id the first keeps it, the other gets a fresh one; nextId above all', () => {
  const st = from(s => {
    s.tasks.push({ id: 3, text: 'Dup task', done: false });                                  // task 3 twice
    s.subjects[0].documents.push({ id: 4, name: 'Dup doc', type: 'note', content: '', date: 2 });   // a document on task 4's id
    s.milestones = [{ id: 1, text: 'On the subject\'s id', done: false }];
  });
  assert.equal(repairIds(st), true);
  assert.equal(new Set(ids(st)).size, ids(st).length, JSON.stringify(ids(st)));
  assert.equal(st.tasks[0].id, 3, 'the first holder keeps its id');
  assert.equal(st.tasks[1].id, 4, 'a task comes before a document');
  assert.equal(st.subjects[0].id, 1, 'a subject comes first (sessions point at it)');
  assert.equal(st.sessions[0].subjectId, 1);
  assert.ok(st.nextId > Math.max(...ids(st)));
  const again = clone(st);
  assert.equal(repairIds(st), false, 'nothing left to repair');
  assert.ok(sameData(st, again));
});

test('repairIds: a clean state is left alone; a nextId at or below an id in use is raised', () => {
  const st = base();
  assert.equal(repairIds(st), false);
  assert.ok(sameData(st, base()));
  const low = from(s => { s.nextId = 2; });
  assert.equal(repairIds(low), true);
  assert.equal(low.nextId, 5);
});
