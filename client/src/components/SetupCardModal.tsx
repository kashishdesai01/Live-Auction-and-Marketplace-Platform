'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CreditCard, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

// Make sure to populate the NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in .env.local
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_dummy');

function SetupForm({ onSuccess, onCancel }: { onSuccess: () => void, onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: window.location.href, // If a redirect occurs (like 3D secure), it comes back here
      },
      redirect: 'if_required',
    });

    if (error) {
      setErrorMessage(error.message || 'An unknown error occurred.');
      setIsProcessing(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      
      {errorMessage && (
        <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
          {errorMessage}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="px-4 py-2 text-sm hover:bg-white/5 rounded-xl transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="px-6 py-2 bg-[#635BFF] text-white rounded-xl font-medium hover:bg-[#635BFF]/90 transition-all shadow-[0_0_20px_rgba(99,91,255,0.3)] flex items-center gap-2 disabled:opacity-50"
        >
          {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Card
        </button>
      </div>
    </form>
  );
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clientSecret: string | null;
  onSuccess: () => void;
}

export function SetupCardModal({ isOpen, onClose, clientSecret, onSuccess }: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-md glass-card border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#635BFF]" />
            Secure Payment Method
          </DialogTitle>
          <DialogDescription className="text-muted-foreground mt-2">
            To place live bids, you must add a payment method. 
            Your card will <strong className="text-foreground">only</strong> be charged if you win the auction.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {clientSecret ? (
            <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
              <SetupForm onSuccess={onSuccess} onCancel={onClose} />
            </Elements>
          ) : (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#635BFF]" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
