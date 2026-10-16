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
        'rounded-2xl border border-navy-700/60 bg-navy-900 shadow-soft',
        padded && 'p-5 md:p-6',
        hoverable &&
          'transition-all duration-200 hover:-translate-y-1 hover:border-gold-500/50 hover:shadow-glow',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
