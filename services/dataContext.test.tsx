import React, { useEffect, useRef } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataProvider, useData } from './dataContext';
import { Condition, DeviceType, Sale, StockStatus, WarrantyType } from '../types';

const {
  useAuthMock,
  fromMock,
  rpcMock,
  channelOnMock,
  channelSubscribeMock,
  removeChannelMock,
  channelStatusRef
} = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  channelOnMock: vi.fn(),
  channelSubscribeMock: vi.fn(),
  removeChannelMock: vi.fn(),
  channelStatusRef: { current: null as ((status: string) => void) | null }
}));
const insertCalls: Array<{ table: string; payload: any }> = [];
const deleteCalls: Array<{ table: string; column: string; value: any }> = [];
const queryCalls: Array<{ table: string; method: string; column?: string; value?: any }> = [];

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => useAuthMock()
}));

vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => fromMock(table),
    rpc: (...args: any[]) => rpcMock(...args),
    channel: vi.fn(() => ({
      on: channelOnMock.mockReturnThis(),
      subscribe: channelSubscribeMock.mockImplementation((callback?: (status: string) => void) => {
        channelStatusRef.current = callback ?? null;
        return {};
      })
    })),
    removeChannel: removeChannelMock
  }
}));

const createQuery = (table: string) => ({
  insert: vi.fn((payload: any) => {
    insertCalls.push({ table, payload });

    if (table === 'sales') {
      return {
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { id: payload.id }, error: null })
        }))
      };
    }

    return Promise.resolve({ error: null });
  }),
  select: vi.fn(() => Promise.resolve({ data: [], error: null })),
  update: vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ error: null })
  }))
});

const payableDebtBeforeReversal = {
  id: 'pdbt-1',
  creditor_id: 'cred-1',
  creditor_name: 'Fornecedor Teste',
  creditor_document: null,
  creditor_phone: null,
  original_amount: 100,
  remaining_amount: 0,
  status: 'Quitada',
  due_date: null,
  first_due_date: null,
  installments_total: 1,
  notes: null,
  source: 'manual',
  sale_id: null,
  created_at: '2026-04-26T12:00:00.000Z',
  updated_at: '2026-04-26T12:00:00.000Z'
};

const payableDebtAfterReversal = {
  ...payableDebtBeforeReversal,
  remaining_amount: 100,
  status: 'Aberta',
  updated_at: '2026-04-27T12:00:00.000Z'
};

const initialRowsByTable: Record<string, any[]> = {
  business_profile: [],
  card_fee_settings: [],
  stores: [],
  customers: [],
  sellers: [],
  debts: [],
  debt_payments: [],
  stock_items: [],
  device_catalog: [],
  parts_inventory: [],
  sales: [],
  transactions: [
    {
      id: 'trx-payable-1',
      type: 'OUT',
      category: 'Fornecedor',
      amount: 100,
      date: '2026-04-27T12:00:00.000Z',
      description: 'Pagamento ao fornecedor',
      account: 'Conta Bancária',
      sale_id: null,
      debt_payment_id: null,
      payable_debt_payment_id: 'pdpm-1'
    }
  ],
  cost_history: [],
  finance_categories: [],
  creditors: [
    {
      id: 'cred-1',
      name: 'Fornecedor Teste',
      document: null,
      document_type: null,
      phone: null,
      email: null,
      notes: null,
      created_at: '2026-04-26T12:00:00.000Z',
      updated_at: '2026-04-26T12:00:00.000Z'
    }
  ],
  payable_debts: [payableDebtBeforeReversal],
  payable_debt_payments: [
    {
      id: 'pdpm-1',
      payable_debt_id: 'pdbt-1',
      amount: 100,
      payment_method: 'Pix',
      account: 'Conta Bancária',
      paid_at: '2026-04-27T12:00:00.000Z',
      notes: null,
      attachment_path: null,
      attachment_mime: null,
      attachment_name: null,
      attachment_size: null,
      created_at: '2026-04-27T12:00:00.000Z'
    }
  ]
};

const createAdminQuery = (table: string) => {
  const filters: Record<string, any> = {};
  const listResponse = () => ({ data: initialRowsByTable[table] || [], error: null });
  const singleResponse = () => {
    if (table === 'payable_debts' && filters.id === 'pdbt-1') {
      return { data: payableDebtAfterReversal, error: null };
    }

    const rows = initialRowsByTable[table] || [];
    const row = Object.keys(filters).length === 0
      ? rows[0] || null
      : rows.find((entry) => Object.entries(filters).every(([column, value]) => entry[column] === value)) || null;

    return { data: row, error: null };
  };

  const query: any = {
    select: vi.fn(() => {
      queryCalls.push({ table, method: 'select' });
      return query;
    }),
    order: vi.fn(() => query),
    limit: vi.fn(() => Promise.resolve(listResponse())),
    eq: vi.fn((column: string, value: any) => {
      filters[column] = value;
      queryCalls.push({ table, method: 'eq', column, value });
      return query;
    }),
    single: vi.fn(() => Promise.resolve(singleResponse())),
    maybeSingle: vi.fn(() => Promise.resolve(singleResponse())),
    delete: vi.fn(() => ({
      eq: vi.fn((column: string, value: any) => {
        deleteCalls.push({ table, column, value });
        return Promise.resolve({ error: null });
      })
    })),
    insert: vi.fn(() => Promise.resolve({ error: null })),
    update: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null })
    })),
    then: (resolve: any, reject: any) => Promise.resolve(listResponse()).then(resolve, reject),
    catch: (reject: any) => Promise.resolve(listResponse()).catch(reject),
    finally: (onFinally: any) => Promise.resolve(listResponse()).finally(onFinally)
  };

  return query;
};

const saleWithDraftTradeIn = (): Sale => ({
  id: 'sale-test-1',
  customerId: 'cust-1',
  sellerId: 'seller-1',
  storeId: 'store-1',
  items: [
    {
      id: 'stock-sold-1',
      type: DeviceType.IPHONE,
      model: 'iPhone 15 Pro Max',
      color: 'Titanio Preto',
      capacity: '256 GB',
      imei: '351503401283245',
      condition: Condition.USED,
      status: StockStatus.AVAILABLE,
      storeId: 'store-1',
      purchasePrice: 4200,
      sellPrice: 5390,
      originalSellPrice: 5390,
      maxDiscount: 0,
      warrantyType: WarrantyType.STORE,
      warrantyExpiresAt: '2026-07-26T18:00:00.000Z',
      costs: [],
      photos: [],
      entryDate: '2026-04-20'
    }
  ],
  tradeIns: [
    {
      id: 'sti-1',
      stockItemId: 'trade-draft-1',
      model: 'iPhone 17 Air',
      capacity: '128 GB',
      color: 'Azul Ceu',
      imei: '',
      condition: Condition.USED,
      receivedValue: 5000,
      stockSnapshot: {
        id: 'trade-draft-1',
        type: DeviceType.IPHONE,
        model: 'iPhone 17 Air',
        color: 'Azul Ceu',
        capacity: '128 GB',
        imei: '',
        condition: Condition.USED,
        status: StockStatus.PREPARATION,
        storeId: 'store-1',
        purchasePrice: 5000,
        sellPrice: 0,
        maxDiscount: 0,
        warrantyType: WarrantyType.STORE,
        costs: [],
        photos: [],
        entryDate: '2026-04-27T18:00:00.000Z'
      }
    }
  ],
  tradeInValue: 5000,
  discount: 0,
  total: 390,
  paymentMethods: [{ type: 'Pix', amount: 390, account: 'Conta Bancária' }],
  date: '2026-04-27T18:00:00.000Z',
  warrantyExpiresAt: '2026-07-26T18:00:00.000Z'
});

function AddSaleOnMount({ sale, onDone }: { sale: Sale; onDone: (error?: unknown) => void }) {
  const { addSale } = useData();
  const didRunRef = useRef(false);

  useEffect(() => {
    if (didRunRef.current) return;
    didRunRef.current = true;
    addSale(sale).then(() => onDone()).catch(onDone);
  }, [addSale, onDone, sale]);

  return null;
}

function AddSaleAfterLoad({ sale, onDone }: { sale: Sale; onDone: (error?: unknown) => void }) {
  const { loading, sales, addSale } = useData();
  const didRunRef = useRef(false);

  useEffect(() => {
    if (loading || didRunRef.current) return;
    didRunRef.current = true;
    addSale(sale).then(() => onDone()).catch(onDone);
  }, [addSale, loading, onDone, sale]);

  return <span data-testid="sale-count">{sales.length}</span>;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function RemoveTransactionOnLoad({ onDone }: { onDone: (error?: unknown) => void }) {
  const { loading, removeTransaction, transactions, payableDebtPayments, payableDebts } = useData();
  const didRunRef = useRef(false);

  useEffect(() => {
    if (loading || didRunRef.current) return;
    didRunRef.current = true;
    removeTransaction('trx-payable-1').then(() => onDone()).catch(onDone);
  }, [loading, onDone, removeTransaction]);

  return (
    <div>
      <span data-testid="transaction-count">{transactions.length}</span>
      <span data-testid="payable-payment-count">{payableDebtPayments.length}</span>
      <span data-testid="payable-debt-status">{payableDebts[0]?.status || 'missing'}</span>
      <span data-testid="payable-debt-remaining">{payableDebts[0]?.remainingAmount ?? 'missing'}</span>
    </div>
  );
}

function RemoveSaleOnLoad({ onDone }: { onDone: (error?: unknown) => void }) {
  const { loading, removeSale, sales } = useData();
  const didRunRef = useRef(false);

  useEffect(() => {
    if (loading || didRunRef.current) return;
    didRunRef.current = true;
    removeSale('sale-cancel-1').then(() => onDone()).catch(onDone);
  }, [loading, onDone, removeSale]);

  return <span data-testid="sale-count">{sales.length}</span>;
}

function DataLoadProbe() {
  const { loading, customers, sales } = useData();

  return (
    <div>
      <span data-testid="loading-state">{loading ? 'loading' : 'idle'}</span>
      <span data-testid="customer-count">{customers.length}</span>
      <span data-testid="sales-count">{sales.length}</span>
      <span data-testid="first-sale-items-count">{sales[0]?.items.length ?? 0}</span>
    </div>
  );
}

const countTableSelects = (table: string) =>
  queryCalls.filter((call) => call.table === table && call.method === 'select').length;

describe('DataProvider addSale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channelStatusRef.current = null;
    insertCalls.length = 0;
    deleteCalls.length = 0;
    queryCalls.length = 0;
    rpcMock.mockResolvedValue({ error: null });
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      role: 'seller'
    });
    fromMock.mockImplementation(createQuery);
  });

  it('does not send draft trade-in stock id on the sales row before stock exists', async () => {
    const onDone = vi.fn();

    render(
      <DataProvider>
        <AddSaleOnMount sale={saleWithDraftTradeIn()} onDone={onDone} />
      </DataProvider>
    );

    await waitFor(() => expect(onDone).toHaveBeenCalledWith());

    const salesInsert = insertCalls.find((call) => call.table === 'sales');
    expect(insertCalls.filter((call) => call.table === 'sales')).toHaveLength(1);
    expect(salesInsert?.payload.trade_in_id).toBeNull();
  });

  it('does not wait for a full sales refresh to finish before resolving addSale', async () => {
    const onDone = vi.fn();
    const blockedSalesListRefresh = createDeferred<{ data: any[]; error: null }>();

    fromMock.mockImplementation((table: string) => {
      if (table === 'sales') {
        const query: any = {
          insert: vi.fn((payload: any) => {
            insertCalls.push({ table, payload });
            return {
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: { id: payload.id }, error: null })
              }))
            };
          }),
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          then: (resolve: any, reject: any) => blockedSalesListRefresh.promise.then(resolve, reject),
          catch: (reject: any) => blockedSalesListRefresh.promise.catch(reject),
          finally: (onFinally: any) => blockedSalesListRefresh.promise.finally(onFinally)
        };
        return query;
      }

      return createQuery(table);
    });

    render(
      <DataProvider>
        <AddSaleOnMount sale={saleWithDraftTradeIn()} onDone={onDone} />
      </DataProvider>
    );

    await waitFor(() => expect(onDone).toHaveBeenCalledWith());
  });
});

describe('DataProvider removeSale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channelStatusRef.current = null;
    insertCalls.length = 0;
    deleteCalls.length = 0;
    queryCalls.length = 0;
    rpcMock.mockResolvedValue({ error: null });
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      role: 'admin'
    });
    initialRowsByTable.stock_items = [
      {
        id: 'stock-sold-1',
        type: DeviceType.IPHONE,
        model: 'iPhone 15',
        color: 'Preto',
        capacity: '128 GB',
        imei: 'imei-sale-cancel-1',
        condition: Condition.USED,
        status: StockStatus.SOLD,
        store_id: 'store-1',
        purchase_price: 3000,
        sell_price: 4200,
        max_discount: 0,
        warranty_type: WarrantyType.STORE,
        warranty_end: null,
        entry_date: '2026-04-27',
        photos: [],
        costs: []
      }
    ];
    initialRowsByTable.sales = [
      {
        id: 'sale-cancel-1',
        customer_id: 'cust-1',
        seller_id: 'seller-1',
        store_id: 'store-1',
        total: 4200,
        discount: 0,
        trade_in_value: 0,
        trade_in_id: null,
        date: '2026-04-27T18:00:00.000Z',
        warranty_expires_at: null,
        sale_items: [
          {
            id: 'si-1',
            stock_item_id: 'stock-sold-1',
            price: 4200,
            original_price: 4200,
            stock_item: initialRowsByTable.stock_items[0]
          }
        ],
        payment_methods: [{ type: 'Pix', amount: 4200, account: 'Conta Bancária' }],
        sale_trade_in_items: []
      }
    ];
    fromMock.mockImplementation(createAdminQuery);
  });

  it('delegates sale cancellation to the transactional cancel_sale RPC', async () => {
    const onDone = vi.fn();

    render(
      <DataProvider>
        <RemoveSaleOnLoad onDone={onDone} />
      </DataProvider>
    );

    await waitFor(() => expect(onDone).toHaveBeenCalledWith());

    expect(rpcMock).toHaveBeenCalledWith('cancel_sale', { p_sale_id: 'sale-cancel-1' });
    expect(deleteCalls).not.toContainEqual({ table: 'sales', column: 'id', value: 'sale-cancel-1' });
  });
});

describe('DataProvider removeTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channelStatusRef.current = null;
    insertCalls.length = 0;
    deleteCalls.length = 0;
    queryCalls.length = 0;
    rpcMock.mockResolvedValue({ error: null });
    initialRowsByTable.sales = [];
    initialRowsByTable.stock_items = [];
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      role: 'admin'
    });
    fromMock.mockImplementation(createAdminQuery);
  });

  it('reverts the local payable debt payment state when canceling its financial transaction', async () => {
    const onDone = vi.fn();

    render(
      <DataProvider>
        <RemoveTransactionOnLoad onDone={onDone} />
      </DataProvider>
    );

    await waitFor(() => expect(onDone).toHaveBeenCalledWith());

    expect(rpcMock).toHaveBeenCalledWith('cancel_transaction', { p_transaction_id: 'trx-payable-1' });
    await waitFor(() => expect(screen.getByTestId('transaction-count')).toHaveTextContent('0'));
    expect(screen.getByTestId('payable-payment-count')).toHaveTextContent('0');
    expect(screen.getByTestId('payable-debt-status')).toHaveTextContent('Aberta');
    expect(screen.getByTestId('payable-debt-remaining')).toHaveTextContent('100');
    expect(queryCalls).toContainEqual({ table: 'payable_debts', method: 'eq', column: 'id', value: 'pdbt-1' });
  });
});

describe('DataProvider realtime resync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channelStatusRef.current = null;
    insertCalls.length = 0;
    deleteCalls.length = 0;
    queryCalls.length = 0;
    rpcMock.mockResolvedValue({ error: null });
    initialRowsByTable.sales = [];
    initialRowsByTable.stock_items = [];
    initialRowsByTable.customers = [
      {
        id: 'cust-1',
        name: 'CLIENTE TESTE',
        cpf: null,
        phone: '88999999999',
        email: null,
        birth_date: null,
        purchases: 0,
        total_spent: 0
      }
    ];
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      role: 'admin'
    });
    fromMock.mockImplementation(createAdminQuery);
  });

  it('refreshes data when window regains focus', async () => {
    render(
      <DataProvider>
        <DataLoadProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));
    const initialCustomerSelects = countTableSelects('customers');

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(countTableSelects('customers')).toBeGreaterThan(initialCustomerSelects));
  });

  it('refreshes data when browser comes back online', async () => {
    render(
      <DataProvider>
        <DataLoadProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));
    const initialCustomerSelects = countTableSelects('customers');

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(countTableSelects('customers')).toBeGreaterThan(initialCustomerSelects));
  });

  it('refreshes data when document becomes visible again', async () => {
    render(
      <DataProvider>
        <DataLoadProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));
    const initialCustomerSelects = countTableSelects('customers');

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible'
    });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(countTableSelects('customers')).toBeGreaterThan(initialCustomerSelects));
  });

  it('refreshes data when realtime resubscribes after a degraded state', async () => {
    render(
      <DataProvider>
        <DataLoadProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));
    const initialCustomerSelects = countTableSelects('customers');

    act(() => {
      channelStatusRef.current?.('CHANNEL_ERROR');
      channelStatusRef.current?.('SUBSCRIBED');
    });

    await waitFor(() => expect(countTableSelects('customers')).toBeGreaterThan(initialCustomerSelects));
  });

  it('rehydrates a sale when sale child rows arrive after the sales insert event', async () => {
    const saleId = 'sale-realtime-1';
    const saleRow = {
      id: saleId,
      customer_id: 'cust-1',
      seller_id: 'seller-1',
      store_id: 'store-1',
      total: 390,
      discount: 0,
      trade_in_value: 0,
      trade_in_id: null,
      date: '2026-05-13T16:37:57.000Z',
      warranty_expires_at: null,
      sale_items: [],
      payment_methods: [],
      sale_trade_in_items: [],
      customer: initialRowsByTable.customers[0],
      seller: { id: 'seller-1', name: 'LEAD', email: null, auth_user_id: null, store_id: 'store-1', total_sales: 0 }
    };

    initialRowsByTable.stores = [{ id: 'store-1', name: 'Sobral', city: 'Sobral' }];
    initialRowsByTable.sellers = [saleRow.seller];
    initialRowsByTable.stock_items = [
      {
        id: 'stock-realtime-1',
        type: DeviceType.IPHONE,
        model: 'iPhone 15',
        color: 'Preto',
        capacity: '128 GB',
        imei: 'imei-realtime-1',
        condition: Condition.USED,
        status: StockStatus.SOLD,
        store_id: 'store-1',
        purchase_price: 3000,
        sell_price: 390,
        max_discount: 0,
        warranty_type: WarrantyType.STORE,
        warranty_end: null,
        entry_date: '2026-05-13',
        photos: [],
        costs: []
      }
    ];

    initialRowsByTable.sales = [];
    let saleSelectCount = 0;
    const latestSaleSnapshot = () => ({
      ...saleRow,
      sale_items: [
        {
          id: 'si-realtime-1',
          sale_id: saleId,
          stock_item_id: 'stock-realtime-1',
          price: 390,
          original_price: 390,
          stock_item: initialRowsByTable.stock_items[0]
        }
      ],
      payment_methods: [
        {
          id: 'pm-realtime-1',
          sale_id: saleId,
          type: 'Pix',
          amount: 390,
          account: 'Conta Bancária'
        }
      ],
      customer: initialRowsByTable.customers[0],
      seller: initialRowsByTable.sellers[0]
    });

    fromMock.mockImplementation((table: string) => {
      if (table === 'sales') {
        const query = createAdminQuery(table);
        query.eq = vi.fn((column: string, value: any) => {
          queryCalls.push({ table, method: 'eq', column, value });
          return query;
        });
        query.single = vi.fn(() => {
          saleSelectCount += 1;
          return Promise.resolve({
            data: saleSelectCount === 1 ? saleRow : latestSaleSnapshot(),
            error: null
          });
        });
        return query;
      }

      return createAdminQuery(table);
    });

    render(
      <DataProvider>
        <DataLoadProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));

    const salesHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'sales')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;
    const saleItemsHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'sale_items')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(salesHandler).toBeTypeOf('function');
    expect(saleItemsHandler).toBeTypeOf('function');

    await act(async () => {
      await salesHandler?.({ eventType: 'INSERT', new: { id: saleId } });
    });

    expect(saleSelectCount).toBe(1);
    expect(screen.getByTestId('sales-count')).toHaveTextContent('1');
    expect(screen.getByTestId('first-sale-items-count')).toHaveTextContent('0');

    initialRowsByTable.sales = [latestSaleSnapshot()];

    await act(async () => {
      await saleItemsHandler?.({ eventType: 'INSERT', new: { sale_id: saleId } });
    });

    expect(saleSelectCount).toBe(2);
    await waitFor(() => expect(screen.getByTestId('first-sale-items-count')).toHaveTextContent('1'));
  });

  it('keeps a newly created sale visible when an older resync finishes later', async () => {
    const onDone = vi.fn();
    const staleSalesRefresh = createDeferred<{ data: any[]; error: null }>();
    const saleItemsInsert = createDeferred<{ error: null }>();
    let salesSelectCount = 0;
    let saleItemsRows: any[] = [];
    let paymentMethodRows: any[] = [];
    const insertedSaleRow = {
      id: 'sale-race-1',
      customer_id: 'cust-1',
      seller_id: 'seller-1',
      store_id: 'store-1',
      total: 390,
      discount: 0,
      trade_in_value: 0,
      trade_in_id: null,
      date: '2026-05-13T16:37:57.000Z',
      warranty_expires_at: null,
      sale_items: [],
      payment_methods: [],
      sale_trade_in_items: []
    };
    initialRowsByTable.stores = [{ id: 'store-1', name: 'Sobral', city: 'Sobral' }];
    initialRowsByTable.sellers = [{ id: 'seller-1', name: 'LEAD', email: null, auth_user_id: null, store_id: 'store-1', total_sales: 0 }];
    initialRowsByTable.stock_items = [
      {
        id: 'stock-race-1',
        type: DeviceType.IPHONE,
        model: 'iPhone 15',
        color: 'Preto',
        capacity: '128 GB',
        imei: 'imei-race-1',
        condition: Condition.USED,
        status: StockStatus.AVAILABLE,
        store_id: 'store-1',
        purchase_price: 3000,
        sell_price: 390,
        max_discount: 0,
        warranty_type: WarrantyType.STORE,
        warranty_end: null,
        entry_date: '2026-05-13',
        photos: [],
        costs: []
      }
    ];
    initialRowsByTable.sales = [];
    initialRowsByTable.transactions = [];

    fromMock.mockImplementation((table: string) => {
      if (table === 'sales') {
        const query: any = {
          insert: vi.fn((payload: any) => {
            Object.assign(insertedSaleRow, payload, { id: payload.id });
            return {
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: insertedSaleRow, error: null })
              }))
            };
          }),
          select: vi.fn(() => {
            queryCalls.push({ table, method: 'select' });
            salesSelectCount += 1;
            if (salesSelectCount === 2) return query;
            if (salesSelectCount === 1) return Promise.resolve({ data: [], error: null });
            return Promise.resolve({
              data: [{
                ...insertedSaleRow,
                sale_items: saleItemsRows,
                payment_methods: paymentMethodRows,
                customer: initialRowsByTable.customers[0],
                seller: initialRowsByTable.sellers[0]
              }],
              error: null
            });
          }),
          then: (resolve: any, reject: any) => staleSalesRefresh.promise.then(resolve, reject),
          catch: (reject: any) => staleSalesRefresh.promise.catch(reject),
          finally: (onFinally: any) => staleSalesRefresh.promise.finally(onFinally)
        };
        return query;
      }

      if (table === 'sale_items') {
        return {
          insert: vi.fn((rows: any[]) => {
            saleItemsRows = rows.map((row) => ({
              ...row,
              stock_item: initialRowsByTable.stock_items.find((item) => item.id === row.stock_item_id)
            }));
            return saleItemsInsert.promise;
          })
        };
      }

      if (table === 'payment_methods') {
        return {
          insert: vi.fn((rows: any[]) => {
            paymentMethodRows = rows;
            return Promise.resolve({ error: null });
          })
        };
      }

      return createAdminQuery(table);
    });

    render(
      <DataProvider>
        <DataLoadProbe />
        <AddSaleAfterLoad sale={saleWithDraftTradeIn()} onDone={onDone} />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));
    await waitFor(() => expect(saleItemsRows.length).toBeGreaterThan(0));

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(salesSelectCount).toBe(2));

    await act(async () => {
      saleItemsInsert.resolve({ error: null });
      await saleItemsInsert.promise;
    });

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(onDone.mock.calls[0]?.[0]).toBeUndefined();
    await waitFor(() => expect(screen.getByTestId('sale-count')).toHaveTextContent('1'));

    await act(async () => {
      staleSalesRefresh.resolve({ data: [], error: null });
      await staleSalesRefresh.promise;
    });

    expect(screen.getByTestId('sale-count')).toHaveTextContent('1');
  });
});
