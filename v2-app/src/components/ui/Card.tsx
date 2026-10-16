import type { HTMLAttributes } from 'react';
import { cn } from './cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  hoverable?: boolean;
}

export default function Card({
  padded = true,
  hoverable = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-theme-border bg-theme-surface text-theme-text shadow-soft',
        padded && 'p-5 md:p-6',
        hoverable &&
          'transition-all duration-200 hover:-translate-y-0.5 hover:border-theme-border-focus/60 hover:shadow-glow',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
