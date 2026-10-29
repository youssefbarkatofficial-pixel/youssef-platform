import { useEffect, useRef, useState } from 'react';
import { ArrowDown, RefreshCw } from 'lucide-react';

const THRESHOLD = 65; // الحد الأدنى بالسحب للتفعيل بالبكسل

/**
 * مكون السحب للتحديث (Pull to Refresh) للهواتف وتطبيق الأندرويد:
 * يتيح للطالب أو الأدمن شد الصفحة للأسفل لعمل إعادة تحميل فورية للبيانات.
 */
export default function PullToRefresh() {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const startYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);

  useEffect(() => {
    function handleTouchStart(e: TouchEvent) {
      // نبدأ فقط إذا كان المستخدم في أعلى الصفحة تماماً
      if (window.scrollY <= 0 && e.touches.length === 1) {
        startYRef.current = e.touches[0].clientY;
        pullingRef.current = true;
      }
    }

    function handleTouchMove(e: TouchEvent) {
      if (!pullingRef.current || startYRef.current === null || refreshing) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - startYRef.current;

      // سحب للأسفل فقط وفي أعلى الصفحة
      if (diff > 0 && window.scrollY <= 0) {
        const dampened = Math.min(diff * 0.42, 90);
        setPullY(dampened);
      } else {
        setPullY(0);
      }
    }

    function handleTouchEnd() {
      if (!pullingRef.current || refreshing) return;

      pullingRef.current = false;
      startYRef.current = null;

      if (pullY >= THRESHOLD) {
        setRefreshing(true);
        setPullY(THRESHOLD);
        setTimeout(() => {
          window.location.reload();
        }, 350);
      } else {
        setPullY(0);
      }
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [pullY, refreshing]);

  if (pullY <= 0 && !refreshing) return null;

  const isTriggered = pullY >= THRESHOLD || refreshing;

  return (
    <aside
      aria-live="polite"
      aria-label="تحديث الصفحة"
      className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none transition-transform duration-150"
      style={{ transform: `translateY(${Math.max(pullY - 12, 10)}px)` }}
    >
      <div className="flex items-center gap-2 rounded-full border border-gold-400/40 bg-slate-900/95 px-4 py-2 text-xs font-bold text-gold-300 shadow-xl backdrop-blur-md">
        {refreshing ? (
          <RefreshCw className="h-4 w-4 animate-spin text-gold-400" />
        ) : (
          <ArrowDown
            className={`h-4 w-4 transition-transform duration-200 ${
              isTriggered ? 'rotate-180 text-gold-400' : 'text-slate-400'
            }`}
          />
        )}
        <span>
          {refreshing
            ? 'جاري تحديث المنصة...'
            : isTriggered
            ? 'أفلت الآن للتحديث'
            : 'اسحب للأسفل للتحديث'}
        </span>
      </div>
    </aside>
  );
}
