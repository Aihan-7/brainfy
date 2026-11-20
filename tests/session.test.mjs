// Tests for the state a session starts from and who owns the local copy —
// the pieces that keep one account's data from following the next person who
// signs in on the same device (AUDIT-2026-10-17.md, P0-4).
import test from 'node:test';
import assert from 'node:assert/strict';
import { runInContext } from 'node:vm';
import { loadBundle } from './_bundle.mjs';

const ctx = loadBundle();
const { freshState, mergeStates, localBelongsTo, vacateWorkingCopy, workingCopyOf, keepUnsynced, readKept, readUnclaimed, save } = ctx;
const ls = ctx.localStorage;
const KEY = 'brainfy_v3', META = 'brainfy_sync_meta';
const json = k => JSON.parse(ls.getItem(k));
// A device holding `state` in the working copy, tagged with `meta` (or untagged).
function device(state, meta) {
  ls.clear();
  ls.setItem(KEY, JSON.stringify(state));
  if (meta) ls.setItem(META, JSON.stringify(meta));
}
const withTask = text => ({ ...freshState(), tasks: [{ id: 1, text, done: false }], nextId: 2 });
// A top-level const is not a property of the global object; read it in-realm.
const DEFAULT_STATE = runInContext('DEFAULT_STATE', ctx);

// Every object/array reachable from `v`.
function containers(v, out = []) {
  if (v && typeof v === 'object') {
    out.push(v);
    for (const x of Object.values(v)) containers(x, out);
  }
  return out;
}

test('freshState() matches the defaults', () => {
  assert.equal(JSON.stringify(freshState()), JSON.stringify(DEFAULT_STATE));
});

test('freshState() shares no array or object with the defaults or another fresh state', () => {
  const a = freshState(), b = freshState();
  const shared = new Set([...containers(DEFAULT_STATE), ...containers(b)]);
  const leaks = containers(a).filter(x => shared.has(x));
  assert.equal(leaks.length, 0, `${leaks.length} shared reference(s)`);
});

test('edits to one fresh state never reach the next one', () => {
  // The leak: a new account's first task was pushed into DEFAULT_STATE.tasks.
  const a = freshState();
  a.tasks.push({ id: 1, text: 'previous user task', done: false });
  a.subjects.push({ id: 2, name: 'previous user subject' });
  a.sessions.push({ date: 'x', duration: 60 });
  a.timetable.push({ id: 3 });
  a.milestones.push({ id: 4, text: 'm', done: false });
  a.ambient.rain = 0.7;
  a.userName = 'Alice';
  const b = freshState();
  assert.equal(JSON.stringify(b), JSON.stringify(DEFAULT_STATE));
  assert.equal(b.tasks.length + b.subjects.length + b.sessions.length + b.timetable.length + b.milestones.length, 0);
  assert.equal(b.ambient.rain, 0);
});

test('the defaults are frozen all the way down, so aliasing them throws instead of leaking', () => {
  for (const x of containers(DEFAULT_STATE)) assert.ok(Object.isFrozen(x));
  const aliased = { ...DEFAULT_STATE };   // the old pattern
  // (the TypeError comes from the bundle's realm, so match it by name)
  assert.throws(() => aliased.tasks.push({ id: 1, text: 't', done: false }), { name: 'TypeError' });
});

test('a state built from a sparse cloud document does not alias the defaults', () => {
  // mergeStates() fills keys the cloud copy lacks from the defaults.
  const m = mergeStates({ nextId: 1 }, { nextId: 1 });
  m.milestones.push({ id: 1, text: 'm', done: false });
  m.ambient.lofi = 1;
  assert.equal(freshState().milestones.length, 0);
  assert.equal(freshState().ambient.lofi, 0);
});

test('local data belongs to an account only when the sync marker names it', () => {
  ls.removeItem('brainfy_sync_meta');
  assert.equal(localBelongsTo('uid_a'), false, 'untagged local data is no account\'s (it is offered, never adopted)');
  ls.setItem('brainfy_sync_meta', JSON.stringify({ uid: 'uid_a', dirty: false }));
  assert.equal(localBelongsTo('uid_a'), true);
  assert.equal(localBelongsTo('uid_b'), false, "another account's copy is never adopted");
  ls.setItem('brainfy_sync_meta', '{not json');
  assert.equal(localBelongsTo('uid_a'), false);
  ls.removeItem('brainfy_sync_meta');
});

test('workingCopyOf() hands out the working copy only to the account the marker names', () => {
  device(withTask('A-task'), { uid: 'uid_a', dirty: false });
  assert.equal(workingCopyOf('uid_a').tasks[0].text, 'A-task');
  assert.equal(workingCopyOf('uid_b'), null);
  device(withTask('guest-task'), null);
  assert.equal(workingCopyOf('uid_a'), null, 'untagged data is nobody\'s working copy');
});

test('vacateWorkingCopy(): another account\'s unsynced edits are kept for THAT account', () => {
  device(withTask('A-unsynced'), { uid: 'uid_a', dirty: true });
  vacateWorkingCopy(null);                       // B is signing in
  assert.equal(ls.getItem(KEY), null);
  assert.equal(ls.getItem(META), null);
  assert.equal(readKept('uid_a').tasks[0].text, 'A-unsynced');
  assert.equal(readKept('uid_b'), null);
  assert.equal(readUnclaimed(), null);
});

test('vacateWorkingCopy(): another account\'s synced copy just goes (its cloud has it)', () => {
  device(withTask('A-synced'), { uid: 'uid_a', dirty: false });
  vacateWorkingCopy(null);
  assert.equal(ls.getItem(KEY), null);
  assert.equal(readKept('uid_a'), null);
  assert.equal(readUnclaimed(), null);
});

test('vacateWorkingCopy(): data saved with no account is set aside as unclaimed, never dropped', () => {
  device(withTask('guest-task'), null);
  vacateWorkingCopy(null);
  assert.equal(ls.getItem(KEY), null);
  const u = readUnclaimed();
  assert.equal(u.state.tasks[0].text, 'guest-task');
  assert.equal(u.declined.length, 0);
  // An empty untagged state is nothing worth keeping.
  device(freshState(), null);
  ls.removeItem('brainfy_unclaimed');
  vacateWorkingCopy(null);
  assert.equal(readUnclaimed(), null);
});

test('vacateWorkingCopy(uid): the account\'s own copy goes; nobody else\'s is lost', () => {
  device(withTask('A-own'), { uid: 'uid_a', dirty: true });
  vacateWorkingCopy('uid_a');                    // A's sign-out: the caller has flushed, kept or discarded it
  assert.equal(ls.getItem(KEY), null);
  assert.equal(readKept('uid_a'), null);
  device(withTask('B-left'), { uid: 'uid_b', dirty: true });
  vacateWorkingCopy('uid_a');                    // a slot that turned out to be B's is still B's
  assert.equal(readKept('uid_b').tasks[0].text, 'B-left');
});

test('keepUnsynced() adds to an earlier kept copy instead of replacing it', () => {
  ls.clear();
  keepUnsynced('uid_a', withTask('first'));
  keepUnsynced('uid_a', withTask('second'));
  const texts = readKept('uid_a').tasks.map(t => t.text).sort();
  assert.deepEqual(Array.from(texts), ['first', 'second']);
  assert.equal(readKept('uid_b'), null);
});

test('save() stores nothing unless S is the signed-in account\'s', () => {
  ls.clear();
  // signed out: S is blank, and must not overwrite what the device holds for others
  runInContext(`firebaseUser = null; sOwner = null; S = freshState(); S.tasks.push({ id: 1, text: 'x', done: false });`, ctx);
  save();
  assert.equal(ls.getItem(KEY), null);
  // B signed in, but S still holds someone else's data (takeover in progress)
  runInContext(`firebaseUser = { uid: 'uid_b' }; sOwner = 'uid_a';`, ctx);
  save();
  assert.equal(ls.getItem(KEY), null);
  assert.equal(ls.getItem(META), null);
  // S is B's: stored and tagged as B's, marked unsynced
  runInContext(`sOwner = 'uid_b';`, ctx);
  save();
  assert.equal(json(KEY).tasks[0].text, 'x');
  assert.deepEqual({ ...json(META) }, { uid: 'uid_b', dirty: true });
  runInContext(`firebaseUser = null; sOwner = null; S = freshState(); _lastSaved = null; clearTimeout(_pendingSaveTimer); _pendingSaveTimer = undefined; _tabDirty = false;`, ctx);
  ls.clear();
});

// ── A device that runs out of room ───────────────────────────────────────────
// localStorage holds a few MB; a state carrying an imported PDF can fill half
// of it. Setting edits aside must never cost the only copy of them.
function withQuota(chars, fn) {
  const orig = ls.setItem;
  ls.setItem = function (k, v) {
    let used = 0;
    for (const [key, val] of this._m) if (key !== k) used += key.length + val.length;
    if (used + k.length + String(v).length > chars) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
    return orig.call(this, k, v);
  };
  try { return fn(); } finally { ls.setItem = orig; }
}
const big = (text, n) => ({ ...withTask(text), sessionNotes: 'x'.repeat(n) });

test('keepUnsynced(): with no room for a second copy, the working copy makes room (nothing is lost)', () => {
  const st = big('A-unsynced', 4000);
  device(st, { uid: 'uid_a', dirty: true });
  const r = withQuota(6000, () => keepUnsynced('uid_a', st));
  assert.equal(r, 'kept');
  assert.equal(readKept('uid_a').tasks[0].text, 'A-unsynced');
  assert.equal(ls.getItem(KEY), null, 'the working copy gave up its place');
});

// Writes under keys matching `blocked` fail as if the device were full.
function withFullFor(blocked, fn) {
  const orig = ls.setItem;
  ls.setItem = function (k, v) {
    if (blocked(k)) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
    return orig.call(this, k, v);
  };
  try { return fn(); } finally { ls.setItem = orig; }
}

test('keepUnsynced(): when the newest edits fit nowhere, the older unsynced copy stays held in the working copy', () => {
  ls.clear();
  ls.setItem(KEY, JSON.stringify(withTask('A-older-unsynced')));   // what last fitted on the device
  ls.setItem(META, JSON.stringify({ uid: 'uid_a', dirty: true }));
  const newest = big('A-newest', 4000);                             // never fitted (save() couldn't store it)
  withQuota(3000, () => {
    assert.equal(keepUnsynced('uid_a', newest), 'lost');
    assert.equal(json(KEY).tasks[0].text, 'A-older-unsynced', 'the older copy is still there');
    assert.equal(json(META).held, true);
  });
  // Emptying the working copy — for A's sign-out or for whoever signs in next —
  // moves held edits aside, and leaves them in place while there's no room.
  withFullFor(k => k.startsWith('brainfy_unsynced:'), () => {
    assert.equal(vacateWorkingCopy('uid_a'), false);
    assert.equal(vacateWorkingCopy(null), false);
  });
  assert.equal(json(KEY).tasks[0].text, 'A-older-unsynced');
  // A's own sign-in finds them in the working copy, as its own unsynced edits.
  assert.equal(workingCopyOf('uid_a').tasks[0].text, 'A-older-unsynced');
  assert.equal(runInContext(`localHasUnsyncedEdits('uid_a')`, ctx), true);
  // With room, the next vacate moves them to A's kept copy.
  assert.equal(vacateWorkingCopy('uid_a'), true);
  assert.equal(readKept('uid_a').tasks[0].text, 'A-older-unsynced');
  assert.equal(ls.getItem(KEY), null);
});

test('keepUnsynced(): reports when the device has no room for the edits at all', () => {
  ls.clear();
  ls.setItem(KEY, JSON.stringify(withTask('B-synced')));
  ls.setItem(META, JSON.stringify({ uid: 'uid_b', dirty: false }));
  const r = withQuota(500, () => keepUnsynced('uid_a', big('A-unsynced', 4000)));
  assert.equal(r, 'lost');
  assert.equal(readKept('uid_a'), null);
  assert.equal(json(KEY).tasks[0].text, 'B-synced', "another account's copy is untouched");
});

test('vacateWorkingCopy(): untagged data is moved to the unclaimed slot even when the device is nearly full', () => {
  const st = big('guest-task', 4000);
  device(st, null);
  assert.equal(withQuota(6000, () => vacateWorkingCopy(null)), true);
  assert.equal(readUnclaimed().state.tasks[0].text, 'guest-task');
  assert.equal(ls.getItem(KEY), null);
});

test('addsAnything(): tells a copy already in the account from one with work of its own', () => {
  const { addsAnything } = ctx;
  const cloud = { ...freshState(),
    subjects: [{ id: 1, name: 'Bio', cards: [{ q: 'q1', a: 'a1' }], documents: [{ id: 2, type: 'note', name: 'n', date: 5 }] }],
    tasks: [{ id: 3, text: 't', done: false }, { id: 4, text: 't', done: true }], nextId: 5 };
  const sameCopy = JSON.parse(JSON.stringify(cloud));
  assert.equal(addsAnything(cloud, sameCopy), false, 'the account\'s own (older) copy adds nothing');
  assert.equal(addsAnything(cloud, freshState()), false);
  assert.equal(addsAnything(cloud, { ...sameCopy, tasks: [...sameCopy.tasks, { id: 9, text: 'new', done: false }] }), true);
  const withCard = JSON.parse(JSON.stringify(cloud)); withCard.subjects[0].cards.push({ q: 'q2', a: 'a2' });
  assert.equal(addsAnything(cloud, withCard), true);
  assert.equal(addsAnything(freshState(), withTask('x')), true);
});

test('save(): a call that changes nothing stores, marks and sends nothing', () => {
  ls.clear();
  runInContext(`firebaseUser = { uid: 'uid_a' }; sOwner = 'uid_a'; S = freshState(); _lastSaved = null; _tabDirty = false; cloudReadOk = false;`, ctx);
  const rev = () => runInContext('_localRev', ctx);
  save();                                    // first save of the session: stored, unsynced
  const r1 = rev();
  assert.equal(json(META).dirty, true);
  // The cloud confirms it; then a view change calls save() again.
  ls.setItem(META, JSON.stringify({ uid: 'uid_a', dirty: false }));
  runInContext('_tabDirty = false;', ctx);
  save();
  assert.equal(rev(), r1, 'no new revision');
  assert.equal(json(META).dirty, false, 'still synced');
  assert.equal(runInContext('_tabDirty', ctx), false);
  save(true);                                // forced: stored and marked again
  assert.equal(rev(), r1 + 1);
  assert.equal(json(META).dirty, true);
  runInContext(`S.tasks.push({ id: 1, text: 'edit', done: false });`, ctx);
  save();                                    // a real edit
  assert.equal(rev(), r1 + 2);
  assert.equal(json(KEY).tasks[0].text, 'edit');
  runInContext(`firebaseUser = null; sOwner = null; S = freshState(); _lastSaved = null; clearTimeout(_pendingSaveTimer); _pendingSaveTimer = undefined; _tabDirty = false;`, ctx);
  ls.clear();
});

test('save(): never overwrites another account\'s edits held in the working copy', () => {
  ls.clear();
  ls.setItem(KEY, JSON.stringify(withTask('A-held')));
  ls.setItem(META, JSON.stringify({ uid: 'uid_a', dirty: true, held: true }));
  runInContext(`firebaseUser = { uid: 'uid_b' }; sOwner = 'uid_b'; S = freshState(); S.tasks.push({ id: 1, text: 'B-task', done: false }); _lastSaved = null; cloudReadOk = false;`, ctx);
  withFullFor(k => k.startsWith('brainfy_unsynced:'), () => save());   // still no room to move A's edits
  assert.equal(json(KEY).tasks[0].text, 'A-held', "A's held edits are still there");
  assert.equal(json(META).uid, 'uid_a');
  assert.equal(runInContext('_localWriteOk', ctx), false, 'B works from the cloud alone');
  assert.equal(runInContext('_tabDirty', ctx), true, "B's edit is still tracked as unsynced");
  // With room again, B's next edit moves A's edits aside and stores B's copy.
  runInContext(`S.tasks.push({ id: 2, text: 'B-task-2', done: false });`, ctx);
  save();
  assert.equal(readKept('uid_a').tasks[0].text, 'A-held');
  assert.equal(json(META).uid, 'uid_b');
  assert.equal(json(KEY).tasks.length, 2);
  runInContext(`firebaseUser = null; sOwner = null; S = freshState(); _lastSaved = null; clearTimeout(_pendingSaveTimer); _pendingSaveTimer = undefined; _tabDirty = false; _localWriteOk = true;`, ctx);
  ls.clear();
});

test('withTimeout(): passes a result through, and gives up with code "timeout"', async () => {
  const { withTimeout } = ctx;
  assert.equal(await withTimeout(Promise.resolve(7), 50), 7);
  await assert.rejects(withTimeout(new Promise(() => {}), 20), e => e.code === 'timeout');
  await assert.rejects(withTimeout(Promise.reject(Object.assign(new Error('x'), { code: 'denied' })), 50), e => e.code === 'denied');
});

// ── A sign-out the user confirmed, and a tab that goes before it is done ─────
// Signing out can take seconds (unsynced edits uploading, a question about
// them). Closing the tab meanwhile used to leave the account signed in, and the
// next person on the device walked in through "Continue as <name>".
const PENDING = 'brainfy_signout_pending', HINT = 'brainfy_user_hint';
function signedInAs(uid) {
  runInContext(`firebaseUser = { uid: '${uid}' }; sOwner = '${uid}'; _tabDirty = false; _lastSaved = null;`, ctx);
}
function cleanUp() {
  runInContext(`signOutSettled(); firebaseUser = null; sOwner = null; _sessionClosing = false; _signOutSent = false;
    S = freshState(); _tabDirty = false; _lastSaved = null; clearTimeout(_pendingSaveTimer); _pendingSaveTimer = undefined;
    _tabsChannel = null; _deletingElsewhere = null; _heldBack = false; _onAuthState = null; cloudReadOk = false;
    clearTimeout(_owedCheck); _owedCheck = undefined; endBusy();`, ctx);
  delete ctx.firebase;
  delete ctx.navigator.locks;
  ls.clear();
}
function stubSignOut() {
  const calls = { n: 0 };
  ctx.firebase = { auth: () => ({ signOut: () => { calls.n++; return Promise.resolve(); } }) };
  return calls;
}

test('a confirmed sign-out is owed until it is done: the hint goes, leaving is warned against', () => {
  ls.clear();
  ls.setItem(HINT, JSON.stringify({ name: 'Ada' }));
  signedInAs('uid_a');
  const t0 = Date.now();
  runInContext(`S.userName = 'Ada'; signOutOwed('uid_a');`, ctx);
  const owed = JSON.parse(ls.getItem(PENDING));
  assert.equal(owed.uid, 'uid_a');
  assert.ok(owed.at >= t0 && owed.at <= Date.now(), 'stamped with the heartbeat time');
  assert.equal(ls.getItem(HINT), null, '"Continue as Ada" must not outlive the confirmation');
  assert.equal(ctx.listeners('beforeunload').length, 1);
  // "Stay signed in": nothing is owed any more, the hint comes back, no warning
  runInContext(`signOutCalledOff();`, ctx);
  assert.equal(ls.getItem(PENDING), null);
  assert.deepEqual({ ...JSON.parse(ls.getItem(HINT)) }, { name: 'Ada' });
  assert.equal(ctx.listeners('beforeunload').length, 0);
  // done (resetSession settles it): no marker, no warning
  runInContext(`signOutOwed('uid_a'); signOutSettled();`, ctx);
  assert.equal(ls.getItem(PENDING), null);
  assert.equal(ctx.listeners('beforeunload').length, 0);
  cleanUp();
});

test('pagehide with a sign-out owed: signs out without waiting; unsynced edits stay tagged as that account\'s', () => {
  ls.clear();
  device(withTask('A-unsynced'), { uid: 'uid_a', dirty: true });
  signedInAs('uid_a');
  const calls = stubSignOut();
  runInContext(`signOutOwed('uid_a');`, ctx);
  for (const f of ctx.listeners('pagehide')) f({ persisted: false });
  assert.equal(calls.n, 1);
  assert.deepEqual({ ...json(META) }, { uid: 'uid_a', dirty: true });
  assert.equal(json(KEY).tasks[0].text, 'A-unsynced');
  assert.deepEqual({ ...JSON.parse(ls.getItem(PENDING)) }, { uid: 'uid_a', at: 0 },
    'kept, in case the sign-out never lands, and marked abandoned at once: nobody keeps it up any more');
  // only that account's sign-in adopts them
  assert.equal(workingCopyOf('uid_b'), null);
  assert.equal(workingCopyOf('uid_a').tasks[0].text, 'A-unsynced');
  cleanUp();
});

test('pagehide with a sign-out owed: a copy the cloud has confirmed does not stay on the device', () => {
  ls.clear();
  device(withTask('A-synced'), { uid: 'uid_a', dirty: false });
  signedInAs('uid_a');
  const calls = stubSignOut();
  runInContext(`signOutOwed('uid_a');`, ctx);
  for (const f of ctx.listeners('pagehide')) f({ persisted: false });
  assert.equal(calls.n, 1);
  assert.equal(ls.getItem(KEY), null);
  assert.equal(ls.getItem(META), null);
  cleanUp();
});

test('pagehide with no sign-out owed changes nothing', () => {
  ls.clear();
  device(withTask('A-synced'), { uid: 'uid_a', dirty: false });
  signedInAs('uid_a');
  const calls = stubSignOut();
  for (const f of ctx.listeners('pagehide')) f({ persisted: false });
  assert.equal(calls.n, 0);
  assert.equal(json(KEY).tasks[0].text, 'A-synced');
  cleanUp();
});

test('pagehide while the account is being deleted: none of its data stays, not even unsynced edits', () => {
  ls.clear();
  device(withTask('A-unsynced'), { uid: 'uid_a', dirty: true });
  ls.setItem('brainfy_unsynced:uid_a', JSON.stringify(withTask('A-kept')));
  signedInAs('uid_a');
  const calls = stubSignOut();
  runInContext(`_deleting = true; signOutOwed('uid_a');`, ctx);
  for (const f of ctx.listeners('pagehide')) f({ persisted: false });
  assert.equal(calls.n, 1);
  assert.equal(ls.getItem(KEY), null);
  assert.equal(ls.getItem(META), null);
  assert.equal(ls.getItem('brainfy_unsynced:uid_a'), null);
  runInContext(`_deleting = false;`, ctx);
  cleanUp();
});

// ── Other tabs of the same device ────────────────────────────────────────────
// Firebase shares one sign-in between a device's tabs. The tab that owes a
// sign-out may close or crash before it lands; another tab still signed in as
// that account must not carry on in it for the next person.
const { owedLooksAbandoned, readOwed, onTabsMessage, checkOwedSignOut } = ctx;
// What this tab tells the others (in place of a BroadcastChannel).
function fakeChannel() {
  const sent = [];
  ctx.__sent = sent;
  runInContext(`_tabsChannel = { postMessage: m => __sent.push(m) };`, ctx);
  return sent;
}
// Firebase as this tab sees it: who is signed in, and how often signOut() is called.
function stubAuth(uid) {
  const calls = { n: 0 };
  ctx.firebase = { auth: () => ({ currentUser: uid ? { uid } : null, signOut: () => { calls.n++; return Promise.resolve(); } }) };
  return calls;
}
const plainMsgs = sent => sent.map(m => ({ ...m }));

test('the staleness rule: a marker is abandoned once its heartbeat is over 3 s old, or the clock jumped', () => {
  const now = 1_000_000;
  assert.equal(owedLooksAbandoned({ uid: 'a', at: now }, now), false);
  assert.equal(owedLooksAbandoned({ uid: 'a', at: now - 2900 }, now), false, 'a heartbeat or two late is still alive');
  assert.equal(owedLooksAbandoned({ uid: 'a', at: now - 3100 }, now), true);
  assert.equal(owedLooksAbandoned({ uid: 'a', at: 0 }, now), true, 'pagehide marks it abandoned at once');
  assert.equal(owedLooksAbandoned({ uid: 'a', at: now + 60000 }, now), true, 'a clock that jumped back');
  assert.equal(owedLooksAbandoned({ uid: 'a', at: NaN }, now), true);
});

test('readOwed(): reads the marker; a bare uid (older marker) counts as abandoned; junk is no marker', () => {
  ls.clear();
  assert.equal(readOwed(), null);
  ls.setItem(PENDING, JSON.stringify({ uid: 'uid_a', at: 5 }));
  assert.deepEqual({ ...readOwed() }, { uid: 'uid_a', at: 5 });
  ls.setItem(PENDING, JSON.stringify('uid_a'));
  assert.deepEqual({ ...readOwed() }, { uid: 'uid_a', at: 0 });
  ls.setItem(PENDING, JSON.stringify({ uid: 'uid_a' }));
  assert.deepEqual({ ...readOwed() }, { uid: 'uid_a', at: 0 });
  ls.setItem(PENDING, '{bad');
  assert.equal(readOwed(), null);
  ls.setItem(PENDING, JSON.stringify({ at: 5 }));
  assert.equal(readOwed(), null);
  ls.clear();
});

test('pagehide with a sign-out owed tells the other tabs, so one that stays open finishes it', () => {
  ls.clear();
  signedInAs('uid_a');
  const sent = fakeChannel();
  stubAuth('uid_a');
  runInContext(`signOutOwed('uid_a');`, ctx);
  for (const f of ctx.listeners('pagehide')) f({ persisted: false });
  assert.deepEqual(plainMsgs(sent), [{ type: 'signout-owed', uid: 'uid_a' }]);
  cleanUp();
});

test('"signout-owed" from another tab: a tab signed in as that account signs out itself', () => {
  ls.clear();
  signedInAs('uid_a');
  let calls = stubAuth('uid_a');
  onTabsMessage({ type: 'signout-owed', uid: 'uid_a' });
  assert.equal(calls.n, 1);
  cleanUp();
  // a tab that left the session alone (Firebase has the user, the app doesn't): the same
  calls = stubAuth('uid_a');
  onTabsMessage({ type: 'signout-owed', uid: 'uid_a' });
  assert.equal(calls.n, 1);
  cleanUp();
});

test('"signout-owed" leaves alone another account\'s session, and a tab already ending that one itself', () => {
  ls.clear();
  signedInAs('uid_b');
  let calls = stubAuth('uid_b');
  onTabsMessage({ type: 'signout-owed', uid: 'uid_a' });
  assert.equal(calls.n, 0, "B's session is not A's to end");
  cleanUp();
  calls = stubAuth(null);
  onTabsMessage({ type: 'signout-owed', uid: 'uid_a' });
  assert.equal(calls.n, 0, 'nobody signed in here');
  cleanUp();
  signedInAs('uid_a');
  calls = stubAuth('uid_a');
  runInContext(`signOutOwed('uid_a');`, ctx);
  onTabsMessage({ type: 'signout-owed', uid: 'uid_a' });
  assert.equal(calls.n, 0, 'this tab is on it');
  onTabsMessage({ type: 'nonsense', uid: 'uid_a' });
  onTabsMessage(null);
  onTabsMessage({ type: 'signout-owed', uid: 42 });
  assert.equal(calls.n, 0);
  cleanUp();
});

test('checkOwedSignOut(): finishes an abandoned sign-out, and leaves one still kept up (heartbeat or lock) to its tab', async () => {
  ls.clear();
  signedInAs('uid_a');
  const calls = stubAuth('uid_a');
  ls.setItem(PENDING, JSON.stringify({ uid: 'uid_a', at: Date.now() }));
  await checkOwedSignOut();
  assert.equal(calls.n, 0, 'its tab is alive');
  assert.notEqual(runInContext('_owedCheck', ctx), undefined, 'and is looked at again later (it may yet crash)');
  // its heartbeat is late (a hidden or suspended tab), but it still holds the lock
  ls.setItem(PENDING, JSON.stringify({ uid: 'uid_a', at: Date.now() - 60000 }));
  ctx.navigator.locks = { query: async () => ({ held: [{ name: 'brainfy-signout-owed:uid_a', mode: 'exclusive' }], pending: [] }) };
  await checkOwedSignOut();
  assert.equal(calls.n, 0);
  // gone: no heartbeat, no lock (closed or crashed)
  ctx.navigator.locks = { query: async () => ({ held: [], pending: [] }) };
  await checkOwedSignOut();
  assert.equal(calls.n, 1);
  // without the Web Locks API the heartbeat alone decides
  delete ctx.navigator.locks;
  await checkOwedSignOut();
  assert.equal(calls.n, 2);
  // another account's marker: not this session's to end
  ls.setItem(PENDING, JSON.stringify({ uid: 'uid_x', at: 0 }));
  await checkOwedSignOut();
  assert.equal(calls.n, 2);
  cleanUp();
});

test('the tab that owes a sign-out holds a Web Lock until it is settled', async () => {
  ls.clear();
  const reqs = [];
  ctx.navigator.locks = { request: (name, cb) => { const r = { name, released: false }; reqs.push(r); Promise.resolve(cb()).then(() => { r.released = true; }); return Promise.resolve(); } };
  signedInAs('uid_a');
  runInContext(`signOutOwed('uid_a');`, ctx);
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].name, 'brainfy-signout-owed:uid_a');
  await new Promise(r => setTimeout(r, 5));
  assert.equal(reqs[0].released, false, 'held while the sign-out is owed');
  runInContext(`signOutSettled();`, ctx);
  await new Promise(r => setTimeout(r, 5));
  assert.equal(reqs[0].released, true);
  cleanUp();
});

test('"Stay signed in": the other tabs hear it, and one that held its session back restores it', () => {
  ls.clear();
  signedInAs('uid_a');
  const sent = fakeChannel();
  runInContext(`S.userName = 'Ada'; signOutOwed('uid_a'); signOutCalledOff();`, ctx);
  assert.deepEqual(plainMsgs(sent), [{ type: 'signout-called-off', uid: 'uid_a' }]);
  cleanUp();
  // the tab that held back
  const restored = [];
  ctx.__restored = restored;
  stubAuth('uid_a');
  runInContext(`_heldBack = true; _onAuthState = u => { __restored.push(u.uid); return Promise.resolve(); };`, ctx);
  onTabsMessage({ type: 'signout-called-off', uid: 'uid_a' });
  assert.deepEqual(Array.from(restored), ['uid_a']);
  assert.equal(runInContext('_heldBack', ctx), false);
  onTabsMessage({ type: 'signout-called-off', uid: 'uid_a' });
  assert.equal(restored.length, 1, 'once');
  cleanUp();
});

test('"deleting" in another tab: this tab of the account sends nothing more to the cloud; "resume" carries on', async () => {
  ls.clear();
  const writes = [];
  ctx.firebase = {
    auth: () => ({ currentUser: { uid: 'uid_a' }, signOut: () => Promise.resolve() }),
    firestore: () => ({ collection: () => ({ doc: () => ({ set: d => { writes.push(d); return Promise.resolve(); } }) }) }),
  };
  signedInAs('uid_a');
  runInContext(`cloudReadOk = true; S.tasks.push({ id: 1, text: 'tab2-edit', done: false });`, ctx);
  save();
  assert.notEqual(runInContext('_pendingSaveTimer', ctx), undefined, 'a write is queued');
  onTabsMessage({ type: 'deleting', uid: 'uid_a' });
  assert.equal(runInContext('_pendingSaveTimer', ctx), undefined, 'the queued write is dropped');
  assert.equal(runInContext('_sessionClosing', ctx), true);
  assert.equal(runInContext('_deletingElsewhere', ctx), 'uid_a');
  runInContext(`S.tasks.push({ id: 2, text: 'tab2-edit-2', done: false });`, ctx);
  save();
  assert.equal(runInContext('_pendingSaveTimer', ctx), undefined, 'nothing more is queued');
  assert.equal(json(KEY).tasks.length, 2, 'the edits are still stored on the device');
  // any other way to the cloud (a sign-out's flush, a retry) is shut too
  assert.equal(await runInContext(`writeCloud(userDoc(), 'uid_a', _sessionEpoch)`, ctx), false);
  assert.equal(writes.length, 0);
  // the deletion stopped with nothing deleted: the unsynced edits go up after all
  onTabsMessage({ type: 'resume', uid: 'uid_a' });
  assert.equal(runInContext('_sessionClosing', ctx), false);
  assert.equal(runInContext('_deletingElsewhere', ctx), null);
  assert.notEqual(runInContext('_pendingSaveTimer', ctx), undefined, 'the unsynced edits are on their way');
  cleanUp();
});

test('"deleting" for another account changes nothing here', () => {
  ls.clear();
  signedInAs('uid_b');
  onTabsMessage({ type: 'deleting', uid: 'uid_a' });
  assert.equal(runInContext('_sessionClosing', ctx), false);
  assert.equal(runInContext('_deletingElsewhere', ctx), null);
  onTabsMessage({ type: 'resume', uid: 'uid_a' });
  assert.equal(runInContext('_sessionClosing', ctx), false);
  cleanUp();
});
