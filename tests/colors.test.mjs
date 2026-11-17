// Tests for the subject-colour guard (AUDIT-2026-10-17.md, P0-2).
//
// A subject's colour is interpolated into style="" attributes and SVG fill /
// stroke, and a subject can be a copy of another user's public deck. HTML-
// escaping does not make a value safe in those contexts, so the only thing ever
// allowed through is a strict #rrggbb — on the way in (fetch / open / import /
// publish), whenever state is loaded or merged, and at render.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runInContext } from 'node:vm';
import { loadBundle, plain } from './_bundle.mjs';

const ctx = loadBundle();
const { safeDeckColor, subjColor, sanitizeStateColors, mergeStates, parsePublicDeck } = ctx;
const DEFAULT = '#7c3aed';

const HOSTILE = [
  '#000"><img src=x onerror=alert(1)>',       // attribute break-out
  '#000;background:url(https://evil.example)', // CSS injection / exfiltration
  "#000';alert(1);'",                          // JS-string break-out in an inline handler
  '#000\'"',
  '#ffffff\n',                                 // trailing newline must not slip past $
  ' #ffffff', '#ffffff ',
  '#fff', '#ffffffff', '#gggggg', 'red', 'var(--primary)', 'rgb(1,2,3)', '',
];

test('safeDeckColor accepts strict #rrggbb in either case', () => {
  for (const c of ['#0891b2', '#ABCDEF', '#000000', '#7c3aed']) assert.equal(safeDeckColor(c), c);
});

test('safeDeckColor replaces every hostile or malformed value with the default', () => {
  for (const c of HOSTILE) assert.equal(safeDeckColor(c), DEFAULT, JSON.stringify(c));
});

test('safeDeckColor rejects non-strings, even ones that stringify to a valid colour', () => {
  for (const c of [null, undefined, 123, true, ['#123456'], { toString: () => '#123456' }]) {
    assert.equal(safeDeckColor(c), DEFAULT, String(c));
  }
});

test('subjColor reads a subject safely, including a missing subject or colour', () => {
  assert.equal(subjColor({ color: '#be185d' }), '#be185d');
  assert.equal(subjColor({ color: HOSTILE[0] }), DEFAULT);
  assert.equal(subjColor({}), DEFAULT);
  assert.equal(subjColor(null), DEFAULT);
  assert.equal(subjColor(undefined), DEFAULT);
});

const subj = (id, color) => ({ id, name: 'S' + id, desc: '', docs: 0, color, accessed: 0 });

test('sanitizeStateColors returns the very same object when every colour is already safe', () => {
  const st = { subjects: [subj(1, '#0891b2')], timetable: [{ id: 2, title: 'b', day: 0, start: '09:00', end: '10:00', color: '#7c3aed' }] };
  assert.equal(sanitizeStateColors(st), st);
});

test('sanitizeStateColors cleans subject and timetable colours without mutating its input', () => {
  const st = {
    userName: 'A',
    subjects: [subj(1, HOSTILE[0]), subj(2, '#be185d'), { id: 3, name: 'no colour', desc: '', docs: 0, accessed: 0 }],
    timetable: [{ id: 4, title: 'b', day: 0, start: '09:00', end: '10:00', color: HOSTILE[2] }],
  };
  const before = JSON.stringify(st);
  const out = sanitizeStateColors(st);
  assert.notEqual(out, st);
  assert.equal(JSON.stringify(st), before, 'input was mutated');
  assert.deepEqual(plain(out.subjects.map(s => s.color)), [DEFAULT, '#be185d', DEFAULT]);
  assert.equal(out.subjects[1], st.subjects[1], 'an already-safe subject is passed through untouched');
  assert.equal(out.timetable[0].color, DEFAULT);
  assert.equal(out.userName, 'A');
});

test('sanitizeStateColors never adds a key that was absent (Firestore rejects undefined)', () => {
  const out = sanitizeStateColors({ subjects: [subj(1, 'red')] });
  assert.equal(Object.prototype.hasOwnProperty.call(out, 'timetable'), false);
  assert.equal(sanitizeStateColors({ userName: 'x' }).subjects, undefined);
});

test('mergeStates cleans colours coming from either side', () => {
  const cloud = { subjects: [subj(1, HOSTILE[1])], sessions: [], tasks: [], timetable: [], nextId: 2 };
  const local = { subjects: [subj(1, HOSTILE[2])].map(s => ({ ...s, name: 'Other' })), nextId: 2 };
  const m = mergeStates(cloud, local);
  assert.equal(m.subjects.length, 2);
  for (const s of m.subjects) assert.match(s.color, /^#[0-9a-fA-F]{6}$/);
});

test('parsePublicDeck validates the colour on the way in and keeps a legit one', () => {
  const evil = parsePublicDeck('abc123', { name: '<img src=x onerror=1>', color: HOSTILE[0], cards: [{ q: 'q', a: 'a' }] }, 'Untitled deck');
  assert.equal(evil.color, DEFAULT);
  assert.equal(evil.name, '<img src=x onerror=1>', 'text fields stay text; they are escaped at render');
  assert.equal(parsePublicDeck('abc123', { name: 'Bio', color: '#0891b2', cards: [{ q: 'q', a: 'a' }] }, 'x').color, '#0891b2');
});

test('parsePublicDeck drops moderated decks and malformed ids', () => {
  const cards = [{ q: 'q', a: 'a' }];
  assert.equal(parsePublicDeck('abc', { name: 'n', color: '#123456', approved: false, cards }, 'x'), null);
  assert.notEqual(parsePublicDeck('abc', { name: 'n', approved: true, cards }, 'x'), null);
  assert.equal(parsePublicDeck("a'b", { name: 'n', cards }, 'x'), null);
  assert.equal(parsePublicDeck('a/b', { name: 'n', cards }, 'x'), null);
  assert.equal(parsePublicDeck('abc', null, 'x'), null);
});

test('load() cleans an already-poisoned local copy and persists the cleaned state', () => {
  const key = 'brainfy_v3';
  ctx.localStorage.setItem(key, JSON.stringify({
    subjects: [subj(1, HOSTILE[0]), subj(2, '#be185d')],
    timetable: [{ id: 3, title: 'b', day: 0, start: '09:00', end: '10:00', color: HOSTILE[2] }],
  }));
  ctx.load();
  const mem = plain(runInContext('S.subjects.map(s => s.color).concat(S.timetable.map(b => b.color))', ctx));
  assert.deepEqual(mem, [DEFAULT, '#be185d', DEFAULT]);
  const disk = JSON.parse(ctx.localStorage.getItem(key));
  assert.deepEqual(disk.subjects.map(s => s.color).concat(disk.timetable.map(b => b.color)), [DEFAULT, '#be185d', DEFAULT]);
  ctx.localStorage.removeItem(key);
});
