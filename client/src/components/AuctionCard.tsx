'use client';

import Link from 'next/link';
import Image from 'next/image';
import { CountdownTimer } from './CountdownTimer';
import { Eye, TrendingUp } from 'lucide-react';

interface AuctionCardProps {
  auction: {
    id: string;
    item_title?: string;
    item_image?: string;
    image_urls?: string[];
    current_price: number;
    end_time: string;
    auction_status?: string;
    status?: string;
    bid_count?: number;
    viewer_count?: number;
    category_name?: string;
    seller_name?: string;
    is_verified_seller?: boolean;
    condition?: string;
  };
}

export function AuctionCard({ auction }: AuctionCardProps) {
  const imageUrl = auction.item_image || auction.image_urls?.[0] || '/placeholder-item.jpg';
  const status = auction.auction_status || auction.status;
  const isLive = status === 'live';
  const isEnding = isLive && new Date(auction.end_time).getTime() - Date.now() < 5 * 60 * 1000;

  return (
    <Link href={`/auctions/${auction.id}`}>
      <div className="auction-card glass-card rounded-2xl overflow-hidden cursor-pointer group">
        {/* Image */}
        <div className="relative aspect-[4/3] bg-muted overflow-hidden">
          <img
            src={imageUrl}
            alt={auction.item_title || 'Auction item'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => { e.currentTarget.src = `https://placehold.co/400x300/1a1a2e/7c3aed?text=BidVault`; }}
          />

          {/* Live indicator */}
          {isLive && (
            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-red-500/90 backdrop-blur-sm text-white text-xs font-semibold px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              LIVE
            </div>
          )}

          {/* Ending soon */}
          {isEnding && (
            <div className="absolute top-2 right-2 bg-amber-500/90 backdrop-blur-sm text-black text-xs font-semibold px-2 py-1 rounded-full">
              Ending Soon
            </div>
          )}

          {/* Viewer count */}
          {isLive && (auction.viewer_count ?? 0) > 0 && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
              <Eye className="w-3 h-3" /> {auction.viewer_count}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
              {auction.item_title}
            </h3>
            {auction.category_name && (
              <span className="text-xs text-muted-foreground whitespace-nowrap bg-white/5 px-2 py-0.5 rounded-full">
                {auction.category_name}
              </span>
            )}
          </div>

          {/* Price + bid count */}
          <div className="flex items-center justify-between mt-3">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Current Bid</p>
              <p className="text-xl font-bold text-primary">
                ${Number(auction.current_price).toFixed(2)}
              </p>
            </div>
            {auction.bid_count !== undefined && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingUp className="w-3.5 h-3.5" /> {auction.bid_count} bids
              </div>
            )}
          </div>

          {/* Countdown */}
          {isLive && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <CountdownTimer endTime={auction.end_time} compact />
            </div>
          )}

          {/* Condition */}
          {auction.condition && (
            <div className="mt-2">
              <span className="text-xs capitalize text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">
                {auction.condition.replace('_', ' ')}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
