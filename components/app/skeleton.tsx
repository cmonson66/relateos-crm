import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted/30',
        className
      )}
    />
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-5 py-4 border-b border-border/20">
      <Skeleton className="w-9 h-9 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-2 w-1/4" />
      </div>
      <Skeleton className="h-2 w-16" />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card-lit border border-border/40 rounded-md p-4 space-y-3">
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-2 w-1/2" />
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-2 w-12" />
      </div>
    </div>
  );
}

export function SkeletonKpi() {
  return (
    <div className="card-lit border border-border/40 rounded-md p-4 md:p-5 relative">
      <div className="h-[3px] bg-muted/30 rounded-t-md absolute inset-x-0 top-0" />
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-2 w-16" />
        <Skeleton className="h-3 w-3" />
      </div>
      <Skeleton className="h-7 w-20" />
    </div>
  );
}
