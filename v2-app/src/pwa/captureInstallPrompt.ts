// Import this FIRST in main.tsx (before React renders): the browser may fire
// `beforeinstallprompt` before any component mounts, so we capture it globally.
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

declare global {
  interface Window {
    __ybInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

if (typeof window !== 'undefined') {
  window.__ybInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__ybInstallPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event('yb-install-available'));
  });
  window.addEventListener('appinstalled', () => {
    window.__ybInstallPrompt = null;
    window.dispatchEvent(new Event('yb-installed'));
  });
}

export {};
