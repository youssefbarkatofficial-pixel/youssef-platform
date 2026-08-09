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
