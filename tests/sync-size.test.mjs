// Tests for AUDIT-2026-10-17.md P0-5: the whole app state is ONE Firestore
// document (users/{uid}, 1 MiB max), and one AI-imported PDF kept inline used
// to push it over the limit so that every later save failed.
//
// Covered here (the pure parts): the size check in front of every cloud write
// and its once-per-pause message, the selection of inline originals to move to
// Storage (and of those that may be dropped), the room a library upload may
// take inline (also for several files picked at once), the localStorage quota
// message, and the client's upload type/size rules against storage.rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runInContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadBundle, plain } from './_bundle.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ctx = loadBundle();
const { userDocBytes, tooLargeToSync, cloudWriteFits, inlineOriginalsToMove, originalsToDrop, isQuotaError, storeWorkingCopy,
  uploadMime, storableType, storedMime, dataUrlToBlob, inlineCost, fitsInline } = ctx;
const LIMIT   = runInContext('FIRESTORE_DOC_LIMIT', ctx);
const BUDGET  = runInContext('USER_DOC_BUDGET', ctx);
const MAX     = runInContext('SYNC_DOC_MAX', ctx);
const INLINE  = runInContext('DOC_INLINE_MAX', ctx);
const HARDMAX = runInContext('DOC_HARD_MAX', ctx);

// Record toasts instead of touching the (stub) DOM.
ctx.__toasts = [];
runInContext('showToast = function (m, t) { __toasts.push([m, t]); }', ctx);
const toasts = () => ctx.__toasts.splice(0);
const epoch = () => runInContext('_sessionEpoch', ctx);
const syncState = () => runInContext('syncState', ctx);

const subject = (docs = [], extra = {}) => ({ id: 1, name: 'Bio', desc: '', docs: docs.length, color: '#7c3aed', accessed: 0, cards: [], documents: docs, ...extra });
const state = (subjects = [], extra = {}) => ({ subjects, sessions: [], tasks: [], timetable: [], nextId: 100, ...extra });
const fileDoc = (id, chars, extra = {}) => ({ id, name: `f${id}.pdf`, type: 'file', mime: 'application/pdf', date: id,
  content: 'data:application/pdf;base64,' + 'A'.repeat(Math.max(0, chars - 28)), ...extra });
// A state whose userDocBytes is exactly `target` (one note sized to fit).
function stateOfBytes(target) {
  const st = state([subject([{ id: 1, name: 'n', type: 'note', content: '', date: 1 }])]);
  st.subjects[0].documents[0].content = 'x'.repeat(target - userDocBytes(st));
  assert.equal(userDocBytes(st), target);
  return st;
}

test('the sync budget sits between the import budget and Firestore\'s hard limit', () => {
  assert.equal(LIMIT, 1048576);
  assert.ok(MAX > BUDGET, 'deck imports keep their projected size under USER_DOC_BUDGET; sync must not pause below it');
  assert.ok(MAX < LIMIT && MAX >= LIMIT * 0.9, 'a margin under 1 MiB, but not one that pauses sync for documents Firestore accepts');
});

test('tooLargeToSync measures the document the way Firestore does, at the boundary', () => {
  assert.equal(tooLargeToSync(state()), false);
  assert.equal(tooLargeToSync(stateOfBytes(MAX)), false);
  assert.equal(tooLargeToSync(stateOfBytes(MAX + 1)), true);
  // Multi-byte text counts in UTF-8 bytes, not characters.
  const st = state([subject([{ id: 1, name: 'n', type: 'note', content: 'é'.repeat(Math.ceil(MAX / 2) + 10), date: 1 }])]);
  assert.ok(JSON.stringify(st).length < MAX, 'its JSON length is under the budget…');
  assert.equal(tooLargeToSync(st), true, '…but its UTF-8 size is not');
});

test('cloudWriteFits refuses an oversized write, says so once per pause, and resumes by itself', () => {
  const e = epoch();
  const big = stateOfBytes(MAX + 5000), small = state();
  toasts();
  assert.equal(cloudWriteFits(small, e), true, 'a normal document is sent');
  assert.deepEqual(toasts(), []);

  assert.equal(cloudWriteFits(big, e), false, 'an oversized document is not sent');
  assert.equal(syncState(), 'error');
  assert.equal(runInContext('syncPausedForSize()', ctx), true);
  let t = toasts();
  assert.equal(t.length, 1, 'one message');
  assert.match(t[0][0], /1 MB/);
  assert.match(t[0][0], /Delete large documents/);

  for (let i = 0; i < 5; i++) assert.equal(cloudWriteFits(big, e), false);
  assert.deepEqual(toasts(), [], 'not repeated on every save');

  assert.equal(cloudWriteFits(small, e), true, 'back under budget → sent again');
  assert.equal(runInContext('syncPausedForSize()', ctx), false);
  t = toasts();
  assert.equal(t.length, 1);
  assert.match(t[0][0], /resumed/);

  assert.equal(cloudWriteFits(big, e), false, 'a new pause…');
  assert.equal(toasts().length, 1, '…is reported again');
  cloudWriteFits(small, e); toasts();
});

test('cloudWriteFits stays quiet while inline originals are being moved to Storage', () => {
  const e = epoch();
  runInContext(`_originalsMovingIn = ${e}`, ctx);
  try {
    toasts();
    assert.equal(cloudWriteFits(stateOfBytes(MAX + 1), e), false);
    assert.deepEqual(toasts(), [], 'the move saves again when it is done; no alarm meanwhile');
    assert.equal(runInContext('syncPausedForSize()', ctx), false);
  } finally { runInContext('_originalsMovingIn = -1', ctx); }
});

test('cloudWriteFits ignores a write from an ended session', () => {
  toasts();
  assert.equal(cloudWriteFits(stateOfBytes(MAX + 1), epoch() - 1), false);
  assert.deepEqual(toasts(), [], 'no message about a previous account');
  assert.equal(runInContext('syncPausedForSize()', ctx), false);
});

test('inlineOriginalsToMove picks every large inline original, largest first', () => {
  const keptMax = inlineCost(INLINE);   // see the next test
  const st = state([
    subject([fileDoc(1, 100_000), fileDoc(2, 600_000), { id: 3, name: 'note', type: 'note', content: 'n'.repeat(400_000), date: 3 }]),
    subject([fileDoc(4, keptMax), fileDoc(5, keptMax - 1), fileDoc(6, 300_000, { storagePath: 'x', content: '' }),
      // A text file AI-imported before the fix kept its text, not a data: URL.
      { id: 7, name: 'data.csv', type: 'file', mime: 'text/csv', content: 'é,1\n'.repeat(60_000), date: 7 }], { id: 2, name: 'Chem' }),
  ]);
  const picked = plain(inlineOriginalsToMove(st)).map(o => [o.subjectId, o.docId]);
  assert.deepEqual(picked, [[1, 2], [2, 7], [2, 4]], 'file docs with inline content (not notes, not Storage-backed), larger than a library upload keeps inline');
  assert.equal(plain(inlineOriginalsToMove(st))[1].bytes, 60_000 * 5, 'sized in UTF-8 bytes');
});

test('inlineOriginalsToMove leaves alone what a library upload keeps inline', () => {
  // readAndAddDoc() keeps a file under DOC_INLINE_MAX bytes inline, as a data:
  // URL (4/3 the size). Measured against DOC_INLINE_MAX itself, such a file
  // was kept inline at upload and then moved to Storage at the next load.
  const keptInline = 'data:application/pdf;base64,' + 'A'.repeat(Math.ceil((INLINE - 1) / 3) * 4);
  const keptMax = inlineCost(INLINE);
  assert.ok(keptInline.length > INLINE && keptInline.length < keptMax);
  const st = state([subject([{ id: 8, name: 'lib.pdf', type: 'file', mime: 'application/pdf', content: keptInline, date: 8 },
    fileDoc(5, keptMax - 1), fileDoc(4, keptMax)])]);
  assert.ok(userDocBytes(st) <= BUDGET, 'within budget: only size decides');
  assert.deepEqual(plain(inlineOriginalsToMove(st)).map(o => o.docId), [4]);
});

test('inlineOriginalsToMove also takes small ones while the document is over budget', () => {
  // Many small inline files, together over the budget: the largest go first
  // until what is left fits, and the rest stay inline.
  const docs = Array.from({ length: 8 }, (_, i) => fileDoc(i + 1, 150_000 - i * 1000));
  const st = state([subject(docs)]);
  assert.ok(userDocBytes(st) > BUDGET);
  const picked = plain(inlineOriginalsToMove(st));
  assert.ok(picked.length > 0 && picked.length < docs.length, `moves some, not all (${picked.length})`);
  assert.deepEqual(picked.map(o => o.docId), picked.map(o => o.docId).slice().sort((a, b) => a - b), 'largest first');
  const left = docs.filter(d => !picked.some(p => p.docId === d.id));
  assert.ok(userDocBytes(state([subject(left)])) <= BUDGET, 'what stays inline fits the budget');
  assert.deepEqual(plain(inlineOriginalsToMove(state([subject(left)]))), [], 'and nothing more is picked next time');
});

test('originalsToDrop removes as few unstorable originals as it takes, and none when that would not help', () => {
  assert.deepEqual(plain(originalsToDrop(MAX, [500_000])), [], 'already fits: nothing is removed');
  assert.deepEqual(plain(originalsToDrop(MAX + 100, [50, 300, 200])), [1], 'the largest alone is enough');
  assert.deepEqual(plain(originalsToDrop(MAX + 450, [300, 200, 100])), [0, 1], 'largest first, stopping once it fits');
  assert.deepEqual(plain(originalsToDrop(MAX + 1000, [300, 200])), [], 'all of them would not be enough: keep them');
  assert.deepEqual(plain(originalsToDrop(MAX + 1, [])), []);
  assert.deepEqual(plain(originalsToDrop(MAX + 500, [500])), [0], 'exactly enough');
});

test('inlineOriginalsToMove tolerates junk', () => {
  assert.deepEqual(plain(inlineOriginalsToMove(state())), []);
  assert.deepEqual(plain(inlineOriginalsToMove({ subjects: [null, { id: 1 }, { id: 2, documents: [null, { type: 'file' }, { type: 'file', content: 5 }] }] })), []);
});

test('dataUrlToBlob decodes base64 and plain data URLs', async () => {
  ctx.Blob = Blob; ctx.atob = atob;
  const bytes = Buffer.from([0, 1, 2, 250, 255, 37, 80]);
  const b = dataUrlToBlob('data:application/pdf;base64,' + bytes.toString('base64'));
  assert.equal(b.type, 'application/pdf');
  assert.deepEqual(Buffer.from(await b.arrayBuffer()), bytes);
  const t = dataUrlToBlob('data:text/plain;charset=utf-8,hello%20world');
  assert.equal(t.type, 'text/plain');
  assert.equal(await t.text(), 'hello world');
  assert.equal(dataUrlToBlob('not a data url'), null);
  assert.equal(dataUrlToBlob('data:image/png;base64,***'), null, 'corrupt base64 → null, not a throw');
});

test('isQuotaError recognises every browser\'s quota error and nothing else', () => {
  assert.equal(isQuotaError({ name: 'QuotaExceededError', code: 22 }), true);          // Chrome, Safari
  assert.equal(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED', code: 1014 }), true); // old Firefox
  assert.equal(isQuotaError({ code: 22 }), true);
  assert.equal(isQuotaError({ name: 'SecurityError', code: 18 }), false);              // storage blocked
  assert.equal(isQuotaError(new TypeError('x')), false);
  assert.equal(isQuotaError(null), false);
  assert.equal(isQuotaError(undefined), false);
});

test('storeWorkingCopy reports a full quota once until a write succeeds again', () => {
  const ls = ctx.localStorage, realSet = ls.setItem;
  const quota = () => { const e = new Error('full'); e.name = 'QuotaExceededError'; e.code = 22; throw e; };
  try {
    toasts();
    assert.equal(storeWorkingCopy(state()), true);
    assert.deepEqual(toasts(), []);
    ls.setItem = quota;
    assert.equal(storeWorkingCopy(state()), false);
    assert.equal(storeWorkingCopy(state()), false);
    assert.equal(storeWorkingCopy(state()), false);
    let t = toasts();
    assert.equal(t.length, 1, 'one message for three failed saves');
    assert.match(t[0][0], /storage is full/);
    assert.match(t[0][0], /still sync/, 'a small document still syncs, and the message says so');

    ls.setItem = realSet;
    assert.equal(storeWorkingCopy(state()), true);
    ls.setItem = quota;
    assert.equal(storeWorkingCopy(stateOfBytes(MAX + 1)), false);
    t = toasts();
    assert.equal(t.length, 1, 'a new episode is reported again');
    assert.match(t[0][0], /too large to sync or to save/, 'and does not claim it syncs when it cannot');

    ls.setItem = () => { const e = new Error('denied'); e.name = 'SecurityError'; throw e; };
    runInContext('_quotaWarnedIn = -1', ctx);
    assert.equal(storeWorkingCopy(state()), false);
    assert.deepEqual(toasts(), [], 'only the quota case is announced');
  } finally { ls.setItem = realSet; }
});

test('uploadMime fills in what browsers leave out and normalises aliases', () => {
  assert.equal(uploadMime('notes.md', ''), 'text/markdown');
  assert.equal(uploadMime('IMG_0001.HEIC', ''), 'image/heic');
  assert.equal(uploadMime('deck.pptx', 'application/octet-stream'), 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  assert.equal(uploadMime('a.pdf', 'application/pdf'), 'application/pdf');
  assert.equal(uploadMime('a.txt', 'text/plain;charset=UTF-8'), 'text/plain');
  assert.equal(uploadMime('p.jpg', 'image/jpg'), 'image/jpeg');
  assert.equal(uploadMime('s.mp3', 'audio/mp3'), 'audio/mpeg');
  assert.equal(uploadMime('page.html', 'text/html'), 'text/html', 'a real type is kept as is (and then refused)');
  assert.equal(uploadMime('mystery', ''), '');
});

test('storableType allows study files and refuses anything a browser renders as a page', () => {
  for (const t of ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'text/plain', 'text/markdown', 'text/csv',
    'application/json', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.oasis.opendocument.text', 'application/epub+zip', 'audio/mpeg', 'audio/x-m4a',
    'video/mp4', 'video/webm', 'video/quicktime']) {
    assert.equal(storableType(t), true, t);
  }
  for (const t of ['text/html', 'image/svg+xml', 'application/xhtml+xml', 'text/xml', 'application/xml', 'application/javascript',
    'text/javascript', 'application/octet-stream', 'application/x-msdownload', 'application/zip', 'video/x-msvideo', '', 'application/pdfx',
    'xapplication/pdf', 'image/png\n', 'text/x-python']) {
    assert.equal(storableType(t), false, JSON.stringify(t));
  }
});

test('storedMime keeps other text as text/plain and refuses what can\'t be kept', () => {
  const cases = [
    ['lesson.py', 'text/x-python', 'text/plain'], ['page.html', 'text/html', 'text/plain'], ['captions.vtt', 'text/vtt', 'text/plain'],
    ['paper.tex', 'application/x-tex', 'text/plain'], ['notes.xml', 'application/xml', 'text/plain'], ['app.js', 'application/javascript', 'text/plain'],
    ['refs.bib', '', 'text/plain'], ['odd.txt', 'application/octet-stream', 'text/plain'],
    ['a.pdf', 'application/pdf', 'application/pdf'], ['notes.md', '', 'text/markdown'], ['clip.mp4', 'video/mp4', 'video/mp4'],
    ['clip.mov', '', 'video/quicktime'], ['photo.jpg', 'image/jpg', 'image/jpeg'],
    ['pic.svg', 'image/svg+xml', ''], ['archive.zip', 'application/zip', ''], ['setup.exe', 'application/x-msdownload', ''],
    ['mystery', '', ''], ['clip.avi', 'video/x-msvideo', ''],
  ];
  for (const [name, type, want] of cases) assert.equal(storedMime(name, type), want, `${name} (${type})`);
  for (const [name, type] of cases) { const m = storedMime(name, type); if (m) assert.equal(storableType(m), true, `${name} is kept as ${m}, which the rules must accept`); }
  // The library's picker offers only what can be kept.
  const accept = runInContext('DOC_ACCEPT', ctx).split(',');
  assert.ok(accept.includes('text/*') && accept.includes('.pdf') && accept.includes('.py') && accept.includes('.mp4'));
  for (const a of accept.filter(x => x.startsWith('.'))) assert.notEqual(storedMime('file' + a, ''), '', `picker offers ${a}`);
});

test('fitsInline keeps a small file inline only while the document has room for it', () => {
  assert.ok(inlineCost(3000) >= 4000 && inlineCost(3000) <= 4000 + 1100, 'base64 (4/3) plus room for the prefix and fields');
  assert.equal(fitsInline(1000, 0, INLINE - 1), true);
  assert.equal(fitsInline(1000, 0, INLINE), false, 'DOC_INLINE_MAX and up go to Storage');
  assert.equal(fitsInline(BUDGET - inlineCost(1000), 0, 1000), true, 'exactly at the budget');
  assert.equal(fitsInline(BUDGET - inlineCost(1000) + 1, 0, 1000), false);
  assert.equal(fitsInline(1000, BUDGET - 1000 - inlineCost(1000) + 1, 1000), false, 'room reserved by files still being read counts');
});

test('several files picked at once can\'t together push the document over budget', () => {
  // readAndAddDoc() for a whole selection runs before any file has been read:
  // each one that stays inline must reserve its room.
  const readers = [], uploads = [];
  ctx.FileReader = class { readAsDataURL(f) { this.file = f; readers.push(this); } };
  ctx.__uploads = uploads;
  ctx.firebase = { storage() { return {}; } };
  const save = runInContext('[uploadFileToStorage, addDocToSubject, firebaseUser, S, docModalSubjId]', ctx);
  runInContext(`uploadFileToStorage = function (f, sid, mime) { __uploads.push([f.name, sid, mime]); };
    addDocToSubject = function (doc, sid) { S.subjects.find(s => s.id === sid).documents.unshift(doc); };
    firebaseUser = { uid: 'u1' };`, ctx);
  try {
    ctx.__st = state([subject([])]);
    runInContext('S = __st; docModalSubjId = 1;', ctx);
    const size = 195 * 1024;
    const files = Array.from({ length: 6 }, (_, i) => ({ name: `slides-${i}.pdf`, type: 'application/pdf', size }));
    for (const f of files) ctx.readAndAddDoc(f);
    assert.ok(readers.length > 0 && readers.length < files.length, `some inline (${readers.length}), the rest to Storage`);
    assert.deepEqual(uploads.map(u => u[0]), files.slice(readers.length).map(f => f.name), 'the ones that do not fit are uploaded');
    assert.equal(runInContext('_inlinePending', ctx), readers.length * inlineCost(size), 'room reserved while they are read');
    // The reads finish: each is added inline, and the document stays within budget.
    for (const r of readers) { r.result = 'data:application/pdf;base64,' + 'A'.repeat(Math.ceil(size / 3) * 4); r.onloadend(); }
    assert.equal(runInContext('_inlinePending', ctx), 0, 'reservations released');
    const st = runInContext('S', ctx);
    assert.equal(st.subjects[0].documents.length, readers.length);
    assert.ok(userDocBytes(st) <= BUDGET, `document ${userDocBytes(st)} within ${BUDGET}`);
    assert.equal(tooLargeToSync(st), false);

    // A file whose room was taken while it was read (another edit) goes to Storage instead.
    readers.length = 0; uploads.length = 0;
    ctx.__st = state([subject([])]);
    runInContext('S = __st;', ctx);
    ctx.readAndAddDoc({ name: 'late.pdf', type: 'application/pdf', size });
    assert.equal(readers.length, 1);
    runInContext(`S.subjects[0].documents.push({ id: 5, name: 'big note', type: 'note', content: 'x'.repeat(${BUDGET - 1000}), date: 1 });`, ctx);
    readers[0].result = 'data:application/pdf;base64,AAAA'; readers[0].onloadend();
    assert.deepEqual(uploads.map(u => u[0]), ['late.pdf']);
    assert.equal(runInContext('S', ctx).subjects[0].documents.some(d => d.name === 'late.pdf'), false);

    // A read that fails releases its room.
    readers.length = 0;
    ctx.__st = state([subject([])]);
    runInContext('S = __st;', ctx);
    ctx.readAndAddDoc({ name: 'broken.pdf', type: 'application/pdf', size: 1000 });
    readers[0].result = null; toasts(); readers[0].onloadend();
    assert.equal(runInContext('_inlinePending', ctx), 0);
    assert.match(toasts()[0][0], /Couldn.t read broken\.pdf/);
  } finally {
    ctx.__restore = save;
    runInContext('[uploadFileToStorage, addDocToSubject, firebaseUser, S, docModalSubjId] = __restore; _inlinePending = 0;', ctx);
    delete ctx.firebase;
  }
});

test('the size notice says when a large file that could not be moved is what holds sync up', () => {
  const prev = runInContext('S', ctx);
  try {
    ctx.__st = state([subject([fileDoc(1, 1_000_000)])]);
    runInContext('S = __st;', ctx);
    toasts();
    runInContext('showSizeNotice()', ctx);
    assert.match(toasts()[0][0], /couldn.t be moved to cloud storage yet.*Tap the sync status to try again/);
    ctx.__st = stateOfBytes(MAX + 1);
    runInContext('S = __st;', ctx);
    runInContext('showSizeNotice()', ctx);
    assert.match(toasts()[0][0], /Most of it is notes: shorten or delete long notes/);
  } finally { ctx.__st = prev; runInContext('S = __st;', ctx); }
});

// ── Reviewer R3-1: a library upload is never removed to let sync resume ─────
// Library files under 200 KB were kept inline whatever their type before this
// fix, and storage.rules now refuses some of those types (SVG, ZIP, TIFF…).
const svgDoc = (id, kb, extra = {}) => ({ id, name: `diagram-${id}.svg`, type: 'file', mime: 'image/svg+xml', date: id,
  content: 'data:image/svg+xml;base64,' + Buffer.alloc(kb * 1024, id).toString('base64'), ...extra });

test('mayDropOriginal allows only an AI import\'s original, or one that does not decode', () => {
  const { mayDropOriginal } = ctx;
  assert.equal(mayDropOriginal({}, true), false, 'a library upload that decodes is the user\'s own file, maybe the only copy');
  assert.equal(mayDropOriginal({ aiText: '' }, true), false);
  assert.equal(mayDropOriginal({ aiText: 'Mitochondria make ATP' }, true), true, 'an AI import: its text, cards and summaries stay');
  assert.equal(mayDropOriginal({}, false), true, 'a data: URL that does not decode is something no one can open');
});

test('inlineStoreMime gives the type an inline original would be stored as, or none', () => {
  const { inlineStoreMime } = ctx;
  assert.equal(inlineStoreMime({ name: 'a.pdf', mime: 'application/pdf', content: 'data:application/pdf;base64,AAAA' }), 'application/pdf');
  assert.equal(inlineStoreMime({ name: 'scan', mime: '', content: 'data:image/png;base64,AAAA' }), 'image/png', 'the data: URL tells when the entry does not');
  assert.equal(inlineStoreMime({ name: 'diagram.svg', mime: 'image/svg+xml', content: 'data:image/svg+xml;base64,AAAA' }), '');
  assert.equal(inlineStoreMime({ name: 'old.zip', mime: '', content: 'data:application/zip;base64,AAAA' }), '');
  assert.equal(inlineStoreMime({ name: 'scan.tif', mime: 'image/tiff', content: 'data:image/tiff;base64,AAAA' }), '');
  assert.equal(inlineStoreMime({ name: 'notes.weird', mime: 'application/x-weird', content: 'text an AI import kept' }), 'text/plain', 'an imported text file is text, whatever its name');
  assert.equal(inlineStoreMime({ name: 'data.csv', mime: 'text/csv', content: 'a,b' }), 'text/csv');
  const picks = plain(inlineOriginalsToMove(state([subject([svgDoc(1, 700), fileDoc(2, 400_000)])])));
  assert.deepEqual(picks.map(o => [o.name, o.storable]), [['diagram-1.svg', false], ['f2.pdf', true]], 'each pick says whether Storage takes it');
});

test('nameList names up to three files, then counts the rest', () => {
  const { nameList } = ctx;
  assert.equal(nameList([]), '');
  assert.equal(nameList(['a']), '“a”');
  assert.equal(nameList(['a', 'b']), '“a” and “b”');
  assert.equal(nameList(['a', 'b', 'c']), '“a”, “b” and “c”');
  assert.equal(nameList(['a', 'b', 'c', 'd', 'e']), '“a”, “b”, “c” and 2 more');
});

test('droppedNotice names the files and claims only what is true of them', () => {
  const { droppedNotice } = ctx;
  const one = droppedNotice([{ name: 'lecture.pdf', damaged: false }]);
  assert.match(one, /^The original file of “lecture\.pdf” couldn’t be moved to cloud storage, so it was removed to let your data sync again\./);
  assert.match(one, /Its text stays in your Library, and the flashcards and summaries made from it are kept\.$/);
  const two = droppedNotice([{ name: 'a.pdf', damaged: false }, { name: 'b.pdf', damaged: false }]);
  assert.match(two, /original files of “a\.pdf” and “b\.pdf” couldn’t .* they were removed .* Their text stays/);
  const bad = droppedNotice([{ name: 'broken.png', damaged: true }]);
  assert.equal(bad, 'The original file of “broken.png” was damaged and couldn’t be opened, so it was removed to let your data sync again.');
  assert.doesNotMatch(bad, /flashcards|text stays/, 'nothing is said to be kept from a file nothing was made from');
});

// The caller, end to end (Storage refusing or unreachable): what is removed.
test('moveInlineOriginals never removes a library upload, only AI-import originals or damaged ones', async () => {
  ctx.Blob = Blob; ctx.atob = atob;
  ctx.firebase = { storage() { return {}; } };
  const saved = runInContext('[S, save, putOriginal, firebaseUser, sOwner, cloudReadOk]', ctx);
  ctx.__saves = 0; ctx.__puts = [];
  runInContext(`save = function () { __saves++; };
    putOriginal = function (blob, name, mime) { __puts.push([name, mime]); return Promise.reject({ code: 'storage/retry-limit-exceeded' }); };
    firebaseUser = { uid: 'u1' }; sOwner = 'u1'; cloudReadOk = true;`, ctx);
  const run = async docs => {
    ctx.__st = state([subject(docs)]);
    runInContext('S = __st;', ctx);
    toasts(); ctx.__saves = 0; ctx.__puts.length = 0;
    await ctx.moveInlineOriginalsNow();
    return runInContext('S', ctx).subjects[0].documents;
  };
  const removedToasts = () => toasts().map(t => t[0]).filter(t => /removed/.test(t));
  try {
    // Six 190 KB SVGs kept inline by the library before the rules were tightened: ~1.5 MB.
    let docs = await run(Array.from({ length: 6 }, (_, i) => svgDoc(i + 1, 190)));
    assert.ok(tooLargeToSync(runInContext('S', ctx)), 'still over the limit: sync stays paused');
    assert.deepEqual(docs.map(d => d.content.length > 250_000), [true, true, true, true, true, true], 'every library upload keeps its only copy');
    assert.deepEqual(ctx.__puts, [], 'none is sent to Storage, which refuses its type');
    assert.deepEqual(removedToasts(), []);
    assert.ok(ctx.__saves > 0, 'saved, so the size guard pauses sync and names the files');
    assert.match(ctx.sizeNotice(runInContext('S', ctx), true), /“diagram-1\.svg”, “diagram-2\.svg” and “diagram-3\.svg” are files cloud storage can’t take/);

    // A zip (no type on the entry) and a tiff: kept too.
    docs = await run([svgDoc(1, 700, { name: 'a.zip', mime: '', content: 'data:application/zip;base64,' + Buffer.alloc(700 * 1024, 1).toString('base64') }),
      svgDoc(2, 300, { name: 'b.tif', mime: 'image/tiff', content: 'data:image/tiff;base64,' + Buffer.alloc(300 * 1024, 2).toString('base64') })]);
    assert.ok(docs.every(d => d.content.length > 300_000), 'zip and tiff kept');
    assert.deepEqual(removedToasts(), []);

    // The same files from AI Import (aiText: its text, cards and summaries were made from it) may go, as few as it takes.
    docs = await run(Array.from({ length: 6 }, (_, i) => svgDoc(i + 1, 190, { aiText: 'what the AI read' })));
    const emptied = docs.filter(d => !d.content).map(d => d.name);
    assert.ok(emptied.length > 0 && emptied.length < 6, `as few as it takes (${emptied.length})`);
    assert.equal(tooLargeToSync(runInContext('S', ctx)), false, 'which is enough to sync again');
    assert.ok(docs.every(d => d.aiText === 'what the AI read'), 'entries and their text stay');
    const t = removedToasts();
    assert.equal(t.length, 1);
    assert.equal(t[0], ctx.droppedNotice(emptied.map(name => ({ name, damaged: false }))), 'the notice names them');

    // Library uploads with one AI import: removing the AI import's original alone wouldn't be
    // enough, so nothing is removed (and no library upload ever is).
    docs = await run([...Array.from({ length: 5 }, (_, i) => svgDoc(i + 1, 190)), svgDoc(9, 300, { aiText: 'x' })]);
    assert.ok(docs.every(d => d.content.length > 250_000), 'nothing removed');
    assert.deepEqual(removedToasts(), []);

    // A damaged data: URL (nothing made from it, but no one can open it) may go.
    docs = await run([svgDoc(1, 10, { name: 'broken.png', mime: 'image/png', content: 'data:image/png;base64,' + '*'.repeat(1_000_000) })]);
    assert.equal(docs[0].content, '');
    assert.deepEqual(removedToasts(), [ctx.droppedNotice([{ name: 'broken.png', damaged: true }])]);
  } finally {
    ctx.__restore = saved;
    runInContext('[S, save, putOriginal, firebaseUser, sOwner, cloudReadOk] = __restore;', ctx);
    delete ctx.firebase;
  }
});

test('the size notice names refused library files and asks for them to be downloaded and deleted, not retried', () => {
  const { sizeNotice } = ctx;
  assert.match(sizeNotice(state(), false), /too large to sync or to save on this device/);
  // Five 190 KB SVGs: the two largest are enough to get back under the limit.
  let m = sizeNotice(state([subject(Array.from({ length: 5 }, (_, i) => svgDoc(i + 1, 190)))]), true);
  assert.match(m, /^Sync paused: your study data is over the 1 MB cloud limit, so changes are only saved on this device\. /);
  assert.match(m, /“diagram-1\.svg” and “diagram-2\.svg” are files cloud storage can’t take, so they are kept inside your study data\./);
  assert.match(m, /Download them from your Library, then delete them there and syncing resumes by itself\.$/);
  assert.doesNotMatch(m, /Tap the sync status/, 'no retry that can never succeed');
  // One file, and deleting it isn't enough by itself.
  const big = { id: 50, name: 'n', type: 'note', content: 'n'.repeat(1_000_000), date: 1 };
  m = sizeNotice(state([subject([svgDoc(1, 190), big])]), true);
  assert.match(m, /“diagram-1\.svg” is a file cloud storage can’t take, so it is kept inside your study data\. Download it from your Library, then delete it there, along with other large documents or notes, to let syncing resume\.$/);
  // A storable file that could not be moved yet: retry.
  assert.match(sizeNotice(state([subject([svgDoc(1, 190), fileDoc(2, 900_000)])]), true), /Tap the sync status to try again/);
});

// ── Breaker R3-1: say what is heavy; imports keep only the text that fits ────
test('heaviestPart and the size notice say what makes the document heavy', () => {
  const { heaviestPart, sizeNotice } = ctx;
  const stored = (id, text) => ({ id, name: `imp-${id}.pdf`, type: 'file', mime: 'application/pdf', date: id, content: '',
    storagePath: `users/u/docs/1/${id}.pdf`, downloadURL: 'https://example.invalid/' + id, aiText: text });
  const imports = state([subject(Array.from({ length: 45 }, (_, i) => stored(i + 1, 'Ж'.repeat(12_000))))]);
  assert.ok(tooLargeToSync(imports), '45 Cyrillic imports, no file over 1 KB in the document');
  assert.equal(heaviestPart(imports), 'importText');
  assert.match(sizeNotice(imports, true), /Most of it is text kept from imported documents for summaries: delete imported documents you no longer need in your Library \(their flashcards stay\)/);
  const cards = state([subject([], { cards: Array.from({ length: 9000 }, (_, i) => ({ q: 'Question number ' + i, a: 'An answer that is long enough ' + i + 'x'.repeat(60) })) })]);
  assert.ok(tooLargeToSync(cards));
  assert.equal(heaviestPart(cards), 'cards');
  assert.match(sizeNotice(cards, true), /Most of it is flashcards: delete flashcards or subjects/);
  assert.equal(heaviestPart(stateOfBytes(MAX + 1)), 'notes');
  const mixed = state([subject([{ id: 1, name: 'n', type: 'note', content: 'n'.repeat(400_000), date: 1 }, stored(2, 'y'.repeat(12_000))],
    { cards: [{ q: 'q', a: 'a'.repeat(400_000) }] })], { sessions: [{ date: 1, duration: 1, notes: 's'.repeat(300_000) }] });
  assert.equal(heaviestPart(mixed), 'other', 'no single kind is most of it');
  assert.match(sizeNotice(mixed, true), /Delete large documents or notes in your Library and syncing resumes by itself\.$/);
  assert.equal(heaviestPart({ subjects: [null, { id: 1, documents: [null, { type: 'file' }] }] }), 'other', 'tolerates junk');
});

test('aiTextToKeep keeps an import\'s text only as far as the document has room', () => {
  const { aiTextToKeep } = ctx;
  const MIN = runInContext('AI_TEXT_MIN', ctx);
  const withRoom = r => BUDGET - 1024 - r;   // a document size that leaves `r` bytes for the text
  assert.equal(aiTextToKeep(10_000, 'x'.repeat(12_000)), 'x'.repeat(12_000), 'room: all of it');
  assert.equal(aiTextToKeep(withRoom(12_000), 'x'.repeat(12_000)).length, 12_000, 'exactly enough');
  assert.equal(aiTextToKeep(withRoom(5000), 'x'.repeat(12_000)).length, 5000);
  assert.equal(aiTextToKeep(withRoom(5001), 'é'.repeat(6000)).length, 2500, 'counted in UTF-8 bytes');
  const emoji = aiTextToKeep(withRoom(4999), '😀'.repeat(3000));
  assert.equal(emoji.length, 1249 * 2, 'a surrogate pair is never split');
  assert.equal(aiTextToKeep(withRoom(MIN - 1), 'x'.repeat(12_000)), '', 'too little room: none');
  assert.equal(aiTextToKeep(BUDGET + 5000, 'x'.repeat(5000)), '', 'already over budget: none');
});

test('an AI import keeps its cards and text when its original is over 25 MB, and only the text that fits', () => {
  const saved = runInContext('[S, addDocToSubject, attachOriginal, firebaseUser]', ctx);
  ctx.__added = []; ctx.__attached = [];
  ctx.firebase = { storage() { return {}; } };
  runInContext(`addDocToSubject = function (d, sid) { __added.push([d, sid]); };
    attachOriginal = function (f) { __attached.push(f.name); }; firebaseUser = { uid: 'u1' };`, ctx);
  try {
    assert.ok(runInContext('AI_IMPORT_MAX', ctx) > HARDMAX, 'AI Import reads files larger than an original may be stored');
    ctx.__st = state([subject([])]);
    runInContext('S = __st;', ctx);
    toasts();
    ctx.saveImportOriginal({ name: 'textbook.pdf', type: 'application/pdf', size: HARDMAX + 1 }, 1, 'chapter one');
    assert.deepEqual(ctx.__attached, [], 'no upload that storage.rules would refuse');
    assert.equal(ctx.__added[0][0].aiText, 'chapter one', 'the entry and its text are kept');
    assert.deepEqual(toasts().map(t => t[0]), ['Couldn’t keep the original “textbook.pdf” (it is over 25 MB). Your flashcards and summary are kept, and so is its text in your library.']);
    ctx.saveImportOriginal({ name: 'ok.pdf', type: 'application/pdf', size: HARDMAX }, 1, 'x');
    assert.deepEqual(ctx.__attached, ['ok.pdf'], 'exactly 25 MB is uploaded');
    // Close to the budget: only the text that fits is kept, and the user is told.
    ctx.__added.length = 0;
    ctx.__st = stateOfBytes(BUDGET - 1024 - 3000);
    runInContext('S = __st;', ctx);
    toasts();
    ctx.saveImportOriginal({ name: 'notes.pdf', type: 'application/pdf', size: 1000 }, 1, 'y'.repeat(12_000));
    assert.equal(ctx.__added[0][0].aiText.length, 3000);
    assert.match(toasts()[0][0], /close to the 1 MB cloud limit, so only part of the text of “notes\.pdf” was kept for later summaries/);
  } finally {
    ctx.__restore = saved;
    runInContext('[S, addDocToSubject, attachOriginal, firebaseUser] = __restore;', ctx);
    delete ctx.firebase;
  }
});

// storage.rules is published by hand: if it and the client disagree, uploads the
// app offers fail with "unauthorized", or the rules allow what the app refuses.
test('the client\'s upload rules match storage.rules', () => {
  const rules = readFileSync(join(root, 'storage.rules'), 'utf8');
  // The app refuses files over DOC_HARD_MAX (> 25 MiB): the rules take exactly 25 MiB too.
  assert.match(rules, /request\.resource\.size <= 25 \* 1024 \* 1024/);
  assert.equal(HARDMAX, 25 * 1024 * 1024);
  const fn = rules.slice(rules.indexOf('function isStudyFile'), rules.indexOf('}', rules.indexOf('function isStudyFile')));
  const exact = [...fn.matchAll(/t == '([^']+)'/g)].map(m => m[1]);
  const res = [...fn.matchAll(/t\.matches\('([^']+)'\)/g)].map(m => new RegExp('^(?:' + m[1] + ')$'));
  assert.ok(exact.length + res.length >= 5, 'parsed the rules');
  const rulesAllow = t => exact.includes(t) || res.some(r => r.test(t));
  const corpus = [...new Set([
    ...Object.values(runInContext('MIME_BY_EXT', ctx)),
    'text/html', 'image/svg+xml', 'text/xml', 'application/javascript', 'application/octet-stream', 'video/mp4', 'application/zip',
    'image/tiff', 'audio/x-wav', 'audio/webm', 'text/x-markdown', 'text/rtf', 'image/x-icon', 'application/x-sh', '',
    'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/mpeg', 'text/x-python', 'text/vtt',
  ])];
  for (const t of corpus) assert.equal(storableType(t), rulesAllow(t), `client and rules disagree on ${JSON.stringify(t)}`);
  for (const t of Object.values(runInContext('MIME_BY_EXT', ctx))) assert.equal(storableType(t), true, `the app maps an extension to ${t} but refuses it`);
});

// ── localStorage quota: a copy set aside is never deleted unstored ──────────
// localStorage holds ~5 MB per site, and a copy with one photo kept inline (as
// AI Import did before this fix) can be over half of that. Moving such a copy
// from the working slot to a slot of its own (another account's unsynced
// edits, data saved with no account) used to write the second copy first,
// ignore the quota error and then delete the first: the only copy.
const LS = {
  WORK: runInContext('STORAGE_KEY', ctx), META: runInContext('SYNC_META_KEY', ctx),
  UNCLAIMED: runInContext('UNCLAIMED_KEY', ctx), KEPT: runInContext('KEPT_PREFIX', ctx),
};
function withQuota(limit, fn, refuse = () => false) {
  const ls = ctx.localStorage, realSet = ls.setItem;
  ls.setItem = function (k, v) {
    v = String(v);
    let used = 0;
    for (const [key, val] of this._m) if (key !== k) used += key.length + val.length;
    if (refuse(k) || used + k.length + v.length > limit) { const e = new Error('full'); e.name = 'QuotaExceededError'; e.code = 22; throw e; }
    this._m.set(k, v);
  };
  ls.clear();
  const done = () => { ls.setItem = realSet; ls.clear(); };
  let r;
  try { r = fn(ls); } catch (e) { done(); throw e; }
  if (r && typeof r.then === 'function') return r.finally(done);   // an async test: once it has run
  done();
  return r;
}
const bigState = (chars, name = 'History') => state([subject([fileDoc(5, chars)], { name })], { tasks: [{ id: 7, text: 'guest task', done: false }] });

test('a copy over half the quota with no account moves to the unclaimed slot whole', () => {
  withQuota(1_000_000, ls => {
    const guest = bigState(600_000);
    ls._m.set(LS.WORK, JSON.stringify(guest));   // saved before signing in was required: no marker
    assert.equal(ctx.lsPut('probe', guest), false, 'a second copy does not fit next to the first');
    assert.equal(ctx.vacateWorkingCopy(null), true);
    const u = JSON.parse(ls.getItem(LS.UNCLAIMED));
    assert.equal(u.state.subjects[0].documents[0].content, guest.subjects[0].documents[0].content, 'its file kept too');
    assert.equal(u.state.tasks[0].text, 'guest task');
    assert.equal(ls.getItem(LS.WORK), null, 'the working slot is free for the account signing in');
  });
});

test('another account\'s unsynced copy over half the quota moves to its kept slot whole', () => {
  withQuota(1_000_000, ls => {
    const other = bigState(600_000);
    ls._m.set(LS.WORK, JSON.stringify(other));
    ls._m.set(LS.META, JSON.stringify({ uid: 'other', dirty: true }));
    assert.equal(ctx.vacateWorkingCopy('me'), true);
    const kept = JSON.parse(ls.getItem(LS.KEPT + 'other'));
    assert.equal(kept.subjects[0].documents[0].content.length, other.subjects[0].documents[0].content.length);
    assert.equal(ls.getItem(LS.WORK), null);
    assert.equal(ls.getItem(LS.META), null);
  });
});

test('keepUnsynced moves an account\'s own large copy out of the working slot', () => {
  withQuota(1_000_000, ls => {
    const mine = bigState(600_000);
    ls._m.set(LS.WORK, JSON.stringify(mine));
    ls._m.set(LS.META, JSON.stringify({ uid: 'u1', dirty: true }));
    mine.tasks.push({ id: 8, text: 'edit not stored yet', done: false });
    assert.equal(ctx.keepUnsynced('u1', mine), 'kept');
    const kept = JSON.parse(ls.getItem(LS.KEPT + 'u1'));
    assert.deepEqual(kept.tasks.map(t => t.text), ['guest task', 'edit not stored yet']);
    assert.equal(ls.getItem(LS.WORK), null, 'superseded, so it goes');
  });
});

test('a copy that cannot be stored anywhere else stays where it is', () => {
  withQuota(1_000_000, ls => {
    // The account's state in memory never fitted on this device: setting it
    // aside fails even with the working slot free, which keeps its last saved copy.
    const saved = JSON.stringify(bigState(600_000));
    ls._m.set(LS.WORK, saved);
    ls._m.set(LS.META, JSON.stringify({ uid: 'u1', dirty: true }));
    assert.equal(ctx.keepUnsynced('u1', bigState(1_200_000)), 'lost');
    assert.equal(ls.getItem(LS.WORK), saved, 'the working copy, byte for byte');
    assert.equal(ls.getItem(LS.KEPT + 'u1'), null);
    assert.equal(JSON.parse(ls.getItem(LS.META)).held, true, 'held there for u1 (nobody else overwrites it)');
    // Moving the working copy aside (as the next account signs in) then works.
    assert.equal(ctx.vacateWorkingCopy(null), true);
    const kept = JSON.parse(ls.getItem(LS.KEPT + 'u1'));
    assert.equal(kept.subjects[0].documents[0].content, JSON.parse(saved).subjects[0].documents[0].content);
    assert.equal(ls.getItem(LS.WORK), null);
  });
  withQuota(1_000_000, ls => {
    const saved = JSON.stringify(bigState(600_000));
    ls._m.set(LS.WORK, saved);
    assert.equal(ctx.vacateWorkingCopy(null), false, 'the unclaimed slot refuses it');
    assert.equal(ls.getItem(LS.WORK), saved, 'so the guest data is not deleted');
  }, k => k === LS.UNCLAIMED);
});

test('putInPlaceOfWorkingCopy leaves both keys as they were when the value does not fit', () => {
  withQuota(100, ls => {
    ls._m.set(LS.WORK, 'x'.repeat(40));
    assert.equal(ctx.putInPlaceOfWorkingCopy('b', 'y'.repeat(200)), false);
    assert.equal(ls.getItem(LS.WORK), 'x'.repeat(40));
    assert.equal(ls.getItem('b'), null);
    assert.equal(ctx.putInPlaceOfWorkingCopy('b', 'z'.repeat(60)), true, 'fits once the working copy is gone');
    assert.equal(ls.getItem(LS.WORK), null);
    assert.equal(JSON.parse(ls.getItem('b')), 'z'.repeat(60));
  });
});

test('an account signing in over a copy that could not be set aside leaves it alone', async () => {
  let full = true;   // the other account's kept slot has no room, until it has
  const restore = runInContext('[S, firebaseUser, sOwner, cloudReadOk, _lastSaved, _tabDirty, _localWriteOk]', ctx);
  await withQuota(1_000_000, async ls => {
    const theirs = JSON.stringify(bigState(600_000));
    ls._m.set(LS.WORK, theirs);
    ls._m.set(LS.META, JSON.stringify({ uid: 'other', dirty: true }));
    assert.equal(ctx.vacateWorkingCopy(null), false, 'no room to set it aside');
    // The account signing in works from the cloud alone: save() tries to move
    // the copy aside each time, and until that works stores and tags nothing.
    ctx.__st = state([subject()]);
    runInContext(`S = __st; firebaseUser = { uid: 'me' }; sOwner = 'me'; cloudReadOk = true; _lastSaved = null;`, ctx);
    toasts();
    try {
      runInContext('save(true)', ctx);
      assert.equal(runInContext('_localWriteOk', ctx), false, 'the new account stores nothing on the device…');
      assert.equal(ls.getItem(LS.WORK), theirs, '…so the other account\'s copy stays, byte for byte…');
      const tag = () => { const m = JSON.parse(ls.getItem(LS.META)); return `${m.uid}/${m.dirty}`; };
      assert.equal(tag(), 'other/true', '…and stays tagged as theirs (never loaded as the new account\'s)');
      assert.equal(ctx.localBelongsTo('me'), false);
      // A confirmed cloud write doesn't tag it as the new account's either.
      // (Every write is a transaction since P0-3: a Firestore stub that runs one.)
      ctx.firebase = { firestore: () => ({ runTransaction: fn => fn({ get: async () => ({ exists: false }), set() {} }) }) };
      try {
        assert.equal(await ctx.writeCloud({}, 'me', epoch(), runInContext('S', ctx)), true);
      } finally { delete ctx.firebase; }
      assert.equal(tag(), 'other/true');
      const t = toasts();
      assert.equal(t.length, 1);
      assert.match(t[0][0], /storage is full.*still sync/, 'the user is told changes still sync to their account');
      runInContext(`S.tasks.push({ id: 9, text: 'next edit', done: false }); save();`, ctx);
      assert.deepEqual(toasts(), [], 'once');
      // Once there is room to set it aside, the next save() does, and stores as usual.
      full = false;
      runInContext(`S.tasks.push({ id: 10, text: 'one more', done: false }); save();`, ctx);
      assert.equal(runInContext('_localWriteOk', ctx), true);
      const keptTheirs = JSON.parse(ls.getItem(LS.KEPT + 'other'));
      assert.equal(keptTheirs.subjects[0].documents[0].content, JSON.parse(theirs).subjects[0].documents[0].content, 'theirs, kept for them');
      assert.equal(ctx.localBelongsTo('me'), true);
      assert.deepEqual(JSON.parse(ls.getItem(LS.WORK)).tasks.map(x => x.text), ['next edit', 'one more']);
    } finally {
      ctx.__restore = restore;
      runInContext(`clearTimeout(_pendingSaveTimer); _pendingSaveTimer = undefined; _quotaWarnedIn = -1;
        [S, firebaseUser, sOwner, cloudReadOk, _lastSaved, _tabDirty, _localWriteOk] = __restore;`, ctx);
    }
  }, k => full && k === LS.KEPT + 'other');
});

// ── An AI-import entry is found again by what a merge keeps ─────────────────
test('entryAwaitingOriginal finds the entry after a merge renumbers it, and nothing else', () => {
  const prev = runInContext('S', ctx);
  try {
    const entry = { id: 10, name: 'chapter9.pdf', type: 'file', content: '', mime: 'application/pdf', size: 900000, date: 1794905868450 };
    const key = ctx.originalKey(entry);
    // The merge gave it a new id (and its subject another one); another
    // device's note now has its old id.
    ctx.__st = state([
      subject([{ id: 10, name: 'other device note', type: 'note', content: 'keep me', date: 5 }]),
      subject([{ ...entry, id: 11 }], { id: 3, name: 'Chem' }),
    ]);
    runInContext('S = __st;', ctx);
    const found = ctx.entryAwaitingOriginal(key);
    assert.equal(found.subjectId, 3);
    assert.equal(found.doc.id, 11);
    // Already attached (or holding inline content): not waiting any more.
    found.doc.storagePath = 'users/u/docs/3/x.pdf';
    assert.equal(ctx.entryAwaitingOriginal(key), null);
    ctx.__st = state([subject([{ ...entry, type: 'note' }, { ...entry, content: 'data:application/pdf;base64,AAAA' }])]);
    runInContext('S = __st;', ctx);
    assert.equal(ctx.entryAwaitingOriginal(key), null, 'a note, or a file with content, is never overwritten');
  } finally { ctx.__st = prev; runInContext('S = __st;', ctx); }
});

// ── One note can't stop sync for the whole account ──────────────────────────
test('saveDocNote refuses a note that would by itself push the document past the sync limit', () => {
  const prev = runInContext('[S, addDocToSubject, elInput]', ctx);
  const added = [];
  ctx.__added = added;
  let title = 'Chapter 1', body = '';
  ctx.__field = id => ({ value: id === 'docNoteTitle' ? title : body });
  runInContext('addDocToSubject = function (d) { __added.push(d); }; elInput = __field;', ctx);
  const realGet = ctx.document.getElementById;
  ctx.document.getElementById = id => id === 'docNoteContent' ? { value: body } : realGet(id);
  try {
    assert.ok(ctx.noteCost('é') >= 2 && ctx.noteCost('a', 'bc') === ctx.noteCost('abc'), 'UTF-8 bytes of the text and of what the AI keeps');
    ctx.__st = stateOfBytes(MAX - 20_000);
    runInContext('S = __st;', ctx);
    toasts();
    body = 'n'.repeat(10_000);
    ctx.saveDocNote();
    assert.equal(added.length, 1, 'a note that fits is saved');
    body = 'n'.repeat(30_000);
    ctx.saveDocNote();
    assert.equal(added.length, 1, 'one that would pause sync is not');
    assert.match(toasts()[0][0], /too long to save.*1 MB/);
    // Already over the limit (paused): a note is saved like any other edit; it
    // isn't what broke sync, and the size notice already says what to do.
    ctx.__st = stateOfBytes(MAX + 1);
    runInContext('S = __st;', ctx);
    body = 'short';
    ctx.saveDocNote();
    assert.equal(added.length, 2);
  } finally {
    ctx.document.getElementById = realGet;
    ctx.__restore = prev;
    runInContext('[S, addDocToSubject, elInput] = __restore;', ctx);
  }
});

// ── With the sign-out work (P0-4) ───────────────────────────────────────────
// A fake Storage: each put() is a task the test finishes, fails or cancels.
function fakeStorage() {
  const tasks = [];
  ctx.firebase = { storage: () => ({ ref: path => ({
    put: () => {
      const t = { path, cancelled: false, on(ev, prog, err, done) { t.fail = err; t.finish = done; },
        cancel() { t.cancelled = true; },
        snapshot: { ref: { getDownloadURL: () => Promise.resolve('https://files.example/' + path) } } };
      tasks.push(t);
      return t;
    },
    delete: () => Promise.resolve(),
  }) }) };
  return tasks;
}

test('a file the user is uploading warns before the tab closes, the way an owed sign-out does, and only meanwhile', async () => {
  const tasks = fakeStorage();
  const restore = runInContext('[firebaseUser]', ctx);
  runInContext(`firebaseUser = { uid: 'u1' };`, ctx);
  const warnings = () => ctx.listeners('beforeunload').length;
  try {
    assert.equal(warnings(), 0, 'no beforeunload listener while nothing needs one (back/forward cache)');
    const moved = ctx.putOriginal({ size: 1 }, 'old.pdf', 'application/pdf', 1, true);
    assert.equal(warnings(), 0, 'moving an old inline original is not an upload the user started');
    const up = ctx.putOriginal({ size: 1 }, 'notes.pdf', 'application/pdf', 1);
    assert.equal(warnings(), 1, 'closing the tab would stop it: the browser asks first');
    const up2 = ctx.putOriginal({ size: 1 }, 'more.pdf', 'application/pdf', 1);
    assert.equal(warnings(), 1, 'one listener, however many uploads');
    tasks[1].finish();
    assert.equal((await up).path, tasks[1].path);
    assert.equal(warnings(), 1, 'still one uploading');
    tasks[2].fail({ code: 'storage/unknown' });
    await assert.rejects(up2);
    assert.equal(warnings(), 0, 'none left: the listener goes');
    tasks[0].finish(); await moved;
    // An owed sign-out keeps its own warning when an upload ends meanwhile.
    runInContext(`signOutOwed('u1');`, ctx);
    const up3 = ctx.putOriginal({ size: 1 }, 'late.pdf', 'application/pdf', 1);
    tasks[3].finish(); await up3;
    assert.equal(warnings(), 1, 'the sign-out is still owed');
    runInContext(`signOutSettled();`, ctx);
    assert.equal(warnings(), 0);
  } finally {
    ctx.__restore = restore;
    runInContext('[firebaseUser] = __restore; signOutSettled();', ctx);
    delete ctx.firebase;
  }
});

test('resetSession stops the user\'s uploads and forgets them: no warning, no "still uploading" left for the next account', () => {
  const tasks = fakeStorage();
  const restore = runInContext('[S, firebaseUser, sOwner]', ctx);
  runInContext(`firebaseUser = { uid: 'u1' }; sOwner = 'u1';`, ctx);
  try {
    ctx.putOriginal({ size: 1 }, 'notes.pdf', 'application/pdf', 1).catch(() => {});
    runInContext(`_originalsUploading.add('notes.pdf\\n1');`, ctx);
    assert.equal(ctx.listeners('beforeunload').length, 1);
    runInContext('resetSession({ to: null })', ctx);
    assert.equal(tasks[0].cancelled, true, 'the upload is cancelled');
    assert.equal(runInContext('_userUploads.size + _uploads.size + _originalsUploading.size', ctx), 0);
    assert.equal(ctx.listeners('beforeunload').length, 0, 'even if the cancelled task never reports back');
  } finally {
    ctx.__restore = restore;
    runInContext('[S, firebaseUser, sOwner] = __restore;', ctx);
    delete ctx.firebase;
    ctx.localStorage.clear();
  }
});

test('a large kept copy becomes the working copy at sign-in even when the two don\'t fit side by side', async () => {
  const restore = runInContext('[S, firebaseUser, sOwner, cloudReadOk, _lastSaved, _tabDirty, _localWriteOk, authResolution, authResolutionUid, authResolved]', ctx);
  const user = { uid: 'u1', displayName: 'Ada', getIdToken: () => Promise.resolve('t') };
  const reset = () => runInContext(`authResolution = null; authResolutionUid = null; authResolved = false;
    firebaseUser = null; sOwner = null; cloudReadOk = false; _lastSaved = null; _tabDirty = false;
    clearTimeout(_pendingSaveTimer); _pendingSaveTimer = undefined; _quotaWarnedIn = -1;`, ctx);
  try {
    await withQuota(1_000_000, async ls => {
      const kept = bigState(600_000);
      ls._m.set(LS.KEPT + 'u1', JSON.stringify(kept));
      reset();
      await ctx.resolveStateAfterAuth(user);
      assert.equal(runInContext('_localWriteOk', ctx), true, 'stored on the device');
      assert.equal(ls.getItem(LS.KEPT + 'u1'), null, 'the kept copy made room for it, and went');
      const work = JSON.parse(ls.getItem(LS.WORK));
      assert.equal(work.subjects[0].documents[0].content, kept.subjects[0].documents[0].content);
      assert.equal(ctx.localBelongsTo('u1'), true);
      assert.equal(JSON.parse(ls.getItem(LS.META)).dirty, true, 'still unsynced: its next sign-in still merges it');
    });
    await withQuota(1_000_000, async ls => {
      // The device refuses it even so: the kept copy is put back as it was.
      const raw = JSON.stringify(bigState(600_000));
      ls._m.set(LS.KEPT + 'u1', raw);
      reset();
      toasts();
      await ctx.resolveStateAfterAuth(user);
      assert.equal(runInContext('_localWriteOk', ctx), false);
      assert.equal(ls.getItem(LS.KEPT + 'u1'), raw, 'byte for byte');
      assert.match(toasts().map(t => t[0]).join('\n'), /storage is full/, 'and the user is told');
      assert.equal(ls.getItem(LS.WORK), null);
    }, k => k === LS.WORK);
  } finally {
    ctx.__restore = restore;
    reset();
    runInContext('[S, firebaseUser, sOwner, cloudReadOk, _lastSaved, _tabDirty, _localWriteOk, authResolution, authResolutionUid, authResolved] = __restore;', ctx);
  }
});

test('a move that frees nothing still runs the size guard (save() would skip an unchanged state)', async () => {
  const restore = runInContext('[S, firebaseUser, sOwner, cloudReadOk, _lastSaved, save]', ctx);
  ctx.__saves = [];
  ctx.__st = state([subject([fileDoc(1, MAX + 10_000, { name: 'big.pdf', aiText: '' })])]);
  // Storage isn't available: nothing moves, and an AI import's original can't be dropped without aiText.
  runInContext(`S = __st; firebaseUser = { uid: 'u1' }; sOwner = 'u1'; cloudReadOk = true;
    save = function (force) { __saves.push(!!force); };`, ctx);
  try {
    await runInContext('moveInlineOriginals()', ctx);
    assert.deepEqual([...ctx.__saves], [true], 'one save, forced');
  } finally {
    ctx.__restore = restore;
    runInContext('[S, firebaseUser, sOwner, cloudReadOk, _lastSaved, save] = __restore; _originalsMovingIn = -1;', ctx);
  }
});

test('stopUploads (account deletion) cancels every upload and waits for each to report back, quietly', async () => {
  const tasks = fakeStorage();
  const restore = runInContext('[firebaseUser, _sessionClosing]', ctx);
  runInContext(`firebaseUser = { uid: 'u1' };`, ctx);
  try {
    toasts();
    const a = ctx.putOriginal({ size: 1 }, 'notes.pdf', 'application/pdf', 1);
    const b = ctx.putOriginal({ size: 1 }, 'old.pdf', 'application/pdf', 1, true);
    a.catch(() => {}); b.catch(() => {});
    runInContext('_sessionClosing = true;', ctx);   // as deleteAccount() has by then
    const t0 = Date.now();
    const stopped = runInContext('stopUploads(3000)', ctx);
    assert.deepEqual(tasks.map(t => t.cancelled), [true, true], 'both cancelled at once');
    setTimeout(() => tasks.forEach(t => t.fail({ code: 'storage/canceled' })), 100);
    await stopped;
    assert.ok(Date.now() - t0 < 2000, 'resolved once they reported back, not at the time limit');
    assert.equal(runInContext('_uploads.size', ctx), 0);
    assert.equal(runInContext(`uploadStopped({ code: 'storage/canceled' })`, ctx), true, 'stopped on purpose: no "upload failed" message');
    runInContext('_sessionClosing = false;', ctx);
    assert.equal(runInContext(`uploadStopped({ code: 'storage/canceled' })`, ctx), false, 'otherwise the user is told');
    // A task that never reports back doesn't hold the deletion up past the limit.
    runInContext('_sessionClosing = true;', ctx);
    ctx.putOriginal({ size: 1 }, 'stuck.pdf', 'application/pdf', 1).catch(() => {});
    const t1 = Date.now();
    await runInContext('stopUploads(300)', ctx);
    assert.ok(Date.now() - t1 >= 290 && Date.now() - t1 < 2000);
  } finally {
    ctx.__restore = restore;
    runInContext('[firebaseUser, _sessionClosing] = __restore; _uploads.clear(); _userUploads.clear(); updateLeaveWarning();', ctx);
    delete ctx.firebase;
  }
});
