/* Public Firebase Messaging Service Worker */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCT05MbiNBz15USSAPzqx1xxdIiDxykvHs',
  projectId: 'youssefbarakatplatform-8abff',
  messagingSenderId: '861961495531',
  appId: '1:861961495531:web:303098945fd4bdbf0eefae',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  self.registration.showNotification(d.title || 'منصة يوسف بركات', {
    body: d.body || '',
    icon: '/icons/icon-192.png',
    data: { url: d.url || '/student/notifications' },
  });
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(clients.openWindow(url));
});
