// Tests for bounding what another user's public deck can put into the
// importer's state (review finding P0-2-R1-1, alongside AUDIT-2026-10-17.md P0-2).
//
// The rules cap a public deck's card COUNT but not each card's length, and the
// importer's whole library is ONE Firestore document (1 MiB max). So a deck is
// clamped to the same bounds publishDeck uses, and an import that would push the
// user's document past the budget is refused before it can break sync.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runInContext } from 'node:vm';
import { loadBundle, plain } from './_bundle.mjs';

const ctx = loadBundle();
const { utf8Bytes, firestoreValueSize, userDocBytes, projectedUserDocBytes, srsGrowthBytes, srsSchedule,
  clampDeckCards, parsePublicDeck, fetchPublicDecks } = ctx;
const LIMIT  = runInContext('FIRESTORE_DOC_LIMIT', ctx);
const BUDGET = runInContext('USER_DOC_BUDGET', ctx);

test('utf8Bytes matches a real UTF-8 encoder, including astral and lone surrogates', () => {
  for (const s of ['', 'abc', 'é', '€', '😀', 'a😀b€é', 'Ελληνικά', '中文字符', '\ud800', 'x\udc00y', '\ud83d']) {
    assert.equal(utf8Bytes(s), Buffer.byteLength(s, 'utf8'), JSON.stringify(s));
  }
});

test('firestoreValueSize follows Firestore storage-size rules', () => {
  assert.equal(firestoreValueSize('abc'), 4);          // UTF-8 bytes + 1
  assert.equal(firestoreValueSize('😀'), 5);
  assert.equal(firestoreValueSize(1), 8);               // every number is 8
  assert.equal(firestoreValueSize(2.5), 8);
  assert.equal(firestoreValueSize(true), 1);
  assert.equal(firestoreValueSize(null), 1);
  assert.equal(firestoreValueSize([]), 0);
  assert.equal(firestoreValueSize({}), 0);
  assert.equal(firestoreValueSize({ a: 'b' }), 2 + 2);  // key + value
  assert.equal(firestoreValueSize({ a: [1, 'x'] }), 2 + 8 + 2);
  assert.equal(firestoreValueSize({ a: undefined, b: null }), 2 + 1, 'undefined fields are not stored');
});

test('firestoreValueSize does not undercount number-heavy state the way JSON length would', () => {
  const cards = Array.from({ length: 100 }, () => ({ q: 'q', a: 'a', ease: 2.5, reps: 1, dueAt: 1, interval: 1, lapses: 0 }));
  assert.ok(firestoreValueSize({ cards }) > JSON.stringify({ cards }).length);
});

test('the user-document budget leaves headroom under the 1 MiB hard limit', () => {
  assert.equal(LIMIT, 1048576);
  assert.ok(BUDGET < LIMIT && BUDGET > LIMIT * 0.8);
  assert.ok(userDocBytes({ subjects: [] }) > 0);
});

test('clampDeckCards bounds count and length and drops junk', () => {
  const long = 'x'.repeat(5000);
  const raw = [null, 'str', { q: 'only q' }, { q: long, a: 7 }, ...Array.from({ length: 1500 }, (_, i) => ({ q: 'q' + i, a: 'a' + i, ease: 9 }))];
  const out = plain(clampDeckCards(raw));
  assert.equal(out.length, 1000);
  assert.equal(out[0].q.length, 2000);
  assert.equal(out[0].a, '7');
  assert.deepEqual(Object.keys(out[1]), ['q', 'a'], 'only q/a are copied from someone else\'s deck');
  assert.deepEqual(plain(clampDeckCards(undefined)), []);
  assert.deepEqual(plain(clampDeckCards({ length: 3 })), []);
});

test('parsePublicDeck clamps the free-text fields to publishDeck\'s bounds', () => {
  const d = parsePublicDeck('big1', { name: 'n'.repeat(500), desc: 'd'.repeat(5000), ownerName: 'o'.repeat(500), color: '#123456', cards: [{ q: 'q'.repeat(3000), a: 'a' }] }, 'x');
  assert.equal(d.name.length, 120);
  assert.equal(d.desc.length, 300);
  assert.equal(d.ownerName.length, 60);
  assert.equal(d.cards[0].q.length, 2000);
  assert.equal(d.cardCount, 1);
});

// ── importPublicDeckById, run against the real bundle ────────────────────────
const toasts = [];
ctx.__toasts = toasts;
runInContext('showToast = function (m, t) { __toasts.push([m, t]); }', ctx);

function setState(st) { ctx.__st = st; runInContext('S = __st', ctx); }
function setCommunity(decks) { ctx.__decks = decks; runInContext('communityDecks = __decks', ctx); }
const S = () => runInContext('S', ctx);
// Cross-realm objects → plain JSON values, so deepEqual compares data only.
const j = v => JSON.parse(JSON.stringify(v));

const baseState = (cards = [{ q: 'q', a: 'a' }]) => ({
  userName: 'V', nextId: 10, sessions: [], tasks: [], milestones: [], timetable: [],
  subjects: [{ id: 1, name: 'Mine', desc: '', docs: 0, color: '#0891b2', accessed: 0, cards }],
});

test('importPublicDeckById adds a legit deck with its colour', () => {
  setState(baseState());
  setCommunity([parsePublicDeck('ok1', { name: 'Biology', desc: '', ownerName: 'Ada', color: '#be185d', cards: [{ q: 'Q1', a: 'A1' }, { q: 'Q2', a: 'A2' }] }, 'x')]);
  toasts.length = 0;
  assert.equal(runInContext('importPublicDeckById("ok1")', ctx), true);
  const s = j(S().subjects[1]);
  assert.equal(s.name, 'Biology (imported)');
  assert.equal(s.desc, 'Shared by Ada');
  assert.equal(s.color, '#be185d');
  assert.equal(s.id, 10);
  assert.equal(S().nextId, 11);
  assert.deepEqual(s.cards, [{ q: 'Q1', a: 'A1' }, { q: 'Q2', a: 'A2' }]);
  assert.equal(toasts.at(-1)[1], 'success');
});

test('importPublicDeckById re-clamps whatever is in communityDecks', () => {
  setState(baseState());
  // Bypass parsePublicDeck on purpose: the import must not trust its input.
  setCommunity([{ id: 'raw1', ownerUid: 'm', ownerName: 'M', name: 'N'.repeat(400), desc: 'D'.repeat(4000), color: '#000"><img src=x>', cards: [{ q: 'q'.repeat(9000), a: 'a' }], cardCount: 1 }]);
  assert.equal(runInContext('importPublicDeckById("raw1")', ctx), true);
  const s = j(S().subjects[1]);
  assert.equal(s.name, 'N'.repeat(120) + ' (imported)');
  assert.equal(s.desc.length, 300);
  assert.equal(s.color, '#7c3aed');
  assert.equal(s.cards[0].q.length, 2000);
});

test('importPublicDeckById refuses a deck that would push the cloud document over budget, leaving state untouched', () => {
  // The review probe: 300 existing cards, then a ~0.95 MiB public deck (1000
  // cards x ~470 chars per side) that the rules allow.
  const mine = Array.from({ length: 300 }, (_, i) => ({ q: 'mine' + i + 'y'.repeat(200), a: 'z'.repeat(200) }));
  setState(baseState(mine));
  const big = 'x'.repeat(470);
  const cards = Array.from({ length: 1000 }, (_, i) => ({ q: 'Q' + i + big, a: 'A' + i + big }));
  setCommunity([parsePublicDeck('big', { name: 'Big deck', ownerName: 'M', color: '#0891b2', cards }, 'x')]);
  const before = JSON.stringify(S());
  toasts.length = 0;
  assert.equal(runInContext('importPublicDeckById("big")', ctx), false);
  assert.equal(JSON.stringify(S()), before, 'state changed although the import was refused');
  assert.equal(toasts.at(-1)[1], 'warning');
  assert.match(toasts.at(-1)[0], /too big/);
});

test('a large deck that still fits is accepted', () => {
  setState(baseState());
  const cards = Array.from({ length: 1000 }, (_, i) => ({ q: 'Question ' + i + ' ' + 'w'.repeat(150), a: 'Answer ' + i + ' ' + 'w'.repeat(150) }));
  setCommunity([parsePublicDeck('mid', { name: 'Mid', ownerName: 'M', color: '#0891b2', cards }, 'x')]);
  assert.equal(runInContext('importPublicDeckById("mid")', ctx), true);
  assert.equal(S().subjects[1].cards.length, 1000);
  assert.ok(runInContext('projectedUserDocBytes(S)', ctx) <= BUDGET);
});

test('an unknown deck id is reported, not imported', () => {
  setState(baseState());
  setCommunity([]);
  assert.equal(runInContext('importPublicDeckById("nope")', ctx), false);
  assert.equal(S().subjects.length, 1);
});

// ── Review round 2 ───────────────────────────────────────────────────────────
// R2-1: parsing another user's deck must be total. The rules cannot check each
// card's shape, and the real SDK rebuilds a Firestore map by assignment, so a
// card side can be an object with its OWN "toString" field — on which String()
// throws. That used to reject the whole Community fetch.
const POISON_SIDE = { toString: 'x' };

test('clampDeckCards never coerces: non-text sides are dropped, not stringified', () => {
  assert.throws(() => String(POISON_SIDE), TypeError, 'the probe value really is hostile');
  const raw = [
    { q: POISON_SIDE, a: 'y' }, { q: 'q', a: POISON_SIDE },
    { q: { valueOf: 'x', toString: 'y' }, a: 'b' }, { q: ['arr'], a: 'b' }, { q: true, a: 'b' },
    { q: NaN, a: 'b' }, { q: Infinity, a: 'b' }, { q: '', a: 'b' }, { q: 'q', a: '' },
    Object.assign(Object.create(null), { q: 'nullproto', a: 'ok' }),
    { toString: 'card-level', q: 'kept', a: 'yes' },
    { q: 3, a: 'three' },
  ];
  const out = j(clampDeckCards(raw));
  assert.deepEqual(out, [{ q: 'nullproto', a: 'ok' }, { q: 'kept', a: 'yes' }, { q: '3', a: 'three' }]);
});

test('parsePublicDeck is total on any field type, and drops a deck with no usable card', () => {
  const hostile = { ownerUid: POISON_SIDE, ownerName: POISON_SIDE, name: POISON_SIDE, desc: POISON_SIDE,
    color: POISON_SIDE, cardCount: POISON_SIDE, approved: POISON_SIDE, cards: [{ q: 'Q', a: 'A' }] };
  const d = j(parsePublicDeck('p1', hostile, 'Shared deck'));
  assert.deepEqual(d, { id: 'p1', ownerUid: '', ownerName: 'A student', name: 'Shared deck', desc: '',
    color: '#7c3aed', cards: [{ q: 'Q', a: 'A' }], cardCount: 1 });
  // Only junk cards → nothing to show or copy.
  assert.equal(parsePublicDeck('p2', { name: 'Poison', color: '#000000', cards: [{ q: POISON_SIDE, a: 'y' }] }, 'x'), null);
  assert.equal(parsePublicDeck('p3', { name: 'n', cards: POISON_SIDE }, 'x'), null);
  for (const x of [undefined, 'str', 42, [], POISON_SIDE]) assert.doesNotThrow(() => parsePublicDeck('p4', x, 'x'));
  assert.equal(parsePublicDeck(POISON_SIDE, { name: 'n', cards: [{ q: 'q', a: 'a' }] }, 'x'), null);
});

test('parsePublicDeck reports the number of cards it will copy, not the publisher\'s claim', () => {
  const d = parsePublicDeck('c1', { name: 'n', cardCount: 999999, cards: [{ q: 'q', a: 'a' }, { q: POISON_SIDE, a: 'b' }] }, 'x');
  assert.equal(d.cardCount, 1);
});

// Drive the real fetchPublicDecks against a stub SDK whose query returns docs.
function withPublicDecks(docs) {
  ctx.__docs = docs;
  runInContext(`firebase = { firestore: () => ({ collection: () => ({ orderBy: () => ({ limit: () => ({
    get: async () => ({ docs: __docs }) }) }) }) }) }`, ctx);
}
const doc = (id, data) => ({ id, data: () => data });

test('fetchPublicDecks: one poisoned or unreadable deck drops only itself', async () => {
  const legit = (name) => ({ name, ownerName: 'Ada', color: '#0891b2', cards: [{ q: 'Q', a: 'A' }] });
  withPublicDecks([
    doc('poison', { name: 'Poison card', color: '#000000', cards: [{ q: POISON_SIDE, a: 'y' }], updatedAt: '9999-12-31T00:00:00Z' }),
    doc('chem', legit('Chemistry')),
    { id: 'throws', data: () => { throw new Error('unreadable'); } },
    doc('mixed', { ...legit('Mixed'), cards: [{ q: POISON_SIDE, a: 'y' }, { q: 'good', a: 'card' }] }),
    doc('bio', legit('Biology')),
  ]);
  const warn = console.warn; console.warn = () => {};
  let decks;
  try { decks = await fetchPublicDecks(); } finally { console.warn = warn; }
  assert.deepEqual(j(decks.map(d => [d.id, d.name, d.cardCount])), [['chem', 'Chemistry', 1], ['mixed', 'Mixed', 1], ['bio', 'Biology', 1]]);
  runInContext('firebase = undefined', ctx);
});

// R2-2: an import must leave room for the SRS fields its cards gain when they
// are studied (srsSchedule adds six numbers, ~95 Firestore bytes per card).
test('SRS_CARD_KEYS is exactly what srsSchedule adds to a new card', () => {
  const keys = j(runInContext('SRS_CARD_KEYS', ctx));
  for (const rating of ['again', 'hard', 'good', 'easy']) {
    const added = Object.keys(srsSchedule({ q: 'q', a: 'a' }, rating)).filter(k => k !== 'q' && k !== 'a');
    assert.deepEqual(added.sort(), [...keys].sort(), rating);
  }
});

test('srsGrowthBytes equals the real growth of a first review, and is 0 once studied', () => {
  for (const card of [{ q: 'q', a: 'a' }, { q: 'Q'.repeat(300), a: 'é' }]) {
    const studied = srsSchedule(card, 'good');
    assert.equal(srsGrowthBytes(card), firestoreValueSize(studied) - firestoreValueSize(card));
    assert.equal(srsGrowthBytes(studied), 0);
    assert.equal(firestoreValueSize(srsSchedule(studied, 'easy')), firestoreValueSize(studied), 'later reviews do not grow a card');
  }
  assert.equal(srsGrowthBytes({ q: 'q', a: 'a' }), 95);
});

test('projectedUserDocBytes adds the SRS reserve for every not-yet-studied card', () => {
  const st = baseState([{ q: 'q', a: 'a' }, srsSchedule({ q: 'r', a: 'b' }, 'good')]);
  assert.equal(projectedUserDocBytes(st), userDocBytes(st) + 95);
  assert.equal(projectedUserDocBytes({ subjects: [{ id: 1, cards: undefined }, null] }), userDocBytes({ subjects: [{ id: 1, cards: undefined }, null] }));
});

test('two ~450 KB decks: the second is refused, so studying every accepted card stays under budget', () => {
  // The review-round-2 probe: before, both were accepted (901 KB) and one review
  // pass took the document to 1,091,417 bytes, past the 1 MiB limit.
  const big = (tag) => parsePublicDeck('big' + tag.length, { name: 'Big ' + tag, ownerName: 'M', color: '#0891b2',
    cards: Array.from({ length: 1000 }, (_, i) => ({ q: tag + i + 'x'.repeat(220), a: 'y'.repeat(220) })) }, 'x');
  setState({ ...baseState(), subjects: [] });
  setCommunity([big('a'), big('bb')]);
  toasts.length = 0;
  assert.equal(runInContext('importPublicDeckById("big1")', ctx), true);
  assert.equal(runInContext('importPublicDeckById("big2")', ctx), false);
  assert.match(toasts.at(-1)[0], /too big/);
  runInContext('for (const s of S.subjects) s.cards = s.cards.map(c => srsSchedule(c, "good"))', ctx);
  assert.ok(runInContext('userDocBytes(S)', ctx) <= BUDGET);
});

test('a deck that fits today but not once studied is refused', () => {
  // ~880 KB of text in 1000 cards: under the budget as stored (the old check
  // accepted it), over it once each card carries its SRS fields.
  setState({ ...baseState(), subjects: [] });
  const side = 'z'.repeat(437);
  const deck = parsePublicDeck('edge', { name: 'Edge', color: '#0891b2', cards: Array.from({ length: 1000 }, (_, i) => ({ q: String(i).padStart(4, '0') + side, a: side })) }, 'x');
  const next = { ...S(), subjects: [{ id: 1, name: 'Edge (imported)', desc: 'Shared by A student', docs: 0, color: '#0891b2', accessed: 0, cards: deck.cards }] };
  assert.ok(userDocBytes(next) <= BUDGET, 'precondition: fits as stored');
  assert.ok(projectedUserDocBytes(next) > BUDGET, 'precondition: does not fit once studied');
  setCommunity([deck]);
  assert.equal(runInContext('importPublicDeckById("edge")', ctx), false);
  assert.equal(S().subjects.length, 0);
});
