'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { AuctionCard } from '@/components/AuctionCard';
import { Bookmark, Search } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

export default function WatchlistPage() {
  const [search, setSearch] = useState('');

  const { data: watchlist = [], isLoading } = useQuery({
    queryKey: ['buyer-watchlist'],
    queryFn: async () => {
      const { data } = await api.get('/buyer/watchlist');
      return data.watchlist;
    },
  });

  const filteredWatchlist = watchlist.filter((item: any) => 
    item.item_title?.toLowerCase().includes(search.toLowerCase()) ||
    item.category?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bookmark className="w-6 h-6 text-primary" />
            Watchlist
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Auctions you're keeping an eye on ({watchlist.length})
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search watchlist..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
             <div key={i} className="glass-card rounded-2xl p-4 animate-pulse h-80">
                <div className="w-full h-48 bg-white/5 rounded-xl mb-4"></div>
                <div className="h-4 bg-white/5 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-white/5 rounded w-1/2"></div>
             </div>
          ))}
        </div>
      ) : filteredWatchlist.length === 0 ? (
        <div className="glass-card rounded-2xl border border-white/5 p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
            <Bookmark className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold mb-2">Your watchlist is empty</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            {search 
              ? `No saved items matching "${search}"` 
              : "Keep track of interesting items by clicking the bookmark icon on any auction."}
          </p>
          <Link 
            href="/feed" 
            className="px-6 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
          >
            Browse Auctions
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredWatchlist.map((auction: any) => (
            <AuctionCard key={auction.id} auction={auction} />
          ))}
        </div>
      )}
    </div>
  );
}
