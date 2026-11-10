import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, supabaseUrl } from '../services/supabase';
import type { AppRole } from '../types';
import { normalizeAuthError } from '../utils/authErrors';
import { fetchTenantContext, setActiveTenant, type TenantContext } from '../services/tenants';

type BaseDbRole = 'admin' | 'seller';

type AuthProfile = {
  id: string;
  role: AppRole;
  baseRole: BaseDbRole;
  sellerId: string | null;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  role: AppRole | null;
  tenant: TenantContext | null;
  switchTenant: (tenantId: string) => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizeOperationalRole = (value: unknown): AppRole | null => {
  if (value === 'admin' || value === 'manager' || value === 'seller') return value;
  return null;
};

const resolveLegacyRole = async (userId: string, dbRole: BaseDbRole, authUser?: User | null): Promise<AppRole> => {
  if (dbRole === 'admin') return 'admin';

  const { data: operationalData } = await supabase
    .from('user_access_roles')
    .select('app_role')
    .eq('user_id', userId)
    .maybeSingle();
  const roleFromTable = normalizeOperationalRole(operationalData?.app_role);
  if (roleFromTable === 'manager' || roleFromTable === 'seller') return roleFromTable;

  const metadataRole =
    normalizeOperationalRole(authUser?.user_metadata?.app_role) ||
    normalizeOperationalRole(authUser?.app_metadata?.app_role) ||
    normalizeOperationalRole(authUser?.app_metadata?.role);
  return metadataRole === 'manager' ? 'manager' : 'seller';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [tenant, setTenant] = useState<TenantContext | null>(null);

  const loadProfile = useCallback(async (userId: string, authUser?: User | null) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, role, seller_id')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      setProfile(null);
      setTenant(null);
      return;
    }

    const dbRole = data.role as BaseDbRole;
    const tenantContext = await fetchTenantContext().catch(() => null);
    setTenant(tenantContext);

    // O papel vale por empresa; sem o contexto (banco antigo), cai no cálculo legado.
    const tenantRole = normalizeOperationalRole(tenantContext?.role);
    const effectiveRole = tenantRole ?? (await resolveLegacyRole(userId, dbRole, authUser));

    setProfile({
      id: data.id,
      role: effectiveRole,
      baseRole: dbRole,
      sellerId: tenantContext ? tenantContext.sellerId : data.seller_id
    });
  }, []);

  const hydrateFromSession = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession?.user) {
      setProfile(null);
      return;
    }

    await loadProfile(nextSession.user.id, nextSession.user);
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
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error) {
      throw normalizeAuthError(error, supabaseUrl);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null);
    setUser(null);
    setProfile(null);
    setTenant(null);
  };

  // Trocar de empresa muda tudo o que o app carregou; recarregar é o jeito
  // honesto de garantir que nenhum dado da empresa anterior fique na tela.
  const switchTenant = async (tenantId: string) => {
    await setActiveTenant(tenantId);
    window.location.reload();
  };

  const refreshProfile = async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    await loadProfile(user.id, user);
  };

  const value = useMemo<AuthContextType>(() => ({
    session,
    user,
    profile,
    role: profile?.role ?? null,
    tenant,
    switchTenant,
    isAuthenticated: !!session?.user,
    isLoading,
    signIn,
    signOut,
    refreshProfile
  }), [session, user, profile, tenant, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
