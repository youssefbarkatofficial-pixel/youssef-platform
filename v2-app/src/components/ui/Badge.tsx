import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export type BadgeVariant = 'gold' | 'success' | 'danger' | 'info' | 'neutral';

const variants: Record<BadgeVariant, string> = {
  gold: 'bg-gold-500/15 text-gold-300 border-gold-500/30',
  success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  danger: 'bg-red-500/15 text-red-300 border-red-500/30',
  info: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  neutral: 'bg-navy-800 text-slate-300 border-navy-600',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export default function Badge({ variant = 'neutral', className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
