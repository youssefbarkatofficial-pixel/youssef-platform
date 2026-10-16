import { cn } from './cn';

type SpinnerSize = 'sm' | 'md' | 'lg';

const sizes: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-10 w-10',
};

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

export default function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="جارٍ التحميل"
      className={cn(
        'inline-block animate-spin rounded-full border-2 border-current border-t-transparent',
        sizes[size],
        className,
      )}
    />
  );
}
