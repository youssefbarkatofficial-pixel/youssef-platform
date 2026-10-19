import { Sun, Moon } from 'lucide-react';
import { cn } from './cn';
import { useTheme } from '../../hooks/useTheme';
export type { ThemeMode } from '../../hooks/useTheme';

interface ThemeSwitcherProps {
  className?: string;
  compact?: boolean;
}

export default function ThemeSwitcher({ className, compact = false }: ThemeSwitcherProps) {
  const { mode, toggleMode } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleMode}
      title={mode === 'dark' ? 'التحويل إلى الوضع النهاري' : 'التحويل إلى الوضع الليلي'}
      aria-label={mode === 'dark' ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all shadow-soft backdrop-blur-md',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-gold',
        mode === 'light'
          ? 'bg-amber-500/15 text-amber-800 hover:bg-amber-500/25'
          : 'bg-theme-surface/90 text-theme-text-secondary hover:bg-theme-surface-hover hover:text-theme-text',
        className,
      )}
    >
      {mode === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-amber-600" />}
      {!compact && <span>{mode === 'dark' ? 'ليلي' : 'نهاري'}</span>}
    </button>
  );
}
