import { notFound } from 'next/navigation';
import api from '@/lib/api';
import { LiveBidPanel } from '@/components/LiveBidPanel';
import { CountdownTimer } from '@/components/CountdownTimer';
import { format } from 'date-fns';
import { Shield, ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

interface Props {
  params: Promise<{ id: string }>;
}

async function getAuction(id: string) {
  try {
    const { data } = await api.get(`/auctions/${id}`);
    return data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await getAuction(id);
  if (!data) return { title: 'Auction Not Found' };
  return {
    title: data.auction.item_title,
    description: data.auction.description?.slice(0, 150),
    openGraph: {
      type: 'website',
      images: data.auction.image_urls?.[0] ? [{ url: data.auction.image_urls[0] }] : [],
    },
  };
}

export default async function AuctionDetailPage({ params }: Props) {
  const { id } = await params;
  const data = await getAuction(id);
  if (!data) notFound();

  const { auction, bids } = data;
  const isLive = auction.status === 'live';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Left: Images + details */}
        <div>
          {/* Image gallery */}
          <div className="rounded-2xl overflow-hidden aspect-[4/3] bg-muted mb-4">
            <img
              src={auction.image_urls?.[0] || `https://placehold.co/800x600/1a1a2e/7c3aed?text=${encodeURIComponent(auction.item_title)}`}
              alt={auction.item_title}
              className="w-full h-full object-cover"
            />
          </div>
          {auction.image_urls?.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {auction.image_urls.slice(1).map((url: string, i: number) => (
                <img key={i} src={url} alt="" className="w-20 h-16 rounded-lg object-cover flex-shrink-0 cursor-pointer opacity-70 hover:opacity-100 transition-all" />
              ))}
            </div>
          )}

          {/* Item info */}
          <div className="mt-6 space-y-4">
            <div>
              <div className="flex items-start gap-3 mb-2">
                <h1 className="text-2xl font-bold flex-1">{auction.item_title}</h1>
                {auction.condition && (
                  <span className="text-xs capitalize bg-white/5 border border-white/10 rounded-full px-2.5 py-1 flex-shrink-0">
                    {auction.condition.replace('_', ' ')}
                  </span>
                )}
              </div>
              {auction.category_name && (
                <span className="text-sm text-muted-foreground">{auction.category_name}</span>
              )}
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">{auction.description}</p>

            {/* Seller card */}
            <div className="glass-card rounded-xl p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center font-bold text-primary text-lg">
                  {auction.seller_name?.[0]}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-base">{auction.storefront_name || auction.seller_name}</p>
                    {auction.is_verified_seller && <Shield className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span>⭐ {Number(auction.seller_rating || 0).toFixed(1)} rating</span>
                  </div>
                </div>
              </div>
              <Link 
                href={`/sellers/${auction.seller_id}`}
                className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
              >
                View Storefront <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Auction info */}
            <div className="glass-card rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Auction ID</span><span className="font-mono text-xs">{auction.id.slice(0, 8)}…</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Started</span><span>{format(new Date(auction.start_time || Date.now()), 'MMM d, h:mm a')}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Ends</span><span>{format(new Date(auction.end_time), 'MMM d, h:mm a')}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Bid Increment</span><span className="font-medium">${Number(auction.bid_increment).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Bids</span><span className="font-medium">{auction.bid_count}</span></div>
            </div>
          </div>
        </div>

        {/* Right: Bid panel */}
        <div className="lg:sticky lg:top-24 self-start">
          <LiveBidPanel
            auctionId={auction.id}
            initialPrice={parseFloat(auction.current_price)}
            endTime={auction.end_time}
            bidIncrement={parseFloat(auction.bid_increment)}
            sellerId={auction.seller_id}
            status={auction.status}
          />

          {/* Bid history table (server-rendered) */}
          {bids.length > 0 && (
            <div className="mt-4 glass-card rounded-2xl overflow-hidden border border-white/5">
              <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02]">
                <h3 className="text-sm font-semibold flex items-center justify-between">
                  <span>Bid History</span>
                  <span className="text-xs font-normal text-muted-foreground">{bids.length} bids total</span>
                </h3>
              </div>
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground bg-white/[0.02] sticky top-0 backdrop-blur-md">
                    <tr>
                      <th className="px-5 py-2.5 font-medium text-left">Bidder</th>
                      <th className="px-5 py-2.5 font-medium text-right">Amount</th>
                      <th className="px-5 py-2.5 font-medium text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {bids.map((bid: any, index: number) => (
                      <tr key={bid.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3">
                          <span className="flex items-center gap-2">
                            {index === 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Winning Bid" />}
                            {bid.bidder_name}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-medium text-primary">
                          ${Number(bid.amount).toFixed(2)}
                        </td>
                        <td className="px-5 py-3 text-right text-muted-foreground text-xs whitespace-nowrap">
                          {format(new Date(bid.placed_at), 'MMM d, h:mm:ss a')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
