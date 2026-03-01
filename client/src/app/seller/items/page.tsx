'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import Link from 'next/link';
import { Package, Plus, MoreVertical, Edit2, Trash2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { ScheduleAuctionModal } from '@/components/ScheduleAuctionModal';

export default function SellerInventoryPage() {
  const router = useRouter();
  const [scheduleItem, setScheduleItem] = useState<{ id: string; title: string; starting_price: number } | null>(null);

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ['seller-items'],
    queryFn: async () => {
      const { data } = await api.get('/seller/items');
      return data.items;
    },
  });

  const handleDelete = async (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      try {
        await api.delete(`/seller/items/${id}`);
        refetch();
      } catch (err) {
        alert('Failed to delete item.');
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            Inventory
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your item listings and drafts</p>
        </div>
        <Link 
          href="/seller/items/new" 
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Listing
        </Link>
      </div>

      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-white/5 uppercase">
              <tr>
                <th className="px-6 py-4 font-medium">Item</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Starting Price</th>
                <th className="px-6 py-4 font-medium text-right">Created</th>
                <th className="px-6 py-4 font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-3/4"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-16"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 bg-white/5 rounded w-12 ml-auto"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 bg-white/5 rounded w-20 ml-auto"></div></td>
                    <td className="px-6 py-4 text-center"><div className="h-6 w-6 bg-white/5 rounded mx-auto"></div></td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p>No items found.</p>
                    <Link href="/seller/items/new" className="text-primary mt-2 inline-block hover:underline">
                      Create your first listing
                    </Link>
                  </td>
                </tr>
              ) : (
                items.map((item: any) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                          <img 
                            src={item.image_urls?.[0] || 'https://placehold.co/100x100/1a1a2e/7c3aed?text=Item'} 
                            alt="" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                            {item.title}
                          </p>
                          <p className="text-xs text-muted-foreground">{item.category?.name || 'Uncategorized'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        item.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        item.status === 'draft' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-white/5 text-muted-foreground border border-white/10'
                      }`}>
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-foreground">
                      ${Number(item.starting_price).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right text-muted-foreground">
                      {format(new Date(item.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="p-2 hover:bg-white/10 rounded-lg transition-colors focus:outline-none">
                          <MoreVertical className="w-4 h-4 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 border-white/10 glass-card">
                          <DropdownMenuItem onClick={() => router.push(`/seller/items/${item.id}/edit`)} className="cursor-pointer gap-2 focus:bg-white/10">
                            <Edit2 className="w-4 h-4" /> Edit Details
                          </DropdownMenuItem>
                          {item.status !== 'sold' && (
                            <DropdownMenuItem onClick={() => setScheduleItem({ id: item.id, title: item.title, starting_price: item.starting_price })} className="cursor-pointer gap-2 focus:bg-primary/20 focus:text-primary text-primary">
                              <Calendar className="w-4 h-4" /> Schedule Auction
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleDelete(item.id, item.title)} className="cursor-pointer gap-2 text-destructive focus:bg-destructive/20 focus:text-destructive">
                            <Trash2 className="w-4 h-4" /> Delete Item
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ScheduleAuctionModal item={scheduleItem} onClose={() => setScheduleItem(null)} />
    </div>
  );
}
