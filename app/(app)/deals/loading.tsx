import { Skeleton } from '@/components/app/skeleton';

export default function DealsLoading() {
  return (
    <div className="p-4 md:p-8 max-w-[1800px]">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <div className="flex gap-3 md:gap-4 overflow-hidden">
        {[0,1,2,3,4].map(i => (
          <div key={i} className="w-[85vw] sm:w-72 shrink-0">
            <Skeleton className="h-10 rounded-t-md" />
            <div className="border border-border/40 rounded-b-md p-2 space-y-2 min-h-[300px]">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
