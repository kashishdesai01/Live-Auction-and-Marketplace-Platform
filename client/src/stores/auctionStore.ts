import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '@/lib/api';

interface Bid {
  bidder_name: string;
  amount: number;
  timestamp: string;
}

interface AuctionState {
  socket: Socket | null;
  auctionId: string | null;
  currentPrice: number;
  timeRemaining: number;
  bids: Bid[];
  viewerCount: number;
  isConnected: boolean;
  lastRejectReason: string | null;
  isAuctionEnded: boolean;
  winner: { winner_id: string; final_price: number; item_title: string } | null;

  connect: (auctionId: string, initialPrice: number, endTime: string) => void;
  disconnect: () => void;
  placeBid: (amount: number) => void;
  clearRejectReason: () => void;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5001';

export const useAuctionStore = create<AuctionState>((set, get) => ({
  socket: null,
  auctionId: null,
  currentPrice: 0,
  timeRemaining: 0,
  bids: [],
  viewerCount: 0,
  isConnected: false,
  lastRejectReason: null,
  isAuctionEnded: false,
  winner: null,

  connect: (auctionId, initialPrice, endTime) => {
    const existing = get().socket;
    if (existing) existing.disconnect();

    set({ currentPrice: initialPrice, timeRemaining: new Date(endTime).getTime() - Date.now(), bids: [], isAuctionEnded: false, winner: null });

    const socket = io(WS_URL, {
      auth: { token: getAccessToken() },
      transports: ['websocket', 'polling'], // Fallback to polling allowed
    });

    socket.on('connect', () => {
      set({ isConnected: true });
      socket.emit('join_auction', auctionId); // Match the backend: just sends the raw ID string
    });

    socket.on('disconnect', () => set({ isConnected: false }));

    // Listen to our backend broadcast when anyone places a successful bid
    socket.on('bid_placed', ({ newPrice, bid }) => {
      set(state => ({
        currentPrice: newPrice,
        bids: [{ bidder_name: bid.bidder_name, amount: bid.amount, timestamp: bid.placed_at }, ...state.bids].slice(0, 50),
      }));
    });

    socket.on('auction_ended', (data) => {
      set({ isAuctionEnded: true, winner: data });
    });

    set({ socket, auctionId });
  },

  disconnect: () => {
    const { socket, auctionId } = get();
    if (socket && auctionId) {
      socket.emit('leave_auction', auctionId);
      socket.disconnect();
    }
    set({ socket: null, auctionId: null, isConnected: false });
  },

  placeBid: async (amount) => {
    const { auctionId } = get();
    if (!auctionId) return;
    
    set({ lastRejectReason: null });

    try {
        const token = getAccessToken();
        const res = await fetch(`http://localhost:5001/api/auctions/${auctionId}/bid`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ amount, idempotency_key: crypto.randomUUID() })
        });
        
        const data = await res.json();
        if (!res.ok) {
            set({ lastRejectReason: data.error?.reason || data.error?.message || 'Bid rejected' });
        }
    } catch (err) {
        set({ lastRejectReason: 'Network error placing bid' });
    }
  },

  clearRejectReason: () => set({ lastRejectReason: null }),
}));
