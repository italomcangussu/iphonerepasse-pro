import React, { useEffect, useRef } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataProvider, useData } from './dataContext';
import { Condition, DeviceType, Sale, StockStatus, WarrantyType } from '../types';

const useAuthMock = vi.fn();
const fromMock = vi.fn();
const insertCalls: Array<{ table: string; payload: any }> = [];
const deleteCalls: Array<{ table: string; column: string; value: any }> = [];
const queryCalls: Array<{ table: string; method: string; column?: string; value?: any }> = [];

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => useAuthMock()
}));

vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => fromMock(table),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(() => ({}))
    })),
    removeChannel: vi.fn()
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
    order: vi.fn(() => Promise.resolve(listResponse())),
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

describe('DataProvider addSale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertCalls.length = 0;
    deleteCalls.length = 0;
    queryCalls.length = 0;
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
});

describe('DataProvider removeTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertCalls.length = 0;
    deleteCalls.length = 0;
    queryCalls.length = 0;
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

    expect(deleteCalls).toContainEqual({ table: 'transactions', column: 'id', value: 'trx-payable-1' });
    await waitFor(() => expect(screen.getByTestId('transaction-count')).toHaveTextContent('0'));
    expect(screen.getByTestId('payable-payment-count')).toHaveTextContent('0');
    expect(screen.getByTestId('payable-debt-status')).toHaveTextContent('Aberta');
    expect(screen.getByTestId('payable-debt-remaining')).toHaveTextContent('100');
    expect(queryCalls).toContainEqual({ table: 'payable_debts', method: 'eq', column: 'id', value: 'pdbt-1' });
  });
});
