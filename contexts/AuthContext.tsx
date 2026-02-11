import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import type { AppRole } from '../types';

type AuthProfile = {
  id: string;
  role: AppRole;
  sellerId: string | null;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  role: AppRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, role, seller_id')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      setProfile(null);
      return;
    }

    setProfile({
      id: data.id,
      role: data.role as AppRole,
      sellerId: data.seller_id
    });
  }, []);

  const hydrateFromSession = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession?.user) {
      setProfile(null);
      return;
    }

    await loadProfile(nextSession.user.id);
  }, [loadProfile]);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!mounted) return;
        await hydrateFromSession(data.session);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void (async () => {
        try {
          await hydrateFromSession(nextSession);
        } finally {
          if (mounted) setIsLoading(false);
        }
      })();
    });

    void initAuth();

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [hydrateFromSession]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    await loadProfile(user.id);
  };

  const value = useMemo<AuthContextType>(() => ({
    session,
    user,
    profile,
    role: profile?.role ?? null,
    isAuthenticated: !!session?.user,
    isLoading,
    signIn,
    signOut,
    refreshProfile
  }), [session, user, profile, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
