'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import Link from 'next/link';
import { Gavel, ExternalLink, Clock } from 'lucide-react';
import { format } from 'date-fns';
import type { AxiosError } from 'axios';
import { useAuth } from '@/contexts/AuthContext';

type BidRecord = {
  id: string;
  auction_id: string;
  amount: number | string;
  status: string;
  placed_at: string;
  item_title: string;
  item_image?: string | null;
};

type ApiErrorPayload = {
  error?: {
    message?: string;
    code?: string;
  };
};

export default function BuyerBidsPage() {
  const { user, isAuthenticated } = useAuth();
  const { data: bids = [], isLoading, isError, error } = useQuery<BidRecord[], AxiosError<ApiErrorPayload>>({
    queryKey: ['buyer-bids', user?.id],
    queryFn: async () => {
      const { data } = await api.get('/buyer/bids');
      return data.bids || [];
    },
    enabled: isAuthenticated,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gavel className="w-6 h-6 text-primary" />
          Bid History
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Track your active and past bids</p>
      </div>

      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-white/5 uppercase">
              <tr>
                <th className="px-6 py-4 font-medium">Item</th>
                <th className="px-6 py-4 font-medium text-right">Your Bid</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Time / Date</th>
                <th className="px-6 py-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                     <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-3/4"></div></td>
                     <td className="px-6 py-4 text-right"><div className="h-4 bg-white/5 rounded w-16 ml-auto"></div></td>
                     <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-20"></div></td>
                     <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-24"></div></td>
                     <td className="px-6 py-4 text-right"><div className="h-8 bg-white/5 rounded w-24 ml-auto"></div></td>
                  </tr>
                ))
              ) : !isAuthenticated ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <p>Please log in as a buyer to view bids.</p>
                    <Link href="/login" className="text-primary mt-2 inline-block hover:underline">
                      Go to Login
                    </Link>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-amber-300">
                    <p className="font-medium">Could not load bid history.</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {error?.response?.data?.error?.message || 'Request failed. Please refresh and try again.'}
                    </p>
                  </td>
                </tr>
              ) : bids.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <Gavel className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p>No bids found.</p>
                    <Link href="/feed" className="text-primary mt-2 inline-block hover:underline">
                      Start bidding on items
                    </Link>
                  </td>
                </tr>
              ) : (
                bids.map((bid) => (
                  <tr key={bid.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 w-max">
                        <img 
                          src={bid.item_image || 'https://placehold.co/100x100/1a1a2e/7c3aed?text=Item'} 
                          alt="" 
                          className="w-10 h-10 rounded-lg object-cover bg-muted flex-shrink-0"
                        />
                        <div>
                          <p className="font-semibold text-foreground group-hover:text-primary transition-colors max-w-xs truncate">
                            {bid.item_title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">Auction #{bid.auction_id.split('-')[0]}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-semibold text-foreground">${Number(bid.amount).toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        bid.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        bid.status === 'outbid' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        bid.status === 'won' ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_10px_rgba(124,58,237,0.2)]' :
                        'bg-white/5 text-muted-foreground border border-white/10'
                      }`}>
                        {bid.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="whitespace-nowrap">{format(new Date(bid.placed_at), 'MMM d, h:mm a')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/auctions/${bid.auction_id}`}
                        className="px-4 py-2 glass-card hover:bg-white/10 text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                      >
                        View <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
