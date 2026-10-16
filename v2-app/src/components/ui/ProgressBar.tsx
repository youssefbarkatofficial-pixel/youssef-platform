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
          <span className="font-medium text-theme-text-secondary">{label}</span>
          {showValue && <span className="font-bold text-theme-gold">{Math.round(safeValue)}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(safeValue)}
        className="h-2.5 w-full overflow-hidden rounded-full bg-theme-surface border border-theme-border/40"
      >
        <div
          className="h-full rounded-full bg-gradient-to-l from-theme-gold to-theme-gold/70 transition-all duration-500 shadow-sm"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}
