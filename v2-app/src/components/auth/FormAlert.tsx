import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../ui/cn';

type AlertType = 'error' | 'success' | 'info';

const icons: Record<AlertType, LucideIcon> = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
};

const styles: Record<AlertType, string> = {
  error: 'border-red-500/40 bg-red-500/10 text-red-300',
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  info: 'border-gold-500/40 bg-gold-500/10 text-gold-200',
};

interface FormAlertProps {
  type?: AlertType;
  children: ReactNode;
}

export default function FormAlert({ type = 'error', children }: FormAlertProps) {
  const Icon = icons[type];

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm', styles[type])}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="flex-1 leading-relaxed">{children}</div>
    </div>
  );
}
