'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { format } from 'date-fns';
import { ShoppingBag, Search, ExternalLink, Filter, Truck, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function SellerOrdersPage() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [shippingModal, setShippingModal] = useState<{ open: boolean; orderId: string | null }>({ open: false, orderId: null });
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingLoading, setShippingLoading] = useState(false);

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['seller-orders'],
    queryFn: async () => {
      const { data } = await api.get('/seller/orders');
      return data.orders;
    },
  });

  const handleShipOrder = async () => {
    if (!trackingNumber.trim() || !shippingModal.orderId) return;
    setShippingLoading(true);
    try {
      await api.patch(`/seller/orders/${shippingModal.orderId}/ship`, { tracking_number: trackingNumber });
      setShippingModal({ open: false, orderId: null });
      setTrackingNumber('');
      refetch();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Failed to update shipping status');
    } finally {
      setShippingLoading(false);
    }
  };

  const filteredOrders = orders.filter((o: any) => {
    if (filter === 'pending' && o.shipping_status !== 'pending') return false;
    if (filter === 'shipped' && o.shipping_status !== 'shipped') return false;
    if (search && !o.item_title.toLowerCase().includes(search.toLowerCase()) && !o.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-primary" />
            Order Fulfillment
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage and ship your sold items</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
            />
          </div>
          
          <div className="glass-card flex items-center p-1 rounded-xl border border-white/10 w-full sm:w-auto">
            {[
              { id: 'all', label: 'All' },
              { id: 'pending', label: 'Pending' },
              { id: 'shipped', label: 'Shipped' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  filter === tab.id ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-white/5 uppercase border-b border-white/5 relative z-10">
              <tr>
                <th className="px-6 py-4 font-medium">Order Details</th>
                <th className="px-6 py-4 font-medium">Buyer</th>
                <th className="px-6 py-4 font-medium">Total</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 relative z-0">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                     <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-3/4"></div></td>
                     <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-1/2"></div></td>
                     <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-16"></div></td>
                     <td className="px-6 py-4"><div className="h-6 bg-white/5 rounded w-20"></div></td>
                     <td className="px-6 py-4 text-right"><div className="h-8 bg-white/5 rounded w-24 ml-auto"></div></td>
                  </tr>
                ))
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <ShoppingBag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p>No orders found for this view.</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order: any) => {
                  const paymentStatus = order.status || order.payment_status;
                  return (
                  <tr key={order.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4 max-w-xs">
                      <div className="flex items-center gap-4">
                        <img 
                          src={order.item_image || 'https://placehold.co/100x100/1a1a2e/7c3aed?text=Item'} 
                          alt="" 
                          className="w-12 h-12 rounded-lg object-cover bg-muted flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {order.item_title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            <span>#{order.id.split('-')[0]}</span>
                            <span>•</span>
                            <span>{format(new Date(order.created_at), 'MMM d, yyyy')}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">{order.buyer_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate">
                        {order.shipping_address?.street ? 
                          `${order.shipping_address.street}, ${order.shipping_address.city}` : 
                          'No address provided'}
                      </p>
                    </td>

                    <td className="px-6 py-4 font-semibold text-foreground">
                      ${Number(order.amount).toFixed(2)}
                    </td>

                    <td className="px-6 py-4">
                      <div className="mb-1">
                        {paymentStatus === 'paid' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Payment Confirmed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Awaiting Payment
                          </span>
                        )}
                      </div>
                      {order.shipping_status === 'pending' ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Truck className="w-3.5 h-3.5" /> Needs Shipping
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Shipped
                        </div>
                      )}
                      
                      {order.tracking_number && (
                        <p className="text-[10px] text-muted-foreground mt-1.5 font-mono">
                          {order.tracking_number}
                        </p>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      {paymentStatus !== 'paid' ? (
                        <button
                          disabled
                          className="px-4 py-2 glass-card text-xs font-medium rounded-lg inline-block whitespace-nowrap opacity-50 cursor-not-allowed"
                        >
                          Awaiting Payment
                        </button>
                      ) : order.shipping_status === 'pending' ? (
                        <button 
                          onClick={() => setShippingModal({ open: true, orderId: order.id })}
                          className="px-4 py-2 bg-primary/20 text-primary hover:bg-primary hover:text-primary-foreground text-xs font-medium rounded-lg transition-colors inline-block whitespace-nowrap"
                        >
                          Mark Shipped
                        </button>
                      ) : (
                        <button className="px-4 py-2 glass-card hover:bg-white/10 text-xs font-medium rounded-lg transition-colors inline-block whitespace-nowrap">
                          Edit Tracking
                        </button>
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shipping Modal */}
      <Dialog open={shippingModal.open} onOpenChange={(open: boolean) => !open && setShippingModal({ open: false, orderId: null })}>
        <DialogContent className="sm:max-w-md glass-card border-white/10">
          <DialogHeader>
            <DialogTitle>Mark Order as Shipped</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="block text-sm font-medium mb-2">Tracking Number</label>
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
              placeholder="e.g. 1Z9999999999999999"
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-2">
              This will notify the buyer that their item is on the way.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => setShippingModal({ open: false, orderId: null })}
              className="px-4 py-2 text-sm font-medium hover:bg-white/5 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleShipOrder}
              disabled={!trackingNumber.trim() || shippingLoading}
              className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {shippingLoading ? 'Saving...' : 'Confirm Shipment'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
