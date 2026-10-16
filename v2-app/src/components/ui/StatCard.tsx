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

// بطاقة رقم واحد (إحصائية) للوحات الطالب والأدمن.
export default function StatCard({ label, value, hint, icon: Icon, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-theme-border bg-theme-surface p-4 shadow-soft md:p-5 transition-colors',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-theme-text-secondary">{label}</p>
        {Icon && (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-btn bg-theme-gold/15 text-theme-gold">
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
      <p className="mt-2 font-num text-2xl font-extrabold text-theme-text md:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-theme-text-muted">{hint}</p>}
    </div>
  );
}
