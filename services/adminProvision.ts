import { supabase } from './supabase';
import type { AppRole } from '../types';

type ProvisionPayload = {
  email?: string;
  password?: string;
  role: AppRole;
  name: string;
  storeId?: string;
  sellerId?: string;
};

type ProvisionResult = {
  user?: {
    id: string;
    email?: string;
    role: AppRole;
  };
  seller?: {
    id: string;
    name: string;
    email?: string;
    auth_user_id?: string;
    store_id?: string;
    total_sales: number;
  };
};

export const adminProvisionUser = async (payload: ProvisionPayload): Promise<ProvisionResult> => {
  const { data, error } = await supabase.functions.invoke('admin-provision-user', {
    body: payload
  });

  if (error) {
    throw new Error(error.message || 'Falha ao provisionar usuário.');
  }

  if (!data || data.error) {
    throw new Error(data?.error || 'Resposta inválida do provisionamento.');
  }

  return data as ProvisionResult;
};
