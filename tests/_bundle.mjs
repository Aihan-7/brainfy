// Test harness: load the built script.js and hand back its globals.
//
// src/main.ts compiles with `module: "None"` + `outFile`, so it is one big
// concatenation of globals rather than an importable module — which is why the
// pure logic at the heart of the app (the SRS scheduler, the guest/cloud merge)
// had no tests at all while the JWT verifier had 18.
//
// Rather than refactor the bundle (a large, risky change) or duplicate the logic
// in the test (which would assert nothing), run the REAL shipped artifact inside
// a vm context with just enough DOM to survive top-level evaluation, then reach
// in for the functions. Bonus: this tests exactly what deploys, minifier included.

import { createContext, runInContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function makeStubEl() {
  const el = {
    style: {}, dataset: {}, children: [], value: '', textContent: '', innerHTML: '',
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute() {}, getAttribute: () => null, removeAttribute() {},
    appendChild() {}, removeChild() {}, remove() {}, insertBefore() {},
    addEventListener() {}, removeEventListener() {}, focus() {}, blur() {}, click() {},
    querySelector: () => null, querySelectorAll: () => [],
    closest: () => null, getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }),
    cloneNode: () => makeStubEl(),
    parentNode: { replaceChild() {}, removeChild() {} },
  };
  return el;
}

export function loadBundle() {
  const code = readFileSync(join(root, 'script.js'), 'utf8');
  const noop = () => {};
  const storage = {
    _m: new Map(),
    getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
    setItem(k, v) { this._m.set(k, String(v)); },
    removeItem(k) { this._m.delete(k); },
    clear() { this._m.clear(); },
  };
  const document = {
    // Return a stub rather than null: some top-level wiring dereferences the
    // result directly, and a null here aborts evaluation before the functions
    // under test are defined.
    getElementById: makeStubEl,
    querySelector: makeStubEl,
    querySelectorAll: () => [],
    createElement: makeStubEl,
    addEventListener: noop, removeEventListener: noop,
    body: makeStubEl(), head: makeStubEl(), documentElement: makeStubEl(),
    title: '',
  };
  const ctx = {
    console, document, JSON, Math, Date, Set, Map, Intl, URL, URLSearchParams,
    structuredClone, Promise, Error, Array, Object, String, Number, Boolean, RegExp,
    localStorage: storage,
    sessionStorage: { ...storage, _m: new Map() },
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: noop,
    requestAnimationFrame: noop, cancelAnimationFrame: noop,
    addEventListener: noop, removeEventListener: noop,
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
    fetch: () => Promise.reject(new Error('no network in tests')),
    navigator: { onLine: true, userAgent: 'node-test', serviceWorker: { register: () => Promise.reject(new Error('none')) } },
    location: { href: 'http://localhost/', search: '', pathname: '/', hash: '', origin: 'http://localhost' },
    history: { replaceState: noop, pushState: noop },
    scrollTo: noop, alert: noop,
    MutationObserver: class { observe() {} disconnect() {} takeRecords() { return []; } },
    IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    Notification: { permission: 'default', requestPermission: () => Promise.resolve('default') },
  };
  ctx.window = ctx;
  ctx.self   = ctx;
  createContext(ctx);
  runInContext(code, ctx);

  // A silently half-evaluated bundle would make every test below vacuously pass.
  for (const fn of ['srsSchedule', 'srsIsDue', 'mergeStates', 'srsSessionQueue']) {
    if (typeof ctx[fn] !== 'function') {
      throw new Error(`bundle loaded but ${fn}() is missing — did the build change shape?`);
    }
  }
  return ctx;
}

// Values built INSIDE the vm belong to that realm, so their Array.prototype is
// not the test file's. assert.deepStrictEqual compares prototypes and would
// report "same structure but not reference-equal" on two identical arrays. Pass
// anything that crossed the boundary through this first.
export const plain = (arr) => Array.from(arr);

export const DAY_MS = 86400000;

// Local midnight of whatever day `ms` falls on — the boundary srsSchedule snaps to.
export function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
