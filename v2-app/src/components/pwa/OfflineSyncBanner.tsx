import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

// لا يُعرض ولا يُحدث أي حركة أثناء الامتحان أو الواجب أو التدريب أو المراجعة.
const EXAM_OR_GAME_ROUTES: RegExp[] = [
  /\/assessment\//i,
  /\/exam/i,
  /\/homework/i,
  /\/training/i,
  /\/revision/i,
  /\/attempt/i,
  /\/take/i,
  /\/game/i,
];

export default function OfflineSyncBanner() {
  const { pathname } = useLocation();
  const { isOnline, justReconnected } = useOnlineStatus();
  const [applyUpdate, setApplyUpdate] = useState<null | (() => void)>(null);

  useEffect(() => {
    const onUpdate = (e: Event) => {
      const apply = (e as CustomEvent).detail?.apply as (() => void) | undefined;
      if (apply) {
        setApplyUpdate(() => apply);
      }
    };
    window.addEventListener('bp:sw-update', onUpdate);
    return () => window.removeEventListener('bp:sw-update', onUpdate);
  }, []);

  if (EXAM_OR_GAME_ROUTES.some((pattern) => pattern.test(pathname))) {
    return null;
  }

  const hasUpdate = Boolean(applyUpdate) && isOnline;
  if (isOnline && !justReconnected && !hasUpdate) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center px-3 sm:top-20"
    >
      <div
        className={`pointer-events-auto flex max-w-md items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold shadow-soft ${
          !isOnline
            ? 'border-theme-gold bg-theme-surface text-theme-text'
            : hasUpdate
              ? 'border-sky-500/40 bg-theme-surface text-theme-text'
              : 'border-emerald-600/40 bg-theme-surface text-theme-text'
        }`}
      >
        {!isOnline ? (
          <>
            <WifiOff className="h-4 w-4 shrink-0 text-theme-gold" aria-hidden="true" />
            <span>أنت غير متصل بالإنترنت، بتتصفح النسخة المحفوظة على جهازك</span>
          </>
        ) : hasUpdate ? (
          <>
            <RefreshCw className="h-4 w-4 shrink-0 text-theme-gold" aria-hidden="true" />
            <span>فيه تحديث جديد للمنصة</span>
            <button
              type="button"
              onClick={() => applyUpdate?.()}
              className="ms-1 rounded-full bg-theme-text px-2.5 py-0.5 text-[11px] font-extrabold text-theme-surface hover:opacity-90 focus:outline-none"
            >
              حدّث الآن
            </button>
          </>
        ) : (
          <>
            <Wifi className="h-4 w-4 shrink-0 text-theme-accent" aria-hidden="true" />
            <span>رجع الإنترنت، بنحدّث المحتوى لحظياً</span>
          </>
        )}
      </div>
    </div>
  );
}
