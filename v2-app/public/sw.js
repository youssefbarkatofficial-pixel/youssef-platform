/* Youssef Barakat platform — PWA service worker (replaces the kill-switch sw.js).
 * Rules:
 *  - Never touch cross-origin requests (Firebase Auth/Firestore, Worker, YouTube...). Student data always goes live.
 *  - Navigations: network-first, offline.html only when the network is down. No stale HTML.
 *  - Only hashed build assets under /assets/ are cached (cache-first).
 *  - First activation after the old platform's SW (or the old kill-switch): delete every foreign cache and reload open tabs ONCE.
 */
const CACHE_PREFIX = 'yb-static-';
const CACHE = CACHE_PREFIX + 'v2';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll([
        OFFLINE_URL,
        '/icons/logo.svg',
        '/favicon.svg',
        '/icons/icon-192.png',
        '/icons/icon-512.png',
        '/icons/icon-maskable-512.png'
      ]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const foreign = keys.filter((k) => !k.startsWith(CACHE_PREFIX));
    const stale = keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE);
    await Promise.all([...foreign, ...stale].map((k) => caches.delete(k)));
    await self.clients.claim();
    if (foreign.length > 0) {
      // migration from the old platform cache: refresh open tabs one time only
      const tabs = await self.clients.matchAll({ type: 'window' });
      tabs.forEach((t) => { try { t.navigate(t.url); } catch (e) {} });
    }
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never intercept Firebase / Worker / YouTube / fonts CDN

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() =>
        caches.match(OFFLINE_URL).then((r) => r || new Response('offline', { status: 503 }))
      )
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(req, clone));
          }
          return res;
        });
      })
    );
    return;
  }
});
