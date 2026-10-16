import { Check, X } from 'lucide-react';
import { cn } from '../ui/cn';
import { getPasswordChecks, getPasswordStrength } from '../../lib/validation';

interface PasswordStrengthProps {
  password: string;
}

const barColors = ['bg-red-500', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-500'];

export default function PasswordStrength({ password }: PasswordStrengthProps) {
  const { score, label } = getPasswordStrength(password);
  const checks = getPasswordChecks(password);

  const rules = [
    { ok: checks.length, text: '8 أحرف على الأقل' },
    { ok: checks.uppercase, text: 'حرف إنجليزي كبير (A-Z)' },
    { ok: checks.digit, text: 'رقم واحد على الأقل' },
    { ok: checks.symbol, text: 'رمز واحد من: ! @ # $ % ^ & * ?' },
  ];

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-4 gap-1.5" aria-hidden="true">
          {[1, 2, 3, 4].map((step) => (
            <span
              key={step}
              className={cn(
                'h-1.5 rounded-full transition-colors',
                step <= score ? barColors[score] : 'bg-navy-800',
              )}
            />
          ))}
        </div>
        <span className="min-w-16 text-end text-xs font-bold text-slate-300">{label}</span>
      </div>

      <ul className="grid gap-1 text-xs sm:grid-cols-2">
        {rules.map((rule) => (
          <li
            key={rule.text}
            className={cn('flex items-center gap-1.5', rule.ok ? 'text-emerald-400' : 'text-slate-500')}
          >
            {rule.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
            {rule.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
