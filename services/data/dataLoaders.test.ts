import { describe, expect, it } from 'vitest';
import {
  loadFinanceData,
  loadSalesHistoryData,
  loadShellAndCoreData,
  SALES_SELECT,
  type DataQueryClient
} from './dataLoaders';

const createQueryClient = () => {
  const selectedTables: string[] = [];
  const selectedColumns: Array<{ table: string; columns: string }> = [];
  const limitCalls: Array<{ table: string; limit: number }> = [];

  const client = {
    from(table: string) {
      const result = { data: [], error: null };
      const query = {
        select(columns = '*') {
          selectedTables.push(table);
          selectedColumns.push({ table, columns });
          return query;
        },
        order() {
          return query;
        },
        eq() {
          return query;
        },
        single() {
          return Promise.resolve(result);
        },
        limit(limit: number) {
          limitCalls.push({ table, limit });
          return Promise.resolve(result);
        },
        then(resolve: (value: typeof result) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve(result).then(resolve, reject);
        }
      };

      return query;
    }
  } as unknown as DataQueryClient;

  return { client, limitCalls, selectedColumns, selectedTables };
};

describe('data loaders', () => {
  it('loads shell tables in parallel without sales or finance tables', async () => {
    const { client, selectedTables } = createQueryClient();

    await loadShellAndCoreData(client);

    expect(selectedTables).toEqual(expect.arrayContaining([
      'business_profile',
      'card_fee_settings',
      'crm_ai_entry_settings',
      'simulator_trade_in_values',
      'simulator_trade_in_adjustments',
      'stores',
      'customers',
      'sellers',
      'stock_items',
      'stock_reservations',
      'device_catalog'
    ]));
    expect(selectedTables).not.toContain('sales');
    expect(selectedTables).not.toContain('transactions');
    expect(selectedTables).not.toContain('debts');
  });

  it('uses the complete sales projection for history reads', async () => {
    const { client, selectedColumns } = createQueryClient();

    await loadSalesHistoryData(client);

    expect(selectedColumns).toContainEqual({ table: 'sales', columns: SALES_SELECT });
  });

  it('does not query admin-only finance tables for sellers', async () => {
    const { client, selectedTables } = createQueryClient();

    await loadFinanceData(client, 'seller');

    expect(selectedTables).toEqual(expect.arrayContaining([
      'parts_inventory',
      'cost_history',
      'finance_categories'
    ]));
    [
      'debts',
      'debt_payments',
      'transactions',
      'creditors',
      'payable_debts',
      'payable_debt_payments'
    ].forEach((table) => expect(selectedTables).not.toContain(table));
  });

  it('keeps the transaction safety limit for administrators', async () => {
    const { client, limitCalls } = createQueryClient();

    await loadFinanceData(client, 'admin');

    expect(limitCalls).toContainEqual({ table: 'transactions', limit: 100000 });
  });
});
