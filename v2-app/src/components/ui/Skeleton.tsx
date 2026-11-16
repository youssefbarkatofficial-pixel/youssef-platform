import { cn } from './cn';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'skeleton-shimmer rounded-btn bg-theme-surface-hover/80 border border-theme-border/30',
        className,
      )}
    />
  );
}

export function CourseCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex h-full flex-col overflow-hidden rounded-card border border-theme-border/40 bg-theme-surface shadow-soft"
    >
      <Skeleton className="aspect-video w-full rounded-none border-0" />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-4/5 rounded-lg" />
        <Skeleton className="h-5 w-1/3 rounded-lg" />
        <div className="mt-auto pt-3">
          <Skeleton className="h-11 w-full rounded-btn" />
        </div>
      </div>
    </div>
  );
}

export function ListRowSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="space-y-3 rounded-card border border-theme-border/40 bg-theme-surface p-5 md:p-6 shadow-soft"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-6 w-2/3 rounded-lg" />
          <Skeleton className="h-4 w-1/3 rounded-lg" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="flex gap-4 pt-1">
        <Skeleton className="h-4 w-28 rounded-lg" />
        <Skeleton className="h-4 w-24 rounded-lg" />
      </div>
      <Skeleton className="h-9 w-28 rounded-btn" />
    </div>
  );
}

export default Skeleton;
