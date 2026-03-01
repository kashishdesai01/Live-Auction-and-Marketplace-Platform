'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { AuctionCard } from '@/components/AuctionCard';
import { Sparkles } from 'lucide-react';

export default function FeedPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['feed'],
    queryFn: async () => {
      const { data } = await api.get('/feed');
      return data.feed;
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-2 mb-8">
        <Sparkles className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-bold">Your Feed</h1>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl overflow-hidden animate-pulse">
              <div className="aspect-[4/3] bg-white/5" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-white/5 rounded w-3/4" />
                <div className="h-6 bg-white/5 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : data?.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground text-lg">No live auctions in your categories yet.</p>
          <p className="text-muted-foreground text-sm mt-2">Browse all auctions to discover new items.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {data?.map((auction: any) => <AuctionCard key={auction.id} auction={auction} />)}
        </div>
      )}
    </div>
  );
}
