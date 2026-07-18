import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppRole } from '../../types';

export type DataQueryClient = Pick<SupabaseClient, 'from'>;

export const SALES_SELECT =
  '*, sale_items(*, stock_item:stock_items(*, costs(*))), payment_methods(*), sale_trade_in_items(*), customer:customers(*), seller:sellers(*)';

const emptyResult = () => Promise.resolve({ data: [], error: null });

export const TRANSACTIONS_PAGE_SIZE = 1000;

// O PostgREST corta toda resposta no max-rows do servidor (1000 no plano
// padrão do Supabase), mesmo com .limit() maior — acima disso as linhas
// excedentes são descartadas silenciosamente e o saldo calculado no cliente
// (Cofre/Conta Bancária) perde as transações mais antigas. Buscar em páginas.
export const fetchAllTransactions = async (
  client: DataQueryClient
): Promise<{ data: any[] | null; error: { message: string } | null }> => {
  const rows: any[] = [];
  for (let page = 0; ; page++) {
    const from = page * TRANSACTIONS_PAGE_SIZE;
    const { data, error } = await client
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + TRANSACTIONS_PAGE_SIZE - 1);
    if (error) return { data: null, error };
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < TRANSACTIONS_PAGE_SIZE) return { data: rows, error: null };
  }
};

export const loadShellAndCoreData = async (client: DataQueryClient) => {
  const [
    profileResult,
    cardFeeSettingsResult,
    aiEntrySettingsResult,
    simulatorTradeInValuesResult,
    simulatorTradeInAdjustmentsResult,
    storesResult,
    customersResult,
    sellersResult,
    stockResult,
    stockReservationsResult,
    deviceCatalogResult
  ] = await Promise.all([
    client.from('business_profile').select('*').single(),
    client.from('card_fee_settings').select('*').eq('id', 'default').single(),
    client.from('crm_ai_entry_settings').select('store_id,business_hours,special_business_hours'),
    client.from('simulator_trade_in_values').select('*').order('model', { ascending: true }),
    client.from('simulator_trade_in_adjustments').select('*').order('label', { ascending: true }),
    client.from('stores').select('*'),
    client.from('customers').select('*'),
    client.from('sellers').select('*'),
    client.from('stock_items').select('*, costs(*)'),
    client.from('stock_reservations').select('*').eq('status', 'active'),
    client.from('device_catalog').select('*').order('created_at', { ascending: false })
  ]);

  return {
    profileResult,
    cardFeeSettingsResult,
    aiEntrySettingsResult,
    simulatorTradeInValuesResult,
    simulatorTradeInAdjustmentsResult,
    storesResult,
    customersResult,
    sellersResult,
    stockResult,
    stockReservationsResult,
    deviceCatalogResult
  };
};

export const loadSalesHistoryData = (client: DataQueryClient) =>
  client.from('sales').select(SALES_SELECT);

export const loadFinanceData = async (client: DataQueryClient, role: AppRole | null) => {
  const [
    debtsResult,
    debtPaymentsResult,
    partsResult,
    transactionsResult,
    costHistoryResult,
    categoriesResult,
    creditorsResult,
    payableDebtsResult,
    payableDebtPaymentsResult
  ] = await Promise.all([
    role === 'admin'
      ? client.from('debts').select('*').order('created_at', { ascending: false })
      : emptyResult(),
    role === 'admin'
      ? client.from('debt_payments').select('*').order('paid_at', { ascending: false })
      : emptyResult(),
    client.from('parts_inventory').select('*').order('name', { ascending: true }),
    role === 'admin' ? fetchAllTransactions(client) : emptyResult(),
    client.from('cost_history').select('*'),
    client.from('finance_categories').select('*').order('name', { ascending: true }),
    role === 'admin'
      ? client.from('creditors').select('*').order('name', { ascending: true })
      : emptyResult(),
    role === 'admin'
      ? client.from('payable_debts').select('*').order('created_at', { ascending: false })
      : emptyResult(),
    role === 'admin'
      ? client.from('payable_debt_payments').select('*').order('paid_at', { ascending: false })
      : emptyResult()
  ]);

  return {
    debtsResult,
    debtPaymentsResult,
    partsResult,
    transactionsResult,
    costHistoryResult,
    categoriesResult,
    creditorsResult,
    payableDebtsResult,
    payableDebtPaymentsResult
  };
};
