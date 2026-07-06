import React, { useEffect, useRef, useState } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataProvider, useData } from './dataContext';
import { Condition, DeviceType, Sale, StockStatus, Transaction, WarrantyType } from '../types';

const {
  useAuthMock,
  fromMock,
  rpcMock,
  functionsInvokeMock,
  channelOnMock,
  channelSubscribeMock,
  removeChannelMock,
  channelStatusRef
} = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  functionsInvokeMock: vi.fn((..._args: any[]) => Promise.resolve({ data: null, error: null })),
  channelOnMock: vi.fn(),
  channelSubscribeMock: vi.fn(),
  removeChannelMock: vi.fn(),
  channelStatusRef: { current: null as ((status: string) => void) | null }
}));
const insertCalls: Array<{ table: string; payload: any }> = [];
const upsertCalls: Array<{ table: string; payload: any }> = [];
const deleteCalls: Array<{ table: string; column: string; value: any }> = [];
const queryCalls: Array<{ table: string; method: string; column?: string; value?: any }> = [];

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => useAuthMock()
}));

vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => fromMock(table),
    rpc: (...args: any[]) => rpcMock(...args),
    functions: {
      invoke: (...args: any[]) => functionsInvokeMock(...args)
    },
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
  })),
  upsert: vi.fn((payload: any) => {
    upsertCalls.push({ table, payload });
    return Promise.resolve({ error: null });
  })
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
  simulator_trade_in_values: [],
  simulator_trade_in_adjustments: [],
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
    range: vi.fn(() => query),
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
    upsert: vi.fn((payload: any) => {
      upsertCalls.push({ table, payload });
      return Promise.resolve({ error: null });
    }),
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

const saleFullRpcRow = (sale: Sale) => ({
  id: sale.id,
  customer_id: sale.customerId,
  seller_id: sale.sellerId,
  store_id: sale.storeId,
  total: sale.total,
  discount: sale.discount,
  discount_type: sale.discountType || null,
  discount_percent: sale.discountPercent ?? null,
  original_subtotal: sale.originalSubtotal ?? sale.items.reduce((acc, item) => acc + Number(item.originalSellPrice ?? item.sellPrice), 0),
  negotiated_subtotal: sale.negotiatedSubtotal ?? sale.items.reduce((acc, item) => acc + Number(item.sellPrice), 0),
  trade_in_value: sale.tradeInValue,
  trade_in_id: null,
  date: sale.date,
  warranty_expires_at: sale.warrantyExpiresAt,
  client_payment_amount: sale.clientPaymentAmount ?? null,
  client_payment_mode: sale.clientPaymentMode ?? null,
  client_payment_account: sale.clientPaymentAccount ?? null,
  client_payment_method: sale.clientPaymentMethod ?? null,
  client_payment_notes: sale.clientPaymentNotes ?? null,
  client_payment_due_date: sale.clientPaymentDueDate ?? null,
  sale_items: sale.items.map((item) => ({
    id: `si-${item.id}`,
    sale_id: sale.id,
    stock_item_id: item.id,
    price: item.sellPrice,
    original_price: item.originalSellPrice ?? item.sellPrice,
    stock_item: {
      id: item.id,
      type: item.type,
      model: item.model,
      color: item.color,
      capacity: item.capacity,
      imei: item.imei,
      condition: item.condition,
      status: StockStatus.SOLD,
      store_id: item.storeId,
      purchase_price: item.purchasePrice,
      sell_price: item.sellPrice,
      max_discount: item.maxDiscount,
      warranty_type: item.warrantyType,
      warranty_end: item.warrantyEnd ?? null,
      entry_date: item.entryDate,
      photos: [],
      costs: []
    }
  })),
  payment_methods: sale.paymentMethods.map((payment, index) => ({
    id: `pm-${index + 1}`,
    sale_id: sale.id,
    type: payment.type,
    amount: payment.amount,
    account: payment.account ?? null,
    installments: payment.installments ?? null,
    card_brand: payment.cardBrand ?? null,
    customer_amount: payment.customerAmount ?? null,
    fee_rate: payment.feeRate ?? null,
    fee_amount: payment.feeAmount ?? null,
    debt_due_date: payment.debtDueDate ?? null,
    debt_installments: payment.debtInstallments ?? null,
    debt_notes: payment.debtNotes ?? null
  })),
  sale_trade_in_items: (sale.tradeIns || []).map((tradeIn) => ({
    id: tradeIn.id,
    sale_id: sale.id,
    stock_item_id: tradeIn.stockItemId ?? null,
    model: tradeIn.model,
    capacity: tradeIn.capacity ?? null,
    color: tradeIn.color ?? null,
    imei: tradeIn.imei ?? null,
    condition: tradeIn.condition ?? null,
    received_value: tradeIn.receivedValue
  }))
});

const saleFullRpcRowFromPayload = (payload: any) => ({
  id: payload.id,
  customer_id: payload.customerId,
  seller_id: payload.sellerId,
  store_id: payload.storeId,
  total: payload.total,
  discount: payload.discount,
  discount_type: payload.discountType,
  discount_percent: payload.discountPercent,
  original_subtotal: payload.originalSubtotal,
  negotiated_subtotal: payload.negotiatedSubtotal,
  trade_in_value: (payload.tradeIns || []).reduce((acc: number, tradeIn: any) => acc + Number(tradeIn.receivedValue || 0), 0),
  trade_in_id: payload.tradeIns?.[0]?.stockSnapshot ? payload.tradeIns[0].stockSnapshot.id : payload.tradeIns?.[0]?.stockItemId ?? null,
  date: payload.date,
  warranty_expires_at: payload.warrantyExpiresAt,
  client_payment_amount: payload.clientPayment?.amount || null,
  client_payment_mode: payload.clientPayment?.mode || null,
  client_payment_account: payload.clientPayment?.account || null,
  client_payment_method: payload.clientPayment?.method || null,
  client_payment_notes: payload.clientPayment?.notes || null,
  client_payment_due_date: payload.clientPayment?.dueDate || null,
  sale_items: (payload.items || []).map((item: any) => ({
    id: `si-${item.stockItemId}`,
    sale_id: payload.id,
    stock_item_id: item.stockItemId,
    price: item.price,
    original_price: item.originalPrice,
    stock_item: {
      id: item.stockItemId,
      type: DeviceType.IPHONE,
      model: 'iPhone vendido via RPC',
      color: 'Preto',
      capacity: '256 GB',
      imei: 'rpc-imei',
      condition: Condition.USED,
      status: StockStatus.SOLD,
      store_id: payload.storeId,
      purchase_price: 0,
      sell_price: item.price,
      max_discount: 0,
      warranty_type: WarrantyType.STORE,
      warranty_end: item.warrantyExpiresAt,
      entry_date: payload.date,
      photos: [],
      costs: []
    }
  })),
  payment_methods: (payload.paymentMethods || []).map((payment: any, index: number) => ({
    id: `pm-${index + 1}`,
    sale_id: payload.id,
    type: payment.type,
    amount: payment.amount,
    account: payment.account,
    installments: payment.installments,
    card_brand: payment.cardBrand,
    customer_amount: payment.customerAmount,
    fee_rate: payment.feeRate,
    fee_amount: payment.feeAmount,
    debt_due_date: payment.debtDueDate,
    debt_installments: payment.debtInstallments,
    debt_notes: payment.debtNotes
  })),
  sale_trade_in_items: (payload.tradeIns || []).map((tradeIn: any) => ({
    id: tradeIn.id,
    sale_id: payload.id,
    stock_item_id: tradeIn.stockSnapshot ? tradeIn.stockSnapshot.id : tradeIn.stockItemId,
    model: tradeIn.model,
    capacity: tradeIn.capacity,
    color: tradeIn.color,
    imei: tradeIn.imei,
    condition: tradeIn.condition,
    received_value: tradeIn.receivedValue
  }))
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

function AddSaleAfterLoadStateProbe({ sale, onDone }: { sale: Sale; onDone: (error?: unknown) => void }) {
  const {
    loading,
    sales,
    transactions,
    debts,
    payableDebts,
    stock,
    addSale,
    ensureSalesHistoryLoaded,
    ensureFinanceLoaded
  } = useData();
  const didRunRef = useRef(false);
  const [groupsReady, setGroupsReady] = useState(false);

  useEffect(() => {
    if (loading || groupsReady) return;
    void Promise.all([ensureSalesHistoryLoaded(), ensureFinanceLoaded()])
      .then(() => setGroupsReady(true));
  }, [ensureFinanceLoaded, ensureSalesHistoryLoaded, groupsReady, loading]);

  useEffect(() => {
    if (loading || !groupsReady || didRunRef.current) return;
    didRunRef.current = true;
    addSale(sale).then(() => onDone()).catch(onDone);
  }, [addSale, groupsReady, loading, onDone, sale]);

  return (
    <div>
      <span data-testid="sale-count">{sales.length}</span>
      <span data-testid="transaction-count">{transactions.length}</span>
      <span data-testid="debt-count">{debts.length}</span>
      <span data-testid="payable-debt-count">{payableDebts.length}</span>
      <span data-testid="sold-stock-status">{stock.find((item) => item.id === sale.items[0]?.id)?.status || 'missing'}</span>
    </div>
  );
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function RemoveTransactionOnLoad({ onDone }: { onDone: (error?: unknown) => void }) {
  const {
    loading,
    removeTransaction,
    transactions,
    payableDebtPayments,
    payableDebts,
    ensureFinanceLoaded
  } = useData();
  const didRunRef = useRef(false);
  const [financeReady, setFinanceReady] = useState(false);

  useEffect(() => {
    if (loading || financeReady) return;
    void ensureFinanceLoaded().then(() => setFinanceReady(true));
  }, [ensureFinanceLoaded, financeReady, loading]);

  useEffect(() => {
    if (loading || !financeReady || didRunRef.current) return;
    didRunRef.current = true;
    removeTransaction('trx-payable-1').then(() => onDone()).catch(onDone);
  }, [financeReady, loading, onDone, removeTransaction]);

  return (
    <div>
      <span data-testid="transaction-count">{transactions.length}</span>
      <span data-testid="payable-payment-count">{payableDebtPayments.length}</span>
      <span data-testid="payable-debt-status">{payableDebts[0]?.status || 'missing'}</span>
      <span data-testid="payable-debt-remaining">{payableDebts[0]?.remainingAmount ?? 'missing'}</span>
    </div>
  );
}

function GuardedTransactionMutationsOnLoad({ onDone }: { onDone: (errors: unknown[]) => void }) {
  const {
    loading,
    removeTransaction,
    updateTransaction,
    transactions,
    ensureFinanceLoaded
  } = useData();
  const didRunRef = useRef(false);
  const [financeReady, setFinanceReady] = useState(false);

  useEffect(() => {
    if (loading || financeReady) return;
    void ensureFinanceLoaded().then(() => setFinanceReady(true));
  }, [ensureFinanceLoaded, financeReady, loading]);

  useEffect(() => {
    if (loading || !financeReady || didRunRef.current) return;
    didRunRef.current = true;
    void (async () => {
      const errors: unknown[] = [];
      await removeTransaction('trx-sale-guard').catch((error) => errors.push(error));
      await updateTransaction('trx-sale-guard', {
        type: 'IN',
        category: 'Venda',
        amount: 999,
        date: '2026-07-01T12:00:00.000Z',
        description: 'edit',
        account: 'Conta Bancária'
      }).catch((error) => errors.push(error));
      await removeTransaction('trx-deposit-guard').catch((error) => errors.push(error));
      onDone(errors);
    })();
  }, [financeReady, loading, onDone, removeTransaction, updateTransaction]);

  return <span data-testid="transaction-count">{transactions.length}</span>;
}

function AddPayableDebtPaymentAfterLoad({ onDone }: { onDone: (error?: unknown) => void }) {
  const {
    loading,
    addPayableDebtPayment,
    transactions,
    payableDebtPayments,
    payableDebts,
    ensureFinanceLoaded
  } = useData();
  const didRunRef = useRef(false);
  const [financeReady, setFinanceReady] = useState(false);

  useEffect(() => {
    if (loading || financeReady) return;
    void ensureFinanceLoaded().then(() => setFinanceReady(true));
  }, [ensureFinanceLoaded, financeReady, loading]);

  useEffect(() => {
    if (loading || !financeReady || didRunRef.current) return;
    didRunRef.current = true;
    addPayableDebtPayment({
      payableDebtId: 'pdbt-focus-payment-1',
      amount: 10,
      paymentMethod: 'Pix',
      account: 'Conta Bancária',
      paidAt: '2026-05-17T12:00:00.000Z'
    }).then(() => onDone()).catch(onDone);
  }, [addPayableDebtPayment, financeReady, loading, onDone]);

  return (
    <div>
      <span data-testid="transaction-count">{transactions.length}</span>
      <span data-testid="payable-payment-count">{payableDebtPayments.length}</span>
      <span data-testid="payable-debt-status">{payableDebts[0]?.status || 'missing'}</span>
    </div>
  );
}

function RemoveSaleOnLoad({ onDone }: { onDone: (error?: unknown) => void }) {
  const { loading, removeSale, sales, ensureSalesHistoryLoaded } = useData();
  const didRunRef = useRef(false);
  const [salesReady, setSalesReady] = useState(false);

  useEffect(() => {
    if (loading || salesReady) return;
    void ensureSalesHistoryLoaded().then(() => setSalesReady(true));
  }, [ensureSalesHistoryLoaded, loading, salesReady]);

  useEffect(() => {
    if (loading || !salesReady || didRunRef.current) return;
    didRunRef.current = true;
    removeSale('sale-cancel-1').then(() => onDone()).catch(onDone);
  }, [loading, onDone, removeSale, salesReady]);

  return <span data-testid="sale-count">{sales.length}</span>;
}

function AddStockAfterLoad({ item, onDone }: { item: any; onDone: (error?: unknown) => void }) {
  const { loading, stock, addStockItem } = useData();
  const didRunRef = useRef(false);

  useEffect(() => {
    if (loading || didRunRef.current) return;
    didRunRef.current = true;
    addStockItem(item).then(() => onDone()).catch(onDone);
  }, [addStockItem, item, loading, onDone]);

  return <span data-testid="stock-count">{stock.length}</span>;
}

function ReserveStockAfterLoad({ stockItemId, onDone }: { stockItemId: string; onDone: (error?: unknown) => void }) {
  const { loading, reserveStockItem, stock } = useData();
  const didRunRef = useRef(false);

  useEffect(() => {
    if (loading || didRunRef.current) return;
    didRunRef.current = true;
    reserveStockItem(stockItemId, {
      customerName: 'Cliente Reserva',
      customerPhone: '88999990000',
      expiresAt: '2026-06-20',
      depositAmount: 100,
      depositPaymentMethod: 'Pix',
      notes: 'Sinal confirmado'
    }).then(() => onDone()).catch(onDone);
  }, [loading, onDone, reserveStockItem, stockItemId]);

  const reservedItem = stock.find((item) => item.id === stockItemId);
  return (
    <span data-testid="reserved-deposit-transaction">
      {reservedItem?.reservation?.depositTransactionId || 'none'}
    </span>
  );
}

function ReleaseReservationAfterLoad({
  stockItemId,
  refundDeposit,
  onDone
}: {
  stockItemId: string;
  refundDeposit?: boolean;
  onDone: (error?: unknown) => void;
}) {
  const { loading, releaseStockReservation } = useData();
  const didRunRef = useRef(false);

  useEffect(() => {
    if (loading || didRunRef.current) return;
    didRunRef.current = true;
    releaseStockReservation(stockItemId, { refundDeposit }).then(() => onDone()).catch(onDone);
  }, [loading, onDone, refundDeposit, releaseStockReservation, stockItemId]);

  return null;
}

function UpdateSaleAfterLoad({
  saleId,
  updates,
  onDone
}: {
  saleId: string;
  updates: Partial<Sale>;
  onDone: (error?: unknown) => void;
}) {
  const { loading, updateSale, ensureSalesHistoryLoaded } = useData();
  const didRunRef = useRef(false);
  const [salesReady, setSalesReady] = useState(false);

  useEffect(() => {
    if (loading || salesReady) return;
    void ensureSalesHistoryLoaded().then(() => setSalesReady(true));
  }, [ensureSalesHistoryLoaded, loading, salesReady]);

  useEffect(() => {
    if (loading || !salesReady || didRunRef.current) return;
    didRunRef.current = true;
    updateSale(saleId, updates).then(() => onDone()).catch(onDone);
  }, [loading, onDone, saleId, salesReady, updateSale, updates]);

  return <span data-testid="loading-state">{loading ? 'loading' : 'idle'}</span>;
}

function DataLoadProbe() {
  const {
    loading,
    salesHistoryLoading,
    financeLoading,
    businessProfile,
    cardFeeSettings,
    customers,
    sellers,
    stores,
    deviceCatalog,
    sales,
    transactions,
    debts,
    debtPayments,
    payableDebts,
    payableDebtPayments,
    stock,
    costHistory,
    partsInventory,
    financialCategories,
    creditors
    , simulatorTradeInValues
    , simulatorTradeInAdjustments
    , ensureSalesHistoryLoaded
    , ensureFinanceLoaded
  } = useData();
  const [groupsRequested, setGroupsRequested] = useState(false);

  useEffect(() => {
    if (loading || groupsRequested) return;
    setGroupsRequested(true);
    void ensureSalesHistoryLoaded();
    void ensureFinanceLoaded();
  }, [ensureFinanceLoaded, ensureSalesHistoryLoaded, groupsRequested, loading]);

  const legacyLoading = loading || !groupsRequested || salesHistoryLoading || financeLoading;

  return (
    <div>
      <span data-testid="loading-state">{legacyLoading ? 'loading' : 'idle'}</span>
      <span data-testid="business-profile-name">{businessProfile.name}</span>
      <span data-testid="card-fee-debit-rate">{cardFeeSettings.debitRate}</span>
      <span data-testid="customer-count">{customers.length}</span>
      <span data-testid="seller-count">{sellers.length}</span>
      <span data-testid="store-count">{stores.length}</span>
      <span data-testid="device-catalog-count">{deviceCatalog.length}</span>
      <span data-testid="sales-count">{sales.length}</span>
      <span data-testid="first-sale-items-count">{sales[0]?.items.length ?? 0}</span>
      <span data-testid="first-sale-payments-count">{sales[0]?.paymentMethods.length ?? 0}</span>
      <span data-testid="first-sale-trade-ins-count">{sales[0]?.tradeIns?.length ?? 0}</span>
      <span data-testid="transaction-count">{transactions.length}</span>
      <span data-testid="debt-count">{debts.length}</span>
      <span data-testid="debt-payment-count">{debtPayments.length}</span>
      <span data-testid="first-debt-status">{debts[0]?.status || 'missing'}</span>
      <span data-testid="payable-debt-count">{payableDebts.length}</span>
      <span data-testid="payable-payment-count">{payableDebtPayments.length}</span>
      <span data-testid="first-payable-debt-status">{payableDebts[0]?.status || 'missing'}</span>
      <span data-testid="stock-count">{stock.length}</span>
      <span data-testid="sold-stock-status">{stock.find((item) => item.id === 'stock-sold-1')?.status || 'missing'}</span>
      <span data-testid="cost-history-count">{costHistory.length}</span>
      <span data-testid="parts-count">{partsInventory.length}</span>
      <span data-testid="first-cost-history-count">{costHistory[0]?.count ?? 'missing'}</span>
      <span data-testid="finance-category-count">{financialCategories.length}</span>
      <span data-testid="creditor-count">{creditors.length}</span>
      <span data-testid="first-finance-category-name">{financialCategories[0]?.name || 'missing'}</span>
      <span data-testid="simulator-value-count">{simulatorTradeInValues.length}</span>
      <span data-testid="first-simulator-value">{simulatorTradeInValues[0]?.baseValue ?? 'missing'}</span>
      <span data-testid="simulator-adjustment-count">{simulatorTradeInAdjustments.length}</span>
      <span data-testid="first-simulator-adjustment">{simulatorTradeInAdjustments[0]?.amountDelta ?? 'missing'}</span>
    </div>
  );
}

function DataGroupProbe() {
  const {
    loading,
    salesHistoryLoading,
    financeLoading,
    sales,
    transactions,
    ensureSalesHistoryLoaded,
    ensureFinanceLoaded,
    refreshData
  } = useData();

  return (
    <div>
      <span data-testid="loading-state">{loading ? 'loading' : 'idle'}</span>
      <span data-testid="sales-history-loading">{salesHistoryLoading ? 'loading' : 'idle'}</span>
      <span data-testid="finance-loading">{financeLoading ? 'loading' : 'idle'}</span>
      <span data-testid="sales-count">{sales.length}</span>
      <span data-testid="transaction-count">{transactions.length}</span>
      <button type="button" onClick={() => void ensureSalesHistoryLoaded()}>
        Carregar vendas
      </button>
      <button type="button" onClick={() => void ensureFinanceLoaded()}>
        Carregar financeiro
      </button>
      <button type="button" onClick={() => void refreshData()}>
        Atualizar tudo
      </button>
    </div>
  );
}

function DataContractProbe({ onValue }: { onValue: (value: ReturnType<typeof useData>) => void }) {
  const value = useData();

  useEffect(() => {
    onValue(value);
  }, [onValue, value]);

  return null;
}

function UpdateBusinessProfileOnLoad({ onDone }: { onDone: () => void }) {
  const { loading, updateBusinessProfile } = useData();
  const didRun = useRef(false);

  useEffect(() => {
    if (loading || didRun.current) return;
    didRun.current = true;
    void updateBusinessProfile({
      name: 'iPhone Repasse',
      cnpj: '',
      phone: '',
      email: '',
      address: '',
      instagram: '',
      businessHours: {
        mon: { open: '09:00', close: '22:00' },
        tue: { open: '09:00', close: '22:00' },
        wed: { open: '09:00', close: '22:00' },
        thu: { open: '09:00', close: '22:00' },
        fri: { open: '09:00', close: '22:00' },
        sat: { open: '09:00', close: '22:00' },
        sun: { open: '14:00', close: '20:00' },
      },
      specialBusinessHours: {
        '2026-04-03': {
          closed: true,
          label: 'Páscoa',
        },
      },
    }).then(onDone);
  }, [loading, onDone, updateBusinessProfile]);

  return null;
}

const countTableSelects = (table: string) =>
  queryCalls.filter((call) => call.table === table && call.method === 'select').length;

describe('DataProvider addSale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channelStatusRef.current = null;
    insertCalls.length = 0;
    upsertCalls.length = 0;
    deleteCalls.length = 0;
    queryCalls.length = 0;
    rpcMock.mockImplementation((fn: string, params: any) => Promise.resolve({
      data: fn === 'create_sale_full' ? saleFullRpcRowFromPayload(params.p_payload) : null,
      error: null
    }));
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      role: 'seller'
    });
    fromMock.mockImplementation(createQuery);
  });

  it('creates a PDV sale through the transactional create_sale_full RPC', async () => {
    const onDone = vi.fn();
    const sale = saleWithDraftTradeIn();
    rpcMock.mockResolvedValueOnce({
      data: saleFullRpcRow(sale),
      error: null
    });

    render(
      <DataProvider>
        <AddSaleAfterLoad sale={sale} onDone={onDone} />
      </DataProvider>
    );

    await waitFor(() => expect(onDone).toHaveBeenCalledWith());

    expect(rpcMock).toHaveBeenCalledWith('create_sale_full', expect.objectContaining({
      p_payload: expect.objectContaining({
        id: 'sale-test-1',
        customerId: 'cust-1',
        sellerId: 'seller-1',
        paymentMethods: expect.any(Array),
        tradeIns: expect.any(Array)
      })
    }));
    expect(insertCalls.some((call) => ['sales', 'sale_items', 'payment_methods'].includes(call.table))).toBe(false);
  });

  it('fires the sales-notify push after a sale is created (US-014)', async () => {
    const onDone = vi.fn();
    const sale = saleWithDraftTradeIn();
    rpcMock.mockResolvedValueOnce({
      data: saleFullRpcRow(sale),
      error: null
    });

    render(
      <DataProvider>
        <AddSaleAfterLoad sale={sale} onDone={onDone} />
      </DataProvider>
    );

    await waitFor(() => expect(onDone).toHaveBeenCalledWith());

    await waitFor(() => expect(functionsInvokeMock).toHaveBeenCalledWith(
      'sales-notify',
      expect.objectContaining({
        body: expect.objectContaining({ sale_id: 'sale-test-1' })
      })
    ));
  });

  it('does not fail addSale when the sales-notify dispatch throws', async () => {
    const onDone = vi.fn();
    const sale = saleWithDraftTradeIn();
    rpcMock.mockResolvedValueOnce({
      data: saleFullRpcRow(sale),
      error: null
    });
    functionsInvokeMock.mockImplementationOnce(() => {
      throw new Error('functions unavailable');
    });

    render(
      <DataProvider>
        <AddSaleAfterLoad sale={sale} onDone={onDone} />
      </DataProvider>
    );

    await waitFor(() => expect(onDone).toHaveBeenCalledWith());
  });

  it('allows addSale for a sale fully covered by trade-in with no financial payment methods', async () => {
    const onDone = vi.fn();
    const sale: Sale = {
      ...saleWithDraftTradeIn(),
      id: 'sale-zero-total-1',
      total: 0,
      tradeInValue: 390,
      paymentMethods: []
    };
    rpcMock.mockResolvedValueOnce({
      data: saleFullRpcRow(sale),
      error: null
    });

    render(
      <DataProvider>
        <AddSaleAfterLoad sale={sale} onDone={onDone} />
      </DataProvider>
    );

    await waitFor(() => expect(onDone).toHaveBeenCalledWith());

    expect(rpcMock).toHaveBeenCalledWith('create_sale_full', expect.objectContaining({
      p_payload: expect.objectContaining({
        id: 'sale-zero-total-1',
        total: 0,
        paymentMethods: []
      })
    }));
  });

  it('does not send draft trade-in stock id on the sales row before stock exists', async () => {
    const onDone = vi.fn();

    render(
      <DataProvider>
        <AddSaleOnMount sale={saleWithDraftTradeIn()} onDone={onDone} />
      </DataProvider>
    );

    await waitFor(() => expect(onDone).toHaveBeenCalledWith());

    const payload = rpcMock.mock.calls[0][1].p_payload;
    expect(rpcMock).toHaveBeenCalledWith('create_sale_full', expect.any(Object));
    expect(payload.tradeIns[0]).toEqual(expect.objectContaining({
      stockItemId: 'trade-draft-1',
      stockSnapshot: expect.objectContaining({ id: 'trade-draft-1' })
    }));
    expect(insertCalls.filter((call) => call.table === 'sales')).toHaveLength(0);
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

  it('creates draft trade-in stock before linking sale trade-in rows', async () => {
    const onDone = vi.fn();
    render(
      <DataProvider>
        <AddSaleOnMount sale={saleWithDraftTradeIn()} onDone={onDone} />
      </DataProvider>
    );

    await waitFor(() => expect(onDone).toHaveBeenCalledWith());
    expect(rpcMock).toHaveBeenCalledWith('create_sale_full', expect.objectContaining({
      p_payload: expect.objectContaining({
        tradeIns: expect.arrayContaining([
          expect.objectContaining({
            stockSnapshot: expect.objectContaining({ id: 'trade-draft-1' })
          })
        ])
      })
    }));
    expect(insertCalls.some((call) => call.table === 'stock_items' || call.table === 'sale_trade_in_items')).toBe(false);
  });

  it('hydrates sale financial and stock side effects without waiting for the global refresh', async () => {
    const onDone = vi.fn();
    const sale = {
      ...saleWithDraftTradeIn(),
      id: 'sale-finance-1',
      tradeIns: [],
      tradeInValue: 0,
      total: 390,
      paymentMethods: [{ type: 'Devedor' as const, amount: 390, account: 'Conta Bancária' as const }]
    };
    const blockedGlobalSalesRefresh = createDeferred<{ data: any[]; error: null }>();
    let salesSelectCount = 0;
    const sideEffectRows: Record<string, any[]> = {
      transactions: [
        {
          id: 'trx-sale-finance-1',
          type: 'IN',
          category: 'Venda',
          amount: 390,
          date: sale.date,
          description: 'Venda #FINANCE1',
          account: 'Conta Bancária',
          sale_id: sale.id,
          debt_payment_id: null,
          payable_debt_payment_id: null,
          payable_debt_id: null
        }
      ],
      debts: [
        {
          id: 'debt-sale-finance-1',
          customer_id: sale.customerId,
          sale_id: sale.id,
          original_amount: 390,
          remaining_amount: 390,
          status: 'Aberta',
          due_date: null,
          first_due_date: null,
          installments_total: 1,
          notes: null,
          source: 'sale',
          created_at: sale.date,
          updated_at: sale.date
        }
      ],
      payable_debts: []
    };

    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      role: 'admin'
    });
    initialRowsByTable.stores = [{ id: 'store-1', name: 'Sobral', city: 'Sobral' }];
    initialRowsByTable.customers = [
      {
        id: 'cust-1',
        name: 'Cliente Teste',
        cpf: null,
        phone: '88999999999',
        email: null,
        birth_date: null,
        purchases: 0,
        total_spent: 0
      }
    ];
    initialRowsByTable.sellers = [{ id: 'seller-1', name: 'Vendedor', email: null, auth_user_id: null, store_id: 'store-1', total_sales: 0 }];
    initialRowsByTable.stock_items = [
      {
        id: 'stock-sold-1',
        type: DeviceType.IPHONE,
        model: 'iPhone 15 Pro Max',
        color: 'Titanio Preto',
        capacity: '256 GB',
        imei: '351503401283245',
        condition: Condition.USED,
        status: StockStatus.AVAILABLE,
        store_id: 'store-1',
        purchase_price: 4200,
        sell_price: 5390,
        max_discount: 0,
        warranty_type: WarrantyType.STORE,
        warranty_end: null,
        entry_date: '2026-04-20',
        photos: [],
        costs: []
      }
    ];
    initialRowsByTable.sales = [];
    initialRowsByTable.transactions = [];
    initialRowsByTable.debts = [];
    initialRowsByTable.payable_debts = [];

    fromMock.mockImplementation((table: string) => {
      if (table === 'sales') {
        const query: any = createAdminQuery(table);
        query.insert = vi.fn((payload: any) => {
          insertCalls.push({ table, payload });
          return {
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: { ...payload, id: payload.id }, error: null })
            }))
          };
        });
        query.select = vi.fn(() => {
          queryCalls.push({ table, method: 'select' });
          salesSelectCount += 1;
          return query;
        });
        query.then = (resolve: any, reject: any) => {
          if (salesSelectCount > 1) return blockedGlobalSalesRefresh.promise.then(resolve, reject);
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        };
        query.catch = (reject: any) => {
          if (salesSelectCount > 1) return blockedGlobalSalesRefresh.promise.catch(reject);
          return Promise.resolve({ data: [], error: null }).catch(reject);
        };
        query.finally = (onFinally: any) => {
          if (salesSelectCount > 1) return blockedGlobalSalesRefresh.promise.finally(onFinally);
          return Promise.resolve({ data: [], error: null }).finally(onFinally);
        };
        return query;
      }

      if (table === 'transactions' || table === 'debts' || table === 'payable_debts') {
        const filters: Record<string, any> = {};
        const listResponse = () => ({
          data: filters.sale_id === sale.id ? sideEffectRows[table] : [],
          error: null
        });
        const query: any = {
          select: vi.fn(() => {
            queryCalls.push({ table, method: 'select' });
            return query;
          }),
          order: vi.fn(() => query),
          range: vi.fn(() => query),
          limit: vi.fn(() => Promise.resolve(listResponse())),
          eq: vi.fn((column: string, value: any) => {
            filters[column] = value;
            queryCalls.push({ table, method: 'eq', column, value });
            return query;
          }),
          insert: vi.fn(() => Promise.resolve({ error: null })),
          then: (resolve: any, reject: any) => Promise.resolve(listResponse()).then(resolve, reject),
          catch: (reject: any) => Promise.resolve(listResponse()).catch(reject),
          finally: (onFinally: any) => Promise.resolve(listResponse()).finally(onFinally)
        };
        return query;
      }

      return createAdminQuery(table);
    });

    render(
      <DataProvider>
        <AddSaleAfterLoadStateProbe sale={sale} onDone={onDone} />
      </DataProvider>
    );

    await waitFor(() => expect(onDone).toHaveBeenCalledWith());
    await waitFor(() => expect(screen.getByTestId('sale-count')).toHaveTextContent('1'));
    await waitFor(() => expect(screen.getByTestId('transaction-count')).toHaveTextContent('1'));
    expect(screen.getByTestId('debt-count')).toHaveTextContent('1');
    expect(screen.getByTestId('payable-debt-count')).toHaveTextContent('0');
    expect(screen.getByTestId('sold-stock-status')).toHaveTextContent(StockStatus.SOLD);
    expect(queryCalls).toContainEqual({ table: 'transactions', method: 'eq', column: 'sale_id', value: sale.id });
    expect(queryCalls).toContainEqual({ table: 'debts', method: 'eq', column: 'sale_id', value: sale.id });
  });
});

describe('DataProvider stock operations', () => {
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
    initialRowsByTable.stock_items = [];
    fromMock.mockImplementation(createAdminQuery);
  });

  it('does not duplicate stock when realtime insert arrives before addStockItem finishes', async () => {
    const onDone = vi.fn();
    const stockRow = {
      id: 'stk-dedupe-1',
      type: DeviceType.IPHONE,
      model: 'iPhone 15',
      color: 'Preto',
      has_box: false,
      capacity: '128 GB',
      imei: 'imei-dedupe-1',
      condition: Condition.USED,
      status: StockStatus.AVAILABLE,
      sim_type: 'Physical',
      battery_health: 90,
      store_id: 'store-1',
      purchase_price: 3000,
      sell_price: 3900,
      max_discount: 0,
      warranty_type: WarrantyType.STORE,
      warranty_end: null,
      origin: 'Manual',
      notes: '',
      observations: '',
      entry_date: '2026-05-13',
      photos: [],
      costs: []
    };
    let finalFetchTriggeredRealtime = false;

    initialRowsByTable.stores = [{ id: 'store-1', name: 'Sobral', city: 'Sobral' }];

    fromMock.mockImplementation((table: string) => {
      if (table !== 'stock_items') return createAdminQuery(table);

      const query: any = createAdminQuery(table);
      query.insert = vi.fn((payload: any) => {
        insertCalls.push({ table, payload });
        return {
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { ...stockRow, ...payload }, error: null })
          }))
        };
      });
      query.eq = vi.fn((column: string, value: any) => {
        queryCalls.push({ table, method: 'eq', column, value });
        return query;
      });
      query.single = vi.fn(async () => {
        if (!finalFetchTriggeredRealtime) {
          finalFetchTriggeredRealtime = true;
          const stockHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'stock_items')?.[2] as
            | ((payload: any) => Promise<void>)
            | undefined;
          await stockHandler?.({ eventType: 'INSERT', new: { id: stockRow.id } });
        }
        return { data: stockRow, error: null };
      });
      return query;
    });

    render(
      <DataProvider>
        <AddStockAfterLoad
          item={{
            id: stockRow.id,
            type: DeviceType.IPHONE,
            model: stockRow.model,
            color: stockRow.color,
            capacity: stockRow.capacity,
            imei: stockRow.imei,
            condition: Condition.USED,
            status: StockStatus.AVAILABLE,
            batteryHealth: 90,
            storeId: stockRow.store_id,
            purchasePrice: stockRow.purchase_price,
            sellPrice: stockRow.sell_price,
            maxDiscount: 0,
            warrantyType: WarrantyType.STORE,
            origin: 'Manual',
            costs: [],
            photos: [],
            entryDate: stockRow.entry_date
          }}
          onDone={onDone}
        />
      </DataProvider>
    );

    await waitFor(() => expect(onDone).toHaveBeenCalledWith());
    await waitFor(() => expect(screen.getByTestId('stock-count')).toHaveTextContent('1'));
  });

  it('reserves a stock item through the transactional reservation RPC', async () => {
    const onDone = vi.fn();
    const stockRow = {
      id: 'stk-reserve-rpc-1',
      type: DeviceType.IPHONE,
      model: 'iPhone 16',
      color: 'Preto',
      has_box: false,
      capacity: '128 GB',
      imei: 'imei-reserve-rpc-1',
      condition: Condition.USED,
      status: StockStatus.AVAILABLE,
      sim_type: 'Physical',
      battery_health: 94,
      store_id: 'store-1',
      purchase_price: 4000,
      sell_price: 4900,
      max_discount: 0,
      warranty_type: WarrantyType.STORE,
      warranty_end: null,
      origin: 'Manual',
      notes: '',
      observations: '',
      entry_date: '2026-06-12',
      photos: [],
      costs: []
    };

    initialRowsByTable.stores = [{ id: 'store-1', name: 'Sobral', city: 'Sobral' }];
    initialRowsByTable.stock_items = [stockRow];
    rpcMock.mockResolvedValueOnce({
      data: {
        id: 'res-rpc-1',
        stock_item_id: stockRow.id,
        customer_name: 'Cliente Reserva',
        customer_phone: '88999990000',
        reserved_at: '2026-06-12T12:00:00.000Z',
        expires_at: '2026-06-20T00:00:00.000Z',
        deposit_amount: 100,
        deposit_payment_method: 'Pix',
        notes: 'Sinal confirmado',
        status: 'active',
        released_at: null,
        sold_at: null,
        created_at: '2026-06-12T12:00:00.000Z',
        updated_at: '2026-06-12T12:00:00.000Z'
      },
      error: null
    });

    render(
      <DataProvider>
        <ReserveStockAfterLoad stockItemId={stockRow.id} onDone={onDone} />
      </DataProvider>
    );

    await waitFor(() => expect(onDone).toHaveBeenCalledWith());

    expect(rpcMock).toHaveBeenCalledWith('reserve_stock_item', {
      p_stock_item_id: stockRow.id,
      p_payload: {
        customerName: 'Cliente Reserva',
        customerPhone: '88999990000',
        expiresAt: '2026-06-20',
        depositAmount: 100,
        depositPaymentMethod: 'Pix',
        notes: 'Sinal confirmado'
      }
    });
    expect(insertCalls.some((call) => call.table === 'stock_reservations')).toBe(false);
    expect(queryCalls.some((call) => call.table === 'stock_items' && call.method === 'eq' && call.column === 'id' && call.value === stockRow.id)).toBe(false);
  });

  it('maps reservation finance fields returned by reserve_stock_item', async () => {
    const onDone = vi.fn();
    const stockRow = {
      id: 'stk-reserve-finance-1',
      type: DeviceType.IPHONE,
      model: 'iPhone 15 Pro',
      color: 'Azul',
      has_box: false,
      capacity: '256 GB',
      imei: 'imei-reserve-finance-1',
      condition: Condition.USED,
      status: StockStatus.AVAILABLE,
      sim_type: 'Physical',
      battery_health: 91,
      store_id: 'store-1',
      purchase_price: 4500,
      sell_price: 5600,
      max_discount: 0,
      warranty_type: WarrantyType.STORE,
      warranty_end: null,
      origin: 'Manual',
      notes: '',
      observations: '',
      entry_date: '2026-06-30',
      photos: [],
      costs: []
    };

    initialRowsByTable.stores = [{ id: 'store-1', name: 'Sobral', city: 'Sobral' }];
    initialRowsByTable.stock_items = [stockRow];
    rpcMock.mockResolvedValueOnce({
      data: {
        id: 'res-finance-1',
        stock_item_id: stockRow.id,
        customer_name: 'Cliente Reserva',
        customer_phone: '88999990000',
        reserved_at: '2026-06-30T10:00:00.000Z',
        expires_at: null,
        deposit_amount: 100,
        deposit_payment_method: 'Pix',
        deposit_transaction_id: 'trx-deposit-1',
        deposit_refund_transaction_id: null,
        deposit_refunded_at: null,
        deposit_retained_at: null,
        sold_sale_id: null,
        notes: 'Sinal confirmado',
        status: 'active',
        released_at: null,
        sold_at: null,
        created_at: '2026-06-30T10:00:00.000Z',
        updated_at: '2026-06-30T10:00:00.000Z'
      },
      error: null
    });

    render(
      <DataProvider>
        <ReserveStockAfterLoad stockItemId={stockRow.id} onDone={onDone} />
      </DataProvider>
    );

    await waitFor(() => expect(onDone).toHaveBeenCalledWith());
    expect(screen.getByTestId('reserved-deposit-transaction')).toHaveTextContent('trx-deposit-1');
  });

  it('releases a reservation through the transactional release_stock_reservation RPC', async () => {
    const onDone = vi.fn();
    const stockRow = {
      id: 'stk-release-rpc-1',
      type: DeviceType.IPHONE,
      model: 'iPhone 15 Reservado',
      color: 'Preto',
      has_box: false,
      capacity: '128 GB',
      imei: 'imei-release-rpc-1',
      condition: Condition.USED,
      status: StockStatus.RESERVED,
      sim_type: 'Physical',
      battery_health: 88,
      store_id: 'store-1',
      purchase_price: 3000,
      sell_price: 3900,
      max_discount: 0,
      warranty_type: WarrantyType.STORE,
      warranty_end: null,
      origin: 'Manual',
      notes: '',
      observations: '',
      entry_date: '2026-06-30',
      photos: [],
      costs: []
    };

    initialRowsByTable.stores = [{ id: 'store-1', name: 'Sobral', city: 'Sobral' }];
    initialRowsByTable.stock_items = [stockRow];
    initialRowsByTable.stock_reservations = [{
      id: 'res-release-rpc-1',
      stock_item_id: stockRow.id,
      customer_name: 'Cliente Reserva',
      customer_phone: '88999990000',
      reserved_at: '2026-06-30T10:00:00.000Z',
      expires_at: null,
      deposit_amount: 100,
      deposit_payment_method: 'Pix',
      deposit_transaction_id: 'trx-deposit-1',
      deposit_refund_transaction_id: null,
      deposit_refunded_at: null,
      deposit_retained_at: null,
      sold_sale_id: null,
      notes: null,
      status: 'active',
      released_at: null,
      sold_at: null,
      created_at: '2026-06-30T10:00:00.000Z',
      updated_at: '2026-06-30T10:00:00.000Z'
    }];
    rpcMock.mockResolvedValueOnce({
      data: {
        ...initialRowsByTable.stock_reservations[0],
        status: 'released',
        released_at: '2026-06-30T12:00:00.000Z',
        deposit_refund_transaction_id: 'trx-refund-1',
        deposit_refunded_at: '2026-06-30T12:00:00.000Z'
      },
      error: null
    });

    render(
      <DataProvider>
        <ReleaseReservationAfterLoad stockItemId={stockRow.id} refundDeposit onDone={onDone} />
      </DataProvider>
    );

    await waitFor(() => expect(onDone).toHaveBeenCalledWith());

    expect(rpcMock).toHaveBeenCalledWith('release_stock_reservation', {
      p_stock_item_id: stockRow.id,
      p_refund_deposit: true
    });
    expect(queryCalls.some((call) => call.table === 'stock_items' && call.method === 'eq' && call.column === 'id' && call.value === stockRow.id)).toBe(false);
  });
});

describe('DataProvider updateSale', () => {
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
    fromMock.mockImplementation(createAdminQuery);
  });

  it('updates a trade-in-covered sale with no financial payment methods through update_sale_full', async () => {
    const onDone = vi.fn();
    const soldStockRow = {
      id: 'stock-edit-zero-1',
      type: DeviceType.IPHONE,
      model: 'iPhone 15',
      color: 'Preto',
      capacity: '128 GB',
      imei: 'imei-edit-zero-1',
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
    };
    const saleRow = {
      id: 'sale-edit-zero-1',
      customer_id: 'cust-1',
      seller_id: 'seller-1',
      store_id: 'store-1',
      total: 390,
      discount: 0,
      trade_in_value: 0,
      trade_in_id: null,
      date: '2026-05-13T10:00:00.000Z',
      warranty_expires_at: null,
      sale_items: [{
        id: 'si-edit-zero-1',
        stock_item_id: soldStockRow.id,
        price: 390,
        original_price: 390,
        stock_item: soldStockRow
      }],
      payment_methods: [{ id: 'pm-edit-zero-1', type: 'Pix', amount: 390, account: 'Conta Bancária' }],
      sale_trade_in_items: []
    };
    const updatedSale: Sale = {
      id: saleRow.id,
      customerId: 'cust-1',
      sellerId: 'seller-1',
      storeId: 'store-1',
      items: [{
        id: soldStockRow.id,
        type: DeviceType.IPHONE,
        model: 'iPhone 15',
        color: 'Preto',
        capacity: '128 GB',
        imei: 'imei-edit-zero-1',
        condition: Condition.USED,
        status: StockStatus.SOLD,
        storeId: 'store-1',
        purchasePrice: 3000,
        sellPrice: 390,
        maxDiscount: 0,
        warrantyType: WarrantyType.STORE,
        costs: [],
        photos: [],
        entryDate: '2026-05-13'
      }],
      tradeIns: [{
        id: 'sti-zero-update-1',
        model: 'iPhone Trade',
        capacity: '128 GB',
        color: 'Preto',
        imei: 'trade-imei',
        condition: Condition.USED,
        receivedValue: 390
      }],
      tradeInValue: 390,
      discount: 0,
      total: 0,
      paymentMethods: [],
      date: saleRow.date,
      warrantyExpiresAt: null
    };

    initialRowsByTable.stores = [{ id: 'store-1', name: 'Sobral', city: 'Sobral' }];
    initialRowsByTable.customers = [{
      id: 'cust-1',
      name: 'Cliente Teste',
      cpf: null,
      phone: '',
      email: null,
      birth_date: null,
      purchases: 1,
      total_spent: 390
    }];
    initialRowsByTable.sellers = [{ id: 'seller-1', name: 'Vendedor', email: null, auth_user_id: null, store_id: 'store-1', total_sales: 390 }];
    initialRowsByTable.stock_items = [soldStockRow];
    initialRowsByTable.sales = [saleRow];

    rpcMock.mockResolvedValueOnce({
      data: saleFullRpcRow(updatedSale),
      error: null
    });

    render(
      <DataProvider>
        <UpdateSaleAfterLoad
          saleId={saleRow.id}
          updates={{
            total: 0,
            tradeInValue: 390,
            tradeIns: updatedSale.tradeIns,
            paymentMethods: []
          }}
          onDone={onDone}
        />
      </DataProvider>
    );

    await waitFor(() => expect(onDone).toHaveBeenCalledWith());

    expect(rpcMock).toHaveBeenCalledWith('update_sale_full', expect.objectContaining({
      p_sale_id: saleRow.id,
      p_payload: expect.objectContaining({
        total: 0,
        paymentMethods: []
      })
    }));
  });

  it('creates a stock item when sale edit adds an unlinked trade-in', async () => {
    const onDone = vi.fn();
    const soldStockRow = {
      id: 'stock-edit-sold-1',
      type: DeviceType.IPHONE,
      model: 'iPhone 15',
      color: 'Preto',
      capacity: '128 GB',
      imei: 'imei-edit-sold-1',
      condition: Condition.USED,
      status: StockStatus.SOLD,
      store_id: 'store-1',
      purchase_price: 3000,
      sell_price: 4200,
      max_discount: 0,
      warranty_type: WarrantyType.STORE,
      warranty_end: null,
      entry_date: '2026-05-13',
      photos: [],
      costs: []
    };
    const saleRow = {
      id: 'sale-edit-trade-1',
      customer_id: 'cust-1',
      seller_id: 'seller-1',
      store_id: 'store-1',
      total: 3200,
      discount: 0,
      trade_in_value: 0,
      trade_in_id: null,
      date: '2026-05-13T10:00:00.000Z',
      warranty_expires_at: null,
      sale_items: [{
        id: 'si-edit-1',
        stock_item_id: soldStockRow.id,
        price: 4200,
        original_price: 4200,
        stock_item: soldStockRow
      }],
      payment_methods: [{ id: 'pm-edit-1', type: 'Pix', amount: 4200, account: 'Conta Bancária' }],
      sale_trade_in_items: []
    };

    initialRowsByTable.stores = [{ id: 'store-1', name: 'Sobral', city: 'Sobral' }];
    initialRowsByTable.customers = [{
      id: 'cust-1',
      name: 'Cliente Teste',
      cpf: null,
      phone: '',
      email: null,
      birth_date: null,
      purchases: 1,
      total_spent: 4200
    }];
    initialRowsByTable.sellers = [{ id: 'seller-1', name: 'Vendedor', email: null, auth_user_id: null, store_id: 'store-1', total_sales: 4200 }];
    initialRowsByTable.stock_items = [soldStockRow];
    initialRowsByTable.sales = [saleRow];
    initialRowsByTable.debts = [];

    fromMock.mockImplementation((table: string) => {
      const query: any = createAdminQuery(table);

      if (table === 'transactions' || table === 'debts' || table === 'payable_debts') {
        return query;
      }

      if (table === 'sale_items') {
        query.select = vi.fn(() => query);
        query.eq = vi.fn(() => Promise.resolve({ data: [{ stock_item_id: soldStockRow.id }], error: null }));
        query.delete = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
        query.insert = vi.fn((rows: any[]) => {
          insertCalls.push({ table, payload: rows });
          return Promise.resolve({ error: null });
        });
        return query;
      }

      if (table === 'debts') {
        query.select = vi.fn(() => query);
        query.eq = vi.fn(() => Promise.resolve({ data: [], error: null }));
        query.delete = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
        return query;
      }

      if (table === 'debt_payments') {
        query.delete = vi.fn(() => ({ in: vi.fn().mockResolvedValue({ error: null }) }));
        return query;
      }

      if (table === 'transactions' || table === 'payment_methods') {
        query.delete = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
        query.insert = vi.fn((payload: any) => {
          insertCalls.push({ table, payload });
          return Promise.resolve({ error: null });
        });
        return query;
      }

      if (table === 'sale_trade_in_items') {
        query.delete = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
        query.insert = vi.fn((rows: any[]) => {
          insertCalls.push({ table, payload: rows });
          return Promise.resolve({ error: null });
        });
        return query;
      }

      if (table === 'stock_items') {
        query.insert = vi.fn((rows: any) => {
          insertCalls.push({ table, payload: rows });
          return Promise.resolve({ error: null });
        });
        query.update = vi.fn(() => ({ in: vi.fn().mockResolvedValue({ error: null }) }));
        return query;
      }

      if (table === 'customers') {
        query.select = vi.fn(() => query);
        query.eq = vi.fn(() => query);
        query.single = vi.fn().mockResolvedValue({ data: { purchases: 1, total_spent: 4200 }, error: null });
        query.update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
        return query;
      }

      if (table === 'sellers') {
        query.select = vi.fn(() => query);
        query.eq = vi.fn(() => query);
        query.single = vi.fn().mockResolvedValue({ data: { total_sales: 4200 }, error: null });
        query.update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
        return query;
      }

      return query;
    });
    rpcMock.mockImplementation((fn: string, params: any) => Promise.resolve({
      data: fn === 'update_sale_full' ? saleFullRpcRowFromPayload(params.p_payload) : null,
      error: null
    }));

    render(
      <DataProvider>
        <UpdateSaleAfterLoad
          saleId={saleRow.id}
          updates={{
            total: 3200,
            tradeInValue: 1000,
            tradeIns: [{
              id: 'sti-edit-new-1',
              model: 'iPhone 12',
              capacity: '64 GB',
              color: 'Branco',
              imei: 'imei-edit-trade-1',
              condition: Condition.USED,
              receivedValue: 1000
            }],
            paymentMethods: [{ type: 'Pix', amount: 3200, account: 'Conta Bancária' }]
          }}
          onDone={onDone}
        />
      </DataProvider>
    );

    await waitFor(() => expect(onDone).toHaveBeenCalledWith());

    expect(rpcMock).toHaveBeenCalledWith('update_sale_full', expect.objectContaining({
      p_sale_id: saleRow.id,
      p_payload: expect.objectContaining({
        tradeIns: expect.arrayContaining([
          expect.objectContaining({
            stockItemId: null,
            stockSnapshot: null,
            model: 'iPhone 12',
            imei: 'imei-edit-trade-1',
            receivedValue: 1000
          })
        ])
      })
    }));
    expect(insertCalls.some((call) => call.table === 'stock_items' || call.table === 'sale_trade_in_items')).toBe(false);
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

  it('removes the canceled sale locally without waiting for a full refresh', async () => {
    const onDone = vi.fn();
    const blockedSalesRefresh = createDeferred<{ data: any[]; error: null }>();
    let salesSelectCount = 0;

    fromMock.mockImplementation((table: string) => {
      if (table === 'sales') {
        const query: any = createAdminQuery(table);
        query.select = vi.fn(() => {
          queryCalls.push({ table, method: 'select' });
          salesSelectCount += 1;
          return query;
        });
        query.then = (resolve: any, reject: any) => {
          if (salesSelectCount > 1) {
            return blockedSalesRefresh.promise.then(resolve, reject);
          }
          return Promise.resolve({ data: initialRowsByTable.sales, error: null }).then(resolve, reject);
        };
        query.catch = (reject: any) => {
          if (salesSelectCount > 1) return blockedSalesRefresh.promise.catch(reject);
          return Promise.resolve({ data: initialRowsByTable.sales, error: null }).catch(reject);
        };
        query.finally = (onFinally: any) => {
          if (salesSelectCount > 1) return blockedSalesRefresh.promise.finally(onFinally);
          return Promise.resolve({ data: initialRowsByTable.sales, error: null }).finally(onFinally);
        };
        return query;
      }

      return createAdminQuery(table);
    });

    render(
      <DataProvider>
        <RemoveSaleOnLoad onDone={onDone} />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('sale-count')).toHaveTextContent('0'));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith());
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
    initialRowsByTable.transactions = [
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
    ];
    initialRowsByTable.payable_debts = [payableDebtBeforeReversal];
    initialRowsByTable.payable_debt_payments = [
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
    ];
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
    await waitFor(() => expect(screen.getByTestId('payable-payment-count')).toHaveTextContent('0'));
    expect(screen.getByTestId('payable-debt-status')).toHaveTextContent('Aberta');
    expect(screen.getByTestId('payable-debt-remaining')).toHaveTextContent('100');
    expect(queryCalls).toContainEqual({ table: 'payable_debts', method: 'eq', column: 'id', value: 'pdbt-1' });
  });

  it('blocks editing or canceling sale-generated and reservation-deposit transactions', async () => {
    initialRowsByTable.transactions = [
      {
        id: 'trx-sale-guard',
        type: 'IN',
        category: 'Venda',
        amount: 2000,
        date: '2026-07-01T12:00:00.000Z',
        description: 'Venda (Pix) - Cliente',
        account: 'Cofre',
        sale_id: 'sale-guard-1',
        debt_payment_id: null,
        payable_debt_payment_id: null
      },
      {
        id: 'trx-deposit-guard',
        type: 'IN',
        category: 'Adiantamento de reserva',
        amount: 300,
        date: '2026-07-01T12:00:00.000Z',
        description: 'Adiantamento de reserva - Cliente',
        account: 'Cofre',
        sale_id: null,
        debt_payment_id: null,
        payable_debt_payment_id: null
      }
    ];
    initialRowsByTable.payable_debts = [];
    initialRowsByTable.payable_debt_payments = [];

    const onDone = vi.fn();

    render(
      <DataProvider>
        <GuardedTransactionMutationsOnLoad onDone={onDone} />
      </DataProvider>
    );

    await waitFor(() => expect(onDone).toHaveBeenCalled());

    const errors = onDone.mock.calls[0][0] as Error[];
    expect(errors).toHaveLength(3);
    expect(String(errors[0])).toContain('gerado por uma venda');
    expect(String(errors[1])).toContain('gerado por uma venda');
    expect(String(errors[2])).toContain('sinal de uma reserva');

    // Nenhuma mutação chegou ao banco: nem RPC de cancelamento, nem update.
    expect(rpcMock).not.toHaveBeenCalledWith('cancel_transaction', expect.anything());
    expect(screen.getByTestId('transaction-count')).toHaveTextContent('2');
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
    initialRowsByTable.business_profile = [];
    initialRowsByTable.card_fee_settings = [];
    initialRowsByTable.simulator_trade_in_values = [];
    initialRowsByTable.simulator_trade_in_adjustments = [];
    initialRowsByTable.stores = [];
    initialRowsByTable.sales = [];
    initialRowsByTable.stock_items = [];
    initialRowsByTable.sellers = [];
    initialRowsByTable.debts = [];
    initialRowsByTable.debt_payments = [];
    initialRowsByTable.transactions = [];
    initialRowsByTable.payable_debts = [];
    initialRowsByTable.payable_debt_payments = [];
    initialRowsByTable.creditors = [];
    initialRowsByTable.cost_history = [];
    initialRowsByTable.finance_categories = [];
    initialRowsByTable.device_catalog = [];
    initialRowsByTable.parts_inventory = [];
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

  it('preserves the public useData contract during provider refactoring', async () => {
    const onValue = vi.fn();
    const requiredKeys = [
      'businessProfile',
      'stock',
      'customers',
      'sales',
      'transactions',
      'loading',
      'refreshData',
      'ensureSalesHistoryLoaded',
      'ensureFinanceLoaded',
      'addSale',
      'updateSale',
      'removeSale',
      'transferBetweenAccounts',
      'addStockItem',
      'updateStockItem',
      'removeStockItem'
    ];

    render(
      <DataProvider>
        <DataContractProbe onValue={onValue} />
      </DataProvider>
    );

    await waitFor(() => {
      const latestValue = onValue.mock.calls.at(-1)?.[0] as ReturnType<typeof useData> | undefined;
      expect(latestValue?.loading).toBe(false);
      expect(Object.keys(latestValue || {})).toEqual(expect.arrayContaining(requiredKeys));
    });
  });

  it('clears loaded groups after authentication is removed', async () => {
    initialRowsByTable.sales = [{
      id: 'sale-auth-reset-1',
      customer_id: 'cust-1',
      seller_id: 'seller-1',
      store_id: 'store-1',
      date: '2026-05-01T10:00:00.000Z',
      total: 1000,
      payment_method: 'Pix',
      warranty_months: 3,
      warranty_expires_at: null,
      state: 'completed',
      sale_items: [],
      payment_methods: [],
      sale_trade_in_items: [],
      customer: null,
      seller: null
    }];
    initialRowsByTable.transactions = [{
      id: 'trx-auth-reset-1',
      type: 'IN',
      category: 'Venda',
      amount: 1000,
      date: '2026-05-01T10:00:00.000Z',
      description: 'Venda',
      account: 'Conta Bancária',
      sale_id: 'sale-auth-reset-1',
      debt_payment_id: null,
      payable_debt_payment_id: null
    }];
    initialRowsByTable.debts = [{
      id: 'debt-auth-reset-1',
      sale_id: 'sale-auth-reset-1',
      customer_id: 'cust-1',
      original_amount: 100,
      remaining_amount: 100,
      status: 'Pendente',
      due_date: null,
      created_at: '2026-05-01T10:00:00.000Z'
    }];
    initialRowsByTable.payable_debts = [{
      ...payableDebtBeforeReversal,
      id: 'payable-auth-reset-1'
    }];

    const { rerender } = render(
      <DataProvider>
        <DataLoadProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));
    expect(screen.getByTestId('sales-count')).toHaveTextContent('1');
    expect(screen.getByTestId('transaction-count')).toHaveTextContent('1');
    expect(screen.getByTestId('debt-count')).toHaveTextContent('1');
    expect(screen.getByTestId('payable-debt-count')).toHaveTextContent('1');

    useAuthMock.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      role: null
    });
    rerender(
      <DataProvider>
        <DataLoadProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('sales-count')).toHaveTextContent('0'));
    expect(screen.getByTestId('transaction-count')).toHaveTextContent('0');
    expect(screen.getByTestId('debt-count')).toHaveTextContent('0');
    expect(screen.getByTestId('payable-debt-count')).toHaveTextContent('0');
    expect(screen.getByTestId('loading-state')).toHaveTextContent('idle');
  });

  it('removes the realtime channel on unmount', async () => {
    const { unmount } = render(
      <DataProvider>
        <DataGroupProbe />
      </DataProvider>
    );

    await waitFor(() => expect(channelSubscribeMock).toHaveBeenCalledTimes(1));
    unmount();

    expect(removeChannelMock).toHaveBeenCalledTimes(1);
  });

  it('subscribes to the complete realtime table contract', async () => {
    render(
      <DataProvider>
        <DataGroupProbe />
      </DataProvider>
    );

    await waitFor(() => expect(channelSubscribeMock).toHaveBeenCalledTimes(1));

    const registeredTables = channelOnMock.mock.calls.map((call) => call[1]?.table);
    expect(registeredTables).toEqual([
      'business_profile',
      'card_fee_settings',
      'simulator_trade_in_values',
      'simulator_trade_in_adjustments',
      'sale_items',
      'payment_methods',
      'sale_trade_in_items',
      'sales',
      'transactions',
      'debts',
      'debt_payments',
      'stock_items',
      'stock_reservations',
      'customers',
      'sellers',
      'stores',
      'costs',
      'parts_inventory',
      'device_catalog',
      'cost_history',
      'finance_categories',
      'creditors',
      'payable_debts',
      'payable_debt_payments'
    ]);
  });

  it('applies realtime deletion events across shell and finance catalogs', async () => {
    initialRowsByTable.stock_items = [{
      id: 'stock-delete-1',
      type: DeviceType.IPHONE,
      model: 'iPhone 15',
      color: 'Preto',
      capacity: '128 GB',
      imei: 'stock-delete-1',
      condition: Condition.USED,
      status: StockStatus.AVAILABLE,
      store_id: 'store-delete-1',
      purchase_price: 3000,
      sell_price: 4000,
      max_discount: 0,
      warranty_type: WarrantyType.STORE,
      entry_date: '2026-05-01',
      photos: [],
      costs: []
    }];
    initialRowsByTable.customers = [{
      id: 'customer-delete-1',
      name: 'Cliente',
      cpf: null,
      phone: null,
      email: null,
      birth_date: null,
      purchases: 0,
      total_spent: 0
    }];
    initialRowsByTable.sellers = [{
      id: 'seller-delete-1',
      name: 'Vendedor',
      email: null,
      auth_user_id: null,
      store_id: 'store-delete-1',
      total_sales: 0
    }];
    initialRowsByTable.stores = [{ id: 'store-delete-1', name: 'Loja', city: 'Fortaleza' }];
    initialRowsByTable.parts_inventory = [{
      id: 'part-delete-1',
      name: 'Tela',
      quantity: 1,
      unit_cost: 100,
      created_at: '2026-05-01',
      updated_at: '2026-05-01'
    }];
    initialRowsByTable.device_catalog = [{
      id: 'device-delete-1',
      type: DeviceType.IPHONE,
      model: 'iPhone 15',
      color: 'Preto'
    }];
    initialRowsByTable.cost_history = [{
      id: 'cost-delete-1',
      model: 'iPhone 15',
      description: 'Tela',
      amount: 100,
      count: 1,
      last_used: '2026-05-01'
    }];
    initialRowsByTable.finance_categories = [{
      id: 'category-delete-1',
      name: 'Venda',
      type: 'IN',
      is_default: false,
      created_at: '2026-05-01'
    }];
    initialRowsByTable.creditors = [{
      id: 'creditor-delete-1',
      name: 'Fornecedor',
      created_at: '2026-05-01',
      updated_at: '2026-05-01'
    }];

    render(
      <DataProvider>
        <DataLoadProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));
    const deleteRows = [
      ['stock_items', 'stock-delete-1'],
      ['customers', 'customer-delete-1'],
      ['sellers', 'seller-delete-1'],
      ['stores', 'store-delete-1'],
      ['parts_inventory', 'part-delete-1'],
      ['device_catalog', 'device-delete-1'],
      ['cost_history', 'cost-delete-1'],
      ['finance_categories', 'category-delete-1'],
      ['creditors', 'creditor-delete-1']
    ] as const;

    act(() => {
      deleteRows.forEach(([table, id]) => {
        const handler = channelOnMock.mock.calls.find((call) => call[1]?.table === table)?.[2];
        handler?.({ eventType: 'DELETE', old: { id } });
      });
    });

    [
      'stock-count',
      'customer-count',
      'seller-count',
      'store-count',
      'parts-count',
      'device-catalog-count',
      'cost-history-count',
      'finance-category-count',
      'creditor-count'
    ].forEach((testId) => expect(screen.getByTestId(testId)).toHaveTextContent('0'));
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

  it('starts independent table reads in parallel during global refresh', async () => {
    const blockedProfile = createDeferred<{ data: null; error: null }>();
    let profileReadCount = 0;
    let salesSelectCount = 0;

    fromMock.mockImplementation((table: string) => {
      if (table === 'business_profile') {
        const query: any = createAdminQuery(table);
        query.single = vi.fn(() => {
          profileReadCount += 1;
          return profileReadCount > 1
            ? blockedProfile.promise
            : Promise.resolve({ data: null, error: null });
        });
        return query;
      }

      if (table === 'sales') {
        const query: any = createAdminQuery(table);
        query.select = vi.fn(() => {
          queryCalls.push({ table, method: 'select' });
          salesSelectCount += 1;
          return query;
        });
        return query;
      }

      return createAdminQuery(table);
    });

    render(
      <DataProvider>
        <DataGroupProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));

    act(() => {
      screen.getByRole('button', { name: 'Atualizar tudo' }).click();
    });

    await waitFor(() => expect(salesSelectCount).toBeGreaterThan(0));

    await act(async () => {
      blockedProfile.resolve({ data: null, error: null });
      await blockedProfile.promise;
    });
  });

  it('does not request sales history or finance during authenticated bootstrap', async () => {
    render(
      <DataProvider>
        <DataGroupProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));

    expect(countTableSelects('sales')).toBe(0);
    expect(countTableSelects('transactions')).toBe(0);
    expect(countTableSelects('debts')).toBe(0);
    expect(screen.getByTestId('sales-count')).toHaveTextContent('0');
    expect(screen.getByTestId('transaction-count')).toHaveTextContent('0');
  });

  it('loads sales history and finance only when explicitly requested', async () => {
    initialRowsByTable.sales = [{
      id: 'sale-demand-1',
      customer_id: 'cust-1',
      seller_id: 'seller-1',
      store_id: 'store-1',
      date: '2026-05-01T10:00:00.000Z',
      total: 1000,
      payment_method: 'Pix',
      warranty_months: 3,
      warranty_expires_at: null,
      state: 'completed',
      sale_items: [],
      payment_methods: [],
      sale_trade_in_items: [],
      customer: null,
      seller: null
    }];
    initialRowsByTable.transactions = [{
      id: 'trx-demand-1',
      type: 'IN',
      category: 'Venda',
      amount: 1000,
      date: '2026-05-01T10:00:00.000Z',
      description: 'Venda',
      account: 'Conta Bancária',
      sale_id: 'sale-demand-1',
      debt_payment_id: null,
      payable_debt_payment_id: null
    }];

    render(
      <DataProvider>
        <DataGroupProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));

    act(() => {
      screen.getByRole('button', { name: 'Carregar vendas' }).click();
    });
    await waitFor(() => expect(screen.getByTestId('sales-count')).toHaveTextContent('1'));

    act(() => {
      screen.getByRole('button', { name: 'Carregar financeiro' }).click();
    });
    await waitFor(() => expect(screen.getByTestId('transaction-count')).toHaveTextContent('1'));
  });

  it('keeps refreshData as a complete compatibility refresh', async () => {
    render(
      <DataProvider>
        <DataGroupProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));

    act(() => {
      screen.getByRole('button', { name: 'Atualizar tudo' }).click();
    });

    await waitFor(() => expect(countTableSelects('sales')).toBeGreaterThan(0));
    expect(countTableSelects('transactions')).toBeGreaterThan(0);
    expect(countTableSelects('debts')).toBeGreaterThan(0);
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

  it('applies realtime updates for singleton business profile data', async () => {
    initialRowsByTable.business_profile = [{
      id: '1',
      name: 'iPhoneRepasse',
      cnpj: '',
      phone: '',
      email: '',
      address: '',
      instagram: '',
      logo_url: null,
      primary_color: null
    }];

    render(
      <DataProvider>
        <DataLoadProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));
    expect(screen.getByTestId('business-profile-name')).toHaveTextContent('iPhoneRepasse');

    const profileHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'business_profile')?.[2] as
      | ((payload: any) => void)
      | undefined;

    expect(profileHandler).toBeTypeOf('function');

    act(() => {
      profileHandler?.({
        eventType: 'UPDATE',
        new: {
          id: '1',
          name: 'Hospital dos iPhones',
          cnpj: '',
          phone: '',
          email: '',
          address: '',
          instagram: '',
          logo_url: null,
          primary_color: null
        }
      });
    });

    await waitFor(() => expect(screen.getByTestId('business-profile-name')).toHaveTextContent('Hospital dos iPhones'));
  });

  it('applies realtime updates for card fee settings', async () => {
    initialRowsByTable.card_fee_settings = [{
      id: 'default',
      visa_master_rates: {},
      other_rates: {},
      debit_rate: 1.5
    }];

    render(
      <DataProvider>
        <DataLoadProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));
    expect(screen.getByTestId('card-fee-debit-rate')).toHaveTextContent('1.5');

    const cardFeeHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'card_fee_settings')?.[2] as
      | ((payload: any) => void)
      | undefined;

    expect(cardFeeHandler).toBeTypeOf('function');

    act(() => {
      cardFeeHandler?.({
        eventType: 'UPDATE',
        new: {
          id: 'default',
          visa_master_rates: {},
          other_rates: {},
          debit_rate: 2.25
        }
      });
    });

    await waitFor(() => expect(screen.getByTestId('card-fee-debit-rate')).toHaveTextContent('2.25'));
  });

  it('loads simulator trade-in settings for CRM simulations', async () => {
    initialRowsByTable.simulator_trade_in_values = [{
      id: 'value-1',
      model: 'iPhone 15 Pro Max',
      capacity: '256GB',
      base_value: 4100,
      is_active: true,
      created_at: '2026-05-28T12:00:00.000Z',
      updated_at: '2026-05-28T12:00:00.000Z'
    }];
    initialRowsByTable.simulator_trade_in_adjustments = [{
      id: 'adj-1',
      label: 'Marcas de uso na lateral',
      model: 'iPhone 15 Pro Max',
      capacity: null,
      amount_delta: -500,
      is_active: true,
      created_at: '2026-05-28T12:00:00.000Z',
      updated_at: '2026-05-28T12:00:00.000Z'
    }];

    render(
      <DataProvider>
        <DataLoadProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));
    expect(screen.getByTestId('simulator-value-count')).toHaveTextContent('1');
    expect(screen.getByTestId('first-simulator-value')).toHaveTextContent('4100');
    expect(screen.getByTestId('simulator-adjustment-count')).toHaveTextContent('1');
    expect(screen.getByTestId('first-simulator-adjustment')).toHaveTextContent('-500');
  });

  it('applies realtime changes for cost history rows', async () => {
    initialRowsByTable.cost_history = [{
      id: 'costh-1',
      model: 'iPhone 15',
      description: 'Tela',
      amount: 100,
      count: 1,
      last_used: '2026-05-13T10:00:00.000Z'
    }];

    render(
      <DataProvider>
        <DataLoadProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));
    expect(screen.getByTestId('first-cost-history-count')).toHaveTextContent('1');

    const costHistoryHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'cost_history')?.[2] as
      | ((payload: any) => void)
      | undefined;

    expect(costHistoryHandler).toBeTypeOf('function');

    act(() => {
      costHistoryHandler?.({
        eventType: 'UPDATE',
        new: {
          id: 'costh-1',
          model: 'iPhone 15',
          description: 'Tela',
          amount: 120,
          count: 2,
          last_used: '2026-05-13T11:00:00.000Z'
        }
      });
    });

    await waitFor(() => expect(screen.getByTestId('first-cost-history-count')).toHaveTextContent('2'));

    act(() => {
      costHistoryHandler?.({
        eventType: 'DELETE',
        old: { id: 'costh-1' }
      });
    });

    await waitFor(() => expect(screen.getByTestId('cost-history-count')).toHaveTextContent('0'));
  });

  it('applies finance category realtime updates for non-admin authenticated users', async () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      role: 'seller'
    });
    initialRowsByTable.finance_categories = [{
      id: 'fcat-1',
      name: 'Venda',
      type: 'IN',
      is_default: true,
      created_at: '2026-05-13T10:00:00.000Z'
    }];

    render(
      <DataProvider>
        <DataLoadProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));
    expect(screen.getByTestId('first-finance-category-name')).toHaveTextContent('Venda');

    const categoryHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'finance_categories')?.[2] as
      | ((payload: any) => void)
      | undefined;

    expect(categoryHandler).toBeTypeOf('function');

    act(() => {
      categoryHandler?.({
        eventType: 'UPDATE',
        new: {
          id: 'fcat-1',
          name: 'Venda Loja',
          type: 'IN',
          is_default: true,
          created_at: '2026-05-13T10:00:00.000Z'
        }
      });
    });

    await waitFor(() => expect(screen.getByTestId('first-finance-category-name')).toHaveTextContent('Venda Loja'));
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

  it('rehydrates sale payment methods on update and delete events from another device', async () => {
    const saleId = 'sale-payment-methods-realtime-1';
    const baseSale = {
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
      payment_methods: [{ id: 'pm-1', sale_id: saleId, type: 'Pix', amount: 390, account: 'Conta Bancária' }],
      sale_trade_in_items: [],
      customer: initialRowsByTable.customers[0],
      seller: { id: 'seller-1', name: 'LEAD', email: null, auth_user_id: null, store_id: 'store-1', total_sales: 0 }
    };
    const saleWithoutPayments = { ...baseSale, payment_methods: [] };
    let snapshot = baseSale;

    initialRowsByTable.sellers = [baseSale.seller];
    initialRowsByTable.sales = [baseSale];

    fromMock.mockImplementation((table: string) => {
      if (table === 'sales') {
        const query: any = createAdminQuery(table);
        query.single = vi.fn(() => Promise.resolve({ data: snapshot, error: null }));
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
    expect(screen.getByTestId('first-sale-payments-count')).toHaveTextContent('1');

    const paymentMethodsHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'payment_methods')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(paymentMethodsHandler).toBeTypeOf('function');

    await act(async () => {
      await paymentMethodsHandler?.({ eventType: 'UPDATE', new: { id: 'pm-1', sale_id: saleId } });
    });

    expect(screen.getByTestId('first-sale-payments-count')).toHaveTextContent('1');

    snapshot = saleWithoutPayments;
    await act(async () => {
      await paymentMethodsHandler?.({ eventType: 'DELETE', old: { id: 'pm-1', sale_id: saleId } });
    });

    await waitFor(() => expect(screen.getByTestId('first-sale-payments-count')).toHaveTextContent('0'));
  });

  it('rehydrates sale items on update and delete events from another device', async () => {
    const saleId = 'sale-items-realtime-1';
    const stockRow = {
      id: 'stock-sale-items-realtime-1',
      type: DeviceType.IPHONE,
      model: 'iPhone 15',
      color: 'Preto',
      capacity: '128 GB',
      imei: 'imei-sale-items-realtime-1',
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
    };
    const baseSale = {
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
      sale_items: [{ id: 'si-1', sale_id: saleId, stock_item_id: stockRow.id, price: 390, original_price: 390, stock_item: stockRow }],
      payment_methods: [],
      sale_trade_in_items: [],
      customer: initialRowsByTable.customers[0],
      seller: { id: 'seller-1', name: 'LEAD', email: null, auth_user_id: null, store_id: 'store-1', total_sales: 0 }
    };
    const saleWithoutItems = { ...baseSale, sale_items: [] };
    let snapshot = baseSale;

    initialRowsByTable.stock_items = [stockRow];
    initialRowsByTable.sellers = [baseSale.seller];
    initialRowsByTable.sales = [baseSale];

    fromMock.mockImplementation((table: string) => {
      if (table === 'sales') {
        const query: any = createAdminQuery(table);
        query.single = vi.fn(() => Promise.resolve({ data: snapshot, error: null }));
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
    expect(screen.getByTestId('first-sale-items-count')).toHaveTextContent('1');

    const saleItemsHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'sale_items')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(saleItemsHandler).toBeTypeOf('function');

    await act(async () => {
      await saleItemsHandler?.({ eventType: 'UPDATE', new: { id: 'si-1', sale_id: saleId } });
    });

    expect(screen.getByTestId('first-sale-items-count')).toHaveTextContent('1');

    snapshot = saleWithoutItems;
    await act(async () => {
      await saleItemsHandler?.({ eventType: 'DELETE', old: { id: 'si-1', sale_id: saleId } });
    });

    await waitFor(() => expect(screen.getByTestId('first-sale-items-count')).toHaveTextContent('0'));
  });

  it('rehydrates sale trade-ins on insert update and delete events from another device', async () => {
    const saleId = 'sale-trade-ins-realtime-1';
    const baseSale = {
      id: saleId,
      customer_id: 'cust-1',
      seller_id: 'seller-1',
      store_id: 'store-1',
      total: 390,
      discount: 0,
      trade_in_value: 500,
      trade_in_id: null,
      date: '2026-05-13T16:37:57.000Z',
      warranty_expires_at: null,
      sale_items: [],
      payment_methods: [],
      sale_trade_in_items: [],
      customer: initialRowsByTable.customers[0],
      seller: { id: 'seller-1', name: 'LEAD', email: null, auth_user_id: null, store_id: 'store-1', total_sales: 0 }
    };
    const saleWithTradeIn = {
      ...baseSale,
      sale_trade_in_items: [{
        id: 'sti-1',
        sale_id: saleId,
        stock_item_id: null,
        model: 'iPhone 12',
        capacity: '64 GB',
        color: 'Branco',
        imei: 'imei-trade-in-1',
        condition: Condition.USED,
        received_value: 500
      }]
    };
    let snapshot = baseSale;

    initialRowsByTable.sellers = [baseSale.seller];
    initialRowsByTable.sales = [baseSale];

    fromMock.mockImplementation((table: string) => {
      if (table === 'sales') {
        const query: any = createAdminQuery(table);
        query.single = vi.fn(() => Promise.resolve({ data: snapshot, error: null }));
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
    expect(screen.getByTestId('first-sale-trade-ins-count')).toHaveTextContent('0');

    const tradeInsHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'sale_trade_in_items')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(tradeInsHandler).toBeTypeOf('function');

    snapshot = saleWithTradeIn;
    await act(async () => {
      await tradeInsHandler?.({ eventType: 'INSERT', new: { id: 'sti-1', sale_id: saleId } });
    });

    await waitFor(() => expect(screen.getByTestId('first-sale-trade-ins-count')).toHaveTextContent('1'));

    await act(async () => {
      await tradeInsHandler?.({ eventType: 'UPDATE', new: { id: 'sti-1', sale_id: saleId } });
    });

    expect(screen.getByTestId('first-sale-trade-ins-count')).toHaveTextContent('1');

    snapshot = baseSale;
    await act(async () => {
      await tradeInsHandler?.({ eventType: 'DELETE', old: { id: 'sti-1', sale_id: saleId } });
    });

    await waitFor(() => expect(screen.getByTestId('first-sale-trade-ins-count')).toHaveTextContent('0'));
  });

  it('rehydrates sale financial side effects when payment methods arrive on another device', async () => {
    const saleId = 'sale-realtime-financial-1';
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
      payment_methods: [{ id: 'pm-realtime-financial-1', sale_id: saleId, type: 'Devedor', amount: 390, account: 'Conta Bancária' }],
      sale_trade_in_items: [],
      customer: initialRowsByTable.customers[0],
      seller: { id: 'seller-1', name: 'LEAD', email: null, auth_user_id: null, store_id: 'store-1', total_sales: 0 }
    };
    const sideEffectRows: Record<string, any[]> = {
      transactions: [
        {
          id: 'trx-realtime-financial-1',
          type: 'IN',
          category: 'Venda',
          amount: 390,
          date: saleRow.date,
          description: 'Venda realtime',
          account: 'Conta Bancária',
          sale_id: saleId,
          debt_payment_id: null,
          payable_debt_payment_id: null,
          payable_debt_id: null
        }
      ],
      debts: [
        {
          id: 'debt-realtime-financial-1',
          customer_id: 'cust-1',
          sale_id: saleId,
          original_amount: 390,
          remaining_amount: 390,
          status: 'Aberta',
          due_date: null,
          first_due_date: null,
          installments_total: 1,
          notes: null,
          source: 'sale',
          created_at: saleRow.date,
          updated_at: saleRow.date
        }
      ],
      payable_debts: []
    };

    initialRowsByTable.sales = [];
    initialRowsByTable.transactions = [];
    initialRowsByTable.debts = [];
    initialRowsByTable.payable_debts = [];

    fromMock.mockImplementation((table: string) => {
      if (table === 'sales') {
        const query: any = createAdminQuery(table);
        query.eq = vi.fn((column: string, value: any) => {
          queryCalls.push({ table, method: 'eq', column, value });
          return query;
        });
        query.single = vi.fn(() => Promise.resolve({ data: saleRow, error: null }));
        return query;
      }

      if (table === 'transactions' || table === 'debts' || table === 'payable_debts') {
        const filters: Record<string, any> = {};
        const listResponse = () => ({
          data: filters.sale_id === saleId ? sideEffectRows[table] : [],
          error: null
        });
        const query: any = {
          select: vi.fn(() => {
            queryCalls.push({ table, method: 'select' });
            return query;
          }),
          order: vi.fn(() => query),
          range: vi.fn(() => query),
          limit: vi.fn(() => Promise.resolve(listResponse())),
          eq: vi.fn((column: string, value: any) => {
            filters[column] = value;
            queryCalls.push({ table, method: 'eq', column, value });
            return query;
          }),
          then: (resolve: any, reject: any) => Promise.resolve(listResponse()).then(resolve, reject),
          catch: (reject: any) => Promise.resolve(listResponse()).catch(reject),
          finally: (onFinally: any) => Promise.resolve(listResponse()).finally(onFinally)
        };
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

    const paymentMethodsHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'payment_methods')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(paymentMethodsHandler).toBeTypeOf('function');

    await act(async () => {
      await paymentMethodsHandler?.({ eventType: 'INSERT', new: { sale_id: saleId } });
    });

    await waitFor(() => expect(screen.getByTestId('transaction-count')).toHaveTextContent('1'));
    expect(screen.getByTestId('debt-count')).toHaveTextContent('1');
    expect(queryCalls).toContainEqual({ table: 'transactions', method: 'eq', column: 'sale_id', value: saleId });
    expect(queryCalls).toContainEqual({ table: 'debts', method: 'eq', column: 'sale_id', value: saleId });
  });

  it('applies a canceled sale to sales, finance and stock on another device', async () => {
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
    initialRowsByTable.transactions = [
      {
        id: 'trx-sale-cancel-1',
        type: 'IN',
        category: 'Venda',
        amount: 4200,
        date: '2026-04-27T18:00:00.000Z',
        description: 'Venda cancelada',
        account: 'Conta Bancária',
        sale_id: 'sale-cancel-1',
        debt_payment_id: null,
        payable_debt_payment_id: null,
        payable_debt_id: null
      }
    ];
    initialRowsByTable.debts = [
      {
        id: 'debt-sale-cancel-1',
        customer_id: 'cust-1',
        sale_id: 'sale-cancel-1',
        original_amount: 4200,
        remaining_amount: 4200,
        status: 'Aberta',
        due_date: null,
        first_due_date: null,
        installments_total: 1,
        notes: null,
        source: 'sale',
        created_at: '2026-04-27T18:00:00.000Z',
        updated_at: '2026-04-27T18:00:00.000Z'
      }
    ];

    render(
      <DataProvider>
        <DataLoadProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));
    expect(screen.getByTestId('sales-count')).toHaveTextContent('1');
    expect(screen.getByTestId('transaction-count')).toHaveTextContent('1');
    expect(screen.getByTestId('debt-count')).toHaveTextContent('1');
    expect(screen.getByTestId('sold-stock-status')).toHaveTextContent(StockStatus.SOLD);

    const salesHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'sales')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(salesHandler).toBeTypeOf('function');

    await act(async () => {
      await salesHandler?.({ eventType: 'DELETE', old: { id: 'sale-cancel-1' } });
    });

    await waitFor(() => expect(screen.getByTestId('sales-count')).toHaveTextContent('0'));
    expect(screen.getByTestId('transaction-count')).toHaveTextContent('0');
    expect(screen.getByTestId('debt-count')).toHaveTextContent('0');
    expect(screen.getByTestId('sold-stock-status')).toHaveTextContent(StockStatus.AVAILABLE);
  });

  it('removes sale debt payment side effects when a canceled sale is deleted on another device', async () => {
    initialRowsByTable.stock_items = [
      {
        id: 'stock-sale-payment-cancel-1',
        type: DeviceType.IPHONE,
        model: 'iPhone 15',
        color: 'Preto',
        capacity: '128 GB',
        imei: 'imei-sale-payment-cancel-1',
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
        id: 'sale-payment-cancel-1',
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
            id: 'si-payment-cancel-1',
            stock_item_id: 'stock-sale-payment-cancel-1',
            price: 4200,
            original_price: 4200,
            stock_item: initialRowsByTable.stock_items[0]
          }
        ],
        payment_methods: [{ type: 'Devedor', amount: 4200, account: 'Conta Bancária' }],
        sale_trade_in_items: []
      }
    ];
    initialRowsByTable.debts = [
      {
        id: 'debt-sale-payment-cancel-1',
        customer_id: 'cust-1',
        sale_id: 'sale-payment-cancel-1',
        original_amount: 4200,
        remaining_amount: 0,
        status: 'Quitada',
        due_date: null,
        first_due_date: null,
        installments_total: 1,
        notes: null,
        source: 'sale',
        created_at: '2026-04-27T18:00:00.000Z',
        updated_at: '2026-04-27T18:30:00.000Z'
      }
    ];
    initialRowsByTable.debt_payments = [
      {
        id: 'dpm-sale-payment-cancel-1',
        debt_id: 'debt-sale-payment-cancel-1',
        amount: 4200,
        payment_method: 'Pix',
        account: 'Conta Bancária',
        paid_at: '2026-04-27T18:30:00.000Z',
        notes: null,
        created_at: '2026-04-27T18:30:00.000Z'
      }
    ];
    initialRowsByTable.transactions = [
      {
        id: 'trx-sale-payment-cancel-1',
        type: 'IN',
        category: 'Pagamento de dívida',
        amount: 4200,
        date: '2026-04-27T18:30:00.000Z',
        description: 'Pagamento de dívida',
        account: 'Conta Bancária',
        sale_id: null,
        debt_payment_id: 'dpm-sale-payment-cancel-1',
        payable_debt_payment_id: null,
        payable_debt_id: null
      }
    ];

    render(
      <DataProvider>
        <DataLoadProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));
    expect(screen.getByTestId('sales-count')).toHaveTextContent('1');
    expect(screen.getByTestId('debt-count')).toHaveTextContent('1');
    expect(screen.getByTestId('debt-payment-count')).toHaveTextContent('1');
    expect(screen.getByTestId('transaction-count')).toHaveTextContent('1');

    const salesHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'sales')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(salesHandler).toBeTypeOf('function');

    await act(async () => {
      await salesHandler?.({ eventType: 'DELETE', old: { id: 'sale-payment-cancel-1' } });
    });

    await waitFor(() => expect(screen.getByTestId('sales-count')).toHaveTextContent('0'));
    expect(screen.getByTestId('debt-count')).toHaveTextContent('0');
    expect(screen.getByTestId('debt-payment-count')).toHaveTextContent('0');
    expect(screen.getByTestId('transaction-count')).toHaveTextContent('0');
  });

  it('removes sale payable debt payment side effects when a canceled sale is deleted on another device', async () => {
    initialRowsByTable.stock_items = [
      {
        id: 'stock-sale-payable-cancel-1',
        type: DeviceType.IPHONE,
        model: 'iPhone 15',
        color: 'Preto',
        capacity: '128 GB',
        imei: 'imei-sale-payable-cancel-1',
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
        id: 'sale-payable-cancel-1',
        customer_id: 'cust-1',
        seller_id: 'seller-1',
        store_id: 'store-1',
        total: 0,
        discount: 0,
        trade_in_value: 5000,
        trade_in_id: null,
        client_payment_amount: 800,
        client_payment_mode: 'payable_debt',
        date: '2026-04-27T18:00:00.000Z',
        warranty_expires_at: null,
        sale_items: [
          {
            id: 'si-payable-cancel-1',
            stock_item_id: 'stock-sale-payable-cancel-1',
            price: 4200,
            original_price: 4200,
            stock_item: initialRowsByTable.stock_items[0]
          }
        ],
        payment_methods: [],
        sale_trade_in_items: []
      }
    ];
    initialRowsByTable.payable_debts = [
      {
        ...payableDebtBeforeReversal,
        id: 'pdbt-sale-payable-cancel-1',
        sale_id: 'sale-payable-cancel-1',
        remaining_amount: 0,
        status: 'Quitada'
      }
    ];
    initialRowsByTable.payable_debt_payments = [
      {
        id: 'pdpm-sale-payable-cancel-1',
        payable_debt_id: 'pdbt-sale-payable-cancel-1',
        amount: 800,
        payment_method: 'Pix',
        account: 'Conta Bancária',
        paid_at: '2026-04-27T18:30:00.000Z',
        notes: null,
        attachment_path: null,
        attachment_mime: null,
        attachment_name: null,
        attachment_size: null,
        created_at: '2026-04-27T18:30:00.000Z'
      }
    ];
    initialRowsByTable.transactions = [
      {
        id: 'trx-sale-payable-entry-cancel-1',
        type: 'IN',
        category: 'Entrada de dívida ativa',
        amount: 800,
        date: '2026-04-27T18:00:00.000Z',
        description: 'Entrada dívida ativa',
        account: 'Conta Bancária',
        sale_id: null,
        debt_payment_id: null,
        payable_debt_payment_id: null,
        payable_debt_id: 'pdbt-sale-payable-cancel-1'
      },
      {
        id: 'trx-sale-payable-payment-cancel-1',
        type: 'OUT',
        category: 'Pagamento de dívida ativa',
        amount: 800,
        date: '2026-04-27T18:30:00.000Z',
        description: 'Pagamento de dívida ativa',
        account: 'Conta Bancária',
        sale_id: null,
        debt_payment_id: null,
        payable_debt_payment_id: 'pdpm-sale-payable-cancel-1',
        payable_debt_id: null
      }
    ];

    render(
      <DataProvider>
        <DataLoadProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));
    expect(screen.getByTestId('sales-count')).toHaveTextContent('1');
    expect(screen.getByTestId('payable-debt-count')).toHaveTextContent('1');
    expect(screen.getByTestId('payable-payment-count')).toHaveTextContent('1');
    expect(screen.getByTestId('transaction-count')).toHaveTextContent('2');

    const salesHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'sales')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(salesHandler).toBeTypeOf('function');

    await act(async () => {
      await salesHandler?.({ eventType: 'DELETE', old: { id: 'sale-payable-cancel-1' } });
    });

    await waitFor(() => expect(screen.getByTestId('sales-count')).toHaveTextContent('0'));
    expect(screen.getByTestId('payable-debt-count')).toHaveTextContent('0');
    expect(screen.getByTestId('payable-payment-count')).toHaveTextContent('0');
    expect(screen.getByTestId('transaction-count')).toHaveTextContent('0');
  });

  it('applies a payable payment reversal on another device from the transaction delete event', async () => {
    initialRowsByTable.transactions = [
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
    ];
    initialRowsByTable.payable_debts = [payableDebtBeforeReversal];
    initialRowsByTable.payable_debt_payments = [
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
    ];

    render(
      <DataProvider>
        <DataLoadProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));
    expect(screen.getByTestId('transaction-count')).toHaveTextContent('1');
    expect(screen.getByTestId('payable-payment-count')).toHaveTextContent('1');
    expect(screen.getByTestId('first-payable-debt-status')).toHaveTextContent('Quitada');

    const transactionsHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'transactions')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(transactionsHandler).toBeTypeOf('function');

    await act(async () => {
      await transactionsHandler?.({
        eventType: 'DELETE',
        old: {
          id: 'trx-payable-1',
          payable_debt_payment_id: 'pdpm-1'
        }
      });
    });

    await waitFor(() => expect(screen.getByTestId('transaction-count')).toHaveTextContent('0'));
    expect(screen.getByTestId('payable-payment-count')).toHaveTextContent('0');
    expect(screen.getByTestId('first-payable-debt-status')).toHaveTextContent('Aberta');
    expect(queryCalls).toContainEqual({ table: 'payable_debts', method: 'eq', column: 'id', value: 'pdbt-1' });
  });

  it('applies a payable payment reversal when realtime sends only the deleted transaction id', async () => {
    initialRowsByTable.transactions = [
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
    ];
    initialRowsByTable.payable_debts = [payableDebtBeforeReversal];
    initialRowsByTable.payable_debt_payments = [
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
    ];

    render(
      <DataProvider>
        <DataLoadProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));

    const transactionsHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'transactions')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(transactionsHandler).toBeTypeOf('function');

    await act(async () => {
      await transactionsHandler?.({
        eventType: 'DELETE',
        old: { id: 'trx-payable-1' }
      });
    });

    await waitFor(() => expect(screen.getByTestId('transaction-count')).toHaveTextContent('0'));
    expect(screen.getByTestId('payable-payment-count')).toHaveTextContent('0');
    expect(screen.getByTestId('first-payable-debt-status')).toHaveTextContent('Aberta');
    expect(queryCalls).toContainEqual({ table: 'payable_debts', method: 'eq', column: 'id', value: 'pdbt-1' });
  });

  it('applies a receivable payment reversal when realtime sends only the deleted transaction id', async () => {
    const debtBefore = {
      id: 'debt-transaction-delete-1',
      customer_id: 'cust-1',
      sale_id: null,
      original_amount: 390,
      remaining_amount: 0,
      status: 'Quitada',
      due_date: null,
      first_due_date: null,
      installments_total: 1,
      notes: null,
      source: 'manual',
      created_at: '2026-05-13T16:37:57.000Z',
      updated_at: '2026-05-13T16:38:57.000Z'
    };
    const debtAfter = {
      ...debtBefore,
      remaining_amount: 390,
      status: 'Aberta',
      updated_at: '2026-05-13T16:39:57.000Z'
    };
    const paymentRow = {
      id: 'dpm-transaction-delete-1',
      debt_id: debtBefore.id,
      amount: 390,
      payment_method: 'Pix',
      account: 'Conta Bancária',
      paid_at: '2026-05-13T16:38:57.000Z',
      notes: null,
      created_at: '2026-05-13T16:38:57.000Z'
    };
    const transactionRow = {
      id: 'trx-debt-payment-delete-1',
      type: 'IN',
      category: 'Pagamento de dívida',
      amount: 390,
      date: paymentRow.paid_at,
      description: 'Pagamento de dívida',
      account: 'Conta Bancária',
      sale_id: null,
      debt_payment_id: paymentRow.id,
      payable_debt_payment_id: null,
      payable_debt_id: null
    };

    initialRowsByTable.debts = [debtBefore];
    initialRowsByTable.debt_payments = [paymentRow];
    initialRowsByTable.transactions = [transactionRow];

    fromMock.mockImplementation((table: string) => {
      if (table === 'debts') {
        const query: any = createAdminQuery(table);
        query.maybeSingle = vi.fn(() => Promise.resolve({ data: debtAfter, error: null }));
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

    const transactionsHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'transactions')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(transactionsHandler).toBeTypeOf('function');

    await act(async () => {
      await transactionsHandler?.({
        eventType: 'DELETE',
        old: { id: transactionRow.id }
      });
    });

    await waitFor(() => expect(screen.getByTestId('transaction-count')).toHaveTextContent('0'));
    expect(screen.getByTestId('debt-payment-count')).toHaveTextContent('0');
    expect(screen.getByTestId('first-debt-status')).toHaveTextContent('Aberta');
    expect(queryCalls).toContainEqual({ table: 'debts', method: 'eq', column: 'id', value: debtBefore.id });
  });

  it('removes a manual transaction when its delete event has no linked debt ids', async () => {
    initialRowsByTable.transactions = [
      {
        id: 'trx-manual-delete-1',
        type: 'IN',
        category: 'Aporte',
        amount: 150,
        date: '2026-05-13T16:37:57.000Z',
        description: 'Aporte manual',
        account: 'Conta Bancária',
        sale_id: null,
        debt_payment_id: null,
        payable_debt_payment_id: null,
        payable_debt_id: null
      }
    ];

    render(
      <DataProvider>
        <DataLoadProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));
    expect(screen.getByTestId('transaction-count')).toHaveTextContent('1');

    const transactionsHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'transactions')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(transactionsHandler).toBeTypeOf('function');

    await act(async () => {
      await transactionsHandler?.({ eventType: 'DELETE', old: { id: 'trx-manual-delete-1' } });
    });

    await waitFor(() => expect(screen.getByTestId('transaction-count')).toHaveTextContent('0'));
  });

  it('hydrates receivable payment side effects when a linked transaction insert arrives first', async () => {
    const debtBefore = {
      id: 'debt-transaction-insert-1',
      customer_id: 'cust-1',
      sale_id: null,
      original_amount: 390,
      remaining_amount: 390,
      status: 'Aberta',
      due_date: null,
      first_due_date: null,
      installments_total: 1,
      notes: null,
      source: 'manual',
      created_at: '2026-05-13T16:37:57.000Z',
      updated_at: '2026-05-13T16:37:57.000Z'
    };
    const debtAfter = {
      ...debtBefore,
      remaining_amount: 0,
      status: 'Quitada',
      updated_at: '2026-05-13T16:38:57.000Z'
    };
    const paymentRow = {
      id: 'dpm-transaction-insert-1',
      debt_id: debtBefore.id,
      amount: 390,
      payment_method: 'Pix',
      account: 'Conta Bancária',
      paid_at: '2026-05-13T16:38:57.000Z',
      notes: null,
      created_at: '2026-05-13T16:38:57.000Z'
    };
    const transactionRow = {
      id: 'trx-debt-payment-insert-1',
      type: 'IN',
      category: 'Pagamento de dívida',
      amount: 390,
      date: paymentRow.paid_at,
      description: 'Pagamento de dívida',
      account: 'Conta Bancária',
      sale_id: null,
      debt_payment_id: paymentRow.id,
      payable_debt_payment_id: null,
      payable_debt_id: null
    };

    initialRowsByTable.debts = [debtBefore];
    initialRowsByTable.debt_payments = [];
    initialRowsByTable.transactions = [];

    fromMock.mockImplementation((table: string) => {
      if (table === 'debt_payments') {
        const query: any = createAdminQuery(table);
        query.maybeSingle = vi.fn(() => Promise.resolve({ data: paymentRow, error: null }));
        return query;
      }

      if (table === 'debts') {
        const query: any = createAdminQuery(table);
        query.maybeSingle = vi.fn(() => Promise.resolve({ data: debtAfter, error: null }));
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

    const transactionsHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'transactions')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(transactionsHandler).toBeTypeOf('function');

    await act(async () => {
      await transactionsHandler?.({
        eventType: 'INSERT',
        new: transactionRow
      });
    });

    await waitFor(() => expect(screen.getByTestId('transaction-count')).toHaveTextContent('1'));
    expect(screen.getByTestId('debt-payment-count')).toHaveTextContent('1');
    expect(screen.getByTestId('first-debt-status')).toHaveTextContent('Quitada');
    expect(queryCalls).toContainEqual({ table: 'debt_payments', method: 'eq', column: 'id', value: paymentRow.id });
    expect(queryCalls).toContainEqual({ table: 'debts', method: 'eq', column: 'id', value: debtBefore.id });
  });

  it('hydrates payable payment side effects when a linked transaction insert arrives first', async () => {
    const payableDebtBefore = {
      ...payableDebtBeforeReversal,
      id: 'pdbt-transaction-insert-1',
      remaining_amount: 100,
      status: 'Aberta'
    };
    const payableDebtAfter = {
      ...payableDebtBefore,
      remaining_amount: 0,
      status: 'Quitada',
      updated_at: '2026-05-13T16:38:57.000Z'
    };
    const paymentRow = {
      id: 'pdpm-transaction-insert-1',
      payable_debt_id: payableDebtBefore.id,
      amount: 100,
      payment_method: 'Pix',
      account: 'Conta Bancária',
      paid_at: '2026-05-13T16:38:57.000Z',
      notes: null,
      attachment_path: null,
      attachment_mime: null,
      attachment_name: null,
      attachment_size: null,
      created_at: '2026-05-13T16:38:57.000Z'
    };
    const transactionRow = {
      id: 'trx-payable-payment-insert-1',
      type: 'OUT',
      category: 'Pagamento de dívida ativa',
      amount: 100,
      date: paymentRow.paid_at,
      description: 'Pagamento de dívida ativa',
      account: 'Conta Bancária',
      sale_id: null,
      debt_payment_id: null,
      payable_debt_payment_id: paymentRow.id,
      payable_debt_id: null
    };

    initialRowsByTable.payable_debts = [payableDebtBefore];
    initialRowsByTable.payable_debt_payments = [];
    initialRowsByTable.transactions = [];

    fromMock.mockImplementation((table: string) => {
      if (table === 'payable_debt_payments') {
        const query: any = createAdminQuery(table);
        query.maybeSingle = vi.fn(() => Promise.resolve({ data: paymentRow, error: null }));
        return query;
      }

      if (table === 'payable_debts') {
        const query: any = createAdminQuery(table);
        query.maybeSingle = vi.fn(() => Promise.resolve({ data: payableDebtAfter, error: null }));
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

    const transactionsHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'transactions')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(transactionsHandler).toBeTypeOf('function');

    await act(async () => {
      await transactionsHandler?.({
        eventType: 'INSERT',
        new: transactionRow
      });
    });

    await waitFor(() => expect(screen.getByTestId('transaction-count')).toHaveTextContent('1'));
    expect(screen.getByTestId('payable-payment-count')).toHaveTextContent('1');
    expect(screen.getByTestId('first-payable-debt-status')).toHaveTextContent('Quitada');
    expect(queryCalls).toContainEqual({ table: 'payable_debt_payments', method: 'eq', column: 'id', value: paymentRow.id });
    expect(queryCalls).toContainEqual({ table: 'payable_debts', method: 'eq', column: 'id', value: payableDebtBefore.id });
  });

  it('hydrates receivable payment side effects when a linked transaction is updated', async () => {
    const debtBefore = {
      id: 'debt-transaction-update-1',
      customer_id: 'cust-1',
      sale_id: null,
      original_amount: 390,
      remaining_amount: 390,
      status: 'Aberta',
      due_date: null,
      first_due_date: null,
      installments_total: 1,
      notes: null,
      source: 'manual',
      created_at: '2026-05-13T16:37:57.000Z',
      updated_at: '2026-05-13T16:37:57.000Z'
    };
    const debtAfter = {
      ...debtBefore,
      remaining_amount: 0,
      status: 'Quitada',
      updated_at: '2026-05-13T16:38:57.000Z'
    };
    const paymentRow = {
      id: 'dpm-transaction-update-1',
      debt_id: debtBefore.id,
      amount: 390,
      payment_method: 'Pix',
      account: 'Conta Bancária',
      paid_at: '2026-05-13T16:38:57.000Z',
      notes: null,
      created_at: '2026-05-13T16:38:57.000Z'
    };
    const transactionBefore = {
      id: 'trx-debt-payment-update-1',
      type: 'IN',
      category: 'Aporte',
      amount: 390,
      date: paymentRow.paid_at,
      description: 'Aporte manual',
      account: 'Conta Bancária',
      sale_id: null,
      debt_payment_id: null,
      payable_debt_payment_id: null,
      payable_debt_id: null
    };
    const transactionAfter = {
      ...transactionBefore,
      category: 'Pagamento de dívida',
      debt_payment_id: paymentRow.id
    };

    initialRowsByTable.debts = [debtBefore];
    initialRowsByTable.debt_payments = [];
    initialRowsByTable.transactions = [transactionBefore];

    fromMock.mockImplementation((table: string) => {
      if (table === 'debt_payments') {
        const query: any = createAdminQuery(table);
        query.maybeSingle = vi.fn(() => Promise.resolve({ data: paymentRow, error: null }));
        return query;
      }

      if (table === 'debts') {
        const query: any = createAdminQuery(table);
        query.maybeSingle = vi.fn(() => Promise.resolve({ data: debtAfter, error: null }));
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

    const transactionsHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'transactions')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(transactionsHandler).toBeTypeOf('function');

    await act(async () => {
      await transactionsHandler?.({
        eventType: 'UPDATE',
        new: transactionAfter
      });
    });

    await waitFor(() => expect(screen.getByTestId('debt-payment-count')).toHaveTextContent('1'));
    expect(screen.getByTestId('first-debt-status')).toHaveTextContent('Quitada');
  });

  it('hydrates payable payment side effects when a linked transaction is updated', async () => {
    const payableDebtBefore = {
      ...payableDebtBeforeReversal,
      id: 'pdbt-transaction-update-1',
      remaining_amount: 100,
      status: 'Aberta'
    };
    const payableDebtAfter = {
      ...payableDebtBefore,
      remaining_amount: 0,
      status: 'Quitada',
      updated_at: '2026-05-13T16:38:57.000Z'
    };
    const paymentRow = {
      id: 'pdpm-transaction-update-1',
      payable_debt_id: payableDebtBefore.id,
      amount: 100,
      payment_method: 'Pix',
      account: 'Conta Bancária',
      paid_at: '2026-05-13T16:38:57.000Z',
      notes: null,
      attachment_path: null,
      attachment_mime: null,
      attachment_name: null,
      attachment_size: null,
      created_at: '2026-05-13T16:38:57.000Z'
    };
    const transactionBefore = {
      id: 'trx-payable-payment-update-1',
      type: 'OUT',
      category: 'Serviço',
      amount: 100,
      date: paymentRow.paid_at,
      description: 'Pagamento manual',
      account: 'Conta Bancária',
      sale_id: null,
      debt_payment_id: null,
      payable_debt_payment_id: null,
      payable_debt_id: null
    };
    const transactionAfter = {
      ...transactionBefore,
      category: 'Pagamento de dívida ativa',
      payable_debt_payment_id: paymentRow.id
    };

    initialRowsByTable.payable_debts = [payableDebtBefore];
    initialRowsByTable.payable_debt_payments = [];
    initialRowsByTable.transactions = [transactionBefore];

    fromMock.mockImplementation((table: string) => {
      if (table === 'payable_debt_payments') {
        const query: any = createAdminQuery(table);
        query.maybeSingle = vi.fn(() => Promise.resolve({ data: paymentRow, error: null }));
        return query;
      }

      if (table === 'payable_debts') {
        const query: any = createAdminQuery(table);
        query.maybeSingle = vi.fn(() => Promise.resolve({ data: payableDebtAfter, error: null }));
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

    const transactionsHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'transactions')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(transactionsHandler).toBeTypeOf('function');

    await act(async () => {
      await transactionsHandler?.({
        eventType: 'UPDATE',
        new: transactionAfter
      });
    });

    await waitFor(() => expect(screen.getByTestId('payable-payment-count')).toHaveTextContent('1'));
    expect(screen.getByTestId('first-payable-debt-status')).toHaveTextContent('Quitada');
  });

  it('hydrates debt payment side effects when a receivable payment arrives on another device', async () => {
    const debtBefore = {
      id: 'debt-realtime-payment-1',
      customer_id: 'cust-1',
      sale_id: null,
      original_amount: 390,
      remaining_amount: 390,
      status: 'Aberta',
      due_date: null,
      first_due_date: null,
      installments_total: 1,
      notes: null,
      source: 'manual',
      created_at: '2026-05-13T16:37:57.000Z',
      updated_at: '2026-05-13T16:37:57.000Z'
    };
    const debtAfter = {
      ...debtBefore,
      remaining_amount: 0,
      status: 'Quitada',
      updated_at: '2026-05-13T16:38:57.000Z'
    };
    const paymentRow = {
      id: 'dpm-realtime-1',
      debt_id: debtBefore.id,
      amount: 390,
      payment_method: 'Pix',
      account: 'Conta Bancária',
      paid_at: '2026-05-13T16:38:57.000Z',
      notes: null,
      created_at: '2026-05-13T16:38:57.000Z'
    };
    const transactionRow = {
      id: 'trx-dpm-realtime-1',
      type: 'IN',
      category: 'Pagamento de dívida',
      amount: 390,
      date: paymentRow.paid_at,
      description: 'Pagamento de dívida',
      account: 'Conta Bancária',
      sale_id: null,
      debt_payment_id: paymentRow.id,
      payable_debt_payment_id: null,
      payable_debt_id: null
    };

    initialRowsByTable.debts = [debtBefore];
    initialRowsByTable.debt_payments = [];
    initialRowsByTable.transactions = [];

    fromMock.mockImplementation((table: string) => {
      if (table === 'debts') {
        const query: any = createAdminQuery(table);
        query.single = vi.fn(() => Promise.resolve({ data: debtAfter, error: null }));
        query.maybeSingle = vi.fn(() => Promise.resolve({ data: debtAfter, error: null }));
        return query;
      }

      if (table === 'transactions') {
        const filters: Record<string, any> = {};
        const query: any = {
          select: vi.fn(() => {
            queryCalls.push({ table, method: 'select' });
            return query;
          }),
          order: vi.fn(() => query),
          range: vi.fn(() => query),
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          eq: vi.fn((column: string, value: any) => {
            filters[column] = value;
            queryCalls.push({ table, method: 'eq', column, value });
            return query;
          }),
          maybeSingle: vi.fn(() => Promise.resolve({
            data: filters.debt_payment_id === paymentRow.id ? transactionRow : null,
            error: null
          })),
          then: (resolve: any, reject: any) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
          catch: (reject: any) => Promise.resolve({ data: [], error: null }).catch(reject),
          finally: (onFinally: any) => Promise.resolve({ data: [], error: null }).finally(onFinally)
        };
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

    const debtPaymentsHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'debt_payments')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(debtPaymentsHandler).toBeTypeOf('function');

    await act(async () => {
      await debtPaymentsHandler?.({ eventType: 'INSERT', new: paymentRow });
    });

    await waitFor(() => expect(screen.getByTestId('debt-payment-count')).toHaveTextContent('1'));
    expect(screen.getByTestId('first-debt-status')).toHaveTextContent('Quitada');
    expect(screen.getByTestId('transaction-count')).toHaveTextContent('1');
    expect(queryCalls).toContainEqual({ table: 'transactions', method: 'eq', column: 'debt_payment_id', value: paymentRow.id });
  });

  it('applies receivable debt payment reversal when realtime sends the deleted debt id', async () => {
    const debtBefore = {
      id: 'debt-payment-delete-default-1',
      customer_id: 'cust-1',
      sale_id: null,
      original_amount: 390,
      remaining_amount: 0,
      status: 'Quitada',
      due_date: null,
      first_due_date: null,
      installments_total: 1,
      notes: null,
      source: 'manual',
      created_at: '2026-05-13T16:37:57.000Z',
      updated_at: '2026-05-13T16:38:57.000Z'
    };
    const debtAfter = {
      ...debtBefore,
      remaining_amount: 390,
      status: 'Aberta',
      updated_at: '2026-05-13T16:39:57.000Z'
    };
    const transactionRow = {
      id: 'trx-dpm-default-delete-1',
      type: 'IN',
      category: 'Pagamento de dívida',
      amount: 390,
      date: '2026-05-13T16:38:57.000Z',
      description: 'Pagamento de dívida',
      account: 'Conta Bancária',
      sale_id: null,
      debt_payment_id: 'dpm-default-delete-1',
      payable_debt_payment_id: null,
      payable_debt_id: null
    };

    initialRowsByTable.debts = [debtBefore];
    initialRowsByTable.debt_payments = [];
    initialRowsByTable.transactions = [transactionRow];

    fromMock.mockImplementation((table: string) => {
      if (table === 'debts') {
        const query: any = createAdminQuery(table);
        query.maybeSingle = vi.fn(() => Promise.resolve({ data: debtAfter, error: null }));
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

    const debtPaymentsHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'debt_payments')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(debtPaymentsHandler).toBeTypeOf('function');

    await act(async () => {
      await debtPaymentsHandler?.({
        eventType: 'DELETE',
        old: { id: 'dpm-default-delete-1', debt_id: debtBefore.id }
      });
    });

    await waitFor(() => expect(screen.getByTestId('transaction-count')).toHaveTextContent('0'));
    expect(screen.getByTestId('first-debt-status')).toHaveTextContent('Aberta');
    expect(queryCalls).toContainEqual({ table: 'debts', method: 'eq', column: 'id', value: debtBefore.id });
  });

  it('hydrates payable debt creation side effects when a payable debt arrives on another device', async () => {
    const payableDebtRow = {
      id: 'pdbt-realtime-entry-1',
      creditor_id: 'cred-1',
      creditor_name: 'Fornecedor Teste',
      creditor_document: null,
      creditor_phone: null,
      original_amount: 250,
      remaining_amount: 250,
      status: 'Aberta',
      due_date: null,
      first_due_date: null,
      installments_total: 1,
      notes: null,
      source: 'manual',
      sale_id: null,
      entry_account: 'Conta Bancária',
      created_at: '2026-05-13T16:37:57.000Z',
      updated_at: '2026-05-13T16:37:57.000Z'
    };
    const transactionRow = {
      id: 'trx-pdbt-entry-1',
      type: 'IN',
      category: 'Entrada de dívida ativa',
      amount: 250,
      date: payableDebtRow.created_at,
      description: 'Entrada dívida ativa',
      account: 'Conta Bancária',
      sale_id: null,
      debt_payment_id: null,
      payable_debt_payment_id: null,
      payable_debt_id: payableDebtRow.id
    };

    initialRowsByTable.payable_debts = [];
    initialRowsByTable.transactions = [];

    fromMock.mockImplementation((table: string) => {
      if (table === 'transactions') {
        const filters: Record<string, any> = {};
        const query: any = {
          select: vi.fn(() => {
            queryCalls.push({ table, method: 'select' });
            return query;
          }),
          order: vi.fn(() => query),
          range: vi.fn(() => query),
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          eq: vi.fn((column: string, value: any) => {
            filters[column] = value;
            queryCalls.push({ table, method: 'eq', column, value });
            return query;
          }),
          maybeSingle: vi.fn(() => Promise.resolve({
            data: filters.payable_debt_id === payableDebtRow.id ? transactionRow : null,
            error: null
          })),
          then: (resolve: any, reject: any) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
          catch: (reject: any) => Promise.resolve({ data: [], error: null }).catch(reject),
          finally: (onFinally: any) => Promise.resolve({ data: [], error: null }).finally(onFinally)
        };
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

    const payableDebtsHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'payable_debts')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(payableDebtsHandler).toBeTypeOf('function');

    await act(async () => {
      await payableDebtsHandler?.({ eventType: 'INSERT', new: payableDebtRow });
    });

    await waitFor(() => expect(screen.getByTestId('payable-debt-count')).toHaveTextContent('1'));
    expect(screen.getByTestId('transaction-count')).toHaveTextContent('1');
    expect(queryCalls).toContainEqual({ table: 'transactions', method: 'eq', column: 'payable_debt_id', value: payableDebtRow.id });
  });

  it('hydrates payable payment side effects when a payable payment arrives on another device', async () => {
    const payableDebtBefore = {
      ...payableDebtBeforeReversal,
      id: 'pdbt-realtime-payment-1',
      remaining_amount: 100,
      status: 'Aberta'
    };
    const payableDebtAfter = {
      ...payableDebtBefore,
      remaining_amount: 0,
      status: 'Quitada',
      updated_at: '2026-05-13T16:38:57.000Z'
    };
    const paymentRow = {
      id: 'pdpm-realtime-1',
      payable_debt_id: payableDebtBefore.id,
      amount: 100,
      payment_method: 'Pix',
      account: 'Conta Bancária',
      paid_at: '2026-05-13T16:38:57.000Z',
      notes: null,
      attachment_path: null,
      attachment_mime: null,
      attachment_name: null,
      attachment_size: null,
      created_at: '2026-05-13T16:38:57.000Z'
    };
    const transactionRow = {
      id: 'trx-pdpm-realtime-1',
      type: 'OUT',
      category: 'Pagamento de dívida ativa',
      amount: 100,
      date: paymentRow.paid_at,
      description: 'Pagamento de dívida ativa',
      account: 'Conta Bancária',
      sale_id: null,
      debt_payment_id: null,
      payable_debt_payment_id: paymentRow.id,
      payable_debt_id: null
    };

    initialRowsByTable.payable_debts = [payableDebtBefore];
    initialRowsByTable.payable_debt_payments = [];
    initialRowsByTable.transactions = [];

    fromMock.mockImplementation((table: string) => {
      if (table === 'payable_debts') {
        const query: any = createAdminQuery(table);
        query.single = vi.fn(() => Promise.resolve({ data: payableDebtAfter, error: null }));
        query.maybeSingle = vi.fn(() => Promise.resolve({ data: payableDebtAfter, error: null }));
        return query;
      }

      if (table === 'transactions') {
        const filters: Record<string, any> = {};
        const query: any = {
          select: vi.fn(() => {
            queryCalls.push({ table, method: 'select' });
            return query;
          }),
          order: vi.fn(() => query),
          range: vi.fn(() => query),
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          eq: vi.fn((column: string, value: any) => {
            filters[column] = value;
            queryCalls.push({ table, method: 'eq', column, value });
            return query;
          }),
          maybeSingle: vi.fn(() => Promise.resolve({
            data: filters.payable_debt_payment_id === paymentRow.id ? transactionRow : null,
            error: null
          })),
          then: (resolve: any, reject: any) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
          catch: (reject: any) => Promise.resolve({ data: [], error: null }).catch(reject),
          finally: (onFinally: any) => Promise.resolve({ data: [], error: null }).finally(onFinally)
        };
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

    const payablePaymentsHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'payable_debt_payments')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(payablePaymentsHandler).toBeTypeOf('function');

    await act(async () => {
      await payablePaymentsHandler?.({ eventType: 'INSERT', new: paymentRow });
    });

    await waitFor(() => expect(screen.getByTestId('payable-payment-count')).toHaveTextContent('1'));
    expect(screen.getByTestId('first-payable-debt-status')).toHaveTextContent('Quitada');
    expect(screen.getByTestId('transaction-count')).toHaveTextContent('1');
    expect(queryCalls).toContainEqual({ table: 'transactions', method: 'eq', column: 'payable_debt_payment_id', value: paymentRow.id });
  });

  it('applies payable debt payment reversal when realtime sends the deleted debt id', async () => {
    const payableDebtBefore = {
      ...payableDebtBeforeReversal,
      id: 'pdbt-payment-delete-default-1',
      remaining_amount: 0,
      status: 'Quitada'
    };
    const payableDebtAfter = {
      ...payableDebtBefore,
      remaining_amount: 100,
      status: 'Aberta',
      updated_at: '2026-05-13T16:39:57.000Z'
    };
    const transactionRow = {
      id: 'trx-pdpm-default-delete-1',
      type: 'OUT',
      category: 'Pagamento de dívida ativa',
      amount: 100,
      date: '2026-05-13T16:38:57.000Z',
      description: 'Pagamento de dívida ativa',
      account: 'Conta Bancária',
      sale_id: null,
      debt_payment_id: null,
      payable_debt_payment_id: 'pdpm-default-delete-1',
      payable_debt_id: null
    };

    initialRowsByTable.payable_debts = [payableDebtBefore];
    initialRowsByTable.payable_debt_payments = [];
    initialRowsByTable.transactions = [transactionRow];

    fromMock.mockImplementation((table: string) => {
      if (table === 'payable_debts') {
        const query: any = createAdminQuery(table);
        query.maybeSingle = vi.fn(() => Promise.resolve({ data: payableDebtAfter, error: null }));
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

    const payablePaymentsHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'payable_debt_payments')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(payablePaymentsHandler).toBeTypeOf('function');

    await act(async () => {
      await payablePaymentsHandler?.({
        eventType: 'DELETE',
        old: { id: 'pdpm-default-delete-1', payable_debt_id: payableDebtBefore.id }
      });
    });

    await waitFor(() => expect(screen.getByTestId('transaction-count')).toHaveTextContent('0'));
    expect(screen.getByTestId('first-payable-debt-status')).toHaveTextContent('Aberta');
    expect(queryCalls).toContainEqual({ table: 'payable_debts', method: 'eq', column: 'id', value: payableDebtBefore.id });
  });

  it('hydrates receivable debt and transaction when a debt payment is updated on another device', async () => {
    const debtBefore = {
      id: 'debt-payment-update-1',
      customer_id: 'cust-1',
      sale_id: null,
      original_amount: 390,
      remaining_amount: 200,
      status: 'Parcial',
      due_date: null,
      first_due_date: null,
      installments_total: 1,
      notes: null,
      source: 'manual',
      created_at: '2026-05-13T16:37:57.000Z',
      updated_at: '2026-05-13T16:38:57.000Z'
    };
    const debtAfter = {
      ...debtBefore,
      remaining_amount: 0,
      status: 'Quitada',
      updated_at: '2026-05-13T16:39:57.000Z'
    };
    const paymentBefore = {
      id: 'dpm-update-1',
      debt_id: debtBefore.id,
      amount: 190,
      payment_method: 'Pix',
      account: 'Conta Bancária',
      paid_at: '2026-05-13T16:38:57.000Z',
      notes: null,
      created_at: '2026-05-13T16:38:57.000Z'
    };
    const paymentAfter = {
      ...paymentBefore,
      amount: 390
    };
    const transactionAfter = {
      id: 'trx-dpm-update-1',
      type: 'IN',
      category: 'Pagamento de dívida',
      amount: 390,
      date: paymentAfter.paid_at,
      description: 'Pagamento de dívida atualizado',
      account: 'Conta Bancária',
      sale_id: null,
      debt_payment_id: paymentAfter.id,
      payable_debt_payment_id: null,
      payable_debt_id: null
    };

    initialRowsByTable.debts = [debtBefore];
    initialRowsByTable.debt_payments = [paymentBefore];
    initialRowsByTable.transactions = [];

    fromMock.mockImplementation((table: string) => {
      if (table === 'debts') {
        const query: any = createAdminQuery(table);
        query.maybeSingle = vi.fn(() => Promise.resolve({ data: debtAfter, error: null }));
        return query;
      }

      if (table === 'transactions') {
        const filters: Record<string, any> = {};
        const query: any = {
          select: vi.fn(() => {
            queryCalls.push({ table, method: 'select' });
            return query;
          }),
          order: vi.fn(() => query),
          range: vi.fn(() => query),
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          eq: vi.fn((column: string, value: any) => {
            filters[column] = value;
            queryCalls.push({ table, method: 'eq', column, value });
            return query;
          }),
          maybeSingle: vi.fn(() => Promise.resolve({
            data: filters.debt_payment_id === paymentAfter.id ? transactionAfter : null,
            error: null
          })),
          then: (resolve: any, reject: any) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
          catch: (reject: any) => Promise.resolve({ data: [], error: null }).catch(reject),
          finally: (onFinally: any) => Promise.resolve({ data: [], error: null }).finally(onFinally)
        };
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
    expect(screen.getByTestId('first-debt-status')).toHaveTextContent('Parcial');

    const debtPaymentsHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'debt_payments')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(debtPaymentsHandler).toBeTypeOf('function');

    await act(async () => {
      await debtPaymentsHandler?.({ eventType: 'UPDATE', new: paymentAfter });
    });

    await waitFor(() => expect(screen.getByTestId('first-debt-status')).toHaveTextContent('Quitada'));
    expect(screen.getByTestId('transaction-count')).toHaveTextContent('1');
    expect(queryCalls).toContainEqual({ table: 'transactions', method: 'eq', column: 'debt_payment_id', value: paymentAfter.id });
  });

  it('hydrates payable debt and transaction when a payable payment is updated on another device', async () => {
    const payableDebtBefore = {
      ...payableDebtBeforeReversal,
      id: 'pdbt-payment-update-1',
      remaining_amount: 50,
      status: 'Parcial'
    };
    const payableDebtAfter = {
      ...payableDebtBefore,
      remaining_amount: 0,
      status: 'Quitada',
      updated_at: '2026-05-13T16:39:57.000Z'
    };
    const paymentBefore = {
      id: 'pdpm-update-1',
      payable_debt_id: payableDebtBefore.id,
      amount: 50,
      payment_method: 'Pix',
      account: 'Conta Bancária',
      paid_at: '2026-05-13T16:38:57.000Z',
      notes: null,
      attachment_path: null,
      attachment_mime: null,
      attachment_name: null,
      attachment_size: null,
      created_at: '2026-05-13T16:38:57.000Z'
    };
    const paymentAfter = {
      ...paymentBefore,
      amount: 100
    };
    const transactionAfter = {
      id: 'trx-pdpm-update-1',
      type: 'OUT',
      category: 'Pagamento de dívida ativa',
      amount: 100,
      date: paymentAfter.paid_at,
      description: 'Pagamento de dívida ativa atualizado',
      account: 'Conta Bancária',
      sale_id: null,
      debt_payment_id: null,
      payable_debt_payment_id: paymentAfter.id,
      payable_debt_id: null
    };

    initialRowsByTable.payable_debts = [payableDebtBefore];
    initialRowsByTable.payable_debt_payments = [paymentBefore];
    initialRowsByTable.transactions = [];

    fromMock.mockImplementation((table: string) => {
      if (table === 'payable_debts') {
        const query: any = createAdminQuery(table);
        query.maybeSingle = vi.fn(() => Promise.resolve({ data: payableDebtAfter, error: null }));
        return query;
      }

      if (table === 'transactions') {
        const filters: Record<string, any> = {};
        const query: any = {
          select: vi.fn(() => {
            queryCalls.push({ table, method: 'select' });
            return query;
          }),
          order: vi.fn(() => query),
          range: vi.fn(() => query),
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          eq: vi.fn((column: string, value: any) => {
            filters[column] = value;
            queryCalls.push({ table, method: 'eq', column, value });
            return query;
          }),
          maybeSingle: vi.fn(() => Promise.resolve({
            data: filters.payable_debt_payment_id === paymentAfter.id ? transactionAfter : null,
            error: null
          })),
          then: (resolve: any, reject: any) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
          catch: (reject: any) => Promise.resolve({ data: [], error: null }).catch(reject),
          finally: (onFinally: any) => Promise.resolve({ data: [], error: null }).finally(onFinally)
        };
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
    expect(screen.getByTestId('first-payable-debt-status')).toHaveTextContent('Parcial');

    const payablePaymentsHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'payable_debt_payments')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(payablePaymentsHandler).toBeTypeOf('function');

    await act(async () => {
      await payablePaymentsHandler?.({ eventType: 'UPDATE', new: paymentAfter });
    });

    await waitFor(() => expect(screen.getByTestId('first-payable-debt-status')).toHaveTextContent('Quitada'));
    expect(screen.getByTestId('transaction-count')).toHaveTextContent('1');
    expect(queryCalls).toContainEqual({ table: 'transactions', method: 'eq', column: 'payable_debt_payment_id', value: paymentAfter.id });
  });

  it('applies receivable debt insert and update events directly to the debtors tab state', async () => {
    const debtInsert = {
      id: 'debt-direct-realtime-1',
      customer_id: 'cust-1',
      sale_id: null,
      original_amount: 390,
      remaining_amount: 390,
      status: 'Aberta',
      due_date: '2026-05-20',
      first_due_date: '2026-05-20',
      installments_total: 1,
      notes: null,
      source: 'manual',
      created_at: '2026-05-13T16:37:57.000Z',
      updated_at: '2026-05-13T16:37:57.000Z'
    };
    const debtUpdate = {
      ...debtInsert,
      remaining_amount: 120,
      status: 'Parcial',
      updated_at: '2026-05-13T16:38:57.000Z'
    };

    initialRowsByTable.debts = [];

    render(
      <DataProvider>
        <DataLoadProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));
    expect(screen.getByTestId('debt-count')).toHaveTextContent('0');

    const debtsHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'debts')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(debtsHandler).toBeTypeOf('function');

    await act(async () => {
      await debtsHandler?.({ eventType: 'INSERT', new: debtInsert });
    });

    await waitFor(() => expect(screen.getByTestId('debt-count')).toHaveTextContent('1'));
    expect(screen.getByTestId('first-debt-status')).toHaveTextContent('Aberta');

    await act(async () => {
      await debtsHandler?.({ eventType: 'UPDATE', new: debtUpdate });
    });

    await waitFor(() => expect(screen.getByTestId('first-debt-status')).toHaveTextContent('Parcial'));
  });

  it('applies payable debt update events directly to the active debts tab state', async () => {
    const payableDebtBefore = {
      ...payableDebtBeforeReversal,
      id: 'pdbt-direct-update-1',
      remaining_amount: 100,
      status: 'Aberta'
    };
    const payableDebtAfter = {
      ...payableDebtBefore,
      remaining_amount: 40,
      status: 'Parcial',
      updated_at: '2026-05-13T16:38:57.000Z'
    };

    initialRowsByTable.payable_debts = [payableDebtBefore];

    render(
      <DataProvider>
        <DataLoadProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));
    expect(screen.getByTestId('payable-debt-count')).toHaveTextContent('1');
    expect(screen.getByTestId('first-payable-debt-status')).toHaveTextContent('Aberta');

    const payableDebtsHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'payable_debts')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(payableDebtsHandler).toBeTypeOf('function');

    await act(async () => {
      await payableDebtsHandler?.({ eventType: 'UPDATE', new: payableDebtAfter });
    });

    await waitFor(() => expect(screen.getByTestId('first-payable-debt-status')).toHaveTextContent('Parcial'));
  });

  it('removes payable debt cascade side effects when an active payable debt is deleted on another device', async () => {
    const payableDebtRow = {
      ...payableDebtBeforeReversal,
      id: 'pdbt-realtime-delete-1',
      remaining_amount: 0,
      status: 'Quitada'
    };
    const paymentRow = {
      id: 'pdpm-delete-cascade-1',
      payable_debt_id: payableDebtRow.id,
      amount: 100,
      payment_method: 'Pix',
      account: 'Conta Bancária',
      paid_at: '2026-05-13T16:38:57.000Z',
      notes: null,
      attachment_path: null,
      attachment_mime: null,
      attachment_name: null,
      attachment_size: null,
      created_at: '2026-05-13T16:38:57.000Z'
    };
    const entryTransaction = {
      id: 'trx-pdbt-delete-cascade-entry-1',
      type: 'IN',
      category: 'Entrada de dívida ativa',
      amount: 100,
      date: '2026-05-13T16:37:57.000Z',
      description: 'Entrada de dívida ativa',
      account: 'Conta Bancária',
      sale_id: null,
      debt_payment_id: null,
      payable_debt_payment_id: null,
      payable_debt_id: payableDebtRow.id
    };
    const paymentTransaction = {
      id: 'trx-pdbt-delete-cascade-payment-1',
      type: 'OUT',
      category: 'Pagamento de dívida ativa',
      amount: 100,
      date: paymentRow.paid_at,
      description: 'Pagamento de dívida ativa',
      account: 'Conta Bancária',
      sale_id: null,
      debt_payment_id: null,
      payable_debt_payment_id: paymentRow.id,
      payable_debt_id: null
    };

    initialRowsByTable.payable_debts = [payableDebtRow];
    initialRowsByTable.payable_debt_payments = [paymentRow];
    initialRowsByTable.transactions = [entryTransaction, paymentTransaction];

    render(
      <DataProvider>
        <DataLoadProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));
    expect(screen.getByTestId('payable-debt-count')).toHaveTextContent('1');
    expect(screen.getByTestId('payable-payment-count')).toHaveTextContent('1');
    expect(screen.getByTestId('transaction-count')).toHaveTextContent('2');

    const payableDebtsHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'payable_debts')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(payableDebtsHandler).toBeTypeOf('function');

    await act(async () => {
      await payableDebtsHandler?.({ eventType: 'DELETE', old: { id: payableDebtRow.id } });
    });

    await waitFor(() => expect(screen.getByTestId('payable-debt-count')).toHaveTextContent('0'));
    expect(screen.getByTestId('payable-payment-count')).toHaveTextContent('0');
    expect(screen.getByTestId('transaction-count')).toHaveTextContent('0');
  });

  it('removes debt cascade side effects when a receivable debt is deleted on another device', async () => {
    const debtRow = {
      id: 'debt-realtime-delete-1',
      customer_id: 'cust-1',
      sale_id: null,
      original_amount: 390,
      remaining_amount: 0,
      status: 'Quitada',
      due_date: null,
      first_due_date: null,
      installments_total: 1,
      notes: null,
      source: 'manual',
      created_at: '2026-05-13T16:37:57.000Z',
      updated_at: '2026-05-13T16:38:57.000Z'
    };
    const paymentRow = {
      id: 'dpm-delete-1',
      debt_id: debtRow.id,
      amount: 390,
      payment_method: 'Pix',
      account: 'Conta Bancária',
      paid_at: '2026-05-13T16:38:57.000Z',
      notes: null,
      created_at: '2026-05-13T16:38:57.000Z'
    };
    const transactionRow = {
      id: 'trx-dpm-delete-1',
      type: 'IN',
      category: 'Pagamento de dívida',
      amount: 390,
      date: paymentRow.paid_at,
      description: 'Pagamento de dívida',
      account: 'Conta Bancária',
      sale_id: null,
      debt_payment_id: paymentRow.id,
      payable_debt_payment_id: null,
      payable_debt_id: null
    };

    initialRowsByTable.debts = [debtRow];
    initialRowsByTable.debt_payments = [paymentRow];
    initialRowsByTable.transactions = [transactionRow];

    render(
      <DataProvider>
        <DataLoadProbe />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));
    expect(screen.getByTestId('debt-count')).toHaveTextContent('1');
    expect(screen.getByTestId('debt-payment-count')).toHaveTextContent('1');
    expect(screen.getByTestId('transaction-count')).toHaveTextContent('1');

    const debtsHandler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'debts')?.[2] as
      | ((payload: any) => Promise<void>)
      | undefined;

    expect(debtsHandler).toBeTypeOf('function');

    await act(async () => {
      await debtsHandler?.({ eventType: 'DELETE', old: { id: debtRow.id } });
    });

    await waitFor(() => expect(screen.getByTestId('debt-count')).toHaveTextContent('0'));
    expect(screen.getByTestId('debt-payment-count')).toHaveTextContent('0');
    expect(screen.getByTestId('transaction-count')).toHaveTextContent('0');
  });

  it('keeps a newly created payable payment transaction visible when an older focus resync finishes later', async () => {
    const onDone = vi.fn();
    const staleTransactionsRefresh = createDeferred<{ data: any[]; error: null }>();
    const paymentInsert = createDeferred<{ data: any; error: null }>();
    let paymentInsertStarted = false;
    let transactionsSelectCount = 0;
    const payableDebtBefore = {
      ...payableDebtBeforeReversal,
      id: 'pdbt-focus-payment-1',
      original_amount: 100,
      remaining_amount: 100,
      status: 'Aberta'
    };
    const payableDebtAfter = {
      ...payableDebtBefore,
      remaining_amount: 90,
      status: 'Parcial',
      updated_at: '2026-05-17T12:00:00.000Z'
    };
    const paymentRow = {
      id: 'pdpm-focus-payment-1',
      payable_debt_id: payableDebtBefore.id,
      amount: 10,
      payment_method: 'Pix',
      account: 'Conta Bancária',
      paid_at: '2026-05-17T12:00:00.000Z',
      notes: null,
      attachment_path: null,
      attachment_mime: null,
      attachment_name: null,
      attachment_size: null,
      created_at: '2026-05-17T12:00:00.000Z'
    };
    const transactionRow = {
      id: 'trx-focus-payment-1',
      type: 'OUT',
      category: 'Pagamento de dívida ativa',
      amount: 10,
      date: paymentRow.paid_at,
      description: 'Pagamento de dívida ativa',
      account: 'Conta Bancária',
      sale_id: null,
      debt_payment_id: null,
      payable_debt_payment_id: paymentRow.id,
      payable_debt_id: null
    };

    initialRowsByTable.payable_debts = [payableDebtBefore];
    initialRowsByTable.payable_debt_payments = [];
    initialRowsByTable.transactions = [];

    fromMock.mockImplementation((table: string) => {
      if (table === 'payable_debt_payments') {
        const query: any = createAdminQuery(table);
        query.insert = vi.fn(() => {
          paymentInsertStarted = true;
          return {
            select: vi.fn(() => ({
              single: vi.fn(() => paymentInsert.promise)
            }))
          };
        });
        return query;
      }

      if (table === 'payable_debts') {
        const query: any = createAdminQuery(table);
        query.single = vi.fn(() => Promise.resolve({ data: payableDebtAfter, error: null }));
        return query;
      }

      if (table === 'transactions') {
        const query: any = {
          select: vi.fn(() => {
            transactionsSelectCount += 1;
            queryCalls.push({ table, method: 'select' });
            return query;
          }),
          order: vi.fn(() => query),
          range: vi.fn(() => query),
          then: (resolve: any, reject: any) => {
            if (transactionsSelectCount === 2) return staleTransactionsRefresh.promise.then(resolve, reject);
            if (transactionsSelectCount >= 3) return Promise.resolve({ data: [transactionRow], error: null }).then(resolve, reject);
            return Promise.resolve({ data: [], error: null }).then(resolve, reject);
          },
          catch: (reject: any) => Promise.resolve({ data: [], error: null }).catch(reject),
          finally: (onFinally: any) => Promise.resolve({ data: [], error: null }).finally(onFinally)
        };
        return query;
      }

      return createAdminQuery(table);
    });

    render(
      <DataProvider>
        <AddPayableDebtPaymentAfterLoad onDone={onDone} />
      </DataProvider>
    );

    await waitFor(() => expect(paymentInsertStarted).toBe(true));

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(transactionsSelectCount).toBe(2));

    await act(async () => {
      paymentInsert.resolve({ data: paymentRow, error: null });
      await paymentInsert.promise;
    });

    await waitFor(() => expect(onDone).toHaveBeenCalledWith());
    await waitFor(() => expect(screen.getByTestId('transaction-count')).toHaveTextContent('1'));
    expect(screen.getByTestId('payable-payment-count')).toHaveTextContent('1');
    expect(screen.getByTestId('payable-debt-status')).toHaveTextContent('Parcial');

    await act(async () => {
      staleTransactionsRefresh.resolve({ data: [], error: null });
      await staleTransactionsRefresh.promise;
    });

    expect(screen.getByTestId('transaction-count')).toHaveTextContent('1');
  });

  it('keeps a newly created sale visible when an older resync finishes later', async () => {
    const onDone = vi.fn();
    const staleSalesRefresh = createDeferred<{ data: any[]; error: null }>();
    const rpcCreateSale = createDeferred<{ data: any; error: null }>();
    let salesSelectCount = 0;
    const sale: Sale = {
      ...saleWithDraftTradeIn(),
      id: 'sale-race-1',
      tradeIns: [],
      tradeInValue: 0,
      items: [{
        id: 'stock-race-1',
        type: DeviceType.IPHONE,
        model: 'iPhone 15',
        color: 'Preto',
        capacity: '128 GB',
        imei: 'imei-race-1',
        condition: Condition.USED,
        status: StockStatus.AVAILABLE,
        storeId: 'store-1',
        purchasePrice: 3000,
        sellPrice: 390,
        maxDiscount: 0,
        warrantyType: WarrantyType.STORE,
        costs: [],
        photos: [],
        entryDate: '2026-05-13'
      }],
      paymentMethods: [{ type: 'Pix', amount: 390, account: 'Conta Bancária' }]
    };
    const rpcSaleRow = saleFullRpcRow(sale);

    rpcMock.mockImplementation((fn: string) => (
      fn === 'create_sale_full'
        ? rpcCreateSale.promise
        : Promise.resolve({ data: null, error: null })
    ));

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
          select: vi.fn(() => {
            queryCalls.push({ table, method: 'select' });
            salesSelectCount += 1;
            if (salesSelectCount === 2) return query;
            if (salesSelectCount === 1) return Promise.resolve({ data: [], error: null });
            return Promise.resolve({
              data: [rpcSaleRow],
              error: null
            });
          }),
          then: (resolve: any, reject: any) => staleSalesRefresh.promise.then(resolve, reject),
          catch: (reject: any) => staleSalesRefresh.promise.catch(reject),
          finally: (onFinally: any) => staleSalesRefresh.promise.finally(onFinally)
        };
        return query;
      }

      return createAdminQuery(table);
    });

    render(
      <DataProvider>
        <DataLoadProbe />
        <AddSaleAfterLoad sale={sale} onDone={onDone} />
      </DataProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('idle'));

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(salesSelectCount).toBe(2));

    await act(async () => {
      rpcCreateSale.resolve({ data: rpcSaleRow, error: null });
      await rpcCreateSale.promise;
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

describe('DataProvider business profile hours', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channelStatusRef.current = null;
    insertCalls.length = 0;
    upsertCalls.length = 0;
    deleteCalls.length = 0;
    queryCalls.length = 0;
    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'resolve_crm_default_store_id') {
        return Promise.resolve({ data: 'st-cae5b9ed-d4e6-405f-9151-1c80542992ec', error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
    initialRowsByTable.business_profile = [];
    initialRowsByTable.card_fee_settings = [];
    initialRowsByTable.crm_ai_entry_settings = [];
    initialRowsByTable.stores = [
      { id: 'st-cae5b9ed-d4e6-405f-9151-1c80542992ec', name: 'iPhone Repasse', city: 'Fortaleza' }
    ];
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      role: 'admin'
    });
    fromMock.mockImplementation(createAdminQuery);
  });

  it('persists profile business hours to crm_ai_entry_settings for n8n reads', async () => {
    const onDone = vi.fn();

    render(
      <DataProvider>
        <UpdateBusinessProfileOnLoad onDone={onDone} />
      </DataProvider>
    );

    await waitFor(() => expect(onDone).toHaveBeenCalled());

    expect(upsertCalls).toContainEqual({
      table: 'crm_ai_entry_settings',
      payload: expect.objectContaining({
        store_id: 'st-cae5b9ed-d4e6-405f-9151-1c80542992ec',
        business_hours: expect.objectContaining({
          mon: { open: '09:00', close: '22:00' },
          sun: { open: '14:00', close: '20:00' },
        }),
        special_business_hours: {
          '2026-04-03': {
            closed: true,
            label: 'Páscoa',
          },
        },
      }),
    });
  });
});

describe('DataProvider transferBetweenAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channelStatusRef.current = null;
    insertCalls.length = 0;
    upsertCalls.length = 0;
    deleteCalls.length = 0;
    queryCalls.length = 0;
    rpcMock.mockResolvedValue({ data: null, error: null });
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      role: 'admin'
    });
    initialRowsByTable.transactions = [];
    fromMock.mockImplementation(createAdminQuery);
  });

  it('does not duplicate transfer rows when realtime arrives before the RPC response', async () => {
    initialRowsByTable.transactions = [];
    const onValue = vi.fn();
    const rows = [
      {
        id: 'trx-transfer-out',
        type: 'OUT',
        category: 'Transferência',
        amount: 25,
        date: '2026-07-06T12:00:00.000Z',
        description: 'Transferência para Cofre',
        account: 'Conta Bancária',
        transfer_group_id: 'trf-race'
      },
      {
        id: 'trx-transfer-in',
        type: 'IN',
        category: 'Transferência',
        amount: 25,
        date: '2026-07-06T12:00:00.000Z',
        description: 'Transferência de Conta Bancária',
        account: 'Cofre',
        transfer_group_id: 'trf-race'
      }
    ];

    render(<DataProvider><DataContractProbe onValue={onValue} /></DataProvider>);
    await waitFor(() => expect(onValue.mock.calls.at(-1)?.[0].loading).toBe(false));

    const handler = channelOnMock.mock.calls.find((call) => call[1]?.table === 'transactions')?.[2];
    expect(handler).toBeTypeOf('function');

    await act(async () => {
      await handler({ eventType: 'INSERT', new: rows[0] });
      await handler({ eventType: 'INSERT', new: rows[1] });
    });

    rpcMock.mockResolvedValueOnce({ data: rows, error: null });
    await act(async () => {
      await onValue.mock.calls.at(-1)?.[0].transferBetweenAccounts('Conta Bancária', 'Cofre', 25);
    });

    await waitFor(() => {
      const transactions = onValue.mock.calls.at(-1)?.[0].transactions;
      expect(transactions.map((item: Transaction) => item.id)).toEqual([
        'trx-transfer-out',
        'trx-transfer-in'
      ]);
    });
  });

  it('fails loudly when the RPC does not return the transaction rows', async () => {
    const onValue = vi.fn();
    render(<DataProvider><DataContractProbe onValue={onValue} /></DataProvider>);
    await waitFor(() => expect(onValue.mock.calls.at(-1)?.[0].loading).toBe(false));

    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    const transfer = onValue.mock.calls.at(-1)?.[0].transferBetweenAccounts;

    await expect(transfer('Conta Bancária', 'Cofre', 25)).rejects.toThrow(
      'Resposta inválida ao transferir entre contas.'
    );

    const transactions = onValue.mock.calls.at(-1)?.[0].transactions;
    expect(transactions).toEqual([]);
  });
});
