import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export type BadgeVariant = 'gold' | 'success' | 'danger' | 'info' | 'neutral';

const variants: Record<BadgeVariant, string> = {
  gold: 'bg-theme-gold/20 text-theme-gold shadow-sm',
  success: 'bg-emerald-500/20 text-emerald-400 shadow-sm',
  danger: 'bg-rose-500/20 text-rose-400 shadow-sm',
  info: 'bg-sky-500/20 text-sky-400 shadow-sm',
  neutral: 'bg-theme-surface-hover text-theme-text-secondary shadow-sm',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export default function Badge({ variant = 'neutral', className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-colors select-none',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
