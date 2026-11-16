import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export type BadgeVariant = 'gold' | 'success' | 'danger' | 'info' | 'neutral';

const variants: Record<BadgeVariant, string> = {
  gold: 'bg-theme-gold/20 text-theme-gold [html.light_&]:bg-theme-gold/15 shadow-sm',
  success: 'bg-emerald-500/20 text-emerald-300 [html.light_&]:bg-emerald-600/12 [html.light_&]:text-emerald-800 shadow-sm',
  danger: 'bg-rose-500/20 text-rose-300 [html.light_&]:bg-rose-600/12 [html.light_&]:text-rose-800 shadow-sm',
  info: 'bg-sky-500/20 text-sky-300 [html.light_&]:bg-sky-600/12 [html.light_&]:text-sky-800 shadow-sm',
  neutral: 'bg-theme-surface-hover text-theme-text-secondary shadow-sm',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export default function Badge({ variant = 'neutral', className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-colors duration-200 select-none',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
