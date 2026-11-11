/* Youssef Barakat platform — PWA service worker (offline app-shell fallback + static asset caching).
 * Rules:
 *  - Never touch cross-origin requests. Student data and third-party APIs bypass SW directly.
 *  - Navigations: network-first (zero stale HTML when online), falls back to cached SPA shell offline so IndexedDB course cache stays browsable.
 *  - Static same-origin bundles (/assets/, /fonts/, /images/, /icons/) are cache-first.
 */
const CACHE_PREFIX = 'yb-static-';
const CACHE = CACHE_PREFIX + 'v2';
const OFFLINE_URL = '/offline.html';
const APP_SHELL_KEY = '/_offline_shell_v2';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then(async (c) => {
        await c.addAll([
          OFFLINE_URL,
          '/icons/logo.svg',
          '/favicon.svg',
          '/icons/icon-192.png',
          '/icons/icon-512.png',
          '/icons/icon-maskable-192.png',
          '/icons/icon-maskable-512.png',
          '/manifest.webmanifest'
        ]);
        try {
          const shellRes = await fetch('/', { cache: 'no-store' });
          if (shellRes && shellRes.status === 200) {
            await c.put(APP_SHELL_KEY, shellRes.clone());
          }
        } catch {
          // تجاهل لو كان التثبيت أوفلاين، سيتخزن مع أول فتح أونلاين
        }
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const foreign = keys.filter((k) => !k.startsWith(CACHE_PREFIX) && k !== 'yb-video-offline-v1');
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
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/__yb_offline_video__/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(APP_SHELL_KEY, copy));
          }
          return res;
        })
        .catch(async () => {
          const shell = await caches.match(APP_SHELL_KEY);
          if (shell) return shell;
          const offline = await caches.match(OFFLINE_URL);
          return offline || new Response('offline', { status: 503 });
        })
    );
    return;
  }

  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.startsWith('/icons/')
  ) {
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
