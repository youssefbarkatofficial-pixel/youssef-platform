import { useLocation } from 'react-router-dom';
import { Wifi, WifiOff } from 'lucide-react';
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

  if (EXAM_OR_GAME_ROUTES.some((pattern) => pattern.test(pathname))) {
    return null;
  }

  if (isOnline && !justReconnected) {
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
            : 'border-emerald-600/40 bg-theme-surface text-theme-text'
        }`}
      >
        {!isOnline ? (
          <>
            <WifiOff className="h-4 w-4 shrink-0 text-theme-gold" aria-hidden="true" />
            <span>أنت تتصفح من الكاش بدون إنترنت — كل تحديث سيتزامن تلقائياً عند عودة الشبكة</span>
          </>
        ) : (
          <>
            <Wifi className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
            <span>عاد الاتصال — جاري تحديث البيانات والمزامنة لحظياً</span>
          </>
        )}
      </div>
    </div>
  );
}
