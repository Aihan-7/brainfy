// Brainfy service worker — conservative, offline-capable PWA shell.
//
// Design goal: NEVER serve a stale page while online. So:
//   • Navigations          → network-first (fresh index.html online; cached
//                            shell offline). This is what guarantees a new
//                            deploy is picked up immediately.
//   • Static GET assets     → stale-while-revalidate (same-origin assets,
//     + Firebase SDK + fonts  Google Fonts, and the gstatic Firebase SDK so the
//                            app can boot offline).
//   • /api/*, Firestore,    → never touched — must always hit the network live.
//     Auth, Storage
//
// Cache versioning: bumping VERSION on a meaningful change purges old caches on
// activate. Even if it isn't bumped, network-first navigations + ?v= versioned
// asset URLs mean online users still get fresh code — stale cache can't brick.

const VERSION = 'brainfy-v1';
const SHELL   = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

// Minimal shell precached for offline navigation fallback.
const SHELL_URLS = ['/', '/icon.svg', '/site.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())   // a failed precache must not block install
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isFontHost(url) {
  return url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                  // mutations: passthrough

  const url = new URL(req.url);

  // Never cache API / auth / Firestore / Storage — must be live.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

  // Cross-origin: only cache fonts + the gstatic Firebase SDK. Everything else
  // (Firestore/Auth/Storage on *.googleapis.com etc.) passes straight through.
  const sameOrigin = url.origin === self.location.origin;
  const cacheableCrossOrigin = isFontHost(url) || url.hostname === 'www.gstatic.com';
  if (!sameOrigin && !cacheableCrossOrigin) return;

  // Navigations → network-first, cached shell as offline fallback.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/')))
    );
    return;
  }

  // Static GET → stale-while-revalidate.
  event.respondWith(
    caches.open(RUNTIME).then((cache) =>
      cache.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
              cache.put(req, res.clone()).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    )
  );
});

// ── Web Push (study reminders) ────────────────────────────────────────────
// Inert until a backend cron sender + VAPID keypair are configured (see
// enableReminders in main.ts). When a push arrives, show the notification;
// clicking it focuses an open Brainfy tab or opens one.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { body: event.data && event.data.text() }; }
  const title = data.title || 'Brainfy — time to study';
  const body  = data.body  || 'You have cards due. Keep your streak alive 🔥';
  event.waitUntil(self.registration.showNotification(title, {
    body, icon: '/icon.svg', badge: '/icon.svg', tag: 'brainfy-due',
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) { if ('focus' in w) return w.focus(); }
      return self.clients.openWindow(url);
    })
  );
});
