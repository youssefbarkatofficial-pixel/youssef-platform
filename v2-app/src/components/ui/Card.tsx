import type { HTMLAttributes } from 'react';
import { cn } from './cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  hoverable?: boolean;
  spotlight?: boolean;
  tilt?: boolean;
}

export default function Card({
  padded = true,
  hoverable = false,
  spotlight: _spotlight,
  tilt: _tilt,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        'group/card relative overflow-hidden rounded-card bg-theme-surface text-theme-text shadow-soft border border-theme-border/60 transition-[transform,box-shadow,border-color] duration-300 ease-out',
        padded && 'p-5 md:p-6',
        hoverable &&
          'hover:-translate-y-1 hover:shadow-glow hover:border-theme-gold/45',
        className,
      )}
      {...rest}
    >
      {/* Top subtle specular reflection line (Compass Gold Hairline Signature) */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent dark:via-white/10 transition-opacity duration-300',
          hoverable && 'group-hover/card:via-theme-gold/40',
        )}
      />
      {children}
    </div>
  );
}
