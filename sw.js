// CACHE VERSION - bump this number to force cache refresh on all clients
const CACHE_VERSION = 'v13';
const CACHE_NAME = 'bousala-cache-' + CACHE_VERSION;

// Static assets to pre-cache (CSS, fonts, icons only - NOT HTML pages)
const STATIC_CACHE = [
  './favicon.ico',
  './css/style.css',
  './css/mobile.css'
];

// Install: cache only static assets
self.addEventListener('install', event => {
  self.skipWaiting(); // Immediately activate new SW
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_CACHE);
    })
  );
});

// Activate: delete ALL old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete any old cache that isn't our current one
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return clients.claim(); // Take control of all open pages immediately
    })
  );
});

// Fetch: NETWORK FIRST strategy
// HTML pages always come from network so updates show immediately
// Static assets (css/images) can use cache as fallback
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Don't cache Firebase/Firestore/external requests
  if (!url.origin.includes(self.location.hostname)) {
    return; // Let browser handle it normally
  }

  // For HTML pages: ALWAYS go to network first
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request).then(response => {
        // Got fresh response - update cache too
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      }).catch(() => {
        // Network failed, try cache as offline fallback
        return caches.match(event.request);
      })
    );
    return;
  }

  // For static assets (CSS, JS, images): Cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) {
          return response;
        }
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      });
    })
  );
});

// ==========================================
// PUSH NOTIFICATIONS (Firebase FCM Ready)
// ==========================================
self.addEventListener('push', function(event) {
  let title = 'منصة يوسف بركات';
  let options = {
    body: 'لديك إشعار جديد من المنصة!',
    icon: './favicon.ico',
    badge: './favicon.ico',
    vibrate: [200, 100, 200],
    data: {
      url: self.location.origin + '/dashboard.html'
    }
  };

  if (event.data) {
    try {
      const data = event.data.json();
      if (data.notification) {
        title = data.notification.title || title;
        options.body = data.notification.body || options.body;
        if (data.notification.image) options.image = data.notification.image;
      }
      if (data.data && data.data.url) {
        options.data.url = data.data.url;
      }
    } catch(e) {
      options.body = event.data.text();
    }
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data.url || self.location.origin + '/dashboard.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
