import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './cn';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const Icon = icon ?? Inbox;

  return (
    <div className={cn('flex flex-col items-center px-4 py-10 text-center', className)}>
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-btn border border-theme-border/60 bg-theme-surface text-theme-gold shadow-sm">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-bold text-theme-text">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-theme-text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
