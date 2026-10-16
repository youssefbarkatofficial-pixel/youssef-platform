import { forwardRef, useId } from 'react';
import type { SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, id, className, ...rest }, ref) => {
    const autoId = useId();
    const selectId = id ?? autoId;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="mb-1.5 block text-sm font-bold text-theme-text-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={error ? true : undefined}
            className={cn(
              'h-11 w-full appearance-none rounded-btn border bg-theme-surface ps-3.5 pe-10 text-theme-text',
              'transition-colors focus:outline-none focus:ring-2 focus:ring-theme-border-focus/30',
              error
                ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                : 'border-theme-border focus:border-theme-border-focus',
              className,
            )}
            {...rest}
          >
            {placeholder && (
              <option value="" disabled className="bg-theme-surface text-theme-text-muted">
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value} className="bg-theme-surface text-theme-text">
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-5 w-5 -translate-y-1/2 text-theme-text-muted" />
        </div>
        {error && <p className="mt-1.5 text-sm font-medium text-rose-400">{error}</p>}
      </div>
    );
  },
);

Select.displayName = 'Select';

export default Select;
