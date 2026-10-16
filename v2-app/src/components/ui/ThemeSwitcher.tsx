import { useState, useEffect } from 'react';
import { Sun, Moon, Compass, Map } from 'lucide-react';
import { cn } from './cn';

export type ThemeVariant = 'compass' | 'atlas';
export type ThemeMode = 'dark' | 'light';

interface ThemeSwitcherProps {
  className?: string;
  compact?: boolean;
}

export default function ThemeSwitcher({ className, compact = false }: ThemeSwitcherProps) {
  const [variant, setVariant] = useState<ThemeVariant>('compass');
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const savedVariant = (localStorage.getItem('yb_theme_variant') as ThemeVariant) || 'compass';
      const savedMode = (localStorage.getItem('yb_theme_mode') as ThemeMode) || 'dark';
      setVariant(savedVariant);
      setMode(savedMode);
      document.documentElement.setAttribute('data-theme', savedVariant);
      if (savedMode === 'light') {
        document.documentElement.classList.add('light');
      } else {
        document.documentElement.classList.remove('light');
      }
    } catch {
      // ignore
    }
    setMounted(true);
  }, []);

  const toggleMode = () => {
    const nextMode: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    setMode(nextMode);
    try {
      localStorage.setItem('yb_theme_mode', nextMode);
      if (nextMode === 'light') {
        document.documentElement.classList.add('light');
      } else {
        document.documentElement.classList.remove('light');
      }
    } catch {
      // ignore
    }
  };

  const toggleVariant = () => {
    const nextVariant: ThemeVariant = variant === 'compass' ? 'atlas' : 'compass';
    setVariant(nextVariant);
    try {
      localStorage.setItem('yb_theme_variant', nextVariant);
      document.documentElement.setAttribute('data-theme', nextVariant);
    } catch {
      // ignore
    }
  };

  if (!mounted) {
    return <div className={cn('h-9 w-20', className)} aria-hidden="true" />;
  }

  return (
    <div
      role="group"
      aria-label="خيارات المظهر والسمة"
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-theme-border bg-theme-surface/80 p-1 backdrop-blur-md transition-colors',
        className,
      )}
    >
      {/* 1. زر التبديل بين النهاري والليلي */}
      <button
        type="button"
        onClick={toggleMode}
        title={mode === 'dark' ? 'التحويل إلى الوضع النهاري' : 'التحويل إلى الوضع الليلي'}
        aria-label={mode === 'dark' ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold transition-all',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-gold',
          mode === 'light'
            ? 'bg-amber-400/20 text-amber-700 shadow-sm'
            : 'text-theme-text-secondary hover:bg-theme-surface-hover hover:text-theme-text',
        )}
      >
        {mode === 'dark' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
        {!compact && <span>{mode === 'dark' ? 'ليلي' : 'نهاري'}</span>}
      </button>

      {/* فاصل دقيق */}
      <span className="h-4 w-px bg-theme-border" aria-hidden="true" />

      {/* 2. زر التبديل بين الطابعين: البوصلة الذهبية / أطلس المعرفة */}
      <button
        type="button"
        onClick={toggleVariant}
        title={
          variant === 'compass'
            ? 'التحويل إلى طابع أطلس المعرفة الحديث'
            : 'التحويل إلى طابع البوصلة الذهبية الملكي'
        }
        aria-label={
          variant === 'compass'
            ? 'التحويل إلى طابع أطلس المعرفة'
            : 'التحويل إلى طابع البوصلة الذهبية'
        }
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold transition-all',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-gold',
          variant === 'compass'
            ? 'bg-theme-gold/20 text-theme-gold'
            : 'bg-sky-400/20 text-sky-400',
        )}
      >
        {variant === 'compass' ? (
          <Compass className="h-3.5 w-3.5" />
        ) : (
          <Map className="h-3.5 w-3.5" />
        )}
        {!compact && (
          <span>{variant === 'compass' ? 'البوصلة' : 'أطلس'}</span>
        )}
      </button>
    </div>
  );
}
