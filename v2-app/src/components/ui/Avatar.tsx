import { cn } from './cn';

type AvatarSize = 'sm' | 'md' | 'lg';

const sizes: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-16 w-16 text-2xl',
};

interface AvatarProps {
  name?: string;
  src?: string;
  size?: AvatarSize;
  className?: string;
}

export default function Avatar({ name = '', src, size = 'md', className }: AvatarProps) {
  const initial = name.trim().charAt(0) || '؟';

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover', sizes[size], className)}
      />
    );
  }

  return (
    <span
      aria-label={name}
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-gold-500/20 font-bold text-gold-300',
        sizes[size],
        className,
      )}
    >
      {initial}
    </span>
  );
}
