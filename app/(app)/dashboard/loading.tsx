import { SkeletonKpi, SkeletonCard } from '@/components/app/skeleton';
import { Skeleton } from '@/components/app/skeleton';

export default function DashboardLoading() {
  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <div className="mb-8 md:mb-10 space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-12 md:h-16 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        <SkeletonKpi /><SkeletonKpi /><SkeletonKpi /><SkeletonKpi />
      </div>
      <div className="grid md:grid-cols-2 gap-5 md:gap-6">
        <SkeletonCard /><SkeletonCard />
      </div>
    </div>
  );
}
