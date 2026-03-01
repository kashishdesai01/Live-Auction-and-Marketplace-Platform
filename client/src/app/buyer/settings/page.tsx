'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { User, Bell, Shield, Save, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function BuyerSettingsPage() {
  const { user, mutateAuth } = useAuth();
  const router = useRouter();
  
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true); // Mocked for now
  
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      await api.put('/buyer/profile', {
        display_name: displayName,
        notifications_enabled: notificationsEnabled,
      });
      
      await mutateAuth(); // Refresh user context
      setSuccess('Profile updated successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold mb-8">Account Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Nav / Sidebar menu */}
        <div className="space-y-2">
          <button className="w-full text-left px-4 py-2.5 rounded-lg bg-primary/10 text-primary font-medium flex items-center gap-3">
            <User className="w-4 h-4" /> Profile
          </button>
          <button className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-white/5 text-muted-foreground transition-colors flex items-center gap-3">
            <Bell className="w-4 h-4" /> Notifications
          </button>
          <button className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-white/5 text-muted-foreground transition-colors flex items-center gap-3">
            <Shield className="w-4 h-4" /> Security
          </button>
        </div>

        {/* Form area */}
        <div className="md:col-span-2 space-y-6">
          <div className="glass-card rounded-2xl border border-white/5 p-6 md:p-8">
            <h2 className="text-xl font-bold mb-6">Public Profile</h2>
            
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
                <label className="block text-sm font-medium mb-2">Email Address</label>
                <input 
                  type="email" 
                  value={user.email} 
                  disabled 
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-muted-foreground cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground mt-1.5">Your email address cannot be changed.</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Display Name</label>
                <input 
                  type="text" 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                  required
                />
              </div>

              <div className="pt-4 border-t border-white/5">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={notificationsEnabled}
                    onChange={(e) => setNotificationsEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary"
                  />
                  <div>
                    <p className="text-sm font-medium">Email Notifications</p>
                    <p className="text-xs text-muted-foreground">Receive alerts when you are outbid or an auction ends.</p>
                  </div>
                </label>
              </div>

              <div className="pt-6 flex justify-end">
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
