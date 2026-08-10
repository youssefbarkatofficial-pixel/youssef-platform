const CACHE_NAME = 'bousala-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './css/mobile.css',
  './js/firebase-service.js',
  './js/rescue-mode.js',
  './js/security.js',
  './favicon.ico'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached response if found, else fetch from network
        if (response) {
          return response;
        }
        
        // Clone the request for fetch
        let fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then(
          function(response) {
            // Check if we received a valid response
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response and cache it for future
            let responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(function(cache) {
                // Avoid caching API responses or third party (like firestore URLs)
                if(event.request.url.startsWith(self.location.origin)) {
                  cache.put(event.request, responseToCache);
                }
              });

            return response;
          }
        ).catch(function() {
            // Offline fallback
        });
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});


// ==========================================
// PUSH NOTIFICATIONS (Firebase FCM Ready)
// ==========================================
self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Received.');
  let title = 'منصة يوسف بركات';
  let options = {
    body: 'لديك إشعار جديد من المنصة!',
    icon: './favicon.ico',
    badge: './favicon.ico',
    vibrate: [200, 100, 200, 100, 200, 100, 200],
    data: {
      url: self.location.origin + '/dashboard.html'
    }
  };

  if (event.data) {
    try {
      const data = event.data.json();
      if(data.notification) {
        title = data.notification.title || title;
        options.body = data.notification.body || options.body;
        if(data.notification.image) options.image = data.notification.image;
      }
      if(data.data && data.data.url) {
        options.data.url = data.data.url;
      }
    } catch(e) {
      options.body = event.data.text();
    }
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification click Received.');
  event.notification.close();
  
  const urlToOpen = event.notification.data.url || self.location.origin + '/dashboard.html';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // If a window is already open, focus it
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
