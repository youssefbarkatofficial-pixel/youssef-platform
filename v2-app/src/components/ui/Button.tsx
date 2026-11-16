import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';
import Spinner from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-navy-950 font-extrabold shadow-soft hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]',
  secondary:
    'bg-theme-surface/80 hover:bg-theme-surface-hover text-theme-text border border-theme-border/60 hover:border-theme-gold/40 active:scale-[0.97] shadow-sm',
  ghost:
    'bg-transparent text-theme-text-secondary hover:bg-theme-surface-hover hover:text-theme-text active:scale-[0.97]',
  danger:
    'bg-rose-600 text-white hover:bg-rose-500 active:scale-[0.97] shadow-sm',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm min-h-[36px]',
  md: 'h-11 px-5 text-base min-h-[44px]',
  lg: 'h-14 px-7 text-lg min-h-[48px]',
};

interface ButtonClassOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

// تُستخدم أيضًا لتنسيق الروابط (Link) بشكل أزرار.
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
}: ButtonClassOptions = {}): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-btn font-bold transition-[transform,opacity,background-color,border-color,box-shadow] duration-200 ease-out select-none',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-theme-base',
    'disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 disabled:hover:translate-y-0',
    variants[variant],
    sizes[size],
    fullWidth && 'w-full',
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      disabled,
      className,
      children,
      type = 'button',
      ...rest
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';

export default Button;
