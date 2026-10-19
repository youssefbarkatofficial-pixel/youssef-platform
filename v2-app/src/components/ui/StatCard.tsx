import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './cn';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
}

export default function StatCard({ label, value, hint, icon: Icon, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-card bg-theme-surface p-3.5 sm:p-5 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glow flex h-full flex-col justify-between min-w-0 overflow-hidden',
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <p className="text-xs sm:text-sm font-bold text-theme-text-secondary truncate">{label}</p>
          {Icon && (
            <span className="grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-btn bg-theme-gold/15 text-theme-gold">
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>
          )}
        </div>
        <p className="mt-2 font-num text-xl sm:text-2xl md:text-3xl font-extrabold text-theme-text truncate">{value}</p>
      </div>
      {hint && <p className="mt-2 text-[11px] sm:text-xs text-theme-text-muted truncate">{hint}</p>}
    </div>
  );
}
