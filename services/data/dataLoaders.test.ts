import { describe, expect, it } from 'vitest';
import {
  fetchAllTransactions,
  loadFinanceData,
  loadSalesHistoryData,
  loadShellAndCoreData,
  SALES_SELECT,
  TRANSACTIONS_PAGE_SIZE,
  type DataQueryClient
} from './dataLoaders';

const createQueryClient = (pages: Array<{ data: any[] | null; error: { message: string } | null }> = []) => {
  const selectedTables: string[] = [];
  const selectedColumns: Array<{ table: string; columns: string }> = [];
  const rangeCalls: Array<{ table: string; from: number; to: number }> = [];
  let pageIndex = 0;

  const client = {
    from(table: string) {
      let result = { data: [] as any[] | null, error: null as { message: string } | null };
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
        range(from: number, to: number) {
          rangeCalls.push({ table, from, to });
          result = pages[pageIndex] ?? { data: [], error: null };
          pageIndex += 1;
          return query;
        },
        then(resolve: (value: typeof result) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve(result).then(resolve, reject);
        }
      };

      return query;
    }
  } as unknown as DataQueryClient;

  return { client, rangeCalls, selectedColumns, selectedTables };
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

  it('loads transactions through the paginated fetch for administrators', async () => {
    const { client, rangeCalls } = createQueryClient();

    await loadFinanceData(client, 'admin');

    expect(rangeCalls).toContainEqual({ table: 'transactions', from: 0, to: TRANSACTIONS_PAGE_SIZE - 1 });
  });
});

describe('fetchAllTransactions', () => {
  const makeRows = (count: number, prefix: string) =>
    Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index}` }));

  it('stops after a single page when it comes back short', async () => {
    const { client, rangeCalls } = createQueryClient([{ data: makeRows(3, 'a'), error: null }]);

    const { data, error } = await fetchAllTransactions(client);

    expect(error).toBeNull();
    expect(data).toHaveLength(3);
    expect(rangeCalls).toEqual([{ table: 'transactions', from: 0, to: TRANSACTIONS_PAGE_SIZE - 1 }]);
  });

  it('keeps fetching pages past the PostgREST max-rows cap', async () => {
    const { client, rangeCalls } = createQueryClient([
      { data: makeRows(TRANSACTIONS_PAGE_SIZE, 'a'), error: null },
      { data: makeRows(12, 'b'), error: null }
    ]);

    const { data, error } = await fetchAllTransactions(client);

    expect(error).toBeNull();
    expect(data).toHaveLength(TRANSACTIONS_PAGE_SIZE + 12);
    expect(rangeCalls).toEqual([
      { table: 'transactions', from: 0, to: TRANSACTIONS_PAGE_SIZE - 1 },
      { table: 'transactions', from: TRANSACTIONS_PAGE_SIZE, to: TRANSACTIONS_PAGE_SIZE * 2 - 1 }
    ]);
  });

  it('surfaces errors without returning partial data', async () => {
    const { client } = createQueryClient([
      { data: makeRows(TRANSACTIONS_PAGE_SIZE, 'a'), error: null },
      { data: null, error: { message: 'boom' } }
    ]);

    const { data, error } = await fetchAllTransactions(client);

    expect(error).toEqual({ message: 'boom' });
    expect(data).toBeNull();
  });
});
