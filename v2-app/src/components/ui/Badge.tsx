import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export type BadgeVariant = 'gold' | 'success' | 'danger' | 'info' | 'neutral';

const variants: Record<BadgeVariant, string> = {
  gold: 'bg-theme-gold/15 text-theme-gold border-theme-gold/30',
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  danger: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  info: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  neutral: 'bg-theme-surface border-theme-border text-theme-text-secondary',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export default function Badge({ variant = 'neutral', className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold transition-colors select-none',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
