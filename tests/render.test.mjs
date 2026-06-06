// ────────────────────────────────────────────────────────────────────────────
//  Tests for functions/decks/_render.js
//
//  The deck SSR layer renders UNTRUSTED Firestore data (deck names, card text,
//  owner names — all user-authored) into public HTML pages. That makes two
//  pure functions both correctness- and security-critical:
//
//    esc          — HTML-escapes every interpolated value (XSS defense)
//    parseDeckDoc — turns a Firestore REST document into a deck, dropping
//                   unusable/thin data
//
//  Plus smoke + injection coverage for renderDeckPage / renderDecksIndex and
//  the fsBase config helper.
//
//  Run: `node --test tests/render.test.mjs`  (or `npm test`)
// ────────────────────────────────────────────────────────────────────────────

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  esc,
  parseDeckDoc,
  renderDeckPage,
  renderDecksIndex,
  fsBase,
  ORIGIN,
} from '../functions/decks/_render.js';

// ── esc ──────────────────────────────────────────────────────────────────────

describe('esc', () => {
  test('escapes all five HTML-significant characters', () => {
    assert.equal(esc('&'), '&amp;');
    assert.equal(esc('<'), '&lt;');
    assert.equal(esc('>'), '&gt;');
    assert.equal(esc('"'), '&quot;');
    assert.equal(esc("'"), '&#39;');
  });

  test('neutralizes a script-tag injection attempt', () => {
    assert.equal(
      esc('<script>alert(1)</script>'),
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  test('escapes ampersand first so entities are not double-mangled', () => {
    // If < were escaped before &, "&lt;" would become "&amp;lt;". Order matters.
    assert.equal(esc('a<b'), 'a&lt;b');
    assert.equal(esc('Tom & Jerry <3'), 'Tom &amp; Jerry &lt;3');
  });

  test('coerces null / undefined / numbers to safe strings', () => {
    assert.equal(esc(null), '');
    assert.equal(esc(undefined), '');
    assert.equal(esc(42), '42');
  });
});

// ── parseDeckDoc ─────────────────────────────────────────────────────────────

// Build a Firestore REST `fields` object from a friendly card list + overrides.
function fields({ name = 'My Deck', cards = [{ q: 'Q1', a: 'A1' }], ...rest } = {}) {
  const out = {
    name: { stringValue: name },
    cards: {
      arrayValue: {
        values: cards.map((c) => ({
          mapValue: {
            fields: {
              ...(c.q !== undefined ? { q: { stringValue: c.q } } : {}),
              ...(c.a !== undefined ? { a: { stringValue: c.a } } : {}),
            },
          },
        })),
      },
    },
  };
  for (const [k, v] of Object.entries(rest)) out[k] = v;
  return out;
}

describe('parseDeckDoc', () => {
  test('returns null for missing fields', () => {
    assert.equal(parseDeckDoc(null), null);
    assert.equal(parseDeckDoc(undefined), null);
  });

  test('returns null when name is empty / whitespace', () => {
    assert.equal(parseDeckDoc(fields({ name: '   ' })), null);
  });

  test('returns null when there are no usable cards', () => {
    assert.equal(parseDeckDoc(fields({ cards: [] })), null);
    // cards present but each missing q or a → all filtered → null
    assert.equal(parseDeckDoc(fields({ cards: [{ q: 'only-q' }, { a: 'only-a' }] })), null);
  });

  test('parses a valid deck and drops half-empty cards', () => {
    const deck = parseDeckDoc(fields({
      name: '  Biology  ',
      cards: [{ q: 'Q1', a: 'A1' }, { q: '', a: 'A2' }, { q: 'Q3', a: 'A3' }],
    }));
    assert.equal(deck.name, 'Biology');                 // trimmed
    assert.deepEqual(deck.cards, [{ q: 'Q1', a: 'A1' }, { q: 'Q3', a: 'A3' }]);
  });

  test('applies defaults for ownerName and an invalid color', () => {
    const deck = parseDeckDoc(fields({ color: { stringValue: 'red' } }));
    assert.equal(deck.ownerName, 'A student');
    assert.equal(deck.color, '#7c3aed');
  });

  test('accepts a valid 6-digit hex color', () => {
    const deck = parseDeckDoc(fields({ color: { stringValue: '#00FF99' } }));
    assert.equal(deck.color, '#00FF99');
  });

  test('derives cardCount from cards when the field is absent', () => {
    const deck = parseDeckDoc(fields({ cards: [{ q: 'Q1', a: 'A1' }, { q: 'Q2', a: 'A2' }] }));
    assert.equal(deck.cardCount, 2);
  });

  test('reads cardCount from integerValue or doubleValue', () => {
    assert.equal(parseDeckDoc(fields({ cardCount: { integerValue: '7' } })).cardCount, 7);
    assert.equal(parseDeckDoc(fields({ cardCount: { doubleValue: 9 } })).cardCount, 9);
  });
});

// ── renderDeckPage ───────────────────────────────────────────────────────────

describe('renderDeckPage', () => {
  const baseDeck = {
    name: 'World Capitals',
    desc: 'Learn them all',
    ownerName: 'Ada',
    color: '#7c3aed',
    cards: [{ q: 'Capital of France?', a: 'Paris' }],
    cardCount: 12,
  };

  test('produces a full HTML document with escaped deck content', () => {
    const html = renderDeckPage('abc123', baseDeck);
    assert.match(html, /^<!DOCTYPE html>/);
    assert.ok(html.includes('World Capitals'));
    assert.ok(html.includes('Capital of France?'));
    assert.ok(html.includes('Paris'));
    assert.ok(html.includes(`${ORIGIN}/decks/abc123`)); // canonical URL
  });

  test('marks decks with >=4 cards as indexable, thin decks as noindex', () => {
    assert.match(renderDeckPage('id', { ...baseDeck, cardCount: 4 }), /name="robots" content="index, follow/);
    assert.match(renderDeckPage('id', { ...baseDeck, cardCount: 3 }), /name="robots" content="noindex/);
  });

  test('does not let deck content break out of the HTML body (XSS)', () => {
    const html = renderDeckPage('id', {
      ...baseDeck,
      name: 'Pwn</script><script>alert(1)</script>',
      cards: [{ q: '<img src=x onerror=alert(2)>', a: 'ok' }],
    });
    // The injected executable markup must never appear unescaped anywhere.
    assert.ok(!html.includes('<script>alert(1)'));
    assert.ok(!html.includes('<img src=x onerror'));
    assert.ok(html.includes('&lt;script&gt;alert(1)'));
  });

  test('does not let deck content break out of the JSON-LD <script> block', () => {
    const html = renderDeckPage('id', { ...baseDeck, desc: 'evil</script><script>alert(3)</script>' });
    // jsonForScript escapes < and > so the closing tag can never be forged.
    assert.ok(!html.includes('alert(3)</script>'));
    assert.ok(html.includes('\\u003c'));
  });
});

// ── renderDecksIndex ─────────────────────────────────────────────────────────

describe('renderDecksIndex', () => {
  test('renders an empty state when there are no decks', () => {
    const html = renderDecksIndex([]);
    assert.match(html, /^<!DOCTYPE html>/);
    assert.ok(html.includes('No public decks yet'));
  });

  test('renders one card per deck with escaped, linked names', () => {
    const html = renderDecksIndex([
      { id: 'd1', name: 'Chemistry', ownerName: 'Bob', cardCount: 20 },
      { id: 'd2', name: 'A & B <hax>', ownerName: 'Eve', cardCount: 5 },
    ]);
    assert.ok(html.includes('/decks/d1'));
    assert.ok(html.includes('Chemistry'));
    assert.ok(html.includes('A &amp; B &lt;hax&gt;'));
    assert.ok(!html.includes('<hax>'));
  });
});

// ── fsBase ───────────────────────────────────────────────────────────────────

describe('fsBase', () => {
  test('falls back to baked-in defaults with no env', () => {
    const { url, key } = fsBase(undefined);
    assert.ok(url.includes('brainfy-65b7a'));
    assert.ok(key.length > 0);
  });

  test('honors env overrides', () => {
    const { url, key } = fsBase({ FIREBASE_PROJECT_ID: 'proj-x', FIREBASE_API_KEY: 'key-x' });
    assert.ok(url.includes('/projects/proj-x/'));
    assert.equal(key, 'key-x');
  });
});
