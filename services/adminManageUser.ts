import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';
import type { AppRole } from '../types';

type ManageAction = 'update' | 'delete';

type ManageUserResponse = {
  user?: {
    id: string;
    email?: string;
    role: AppRole;
    name?: string;
  };
  seller?: {
    id: string;
    name: string;
    email?: string;
    auth_user_id?: string;
    store_id?: string;
    total_sales: number;
  };
  success?: boolean;
  removedUserId?: string;
  removedSellerId?: string | null;
  error?: string;
  message?: string;
};

type UpdateUserPayload = {
  userId: string;
  name: string;
  email: string;
  role: AppRole;
  storeId?: string;
};

type DeleteUserPayload = {
  userId: string;
};

const resolveAccessToken = async (forceRefresh = false): Promise<string> => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error(sessionError.message || 'Nao foi possivel validar sua sessao.');
  }

  const session = sessionData.session;
  const refreshToken = session?.refresh_token;
  let accessToken = session?.access_token;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = session?.expires_at ?? 0;

  if (forceRefresh || !accessToken || expiresAt <= nowInSeconds + 30) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      throw new Error('Sessao expirada. Faca login novamente.');
    }
    accessToken = refreshed.session?.access_token;
  } else if (refreshToken) {
    const { error: userError } = await supabase.auth.getUser(accessToken);
    if (userError) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        throw new Error('Sessao expirada. Faca login novamente.');
      }
      accessToken = refreshed.session?.access_token;
    }
  }

  if (!accessToken) {
    throw new Error('Sessao expirada. Faca login novamente.');
  }

  return accessToken;
};

const invokeAdminManageUser = async (payload: Record<string, unknown>): Promise<ManageUserResponse> => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configuracao do Supabase ausente no frontend.');
  }

  const invokeWithToken = async (token: string) =>
    fetch(`${supabaseUrl}/functions/v1/admin-manage-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

  let accessToken = await resolveAccessToken(true);
  let response = await invokeWithToken(accessToken);
  let data = (await response.json().catch(() => null)) as ManageUserResponse | null;

  if (response.status === 401) {
    accessToken = await resolveAccessToken(true);
    response = await invokeWithToken(accessToken);
    data = (await response.json().catch(() => null)) as ManageUserResponse | null;
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Sessao expirada ou invalida. Faca login novamente.');
    }
    throw new Error(data?.error || data?.message || `Falha ao gerenciar usuario (${response.status}).`);
  }

  if (!data || data.error) {
    throw new Error(data?.error || 'Resposta invalida do gerenciamento de usuario.');
  }

  return data;
};

export const adminUpdateUser = async (payload: UpdateUserPayload): Promise<ManageUserResponse> =>
  invokeAdminManageUser({
    action: 'update' as ManageAction,
    userId: payload.userId,
    name: payload.name,
    email: payload.email,
    role: payload.role,
    storeId: payload.role === 'admin' ? undefined : payload.storeId || null,
  });

export const adminDeleteUser = async (payload: DeleteUserPayload): Promise<ManageUserResponse> =>
  invokeAdminManageUser({
    action: 'delete' as ManageAction,
    userId: payload.userId,
  });
