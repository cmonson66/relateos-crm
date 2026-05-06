import { SkeletonRow, Skeleton } from '@/components/app/skeleton';

export default function ContactsLoading() {
  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <div className="card-lit border border-border/40 rounded-md overflow-hidden">
        <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
      </div>
    </div>
  );
}
