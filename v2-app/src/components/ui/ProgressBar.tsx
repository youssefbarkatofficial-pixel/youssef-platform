import { cn } from './cn';

interface ProgressBarProps {
  value: number;
  label?: string;
  showValue?: boolean;
  className?: string;
}

export default function ProgressBar({
  value,
  label,
  showValue = true,
  className,
}: ProgressBarProps) {
  const safeValue = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="text-slate-300">{label}</span>
          {showValue && <span className="font-bold text-gold-400">{Math.round(safeValue)}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(safeValue)}
        className="h-2.5 w-full overflow-hidden rounded-full bg-navy-800"
      >
        <div
          className="h-full rounded-full bg-gradient-to-l from-gold-300 to-gold-600 transition-all duration-500"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}
