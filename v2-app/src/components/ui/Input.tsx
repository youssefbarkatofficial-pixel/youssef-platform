import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from './cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className, ...rest }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-bold text-theme-text-secondary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          className={cn(
            'h-11 w-full rounded-btn border bg-theme-surface px-3.5 text-theme-text placeholder:text-theme-text-muted',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-theme-border-focus/30',
            error
              ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
              : 'border-theme-border focus:border-theme-border-focus',
            className,
          )}
          {...rest}
        />
        {error ? (
          <p className="mt-1.5 text-sm font-medium text-rose-400">{error}</p>
        ) : hint ? (
          <p className="mt-1.5 text-sm text-theme-text-muted">{hint}</p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';

export default Input;
