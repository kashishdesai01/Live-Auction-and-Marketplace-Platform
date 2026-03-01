import { Skeleton } from '@/components/ui/skeleton';

export default function SellerStorefrontLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in duration-500">
      
      {/* Profile Header Skeleton */}
      <div className="glass-card rounded-3xl p-8 mb-10 border border-white/5 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6 relative z-10">
          <Skeleton className="w-24 h-24 rounded-2xl shadow-xl flex-shrink-0" />
          
          <div className="flex-1 space-y-3 w-full">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full max-w-md mt-2" />
          </div>
          
          <div className="flex gap-4 w-full md:w-auto mt-6 md:mt-0">
            <Skeleton className="h-20 w-32 rounded-2xl" />
            <Skeleton className="h-20 w-32 rounded-2xl" />
          </div>
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="flex gap-6 border-b border-white/10 mb-8 pb-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-32" />
      </div>

      {/* Auctions Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-4 glass-card p-3 rounded-2xl">
            <Skeleton className="w-full aspect-[4/3] rounded-xl" />
            <div className="pt-2 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
