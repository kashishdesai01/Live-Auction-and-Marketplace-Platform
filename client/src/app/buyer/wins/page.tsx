'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import Link from 'next/link';
import { ShoppingBag, Search, ExternalLink, Trophy, Truck, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function BuyerWinsPage() {
  const { data: wins = [], isLoading } = useQuery({
    queryKey: ['buyer-wins'],
    queryFn: async () => {
      const { data } = await api.get('/buyer/wins');
      // Assume endpoint returns items won / orders created
      return data.orders || [];
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
            <Trophy className="w-6 h-6 text-primary" />
            Won Auctions & Purchases
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Review your successful bids and track shipments</p>
        </div>
      </div>

      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-white/5 uppercase">
              <tr>
                <th className="px-6 py-4 font-medium">Item Won</th>
                <th className="px-6 py-4 font-medium">Seller Info</th>
                <th className="px-6 py-4 font-medium">Price Paid</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                     <td className="px-6 py-4"><div className="h-10 bg-white/5 rounded w-3/4"></div></td>
                     <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-1/2"></div></td>
                     <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-16"></div></td>
                     <td className="px-6 py-4"><div className="h-6 bg-white/5 rounded w-20"></div></td>
                     <td className="px-6 py-4 text-right"><div className="h-8 bg-white/5 rounded w-24 ml-auto"></div></td>
                  </tr>
                ))
              ) : wins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p>No won auctions yet.</p>
                    <Link href="/feed" className="text-primary mt-2 inline-block hover:underline">
                      Go win your first auction
                    </Link>
                  </td>
                </tr>
              ) : (
                wins.map((order: any) => (
                  <tr key={order.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4 max-w-sm">
                        <img 
                          src={order.item_image || 'https://placehold.co/100x100/1a1a2e/7c3aed?text=Item'} 
                          alt="" 
                          className="w-12 h-12 rounded-lg object-cover bg-muted flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                            {order.item_title}
                          </p>
                          <div className="text-xs text-muted-foreground mt-1">
                            {format(new Date(order.created_at), 'MMM d, yyyy')}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center font-bold text-[10px] text-muted-foreground">
                          {order.seller_name?.charAt(0) || '?'}
                        </div>
                        <span className="font-medium">{order.seller_name}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <p className="font-bold text-foreground text-lg">${Number(order.amount).toFixed(2)}</p>
                      
                      {order.status === 'paid' && (
                        <div className="flex items-center gap-1 text-[10px] text-emerald-400 mt-0.5">
                          <ShieldCheck className="w-3 h-3" /> Paid via Stripe
                        </div>
                      )}
                      {order.status === 'failed' && (
                        <div className="flex items-center gap-1 text-[10px] text-destructive mt-0.5">
                          <ShieldAlert className="w-3 h-3" /> Payment Failed
                        </div>
                      )}
                      {order.status === 'pending' && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-500 mt-0.5 animate-pulse">
                          <Clock className="w-3 h-3" /> Processing...
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {order.shipping_status === 'shipped' ? (
                        <div>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Truck className="w-3.5 h-3.5" /> Shipped
                          </span>
                          {order.tracking_number && (
                            <p className="text-[10px] text-muted-foreground mt-1 tracking-wide font-mono">
                              TRK: {order.tracking_number}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-muted-foreground border border-white/10">
                          Processing
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button className="px-4 py-2 glass-card hover:bg-white/10 text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap">
                        Order Details
                      </button>
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
