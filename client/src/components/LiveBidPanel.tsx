'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuctionStore } from '@/stores/auctionStore';
import { useAuth } from '@/contexts/AuthContext';
import { CountdownTimer } from './CountdownTimer';
import { SetupCardModal } from './SetupCardModal';
import { cn } from '@/lib/utils';
import { TrendingUp, Users, Wifi, WifiOff, ChevronUp } from 'lucide-react';
import api from '@/lib/api';

interface LiveBidPanelProps {
  auctionId: string;
  initialPrice: number;
  endTime: string;
  bidIncrement: number;
  sellerId: string;
  status: string;
}

export function LiveBidPanel({ auctionId, initialPrice, endTime, bidIncrement, sellerId, status }: LiveBidPanelProps) {
  const { user, isAuthenticated, mutateAuth } = useAuth();
  const { connect, disconnect, placeBid, clearRejectReason, currentPrice, bids, viewerCount, isConnected, lastRejectReason, isAuctionEnded, winner } = useAuctionStore();
  const [bidAmount, setBidAmount] = useState('');
  const [priceFlash, setPriceFlash] = useState(false);
  const prevPrice = useRef(initialPrice);
  const bidsEndRef = useRef<HTMLDivElement>(null);
  
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const isBuyer = user?.roles?.includes('buyer');
  const isSeller = user?.id === sellerId;
  const requiresSetup = isBuyer && !(user as any)?.has_payment_method;

  useEffect(() => {
    connect(auctionId, initialPrice, endTime);
    return () => disconnect();
  }, [auctionId]);

  useEffect(() => {
    if (currentPrice !== prevPrice.current) {
      setPriceFlash(true);
      prevPrice.current = currentPrice;
      setTimeout(() => setPriceFlash(false), 700);
    }
  }, [currentPrice]);

  // Auto-scroll bids
  useEffect(() => {
    bidsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [bids]);

  const minBid = currentPrice + bidIncrement;

  const handlePaymentSetup = async () => {
    setShowSetupModal(true);
    try {
      const { data } = await api.post('/buyer/stripe/setup');
      setClientSecret(data.client_secret);
    } catch (err) {
      console.error(err);
      setShowSetupModal(false);
    }
  };

  const handleBid = () => {
    if (requiresSetup) {
      handlePaymentSetup();
      return;
    }
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount < minBid) return;
    placeBid(amount);
    setBidAmount('');
  };

  const quickBid = (extra: number) => {
    if (requiresSetup) {
      handlePaymentSetup();
      return;
    }
    placeBid(currentPrice + extra);
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
      <SetupCardModal 
        isOpen={showSetupModal} 
        onClose={() => setShowSetupModal(false)}
        clientSecret={clientSecret}
        onSuccess={() => {
          setShowSetupModal(false);
          mutateAuth(); // Refresh user block to pull the new has_payment_method boolean
        }}
      />
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <> <Wifi className="w-4 h-4 text-emerald-400" /> <span className="text-xs text-emerald-400 font-medium">Live</span> </>
          ) : (
            <> <WifiOff className="w-4 h-4 text-muted-foreground" /> <span className="text-xs text-muted-foreground">Connecting...</span> </>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="w-3.5 h-3.5" /> {viewerCount} watching
        </div>
      </div>

      {/* Price */}
      <div className="px-5 py-5 text-center border-b border-white/10">
        <p className="text-xs text-muted-foreground mb-1">Current Bid</p>
        <div className={cn('text-5xl font-bold text-primary transition-all', priceFlash && 'bid-flash')}>
          ${currentPrice.toFixed(2)}
        </div>
        <div className="mt-3">
          <CountdownTimer endTime={endTime} />
        </div>
      </div>

      {/* Auction ended */}
      {isAuctionEnded && (
        <div className="mx-5 my-4 p-4 rounded-xl bg-primary/10 border border-primary/20 text-center">
          {winner ? (
            <>
              <p className="font-bold text-lg">🏆 Auction Ended!</p>
              <p className="text-muted-foreground text-sm mt-1">Final price: <span className="text-primary font-bold">${Number(winner.final_price).toFixed(2)}</span></p>
              {winner.winner_id === user?.id && <p className="text-emerald-400 font-semibold mt-2">🎉 You won!</p>}
            </>
          ) : (
            <p className="font-bold">Auction has ended</p>
          )}
        </div>
      )}

      {/* Bid input */}
      {!isAuctionEnded && status === 'live' && isAuthenticated && isBuyer && !isSeller && (
        <div className="px-5 py-4 space-y-3 border-b border-white/10">
          {lastRejectReason && (
            <div className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2 flex items-center justify-between">
              <span>
                {lastRejectReason === 'too_low' && `Minimum bid is $${minBid.toFixed(2)}`}
                {lastRejectReason === 'ended' && 'Auction has ended'}
                {lastRejectReason === 'own_bid' && 'You cannot bid on your own item'}
                {lastRejectReason === 'duplicate' && 'Duplicate bid'}
              </span>
              <button onClick={clearRejectReason} className="ml-2 font-bold">✕</button>
            </div>
          )}

          {/* Quick bid buttons */}
          <div className="grid grid-cols-3 gap-2">
            {[bidIncrement, bidIncrement * 5, bidIncrement * 10].map((extra) => (
              <button
                key={extra}
                onClick={() => quickBid(extra)}
                className="text-xs py-2 rounded-lg bg-white/5 hover:bg-primary/20 hover:text-primary border border-white/10 hover:border-primary/30 transition-all font-medium"
              >
                +${extra.toFixed(0)}
              </button>
            ))}
          </div>

          {/* Custom bid */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
              <input
                type="number"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleBid()}
                placeholder={minBid.toFixed(2)}
                min={minBid}
                step={bidIncrement}
                className="w-full pl-7 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25"
              />
            </div>
            <button
              onClick={handleBid}
              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center gap-1.5"
            >
              <ChevronUp className="w-4 h-4" /> Bid
            </button>
          </div>
          <p className="text-xs text-muted-foreground text-center">Minimum bid: ${minBid.toFixed(2)}</p>
        </div>
      )}

      {/* Not authenticated */}
      {!isAuctionEnded && !isAuthenticated && (
        <div className="px-5 py-4 text-center border-b border-white/10">
          <p className="text-sm text-muted-foreground mb-3">Log in to place a bid</p>
          <a href="/login" className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            Log in to Bid
          </a>
        </div>
      )}


    </div>
  );
}
