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
        'rounded-2xl border border-navy-700/60 bg-navy-900 p-4 shadow-soft md:p-5',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-slate-400">{label}</p>
        {Icon && (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold-500/15 text-gold-400">
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-extrabold text-white md:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
