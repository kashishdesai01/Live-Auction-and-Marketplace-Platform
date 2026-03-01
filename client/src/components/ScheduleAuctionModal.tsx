'use client';

import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Clock, DollarSign, TrendingUp, CreditCard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface Props {
  item: { id: string; title: string; starting_price: number } | null;
  onClose: () => void;
}

export function ScheduleAuctionModal({ item, onClose }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    start_time: '',
    end_time: '',
    bid_increment: '10',
    reserve_price: '',
  });

  const { data: sellerProfile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['seller-profile', user?.sub],
    queryFn: async () => {
      if (!user?.sub) return null;
      const { data } = await api.get(`/sellers/${user.sub}`);
      return data.seller;
    },
    enabled: !!user?.sub && !!item,
  });

  const { mutate, isPending, error } = useMutation({
    mutationFn: async () => {
      await api.post('/seller/auctions', {
        item_id: item?.id,
        start_time: form.start_time,
        end_time: form.end_time,
        bid_increment: parseFloat(form.bid_increment),
        reserve_price: form.reserve_price ? parseFloat(form.reserve_price) : undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seller-items'] });
      onClose();
    },
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Compute default times: now+1h and now+25h
  const defaultStart = () => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  };
  const defaultEnd = () => {
    const d = new Date(Date.now() + 25 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  };

  const isStripeReady = sellerProfile?.stripe_onboarding_complete;

  return (
    <Dialog open={!!item} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg glass-card border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Calendar className="w-5 h-5 text-primary" />
            Schedule Auction
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2 p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{item?.title}</p>
            <p className="text-xs text-muted-foreground">Starting at ${Number(item?.starting_price || 0).toFixed(2)}</p>
          </div>
        </div>

        {isProfileLoading ? (
           <div className="h-48 flex items-center justify-center">
             <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
           </div>
        ) : !isStripeReady ? (
           <div className="mt-4 p-6 bg-[#635BFF]/10 border border-[#635BFF]/20 rounded-xl text-center">
             <div className="w-12 h-12 bg-[#635BFF]/20 rounded-full flex items-center justify-center mx-auto mb-3">
               <CreditCard className="w-6 h-6 text-[#635BFF]" />
             </div>
             <h3 className="font-bold text-lg mb-2">Payout Account Required</h3>
             <p className="text-sm text-foreground/80 mb-6">
               To host a live auction and receive bids, you must first connect a bank account via Stripe Connect securely.
             </p>
             <Link 
               href="/seller/settings?tab=payouts"
               onClick={onClose}
               className="inline-flex items-center justify-center px-4 py-2 bg-[#635BFF] text-white rounded-lg text-sm font-semibold hover:bg-[#635BFF]/90 transition-colors shadow-lg shadow-[#635BFF]/25"
             >
               Link Bank Account
             </Link>
           </div>
        ) : (
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Start Time
                </label>
                <input
                  type="datetime-local"
                  value={form.start_time || defaultStart()}
                  onChange={e => set('start_time', e.target.value)}
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> End Time
                </label>
                <input
                  type="datetime-local"
                  value={form.end_time || defaultEnd()}
                  onChange={e => set('end_time', e.target.value)}
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" /> Bid Increment
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <input
                    type="number"
                    value={form.bid_increment}
                    onChange={e => set('bid_increment', e.target.value)}
                    min="1"
                    placeholder="10"
                    className="w-full pl-7 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" /> Reserve Price <span className="text-[10px]">(optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <input
                    type="number"
                    value={form.reserve_price}
                    onChange={e => set('reserve_price', e.target.value)}
                    placeholder="None"
                    className="w-full pl-7 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
                  />
                </div>
              </div>
            </div>

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                {(error as any)?.response?.data?.message || 'Failed to schedule auction. Please try again.'}
              </p>
            )}
           </div>
        )}

        <div className="flex justify-end gap-3 pt-2 mt-2 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm hover:bg-white/5 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => mutate()}
            disabled={isPending}
            className="px-6 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-[0_0_20px_rgba(124,58,237,0.3)]"
          >
            {isPending ? 'Scheduling...' : 'Schedule Auction'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
