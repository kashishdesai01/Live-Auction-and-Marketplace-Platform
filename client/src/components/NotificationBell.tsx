'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ['notifications', 'preview'],
    queryFn: async () => {
      const { data } = await api.get('/buyer/notifications?page=1');
      return data;
    },
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  if (!isAuthenticated) return null;

  const unread = data?.unread_count || 0;
  const notifications = data?.notifications?.slice(0, 5) || [];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-primary text-[10px] font-bold text-primary-foreground rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 glass-card rounded-xl border border-white/10 shadow-2xl animate-slide-up z-50">
          <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unread > 0 && (
              <span className="text-xs text-primary">{unread} unread</span>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-6">No notifications</p>
          ) : (
            <div>
              {notifications.map((n: any) => (
                <div key={n.id} className={`px-4 py-3 border-b border-white/5 text-sm ${!n.is_read ? 'bg-primary/5' : ''}`}>
                  <p className="font-medium">
                    {n.type === 'outbid' && '⚡ You\'ve been outbid!'}
                    {n.type === 'won' && '🏆 You won the auction!'}
                    {n.type === 'auction_ending' && '⏰ Auction ending soon'}
                    {n.type === 'order_update' && '📦 Order update'}
                  </p>
                  <p className="text-muted-foreground text-xs mt-0.5">{n.payload?.item_title || n.payload?.message}</p>
                </div>
              ))}
              <Link
                href="/buyer/notifications"
                className="block text-center py-3 text-sm text-primary hover:bg-white/5 transition-colors"
                onClick={() => setOpen(false)}
              >
                View all notifications →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
