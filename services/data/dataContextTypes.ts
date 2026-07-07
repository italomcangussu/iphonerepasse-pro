import type {
  BusinessProfile,
  CardFeeSettings,
  CostItem,
  Creditor,
  Customer,
  Debt,
  DebtPayment,
  DebtSource,
  DeviceCatalogItem,
  FinancialAccount,
  FinancialCategory,
  PartStockItem,
  PayableDebt,
  PayableDebtPayment,
  Sale,
  Seller,
  SimulatorTradeInAdjustment,
  SimulatorTradeInValue,
  StockItem,
  StockReservationInput,
  StoreLocation,
  Transaction
} from '../../types';

export interface DataContextType {
  businessProfile: BusinessProfile;
  cardFeeSettings: CardFeeSettings;
  simulatorTradeInValues: SimulatorTradeInValue[];
  simulatorTradeInAdjustments: SimulatorTradeInAdjustment[];
  stock: StockItem[];
  customers: Customer[];
  sellers: Seller[];
  debts: Debt[];
  debtPayments: DebtPayment[];
  stores: StoreLocation[];
  deviceCatalog: DeviceCatalogItem[];
  transactions: Transaction[];
  sales: Sale[];
  costHistory: CostHistoryItem[];
  partsInventory: PartStockItem[];
  financialCategories: FinancialCategory[];
  creditors: Creditor[];
  payableDebts: PayableDebt[];
  payableDebtPayments: PayableDebtPayment[];
  loading: boolean;
  salesHistoryLoading: boolean;
  financeLoading: boolean;
  refreshData: () => Promise<void>;
  ensureSalesHistoryLoaded: () => Promise<void>;
  ensureFinanceLoaded: () => Promise<void>;
  updateBusinessProfile: (profile: BusinessProfile) => Promise<void>;
  updateCardFeeSettings: (settings: CardFeeSettings) => Promise<void>;
  upsertSimulatorTradeInValue: (
    value: Partial<SimulatorTradeInValue> & Pick<SimulatorTradeInValue, 'model' | 'capacity' | 'baseValue'>
  ) => Promise<void>;
  updateSimulatorTradeInValue: (
    id: string,
    updates: Partial<Omit<SimulatorTradeInValue, 'id' | 'createdAt' | 'updatedAt'>>
  ) => Promise<void>;
  removeSimulatorTradeInValue: (id: string) => Promise<void>;
  upsertSimulatorTradeInAdjustment: (
    adjustment: Partial<SimulatorTradeInAdjustment> & Pick<SimulatorTradeInAdjustment, 'label' | 'amountDelta'>
  ) => Promise<void>;
  updateSimulatorTradeInAdjustment: (
    id: string,
    updates: Partial<Omit<SimulatorTradeInAdjustment, 'id' | 'createdAt' | 'updatedAt'>>
  ) => Promise<void>;
  removeSimulatorTradeInAdjustment: (id: string) => Promise<void>;
  addStockItem: (item: StockItem) => Promise<void>;
  updateStockItem: (id: string, updates: Partial<StockItem>) => Promise<void>;
  removeStockItem: (id: string) => Promise<void>;
  reserveStockItem: (stockItemId: string, input: StockReservationInput) => Promise<void>;
  updateStockReservation: (reservationId: string, input: StockReservationInput) => Promise<void>;
  releaseStockReservation: (
    stockItemId: string,
    options?: { refundDeposit?: boolean }
  ) => Promise<void>;
  addCustomer: (customer: Customer) => Promise<void>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  removeCustomer: (id: string) => Promise<void>;
  findOrCreateCustomer: (input: Partial<Customer> & { name: string }) => Promise<Customer>;
  addSeller: (seller: Seller) => Promise<void>;
  updateSeller: (id: string, updates: Partial<Seller>) => Promise<void>;
  removeSeller: (id: string) => Promise<void>;
  addStore: (store: StoreLocation) => Promise<void>;
  updateStore: (id: string, updates: Partial<StoreLocation>) => Promise<void>;
  removeStore: (id: string) => Promise<void>;
  addDeviceCatalogItem: (item: Omit<DeviceCatalogItem, 'id'> & { id?: string }) => Promise<DeviceCatalogItem>;
  addSale: (sale: Sale) => Promise<void>;
  updateSale: (saleId: string, updates: Partial<Sale>) => Promise<void>;
  removeSale: (saleId: string) => Promise<void>;
  addDebt: (debt: AddDebtInput) => Promise<Debt>;
  updateDebt: (debtId: string, updates: UpdateDebtInput) => Promise<Debt>;
  removeDebt: (debtId: string) => Promise<void>;
  payDebt: (payment: PayDebtInput) => Promise<void>;
  getDebtPayments: (debtId: string) => DebtPayment[];
  removeDebtPayment: (paymentId: string) => Promise<void>;
  addTransaction: (transaction: Transaction) => Promise<void>;
  updateTransaction: (id: string, updates: Omit<Transaction, 'id'>) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  transferBetweenAccounts: (from: FinancialAccount, to: FinancialAccount, amount: number) => Promise<void>;
  addCostHistory: (model: string, description: string, amount: number) => Promise<void>;
  getCostHistoryByModel: (model: string) => CostHistoryItem[];
  addCostToItem: (itemId: string, cost: CostItem) => Promise<void>;
  addPart: (part: AddPartInput) => Promise<PartStockItem>;
  updatePart: (id: string, updates: UpdatePartInput) => Promise<void>;
  removePart: (id: string) => Promise<void>;
  addPartCostToItem: (itemId: string, partId: string, quantity: number) => Promise<CostItem>;
  addFinancialCategory: (category: Omit<FinancialCategory, 'id' | 'createdAt'>) => Promise<void>;
  updateFinancialCategory: (id: string, updates: Partial<FinancialCategory>) => Promise<void>;
  removeFinancialCategory: (id: string) => Promise<void>;
  addCreditor: (creditor: Omit<Creditor, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Creditor>;
  updateCreditor: (
    id: string,
    updates: Partial<Omit<Creditor, 'id' | 'createdAt' | 'updatedAt'>>
  ) => Promise<void>;
  removeCreditor: (id: string) => Promise<void>;
  addPayableDebt: (input: AddPayableDebtInput) => Promise<PayableDebt>;
  updatePayableDebt: (id: string, updates: UpdatePayableDebtInput) => Promise<void>;
  removePayableDebt: (id: string) => Promise<void>;
  addPayableDebtPayment: (input: AddPayableDebtPaymentInput) => Promise<void>;
  revertPayableDebtPayment: (paymentId: string) => Promise<void>;
  getPayableDebtPayments: (payableDebtId: string) => PayableDebtPayment[];
}

export interface CostHistoryItem {
  id: string;
  model: string;
  description: string;
  amount: number;
  count: number;
  lastUsed: string;
}

export interface AddDebtInput {
  customerId?: string;
  customer?: Partial<Customer> & { name: string };
  amount: number;
  dueDate?: string;
  firstDueDate?: string;
  installmentsTotal?: number;
  notes?: string;
  saleId?: string;
  source?: DebtSource;
  customBadge?: string;
}

export interface UpdateDebtInput {
  amount?: number;
  dueDate?: string;
  firstDueDate?: string;
  installmentsTotal?: number;
  notes?: string;
  customBadge?: string;
}

export interface PayDebtInput {
  debtId: string;
  amount: number;
  paymentMethod: 'Pix' | 'Dinheiro' | 'Cartão' | 'Cartão Débito';
  account: FinancialAccount;
  notes?: string;
  paidAt?: string;
}

export interface AddPayableDebtInput {
  creditorId: string;
  amount: number;
  account: 'Conta Bancária' | 'Cofre';
  dueDate?: string;
  firstDueDate?: string;
  installmentsTotal?: number;
  notes?: string;
}

export interface UpdatePayableDebtInput {
  amount?: number;
  dueDate?: string;
  firstDueDate?: string;
  installmentsTotal?: number;
  notes?: string;
}

export interface AddPayableDebtPaymentInput {
  payableDebtId: string;
  amount: number;
  paymentMethod: 'Pix' | 'Dinheiro' | 'Cartão' | 'Cartão Débito';
  account: 'Conta Bancária' | 'Cofre';
  notes?: string;
  paidAt?: string;
  attachmentPath?: string;
  attachmentMime?: string;
  attachmentName?: string;
  attachmentSize?: number;
}

export interface AddPartInput {
  name: string;
  quantity: number;
  unitCost: number;
}

export interface UpdatePartInput {
  name?: string;
  quantity?: number;
  unitCost?: number;
}
