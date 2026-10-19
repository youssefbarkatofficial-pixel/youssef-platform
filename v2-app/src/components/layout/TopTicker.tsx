import { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';

const STORAGE_KEY = 'yb_ticker_dismissed_until';
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

const QUOTES = [
  'اعتنوا بأبنائكم فالعلم وُضع لأمثالهم — أ. يوسف بركات',
  'هدفنا ليس الوصول إلى المجد.. بل أن نصنع المجد بأنفسنا ونضع بصمة عريقة فى أبنائنا — أ. يوسف بركات',
  'منصتك الأولى لتعلم وفهم الجغرافيا والتاريخ بأسلوب بسيط وممتع',
  'العلم نور.. ونور الله لا يُهدى إلا للمتقين — فاتقِ الله',
];

interface TopTickerProps {
  quotes?: string[];
}

export default function TopTicker({ quotes }: TopTickerProps) {
  const activeQuotes = quotes && quotes.length > 0 ? quotes : QUOTES;
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      const until = localStorage.getItem(STORAGE_KEY);
      if (until && Number(until) > Date.now()) {
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(media.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    if (isPaused || reducedMotion || isDismissed) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % activeQuotes.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [isPaused, reducedMotion, isDismissed, activeQuotes.length]);

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now() + DISMISS_DURATION_MS));
    } catch {
      // ignore
    }
    setIsDismissed(true);
  };

  if (isDismissed || activeQuotes.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="شريط الاقتباسات التعليمية"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative z-30 flex h-9 w-full items-center justify-between overflow-hidden bg-gradient-to-r from-theme-gold/10 via-theme-surface to-theme-gold/10 px-4 text-xs font-semibold text-theme-text-secondary transition-colors"
    >
      <div className="w-6 shrink-0" aria-hidden="true" />

      <div className="flex items-center justify-center gap-2 max-w-4xl truncate px-2">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-theme-gold animate-pulse" />
        <span
          key={index}
          className="truncate animate-in fade-in slide-in-from-bottom-1 duration-500"
        >
          {activeQuotes[index % activeQuotes.length]}
        </span>
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        title="إغلاق الشريط لمدة 24 ساعة"
        aria-label="إغلاق شريط الاقتباسات لمدة 24 ساعة"
        className="grid h-6 w-6 place-items-center rounded-full text-theme-text-muted hover:bg-theme-surface-hover hover:text-theme-text transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
