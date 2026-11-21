// Where the stale-tab fix (AUDIT-2026-10-17.md, P0-3: transactions, revisions,
// three-way merges) meets the large-document fix (P0-5: the size guard, AI
// import originals in Firebase Storage) and the sign-out fix (P0-4: whose copy
// the working slot holds). Each test pins one rule the combination must keep.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runInContext } from 'node:vm';
import { loadBundle, plain } from './_bundle.mjs';

const ctx = loadBundle();
const { mergeSync, mergeStates, freshState, userDocBytes, keepUnsynced, readKeptBase, readKept, storeWorkingCopyFor } = ctx;
const MAX = runInContext('SYNC_DOC_MAX', ctx);
const ls = ctx.localStorage;
const KEY = 'brainfy_v3', META = 'brainfy_sync_meta';
const clone = x => JSON.parse(JSON.stringify(x));

ctx.__toasts = [];
runInContext('showToast = function (m, t) { __toasts.push([m, t]); }', ctx);
const toasts = () => ctx.__toasts.splice(0);
const epoch = () => runInContext('_sessionEpoch', ctx);

// An account whose AI import kept its original inline (as before P0-5).
const INLINE = 'data:application/pdf;base64,' + 'QUJD'.repeat(50);
const pdf = (extra = {}) => ({ id: 2, name: 'chapter.pdf', type: 'file', mime: 'application/pdf', size: 150, date: 1700000000000,
  content: INLINE, aiText: 'the text', ...extra });
const stored = { content: '', storagePath: 'users/u/docs/1/1-chapter.pdf', downloadURL: 'https://storage.example/chapter.pdf' };
const acct = (doc = pdf(), extra = {}) => ({
  ...freshState(), userName: 'Ada',
  subjects: [{ id: 1, name: 'Biology', desc: '', docs: 1, color: '#7c3aed', accessed: 1, cards: [{ q: 'Q', a: 'A' }], documents: [doc] }],
  tasks: [{ id: 3, text: 'Revise', done: false }], nextId: 4, ...extra,
});
const docOf = st => clone(st.subjects[0].documents[0]);

// ── Storage originals survive merges ─────────────────────────────────────────
test('a merge keeps an original this device moved to Storage, while the cloud still has it inline', () => {
  const base = acct(), local = acct(pdf(stored));
  const remote = acct(pdf(), { tasks: [{ id: 3, text: 'Revise', done: true }] });   // the phone ticked a task
  const m = mergeSync(base, local, remote);
  const d = docOf(m);
  assert.equal(d.storagePath, stored.storagePath);
  assert.equal(d.downloadURL, stored.downloadURL);
  assert.equal(d.content, '', 'the inline copy does not come back');
  assert.equal(d.aiText, 'the text');
  assert.equal(m.tasks[0].done, true, 'the other device\'s edit still comes through');
});

test('a merge takes in an original another device moved to Storage', () => {
  const base = acct(), remote = acct(pdf(stored));
  const local = acct(pdf(), { tasks: [{ id: 3, text: 'Revise', done: true }] });
  const d = docOf(mergeSync(base, local, remote));
  assert.equal(d.storagePath, stored.storagePath);
  assert.equal(d.downloadURL, stored.downloadURL);
  assert.equal(d.content, '');
});

test('without a base, a stored original wins over an inline copy on either side', () => {
  for (const [local, remote] of [[acct(pdf(stored)), acct()], [acct(), acct(pdf(stored))]]) {
    const d = docOf(mergeSync(null, local, remote));
    assert.equal(d.storagePath, stored.storagePath);
    assert.equal(d.downloadURL, stored.downloadURL);
    assert.equal(d.content, '', 'no inline data resurrected next to the stored file');
  }
});

test('both sides moved it: one stored file, its path and URL from the same side', () => {
  const other = { content: '', storagePath: 'users/u/docs/1/2-chapter.pdf', downloadURL: 'https://storage.example/other.pdf' };
  for (const b of [acct(), null]) {
    const d = docOf(mergeSync(b, acct(pdf(stored)), acct(pdf(other))));
    const pair = [d.storagePath, d.downloadURL];
    assert.ok(sameArr(pair, [stored.storagePath, stored.downloadURL]) || sameArr(pair, [other.storagePath, other.downloadURL]), JSON.stringify(pair));
    assert.equal(d.content, '');
  }
});
const sameArr = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

test('an AI-import entry still waiting for its original stays waiting through a merge', () => {
  const waiting = { id: 5, name: 'new.pdf', type: 'file', mime: 'application/pdf', size: 9, date: 1700000005000, content: '', aiText: 't' };
  const base = acct(), local = acct(pdf(), {}), remote = acct(pdf(), { tasks: [{ id: 3, text: 'Revise', done: true }] });
  local.subjects[0].documents.push(waiting); local.nextId = 6;
  const m = mergeSync(base, local, remote);
  const d = clone(m.subjects[0].documents.find(x => x.name === 'new.pdf'));
  assert.equal(d.content, '');
  assert.equal(d.storagePath, undefined);
  ctx.__st = m;
  runInContext('S = __st', ctx);
  assert.ok(ctx.entryAwaitingOriginal(ctx.originalKey(waiting)), 'attachOriginal still finds it');
  runInContext('S = freshState()', ctx);
});

test('mergeStates (local copies) keeps the stored original of the same document', () => {
  const m = mergeStates(acct(), acct(pdf(stored)));
  assert.equal(m.subjects[0].documents.length, 1);
  const d = docOf(m);
  assert.equal(d.storagePath, stored.storagePath);
  assert.equal(d.downloadURL, stored.downloadURL);
  assert.equal(d.content, '');
  // ...and never trades a stored original for an inline one.
  assert.equal(docOf(mergeStates(acct(pdf(stored)), acct())).storagePath, stored.storagePath);
});

// An app version from before P0-5 (possible until the new rules are published)
// writes its whole copy, the original still inline, over the cloud's.
test('an old app version writing an original back inline does not undo its move to Storage: merged', () => {
  const base = acct(pdf(stored));
  const local = acct(pdf(stored), { tasks: [{ id: 3, text: 'Revise', done: true }] });   // ticked here
  const remote = acct(pdf());                                                             // the old version's copy
  const m = mergeSync(base, local, remote);
  const d = docOf(m);
  assert.equal(d.storagePath, stored.storagePath);
  assert.equal(d.downloadURL, stored.downloadURL);
  assert.equal(d.content, '', 'the inline copy does not come back');
  assert.equal(m.tasks[0].done, true);
  // ...nor with this device's copy the one left inline (a copy kept from before the move).
  const d2 = docOf(mergeSync(base, acct(pdf()), acct(pdf(stored), { userName: 'Ada L.' })));
  assert.equal(d2.storagePath, stored.storagePath);
  assert.equal(d2.content, '');
  // Its other fields still merge as usual.
  const d3 = docOf(mergeSync(base, acct(pdf(stored)), acct(pdf({ aiText: 'new text' }))));
  assert.equal(d3.aiText, 'new text');
  assert.equal(d3.storagePath, stored.storagePath);
  // Stored in the base only: neither side has the file any more (deleted with
  // the document on one, say, and brought back inline by the other): the
  // inline copy is the only one left, and stays.
  const d4 = docOf(mergeSync(base, acct(pdf(), { tasks: [] }), acct(pdf({ aiText: 'old' }))));
  assert.equal(d4.storagePath, undefined);
  assert.equal(d4.content, INLINE);
});
test('...and taken in whole by a tab with nothing unsynced: the stored original stays, and the corrected copy is written back', async () => {
  reset();
  const mine = acct(pdf(stored));
  const old = { state: acct(pdf(), { tasks: [{ id: 3, text: 'Revise', done: true }] }), updatedAt: '2026-11-20T11:00:00.000Z' };   // no rev: an old version
  const w = cloudWorld(old);
  signedIn(clone(mine), { rev: 4, at: AT, tok: TOK, state: clone(mine) });
  try {
    ctx.onCloudSnapshot({ exists: true, data: () => clone(old), metadata: { fromCache: false, hasPendingWrites: false } }, 'u', epoch());
    const d = clone(runInContext('S.subjects[0].documents[0]', ctx));
    assert.equal(d.storagePath, stored.storagePath);
    assert.equal(d.content, '');
    assert.equal(runInContext('S.tasks[0].done', ctx), true, 'the rest of that version is taken in');
    await sleep(600);
    assert.equal(w.set.length, 1, 'the corrected copy is written back');
    assert.equal(w.cloud.state.subjects[0].documents[0].storagePath, stored.storagePath);
    assert.equal(w.cloud.state.subjects[0].documents[0].content, '');
    assert.equal(w.cloud.state.tasks[0].done, true);
    // A version with that document's original still in Storage is taken in as it is.
    const same = acct(pdf(stored));
    assert.equal(ctx.keepStoredOriginals(mine, same), same, 'nothing to take back: the same object');
    // A different document under that id (another date) is not given this one's file.
    const other = acct(pdf({ date: 1700000099999 }));
    assert.equal(docOf(ctx.keepStoredOriginals(mine, other)).content, INLINE);
  } finally { endWorld(); }
});

// ── The size guard in the transaction path ──────────────────────────────────
const note = (id, chars) => ({ id, name: 'n' + id, type: 'note', content: 'x'.repeat(chars), date: id });
const bio = docs => ({ ...freshState(), userName: 'Ada', nextId: 50,
  subjects: [{ id: 1, name: 'Biology', desc: '', docs: docs.length, color: '#7c3aed', accessed: 1, cards: [], documents: docs }] });
// A Firestore stub: one document, transactions that record what they write.
function fakeFirestore(doc) {
  const calls = { tx: 0, set: [] };
  ctx.firebase = { firestore: () => ({ runTransaction: async fn => {
    calls.tx++;
    const snap = doc ? { exists: true, data: () => clone(doc) } : { exists: false, data: () => undefined };
    return fn({ get: async () => snap, set: (_ref, data) => { calls.set.push(data); } });
  } }) };
  return calls;
}
function reset() {
  runInContext(`S = freshState(); _base = null; _docKnown = false; _sizePausedIn = -1; _lastSaved = null; _tabDirty = false;
    _writing = false; _writeChain = Promise.resolve(); clearTimeout(_retryTimer); _retryTimer = undefined; _retryDelay = 0;
    _lateDelete = null; _unreadLegacyAt = null; _lostWrites = []; _seenVersions.clear(); syncState = 'idle';`, ctx);
  delete ctx.firebase;
  ls.clear();
  toasts();
}
const setS = (st, base) => { ctx.__s = st; ctx.__b = base; runInContext('S = __s; _base = __b;', ctx); };

test('an oversized state is never sent: no transaction starts, sync pauses', async () => {
  reset();
  const calls = fakeFirestore(null);
  setS(bio([note(2, MAX)]), null);
  assert.ok(userDocBytes(runInContext('S', ctx)) > MAX);
  assert.equal(await ctx.writeCloud({}, 'u', epoch()), false);
  assert.equal(calls.tx, 0, 'no transaction is even started');
  assert.equal(runInContext('syncPausedForSize()', ctx), true);
  assert.equal(runInContext('syncState', ctx), 'error');
  assert.match(toasts().map(t => t[0]).join('\n'), /Sync paused/);
  reset();
});

test('a merge with another device\'s changes that would be too large is not written either', async () => {
  reset();
  const base = bio([]);
  const remote = bio([note(2, Math.floor(MAX * 0.6))]);            // the other device's large note
  const local  = bio([note(3, Math.floor(MAX * 0.6))]);            // this device's: each fits alone
  const calls = fakeFirestore({ state: remote, rev: 2, updatedAt: '2026-11-20T10:00:00.000Z', writes: ['2|2026-11-20T10:00:00.000Z|r'] });
  setS(local, { rev: 1, at: '2026-11-20T09:00:00.000Z', tok: '1|2026-11-20T09:00:00.000Z', state: base });
  runInContext('_lastSaved = JSON.stringify(S)', ctx);
  assert.equal(await ctx.writeCloud({}, 'u', epoch()), false);
  assert.equal(calls.tx, 1);
  assert.equal(calls.set.length, 0, 'the merged document is never written');
  assert.equal(runInContext('syncPausedForSize()', ctx), true, 'sync pauses for size…');
  assert.equal(runInContext('syncState', ctx), 'error');
  assert.match(toasts().map(t => t[0]).join('\n'), /Sync paused/, '…and says so');
  assert.equal(runInContext('_retryTimer', ctx), undefined, 'no retry of a write that cannot fit');
  assert.equal(runInContext('_writing', ctx), false);
  assert.equal(runInContext('_base.rev', ctx), 1, 'S is still built on the version it was');
  reset();
});

test('a write that fits again ends the pause and is merged and written as usual', async () => {
  reset();
  const base = bio([]);
  const remote = bio([note(2, 1000)]);
  const calls = fakeFirestore({ state: remote, rev: 2, updatedAt: '2026-11-20T10:00:00.000Z', writes: ['2|2026-11-20T10:00:00.000Z|r'] });
  setS(bio([note(3, 1000)]), { rev: 1, at: '2026-11-20T09:00:00.000Z', tok: '1|2026-11-20T09:00:00.000Z', state: base });
  runInContext('_sizePausedIn = _sessionEpoch', ctx);
  assert.equal(await ctx.writeCloud({}, 'u', epoch()), true);
  assert.equal(calls.set.length, 1);
  assert.deepEqual(plain(calls.set[0].state.subjects[0].documents.map(d => d.id)).sort(), [2, 3], 'both devices\' notes');
  assert.equal(calls.set[0].rev, 3);
  assert.equal(runInContext('syncPausedForSize()', ctx), false);
  assert.match(toasts().map(t => t[0]).join('\n'), /fits again/);
  reset();
});

// ── A deletion that was called off, and one made elsewhere ──────────────────
test('a document gone after this session read it is not recreated — unless this tab\'s own called-off deletion may have landed', async () => {
  reset();
  const base = { rev: 4, at: '2026-11-20T09:00:00.000Z', tok: '4|2026-11-20T09:00:00.000Z', state: bio([]) };
  let calls = fakeFirestore(null);
  setS(bio([note(2, 10)]), base);
  runInContext('_docKnown = true', ctx);
  assert.equal(await ctx.writeCloud({}, 'u', epoch()), false);
  assert.equal(calls.set.length, 0, 'deleted elsewhere: nothing is written back');
  reset();
  calls = fakeFirestore(null);
  setS(bio([note(2, 10)]), base);
  runInContext('_docKnown = true; holdLateDelete(_sessionEpoch, false, Infinity, true);', ctx);   // (it landed)
  assert.equal(await ctx.writeCloud({}, 'u', epoch()), true);
  assert.equal(calls.set.length, 1, 'the account the user was told still exists is written back');
  assert.equal(calls.set[0].state.subjects[0].documents[0].id, 2);
  reset();
});

test('a called-off deletion that lands is written back even when nothing changed since the last write', async () => {
  // The usual case: nothing is edited while the deletion runs, so S is exactly
  // the version last written (_base). "Nothing to send" must not apply: the
  // document may be gone, and the user was told nothing was deleted.
  reset();
  const st = bio([note(2, 10)]);
  const base = { rev: 4, at: '2026-11-20T09:00:00.000Z', tok: '4|2026-11-20T09:00:00.000Z', state: clone(st) };
  let calls = fakeFirestore(null);
  setS(clone(st), base);
  runInContext('_docKnown = true; holdLateDelete(_sessionEpoch, false, Infinity, true); _lastSaved = JSON.stringify(S);', ctx);
  assert.equal(await ctx.writeCloud({}, 'u', epoch()), true);
  assert.equal(calls.tx, 1, 'the write reads the document…');
  assert.equal(calls.set.length, 1, '…and puts the account back');
  assert.equal(calls.set[0].rev, 5, 'on top of the revision it had');
  assert.deepEqual(plain(calls.set[0].state.subjects[0].documents.map(d => d.id)), [2]);
  // Without a called-off deletion, an unchanged state still sends nothing.
  reset();
  calls = fakeFirestore({ state: clone(st), rev: 4, updatedAt: base.at, writes: [base.tok] });
  setS(clone(st), base);
  runInContext('_docKnown = true; _lastSaved = JSON.stringify(S);', ctx);
  assert.equal(await ctx.writeCloud({}, 'u', epoch()), true);
  assert.equal(calls.tx, 0, 'nothing to send: no transaction');
  reset();
});

// The whole flow: deleteAccount() with its two dialogs answered, against a
// Firestore stub for users/u (get, delete, onSnapshot, transactions that commit
// to `w.cloud`). What this tab tells the other tabs is recorded (w.posts).
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MISSING = { exists: false, data: () => undefined, metadata: { fromCache: false, hasPendingWrites: false } };
runInContext('__orig = { showConfirm, showPrompt, withTimeout }', ctx);
function cloudWorld(doc) {
  const w = { cloud: doc ? clone(doc) : null, set: [], tx: 0, posts: [], signOut: 0, del: null, listeners: [] };
  const snapOf = () => w.cloud ? { exists: true, data: () => clone(w.cloud), metadata: { fromCache: false, hasPendingWrites: false } } : MISSING;
  const ref = {
    get: async () => snapOf(),
    delete: () => (w.del ? w.del() : (w.cloud = null, Promise.resolve())),
    onSnapshot: cb => { w.listeners.push(cb); return () => {}; },
  };
  ctx.firebase = {
    firestore: () => ({ collection: () => ({ doc: () => ref }), runTransaction: async fn => {
      w.tx++;
      return fn({ get: async () => snapOf(), set: (_r, data) => { const d = clone(data); w.set.push(d); w.cloud = d; } });
    } }),
    auth: () => ({ signOut: async () => { w.signOut++; }, currentUser: null }),
  };
  ctx.__w = w;
  runInContext(`_tabsChannel = { postMessage: m => __w.posts.push(JSON.parse(JSON.stringify(m))) };
    showConfirm = () => Promise.resolve(true);
    showPrompt = () => Promise.resolve({ confirm: 'DELETE' });`, ctx);
  return w;
}
function signedIn(st, base) {
  setS(st, base);
  runInContext(`firebaseUser = { uid: 'u', delete: () => Promise.resolve() }; sOwner = 'u'; authResolved = true; cloudReadOk = true;
    _docKnown = true; _lastSaved = JSON.stringify(S); _sessionClosing = false; _deleting = false; _deletingElsewhere = null;`, ctx);
}
function endWorld() {
  runInContext(`resetSession({ to: null }); _tabsChannel = null;
    showConfirm = __orig.showConfirm; showPrompt = __orig.showPrompt; withTimeout = __orig.withTimeout;`, ctx);
  reset();
}
const held = () => runInContext('deleteMayLand(_sessionEpoch)', ctx);
const lateDelete = () => runInContext('_lateDelete && { pending: _lateDelete.pending, gone: _lateDelete.gone, left: _lateDelete.until - Date.now() }', ctx);
const AT = '2026-11-20T09:00:00.000Z', TOK = '4|' + AT;
const LATE_MS = runInContext('LATE_DELETE_MS', ctx), GRACE_MS = runInContext('SETTLE_GRACE_MS', ctx);

test('a deletion the server refused holds nothing: the account deleted on another device later ends the session, nothing written back', async () => {
  reset();
  const st = bio([note(2, 10)]);
  const w = cloudWorld({ state: clone(st), rev: 4, updatedAt: AT, writes: [TOK] });
  signedIn(clone(st), { rev: 4, at: AT, tok: TOK, state: clone(st) });
  w.del = () => Promise.reject(Object.assign(new Error('unavailable'), { code: 'unavailable' }));
  try {
    await ctx.deleteAccount();
    assert.equal(runInContext('_sessionClosing', ctx), false, 'called off: the app carries on');
    assert.equal(held(), false, 'a refused delete can\'t land: nothing held');
    assert.equal(w.posts.find(m => m.type === 'resume').mayLand, false, 'the other tabs hold nothing either');
    await sleep(500);                                   // (its save(true) has nothing to send)
    const writes = w.set.length;
    w.cloud = null;                                     // deleted on another device, later
    ctx.onCloudSnapshot(MISSING, 'u', epoch());
    await sleep(50);
    assert.equal(w.set.length, writes, 'the deleted account is not written back');
    assert.equal(w.signOut, 1, 'the session ends (cloudDocGone)');
  } finally { endWorld(); }
});

test('a deletion that timed out: while unanswered a missing document is neither written over nor taken for a deletion elsewhere; landed, however late, the account is written back, then let go', async () => {
  reset();
  const st = bio([note(2, 10)]);
  const w = cloudWorld({ state: clone(st), rev: 4, updatedAt: AT, writes: [TOK] });
  signedIn(clone(st), { rev: 4, at: AT, tok: TOK, state: clone(st) });
  w.del = () => new Promise((res, rej) => { w.land = () => { w.cloud = null; res(); }; w.refuse = rej; });
  runInContext('withTimeout = (p, ms) => __orig.withTimeout(p, Math.min(ms, 30))', ctx);   // (10 s in the app)
  try {
    await ctx.deleteAccount();
    assert.equal(held(), true, 'unanswered: it may still land');
    assert.equal(lateDelete().pending, true);
    assert.equal(w.posts.find(m => m.type === 'resume').mayLand, true);
    await sleep(500);                                   // (its save(true) is sent while the document is still there)
    const writes = w.set.length;
    // The document goes missing while the delete is unanswered: this tab's, or a deletion elsewhere?
    w.cloud = null;
    ctx.onCloudSnapshot(MISSING, 'u', epoch());
    runInContext('addTask("EDIT WHILE UNANSWERED")', ctx);
    await sleep(600);
    assert.equal(w.set.length, writes, 'nothing is written over it');
    assert.equal(w.signOut, 0, 'and the session goes on');
    assert.equal(lateDelete().gone, true);
    // It lands, long after it timed out: the account is put back, with the edit.
    w.land();
    await sleep(10);
    assert.equal(lateDelete().pending, false);
    assert.ok(w.posts.some(m => m.type === 'late-delete' && m.how === 'landed'));
    await sleep(600);                                   // (save()'s debounce)
    assert.equal(w.set.length, writes + 1, 'written back once');
    assert.ok(w.cloud.state.tasks.some(t => t.text === 'EDIT WHILE UNANSWERED'));
    assert.deepEqual(plain(w.cloud.state.subjects[0].documents.map(d => d.id)), [2]);
    const g = lateDelete();
    assert.ok(!g.pending && g.left <= GRACE_MS && g.left > GRACE_MS - 5000, 'then only a short grace: ' + JSON.stringify(g));
    assert.ok(w.posts.some(m => m.type === 'late-delete' && m.how === 'written-back'));
    // After it, the account deleted on another device ends the session.
    runInContext('_lateDelete.until = Date.now() - 1', ctx);
    assert.equal(held(), false);
    w.cloud = null;
    ctx.onCloudSnapshot(MISSING, 'u', epoch());
    await sleep(50);
    assert.equal(w.set.length, writes + 1, 'not written back again');
    assert.equal(w.signOut, 1);
  } finally { endWorld(); }
});

test('a timed-out deletion the server then refuses: let go at once, and a document seen missing meanwhile was deleted elsewhere', async () => {
  for (const goneMeanwhile of [false, true]) {
    reset();
    const st = bio([note(2, 10)]);
    const w = cloudWorld({ state: clone(st), rev: 4, updatedAt: AT, writes: [TOK] });
    signedIn(clone(st), { rev: 4, at: AT, tok: TOK, state: clone(st) });
    w.del = () => new Promise((res, rej) => { w.refuse = () => rej(Object.assign(new Error('no'), { code: 'permission-denied' })); });
    runInContext('withTimeout = (p, ms) => __orig.withTimeout(p, Math.min(ms, 30))', ctx);
    try {
      await ctx.deleteAccount();
      await sleep(500);
      const writes = w.set.length;
      if (goneMeanwhile) { w.cloud = null; ctx.onCloudSnapshot(MISSING, 'u', epoch()); }
      assert.equal(held(), true);
      w.refuse();
      await sleep(600);
      assert.equal(runInContext('_lateDelete', ctx), null);
      assert.ok(w.posts.some(m => m.type === 'late-delete' && m.how === 'refused'), 'the other tabs are told');
      assert.equal(w.set.length, writes, 'nothing written back');
      assert.equal(w.signOut, goneMeanwhile ? 1 : 0, goneMeanwhile ? 'deleted elsewhere: the session ends' : 'nothing else happens');
    } finally { endWorld(); }
  }
});

test('this device\'s other tabs hold it exactly as long: not for a refused deletion, and let go when told', async () => {
  reset();
  const st = bio([]);
  const w = cloudWorld({ state: clone(st), rev: 4, updatedAt: AT, writes: [TOK] });
  signedIn(clone(st), { rev: 4, at: AT, tok: TOK, state: clone(st) });
  const msg = m => runInContext(`onTabsMessage(${JSON.stringify(m)})`, ctx);
  try {
    msg({ type: 'deleting', uid: 'u' });
    assert.equal(runInContext('_deletingElsewhere', ctx), 'u');
    msg({ type: 'resume', uid: 'u', mayLand: false });
    assert.equal(runInContext('_sessionClosing', ctx), false);
    assert.equal(held(), false, 'refused there: nothing held here');
    msg({ type: 'deleting', uid: 'u' });
    msg({ type: 'resume', uid: 'u', mayLand: true });
    assert.equal(lateDelete().pending, true, 'timed out there: held here too');
    msg({ type: 'late-delete', uid: 'other', how: 'refused' });
    assert.equal(held(), true, 'another account\'s: ignored');
    msg({ type: 'late-delete', uid: 'u', how: 'refused' });
    assert.equal(held(), false, 'refused after all');
    msg({ type: 'deleting', uid: 'u' });
    msg({ type: 'resume', uid: 'u', mayLand: true });
    msg({ type: 'late-delete', uid: 'u', how: 'landed' });
    assert.equal(lateDelete().pending, false);
    assert.equal(lateDelete().left, Infinity, 'landed: held until the data is back');
    msg({ type: 'late-delete', uid: 'u', how: 'written-back' });
    let g = lateDelete();
    assert.ok(g.left <= GRACE_MS, JSON.stringify(g));
    // The deleting tab closed with its delete unanswered: a missing document is put back for a while.
    runInContext('_lateDelete = null', ctx);
    msg({ type: 'deleting', uid: 'u' });
    msg({ type: 'resume', uid: 'u', mayLand: true });
    w.cloud = null;
    ctx.onCloudSnapshot(MISSING, 'u', epoch());   // (deferred: unanswered)
    msg({ type: 'late-delete', uid: 'u', how: 'abandoned' });
    g = lateDelete();
    assert.ok(!g.pending && g.left <= LATE_MS && g.left > LATE_MS - 5000, JSON.stringify(g));
    await sleep(600);
    assert.equal(w.set.length, 1, 'the missing document is put back');
    assert.equal(w.signOut, 0);
    // A tab following its own delete isn't told how it ended by others.
    runInContext('holdLateDelete(_sessionEpoch, true, 0, true)', ctx);
    msg({ type: 'late-delete', uid: 'u', how: 'refused' });
    assert.equal(lateDelete().pending, true);
  } finally { endWorld(); }
});

// ── Upgrading a copy marked by an app version from before revisions ───────────
// Sync broke (a large inline PDF, P0-5's bug) and edits piled up on this device
// under the old marker {uid, dirty, syncedAt}, with no base stored beside them.
test('a copy an app version from before revisions marked unsynced: with the cloud unchanged since, its ticks, settings and deletions carry over', async () => {
  const X = '2026-11-01T10:00:00.000Z';
  const stale = { ...freshState(), userName: 'Ada', focusDuration: 1500, dailyGoal: 120, nextId: 5,
    tasks: [{ id: 2, text: 'ORIG', done: false }, { id: 3, text: 'DEL-ME', done: false }, { id: 4, text: 'KEEP', done: false }] };
  const local = { ...clone(stale), focusDuration: 3000, dailyGoal: 240, nextId: 7,
    tasks: [{ id: 2, text: 'ORIG', done: true }, { id: 4, text: 'KEEP', done: false }, { id: 6, text: 'LOCAL-NEW', done: false }] };
  const user = { uid: 'u', displayName: 'Ada', getIdToken: () => Promise.resolve('t') };
  for (const changed of [false, true]) {
    reset();
    const cloudState = clone(stale);
    if (changed) { cloudState.tasks.push({ id: 5, text: 'PHONE', done: false }); cloudState.nextId = 6; }
    const w = cloudWorld({ state: cloudState, updatedAt: changed ? '2026-11-05T10:00:00.000Z' : X });
    ls.setItem(KEY, JSON.stringify(local));
    ls.setItem(META, JSON.stringify({ uid: 'u', dirty: true, syncedAt: X }));
    runInContext(`authResolution = null; authResolutionUid = null; authResolved = false; firebaseUser = null; sOwner = null; cloudReadOk = false;`, ctx);
    try {
      await ctx.resolveStateAfterAuth(user);
      const tasks = plain(runInContext('S.tasks.map(t => t.text + (t.done ? "+" : ""))', ctx));
      if (!changed) {
        assert.deepEqual(tasks, ['ORIG+', 'KEEP', 'LOCAL-NEW'], 'the tick stays, the deleted task stays deleted');
        assert.deepEqual(plain(runInContext('[S.focusDuration, S.dailyGoal]', ctx)), [3000, 240], 'the settings changed here stay');
      } else {
        // Changed since: no base to tell this device's changes from the other
        // device's, so nothing is deleted and the cloud's fields win (as before).
        assert.ok(tasks.includes('PHONE') && tasks.includes('LOCAL-NEW') && tasks.includes('DEL-ME'), JSON.stringify(tasks));
      }
      await sleep(600);
      assert.deepEqual(plain(w.cloud.state.tasks.map(t => t.text + (t.done ? '+' : ''))), tasks, 'and the cloud gets the same');
    } finally { endWorld(); }
  }
});
test('only an old-format marker is taken for one: a marker of this version without a stored base still merges without one', async () => {
  reset();
  const X = '2026-11-01T10:00:00.000Z';
  const stale = { ...freshState(), userName: 'Ada', nextId: 5, tasks: [{ id: 2, text: 'ORIG', done: false }, { id: 3, text: 'DEL-ME', done: false }] };
  const local = { ...clone(stale), tasks: [{ id: 2, text: 'ORIG', done: true }] };
  const w = cloudWorld({ state: clone(stale), rev: 3, updatedAt: X, writes: ['3|' + X + '|n'] });
  const json = JSON.stringify(local);
  ls.setItem(KEY, json);
  // (base '' : its base had no room, and the copy may be older than the cloud's version at syncedAt)
  ls.setItem(META, JSON.stringify({ uid: 'u', dirty: true, syncedAt: X, base: '', wc: runInContext(`wcHash(${JSON.stringify(json)})`, ctx) }));
  runInContext(`authResolution = null; authResolutionUid = null; authResolved = false; firebaseUser = null; sOwner = null; cloudReadOk = false;`, ctx);
  try {
    await ctx.resolveStateAfterAuth({ uid: 'u', displayName: 'Ada', getIdToken: () => Promise.resolve('t') });
    assert.deepEqual(plain(runInContext('S.tasks.map(t => t.text)', ctx)), ['ORIG', 'DEL-ME'], 'nothing deleted');
    await sleep(600);
    assert.deepEqual(plain(w.cloud.state.tasks.map(t => t.text)), ['ORIG', 'DEL-ME']);
  } finally { endWorld(); }
});

// ── Discarding a held copy leaves nothing of the account ─────────────────────
test('a held copy discarded (another tab\'s "lose unsynced changes") takes the cloud version stored beside it too', () => {
  reset();
  const BASE = 'brainfy_sync_base';
  const acctT = done => ({ ...freshState(), userName: 'Ada', nextId: 10, tasks: [{ id: 1, text: 'A-SECRET', done }] });
  ctx.__b = { rev: 3, at: AT, tok: '3|' + AT, state: acctT(false) }; ctx.__s = acctT(true);
  runInContext(`firebaseUser = { uid: 'A' }; sOwner = 'A'; authResolved = true; S = __s; _base = __b; _lastSaved = null; navigator.onLine = false;`, ctx);
  try {
    runInContext('save()', ctx);
    assert.ok(ls.getItem(BASE), 'the base is stored beside the unsynced copy');
    const realSet = ls.setItem;
    ls.setItem = function (k, v) { if (k.startsWith('brainfy_unsynced')) { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } return realSet.call(this, k, v); };
    try { assert.equal(runInContext('resetSession({ keep: true, to: null })', ctx), 'lost'); } finally { ls.setItem = realSet; }
    assert.equal(JSON.parse(ls.getItem(META)).held, true, 'held in the working copy, with its base');
    runInContext(`onTabsMessage({ type: 'discarded', uid: 'A' })`, ctx);
    assert.deepEqual([...ls._m.keys()].filter(k => k.startsWith('brainfy_')), [], 'nothing of A\'s left: ' + [...ls._m.keys()]);
    // A base left over with no copy of A's (and someone else's copy in the slot) goes too.
    ls.setItem(BASE, JSON.stringify({ uid: 'A', tok: 'x', state: acctT(false) }));
    ls.setItem(META, JSON.stringify({ uid: 'B', dirty: false }));
    ctx.discardKept('A');
    assert.equal(ls.getItem(BASE), null);
    // ...but not a base that belongs to the copy in use.
    ls.setItem(BASE, JSON.stringify({ uid: 'B', tok: 'x', state: acctT(false) }));
    ls.setItem(META, JSON.stringify({ uid: 'B', dirty: true, base: 'x' }));
    ctx.discardKept('A');
    assert.ok(ls.getItem(BASE));
  } finally {
    runInContext('navigator.onLine = true; resetSession({ to: null });', ctx);
    reset();
  }
});

// ── Whose copy the working slot holds (P0-4) ────────────────────────────────
test('the working copy of another account that could not be moved aside is never overwritten or marked', () => {
  reset();
  const theirs = JSON.stringify(acct());
  ls.setItem(KEY, theirs);
  ls.setItem(META, JSON.stringify({ uid: 'other', dirty: true, held: true }));
  const realSet = ls.setItem;
  ls.setItem = function (k, v) { if (k.startsWith('brainfy_unsynced')) { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } return realSet.call(this, k, v); };
  try {
    assert.equal(storeWorkingCopyFor('me', JSON.stringify(bio([])), true, null, undefined, bio([])), false);
    assert.equal(ls.getItem(KEY), theirs, 'their edits, byte for byte');
    assert.equal(JSON.parse(ls.getItem(META)).uid, 'other');
    assert.equal(runInContext('_localWriteOk', ctx), false);
    assert.equal(toasts().length, 1, 'the user is told once');
    runInContext(`markSynced('me', 'x')`, ctx);
    assert.equal(JSON.parse(ls.getItem(META)).uid, 'other', 'a confirmed write does not mark their copy as this account\'s');
  } finally { ls.setItem = realSet; }
  // With room again, theirs is set aside (kept for them, with no base) and this account's copy stored.
  assert.equal(storeWorkingCopyFor('me', JSON.stringify(bio([])), true, null, undefined, bio([])), true);
  assert.equal(readKept('other').subjects[0].name, 'Biology');
  assert.equal(JSON.parse(ls.getItem(META)).uid, 'me');
  reset();
});

test('kept edits keep their base, and a copy with no room stays held with its own', () => {
  reset();
  const base = { rev: 3, at: '2026-11-20T09:00:00.000Z', tok: '3|2026-11-20T09:00:00.000Z', state: acct() };
  assert.equal(keepUnsynced('u1', acct(pdf(), { tasks: [{ id: 3, text: 'Revise', done: true }] }), base), 'kept');
  assert.equal(readKeptBase('u1').tok, base.tok);
  // No room: nothing is lost, and the copy already kept keeps its base.
  const realSet = ls.setItem;
  ls.setItem = function (k, v) { if (k.startsWith('brainfy_unsynced')) { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } return realSet.call(this, k, v); };
  try {
    ls._m.set(KEY, JSON.stringify(acct()));
    ls._m.set(META, JSON.stringify({ uid: 'u1', dirty: true, wc: 'w', base: 'b' }));
    assert.equal(keepUnsynced('u1', acct(), base), 'lost');
    const m = JSON.parse(ls.getItem(META));
    assert.equal(m.held, true);
    assert.equal(m.base, 'b', 'the held copy\'s marker still pairs it with its base');
    assert.equal(readKeptBase('u1').tok, base.tok);
  } finally { ls.setItem = realSet; }
  reset();
});
