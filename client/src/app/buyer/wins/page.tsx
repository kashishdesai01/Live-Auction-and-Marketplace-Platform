'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import Link from 'next/link';
import { Trophy, Truck, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';
import { format } from 'date-fns';
import type { AxiosError } from 'axios';
import { useAuth } from '@/contexts/AuthContext';

type PaymentMode = 'sandbox' | 'demo';
type SandboxScenario = 'success' | 'decline' | 'auth';
type PaymentStatus = 'pending' | 'paid' | 'failed' | string;

type WinOrder = {
  id: string;
  amount: number | string;
  created_at: string;
  item_title: string;
  item_image?: string | null;
  seller_name?: string | null;
  shipping_status?: string | null;
  tracking_number?: string | null;
  status?: PaymentStatus;
  payment_status?: PaymentStatus;
};

type PayMutationInput = {
  orderId: string;
  mode: PaymentMode;
  scenario: SandboxScenario;
};

type PayResponse = {
  mode?: string;
  paid?: boolean;
  webhook_expected?: boolean;
  error?: {
    message?: string;
  };
};

type ApiErrorPayload = {
  error?: {
    message?: string;
  };
};

export default function BuyerWinsPage() {
  const { user, isAuthenticated } = useAuth();
  const [payMessage, setPayMessage] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('sandbox');
  const [sandboxScenario, setSandboxScenario] = useState<SandboxScenario>('success');
  const { data: wins = [], isLoading, refetch, isError, error } = useQuery<WinOrder[], AxiosError<ApiErrorPayload>>({
    queryKey: ['buyer-wins', user?.id],
    queryFn: async () => {
      const { data } = await api.get('/buyer/wins');
      return data.wins || data.orders || [];
    },
    enabled: isAuthenticated,
    refetchInterval: 4000,
  });

  const payOrder = useMutation<PayResponse, AxiosError<ApiErrorPayload>, PayMutationInput>({
    mutationFn: async ({ orderId, mode, scenario }) => {
      const params: Record<string, string> = { mode };
      if (mode === 'sandbox') params.scenario = scenario;
      const { data } = await api.post(`/buyer/orders/${orderId}/pay`, null, { params });
      return data;
    },
    onSuccess: (data, variables) => {
      if (data?.error?.message) {
        setPayMessage(data.error.message);
      } else if (variables.mode === 'demo') {
        setPayMessage('Payment completed in demo mode.');
      } else if (data?.webhook_expected) {
        setPayMessage('Payment initiated in Stripe sandbox. Status will update via webhook shortly.');
      } else if (data?.paid) {
        setPayMessage('Sandbox payment completed.');
      } else {
        setPayMessage('Payment initiated.');
      }
      refetch();
    },
    onError: (err) => {
      setPayMessage(err?.response?.data?.error?.message || 'Payment failed. Please try again.');
      refetch();
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
            <Trophy className="w-6 h-6 text-primary" />
            Won Auctions & Purchases
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Review your successful bids and track shipments</p>
        </div>
      </div>

      {payMessage && (
        <div className="mb-4 p-3 rounded-lg text-sm bg-white/5 border border-white/10">
          {payMessage}
        </div>
      )}

      <div className="mb-4 p-3 rounded-lg border border-white/10 bg-white/5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="text-xs text-muted-foreground min-w-fit">Payment test mode</div>
        <select
          value={paymentMode}
          onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
          className="px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-sm"
        >
          <option value="sandbox">Stripe Sandbox</option>
          <option value="demo">Local Demo</option>
        </select>
        {paymentMode === 'sandbox' && (
          <select
            value={sandboxScenario}
            onChange={(e) => setSandboxScenario(e.target.value as SandboxScenario)}
            className="px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-sm"
          >
            <option value="success">Success</option>
            <option value="decline">Declined Card</option>
            <option value="auth">3DS/Auth Required</option>
          </select>
        )}
      </div>

      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-white/5 uppercase">
              <tr>
                <th className="px-6 py-4 font-medium">Item Won</th>
                <th className="px-6 py-4 font-medium">Seller Info</th>
                <th className="px-6 py-4 font-medium">Price Paid</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                     <td className="px-6 py-4"><div className="h-10 bg-white/5 rounded w-3/4"></div></td>
                     <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-1/2"></div></td>
                     <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-16"></div></td>
                     <td className="px-6 py-4"><div className="h-6 bg-white/5 rounded w-20"></div></td>
                     <td className="px-6 py-4 text-right"><div className="h-8 bg-white/5 rounded w-24 ml-auto"></div></td>
                  </tr>
                ))
              ) : !isAuthenticated ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <p>Please log in as a buyer to view wins.</p>
                    <Link href="/login" className="text-primary mt-2 inline-block hover:underline">
                      Go to Login
                    </Link>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-amber-300">
                    <p className="font-medium">Could not load wins.</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {error?.response?.data?.error?.message || 'Request failed. Please refresh and try again.'}
                    </p>
                  </td>
                </tr>
              ) : wins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p>No won auctions yet.</p>
                    <Link href="/feed" className="text-primary mt-2 inline-block hover:underline">
                      Go win your first auction
                    </Link>
                  </td>
                </tr>
              ) : (
                wins.map((order) => {
                  const paymentStatus = order.status || order.payment_status;
                  return (
                  <tr key={order.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4 max-w-sm">
                        <img 
                          src={order.item_image || 'https://placehold.co/100x100/1a1a2e/7c3aed?text=Item'} 
                          alt="" 
                          className="w-12 h-12 rounded-lg object-cover bg-muted flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                            {order.item_title}
                          </p>
                          <div className="text-xs text-muted-foreground mt-1">
                            {format(new Date(order.created_at), 'MMM d, yyyy')}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center font-bold text-[10px] text-muted-foreground">
                          {order.seller_name?.charAt(0) || '?'}
                        </div>
                        <span className="font-medium">{order.seller_name}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <p className="font-bold text-foreground text-lg">${Number(order.amount).toFixed(2)}</p>
                      
                      {paymentStatus === 'paid' && (
                        <div className="flex items-center gap-1 text-[10px] text-emerald-400 mt-0.5">
                          <ShieldCheck className="w-3 h-3" /> Payment Confirmed
                        </div>
                      )}
                      {paymentStatus === 'failed' && (
                        <div className="flex items-center gap-1 text-[10px] text-destructive mt-0.5">
                          <ShieldAlert className="w-3 h-3" /> Payment Failed
                        </div>
                      )}
                      {paymentStatus === 'pending' && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-500 mt-0.5">
                          <Clock className="w-3 h-3" /> Payment Required
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {order.shipping_status === 'shipped' ? (
                        <div>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Truck className="w-3.5 h-3.5" /> Shipped
                          </span>
                          {order.tracking_number && (
                            <p className="text-[10px] text-muted-foreground mt-1 tracking-wide font-mono">
                              TRK: {order.tracking_number}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-muted-foreground border border-white/10">
                          Processing
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      {paymentStatus === 'paid' ? (
                        <button className="px-4 py-2 glass-card text-xs font-medium rounded-lg inline-flex items-center gap-2 whitespace-nowrap opacity-70 cursor-default">
                          Paid
                        </button>
                      ) : (
                        <button
                          onClick={() => payOrder.mutate({ orderId: order.id, mode: paymentMode, scenario: sandboxScenario })}
                          disabled={payOrder.isPending && payOrder.variables?.orderId === order.id}
                          className="px-4 py-2 bg-primary/20 text-primary hover:bg-primary hover:text-primary-foreground text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                        >
                          {payOrder.isPending && payOrder.variables?.orderId === order.id ? 'Processing...' : 'Pay Now'}
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
    </div>
  );
}
