import Link from 'next/link';
import api from '@/lib/api';
import { AuctionCard } from '@/components/AuctionCard';
import { TrendingUp, Zap, Shield, ArrowRight, Users, Star } from 'lucide-react';

async function getTrendingAuctions() {
  try {
    const { data } = await api.get('/feed?page=1');
    return data.feed?.slice(0, 8) || [];
  } catch {
    return [];
  }
}

async function getFeaturedSellers() {
  try {
    const { data } = await api.get('/sellers');
    return data.sellers?.slice(0, 4) || [];
  } catch {
    return [];
  }
}

const CATEGORIES = [
  { name: 'Trading Cards', slug: 'trading-cards', icon: '🃏', color: 'from-violet-500/20 to-purple-500/5' },
  { name: 'Collectibles', slug: 'collectibles', icon: '🏺', color: 'from-amber-500/20 to-orange-500/5' },
  { name: 'Electronics', slug: 'electronics', icon: '💻', color: 'from-blue-500/20 to-cyan-500/5' },
  { name: 'Fashion', slug: 'fashion', icon: '👟', color: 'from-pink-500/20 to-rose-500/5' },
  { name: 'Art & Decor', slug: 'art-decor', icon: '🎨', color: 'from-emerald-500/20 to-teal-500/5' },
  { name: 'Books & Media', slug: 'books-media', icon: '📚', color: 'from-indigo-500/20 to-blue-500/5' },
  { name: 'Sports', slug: 'sports-outdoors', icon: '⚽', color: 'from-green-500/20 to-emerald-500/5' },
  { name: 'Jewelry & Watches', slug: 'jewelry-watches', icon: '💎', color: 'from-cyan-500/20 to-sky-500/5' },
];

export default async function HomePage() {
  const [auctions, sellers] = await Promise.all([getTrendingAuctions(), getFeaturedSellers()]);
  const liveCount = auctions.filter((a: any) => a.status === 'live').length;

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/12 rounded-full blur-[120px]" />
          <div className="absolute top-10 right-1/4 w-80 h-80 bg-accent/8 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-1/2 w-96 h-64 bg-primary/8 rounded-full blur-[80px] translate-x-[-50%]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center relative">
          {/* Live badge */}
          {liveCount > 0 && (
            <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-4 py-1.5 text-sm text-red-400 mb-6 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              {liveCount} Live Auction{liveCount > 1 ? 's' : ''} Happening Now
            </div>
          )}
          {liveCount === 0 && (
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-sm text-primary mb-6">
              <Zap className="w-3.5 h-3.5" /> Real-Time Live Auctions
            </div>
          )}

          <h1 className="text-5xl sm:text-7xl font-black tracking-tight mb-6 leading-tight">
            Bid. Win.
            <br />
            <span className="gradient-text">Own the Rare.</span>
          </h1>
          <p className="text-muted-foreground text-xl max-w-2xl mx-auto mb-10">
            Live auctions for rare collectibles, electronics, fashion, and more.
            Compete in real-time and win the items you love.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/browse"
              className="w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all inline-flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(124,58,237,0.35)] hover:shadow-[0_0_40px_rgba(124,58,237,0.5)]"
            >
              Browse Auctions <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/register"
              className="w-full sm:w-auto text-center px-8 py-4 glass-card border border-white/10 font-semibold rounded-xl hover:bg-white/5 transition-all"
            >
              Start Selling
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-sm mx-auto mt-16 pt-10 border-t border-white/5">
            {[
              { label: 'Live Auctions', value: '1,200+' },
              { label: 'Categories', value: '8' },
              { label: 'Happy Buyers', value: '50K+' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl font-bold gradient-text">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Category Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Browse by Category</h2>
          <Link href="/browse" className="text-sm text-primary hover:underline flex items-center gap-1">
            All categories <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/browse?category=${cat.slug}`}
              className={`bg-gradient-to-br ${cat.color} rounded-2xl p-4 text-center hover:scale-105 border border-white/5 hover:border-white/15 transition-all group`}
            >
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">{cat.icon}</div>
              <p className="text-xs font-medium group-hover:text-primary transition-colors leading-tight">{cat.name}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Trending Auctions */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="text-2xl font-bold">Trending Now</h2>
          </div>
          <Link href="/browse" className="text-sm text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {auctions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {auctions.map((auction: any) => (
              <AuctionCard key={auction.id} auction={auction} />
            ))}
          </div>
        ) : (
          <div className="glass-card rounded-2xl border border-white/5 py-16 text-center text-muted-foreground">
            <p className="text-lg">No auctions live yet — be the first!</p>
            <Link href="/register" className="text-primary mt-2 inline-block hover:underline">
              Start selling →
            </Link>
          </div>
        )}
      </section>

      {/* Featured Sellers */}
      {sellers.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-bold">Top Sellers</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {sellers.map((seller: any) => (
              <Link
                key={seller.id}
                href={`/sellers/${seller.id}`}
                className="glass-card rounded-2xl border border-white/5 p-5 flex items-center gap-4 hover:border-white/15 hover:bg-white/5 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center text-xl font-bold text-primary flex-shrink-0">
                  {seller.display_name?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                    {seller.storefront_name || seller.display_name}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span>{Number(seller.avg_rating || 0).toFixed(1)}</span>
                    <span>·</span>
                    <span>{seller.total_sales || 0} sales</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="border-t border-white/5 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-3">How BidVault Works</h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-12">Real-time auctions, verifiable bids, and secure checkout.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: '1', title: 'Browse & Discover', desc: 'Explore live auctions filtered by category, price, and condition.' },
              { icon: '2', title: 'Bid in Real Time', desc: "Place bids and see updates instantly. Get notified the moment you're outbid." },
              { icon: '3', title: 'Win & Checkout', desc: 'Win the auction, complete checkout, and get your item delivered.' },
            ].map((step) => (
              <div key={step.icon} className="glass-card rounded-2xl p-8 text-left border border-white/5 hover:border-white/10 transition-colors group">
                <div className="w-10 h-10 bg-primary/20 text-primary font-bold text-lg rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/30 transition-colors">
                  {step.icon}
                </div>
                <h3 className="font-bold text-lg mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="glass-card rounded-3xl border border-primary/20 p-10 text-center relative overflow-hidden bg-gradient-to-br from-primary/10 via-transparent to-accent/5">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <Shield className="w-10 h-10 text-primary mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-3">Ready to start selling?</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            List your items for free, run live auctions, and reach thousands of passionate buyers.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-[0_0_30px_rgba(124,58,237,0.4)]"
          >
            Create Seller Account <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
