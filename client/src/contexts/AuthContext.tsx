'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setAccessToken } from '@/lib/api';

interface User {
  id: string;
  sub?: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  roles: string[];
  active_role: string;
  onboarding_completed?: boolean;
  storefront_name?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, display_name: string, role: 'buyer' | 'seller') => Promise<User>;
  logout: () => Promise<void>;
  switchRole: (role: string) => Promise<void>;
  mutateAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const mutateAuth = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      // Polyfill 'sub' from 'id' to fix jwt-style claim references
      if (data.user?.id) data.user.sub = data.user.id;
      setUser(data.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // On mount, try to refresh the access token (refresh token is in httpOnly cookie)
    const init = async () => {
      try {
        const { data } = await api.post('/auth/refresh');
        setAccessToken(data.access_token);
        await mutateAuth();
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [mutateAuth]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    setAccessToken(data.access_token);
    if (data.user?.id) data.user.sub = data.user.id;
    setUser(data.user);
  }, []);

  const register = useCallback(async (email: string, password: string, display_name: string, role: 'buyer' | 'seller') => {
    const { data } = await api.post(`/auth/register/${role}`, { email, password, display_name });
    setAccessToken(data.access_token);
    if (data.user?.id) data.user.sub = data.user.id;
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch {}
    setAccessToken(null);
    setUser(null);
  }, []);

  const switchRole = useCallback(async (role: string) => {
    const { data } = await api.post('/auth/switch-role', { role });
    setAccessToken(data.access_token);
    setUser(prev => prev ? { ...prev, active_role: role } : null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, register, logout, switchRole, mutateAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
