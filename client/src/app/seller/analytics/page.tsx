'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { BarChart3, TrendingUp, Filter, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function SellerAnalyticsPage() {
  const [dateRange, setDateRange] = useState('30d');

  const { data, isLoading } = useQuery({
    queryKey: ['seller-analytics', dateRange],
    queryFn: async () => {
      const { data } = await api.get(`/seller/analytics?range=${dateRange}`);
      return data;
    },
  });

  const chartData = data?.revenue_over_time || [];
  const categoryData = data?.top_categories || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Analytics
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Deep dive into your sales and performance</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="glass-card flex items-center p-1 rounded-lg border border-white/10">
            {['7d', '30d', '90d'].map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  dateRange === range ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          <button className="px-4 py-2 glass-card border border-white/10 text-sm font-medium rounded-xl hover:bg-white/5 transition-colors flex items-center gap-2 hidden sm:flex">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="glass-card rounded-2xl border border-white/5 p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-400" /> Revenue Over Time</h2>
              <p className="text-3xl font-bold mt-2">${Number(data?.total_revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground mt-1">Total in selected period</p>
            </div>
          </div>
          
          <div className="h-72 w-full mt-4">
            {isLoading ? (
              <div className="w-full h-full animate-pulse bg-white/5 rounded-xl"></div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="date" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #ffffff20', borderRadius: '12px' }}
                    itemStyle={{ color: '#7c3aed', fontWeight: 'bold' }}
                    formatter={(value: any) => [`$${value}`, 'Revenue']}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={3} dot={{ r: 4, fill: '#1a1a2e', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#7c3aed' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm border-2 border-dashed border-white/5 rounded-xl">
                No revenue data for this period
              </div>
            )}
          </div>
        </div>

        {/* Top Categories */}
        <div className="glass-card rounded-2xl border border-white/5 p-6 lg:col-span-1">
          <h2 className="font-semibold mb-6 flex items-center gap-2"><Filter className="w-4 h-4 text-primary" /> Top Categories</h2>
          <div className="h-64 w-full">
            {isLoading ? (
              <div className="w-full h-full animate-pulse bg-white/5 rounded-xl"></div>
            ) : categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={true} vertical={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="category" type="category" stroke="#ffffff80" fontSize={12} tickLine={false} axisLine={false} width={80} />
                  <Tooltip 
                    cursor={{ fill: '#ffffff05' }}
                    contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #ffffff20', borderRadius: '12px' }}
                    formatter={(value: any) => [`$${value}`, 'Sales']}
                  />
                  <Bar dataKey="revenue" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm border-2 border-dashed border-white/5 rounded-xl">
                No category data
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
          <div className="glass-card p-5 rounded-xl border border-white/5">
            <p className="text-xs text-muted-foreground mb-1">Items Sold</p>
            <p className="text-2xl font-bold">{data?.total_items_sold || 0}</p>
          </div>
          <div className="glass-card p-5 rounded-xl border border-white/5">
            <p className="text-xs text-muted-foreground mb-1">Average Sale Price</p>
            <p className="text-2xl font-bold">${Number(data?.avg_sale_price || 0).toFixed(2)}</p>
          </div>
          <div className="glass-card p-5 rounded-xl border border-white/5">
            <p className="text-xs text-muted-foreground mb-1">Total Bids Received</p>
            <p className="text-2xl font-bold">{data?.total_bids || 0}</p>
          </div>
          <div className="glass-card p-5 rounded-xl border border-white/5">
            <p className="text-xs text-muted-foreground mb-1">Sell-Through Rate</p>
            <p className="text-2xl font-bold">{data?.sell_through_rate || 0}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
