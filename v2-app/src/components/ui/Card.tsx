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
        'relative overflow-hidden rounded-card bg-theme-surface text-theme-text shadow-soft border border-theme-border/50 transition-all duration-300 ease-out',
        padded && 'p-5 md:p-6',
        hoverable &&
          'hover:-translate-y-1 hover:shadow-glow hover:border-theme-gold/40',
        className,
      )}
      {...rest}
    >
      {/* Top subtle specular reflection line (Haute Glass Finish) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent dark:via-white/10"
      />
      {children}
    </div>
  );
}
