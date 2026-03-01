'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Bell, Trophy, AlertTriangle, Package, Check, Tag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function BuyerNotificationsPage() {
  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ['buyer-notifications'],
    queryFn: async () => {
      const { data } = await api.get('/buyer/notifications');
      return data.notifications;
    },
  });

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/buyer/notifications/${id}/read`);
      refetch();
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      // Find all unread
      const unreadIds = notifications.filter((n: any) => !n.is_read).map((n: any) => n.id);
      await Promise.all(unreadIds.map((id: string) => api.patch(`/buyer/notifications/${id}/read`)));
      refetch();
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'outbid': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'won': return <Trophy className="w-5 h-5 text-emerald-500" />;
      case 'order_update': return <Package className="w-5 h-5 text-blue-500" />;
      case 'auction_ending': return <Bell className="w-5 h-5 text-red-500" />;
      default: return <Tag className="w-5 h-5 text-primary" />;
    }
  };

  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" />
            Notifications
            {unreadCount > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full ml-2">
                {unreadCount} New
              </span>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Stay updated on your bids and orders</p>
        </div>
        
        {unreadCount > 0 && (
          <button 
            onClick={markAllAsRead}
            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
          >
            <Check className="w-4 h-4" /> Mark all as read
          </button>
        )}
      </div>

      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-white/5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 flex gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-white/5"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/5 rounded w-1/3"></div>
                  <div className="h-3 bg-white/5 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-foreground">You're all caught up!</h2>
            <p className="text-muted-foreground text-sm max-w-sm">
              When you bid on items or save them to your watchlist, we'll notify you here about important updates.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {notifications.map((notification: any) => (
              <div 
                key={notification.id} 
                className={`p-5 flex gap-4 transition-colors hover:bg-white/5 ${
                  !notification.is_read ? 'bg-primary/5 relative' : ''
                }`}
              >
                {!notification.is_read && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary border-r border-primary/20 shadow-[0_0_10px_rgba(124,58,237,0.5)]"></div>
                )}
                
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                  !notification.is_read ? 'bg-white/10' : 'bg-white/5'
                }`}>
                  {getIcon(notification.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <p className={`font-medium ${!notification.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {notification.payload?.message || 'New notification'}
                    </p>
                    <span className="text-xs whitespace-nowrap text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  
                  {notification.payload?.auction_title && (
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      Item: <span className="font-medium text-foreground/80">{notification.payload.auction_title}</span>
                    </p>
                  )}
                  {notification.type === 'outbid' && (
                    <p className="text-xs text-amber-500 font-medium mt-2">
                      New highest bid: ${notification.payload?.new_price || '---'}
                    </p>
                  )}
                </div>

                {!notification.is_read && (
                  <button 
                    onClick={() => markAsRead(notification.id)}
                    className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors focus:outline-none"
                    title="Mark as read"
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
