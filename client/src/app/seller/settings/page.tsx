'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Store, User, FileText, Save, Loader2, CreditCard, ExternalLink } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

export default function SellerSettingsPage() {
  const { user, mutateAuth } = useAuth();
  const searchParams = useSearchParams();
  
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [storefrontName, setStorefrontName] = useState('');
  const [bio, setBio] = useState('');
  
  const [activeTab, setActiveTab] = useState('storefront');
  const [isStripeLoading, setIsStripeLoading] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Handle Stripe OAuth Redirect messages
  useEffect(() => {
    const stripeStatus = searchParams.get('stripe');
    if (stripeStatus === 'success') {
      setActiveTab('payouts');
      setSuccess('Stripe account linked successfully! You can now receive payouts.');
    } else if (stripeStatus === 'error' || stripeStatus === 'api_error' || stripeStatus === 'incomplete') {
      setActiveTab('payouts');
      setError('Stripe onboarding was incomplete or failed. Please try again.');
    }
  }, [searchParams]);

  const handleStripeConnect = async () => {
    setIsStripeLoading(true);
    setError('');
    try {
      const { data } = await api.post('/seller/stripe/account');
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setError('Failed to generate Stripe connection link.');
      setIsStripeLoading(false);
    }
  };

  // Fetch current seller profile data on load
  useEffect(() => {
    async function fetchProfile() {
      try {
        const { data } = await api.get(`/sellers/${user?.sub}`);
        if (data.seller) {
          setStorefrontName(data.seller.storefront_name || '');
          setBio(data.seller.bio || '');
        }
      } catch (err) {
        console.error('Failed to load seller profile details', err);
      } finally {
        setIsLoading(false);
      }
    }
    if (user?.sub) fetchProfile();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      await api.put('/seller/profile', {
        display_name: displayName,
        storefront_name: storefrontName,
        bio: bio,
      });
      
      await mutateAuth(); // Refresh user context if display name changed
      setSuccess('Storefront profile updated successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user || isLoading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold mb-8">Seller Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Nav / Sidebar menu */}
        <div className="space-y-2">
          <button 
            onClick={() => setActiveTab('storefront')}
            className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'storefront' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-white/5 text-muted-foreground'}`}
          >
            <Store className="w-4 h-4" /> Storefront
          </button>
          <button 
            onClick={() => setActiveTab('payouts')}
            className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'payouts' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-white/5 text-muted-foreground'}`}
          >
            <CreditCard className="w-4 h-4" /> Payout Details
          </button>
        </div>

        {/* Form area */}
        <div className="md:col-span-2 space-y-6">
          <div className="glass-card rounded-2xl border border-white/5 p-6 md:p-8">
            
            {activeTab === 'storefront' && (
              <>
                <h2 className="text-xl font-bold mb-2">Public Storefront</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  This information is displayed publicly on your seller profile page (`/sellers/${user.sub}`).
                </p>
                
                <form onSubmit={handleSave} className="space-y-6">
                  {error && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-lg">
                      {success}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-2">Storefront Name</label>
                    <input 
                      type="text" 
                      value={storefrontName}
                      onChange={(e) => setStorefrontName(e.target.value)}
                      placeholder="e.g. Bob's Vintage Vault"
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Store Bio / Description</label>
                    <textarea 
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={4}
                      placeholder="Tell buyers what you sell and your store's history..."
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all resize-none"
                    />
                  </div>

                  <hr className="border-white/5" />

                  <div>
                    <label className="block text-sm font-medium mb-2">Personal Display Name</label>
                    <input 
                      type="text" 
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">This name is used for bidding on other items.</p>
                  </div>

                  <div className="pt-6 flex justify-end">
                    <button 
                      type="submit" 
                      disabled={isSaving}
                      className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-[0_0_20px_rgba(124,58,237,0.3)]"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Storefront
                    </button>
                  </div>
                </form>
              </>
            )}

            {activeTab === 'payouts' && (
              <>
                <h2 className="text-xl font-bold mb-2">Stripe Connect Payouts</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  To receive funds from winning bidders, you must link a bank account. 
                  BidVault securely partners with Stripe to route your payouts directly to your account.
                </p>

                <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                   <div className="w-16 h-16 bg-[#635BFF]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                     <CreditCard className="w-8 h-8 text-[#635BFF]" />
                   </div>
                   
                   <h3 className="text-lg font-bold">Link Your Bank Account</h3>
                   <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                     You will be securely redirected to Stripe to verify your identity and link your account. 
                     You cannot host live auctions until this is complete.
                   </p>

                   <button 
                     onClick={handleStripeConnect}
                     disabled={isStripeLoading}
                     className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-[#635BFF] text-white rounded-xl font-bold hover:bg-[#635BFF]/90 transition-all shadow-[0_0_20px_rgba(99,91,255,0.4)] disabled:opacity-50"
                   >
                     {isStripeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                       <>Connect with Stripe <ExternalLink className="w-4 h-4" /></>
                     )}
                   </button>
                </div>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
