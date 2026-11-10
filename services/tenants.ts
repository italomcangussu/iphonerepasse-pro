import { supabase } from './supabase';
import type { AppRole } from '../types';

// Empresas (multiempresa). Toda regra mora no banco; aqui só a chamada tipada.

export type TenantSummary = {
  id: string;
  name: string;
  role: AppRole;
  isPrimary: boolean;
};

export type TenantContext = {
  activeTenantId: string;
  role: AppRole | null;
  sellerId: string | null;
  canCreateTenants: boolean;
  tenants: TenantSummary[];
};

export type TenantMember = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: AppRole;
  created_at: string;
};

export type TransferStore = {
  id: string;
  name: string;
  city: string | null;
  transferableCount: number;
};

export type TransferTenant = {
  id: string;
  name: string;
  isPrimary: boolean;
  stores: TransferStore[];
};

export type TransferableItem = {
  id: string;
  type: string;
  model: string;
  color: string | null;
  capacity: string | null;
  imei: string | null;
  condition: string;
  status: string;
  battery_health: number | null;
  sell_price: number | null;
  /** Valor de compra + custos lançados. */
  cost: number;
};

export type SaleAccount = 'Conta Bancária' | 'Cofre';

/** Transferência entre empresas como venda: valor de cada aparelho e a conta usada nas duas empresas. */
export type StockSale = { account: SaleAccount; prices: Record<string, number> };

export type StockTransferResult = { moved: number; targetStoreId: string; saleTotal: number | null };

export type StoreTransferResult = {
  storeId: string;
  movedItems: number;
  moved: Record<string, number>;
};

const call = async <T>(fn: string, args?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
};

export const fetchTenantContext = () => call<TenantContext>('my_tenant_context');

export const setActiveTenant = (tenantId: string) =>
  call<void>('set_active_tenant', { p_tenant_id: tenantId });

export const createTenant = (name: string) => call<{ id: string; name: string }>('create_tenant', { p_name: name });

export const renameTenant = (tenantId: string, name: string) =>
  call<void>('rename_tenant', { p_tenant_id: tenantId, p_name: name });

export const listTenantMembers = (tenantId: string) =>
  call<TenantMember[]>('tenant_members_list', { p_tenant_id: tenantId });

export const addTenantMember = (tenantId: string, email: string, role: AppRole) =>
  call<void>('tenant_add_member', { p_tenant_id: tenantId, p_email: email, p_role: role });

export const removeTenantMember = (tenantId: string, userId: string) =>
  call<void>('tenant_remove_member', { p_tenant_id: tenantId, p_user_id: userId });

export const fetchTransferCatalog = () => call<TransferTenant[]>('tenant_transfer_catalog');

export const fetchTransferableStock = (storeId: string) =>
  call<TransferableItem[]>('tenant_transferable_stock', { p_store_id: storeId });

export const transferStoreToTenant = (storeId: string, targetTenantId: string) =>
  call<StoreTransferResult>('transfer_store_to_tenant', { p_store_id: storeId, p_target_tenant_id: targetTenantId });

export const transferStockItems = (itemIds: string[], targetStoreId: string, sale?: StockSale) =>
  call<StockTransferResult>('transfer_stock_items', {
    p_item_ids: itemIds,
    p_target_store_id: targetStoreId,
    p_sale: sale ?? null,
  });
