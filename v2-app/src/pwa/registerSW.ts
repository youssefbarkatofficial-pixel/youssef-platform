import { Capacitor } from '@capacitor/core';

// Call registerSW() once after the app mounts (production only).
// No auto-reload on install on purpose: we never reload a student mid-exam.
// A waiting worker only activates when the student explicitly taps "حدّث الآن".
export function registerSW(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (Capacitor.isNativePlatform()) return;
  if (!import.meta.env.PROD) return;

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });

      const announce = (worker: ServiceWorker) => {
        const apply = () => worker.postMessage({ type: 'SKIP_WAITING' });
        window.dispatchEvent(new CustomEvent('bp:sw-update', { detail: { apply } }));
      };

      if (reg.waiting && navigator.serviceWorker.controller) {
        announce(reg.waiting);
      }

      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            announce(nw);
          }
        });
      });

      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        // لا نعيد التحميل أبداً إذا كان الطالب في امتحان/واجب/تدريب
        if (/\/(assessment|exam|homework|training|attempt|take)\//i.test(window.location.pathname)) {
          return;
        }
        reloaded = true;
        window.location.reload();
      });

      const check = () => {
        void reg.update().catch(() => undefined);
      };
      window.addEventListener('online', check);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    } catch {
      /* silent: the site works normally without the SW */
    }
  });
}
