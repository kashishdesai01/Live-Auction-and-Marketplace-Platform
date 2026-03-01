'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationBell } from './NotificationBell';
import { useState } from 'react';
import { Menu, X, Gavel, LogOut, Settings, Search } from 'lucide-react';

export function Navbar() {
  const { user, isAuthenticated, logout, switchRole } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const isBuyer = user?.active_role === 'buyer';
  const isSeller = user?.active_role === 'seller';
  const canSwitch = user?.roles.includes('buyer') && user?.roles.includes('seller');

  return (
    <nav className="sticky top-0 z-50 glass-card border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
              <Gavel className="w-4 h-4 text-primary" />
            </div>
            <span className="font-bold text-lg gradient-text">BidVault</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/browse" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Browse</Link>
            {isAuthenticated && isBuyer && (
              <>
                <Link href="/feed" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Feed</Link>
                <Link href="/buyer/watchlist" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Watchlist</Link>
                <Link href="/buyer/bids" className="text-sm text-muted-foreground hover:text-foreground transition-colors">My Bids</Link>
                <Link href="/buyer/wins" className="text-sm text-muted-foreground hover:text-foreground transition-colors">My Wins</Link>
              </>
            )}
            {isAuthenticated && isSeller && (
              <>
                <Link href="/seller/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
                <Link href="/seller/items" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Inventory</Link>
                <Link href="/seller/orders" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Orders</Link>
                <Link href="/seller/analytics" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Analytics</Link>
                <Link href="/seller/items/new" className="text-sm text-primary hover:text-primary/80 transition-colors font-medium">+ List Item</Link>
              </>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Search button - always visible */}
            <Link
              href="/search"
              className="p-2 hover:bg-white/10 rounded-xl transition-colors text-muted-foreground hover:text-foreground"
              title="Search"
            >
              <Search className="w-4 h-4" />
            </Link>
            {isAuthenticated ? (
              <>
                <NotificationBell />
                {/* Role badge */}
                {canSwitch && (
                  <button
                    onClick={() => switchRole(isBuyer ? 'seller' : 'buyer')}
                    className="hidden md:flex text-xs px-2.5 py-1 rounded-full border border-white/10 text-muted-foreground hover:border-primary/50 hover:text-primary transition-all"
                  >
                    Switch to {isBuyer ? 'Seller' : 'Buyer'}
                  </button>
                )}
                <div className="relative group">
                  <button className="flex items-center gap-2 text-sm hover:text-foreground text-muted-foreground">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      {user?.display_name?.[0]?.toUpperCase()}
                    </div>
                  </button>
                  <div className="absolute right-0 mt-1 w-48 glass-card rounded-xl border border-white/10 shadow-xl hidden group-hover:block animate-slide-up">
                    <div className="px-3 py-2 border-b border-white/10">
                      <p className="text-sm font-medium">{user?.display_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{user?.active_role}</p>
                    </div>
                    <Link href={isSeller ? '/seller/settings' : '/buyer/settings'} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors">
                      <Settings className="w-4 h-4" /> Settings
                    </Link>
                    <button
                      onClick={logout}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 w-full text-left transition-colors"
                    >
                      <LogOut className="w-4 h-4" /> Logout
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <Link href="/login" className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors">Log in</Link>
                <Link href="/register" className="text-xs sm:text-sm px-3 sm:px-4 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium">
                  Register
                </Link>
              </>
            )}
            <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 space-y-2 border-t border-white/5 mt-2 pt-4">
            <Link href="/browse" className="block py-2 text-sm text-muted-foreground">Browse</Link>
            {isAuthenticated && isBuyer && (
              <>
                <Link href="/feed" className="block py-2 text-sm text-muted-foreground">Feed</Link>
                <Link href="/buyer/watchlist" className="block py-2 text-sm text-muted-foreground">Watchlist</Link>
                <Link href="/buyer/bids" className="block py-2 text-sm text-muted-foreground">My Bids</Link>
                <Link href="/buyer/wins" className="block py-2 text-sm text-muted-foreground">My Wins</Link>
              </>
            )}
            {isAuthenticated && isSeller && (
              <>
                <Link href="/seller/dashboard" className="block py-2 text-sm text-muted-foreground">Dashboard</Link>
                <Link href="/seller/items" className="block py-2 text-sm text-muted-foreground">Inventory</Link>
                <Link href="/seller/orders" className="block py-2 text-sm text-muted-foreground">Orders</Link>
                <Link href="/seller/analytics" className="block py-2 text-sm text-muted-foreground">Analytics</Link>
                <Link href="/seller/items/new" className="block py-2 text-sm text-primary">+ List Item</Link>
              </>
            )}
            {!isAuthenticated && (
              <>
                <Link href="/login" className="block py-2 text-sm">Log in</Link>
                <Link href="/register" className="block py-2 text-sm text-primary">Register</Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
