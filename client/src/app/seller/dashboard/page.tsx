'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import Link from 'next/link';
import { TrendingUp, Package, Gavel, BarChart3, ShoppingBag, Percent } from 'lucide-react';

function MetricCard({ icon: Icon, label, value, delta }: { icon: any; label: string; value: string; delta?: string }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
          <Icon className="w-4.5 h-4.5 text-primary" />
        </div>
        {delta && <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">{delta}</span>}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

export default function SellerDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['seller-dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/seller/dashboard');
      return data.metrics;
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Overview of your store performance</p>
        </div>
        <div className="flex gap-3">
          <Link href="/seller/items/new" className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors">
            + New Listing
          </Link>
          <Link href="/seller/analytics" className="px-4 py-2 glass-card border border-white/10 text-sm font-medium rounded-xl hover:bg-white/5 transition-colors">
            Analytics →
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl p-5 animate-pulse h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <MetricCard icon={TrendingUp} label="Total Revenue" value={`$${Number(data?.total_revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
          <MetricCard icon={ShoppingBag} label="Total Sales" value={String(data?.total_sales || 0)} />
          <MetricCard icon={Gavel} label="Active Auctions" value={String(data?.active_auctions || 0)} />
          <MetricCard icon={Package} label="Draft Items" value={String(data?.draft_items || 0)} />
          <MetricCard icon={Percent} label="Conversion Rate" value={`${data?.conversion_rate || 0}%`} />
          <MetricCard icon={BarChart3} label="Avg Bids / Auction" value={Number(data?.avg_bids_per_auction || 0).toFixed(1)} />
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        {[
          { label: 'Inventory', desc: 'Manage your listings', href: '/seller/items', icon: Package },
          { label: 'Auctions', desc: 'Schedule & manage auctions', href: '/seller/auctions', icon: Gavel },
          { label: 'Orders', desc: 'Fulfill pending orders', href: '/seller/orders', icon: ShoppingBag },
          { label: 'Analytics', desc: 'Revenue & insights', href: '/seller/analytics', icon: BarChart3 },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="glass-card rounded-2xl p-5 hover:bg-white/5 transition-all group border border-white/5 hover:border-primary/20">
            <item.icon className="w-5 h-5 text-primary mb-3" />
            <p className="font-semibold group-hover:text-primary transition-colors">{item.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
