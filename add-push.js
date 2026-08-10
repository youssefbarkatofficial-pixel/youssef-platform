// Add Push Notification Support to sw.js
const fs = require('fs');
let sw = fs.readFileSync('sw.js', 'utf8');

const pushCode = `
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
`;

if (!sw.includes("addEventListener('push'")) {
    fs.writeFileSync('sw.js', sw + '\n' + pushCode, 'utf8');
    console.log('✅ Push notification listener added to sw.js');
} else {
    console.log('⚠️ Push listener already exists.');
}
