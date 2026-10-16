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
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          className={cn(
            'h-11 w-full rounded-xl border bg-navy-900 px-3 text-white placeholder:text-slate-500',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-gold-500/40',
            error
              ? 'border-red-500 focus:border-red-500'
              : 'border-navy-700 focus:border-gold-500',
            className,
          )}
          {...rest}
        />
        {error ? (
          <p className="mt-1.5 text-sm text-red-400">{error}</p>
        ) : hint ? (
          <p className="mt-1.5 text-sm text-slate-500">{hint}</p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';

export default Input;
