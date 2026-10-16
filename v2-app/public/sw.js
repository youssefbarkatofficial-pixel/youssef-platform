// خدمة قديمة كانت تحفظ نسخة من المنصة القديمة في متصفحات الطلاب.
// هذا الملف يمسح كل الكاش القديم ثم يلغي نفسه، فيرى كل طالب النسخة الجديدة فورًا.
// يجب أن يبقى باسم sw.js وعلى نفس المسار حتى يلتقطه المتصفح القديم.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch (error) {
        // نتجاهل أي خطأ في مسح الكاش ونكمل.
      }
      try {
        await self.registration.unregister();
      } catch (error) {
        // نتجاهل.
      }
      try {
        const windows = await self.clients.matchAll({ type: 'window' });
        windows.forEach((client) => client.navigate(client.url));
      } catch (error) {
        // نتجاهل.
      }
    })(),
  );
});

// لا نخدم أي ملف من الكاش: كل الطلبات تذهب للشبكة مباشرة.
self.addEventListener('fetch', () => {});
