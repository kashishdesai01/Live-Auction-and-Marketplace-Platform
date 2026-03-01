'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { AuctionCard } from '@/components/AuctionCard';
import { Star, Package, ShieldCheck, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';

export default function SellerStorefrontPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading } = useQuery({
    queryKey: ['seller-storefront', id],
    queryFn: async () => {
      const { data } = await api.get(`/sellers/${id}`);
      return data;
    },
  });

  const seller = data?.seller;
  const auctions = data?.auctions || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Banner */}
      <div className="relative glass-card rounded-3xl border border-white/5 overflow-hidden mb-8">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/5 pointer-events-none" />
        
        <div className="relative p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center text-3xl font-bold text-primary flex-shrink-0">
            {isLoading ? '?' : seller?.display_name?.[0]?.toUpperCase()}
          </div>
          
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-6 bg-white/5 rounded w-48"></div>
                <div className="h-4 bg-white/5 rounded w-64"></div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold">{seller?.storefront_name || seller?.display_name}</h1>
                  {seller?.is_verified_seller && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                      <ShieldCheck className="w-3.5 h-3.5" /> Verified Seller
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-sm mt-1">
                  Member since {seller?.created_at ? format(new Date(seller.created_at), 'MMMM yyyy') : '—'}
                </p>
                {seller?.bio && (
                  <p className="text-sm text-foreground/80 mt-2 max-w-xl">{seller.bio}</p>
                )}
              </>
            )}
          </div>
          
          {/* Stats */}
          <div className="flex gap-6 flex-shrink-0">
            <div className="text-center">
              <div className="flex items-center gap-1 justify-center text-amber-400 mb-0.5">
                <Star className="w-4 h-4 fill-amber-400" />
                <span className="font-bold">{isLoading ? '—' : (Number(seller?.avg_rating) || 0).toFixed(1)}</span>
              </div>
              <p className="text-xs text-muted-foreground">Rating</p>
            </div>
            <div className="text-center">
              <div className="font-bold text-foreground mb-0.5">
                {isLoading ? '—' : seller?.total_sales || 0}
              </div>
              <p className="text-xs text-muted-foreground">Sales</p>
            </div>
            <div className="text-center">
              <div className="font-bold text-foreground mb-0.5">
                {auctions.length}
              </div>
              <p className="text-xs text-muted-foreground">Listings</p>
            </div>
          </div>
        </div>
      </div>

      {/* Listings */}
      <div>
        <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          Active Auctions
        </h2>
        
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass-card rounded-2xl p-4 animate-pulse h-72">
                <div className="w-full h-40 bg-white/5 rounded-xl mb-4"></div>
                <div className="h-4 bg-white/5 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-white/5 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : auctions.length === 0 ? (
          <div className="glass-card rounded-2xl border border-white/5 p-12 text-center">
            <CalendarDays className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No active auctions right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {auctions.map((auction: any) => (
              <AuctionCard key={auction.id} auction={auction} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
