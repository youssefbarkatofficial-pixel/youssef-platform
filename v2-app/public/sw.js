// Kill-switch Service Worker
// يمسح كل الكاش القديم (v28_unified_cache وغيرها) من متصفحات الطلاب
// ثم يلغي تسجيل نفسه ويعيد تحميل الصفحات المفتوحة مرة واحدة لترى المنصة الجديدة فوراً

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 1) مسح كافة الكاشات المخزنة في المتصفح
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      } catch (error) {
        // تجاهل أي خطأ والاستمرار
      }

      // 2) إلغاء تسجيل هذا الـ Service Worker بالكامل
      try {
        await self.registration.unregister();
      } catch (error) {
        // تجاهل
      }

      // 3) إعادة تحميل الصفحات المفتوحة لجلب v2 مباشرة من السيرفر بدون أي كاش قديم
      try {
        const clientsList = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        for (const client of clientsList) {
          if (client.url && 'navigate' in client) {
            client.navigate(client.url);
          }
        }
      } catch (error) {
        // تجاهل
      }
    })(),
  );
});

// لا نخزن أي ملف ولا نتدخل في أي طلب، كل شيء يذهب للشبكة مباشرة
self.addEventListener('fetch', () => {});
