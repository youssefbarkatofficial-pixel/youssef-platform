import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import type { BeforeInstallPromptEvent } from '../../pwa/captureInstallPrompt';

/**
 * Floating "Install App" button — bottom-RIGHT, mirroring the compass button (bottom-LEFT).
 * Mounts ONCE in App.tsx layout so it is available platform-wide.
 *
 * Rules:
 * - Additions only; zero regressions to existing authenticated platform flows.
 * - Hidden inside native Capacitor container.
 * - Hidden when running in standalone mode (installed WebAPK/PWA).
 * - Hidden after 'appinstalled' event.
 * - Hidden on exam/assessment/attempt/watch pages (HIDE_ON).
 * - Hidden when temporarily dismissed by student.
 * - Shows confirmation modal with Escape, focus trap, dark/light theme support.
 * - iOS: opens guided steps (Share → Add to Home Screen) - iOS Safari Guide.
 * - Android/Desktop: confirms, reassures safety & security scan, then triggers direct download of ybplatform.apk without navigation.
 */
const HIDE_ON: RegExp[] = [
  /\/assessment\//i,
  /\/exam(s)?\//i,
  /\/attempt/i,
  /\/take/i,
  /\/watch\//i,
];
const DISMISS_KEY = 'yb_install_dismissed_until';
const DISMISS_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
}

function dismissedRecently(): boolean {
  try {
    const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return until > Date.now();
  } catch {
    return false;
  }
}

export default function InstallAppButton() {
  const { pathname } = useLocation();
  const [installed, setInstalled] = useState<boolean>(() => isStandalone());
  const [hidden, setHidden] = useState<boolean>(() => dismissedRecently());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'confirm' | 'ios' | 'fallback'>('confirm');
  const [downloadStarted, setDownloadStarted] = useState(false);

  const ios = useMemo(() => isIOS(), []);

  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onInstalled = () => {
      setInstalled(true);
      setIsModalOpen(false);
    };
    window.addEventListener('yb-installed', onInstalled);
    return () => {
      window.removeEventListener('yb-installed', onInstalled);
    };
  }, []);

  // Keyboard navigation & Focus trap for Modal
  useEffect(() => {
    if (!isModalOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus primary action after mounting
    const timer = setTimeout(() => {
      primaryButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen]);

  const openModal = useCallback(() => {
    if (ios) {
      setModalMode('ios');
    } else {
      setModalMode('confirm');
    }
    setDownloadStarted(false);
    setIsModalOpen(true);
  }, [ios]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setDownloadStarted(false);
    setTimeout(() => {
      triggerButtonRef.current?.focus();
    }, 50);
  }, []);

  // Direct APK file download without navigating to another page
  const handleInstallClick = useCallback(() => {
    const a = document.createElement('a');
    a.href = '/downloads/ybplatform.apk';
    a.download = 'ybplatform.apk';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setDownloadStarted(true);
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
    } catch {
      /* ignore storage errors */
    }
    setHidden(true);
  }, []);

  // Hidden inside native app (Capacitor)
  if (Capacitor.isNativePlatform()) return null;

  const hideHere = HIDE_ON.some((re) => re.test(pathname));
  if (installed || hidden || hideHere) return null;

  return (
    <>
      {/* Floating Trigger Button (Bottom-Right, mirroring Compass at bottom-left) */}
      <div
        dir="rtl"
        style={{
          position: 'fixed',
          right: 'max(14px, env(safe-area-inset-right, 0px))',
          bottom: 'calc(14px + env(safe-area-inset-bottom, 0px) + var(--yb-bottom-bar, 0px))',
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <button
          ref={triggerButtonRef}
          type="button"
          onClick={openModal}
          aria-label="تثبيت تطبيق منصة يوسف بركات"
          aria-haspopup="dialog"
          aria-expanded={isModalOpen}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            height: 48,
            padding: '0 18px',
            border: '1px solid rgba(212,166,79,0.5)',
            borderRadius: 999,
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: 15,
            color: '#071226',
            background: 'linear-gradient(135deg,#d4a64f,#f3d082,#b88a3a)',
            boxShadow: '0 8px 24px rgba(212,166,79,.38), 0 2px 6px rgba(0,0,0,.2)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
            <path d="M12 18h.01" />
            <path d="M12 6v6" />
            <path d="m9 9 3 3 3-3" />
          </svg>
          تثبيت التطبيق
        </button>

        <button
          type="button"
          onClick={dismiss}
          aria-label="إخفاء زر تثبيت التطبيق"
          title="إخفاء مؤقتًا"
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            border: '1px solid rgba(212,166,79,0.3)',
            cursor: 'pointer',
            background: 'var(--bg-base, #071326)',
            color: 'var(--text-primary, #f5f1e6)',
            fontSize: 16,
            lineHeight: '26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
        >
          ×
        </button>
      </div>

      {/* Confirmation & Installation Modal with Accessibility & Dual Theme Support */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="yb-install-title"
          aria-describedby="yb-install-desc"
          dir="rtl"
          onClick={closeModal}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            background: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            ref={modalRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 440,
              backgroundColor: 'var(--bg-surface, #0c1b33)',
              color: 'var(--text-primary, #f8fafc)',
              borderRadius: 20,
              border: '1px solid var(--border-focus, rgba(212,166,79,0.4))',
              boxShadow: 'var(--card-shadow, 0 24px 48px rgba(0,0,0,0.6))',
              padding: '24px',
              position: 'relative',
            }}
          >
            {/* Close Button in Modal Header */}
            <button
              type="button"
              onClick={closeModal}
              aria-label="إغلاق النافذة"
              style={{
                position: 'absolute',
                top: 16,
                left: 16,
                width: 32,
                height: 32,
                borderRadius: 999,
                border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
                background: 'var(--bg-surface-hover, rgba(255,255,255,0.06))',
                color: 'var(--text-secondary, #d6dbe7)',
                fontSize: 18,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>

            {/* Modal Icon & Branding */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <img
                src="/icons/logo.svg"
                alt="منصة يوسف بركات"
                style={{
                  width: 52,
                  height: 52,
                  objectFit: 'contain',
                  flexShrink: 0,
                  filter: 'drop-shadow(0 4px 12px rgba(212,166,79,0.35))',
                }}
              />
              <div>
                <h3
                  id="yb-install-title"
                  style={{
                    margin: 0,
                    fontSize: 19,
                    fontWeight: 800,
                    color: 'var(--text-primary, #f8fafc)',
                    lineHeight: 1.3,
                  }}
                >
                  تثبيت تطبيق منصة يوسف بركات
                </h3>
                <span style={{ fontSize: 13, color: 'var(--brand-gold, #d4a64f)', fontWeight: 600 }}>
                  تطبيق رسمي معتمد للأندرويد
                </span>
              </div>
            </div>

            {/* Modal Body: Case 1 - Confirm Prompt */}
            {modalMode === 'confirm' && !downloadStarted && (
              <>
                <p
                  id="yb-install-desc"
                  style={{
                    margin: '0 0 16px',
                    fontSize: 15,
                    lineHeight: 1.6,
                    color: 'var(--text-secondary, #cbd5e1)',
                  }}
                >
                  تنزيل تطبيق منصة يوسف بركات؟ هيتثبّت على موبايلك زي أي تطبيق.
                </p>

                <div
                  style={{
                    background: 'var(--brand-gold-subtle, rgba(212,166,79,0.08))',
                    border: '1px solid var(--border-subtle, rgba(212,166,79,0.2))',
                    borderRadius: 14,
                    padding: '14px 16px',
                    marginBottom: 20,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ fontSize: 16, lineHeight: '20px' }}>🛡️</span>
                      <span style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary, #cbd5e1)' }}>
                        <strong style={{ color: 'var(--brand-gold, #d4a64f)' }}>التطبيق آمن 100%:</strong> تطبيق المنصة سليم وموثوق تماماً وبلا أي مشاكل برمجية أو أمنية.
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ fontSize: 16, lineHeight: '20px' }}>🔍</span>
                      <span style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary, #cbd5e1)' }}>
                        <strong style={{ color: 'var(--brand-gold, #d4a64f)' }}>فحص الأمان (Scan):</strong> إذا طلب هاتفك فحص أمان للملف قبل التثبيت، وافق عليه عادي جداً وهيتثبت معاك بكل أمان.
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ fontSize: 16, lineHeight: '20px' }}>⚡</span>
                      <span style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary, #cbd5e1)' }}>
                        <strong style={{ color: 'var(--brand-gold, #d4a64f)' }}>تحميل مباشر:</strong> يبدأ تنزيل التطبيق فوراً على جهازك دون الانتقال إلى أي صفحة أخرى.
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    ref={primaryButtonRef}
                    type="button"
                    onClick={handleInstallClick}
                    style={{
                      flex: 1,
                      height: 46,
                      border: 0,
                      borderRadius: 12,
                      fontWeight: 800,
                      fontSize: 15,
                      cursor: 'pointer',
                      color: '#071226',
                      background: 'linear-gradient(135deg,#d4a64f,#f3d082,#b88a3a)',
                      boxShadow: '0 4px 14px rgba(212,166,79,0.3)',
                      transition: 'filter 0.15s ease',
                    }}
                  >
                    نعم، نزّله
                  </button>

                  <button
                    type="button"
                    onClick={closeModal}
                    style={{
                      flex: 1,
                      height: 46,
                      border: '1px solid var(--border-subtle, rgba(212,166,79,0.35))',
                      borderRadius: 12,
                      fontWeight: 700,
                      fontSize: 15,
                      cursor: 'pointer',
                      color: 'var(--text-primary, #f8fafc)',
                      background: 'var(--bg-surface-hover, rgba(255,255,255,0.06))',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    لاحقًا
                  </button>
                </div>
              </>
            )}

            {/* Modal Body: Case 1b - Download in Progress / Direct Installation Instructions */}
            {modalMode === 'confirm' && downloadStarted && (
              <>
                <div
                  style={{
                    background: 'var(--brand-gold-subtle, rgba(212,166,79,0.08))',
                    border: '1px solid var(--border-subtle, rgba(212,166,79,0.25))',
                    borderRadius: 14,
                    padding: '16px',
                    marginBottom: 20,
                  }}
                >
                  <p
                    style={{
                      margin: '0 0 10px',
                      fontSize: 15,
                      fontWeight: 700,
                      color: 'var(--brand-gold, #d4a64f)',
                    }}
                  >
                    🎉 بدأ تحميل ملف التطبيق الآن...
                  </p>
                  <ol
                    style={{
                      margin: 0,
                      paddingInlineStart: 20,
                      fontSize: 13.5,
                      lineHeight: 1.9,
                      color: 'var(--text-secondary, #cbd5e1)',
                    }}
                  >
                    <li>تابع شريط إشعارات الهاتف أو مجلد التنزيلات (Downloads).</li>
                    <li>اضغط على الملف <b>ybplatform.apk</b> بعد اكتمال التحميل.</li>
                    <li>لو ظهر لك تنبيه فحص أمان (Scan)، اعمله بصورة طبيعية واضغط <b>تثبيت</b>. التطبيق آمن تماماً!</li>
                  </ol>
                </div>

                <button
                  ref={primaryButtonRef}
                  type="button"
                  onClick={closeModal}
                  style={{
                    width: '100%',
                    height: 46,
                    border: 0,
                    borderRadius: 12,
                    fontWeight: 800,
                    fontSize: 15,
                    cursor: 'pointer',
                    color: '#071226',
                    background: 'linear-gradient(135deg,#d4a64f,#f3d082,#b88a3a)',
                    boxShadow: '0 4px 14px rgba(212,166,79,0.3)',
                  }}
                >
                  فهمت، شكراً
                </button>
              </>
            )}

            {/* Modal Body: Case 2 - iOS Safari Guide */}
            {modalMode === 'ios' && (
              <>
                <p
                  id="yb-install-desc"
                  style={{
                    margin: '0 0 14px',
                    fontSize: 14.5,
                    lineHeight: 1.6,
                    color: 'var(--text-secondary, #cbd5e1)',
                  }}
                >
                  على أجهزة iPhone و iPad، يمكنك تثبيت المنصة كتطبيق في 3 خطوات بسيطة من متصفح Safari:
                </p>

                <ol
                  style={{
                    margin: '0 0 18px',
                    paddingInlineStart: 20,
                    lineHeight: 2.1,
                    color: 'var(--text-secondary, #cbd5e1)',
                    fontSize: 14,
                  }}
                >
                  <li>
                    اضغط على زر <b>المشاركة</b> (المربع مع سهم للأعلى) في شريط Safari.
                  </li>
                  <li>
                    مرر للأسفل واضغط على <b>إضافة إلى الشاشة الرئيسية</b> (Add to Home Screen).
                  </li>
                  <li>
                    اضغط على <b>إضافة</b> في الزاوية، وستظهر أيقونة المنصة وسط تطبيقاتك.
                  </li>
                </ol>

                <button
                  ref={primaryButtonRef}
                  type="button"
                  onClick={closeModal}
                  style={{
                    width: '100%',
                    height: 46,
                    border: 0,
                    borderRadius: 12,
                    fontWeight: 800,
                    fontSize: 15,
                    cursor: 'pointer',
                    color: '#071226',
                    background: 'linear-gradient(135deg,#d4a64f,#f3d082,#b88a3a)',
                  }}
                >
                  فهمت، شكراً
                </button>
              </>
            )}

            {/* Modal Body: Case 3 - Fallback Guide */}
            {modalMode === 'fallback' && (
              <>
                <p
                  id="yb-install-desc"
                  style={{
                    margin: '0 0 14px',
                    fontSize: 14.5,
                    lineHeight: 1.6,
                    color: 'var(--text-secondary, #cbd5e1)',
                  }}
                >
                  لتثبيت التطبيق يدويًا من المتصفح:
                </p>

                <ol
                  style={{
                    margin: '0 0 18px',
                    paddingInlineStart: 20,
                    lineHeight: 2.1,
                    color: 'var(--text-secondary, #cbd5e1)',
                    fontSize: 14,
                  }}
                >
                  <li>
                    افتح قائمة المتصفح (النقط الثلاثة <b>⋮</b> في أعلى أو أسفل الشاشة).
                  </li>
                  <li>
                    اختر <b>تثبيت التطبيق</b> أو <b>إضافة إلى الشاشة الرئيسية</b>.
                  </li>
                  <li>
                    أكّد الاختيار، وسيتم تثبيت التطبيق مباشرة على جهازك.
                  </li>
                </ol>

                <button
                  ref={primaryButtonRef}
                  type="button"
                  onClick={closeModal}
                  style={{
                    width: '100%',
                    height: 46,
                    border: 0,
                    borderRadius: 12,
                    fontWeight: 800,
                    fontSize: 15,
                    cursor: 'pointer',
                    color: '#071226',
                    background: 'linear-gradient(135deg,#d4a64f,#f3d082,#b88a3a)',
                  }}
                >
                  فهمت، شكراً
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
