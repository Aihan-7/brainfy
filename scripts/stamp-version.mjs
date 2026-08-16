// Stamp cache-busting versions into index.html — run as the last step of `npm run build`.
//
// WHY THIS EXISTS
// ───────────────
// index.html loads the app bundle as `/script.js?v=<APP_VERSION>` and the splash
// icon set as `/icons.js?v=<...>`, and `_headers` serves both with
// `Cache-Control: public, max-age=31536000, immutable`. That's correct *only* if
// the query string changes whenever the file does — the URL is the cache key.
//
// Those stamps used to be hand-maintained epoch numbers, and they drifted: 14
// commits changed script.js without a bump, so every returning visitor kept
// serving a months-old bundle from disk cache without ever revalidating
// (index.html itself is no-store, so it was always fresh — and always pointed at
// the same stale URL). See AUDIT-2026-08-16.md, P0-2.
//
// Now the stamp is a content hash: it changes if and only if the file changes,
// it can't drift, and rebuilding identical sources is a no-op (so CI's
// "committed output matches build output" check stays meaningful).

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// 12 hex chars ≈ 48 bits — collision-proof for our purposes and short enough to
// stay readable in a URL.
const hashOf = (file) =>
  createHash('sha256').update(readFileSync(join(root, file))).digest('hex').slice(0, 12);

const scriptHash = hashOf('script.js');
const iconsHash  = hashOf('icons.js');

const indexPath = join(root, 'index.html');
const before = readFileSync(indexPath, 'utf8');

let after = before
  .replace(/(var APP_VERSION\s*=\s*')[^']*(')/, `$1${scriptHash}$2`)
  .replace(/(\/icons\.js\?v=)[^"']*/, `$1${iconsHash}`);

// A silently-missed replacement would reintroduce exactly the bug this script
// exists to prevent, so fail loudly instead of writing a half-stamped file.
for (const [label, re] of [
  ['APP_VERSION',   new RegExp(`var APP_VERSION\\s*=\\s*'${scriptHash}'`)],
  ['icons.js?v=',   new RegExp(`/icons\\.js\\?v=${iconsHash}`)],
]) {
  if (!re.test(after)) {
    console.error(`[stamp-version] FAILED: could not stamp ${label} in index.html — has the markup changed?`);
    process.exit(1);
  }
}

if (after === before) {
  console.log(`[stamp-version] up to date (script=${scriptHash} icons=${iconsHash})`);
} else {
  writeFileSync(indexPath, after);
  console.log(`[stamp-version] stamped index.html (script=${scriptHash} icons=${iconsHash})`);
}
