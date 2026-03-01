'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuctionStore } from '@/stores/auctionStore';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { Users, Activity, Gavel, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function LiveAuctionMonitor({ params }: { params: { id: string } }) {
  const { id } = params;
  
  // Local state for sparkline data
  const [velocityData, setVelocityData] = useState<{ time: string, bids: number }[]>([]);

  // Fetch auction details
  const { data: auction, isLoading } = useQuery({
    queryKey: ['seller-auction', id],
    queryFn: async () => {
      const { data } = await api.get(`/auctions/${id}`);
      return data.auction;
    },
  });

  // Fetch live stats (velocity from redis)
  const { data: liveStats } = useQuery({
    queryKey: ['seller-auction-live', id],
    queryFn: async () => {
      const { data } = await api.get(`/seller/auctions/${id}/live`);
      return data.stats;
    },
    refetchInterval: 5000, // every 5s
  });

  // Connect to WebSocket
  const { connect, disconnect, isConnected, viewerCount, currentPrice, timeRemaining, bids } = useAuctionStore();

  useEffect(() => {
    if (auction && auction.status === 'live') {
      connect(auction.id, auction.current_price, auction.end_time);
    }
    return () => disconnect();
  }, [auction?.id, auction?.status]);

  // Update sparkline data
  useEffect(() => {
    if (liveStats) {
      setVelocityData(prev => {
        const newData = [...prev, { time: new Date().toLocaleTimeString(), bids: liveStats.bid_velocity_5m || 0 }];
        return newData.slice(-20); // Keep last 20 data points
      });
    }
  }, [liveStats]);


  if (isLoading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading monitor...</div>;
  if (!auction) return <div className="p-8 text-center text-destructive">Auction not found</div>;

  const isLive = auction.status === 'live' && isConnected;
  const minutes = Math.floor(timeRemaining / 60000);
  const seconds = Math.floor((timeRemaining % 60000) / 1000);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-[calc(100vh-80px)] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/seller/dashboard" className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{auction.item_title}</h1>
              {isLive ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-500 border border-red-500/20 flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> LIVE
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-muted-foreground border border-white/20">
                  {auction.status.toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-0.5 max-w-xl truncate">{auction.item_description}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Left Column: Big Stats & Sparkline */}
        <div className="lg:col-span-2 flex flex-col gap-6 min-h-0">
          <div className="flex gap-6">
            <div className="glass-card rounded-2xl border border-white/5 p-8 flex-1 flex flex-col justify-center items-center text-center">
              <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <Gavel className="w-4 h-4" /> Current Price
              </p>
              <p className="text-6xl font-bold text-emerald-400 font-mono tracking-tight">
                ${Number(currentPrice || auction.current_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="glass-card rounded-2xl border border-white/5 p-8 flex-1 flex flex-col justify-center items-center text-center">
              <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <Users className="w-4 h-4" /> Time Remaining
              </p>
              <p className={`text-6xl font-bold font-mono tracking-tight ${minutes < 1 ? 'text-red-500' : 'text-foreground'}`}>
                {auction.status === 'live' ? (
                  timeRemaining > 0 ? `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}` : '00:00'
                ) : (
                  auction.status === 'ended' ? 'ENDED' : 'NOT STARTED'
                )}
              </p>
            </div>
          </div>

          <div className="glass-card rounded-2xl border border-white/5 p-6 flex-1 flex flex-col bg-gradient-to-b from-transparent to-primary/5">
            <div className="flex items-center justify-between xl mb-4">
              <h2 className="font-semibold flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Bid Velocity</h2>
              <div className="flex gap-4">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Active Viewers</p>
                  <p className="text-lg font-bold text-foreground">{viewerCount}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Bids / 5min</p>
                  <p className="text-lg font-bold text-primary">{liveStats?.bid_velocity_5m || 0}</p>
                </div>
              </div>
            </div>
            
            <div className="flex-1 min-h-0 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={velocityData}>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #ffffff20', borderRadius: '12px' }}
                    itemStyle={{ color: '#7c3aed', fontWeight: 'bold' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="bids" 
                    stroke="#7c3aed" 
                    strokeWidth={4} 
                    dot={false}
                    activeDot={{ r: 6, fill: '#7c3aed' }} 
                    animationDuration={300}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Column: Bid Feed */}
        <div className="glass-card rounded-2xl border border-white/5 flex flex-col overflow-hidden min-h-0">
          <div className="p-4 border-b border-white/5 bg-white/[0.02]">
            <h2 className="font-semibold flex items-center justify-between">
              <span>Live Bid Feed</span>
              <span className="text-xs font-normal text-muted-foreground">{bids.length} total bids</span>
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {bids.length === 0 ? (
              <div className="h-full flex flex-col justify-center items-center text-muted-foreground opacity-50">
                <Gavel className="w-8 h-8 mb-2" />
                <p className="text-sm">Waiting for bids...</p>
              </div>
            ) : (
              bids.map((bid, i) => (
                <div key={i} className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                  i === 0 
                  ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)] translate-x-0' 
                  : 'bg-white/5 border-white/5'
                }`}
                style={{
                  animation: i === 0 ? 'slideInRight 0.3s ease-out forwards' : 'none'
                }}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                      i === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-muted-foreground'
                    }`}>
                      {bid.bidder_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className={`font-medium text-sm ${i === 0 ? 'text-emerald-400' : 'text-foreground'}`}>
                        {bid.bidder_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{new Date(bid.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</p>
                    </div>
                  </div>
                  <div className={`font-bold font-mono ${i === 0 ? 'text-lg text-emerald-400' : 'text-md text-foreground'}`}>
                    ${Number(bid.amount).toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
      
      <style dangerouslySetInnerHTML={{__html:`
        @keyframes slideInRight {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}} />
    </div>
  );
}
