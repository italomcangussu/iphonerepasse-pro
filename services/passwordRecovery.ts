import type { SupabaseClient } from '@supabase/supabase-js';

const RECOVERY_FLAG = 'auth.passwordRecovery';
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

export const isPasswordRecoveryPending = (): boolean => {
  try {
    return window.sessionStorage.getItem(RECOVERY_FLAG) === '1';
  } catch {
    return false;
  }
};

const setPending = (pending: boolean) => {
  try {
    if (pending) window.sessionStorage.setItem(RECOVERY_FLAG, '1');
    else window.sessionStorage.removeItem(RECOVERY_FLAG);
  } catch {
    // Sem sessionStorage (modo privado restrito): o aviso vale só enquanto a aba estiver aberta.
  }
  notify();
};

export const clearPasswordRecovery = () => setPending(false);

export const subscribePasswordRecovery = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Lê `#access_token=…&refresh_token=…&type=recovery` do link do e-mail. */
export const parseRecoveryHash = (hash: string): { accessToken: string; refreshToken: string } | null => {
  const params = new URLSearchParams(hash.replace(/^#\/?/, ''));
  if (params.get('type') !== 'recovery') return null;
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
};

/**
 * O link de recuperação volta com os tokens no hash, que o HashRouter trataria como rota
 * desconhecida e apagaria. Por isso a sessão é aberta aqui, no carregamento do módulo,
 * antes de qualquer roteador montar.
 */
export const consumeRecoveryLink = async (client: SupabaseClient): Promise<void> => {
  if (typeof window === 'undefined') return;
  const tokens = parseRecoveryHash(window.location.hash);
  if (!tokens) return;

  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  const { error } = await client.auth.setSession({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken });
  if (!error) setPending(true);
};

export const requestPasswordReset = async (client: SupabaseClient, email: string): Promise<void> => {
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/` });
  if (error) throw error;
};
