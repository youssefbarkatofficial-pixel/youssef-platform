import { Capacitor } from '@capacitor/core';

// Call registerSW() once after the app mounts (production only).
// No auto-reload logic on purpose: navigations are network-first and assets are hashed,
// so every launch already gets the latest version — and we never reload a student mid-exam.
export function registerSW(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (Capacitor.isNativePlatform()) return;
  if (!import.meta.env.PROD) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(() => { /* silent: the site works normally without the SW */ });
  });
}
