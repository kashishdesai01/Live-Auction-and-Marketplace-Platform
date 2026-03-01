import { Skeleton } from '@/components/ui/skeleton';

export default function AuctionDetailLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* Left Side: Image and Details */}
        <div>
          <Skeleton className="w-full aspect-[4/3] rounded-2xl mb-4" />
          <div className="flex gap-2 pb-2">
            <Skeleton className="w-20 h-16 rounded-lg" />
            <Skeleton className="w-20 h-16 rounded-lg" />
            <Skeleton className="w-20 h-16 rounded-lg" />
          </div>
          
          <div className="mt-6 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-1/4 mb-4" />
            
            <div className="space-y-2 pt-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>

            <Skeleton className="h-24 w-full rounded-xl mt-6" /> {/* Seller Card */}
            <Skeleton className="h-36 w-full rounded-xl mt-4" /> {/* Info Card */}
          </div>
        </div>

        {/* Right Side: Bid Panel */}
        <div className="lg:sticky lg:top-24 self-start space-y-4">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" /> {/* Bid History table */}
        </div>

      </div>
    </div>
  );
}
