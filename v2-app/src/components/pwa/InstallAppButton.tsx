import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { BeforeInstallPromptEvent } from '../../pwa/captureInstallPrompt';

/**
 * Floating "install the app" button — bottom-RIGHT, mirror of the compass button (bottom-LEFT).
 * Mount ONCE in the root layout (next to the compass), so it appears on every page.
 *
 * - Android/Chrome/Edge: uses the real install prompt (beforeinstallprompt).
 * - iPhone/iPad (Safari): no prompt exists → shows a short how-to sheet (Share → Add to Home Screen).
 * - Hidden when already running as an installed app, after the user dismisses it (3 days),
 *   and on pages where it could cover content (exam taking, fullscreen video). Adjust HIDE_ON to the real routes.
 */
const HIDE_ON: RegExp[] = [
  /\/assessment\//i,
  /\/exam(s)?\//i,
  /\/attempt/i,
  /\/take/i,
  /\/watch\//i,
];
const DISMISS_KEY = 'yb_install_dismissed_until';
const DISMISS_MS = 3 * 24 * 60 * 60 * 1000;

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
}
function dismissedRecently(): boolean {
  try {
    const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return until > Date.now();
  } catch { return false; }
}

export default function InstallAppButton() {
  const { pathname } = useLocation();
  const [available, setAvailable] = useState<boolean>(() => !!window.__ybInstallPrompt);
  const [installed, setInstalled] = useState<boolean>(() => isStandalone());
  const [hidden, setHidden] = useState<boolean>(() => dismissedRecently());
  const [sheet, setSheet] = useState(false);
  const ios = useMemo(() => isIOS(), []);

  useEffect(() => {
    const onAvail = () => setAvailable(true);
    const onInstalled = () => { setInstalled(true); setAvailable(false); };
    window.addEventListener('yb-install-available', onAvail);
    window.addEventListener('yb-installed', onInstalled);
    return () => {
      window.removeEventListener('yb-install-available', onAvail);
      window.removeEventListener('yb-installed', onInstalled);
    };
  }, []);

  const onClick = useCallback(async () => {
    const evt = window.__ybInstallPrompt as BeforeInstallPromptEvent | null | undefined;
    if (evt) {
      await evt.prompt();
      const choice = await evt.userChoice.catch(() => null);
      window.__ybInstallPrompt = null;
      setAvailable(false);
      if (choice?.outcome === 'accepted') setInstalled(true);
      return;
    }
    setSheet(true); // iOS and browsers without a native prompt
  }, []);

  const dismiss = useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS)); } catch { /* ignore */ }
    setHidden(true);
  }, []);

  const hideHere = HIDE_ON.some((re) => re.test(pathname));
  // show when: not installed, not dismissed, not on a hidden route, and (native prompt ready OR iOS OR generic fallback)
  if (installed || hidden || hideHere) return null;
  if (!available && !ios && !('serviceWorker' in navigator)) return null;

  return (
    <>
      <div
        dir="rtl"
        style={{
          position: 'fixed',
          right: 'max(14px, env(safe-area-inset-right, 0px))',
          bottom: 'calc(14px + env(safe-area-inset-bottom, 0px) + var(--yb-bottom-bar, 0px))',
          zIndex: 40, // below modals/drawers (z-50+), above page content
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <button
          type="button"
          onClick={onClick}
          aria-label="تحميل تطبيق منصة يوسف بركات"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            height: 48, padding: '0 16px', border: 0, borderRadius: 999, cursor: 'pointer',
            fontWeight: 800, fontSize: 15, color: '#071226',
            background: 'linear-gradient(135deg,#d4a64f,#f3d082,#b88a3a)',
            boxShadow: '0 8px 24px rgba(212,166,79,.35)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M5 21h14" />
          </svg>
          حمّل التطبيق
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="إخفاء"
          style={{
            width: 28, height: 28, borderRadius: 999, border: 0, cursor: 'pointer',
            background: 'rgba(7,18,38,.85)', color: '#f5f1e6', fontSize: 14, lineHeight: '28px',
          }}
        >
          ×
        </button>
      </div>

      {sheet && (
        <div
          role="dialog" aria-modal="true" dir="rtl"
          onClick={() => setSheet(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480, background: '#0c1a33', color: '#f5f1e6',
              borderRadius: '20px 20px 0 0', padding: '20px 20px calc(24px + env(safe-area-inset-bottom, 0px))',
              border: '1px solid rgba(212,166,79,.35)',
            }}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: 18 }}>تحميل التطبيق</h3>
            {ios ? (
              <ol style={{ margin: 0, paddingInlineStart: 20, lineHeight: 2, color: '#d6dbe7' }}>
                <li>افتح الموقع من <b>Safari</b>.</li>
                <li>اضغط زر <b>المشاركة</b> (المربع والسهم لفوق).</li>
                <li>اختار <b>إضافة إلى الشاشة الرئيسية</b>.</li>
                <li>اضغط <b>إضافة</b>، وهتلاقي الأيقونة وسط تطبيقاتك.</li>
              </ol>
            ) : (
              <ol style={{ margin: 0, paddingInlineStart: 20, lineHeight: 2, color: '#d6dbe7' }}>
                <li>افتح قائمة المتصفح (النقط التلاتة).</li>
                <li>اختار <b>تثبيت التطبيق</b> أو <b>إضافة إلى الشاشة الرئيسية</b>.</li>
                <li>أكّد، وهتلاقي الأيقونة وسط تطبيقاتك.</li>
              </ol>
            )}
            <button
              type="button" onClick={() => setSheet(false)}
              style={{ marginTop: 16, width: '100%', height: 46, border: 0, borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', color: '#071226', background: 'linear-gradient(135deg,#d4a64f,#f3d082,#b88a3a)' }}
            >
              تمام
            </button>
          </div>
        </div>
      )}
    </>
  );
}
