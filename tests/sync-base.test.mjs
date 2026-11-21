// Tests for the base a device's unsynced edits are merged against
// (AUDIT-2026-10-17.md, P0-3). A merge reads every item that is in the base but
// not in the device's copy as deleted on this device, so a base must only ever
// be used with the exact copy it was stored with: paired with an older copy, or
// with none at all (Settings → Clear local cache), it would delete everything
// added in between — or the whole account.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runInContext } from 'node:vm';
import { loadBundle, plain } from './_bundle.mjs';

const ctx = loadBundle();
const { freshState, mergeSync, wcHash, storeWorkingCopyFor, storedBase, markSynced, keepUnsynced, readKeptBase,
  readKept, dropKept, vacateWorkingCopy, othersUnsent, leftUnsent, liveItem, renumberInPlace, writeStallMs,
  notePending, cloudVersionOf, landedIn } = ctx;
const ls = ctx.localStorage;
const KEY = 'brainfy_v3', META = 'brainfy_sync_meta', BASE = 'brainfy_sync_base';
const json = k => JSON.parse(ls.getItem(k));
const clone = x => JSON.parse(JSON.stringify(x));

// The cloud copy the device's edits are built on.
const cloud = () => ({
  ...freshState(), userName: 'Ada',
  subjects: [{ id: 1, name: 'Biology', desc: '', docs: 0, color: '#7c3aed', accessed: 1, cards: [{ q: 'Q', a: 'A' }] }],
  tasks: [{ id: 2, text: 'ORIG', done: false }, { id: 3, text: 'KEEP-ME', done: false }],
  nextId: 4,
});
const version = (state, rev = 3) => ({ rev, at: '2026-11-01T10:00:00.000Z', tok: rev + '|2026-11-01T10:00:00.000Z', state });
const withTask = (st, text, id) => { const s = clone(st); s.tasks.push({ id, text, done: false }); s.nextId = id + 1; return s; };
const texts = st => plain(st.tasks.map(t => t.text + (t.done ? '✓' : '')));
const setMine = v => runInContext(`_wcMine = ${JSON.stringify(v)};`, ctx);

test('wcHash tells copies apart', () => {
  const a = JSON.stringify(cloud()), b = JSON.stringify(withTask(cloud(), 'X', 4));
  assert.equal(wcHash(a), wcHash(a));
  assert.notEqual(wcHash(a), wcHash(b));
  assert.notEqual(wcHash('ab'), wcHash('ba'));
});

test('a dirty copy is stored with its base, and that base is read back only for that copy', () => {
  ls.clear();
  const base = version(cloud());
  const edited = withTask(cloud(), 'NEW', 4);
  assert.equal(storeWorkingCopyFor('uid_a', JSON.stringify(edited), true, base, undefined), true);
  const m = json(META);
  assert.equal(m.dirty, true);
  assert.equal(m.base, base.tok);
  assert.equal(m.wc, wcHash(ls.getItem(KEY)));
  assert.equal(json(BASE).tok, base.tok);
  const b = storedBase('uid_a');
  assert.equal(b.tok, base.tok);
  assert.equal(b.rev, 3);
  assert.deepEqual(texts(b.state), ['ORIG', 'KEEP-ME']);
  assert.equal(storedBase('uid_b'), null, 'never another account\'s');
});

test('no working copy (Settings → Clear local cache): no base — the cloud is not emptied', () => {
  ls.clear();
  storeWorkingCopyFor('uid_a', JSON.stringify(withTask(cloud(), 'UNSENT', 4)), true, version(cloud()), undefined);
  ls.removeItem(KEY);                         // what Clear local cache used to do: copy gone, marker + base left
  assert.equal(storedBase('uid_a'), null);
  // With no base the merge deletes nothing: the account keeps everything.
  const m = mergeSync(null, freshState(), cloud());
  assert.deepEqual(texts(m), ['ORIG', 'KEEP-ME']);
  assert.equal(m.subjects.length, 1);
  // (What a base against an empty copy would have done: wiped the account.)
  assert.equal(mergeSync(cloud(), freshState(), cloud()).tasks.length, 0);
});

test('Clear local cache now removes the copy, its marker and its base', () => {
  ls.clear();
  storeWorkingCopyFor('uid_a', JSON.stringify(withTask(cloud(), 'UNSENT', 4)), true, version(cloud()), undefined);
  vacateWorkingCopy('uid_a');
  assert.equal(ls.getItem(KEY), null);
  assert.equal(ls.getItem(META), null);
  assert.equal(ls.getItem(BASE), null);
});

test('a copy that is not the one the base was stored with gets no base', () => {
  ls.clear();
  storeWorkingCopyFor('uid_a', JSON.stringify(withTask(cloud(), 'A', 4)), true, version(cloud()), undefined);
  ls.setItem(KEY, JSON.stringify(withTask(cloud(), 'B', 4)));   // written without its marker (older app version, a crash between the two)
  assert.equal(storedBase('uid_a'), null);
  const m = json(META); delete m.wc; ls.setItem(META, JSON.stringify(m));
  ls.setItem(KEY, JSON.stringify(withTask(cloud(), 'A', 4)));
  assert.equal(storedBase('uid_a'), null, 'a marker that names no copy pairs with none');
});

test('a copy that could not be stored keeps the old copy paired with its old base', () => {
  ls.clear();
  const b1 = version(cloud(), 3);
  const old = withTask(cloud(), 'OLD-EDIT', 4);
  storeWorkingCopyFor('uid_a', JSON.stringify(old), true, b1, undefined);
  // The cloud moved on (another device added ELSEWHERE) and S merged it; then
  // storing the copy fails (quota) — but the base would fit.
  const b2 = version(withTask(cloud(), 'ELSEWHERE', 5), 4);
  const orig = ls.setItem;
  ls.setItem = function (k, v) { if (k === KEY) throw new Error('QuotaExceededError'); return orig.call(this, k, v); };
  try {
    assert.equal(storeWorkingCopyFor('uid_a', JSON.stringify(withTask(b2.state, 'OLD-EDIT', 6)), true, b2, undefined), false);
  } finally { ls.setItem = orig; }
  const b = storedBase('uid_a');
  assert.equal(b.tok, b1.tok, 'the old copy stays paired with the base it was built on');
  assert.equal(json(META).dirty, true);
  // So a later merge of the old copy keeps what the other device added.
  const m = mergeSync(b.state, old, b2.state);
  assert.deepEqual(texts(m), ['ORIG', 'KEEP-ME', 'ELSEWHERE', 'OLD-EDIT']);
});

test('a write being committed is noted with the exact copy it sends, and only while that copy is stored', () => {
  ls.clear();
  const copy = JSON.stringify(withTask(cloud(), 'SENDING', 4));
  storeWorkingCopyFor('uid_a', copy, true, version(cloud()), undefined);
  notePending('uid_a', '4|2026-11-02T00:00:00.000Z', wcHash(JSON.stringify(withTask(cloud(), 'OTHER', 4))));
  assert.equal(json(META).pend, undefined, 'a write of another copy is not noted');
  notePending('uid_b', '4|2026-11-02T00:00:00.000Z', wcHash(copy));
  assert.equal(json(META).pend, undefined, 'nor another account\'s');
  notePending('uid_a', '4|2026-11-02T00:00:00.000Z', wcHash(copy));
  assert.deepEqual(json(META).pend, { tok: '4|2026-11-02T00:00:00.000Z', wc: wcHash(copy) });
  storeWorkingCopyFor('uid_a', copy, true, version(cloud()), undefined);   // the same copy stored again (the tab closing)
  assert.equal(json(META).pend.tok, '4|2026-11-02T00:00:00.000Z', 'kept while the copy is the one sent');
  storeWorkingCopyFor('uid_a', JSON.stringify(withTask(cloud(), 'MORE', 4)), true, version(cloud()), undefined);
  assert.equal(json(META).pend, undefined, 'an edit since: the copy holds more than that write');
  storeWorkingCopyFor('uid_a', copy, true, version(cloud()), undefined);
  notePending('uid_a', '5|2026-11-02T00:00:01.000Z', wcHash(copy));
  markSynced('uid_a', '2026-11-02T00:00:01.000Z');
  assert.equal(json(META).pend, undefined, 'confirmed: nothing pending');
  ls.clear();
});

test('a version holds a write if it is that write or one written on top of it', () => {
  const v = cloudVersionOf({ state: cloud(), rev: 7, updatedAt: 'b', writes: ['5|a', '6|x', '7|b', 9] });
  assert.deepEqual(plain(v.writes), ['5|a', '6|x', '7|b'], 'only tokens are kept');
  assert.ok(landedIn(v, { tok: '7|b' }));
  assert.ok(landedIn(v, { tok: '5|a' }));
  assert.ok(!landedIn(v, { tok: '6|y' }));
  assert.ok(!landedIn(cloudVersionOf({ state: cloud(), updatedAt: 'z' }), { tok: '6|x' }), 'a document written before the log: nothing');
});

test('two writers committing the same rev in the same millisecond get different tokens, and each version is told by its own', () => {
  const stamp = '2026-11-20T12:00:00.000Z';
  for (const withCrypto of [false, true]) {
    ctx.crypto = withCrypto ? globalThis.crypto : undefined;
    const a = ctx.writeToken(5, stamp), b = ctx.writeToken(5, stamp);
    assert.notEqual(a, b, withCrypto ? 'crypto' : 'Math.random fallback');
    assert.ok(a.startsWith('5|' + stamp + '|') && a.length > ('5|' + stamp + '|').length);
  }
  delete ctx.crypto;
  const a = ctx.writeToken(5, stamp), b = ctx.writeToken(5, stamp);
  // The version tab B's commit made carries B's token — not A's, though A
  // tried to commit the same rev at the same time (A's attempt lost the race).
  const vb = cloudVersionOf({ state: cloud(), rev: 5, updatedAt: stamp, writes: ['4|x|n', b] });
  assert.equal(vb.tok, b);
  assert.ok(!landedIn(vb, { tok: a }), 'A does not take B\'s version for its own write');
  assert.ok(landedIn(vb, { tok: b }));
  // A writer that keeps no log (an app version from before revisions) wrote
  // over it: the log's last token is not this version's.
  const legacy = cloudVersionOf({ state: cloud(), updatedAt: '2026-11-20T12:00:05.000Z', writes: ['4|x|n', b] });
  assert.equal(legacy.tok, '0|2026-11-20T12:00:05.000Z');
  assert.equal(cloudVersionOf({ state: cloud(), rev: 3, updatedAt: 'q' }).tok, '3|q', 'no log: rev and time');
  // A stored base's token reads back as its rev and time.
  const v = ctx.versionOf(b, cloud());
  assert.equal(v.rev, 5);
  assert.equal(v.at, stamp);
  assert.equal(ctx.versionOf('7|' + stamp, cloud()).at, stamp, 'an older two-part token');
});

test('unconfirmed writes: every one is kept until a version settles it — the newest it holds and all older ones, or those whose rev it reached', () => {
  // W1 (rev 4) was given up and is still on its way; W2, sent after it on the
  // same version 3, went unconfirmed too.
  const sent = (text) => withTask(cloud(), text, 4);
  const w1 = { tok: '4|t1', rev: 4, sent: sent('SLOW'), renumbered: new Map() };
  const w2 = { tok: '4|t2', rev: 4, sent: cloud(), renumbered: new Map() };
  const set = (ws) => { ctx.__ws = ws; runInContext('_lostWrites = __ws.slice();', ctx); };
  const left = () => plain(runInContext('_lostWrites.map(w => w.tok)', ctx));
  const v1 = { ...version(withTask(cloud(), 'SLOW', 4), 4), tok: '4|t1', writes: ['4|t1'] };
  set([w1, w2]);
  // W1's version arrives: it is W1 (not the other write, nor another device's)...
  assert.equal(ctx.lostWriteIn(v1), w1);
  ctx.settleLostWrites(v1, w1);
  // ...and W2, which read version 3, can't land on it any more.
  assert.deepEqual(left(), []);
  // A version on top of W2 holds W2: the newest held wins, W1 goes with it.
  set([w1, w2]);
  const v2 = { ...version(cloud(), 5), writes: ['4|t2', '5|x'] };
  assert.equal(ctx.lostWriteIn(v2), w2);
  ctx.settleLostWrites(v2, w2);
  assert.deepEqual(left(), []);
  // An older version (rev 3, holding neither) settles nothing.
  set([w1, w2]);
  const v0 = { ...version(cloud(), 3), writes: ['3|y'] };
  assert.equal(ctx.lostWriteIn(v0), null);
  ctx.settleLostWrites(v0, null);
  assert.deepEqual(left(), ['4|t1', '4|t2']);
  // A later write of this tab's (rev 5, on W1's version) is kept while only W1's version is known.
  const w3 = { tok: '5|t3', rev: 5, sent: cloud(), renumbered: new Map() };
  set([w1, w3]);
  ctx.settleLostWrites(v1, w1);
  assert.deepEqual(left(), ['5|t3']);
  runInContext('_lostWrites = [];', ctx);
});

test('a confirmed copy is its own base: the stored base goes', () => {
  ls.clear();
  storeWorkingCopyFor('uid_a', JSON.stringify(withTask(cloud(), 'X', 4)), true, version(cloud()), undefined);
  assert.ok(ls.getItem(BASE));
  markSynced('uid_a', '2026-11-02T00:00:00.000Z');
  assert.equal(ls.getItem(BASE), null);
  assert.equal(json(META).dirty, false);
  assert.equal(json(META).base, '');
  assert.equal(storedBase('uid_a'), null);
  // ...and storing a clean copy never writes one.
  storeWorkingCopyFor('uid_a', JSON.stringify(cloud()), false, version(cloud()), undefined);
  assert.equal(ls.getItem(BASE), null);
});

test('the stored base is rewritten only when it changes', () => {
  ls.clear();
  const b = version(cloud());
  storeWorkingCopyFor('uid_a', JSON.stringify(withTask(cloud(), 'X', 4)), true, b, undefined);
  let writes = 0;
  const orig = ls.setItem;
  ls.setItem = function (k, v) { if (k === BASE) writes++; return orig.call(this, k, v); };
  try {
    storeWorkingCopyFor('uid_a', JSON.stringify(withTask(cloud(), 'Y', 4)), true, b, undefined);
    assert.equal(writes, 0);
    storeWorkingCopyFor('uid_a', JSON.stringify(withTask(cloud(), 'Y', 4)), true, version(cloud(), 9), undefined);
    assert.equal(writes, 1);
  } finally { ls.setItem = orig; }
  assert.ok(storedBase('uid_a'));
});

test('another tab\'s unsent copy: told apart from this tab\'s, merged in only once that tab has left', () => {
  ls.clear();
  storeWorkingCopyFor('uid_a', JSON.stringify(cloud()), false, null, undefined);   // this tab's copy (sets _wcMine)
  assert.equal(othersUnsent('uid_a'), false);
  // Another tab stores edits over it.
  const mine = runInContext('_wcMine', ctx);
  storeWorkingCopyFor('uid_a', JSON.stringify(withTask(cloud(), 'TAB2', 4)), true, version(cloud()), undefined);
  setMine(mine);                                // (back in this tab)
  assert.equal(othersUnsent('uid_a'), true);
  assert.equal(leftUnsent('uid_a'), false, 'that tab is still open: it sends its own edits');
  ls.setItem(META, JSON.stringify({ ...json(META), left: true }));
  assert.equal(leftUnsent('uid_a'), true);
  setMine(json(META).wc);
  assert.equal(othersUnsent('uid_a'), false, 'once merged in, it is this tab\'s too');
  runInContext('_wcMine = null;', ctx);
});

test('kept edits keep their base: a tick and a rename sync, not just additions', () => {
  ls.clear();
  const base = version(cloud());
  const kept = clone(cloud());
  kept.tasks[0].done = true;                       // tick ORIG
  kept.subjects[0].name = 'Biology (renamed)';
  kept.tasks.push({ id: 4, text: 'KEPT-NEW', done: false }); kept.nextId = 5;
  keepUnsynced('uid_a', kept, base);
  const kb = readKeptBase('uid_a');
  assert.equal(kb.tok, base.tok);
  // Meanwhile another device added a task.
  const now = withTask(cloud(), 'PHONE', 4);
  const m = mergeSync(kb.state, readKept('uid_a'), now);
  assert.deepEqual(texts(m).sort(), ['KEEP-ME', 'KEPT-NEW', 'ORIG✓', 'PHONE'].sort());
  assert.equal(m.subjects[0].name, 'Biology (renamed)');
  assert.equal(new Set(m.tasks.map(t => t.id)).size, m.tasks.length);
  // Without the base those edits lost to the cloud's fields.
  const nb = mergeSync(null, readKept('uid_a'), now);
  assert.equal(nb.subjects[0].name, 'Biology');
  dropKept('uid_a');
  assert.equal(readKeptBase('uid_a'), null);
  assert.equal(ls.getItem('brainfy_unsynced_base:uid_a'), null);
});

test('two tabs keep their edits on the same base: both kept, with that base (a tick and a rename too)', () => {
  ls.clear();
  // Tab 2 keeps the working copy tab 1 stored; then tab 1 keeps its own S,
  // which has one more edit. Both are built on the version both tabs read.
  const base = version(cloud());
  const stored = clone(cloud());
  stored.tasks[0].done = true; stored.subjects[0].name = 'Biology (renamed)';
  stored.tasks.push({ id: 4, text: 'KEPT-NEW', done: false }); stored.nextId = 5;
  keepUnsynced('uid_a', stored, base);
  const s1 = withTask(stored, 'TAB1-LATER', 5);
  keepUnsynced('uid_a', s1, base);
  const kb = readKeptBase('uid_a');
  assert.ok(kb, 'the merged copy keeps its base');
  assert.equal(kb.tok, base.tok);
  assert.deepEqual(texts(readKept('uid_a')), ['ORIG✓', 'KEEP-ME', 'KEPT-NEW', 'TAB1-LATER']);
  // The next sign-in merges it like any unsynced edits: the phone's task took id 4 too.
  const m = mergeSync(kb.state, readKept('uid_a'), withTask(cloud(), 'PHONE-TASK', 4));
  assert.deepEqual(texts(m), ['ORIG✓', 'KEEP-ME', 'PHONE-TASK', 'KEPT-NEW', 'TAB1-LATER']);
  assert.equal(m.subjects[0].name, 'Biology (renamed)');
  assert.equal(new Set(m.tasks.map(t => t.id)).size, m.tasks.length);
  ls.clear();
});

test('two kept copies on different versions: the older one\'s edits move onto the newer version, its base', () => {
  ls.clear();
  const v3 = version(cloud(), 3);
  const v4state = withTask(cloud(), 'PHONE', 4);            // a write between the two tabs' bases
  const v4 = version(v4state, 4);
  const older = clone(cloud()); older.tasks[1].done = true;  // tick KEEP-ME, on v3
  keepUnsynced('uid_a', older, v3);
  const newer = withTask(v4state, 'NEWER', 5);               // on v4
  keepUnsynced('uid_a', newer, v4);
  assert.equal(readKeptBase('uid_a').tok, v4.tok);
  assert.deepEqual(texts(readKept('uid_a')), ['ORIG', 'KEEP-ME✓', 'PHONE', 'NEWER']);
  // ...and the other way round: the newer copy kept first.
  ls.clear();
  keepUnsynced('uid_a', newer, v4);
  keepUnsynced('uid_a', older, v3);
  assert.equal(readKeptBase('uid_a').tok, v4.tok);
  assert.deepEqual(texts(readKept('uid_a')), ['ORIG', 'KEEP-ME✓', 'PHONE', 'NEWER']);
  ls.clear();
});

test('kept edits merged with earlier kept edits of unknown base: no base, nothing lost', () => {
  ls.clear();
  keepUnsynced('uid_a', withTask(cloud(), 'FIRST', 4), null);
  keepUnsynced('uid_a', withTask(cloud(), 'SECOND', 4), version(cloud()));
  assert.equal(readKeptBase('uid_a'), null);
  assert.deepEqual(texts(readKept('uid_a')).sort(), ['FIRST', 'KEEP-ME', 'ORIG', 'SECOND']);
  assert.equal(new Set(readKept('uid_a').tasks.map(t => t.id)).size, 4, 'FIRST and SECOND both took id 4: one moved');
  // A kept copy changed afterwards is not the one its base was kept with.
  ls.clear();
  keepUnsynced('uid_a', withTask(cloud(), 'FIRST', 4), version(cloud()));
  ls.setItem('brainfy_unsynced:uid_a', JSON.stringify(withTask(cloud(), 'OTHER', 4)));
  assert.equal(readKeptBase('uid_a'), null);
  ls.clear();
});

test('liveItem finds an item picked before an await, whatever its id is now', () => {
  runInContext(`S = freshState();
    S.subjects.push({ id: 4, name: 'PHYS', desc: '', docs: 0, color: '#7c3aed', accessed: 1 });
    S.nextId = 5;`, ctx);
  const S = () => runInContext('S', ctx);
  const moves = runInContext('_idMoves', ctx);
  const phys = S().subjects[0];
  // No id moved: found by identity, or by id if S was replaced.
  assert.equal(liveItem(S().subjects, phys, 4, moves), phys);
  assert.equal(liveItem(S().subjects, undefined, 4, moves), phys);
  // A merge moves PHYS to 5, and the other device's CHEM takes 4.
  renumberInPlace(S(), new Map([[4, 5]]));
  runInContext(`_idMoves++; S.subjects.unshift({ id: 4, name: 'CHEM', desc: '', docs: 0, color: '#7c3aed', accessed: 1 });`, ctx);
  assert.equal(liveItem(S().subjects, phys, 4, moves).name, 'PHYS');
  assert.equal(liveItem(S().subjects, phys, 4, moves).id, 5);
  // Gone, after ids moved: nothing — never the item that now has its old id.
  runInContext(`S.subjects = S.subjects.filter(s => s.name !== 'PHYS');`, ctx);
  assert.equal(liveItem(S().subjects, phys, 4, moves), null);
  assert.equal(liveItem(S().subjects, undefined, 4, moves), null);
  runInContext('S = freshState();', ctx);
});

test('a write unanswered for writeStallMs is given up: 10 s, plus 1 s per 25 KB it carries', () => {
  assert.equal(writeStallMs(cloud()), 11000);
  const big = cloud();
  big.subjects[0].cards = Array.from({ length: 9000 }, (_, i) => ({ q: 'Question number ' + i + ' ' + 'x'.repeat(60), a: 'Answer ' + i }));
  const chars = JSON.stringify(big).length;
  assert.ok(chars > 800000 && chars < 1000000, String(chars));
  assert.equal(writeStallMs(big), 10000 + Math.ceil(chars / 25000) * 1000);
  assert.ok(writeStallMs(big) >= 42000, 'a near-limit document gets well over half a minute on a slow link');
});
