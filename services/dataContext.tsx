import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  StockItem,
  Customer,
  Seller,
  Transaction,
  Sale,
  StockStatus,
  DeviceType,
  Condition,
  WarrantyType,
  StoreLocation,
  BusinessProfile,
  CostItem,
  PaymentMethod,
  DeviceCatalogItem,
  Debt,
  DebtPayment,
  DebtSource,
  PartStockItem,
  CardFeeSettings,
  FinancialAccount,
  SaleTradeInItem,
  FinancialCategory,
  Creditor,
  PayableDebt,
  PayableDebtPayment,
  PayableDebtStatus
} from '../types';
import { supabase } from './supabase';
import { newId } from '../utils/id';
import { useAuth } from '../contexts/AuthContext';
import { matchCustomerByPriority } from '../utils/debts';
import { DEFAULT_CARD_FEE_SETTINGS, normalizeCardFeeSettings } from '../utils/cardFees';
import { trackUxEvent } from './telemetry';
import { normalizeFinancialAccount } from '../utils/financialAccounts';

// Types for DB mapping if needed, or just map manually
interface DataContextType {
  businessProfile: BusinessProfile;
  cardFeeSettings: CardFeeSettings;
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
  refreshData: () => Promise<void>;

  // Actions
  updateBusinessProfile: (profile: BusinessProfile) => Promise<void>;
  updateCardFeeSettings: (settings: CardFeeSettings) => Promise<void>;
  addStockItem: (item: StockItem) => Promise<void>;
  updateStockItem: (id: string, updates: Partial<StockItem>) => Promise<void>;
  removeStockItem: (id: string) => Promise<void>;
  
  addCustomer: (customer: Customer) => Promise<void>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  removeCustomer: (id: string) => Promise<void>;
  
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
  
  // Cost management
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
  updateCreditor: (id: string, updates: Partial<Omit<Creditor, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
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

const DataContext = createContext<DataContextType | undefined>(undefined);

const DEFAULT_BUSINESS_PROFILE: BusinessProfile = {
  name: 'iPhoneRepasse',
  cnpj: '',
  phone: '',
  email: '',
  address: '',
  instagram: '',
};

const SALES_SELECT =
  '*, sale_items(*, stock_item:stock_items(*, costs(*))), payment_methods(*), sale_trade_in_items(*), customer:customers(*), seller:sellers(*)';

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading: authLoading, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(DEFAULT_BUSINESS_PROFILE);
  const [cardFeeSettings, setCardFeeSettings] = useState<CardFeeSettings>(DEFAULT_CARD_FEE_SETTINGS);

  const [stock, setStock] = useState<StockItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtPayments, setDebtPayments] = useState<DebtPayment[]>([]);
  const [stores, setStores] = useState<StoreLocation[]>([]);
  const [deviceCatalog, setDeviceCatalog] = useState<DeviceCatalogItem[]>([]);
  const [partsInventory, setPartsInventory] = useState<PartStockItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [costHistory, setCostHistory] = useState<CostHistoryItem[]>([]);
  const [financialCategories, setFinancialCategories] = useState<FinancialCategory[]>([]);
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [payableDebts, setPayableDebts] = useState<PayableDebt[]>([]);
  const [payableDebtPayments, setPayableDebtPayments] = useState<PayableDebtPayment[]>([]);

  const logDataEvent = useCallback(
    (name: string, screen: string, metadata?: Record<string, string | number | boolean>) => {
      trackUxEvent({
        name,
        screen,
        role: role || undefined,
        metadata,
        ts: new Date().toISOString(),
      });
    },
    [role]
  );

  const resetState = useCallback(() => {
    setBusinessProfile(DEFAULT_BUSINESS_PROFILE);
    setCardFeeSettings(DEFAULT_CARD_FEE_SETTINGS);
    setStock([]);
    setCustomers([]);
    setSellers([]);
    setDebts([]);
    setDebtPayments([]);
    setStores([]);
    setDeviceCatalog([]);
    setPartsInventory([]);
    setTransactions([]);
    setSales([]);
    setCostHistory([]);
    setFinancialCategories([]);
    setCreditors([]);
    setPayableDebts([]);
    setPayableDebtPayments([]);
  }, []);

  // Fetch all data
  const fetchData = async () => {
    if (!isAuthenticated) {
      resetState();
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
        // Business Profile
        const { data: profile } = await supabase.from('business_profile').select('*').single();
        if (profile) setBusinessProfile(mapProfile(profile));

        const { data: cardFeeSettingsData, error: cardFeeSettingsError } = await supabase
          .from('card_fee_settings')
          .select('*')
          .eq('id', 'default')
          .single();
        if (cardFeeSettingsError) {
          console.error('Error fetching card fee settings:', cardFeeSettingsError);
        }
        if (cardFeeSettingsData) {
          setCardFeeSettings(
            normalizeCardFeeSettings({
              visaMasterRates: cardFeeSettingsData.visa_master_rates,
              otherRates: cardFeeSettingsData.other_rates,
              debitRate: cardFeeSettingsData.debit_rate
            })
          );
        } else {
          setCardFeeSettings(DEFAULT_CARD_FEE_SETTINGS);
        }

        // Stores
        const { data: storesData } = await supabase.from('stores').select('*');
        if (storesData) setStores(storesData);

        // Customers
        const { data: customersData } = await supabase.from('customers').select('*');
        if (customersData) setCustomers(customersData.map(mapCustomer));

        // Sellers
        const { data: sellersData } = await supabase.from('sellers').select('*');
        if (sellersData) setSellers(mapSellers(sellersData));

        if (role === 'admin') {
          const { data: debtsData, error: debtsError } = await supabase.from('debts').select('*').order('created_at', { ascending: false });
          if (debtsError) console.error('Error fetching debts:', debtsError);
          if (debtsData) setDebts(debtsData.map(mapDebt));

          const { data: debtPaymentsData, error: debtPaymentsError } = await supabase
            .from('debt_payments')
            .select('*')
            .order('paid_at', { ascending: false });
          if (debtPaymentsError) console.error('Error fetching debt payments:', debtPaymentsError);
          if (debtPaymentsData) setDebtPayments(debtPaymentsData.map(mapDebtPayment));
        } else {
          setDebts([]);
          setDebtPayments([]);
        }

        // Stock Items & Costs
        const { data: stockData } = await supabase.from('stock_items').select('*, costs(*)');
        if (stockData) setStock(stockData.map(mapStockItem));

        // Device catalog (custom model/type/color options)
        const { data: deviceCatalogData, error: deviceCatalogError } = await supabase
          .from('device_catalog')
          .select('*')
          .order('created_at', { ascending: false });
        if (deviceCatalogError) console.error('Error fetching device catalog:', deviceCatalogError);
        if (deviceCatalogData) setDeviceCatalog(deviceCatalogData.map(mapDeviceCatalogItem));

        const { data: partsData, error: partsError } = await supabase
          .from('parts_inventory')
          .select('*')
          .order('name', { ascending: true });
        if (partsError) console.error('Error fetching parts inventory:', partsError);
        if (partsData) setPartsInventory(partsData.map(mapPartStockItem));

        // Sales with sale items + linked stock item (including costs) + payment methods.
        const { data: salesData } = await supabase.from('sales').select(SALES_SELECT);
        if (salesData) setSales(salesData.map(mapSale));

        if (role === 'admin') {
          const { data: trxData, error: trxError } = await supabase
            .from('transactions')
            .select('*')
            .order('date', { ascending: false })
            .limit(100000);
          if (trxError) console.error('Error fetching transactions:', trxError);
          if (trxData) setTransactions(trxData.map(mapTransaction));
        } else {
          setTransactions([]);
        }

        // Cost History
        const { data: costHistoryData, error: costHistoryError } = await supabase.from('cost_history').select('*');
        if (costHistoryError) console.error('Error fetching cost history:', costHistoryError);
        if (costHistoryData) setCostHistory(costHistoryData.map(mapCostHistory));
        
        // Financial Categories
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('finance_categories')
          .select('*')
          .order('name', { ascending: true });
        if (categoriesError) console.error('Error fetching finance categories:', categoriesError);
        if (categoriesData) setFinancialCategories(categoriesData.map(mapFinancialCategory));

        if (role === 'admin') {
          const { data: creditorsData, error: creditorsError } = await supabase
            .from('creditors')
            .select('*')
            .order('name', { ascending: true });
          if (creditorsError) console.error('Error fetching creditors:', creditorsError);
          if (creditorsData) setCreditors(creditorsData.map(mapCreditor));

          const { data: payableDebtsData, error: payableDebtsError } = await supabase
            .from('payable_debts')
            .select('*')
            .order('created_at', { ascending: false });
          if (payableDebtsError) console.error('Error fetching payable debts:', payableDebtsError);
          if (payableDebtsData) setPayableDebts(payableDebtsData.map(mapPayableDebt));

          const { data: payableDebtPaymentsData, error: payableDebtPaymentsError } = await supabase
            .from('payable_debt_payments')
            .select('*')
            .order('paid_at', { ascending: false });
          if (payableDebtPaymentsError) console.error('Error fetching payable debt payments:', payableDebtPaymentsError);
          if (payableDebtPaymentsData) setPayableDebtPayments(payableDebtPaymentsData.map(mapPayableDebtPayment));
        } else {
          setCreditors([]);
          setPayableDebts([]);
          setPayableDebtPayments([]);
        }

    } catch (error) {
        console.error('Error fetching data:', error);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    void fetchData();
  }, [authLoading, isAuthenticated, role]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const channel = supabase
      .channel('data-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, async (payload) => {
        if (payload.eventType === 'DELETE') {
          setSales((prev) => prev.filter((s) => s.id !== (payload.old as { id: string }).id));
          return;
        }
        const id = (payload.new as { id: string }).id;
        const { data } = await supabase.from('sales').select(SALES_SELECT).eq('id', id).single();
        if (!data) return;
        const mapped = mapSale(data);
        if (payload.eventType === 'INSERT') {
          setSales((prev) => (prev.some((s) => s.id === id) ? prev : [...prev, mapped]));
        } else {
          setSales((prev) => prev.map((s) => (s.id === id ? mapped : s)));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload) => {
        if (role !== 'admin') return;
        if (payload.eventType === 'DELETE') {
          setTransactions((prev) => prev.filter((t) => t.id !== (payload.old as { id: string }).id));
        } else if (payload.eventType === 'INSERT') {
          const mapped = mapTransaction(payload.new);
          setTransactions((prev) => (prev.some((t) => t.id === mapped.id) ? prev : [...prev, mapped]));
        } else {
          const mapped = mapTransaction(payload.new);
          setTransactions((prev) => prev.map((t) => (t.id === mapped.id ? mapped : t)));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'debts' }, (payload) => {
        if (role !== 'admin') return;
        if (payload.eventType === 'DELETE') {
          setDebts((prev) => prev.filter((d) => d.id !== (payload.old as { id: string }).id));
        } else if (payload.eventType === 'INSERT') {
          const mapped = mapDebt(payload.new);
          setDebts((prev) => (prev.some((d) => d.id === mapped.id) ? prev : [...prev, mapped]));
        } else {
          const mapped = mapDebt(payload.new);
          setDebts((prev) => prev.map((d) => (d.id === mapped.id ? mapped : d)));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'debt_payments' }, (payload) => {
        if (role !== 'admin') return;
        if (payload.eventType === 'DELETE') {
          setDebtPayments((prev) => prev.filter((p) => p.id !== (payload.old as { id: string }).id));
        } else if (payload.eventType === 'INSERT') {
          const mapped = mapDebtPayment(payload.new);
          setDebtPayments((prev) => (prev.some((p) => p.id === mapped.id) ? prev : [...prev, mapped]));
        } else {
          const mapped = mapDebtPayment(payload.new);
          setDebtPayments((prev) => prev.map((p) => (p.id === mapped.id ? mapped : p)));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_items' }, async (payload) => {
        if (payload.eventType === 'DELETE') {
          setStock((prev) => prev.filter((s) => s.id !== (payload.old as { id: string }).id));
          return;
        }
        const id = (payload.new as { id: string }).id;
        const { data } = await supabase.from('stock_items').select('*, costs(*)').eq('id', id).single();
        if (!data) return;
        const mapped = mapStockItem(data);
        if (payload.eventType === 'INSERT') {
          setStock((prev) => (prev.some((s) => s.id === id) ? prev : [...prev, mapped]));
        } else {
          setStock((prev) => prev.map((s) => (s.id === id ? mapped : s)));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setCustomers((prev) => prev.filter((c) => c.id !== (payload.old as { id: string }).id));
        } else {
          const mapped = mapCustomer(payload.new);
          if (payload.eventType === 'INSERT') {
            setCustomers((prev) => (prev.some((c) => c.id === mapped.id) ? prev : [...prev, mapped]));
          } else {
            setCustomers((prev) => prev.map((c) => (c.id === mapped.id ? mapped : c)));
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sellers' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setSellers((prev) => prev.filter((s) => s.id !== (payload.old as { id: string }).id));
        } else {
          const mapped = mapSellers([payload.new])[0];
          if (payload.eventType === 'INSERT') {
            setSellers((prev) => (prev.some((s) => s.id === mapped.id) ? prev : [...prev, mapped]));
          } else {
            setSellers((prev) => prev.map((s) => (s.id === mapped.id ? mapped : s)));
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setStores((prev) => prev.filter((s) => s.id !== (payload.old as { id: string }).id));
        } else if (payload.eventType === 'INSERT') {
          const s = payload.new as StoreLocation;
          setStores((prev) => (prev.some((x) => x.id === s.id) ? prev : [...prev, s]));
        } else {
          const s = payload.new as StoreLocation;
          setStores((prev) => prev.map((x) => (x.id === s.id ? { ...x, ...s } : x)));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'costs' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const { id, stock_item_id } = payload.old as { id: string; stock_item_id: string };
          setStock((prev) =>
            prev.map((s) =>
              s.id === stock_item_id ? { ...s, costs: s.costs.filter((c) => c.id !== id) } : s
            )
          );
        } else {
          const raw = payload.new as { id: string; stock_item_id: string; description: string; amount: number; date: string };
          const cost = { id: raw.id, description: raw.description, amount: toNumber(raw.amount), date: raw.date };
          if (payload.eventType === 'INSERT') {
            setStock((prev) =>
              prev.map((s) =>
                s.id === raw.stock_item_id
                  ? { ...s, costs: s.costs.some((c) => c.id === cost.id) ? s.costs : [...s.costs, cost] }
                  : s
              )
            );
          } else {
            setStock((prev) =>
              prev.map((s) =>
                s.id === raw.stock_item_id
                  ? { ...s, costs: s.costs.map((c) => (c.id === cost.id ? cost : c)) }
                  : s
              )
            );
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parts_inventory' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setPartsInventory((prev) => prev.filter((p) => p.id !== (payload.old as { id: string }).id));
        } else {
          const mapped = mapPartStockItem(payload.new);
          if (payload.eventType === 'INSERT') {
            setPartsInventory((prev) =>
              prev.some((p) => p.id === mapped.id)
                ? prev
                : [...prev, mapped].sort((a, b) => a.name.localeCompare(b.name))
            );
          } else {
            setPartsInventory((prev) => prev.map((p) => (p.id === mapped.id ? mapped : p)));
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'device_catalog' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setDeviceCatalog((prev) => prev.filter((d) => d.id !== (payload.old as { id: string }).id));
        } else {
          const mapped = mapDeviceCatalogItem(payload.new);
          if (payload.eventType === 'INSERT') {
            setDeviceCatalog((prev) => (prev.some((d) => d.id === mapped.id) ? prev : [mapped, ...prev]));
          } else {
            setDeviceCatalog((prev) => prev.map((d) => (d.id === mapped.id ? mapped : d)));
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_categories' }, (payload) => {
        if (role !== 'admin') return;
        if (payload.eventType === 'DELETE') {
          setFinancialCategories((prev) => prev.filter((c) => c.id !== (payload.old as { id: string }).id));
        } else {
          const mapped = mapFinancialCategory(payload.new);
          if (payload.eventType === 'INSERT') {
            setFinancialCategories((prev) => (prev.some((c) => c.id === mapped.id) ? prev : [...prev, mapped]));
          } else {
            setFinancialCategories((prev) => prev.map((c) => (c.id === mapped.id ? mapped : c)));
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'creditors' }, (payload) => {
        if (role !== 'admin') return;
        if (payload.eventType === 'DELETE') {
          setCreditors((prev) => prev.filter((c) => c.id !== (payload.old as { id: string }).id));
        } else {
          const mapped = mapCreditor(payload.new);
          if (payload.eventType === 'INSERT') {
            setCreditors((prev) =>
              prev.some((c) => c.id === mapped.id)
                ? prev
                : [...prev, mapped].sort((a, b) => a.name.localeCompare(b.name))
            );
          } else {
            setCreditors((prev) => prev.map((c) => (c.id === mapped.id ? mapped : c)));
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payable_debts' }, (payload) => {
        if (role !== 'admin') return;
        if (payload.eventType === 'DELETE') {
          setPayableDebts((prev) => prev.filter((d) => d.id !== (payload.old as { id: string }).id));
        } else {
          const mapped = mapPayableDebt(payload.new);
          if (payload.eventType === 'INSERT') {
            setPayableDebts((prev) => (prev.some((d) => d.id === mapped.id) ? prev : [mapped, ...prev]));
          } else {
            setPayableDebts((prev) => prev.map((d) => (d.id === mapped.id ? mapped : d)));
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payable_debt_payments' }, (payload) => {
        if (role !== 'admin') return;
        if (payload.eventType === 'DELETE') {
          setPayableDebtPayments((prev) => prev.filter((p) => p.id !== (payload.old as { id: string }).id));
        } else {
          const mapped = mapPayableDebtPayment(payload.new);
          if (payload.eventType === 'INSERT') {
            setPayableDebtPayments((prev) => (prev.some((p) => p.id === mapped.id) ? prev : [...prev, mapped]));
          } else {
            setPayableDebtPayments((prev) => prev.map((p) => (p.id === mapped.id ? mapped : p)));
          }
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAuthenticated, role]);

  // --- Mappers ---
  const toNumber = (value: unknown, fallback = 0): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const toOptionalNumber = (value: unknown): number | undefined => {
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const mapProfile = (p: any): BusinessProfile => ({
    name: p.name, cnpj: p.cnpj, phone: p.phone, email: p.email, address: p.address, instagram: p.instagram, logoUrl: p.logo_url, primaryColor: p.primary_color
  });

  const mapCustomer = (c: any): Customer => ({
    id: c.id,
    name: c.name || '',
    cpf: c.cpf || '',
    phone: c.phone || '',
    email: c.email || '',
    birthDate: c.birth_date || '',
    purchases: Number(c.purchases || 0),
    totalSpent: Number(c.total_spent || 0)
  });

  const mapSellers = (s: any[]): Seller[] => s.map(seller => ({
    id: seller.id,
    name: seller.name,
    email: seller.email || '',
    authUserId: seller.auth_user_id || '',
    storeId: seller.store_id || '',
    totalSales: Number(seller.total_sales || 0)
  }));

  const mapStockItem = (i: any): StockItem => {
    const observations = i.observations ?? i.notes ?? '';
    const simType =
      i.sim_type === 'Physical' || i.sim_type === 'Virtual' || i.sim_type === 'Both'
        ? i.sim_type
        : undefined;
    return {
      id: i.id,
      type: i.type,
      model: i.model,
      color: i.color,
      hasBox: i.has_box ?? false,
      capacity: i.capacity,
      imei: i.imei,
      condition: i.condition,
      status: i.status,
      simType,
      batteryHealth: toOptionalNumber(i.battery_health),
      storeId: i.store_id,
      purchasePrice: toNumber(i.purchase_price),
      sellPrice: toNumber(i.sell_price),
      maxDiscount: toNumber(i.max_discount),
      warrantyType: i.warranty_type,
      warrantyEnd: i.warranty_end,
      warrantyExpiresAt: i.warranty_expires_at || i.warranty_end || null,
      origin: i.origin,
      notes: i.notes ?? observations,
      observations,
      entryDate: i.entry_date,
      photos: i.photos || [],
      costs: i.costs?.map((c: any) => ({ id: c.id, description: c.description, amount: toNumber(c.amount), date: c.date })) || []
    };
  };

  const mapSale = (s: any): Sale => {
    const items: StockItem[] = (s.sale_items || [])
      .map((si: any) => {
        const mappedStockItem = si?.stock_item
          ? mapStockItem(si.stock_item)
          : stock.find((stockItem) => stockItem.id === si?.stock_item_id) || null;

        if (!mappedStockItem) return null;

        const saleItemPrice = toOptionalNumber(si?.price);
        const originalSaleItemPrice = toOptionalNumber(si?.original_price);

        return {
          ...mappedStockItem,
          sellPrice: saleItemPrice ?? mappedStockItem.sellPrice,
          originalSellPrice: originalSaleItemPrice ?? mappedStockItem.sellPrice
        };
      })
      .filter((item: StockItem | null): item is StockItem => item !== null);

    const paymentMethods: PaymentMethod[] = (s.payment_methods || []).map((pm: any) => ({
      type: pm.type as PaymentMethod['type'],
      amount: toNumber(pm.amount),
      account: pm.account ? normalizeFinancialAccount(pm.account) : undefined,
      installments: toOptionalNumber(pm.installments),
      cardBrand: pm.card_brand || undefined,
      customerAmount: toOptionalNumber(pm.customer_amount),
      feeRate: toOptionalNumber(pm.fee_rate),
      feeAmount: toOptionalNumber(pm.fee_amount),
      debtDueDate: pm.debt_due_date || undefined,
      debtInstallments: toOptionalNumber(pm.debt_installments),
      debtNotes: pm.debt_notes || undefined
    }));

    const tradeIns: SaleTradeInItem[] = (s.sale_trade_in_items || []).map((tradeIn: any) => ({
      id: tradeIn.id,
      saleId: tradeIn.sale_id || s.id,
      stockItemId: tradeIn.stock_item_id || undefined,
      model: tradeIn.model || 'Trade-in',
      capacity: tradeIn.capacity || undefined,
      color: tradeIn.color || undefined,
      imei: tradeIn.imei || undefined,
      condition: tradeIn.condition || undefined,
      receivedValue: toNumber(tradeIn.received_value)
    }));

    const tradeInValue =
      tradeIns.length > 0
        ? tradeIns.reduce((acc, tradeIn) => acc + toNumber(tradeIn.receivedValue), 0)
        : toNumber(s.trade_in_value);

    const legacyTradeIn = s.trade_in_id
      ? stock.find((stockItem) => stockItem.id === s.trade_in_id)
      : undefined;

    const fallbackNegotiatedSubtotal = items.reduce((acc, item) => acc + toNumber(item.sellPrice), 0);
    const fallbackOriginalSubtotal = items.reduce(
      (acc, item) => acc + toNumber(item.originalSellPrice ?? item.sellPrice),
      0
    );

    return {
      id: s.id,
      customerId: s.customer_id,
      sellerId: s.seller_id,
      items,
      tradeIn: legacyTradeIn,
      tradeIns,
      tradeInValue,
      discount: toNumber(s.discount),
      discountType: s.discount_type || null,
      discountPercent: toOptionalNumber(s.discount_percent) ?? null,
      originalSubtotal: toNumber(s.original_subtotal, fallbackOriginalSubtotal),
      negotiatedSubtotal: toNumber(s.negotiated_subtotal, fallbackNegotiatedSubtotal),
      total: toNumber(s.total),
      paymentMethods,
      date: s.date,
      warrantyExpiresAt: s.warranty_expires_at || null,
      storeId: s.store_id || undefined,
      notes: s.notes || undefined,
      clientPaymentAmount: toOptionalNumber(s.client_payment_amount) ?? null,
      clientPaymentMode: (s.client_payment_mode as 'immediate' | 'payable_debt' | null) ?? null,
      clientPaymentAccount: s.client_payment_account || null,
      clientPaymentMethod: s.client_payment_method || null,
      clientPaymentNotes: s.client_payment_notes || null,
      clientPaymentDueDate: s.client_payment_due_date || null,
      observations: s.observations || undefined
    };
  };

  const mapCostHistory = (h: any): CostHistoryItem => ({
     id: h.id, model: h.model, description: h.description, amount: toNumber(h.amount), count: toNumber(h.count), lastUsed: h.last_used
  });

  const mapDebt = (d: any): Debt => ({
    id: d.id,
    customerId: d.customer_id,
    saleId: d.sale_id || undefined,
    originalAmount: Number(d.original_amount || 0),
    remainingAmount: Number(d.remaining_amount || 0),
    status: d.status,
    dueDate: d.due_date || undefined,
    firstDueDate: d.first_due_date || d.due_date || undefined,
    installmentsTotal: Number(d.installments_total || 1),
    notes: d.notes || undefined,
    source: d.source,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    customBadge: d.custom_badge || undefined
  });

  const mapDebtPayment = (p: any): DebtPayment => ({
    id: p.id,
    debtId: p.debt_id,
    amount: Number(p.amount || 0),
    paymentMethod: p.payment_method,
    account: normalizeFinancialAccount(p.account),
    paidAt: p.paid_at,
    notes: p.notes || undefined,
    createdAt: p.created_at
  });

  const mapDeviceCatalogItem = (d: any): DeviceCatalogItem => ({
    id: d.id,
    type: d.type as DeviceType,
    model: d.model,
    color: d.color || ''
  });

  const mapPartStockItem = (p: any): PartStockItem => ({
    id: p.id,
    name: p.name || '',
    quantity: Number(p.quantity || 0),
    unitCost: Number(p.unit_cost || 0),
    createdAt: p.created_at,
    updatedAt: p.updated_at
  });

  const mapTransaction = (t: any): Transaction => ({
    id: t.id,
    type: t.type,
    category: t.category,
    amount: toNumber(t.amount),
    date: t.date,
    description: t.description || '',
    account: normalizeFinancialAccount(t.account),
    saleId: t.sale_id ?? null,
    debtPaymentId: t.debt_payment_id ?? null,
    payableDebtPaymentId: t.payable_debt_payment_id ?? null,
    payableDebtId: t.payable_debt_id ?? null
  });

  const mapFinancialCategory = (c: any): FinancialCategory => ({
    id: c.id,
    name: c.name,
    type: c.type as 'IN' | 'OUT',
    isDefault: c.is_default,
    createdAt: c.created_at
  });

  const mapCreditor = (c: any): Creditor => ({
    id: c.id,
    name: c.name,
    document: c.document || undefined,
    documentType: c.document_type || undefined,
    phone: c.phone || undefined,
    email: c.email || undefined,
    notes: c.notes || undefined,
    createdAt: c.created_at,
    updatedAt: c.updated_at
  });

  const mapPayableDebt = (d: any): PayableDebt => ({
    id: d.id,
    creditorId: d.creditor_id,
    creditorName: d.creditor_name || '',
    creditorDocument: d.creditor_document || undefined,
    creditorPhone: d.creditor_phone || undefined,
    originalAmount: Number(d.original_amount || 0),
    remainingAmount: Number(d.remaining_amount || 0),
    status: d.status as PayableDebtStatus,
    dueDate: d.due_date || undefined,
    firstDueDate: d.first_due_date || d.due_date || undefined,
    installmentsTotal: d.installments_total ? Number(d.installments_total) : undefined,
    notes: d.notes || undefined,
    source: d.source || 'manual',
    saleId: d.sale_id || null,
    entryAccount: d.entry_account || undefined,
    createdAt: d.created_at,
    updatedAt: d.updated_at
  });

  const mapPayableDebtPayment = (p: any): PayableDebtPayment => ({
    id: p.id,
    payableDebtId: p.payable_debt_id,
    amount: Number(p.amount || 0),
    paymentMethod: p.payment_method,
    account: p.account,
    paidAt: p.paid_at,
    notes: p.notes || undefined,
    attachmentPath: p.attachment_path || undefined,
    attachmentMime: p.attachment_mime || undefined,
    attachmentName: p.attachment_name || undefined,
    attachmentSize: p.attachment_size ? Number(p.attachment_size) : undefined,
    createdAt: p.created_at
  });

  // --- Actions ---

  const updateBusinessProfile = async (profile: BusinessProfile) => {
    // Upsert
    const { error } = await supabase.from('business_profile').upsert({
        id: '1', // singleton
        name: profile.name, cnpj: profile.cnpj, phone: profile.phone, email: profile.email, address: profile.address, instagram: profile.instagram, logo_url: profile.logoUrl, primary_color: profile.primaryColor
    });
    if (error) {
        console.error('Error updating business profile:', error);
        throw error;
    }
    setBusinessProfile(profile);
  };

  const updateCardFeeSettings = async (settings: CardFeeSettings): Promise<void> => {
    const normalized = normalizeCardFeeSettings(settings);
    const { error } = await supabase
      .from('card_fee_settings')
      .upsert({
        id: 'default',
        visa_master_rates: normalized.visaMasterRates,
        other_rates: normalized.otherRates,
        debit_rate: normalized.debitRate
      });

    if (error) throw error;
    setCardFeeSettings(normalized);
  };

  const addStockItem = async (item: StockItem) => {
     const observations = item.observations ?? item.notes ?? '';
     // Insert Stock Item
     const { data, error } = await supabase.from('stock_items').insert({
        id: item.id || newId('stk'),
        type: item.type,
        model: item.model,
        color: item.color,
        has_box: item.hasBox ?? false,
        capacity: item.capacity,
        imei: item.imei,
        condition: item.condition,
        status: item.status,
        sim_type: item.simType || 'Physical',
        battery_health: item.batteryHealth,
        store_id: item.storeId,
        purchase_price: item.purchasePrice,
        sell_price: item.sellPrice,
        max_discount: item.maxDiscount,
        warranty_type: item.warrantyType,
        warranty_end: item.warrantyEnd,
        origin: item.origin,
        notes: observations,
        observations,
        entry_date: item.entryDate,
        photos: item.photos
     }).select().single();

     if (error) {
         console.error('Error adding stock item:', error);
         throw error;
     }

     if (data) {
         // Insert Costs
         if (item.costs && item.costs.length > 0) {
             const { error: costError } = await supabase.from('costs').insert(item.costs.map(c => ({
                 id: c.id || newId('cost'),
                 stock_item_id: data.id, description: c.description, amount: c.amount, date: c.date
             })));
             if (costError) console.error('Error adding costs:', costError);
         }
         
         // Refresh local state (easiest way to ensure consistency)
         const { data: newItem, error: fetchError } = await supabase.from('stock_items').select('*, costs(*)').eq('id', data.id).single();
         if (fetchError) console.error('Error fetching new item:', fetchError);
         if (newItem) {
           setStock(prev => [...prev, mapStockItem(newItem)]);
           logDataEvent('inventory_item_created', 'Inventory', { itemId: data.id });
         }
     }
  };

  const updateStockItem = async (id: string, updates: Partial<StockItem>) => {
    // Map updates to snake_case
    const dbUpdates: any = {};
    if (updates.type) dbUpdates.type = updates.type;
    if (updates.model) dbUpdates.model = updates.model;
    if (updates.color) dbUpdates.color = updates.color;
    if (updates.hasBox !== undefined) dbUpdates.has_box = updates.hasBox;
    if (updates.capacity) dbUpdates.capacity = updates.capacity;
    if (updates.imei) dbUpdates.imei = updates.imei;
    if (updates.condition) dbUpdates.condition = updates.condition;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.simType !== undefined) dbUpdates.sim_type = updates.simType;
    if (updates.batteryHealth !== undefined) dbUpdates.battery_health = updates.batteryHealth;
    if (updates.storeId !== undefined) dbUpdates.store_id = updates.storeId;
    if (updates.purchasePrice !== undefined) dbUpdates.purchase_price = updates.purchasePrice;
    if (updates.sellPrice !== undefined) dbUpdates.sell_price = updates.sellPrice;
    if (updates.maxDiscount !== undefined) dbUpdates.max_discount = updates.maxDiscount;
    if (updates.warrantyType) dbUpdates.warranty_type = updates.warrantyType;
    if (updates.warrantyEnd !== undefined) dbUpdates.warranty_end = updates.warrantyEnd;
    if (updates.origin !== undefined) dbUpdates.origin = updates.origin;
    const mergedObservations = updates.observations ?? updates.notes;
    if (mergedObservations !== undefined) {
      dbUpdates.notes = mergedObservations;
      dbUpdates.observations = mergedObservations;
    }
    if (updates.photos !== undefined) dbUpdates.photos = updates.photos;

    const { error } = await supabase.from('stock_items').update(dbUpdates).eq('id', id);
    if (error) {
        console.error('Error updating stock item:', error);
        throw error;
    }
    setStock(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    logDataEvent('inventory_item_updated', 'Inventory', {
      itemId: id,
      hasStatusChange: updates.status !== undefined,
    });
  };

  const removeStockItem = async (id: string) => {
    const { error } = await supabase.from('stock_items').delete().eq('id', id);
    if (error) {
      console.error('Error removing stock item:', error);
      throw error;
    }

    setStock(prev => prev.filter(item => item.id !== id));
    logDataEvent('inventory_item_removed', 'Inventory', { itemId: id });
  };

  const addCustomer = async (customer: Customer) => {
    const normalizedName = customer.name.trim().toUpperCase();
    const { data, error } = await supabase.from('customers').insert({
        id: customer.id || newId('cust'),
        name: normalizedName,
        cpf: customer.cpf || null,
        phone: customer.phone,
        email: customer.email,
        birth_date: customer.birthDate || null,
        purchases: customer.purchases,
        total_spent: customer.totalSpent
    }).select().single();
    if (error) throw error;
    if (data) setCustomers(prev => [...prev, mapCustomer(data)]);
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name.trim().toUpperCase();
    if (updates.cpf !== undefined) dbUpdates.cpf = updates.cpf || null;
    if (updates.phone) dbUpdates.phone = updates.phone;
    if (updates.email) dbUpdates.email = updates.email;
    if (updates.birthDate) dbUpdates.birth_date = updates.birthDate;
    if (updates.purchases !== undefined) dbUpdates.purchases = updates.purchases;
    if (updates.totalSpent !== undefined) dbUpdates.total_spent = updates.totalSpent;
    
    const { error } = await supabase.from('customers').update(dbUpdates).eq('id', id);
    if (error) throw error;
    const normalizedUpdates = {
      ...updates,
      name: updates.name ? updates.name.trim().toUpperCase() : updates.name
    };
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...normalizedUpdates } : c));
  };

  const removeCustomer = async (id: string) => {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if(!error) setCustomers(prev => prev.filter(c => c.id !== id));
  };

  const findOrCreateCustomerForDebt = async (input: Partial<Customer> & { name: string }): Promise<Customer> => {
    const matchedLocal = matchCustomerByPriority(customers, input);
    if (matchedLocal) return matchedLocal;

    const { data: allCustomers, error: allCustomersError } = await supabase.from('customers').select('*');
    if (allCustomersError) throw allCustomersError;

    const mappedAllCustomers = (allCustomers || []).map(mapCustomer);
    const matchedRemote = matchCustomerByPriority(mappedAllCustomers, input);
    if (matchedRemote) {
      setCustomers(mappedAllCustomers);
      return matchedRemote;
    }

    const payload = {
      id: newId('cust'),
      name: input.name.trim().toUpperCase(),
      cpf: input.cpf || null,
      phone: input.phone || '',
      email: input.email || '',
      birth_date: input.birthDate || null,
      purchases: 0,
      total_spent: 0
    };

    const { data: createdCustomer, error: createCustomerError } = await supabase
      .from('customers')
      .insert(payload)
      .select('*')
      .single();

    if (createCustomerError) throw createCustomerError;

    const mappedCustomer = mapCustomer(createdCustomer);
    setCustomers((prev) => {
      if (prev.some((c) => c.id === mappedCustomer.id)) return prev;
      return [...prev, mappedCustomer];
    });
    return mappedCustomer;
  };

  const addDebt = async (debt: AddDebtInput): Promise<Debt> => {
    if (!debt.amount || debt.amount <= 0) {
      throw new Error('Informe um valor de dívida maior que zero.');
    }
    const installmentsTotal = Math.max(1, Math.floor(Number(debt.installmentsTotal || 1)));
    const firstDueDate = debt.firstDueDate || debt.dueDate;

    let customerId = debt.customerId || '';

    if (!customerId) {
      if (!debt.customer?.name?.trim()) {
        throw new Error('Selecione ou informe um cliente para cadastrar o devedor.');
      }
      const customer = await findOrCreateCustomerForDebt({ ...debt.customer, name: debt.customer.name.trim() });
      customerId = customer.id;
    }

    const { data, error } = await supabase
      .from('debts')
      .insert({
        id: newId('debt'),
        customer_id: customerId,
        sale_id: debt.saleId || null,
        original_amount: debt.amount,
        remaining_amount: debt.amount,
        status: 'Aberta',
        due_date: firstDueDate || null,
        first_due_date: firstDueDate || null,
        installments_total: installmentsTotal,
        notes: debt.notes || null,
        custom_badge: debt.customBadge || null,
        source: debt.source || 'manual'
      })
      .select('*')
      .single();

    if (error) throw error;

    const mappedDebt = mapDebt(data);
    setDebts((prev) => [mappedDebt, ...prev]);
    logDataEvent('debt_created', 'Debtors', {
      debtId: mappedDebt.id,
      amount: mappedDebt.originalAmount,
      installmentsTotal: mappedDebt.installmentsTotal || 1,
    });
    return mappedDebt;
  };

  const updateDebt = async (debtId: string, updates: UpdateDebtInput): Promise<Debt> => {
    const payload: Record<string, any> = {};
    const numericAmount = updates.amount !== undefined ? Number(updates.amount) : undefined;
    const installmentsTotal =
      updates.installmentsTotal !== undefined
        ? Math.max(1, Math.floor(Number(updates.installmentsTotal)))
        : undefined;
    const firstDueDate = updates.firstDueDate ?? updates.dueDate;

    if (numericAmount !== undefined) {
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new Error('Informe um valor de dívida válido.');
      }
      payload.original_amount = numericAmount;
    }
    if (firstDueDate !== undefined) {
      payload.first_due_date = firstDueDate || null;
      payload.due_date = firstDueDate || null;
    }
    if (installmentsTotal !== undefined) {
      payload.installments_total = installmentsTotal;
    }
    if (updates.notes !== undefined) {
      payload.notes = updates.notes || null;
    }
    if (updates.customBadge !== undefined) {
      payload.custom_badge = updates.customBadge || null;
    }

    const currentDebt = debts.find((debt) => debt.id === debtId);
    const shouldSyncRemainingWithOriginal =
      numericAmount !== undefined && currentDebt && Math.abs(currentDebt.originalAmount - currentDebt.remainingAmount) < 0.00001;
    if (shouldSyncRemainingWithOriginal) {
      payload.remaining_amount = numericAmount;
    }

    if (Object.keys(payload).length === 0) {
      const unchanged = debts.find((debt) => debt.id === debtId);
      if (!unchanged) throw new Error('Dívida não encontrada.');
      return unchanged;
    }

    const { data, error } = await supabase
      .from('debts')
      .update(payload)
      .eq('id', debtId)
      .select('*')
      .single();

    if (error) throw error;

    const mapped = mapDebt(data);
    setDebts((prev) => prev.map((debt) => (debt.id === mapped.id ? mapped : debt)));
    logDataEvent('debt_updated', 'Debtors', {
      debtId,
      amount: mapped.originalAmount,
      installmentsTotal: mapped.installmentsTotal || 1,
    });
    return mapped;
  };

  const payDebt = async (payment: PayDebtInput): Promise<void> => {
    if (!payment.amount || payment.amount <= 0) {
      throw new Error('Informe um valor maior que zero.');
    }

    const { data, error } = await supabase
      .from('debt_payments')
      .insert({
        id: newId('dpm'),
        debt_id: payment.debtId,
        amount: payment.amount,
        payment_method: payment.paymentMethod,
        account: normalizeFinancialAccount(payment.account),
        paid_at: payment.paidAt || new Date().toISOString(),
        notes: payment.notes || null
      })
      .select('*')
      .single();

    if (error) throw error;

    const mappedPayment = mapDebtPayment(data);
    setDebtPayments((prev) => [mappedPayment, ...prev]);

    const { data: updatedDebt, error: updatedDebtError } = await supabase
      .from('debts')
      .select('*')
      .eq('id', payment.debtId)
      .single();

    if (updatedDebtError) throw updatedDebtError;

    const mappedDebt = mapDebt(updatedDebt);
    setDebts((prev) => prev.map((d) => (d.id === mappedDebt.id ? mappedDebt : d)));
    logDataEvent('debt_payment_registered', 'Debtors', {
      debtId: payment.debtId,
      amount: payment.amount,
    });

    if (role === 'admin') {
      const { data: refreshedTransactions } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .limit(100000);
      if (refreshedTransactions) setTransactions(refreshedTransactions.map(mapTransaction));
    }
  };

  const getDebtPayments = (debtId: string) =>
    debtPayments
      .filter((payment) => payment.debtId === debtId)
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());

  const removeDebtPayment = async (paymentId: string): Promise<void> => {
    const existing = debtPayments.find((payment) => payment.id === paymentId);
    const { error } = await supabase.from('debt_payments').delete().eq('id', paymentId);
    if (error) {
      console.error('Error removing debt payment:', error);
      throw error;
    }

    setDebtPayments((prev) => prev.filter((payment) => payment.id !== paymentId));
    setTransactions((prev) => prev.filter((trx) => trx.debtPaymentId !== paymentId));

    if (existing?.debtId) {
      const { data: refreshedDebt } = await supabase
        .from('debts')
        .select('*')
        .eq('id', existing.debtId)
        .maybeSingle();
      if (refreshedDebt) {
        const mappedDebt = mapDebt(refreshedDebt);
        setDebts((prev) => prev.map((d) => (d.id === mappedDebt.id ? mappedDebt : d)));
      }
      logDataEvent('debt_payment_reversed', 'Debtors', {
        debtId: existing.debtId,
        amount: existing.amount,
      });
    }
  };

  const removeDebt = async (debtId: string): Promise<void> => {
    const linkedPaymentIds = debtPayments
      .filter((payment) => payment.debtId === debtId)
      .map((payment) => payment.id);

    const { error } = await supabase.rpc('delete_debt_cascade', { p_debt_id: debtId });
    if (error) {
      console.error('Error removing debt:', error);
      throw error;
    }

    setDebts((prev) => prev.filter((debt) => debt.id !== debtId));
    setDebtPayments((prev) => prev.filter((payment) => payment.debtId !== debtId));
    if (linkedPaymentIds.length > 0) {
      setTransactions((prev) => prev.filter((trx) => !trx.debtPaymentId || !linkedPaymentIds.includes(trx.debtPaymentId)));
    }

    logDataEvent('debt_removed', 'Debtors', { debtId });
  };

  const addSeller = async (seller: Seller) => {
      const { data, error } = await supabase.from('sellers').insert({
          id: seller.id || newId('sel'),
          name: seller.name,
          email: seller.email || null,
          auth_user_id: seller.authUserId || null,
          store_id: seller.storeId || null,
          total_sales: seller.totalSales
      }).select().single();
      if(!error && data) setSellers(prev => [...prev, mapSellers([data])[0]]);
  };

  const updateSeller = async (id: string, updates: Partial<Seller>) => {
      const dbUpdates: any = {};
      if(updates.name !== undefined) dbUpdates.name = updates.name;
      if(updates.email !== undefined) dbUpdates.email = updates.email || null;
      if(updates.authUserId !== undefined) dbUpdates.auth_user_id = updates.authUserId || null;
      if(updates.storeId !== undefined) dbUpdates.store_id = updates.storeId || null;
      if(updates.totalSales !== undefined) dbUpdates.total_sales = updates.totalSales;
      const { error } = await supabase.from('sellers').update(dbUpdates).eq('id', id);
      if(!error) setSellers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const removeSeller = async (id: string) => {
      const { error } = await supabase.from('sellers').delete().eq('id', id);
      if (error) {
        console.error('Error removing seller:', error);
        throw error;
      }
      setSellers(prev => prev.filter(s => s.id !== id));
  };

  const addStore = async (store: StoreLocation) => {
      const { data, error } = await supabase.from('stores').insert({
          id: store.id || newId('st'),
          name: store.name, city: store.city
      }).select().single();
      
      if (error) {
          console.error('Error adding store:', error);
          throw error;
      }
      
      if(data) setStores(prev => [...prev, data]);
  };

   const updateStore = async (id: string, updates: Partial<StoreLocation>) => {
       const { error } = await supabase.from('stores').update(updates).eq('id', id);
       if (error) {
           console.error('Error updating store:', error);
           throw error;
       }
       setStores(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
   };

   const removeStore = async (id: string) => {
       const { error } = await supabase.from('stores').delete().eq('id', id);
       if (error) {
           console.error('Error removing store:', error);
           throw error;
       }
       setStores(prev => prev.filter(s => s.id !== id));
   };

  const addDeviceCatalogItem = async (item: Omit<DeviceCatalogItem, 'id'> & { id?: string }): Promise<DeviceCatalogItem> => {
      const normalizedModel = item.model.trim();
      const normalizedColor = (item.color || '').trim();
      if (!normalizedModel) {
        throw new Error('Modelo é obrigatório.');
      }

      const existing = deviceCatalog.find(
        (entry) =>
          entry.type === item.type &&
          entry.model.toLowerCase() === normalizedModel.toLowerCase() &&
          (entry.color || '').toLowerCase() === normalizedColor.toLowerCase()
      );

      if (existing) {
        return existing;
      }

      const { data, error } = await supabase
        .from('device_catalog')
        .insert({
          id: item.id || newId('dev'),
          type: item.type,
          model: normalizedModel,
          color: normalizedColor
        })
        .select('*')
        .single();

      if (error) {
        console.error('Error adding device catalog item:', error);
        throw error;
      }

      const mapped = mapDeviceCatalogItem(data);
      setDeviceCatalog(prev => [mapped, ...prev]);
      return mapped;
  };

  const addTransaction = async (transaction: Transaction) => {
      const { data, error } = await supabase.from('transactions').insert({
          id: transaction.id || newId('trx'),
          type: transaction.type,
          category: transaction.category,
          amount: transaction.amount,
          date: transaction.date,
          description: transaction.description,
          account: normalizeFinancialAccount(transaction.account)
      }).select().single();
      
      if (error) {
          console.error('Error adding transaction:', error);
          throw error;
      }
      
      if(data) {
        setTransactions(prev => [...prev, mapTransaction(data)]);
        logDataEvent('finance_transaction_created', 'Finance', {
          transactionId: data.id,
          amount: transaction.amount,
        });
      }
  };

  const updateTransaction = async (id: string, updates: Omit<Transaction, 'id'>) => {
      const { data, error } = await supabase
        .from('transactions')
        .update({
          type: updates.type,
          category: updates.category,
          amount: updates.amount,
          date: updates.date,
          description: updates.description,
          account: normalizeFinancialAccount(updates.account)
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating transaction:', error);
        throw error;
      }

      if (data) {
        const mapped = mapTransaction(data);
        setTransactions((prev) => prev.map((item) => (item.id === id ? mapped : item)));
        logDataEvent('finance_transaction_updated', 'Finance', {
          transactionId: id,
          amount: mapped.amount,
        });
      }
  };

  const removeTransaction = async (id: string) => {
      const existingTrx = transactions.find(t => t.id === id);

      if (existingTrx?.payableDebtId) {
        throw new Error('Este lançamento é uma entrada de dívida ativa. Para revertê-lo, exclua a dívida correspondente na página Dívidas Ativas.');
      }

      const linkedPaymentId = existingTrx?.debtPaymentId ?? null;
      const linkedPayment = linkedPaymentId
        ? debtPayments.find(dp => dp.id === linkedPaymentId) ?? null
        : null;
      const linkedPayablePaymentId = existingTrx?.payableDebtPaymentId ?? null;
      const linkedPayablePayment = linkedPayablePaymentId
        ? payableDebtPayments.find(payment => payment.id === linkedPayablePaymentId) ?? null
        : null;

      // Usa RPC SECURITY DEFINER para garantir deleção mesmo com RLS e evitar
      // cascade recursivo entre o trigger e o FK payable_debt_payment_id.
      const { error } = await supabase.rpc('cancel_transaction', { p_transaction_id: id });
      if (error) {
        console.error('Error removing transaction:', error);
        throw new Error(error.message || 'Não foi possível cancelar o lançamento.');
      }

      setTransactions(prev => prev.filter(t => t.id !== id));

      if (linkedPaymentId) {
        setDebtPayments(prev => prev.filter(dp => dp.id !== linkedPaymentId));
        if (linkedPayment?.debtId) {
          const { data: refreshedDebt } = await supabase
            .from('debts')
            .select('*')
            .eq('id', linkedPayment.debtId)
            .maybeSingle();
          if (refreshedDebt) {
            const mappedDebt = mapDebt(refreshedDebt);
            setDebts(prev => prev.map(d => (d.id === mappedDebt.id ? mappedDebt : d)));
          }
          logDataEvent('debt_payment_reversed', 'Finance', {
            debtId: linkedPayment.debtId,
            amount: linkedPayment.amount,
            via: 'transaction_delete',
          });
        }
      }

      if (linkedPayablePaymentId) {
        setPayableDebtPayments(prev => prev.filter(payment => payment.id !== linkedPayablePaymentId));
        if (linkedPayablePayment?.payableDebtId) {
          const { data: refreshedPayableDebt } = await supabase
            .from('payable_debts')
            .select('*')
            .eq('id', linkedPayablePayment.payableDebtId)
            .maybeSingle();
          if (refreshedPayableDebt) {
            const mappedDebt = mapPayableDebt(refreshedPayableDebt);
            setPayableDebts(prev => prev.map(debt => (debt.id === mappedDebt.id ? mappedDebt : debt)));
          }
          logDataEvent('payable_debt_payment_reversed', 'Finance', {
            debtId: linkedPayablePayment.payableDebtId,
            amount: linkedPayablePayment.amount,
            via: 'transaction_delete',
          });
        }
      }

      logDataEvent('finance_transaction_removed', 'Finance', { transactionId: id });
  };

  // Cost Management
  const addCostHistory = async (model: string, description: string, amount: number) => {
      // Check existing
      const existing = costHistory.find(c => c.model === model && c.description === description);
      
      let error;
      if (existing) {
          const { error: err } = await supabase.from('cost_history').update({
              amount, count: existing.count + 1, last_used: new Date().toISOString()
          }).eq('id', existing.id);
          error = err;
      } else {
          const { error: err } = await supabase.from('cost_history').insert({
              id: newId('costh'),
              model, description, amount, count: 1, last_used: new Date().toISOString()
          });
          error = err;
      }
      
      if(!error) {
          // Re-fetch cost history
           const { data } = await supabase.from('cost_history').select('*');
           if(data) setCostHistory(data.map(mapCostHistory));
      }
  };

  const getCostHistoryByModel = (model: string) => {
      return costHistory.filter(item => item.model === model).sort((a, b) => b.count - a.count);
  };

  const addCostToItem = async (itemId: string, cost: CostItem) => {
      const { error } = await supabase.from('costs').insert({
          id: cost.id || newId('cost'),
          stock_item_id: itemId, description: cost.description, amount: cost.amount, date: cost.date
      });
      if (error) {
          throw error;
      }

      // Fetch updated stock item
      const { data: newItem, error: stockError } = await supabase.from('stock_items').select('*, costs(*)').eq('id', itemId).single();
      if (stockError) {
          throw stockError;
      }
      if (newItem) {
          setStock(prev => prev.map(item => item.id === itemId ? mapStockItem(newItem) : item));
          const item = stock.find(i => i.id === itemId);
          if (item) {
              await addCostHistory(item.model, cost.description, cost.amount);
          }
      }
  };

  const addPart = async (part: AddPartInput): Promise<PartStockItem> => {
      const name = part.name.trim().toUpperCase();
      const quantity = Number(part.quantity);
      const unitCost = Number(part.unitCost);

      if (!name) throw new Error('Informe o nome da peça.');
      if (!Number.isFinite(quantity) || quantity < 0) throw new Error('Quantidade inválida.');
      if (!Number.isFinite(unitCost) || unitCost < 0) throw new Error('Custo unitário inválido.');

      const { data, error } = await supabase
        .from('parts_inventory')
        .insert({
          id: newId('part'),
          name,
          quantity,
          unit_cost: unitCost
        })
        .select('*')
        .single();

      if (error) throw error;

      const mapped = mapPartStockItem(data);
      setPartsInventory((prev) => [...prev, mapped].sort((a, b) => a.name.localeCompare(b.name)));
      logDataEvent('part_created', 'PartsStock', { partId: mapped.id, quantity: mapped.quantity });
      return mapped;
  };

  const updatePart = async (id: string, updates: UpdatePartInput): Promise<void> => {
      const payload: Record<string, any> = {};
      if (updates.name !== undefined) payload.name = updates.name.trim().toUpperCase();
      if (updates.quantity !== undefined) payload.quantity = Number(updates.quantity);
      if (updates.unitCost !== undefined) payload.unit_cost = Number(updates.unitCost);

      if (payload.quantity !== undefined && (!Number.isFinite(payload.quantity) || payload.quantity < 0)) {
        throw new Error('Quantidade inválida.');
      }
      if (payload.unit_cost !== undefined && (!Number.isFinite(payload.unit_cost) || payload.unit_cost < 0)) {
        throw new Error('Custo unitário inválido.');
      }
      if (payload.name !== undefined && !payload.name) {
        throw new Error('Informe o nome da peça.');
      }

      const { data, error } = await supabase
        .from('parts_inventory')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;

      const mapped = mapPartStockItem(data);
      setPartsInventory((prev) => prev.map((item) => (item.id === id ? mapped : item)).sort((a, b) => a.name.localeCompare(b.name)));
      logDataEvent('part_updated', 'PartsStock', { partId: id });
  };

  const removePart = async (id: string): Promise<void> => {
      const { error } = await supabase.from('parts_inventory').delete().eq('id', id);
      if (error) throw error;
      setPartsInventory((prev) => prev.filter((item) => item.id !== id));
      logDataEvent('part_removed', 'PartsStock', { partId: id });
  };

  const addPartCostToItem = async (itemId: string, partId: string, quantity: number): Promise<CostItem> => {
      const safeQuantity = Number(quantity);
      if (!Number.isFinite(safeQuantity) || safeQuantity <= 0) {
        throw new Error('Quantidade de peça inválida.');
      }

      const part = partsInventory.find((entry) => entry.id === partId);
      if (!part) throw new Error('Peça não encontrada.');
      if (safeQuantity > part.quantity) throw new Error('Quantidade solicitada maior que o estoque da peça.');

      const amount = Number((part.unitCost * safeQuantity).toFixed(2));
      const costItem: CostItem = {
        id: newId('cost'),
        description: `Peça: ${part.name} x${safeQuantity}`,
        amount,
        date: new Date().toISOString()
      };

      const { error: costError } = await supabase.from('costs').insert({
        id: costItem.id,
        stock_item_id: itemId,
        description: costItem.description,
        amount: costItem.amount,
        date: costItem.date
      });
      if (costError) throw costError;

      const nextQuantity = part.quantity - safeQuantity;
      const { data: updatedPartData, error: partError } = await supabase
        .from('parts_inventory')
        .update({ quantity: nextQuantity })
        .eq('id', partId)
        .select('*')
        .single();

      if (partError) {
        await supabase.from('costs').delete().eq('id', costItem.id);
        throw partError;
      }

      const updatedPart = mapPartStockItem(updatedPartData);
      setPartsInventory((prev) => prev.map((item) => (item.id === partId ? updatedPart : item)).sort((a, b) => a.name.localeCompare(b.name)));

      const { data: refreshedItem, error: refreshedItemError } = await supabase
        .from('stock_items')
        .select('*, costs(*)')
        .eq('id', itemId)
        .single();

      if (refreshedItemError) throw refreshedItemError;
      if (refreshedItem) {
        setStock((prev) => prev.map((item) => (item.id === itemId ? mapStockItem(refreshedItem) : item)));
      }

      const stockItem = stock.find((item) => item.id === itemId);
      if (stockItem) {
        await addCostHistory(stockItem.model, costItem.description, costItem.amount);
      }

      return costItem;
  };
  
  const addSale = async (sale: Sale) => {
      const normalizedTradeInsFromSale = (sale.tradeIns || [])
        .map((tradeIn) => ({
          id: tradeIn.id || newId('sti'),
          stockItemId: tradeIn.stockItemId || undefined,
          model: tradeIn.model || 'Trade-in',
          capacity: tradeIn.capacity || null,
          color: tradeIn.color || null,
          imei: tradeIn.imei || null,
          condition: tradeIn.condition || null,
          receivedValue: toNumber(tradeIn.receivedValue),
          stockSnapshot: tradeIn.stockSnapshot
        }))
        .filter((tradeIn) => tradeIn.receivedValue > 0);

      const normalizedTradeIns =
        normalizedTradeInsFromSale.length > 0
          ? normalizedTradeInsFromSale
          : sale.tradeIn
            ? [{
                id: newId('sti'),
                stockItemId: sale.tradeIn.id,
                model: sale.tradeIn.model || 'Trade-in',
                capacity: sale.tradeIn.capacity || null,
                color: sale.tradeIn.color || null,
                imei: sale.tradeIn.imei || null,
                condition: sale.tradeIn.condition || null,
                receivedValue: toNumber(sale.tradeInValue || sale.tradeIn.purchasePrice),
                stockSnapshot: undefined
              }]
            : [];

      const tradeInValue =
        normalizedTradeIns.length > 0
          ? normalizedTradeIns.reduce((acc, tradeIn) => acc + toNumber(tradeIn.receivedValue), 0)
          : toNumber(sale.tradeInValue);

      const firstTradeIn = normalizedTradeIns[0];
      const firstTradeInStockItemId =
        firstTradeIn?.stockSnapshot
          ? null
          : firstTradeIn?.stockItemId || sale.tradeIn?.id || null;
      const negotiatedSubtotal = toNumber(
        sale.negotiatedSubtotal,
        sale.items.reduce((acc, item) => acc + toNumber(item.sellPrice), 0)
      );
      const originalSubtotal = toNumber(
        sale.originalSubtotal,
        sale.items.reduce((acc, item) => acc + toNumber(item.originalSellPrice ?? item.sellPrice), 0)
      );
      const normalizedDiscountType = sale.discountType || null;
      const normalizedDiscountPercent =
        sale.discountPercent === undefined || sale.discountPercent === null
          ? null
          : toNumber(sale.discountPercent);

      // 1. Create Sale
      const { data: saleData, error: saleError } = await supabase.from('sales').insert({
          id: sale.id || newId('sale'),
          customer_id: sale.customerId,
          seller_id: sale.sellerId,
          store_id: sale.storeId || sale.items[0]?.storeId || null,
          total: sale.total,
          discount: sale.discount,
          discount_type: normalizedDiscountType,
          discount_percent: normalizedDiscountPercent,
          original_subtotal: originalSubtotal,
          negotiated_subtotal: negotiatedSubtotal,
          date: sale.date,
          warranty_expires_at: sale.warrantyExpiresAt,
          trade_in_id: firstTradeInStockItemId,
          trade_in_value: tradeInValue,
          client_payment_amount: sale.clientPaymentAmount ?? null,
          client_payment_mode: sale.clientPaymentMode ?? null,
          client_payment_account: sale.clientPaymentAccount ?? null,
          client_payment_method: sale.clientPaymentMethod ?? null,
          client_payment_notes: sale.clientPaymentNotes ?? null,
          client_payment_due_date: sale.clientPaymentDueDate ?? null
      }).select().single();
      
      if (saleError) throw saleError;
      if (!saleData) throw new Error('Falha ao registrar venda.');

      const saleId = saleData.id;

      // 2. Create Sale Items
      const saleItemsFormatted = sale.items.map(i => ({
          id: newId('si'),
          sale_id: saleId,
          stock_item_id: i.id,
          price: i.sellPrice,
          original_price: i.originalSellPrice ?? i.sellPrice
      }));
      const { error: saleItemsError } = await supabase.from('sale_items').insert(saleItemsFormatted);
      if (saleItemsError) throw saleItemsError;

      // 3. Create Payment Methods
      const paymentMethodsFormatted = sale.paymentMethods.map(pm => ({
          id: newId('pm'),
          sale_id: saleId,
          type: pm.type,
          amount: pm.amount,
          account: pm.account ? normalizeFinancialAccount(pm.account) : null,
          installments: pm.installments,
          card_brand: pm.cardBrand || null,
          customer_amount: pm.customerAmount ?? null,
          fee_rate: pm.feeRate ?? null,
          fee_amount: pm.feeAmount ?? null,
          debt_due_date: pm.debtDueDate || null,
          debt_installments: pm.debtInstallments ?? null,
          debt_notes: pm.debtNotes || null
      }));
      const { error: paymentMethodsError } = await supabase.from('payment_methods').insert(paymentMethodsFormatted);
      if (paymentMethodsError) throw paymentMethodsError;

      if (normalizedTradeIns.length > 0) {
        const tradeInStockRows = normalizedTradeIns
          .filter((tradeIn) => tradeIn.stockSnapshot)
          .map((tradeIn) => {
            const item = tradeIn.stockSnapshot as StockItem;
            const observations = item.observations ?? item.notes ?? '';
            return {
              id: tradeIn.stockItemId || item.id || newId('stk'),
              type: item.type || DeviceType.IPHONE,
              model: item.model || tradeIn.model,
              color: item.color || tradeIn.color || '',
              has_box: item.hasBox ?? false,
              capacity: item.capacity || tradeIn.capacity || '',
              imei: item.imei || tradeIn.imei || '',
              condition: item.condition || tradeIn.condition || Condition.USED,
              status: item.status || StockStatus.PREPARATION,
              sim_type: item.simType || 'Physical',
              battery_health: item.batteryHealth,
              store_id: item.storeId || sale.storeId || sale.items[0]?.storeId || null,
              purchase_price: item.purchasePrice || tradeIn.receivedValue,
              sell_price: item.sellPrice || 0,
              max_discount: item.maxDiscount || 0,
              warranty_type: item.warrantyType || WarrantyType.STORE,
              warranty_end: item.warrantyEnd || null,
              origin: item.origin || 'Trade-in PDV',
              notes: observations,
              observations,
              entry_date: item.entryDate || sale.date,
              photos: item.photos || []
            };
          });

        if (tradeInStockRows.length > 0) {
          const { error: tradeInStockError } = await supabase.from('stock_items').insert(tradeInStockRows);
          if (tradeInStockError) throw tradeInStockError;
        }

        const saleTradeInsFormatted = normalizedTradeIns.map((tradeIn) => ({
          id: tradeIn.id,
          sale_id: saleId,
          stock_item_id: tradeIn.stockItemId || null,
          model: tradeIn.model,
          capacity: tradeIn.capacity,
          color: tradeIn.color,
          imei: tradeIn.imei,
          condition: tradeIn.condition,
          received_value: tradeIn.receivedValue
        }));
        const { error: saleTradeInsError } = await supabase.from('sale_trade_in_items').insert(saleTradeInsFormatted);
        if (saleTradeInsError) throw saleTradeInsError;
      }

      // 4. Keep local stock state in sync.
      // DB-level stock decrement happens via trigger on sale_items.
      const soldItemIds = new Set(sale.items.map((item) => item.id));
      const soldItemWarrantyUpdates = sale.items.filter((item) => item.warrantyExpiresAt);
      await Promise.all(
        soldItemWarrantyUpdates.map((item) =>
          supabase
            .from('stock_items')
            .update({ warranty_end: item.warrantyExpiresAt })
            .eq('id', item.id)
        )
      );
      setStock((prev) =>
        [
          ...prev.map((item) =>
            soldItemIds.has(item.id)
              ? {
                  ...item,
                  status: StockStatus.SOLD,
                  warrantyEnd: sale.items.find((sold) => sold.id === item.id)?.warrantyExpiresAt || item.warrantyEnd,
                  warrantyExpiresAt: sale.items.find((sold) => sold.id === item.id)?.warrantyExpiresAt || item.warrantyExpiresAt
                }
              : item
          ),
          ...normalizedTradeIns
            .map((tradeIn) => tradeIn.stockSnapshot)
            .filter((item): item is StockItem => !!item)
        ]
      );

      // 5. Handle Trade In item registration (financial transaction now comes from DB trigger)
      if (sale.tradeIn && normalizedTradeInsFromSale.length === 0) {
          await addStockItem(sale.tradeIn);
      }

      // 6. Handle client payment when trade-in value exceeds sale total
      if (sale.clientPaymentAmount && sale.clientPaymentAmount > 0) {
        const saleCustomer = customers.find((c) => c.id === sale.customerId);

        if (sale.clientPaymentMode === 'immediate') {
          const { error: clientTrxError } = await supabase.from('transactions').insert({
            id: newId('trx'),
            type: 'OUT',
            category: 'Pagamento de trade-in ao cliente',
            amount: sale.clientPaymentAmount,
            date: sale.date,
            description: `Diferença trade-in – Venda #${saleId.slice(-6).toUpperCase()} – ${saleCustomer?.name || 'Cliente'}`,
            account: normalizeFinancialAccount(sale.clientPaymentAccount),
            sale_id: saleId
          });
          if (clientTrxError) throw clientTrxError;
        } else if (sale.clientPaymentMode === 'payable_debt') {
          // Find or create a creditor record for this customer
          let creditorId: string;
          const existingCreditor = creditors.find(
            (c) => saleCustomer?.cpf && c.document === saleCustomer.cpf
          );
          if (existingCreditor) {
            creditorId = existingCreditor.id;
          } else {
            const newCreditorId = newId('crd');
            const { data: creditorData, error: creditorError } = await supabase
              .from('creditors')
              .insert({
                id: newCreditorId,
                name: saleCustomer?.name || 'Cliente',
                document: saleCustomer?.cpf || null,
                document_type: saleCustomer?.cpf ? 'CPF' : null,
                phone: saleCustomer?.phone || null,
                email: saleCustomer?.email || null,
                notes: 'Criado automaticamente por diferença de trade-in no PDV'
              })
              .select()
              .single();
            if (creditorError) throw creditorError;
            setCreditors((prev) => [...prev, mapCreditor(creditorData)].sort((a, b) => a.name.localeCompare(b.name)));
            creditorId = newCreditorId;
          }

          const { data: debtData, error: debtError } = await supabase
            .from('payable_debts')
            .insert({
              id: newId('pdbt'),
              creditor_id: creditorId,
              creditor_name: saleCustomer?.name || 'Cliente',
              creditor_document: saleCustomer?.cpf || null,
              creditor_phone: saleCustomer?.phone || null,
              original_amount: sale.clientPaymentAmount,
              remaining_amount: sale.clientPaymentAmount,
              status: 'Aberta',
              due_date: sale.clientPaymentDueDate || null,
              first_due_date: sale.clientPaymentDueDate || null,
              installments_total: 1,
              notes: sale.clientPaymentNotes || null,
              source: 'pdv',
              sale_id: saleId
            })
            .select()
            .single();
          if (debtError) throw debtError;
          setPayableDebts((prev) => [mapPayableDebt(debtData), ...prev]);
        }
      }

       // Refresh Sales List
       const { data: refreshSales } = await supabase.from('sales').select(SALES_SELECT);
       if(refreshSales) setSales(refreshSales.map(mapSale));

       const { data: refreshedCustomers } = await supabase.from('customers').select('*');
       if (refreshedCustomers) setCustomers(refreshedCustomers.map(mapCustomer));

       const { data: refreshedSellers } = await supabase.from('sellers').select('*');
       if (refreshedSellers) setSellers(mapSellers(refreshedSellers));

       if (role === 'admin') {
           const { data: refreshedTransactions } = await supabase
             .from('transactions')
             .select('*')
             .order('date', { ascending: false })
             .limit(100000);
           if (refreshedTransactions) setTransactions(refreshedTransactions.map(mapTransaction));

           const { data: refreshedDebts } = await supabase.from('debts').select('*').order('created_at', { ascending: false });
           if (refreshedDebts) setDebts(refreshedDebts.map(mapDebt));

           const { data: refreshedDebtPayments } = await supabase
             .from('debt_payments')
             .select('*')
             .order('paid_at', { ascending: false });
           if (refreshedDebtPayments) setDebtPayments(refreshedDebtPayments.map(mapDebtPayment));
       }

      logDataEvent('sale_created', 'PDV', { saleId, total: sale.total });
  };

  const updateSale = async (saleId: string, updates: Partial<Sale>): Promise<void> => {
    const currentSale = sales.find((sale) => sale.id === saleId);
    if (!currentSale) {
      throw new Error('Venda não encontrada para edição.');
    }

    const mergedSale: Sale = {
      ...currentSale,
      ...updates,
      items: updates.items ?? currentSale.items,
      paymentMethods: updates.paymentMethods ?? currentSale.paymentMethods,
      tradeIns: updates.tradeIns ?? currentSale.tradeIns,
      tradeIn: updates.tradeIn ?? currentSale.tradeIn
    };

    if (!mergedSale.customerId || !mergedSale.sellerId) {
      throw new Error('Cliente e vendedor são obrigatórios para atualizar a venda.');
    }

    if (!mergedSale.items || mergedSale.items.length === 0) {
      throw new Error('A venda precisa ter ao menos um item.');
    }

    if (!mergedSale.paymentMethods || mergedSale.paymentMethods.length === 0) {
      throw new Error('A venda precisa ter ao menos uma forma de pagamento.');
    }

    const normalizedItems = mergedSale.items.map((item) => {
      if (!item.id) throw new Error('Item de venda sem ID de estoque.');
      return {
        stockItemId: item.id,
        negotiatedPrice: toNumber(item.sellPrice),
        originalPrice: toNumber(item.originalSellPrice ?? item.sellPrice)
      };
    });

    const normalizedTradeInsFromSale = (mergedSale.tradeIns || [])
      .map((tradeIn) => ({
        id: tradeIn.id || newId('sti'),
        stockItemId: tradeIn.stockItemId || undefined,
        model: tradeIn.model || 'Trade-in',
        capacity: tradeIn.capacity || null,
        color: tradeIn.color || null,
        imei: tradeIn.imei || null,
        condition: tradeIn.condition || null,
        receivedValue: toNumber(tradeIn.receivedValue)
      }))
      .filter((tradeIn) => tradeIn.receivedValue > 0);

    const normalizedTradeIns =
      normalizedTradeInsFromSale.length > 0
        ? normalizedTradeInsFromSale
        : mergedSale.tradeIn
          ? [{
              id: newId('sti'),
              stockItemId: mergedSale.tradeIn.id,
              model: mergedSale.tradeIn.model || 'Trade-in',
              capacity: mergedSale.tradeIn.capacity || null,
              color: mergedSale.tradeIn.color || null,
              imei: mergedSale.tradeIn.imei || null,
              condition: mergedSale.tradeIn.condition || null,
              receivedValue: toNumber(mergedSale.tradeInValue || mergedSale.tradeIn.purchasePrice)
            }]
          : [];

    const tradeInValue =
      normalizedTradeIns.length > 0
        ? normalizedTradeIns.reduce((acc, tradeIn) => acc + toNumber(tradeIn.receivedValue), 0)
        : toNumber(mergedSale.tradeInValue);

    const negotiatedSubtotal = toNumber(
      mergedSale.negotiatedSubtotal,
      normalizedItems.reduce((acc, item) => acc + item.negotiatedPrice, 0)
    );
    const originalSubtotal = toNumber(
      mergedSale.originalSubtotal,
      normalizedItems.reduce((acc, item) => acc + item.originalPrice, 0)
    );
    const discount = toNumber(mergedSale.discount);
    const normalizedDiscountType = mergedSale.discountType || null;
    const normalizedDiscountPercent =
      mergedSale.discountPercent === undefined || mergedSale.discountPercent === null
        ? null
        : toNumber(mergedSale.discountPercent);
    const total = toNumber(mergedSale.total, Math.max(0, negotiatedSubtotal - discount - tradeInValue));

    const normalizedPayments = mergedSale.paymentMethods
      .map((paymentMethod) => ({
        type: paymentMethod.type,
        amount: toNumber(paymentMethod.amount),
        account: paymentMethod.account ? normalizeFinancialAccount(paymentMethod.account) : null,
        installments: toOptionalNumber(paymentMethod.installments),
        cardBrand: paymentMethod.cardBrand || null,
        customerAmount: toOptionalNumber(paymentMethod.customerAmount),
        feeRate: toOptionalNumber(paymentMethod.feeRate),
        feeAmount: toOptionalNumber(paymentMethod.feeAmount),
        debtDueDate: paymentMethod.debtDueDate || null,
        debtInstallments: toOptionalNumber(paymentMethod.debtInstallments),
        debtNotes: paymentMethod.debtNotes || null
      }))
      .filter((paymentMethod) => paymentMethod.amount > 0);

    if (normalizedPayments.length === 0) {
      throw new Error('Informe ao menos uma forma de pagamento com valor maior que zero.');
    }

    const paymentTotal = normalizedPayments.reduce((acc, paymentMethod) => acc + paymentMethod.amount, 0);
    if (Math.abs(paymentTotal - total) > 0.01) {
      throw new Error('A soma dos pagamentos deve ser igual ao total da venda.');
    }

    const firstTradeInStockItemId = normalizedTradeIns[0]?.stockItemId || mergedSale.tradeIn?.id || null;
    const saleDate = mergedSale.date || currentSale.date || new Date().toISOString();
    const nowIso = new Date().toISOString();

    const adjustSellerTotalSales = async (sellerId: string | undefined, delta: number) => {
      if (!sellerId || Math.abs(delta) < 0.009) return;

      const { data: sellerData, error: sellerError } = await supabase
        .from('sellers')
        .select('total_sales')
        .eq('id', sellerId)
        .single();
      if (sellerError) throw sellerError;

      const nextTotalSales = Math.max(0, toNumber(sellerData?.total_sales) + delta);
      const { error: sellerUpdateError } = await supabase
        .from('sellers')
        .update({ total_sales: nextTotalSales, updated_at: nowIso })
        .eq('id', sellerId);
      if (sellerUpdateError) throw sellerUpdateError;
    };

    const adjustCustomerStats = async (customerId: string | undefined, purchasesDelta: number, spentDelta: number) => {
      if (!customerId) return;
      if (purchasesDelta === 0 && Math.abs(spentDelta) < 0.009) return;

      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('purchases, total_spent')
        .eq('id', customerId)
        .single();
      if (customerError) throw customerError;

      const nextPurchases = Math.max(0, Math.trunc(toNumber(customerData?.purchases) + purchasesDelta));
      const nextTotalSpent = Math.max(0, toNumber(customerData?.total_spent) + spentDelta);

      const { error: customerUpdateError } = await supabase
        .from('customers')
        .update({ purchases: nextPurchases, total_spent: nextTotalSpent, updated_at: nowIso })
        .eq('id', customerId);
      if (customerUpdateError) throw customerUpdateError;
    };

    const { data: existingSaleItems, error: existingSaleItemsError } = await supabase
      .from('sale_items')
      .select('stock_item_id')
      .eq('sale_id', saleId);
    if (existingSaleItemsError) throw existingSaleItemsError;

    const previousSoldItemIds: string[] =
      existingSaleItems?.map((row: any) => String(row.stock_item_id || '')).filter((id: string) => id.length > 0) ||
      currentSale.items.map((item) => item.id);

    const { data: debtRows, error: debtRowsError } = await supabase
      .from('debts')
      .select('id')
      .eq('sale_id', saleId);
    if (debtRowsError) throw debtRowsError;

    const debtIdsForSale = debtRows?.map((row) => row.id as string) || [];

    const dbUpdates: any = {
      customer_id: mergedSale.customerId,
      seller_id: mergedSale.sellerId,
      store_id: mergedSale.storeId || null,
      total,
      discount,
      discount_type: normalizedDiscountType,
      discount_percent: normalizedDiscountPercent,
      original_subtotal: originalSubtotal,
      negotiated_subtotal: negotiatedSubtotal,
      date: saleDate,
      warranty_expires_at: mergedSale.warrantyExpiresAt || null,
      trade_in_id: firstTradeInStockItemId,
      trade_in_value: tradeInValue,
      notes: mergedSale.notes ?? null,
      observations: mergedSale.observations ?? null
    };

    const { error: saleUpdateError } = await supabase.from('sales').update(dbUpdates).eq('id', saleId);
    if (saleUpdateError) {
      console.error('Error updating sale core fields:', saleUpdateError);
      throw saleUpdateError;
    }

    if (debtIdsForSale.length > 0) {
      const { error: deleteDebtPaymentsError } = await supabase
        .from('debt_payments')
        .delete()
        .in('debt_id', debtIdsForSale);
      if (deleteDebtPaymentsError) throw deleteDebtPaymentsError;
    }

    const { error: deleteDebtsError } = await supabase.from('debts').delete().eq('sale_id', saleId);
    if (deleteDebtsError) throw deleteDebtsError;

    const { error: deleteTransactionsError } = await supabase.from('transactions').delete().eq('sale_id', saleId);
    if (deleteTransactionsError) throw deleteTransactionsError;

    const { error: deleteSaleItemsError } = await supabase.from('sale_items').delete().eq('sale_id', saleId);
    if (deleteSaleItemsError) throw deleteSaleItemsError;

    const saleItemsFormatted = normalizedItems.map((item) => ({
      id: newId('si'),
      sale_id: saleId,
      stock_item_id: item.stockItemId,
      price: item.negotiatedPrice,
      original_price: item.originalPrice
    }));
    const { error: saleItemsInsertError } = await supabase.from('sale_items').insert(saleItemsFormatted);
    if (saleItemsInsertError) throw saleItemsInsertError;

    const { error: deletePaymentMethodsError } = await supabase.from('payment_methods').delete().eq('sale_id', saleId);
    if (deletePaymentMethodsError) throw deletePaymentMethodsError;

    const paymentMethodsFormatted = normalizedPayments.map((paymentMethod) => ({
      id: newId('pm'),
      sale_id: saleId,
      type: paymentMethod.type,
      amount: paymentMethod.amount,
      account: paymentMethod.account,
      installments: paymentMethod.installments,
      card_brand: paymentMethod.cardBrand,
      customer_amount: paymentMethod.customerAmount,
      fee_rate: paymentMethod.feeRate,
      fee_amount: paymentMethod.feeAmount,
      debt_due_date: paymentMethod.debtDueDate,
      debt_installments: paymentMethod.debtInstallments,
      debt_notes: paymentMethod.debtNotes
    }));
    const { error: paymentMethodsInsertError } = await supabase.from('payment_methods').insert(paymentMethodsFormatted);
    if (paymentMethodsInsertError) throw paymentMethodsInsertError;

    const { error: deleteTradeInsError } = await supabase.from('sale_trade_in_items').delete().eq('sale_id', saleId);
    if (deleteTradeInsError) throw deleteTradeInsError;

    if (normalizedTradeIns.length > 0) {
      const saleTradeInsFormatted = normalizedTradeIns.map((tradeIn) => ({
        id: tradeIn.id,
        sale_id: saleId,
        stock_item_id: tradeIn.stockItemId || null,
        model: tradeIn.model,
        capacity: tradeIn.capacity,
        color: tradeIn.color,
        imei: tradeIn.imei,
        condition: tradeIn.condition,
        received_value: tradeIn.receivedValue
      }));
      const { error: insertTradeInsError } = await supabase.from('sale_trade_in_items').insert(saleTradeInsFormatted);
      if (insertTradeInsError) throw insertTradeInsError;
    }

    if (tradeInValue > 0) {
      const { error: tradeInRevenueTransactionError } = await supabase.from('transactions').insert({
        id: newId('trx'),
        type: 'IN',
        category: 'Venda',
        amount: tradeInValue,
        date: saleDate,
        description: `Venda (Trade-in) - ${saleId}`,
        account: 'Conta Bancária',
        sale_id: saleId
      });
      if (tradeInRevenueTransactionError) throw tradeInRevenueTransactionError;

      const { error: tradeInTransactionError } = await supabase.from('transactions').insert({
        id: newId('trx'),
        type: 'OUT',
        category: 'Compra',
        amount: tradeInValue,
        date: saleDate,
        description: `Entrada (Troca) - ${saleId}`,
        account: 'Conta Bancária',
        sale_id: saleId
      });
      if (tradeInTransactionError) throw tradeInTransactionError;
    }

    const nextSoldItemIds: string[] = normalizedItems.map((item) => item.stockItemId);
    const soldNowSet = new Set<string>(nextSoldItemIds);
    const soldBeforeSet = new Set<string>(previousSoldItemIds);

    const releasedStockIds = Array.from(soldBeforeSet).filter((stockItemId) => !soldNowSet.has(stockItemId));
    if (releasedStockIds.length > 0) {
      const { data: stillSoldRows, error: stillSoldRowsError } = await supabase
        .from('sale_items')
        .select('stock_item_id')
        .in('stock_item_id', releasedStockIds);
      if (stillSoldRowsError) throw stillSoldRowsError;

      const stillSoldSet = new Set<string>((stillSoldRows || []).map((row: any) => String(row.stock_item_id || '')));
      const trulyReleasedIds = releasedStockIds.filter((stockItemId) => !stillSoldSet.has(stockItemId));

      if (trulyReleasedIds.length > 0) {
        const { error: releaseStockError } = await supabase
          .from('stock_items')
          .update({ status: StockStatus.AVAILABLE, updated_at: nowIso })
          .in('id', trulyReleasedIds);
        if (releaseStockError) throw releaseStockError;
      }
    }

    if (nextSoldItemIds.length > 0) {
      const { error: soldStockError } = await supabase
        .from('stock_items')
        .update({ status: StockStatus.SOLD, updated_at: nowIso })
        .in('id', nextSoldItemIds);
      if (soldStockError) throw soldStockError;
    }

    const oldTotal = toNumber(currentSale.total) + toNumber(currentSale.tradeInValue);
    const newTotal = toNumber(total) + tradeInValue;

    if (currentSale.sellerId === mergedSale.sellerId) {
      await adjustSellerTotalSales(mergedSale.sellerId, newTotal - oldTotal);
    } else {
      await adjustSellerTotalSales(currentSale.sellerId, -oldTotal);
      await adjustSellerTotalSales(mergedSale.sellerId, newTotal);
    }

    if (currentSale.customerId === mergedSale.customerId) {
      await adjustCustomerStats(mergedSale.customerId, 0, newTotal - oldTotal);
    } else {
      await adjustCustomerStats(currentSale.customerId, -1, -oldTotal);
      await adjustCustomerStats(mergedSale.customerId, 1, newTotal);
    }

    await fetchData();
    logDataEvent('sale_updated', 'PDVHistory', { saleId, total: newTotal });
  };

  const removeSale = async (saleId: string): Promise<void> => {
    const saleBefore = sales.find((s) => s.id === saleId);
    const tradeInStockItemIds = new Set<string>();

    saleBefore?.tradeIns?.forEach((tradeIn) => {
      if (tradeIn.stockItemId) tradeInStockItemIds.add(tradeIn.stockItemId);
    });

    if (saleBefore?.tradeIn?.id) {
      tradeInStockItemIds.add(saleBefore.tradeIn.id);
    }

    let tradeInStockItemIdsToDelete = Array.from(tradeInStockItemIds);
    if (tradeInStockItemIdsToDelete.length > 0) {
      const { data: laterSaleItems, error: laterSaleItemsError } = await supabase
        .from('sale_items')
        .select('stock_item_id')
        .in('stock_item_id', tradeInStockItemIdsToDelete)
        .neq('sale_id', saleId);

      if (laterSaleItemsError) {
        console.error('Error checking trade-in resale references:', laterSaleItemsError);
        throw laterSaleItemsError;
      }

      const resoldTradeInIds = new Set(
        (laterSaleItems || [])
          .map((row: any) => String(row.stock_item_id || ''))
          .filter((stockItemId: string) => stockItemId.length > 0)
      );

      if (resoldTradeInIds.size > 0) {
        const blockingImeis = saleBefore
          ? [
              ...(saleBefore.tradeIns || [])
                .filter((tradeIn) => tradeIn.stockItemId && resoldTradeInIds.has(tradeIn.stockItemId))
                .map((tradeIn) => tradeIn.imei || tradeIn.stockItemId),
              ...(saleBefore.tradeIn?.id && resoldTradeInIds.has(saleBefore.tradeIn.id)
                ? [saleBefore.tradeIn.imei || saleBefore.tradeIn.id]
                : [])
            ]
          : Array.from(resoldTradeInIds);
        throw new Error(`Não é possível cancelar a venda: trade-in já revendido (${blockingImeis.join(', ')}).`);
      }
    }

    const { error } = await supabase.from('sales').delete().eq('id', saleId);
    if (error) {
      console.error('Error removing sale:', error);
      throw error;
    }

    // Explicitly delete linked financial records to ensure "fluxo reverso"
    await supabase.from('transactions').delete().eq('sale_id', saleId);
    await supabase.from('debts').delete().eq('sale_id', saleId);

    if (tradeInStockItemIdsToDelete.length > 0) {
      const { error: tradeInStockDeleteError } = await supabase
        .from('stock_items')
        .delete()
        .in('id', tradeInStockItemIdsToDelete);
      if (tradeInStockDeleteError) {
        console.error('Error removing trade-in stock after sale cancellation:', tradeInStockDeleteError);
        throw tradeInStockDeleteError;
      }
    }

    // Remove sale from local state
    setSales((prev) => prev.filter((s) => s.id !== saleId));

    // Remove transactions linked to this sale
    setTransactions((prev) => prev.filter((t) => t.saleId !== saleId));

    // Remove debts created by this sale
    const debtIdsForSale = debts
      .filter((d) => d.saleId === saleId)
      .map((d) => d.id);
    if (debtIdsForSale.length > 0) {
      setDebts((prev) => prev.filter((d) => !debtIdsForSale.includes(d.id)));
      setDebtPayments((prev) => prev.filter((dp) => !debtIdsForSale.includes(dp.debtId)));
    }

    // Restore sold items and remove trade-in items returned by cancellation.
    if (saleBefore) {
      const soldItemIds = saleBefore.items.map((i) => i.id);
      const tradeInStockItemIdsToDeleteSet = new Set(tradeInStockItemIdsToDelete);
      if (soldItemIds.length > 0 || tradeInStockItemIdsToDeleteSet.size > 0) {
        setStock((prev) =>
          prev
            .filter((item) => !tradeInStockItemIdsToDeleteSet.has(item.id))
            .map((item) =>
              soldItemIds.includes(item.id) ? { ...item, status: StockStatus.AVAILABLE } : item
            )
        );
      }
    }

    const { data: refreshedStock } = await supabase.from('stock_items').select('*, costs(*)');
    if (refreshedStock) setStock(refreshedStock.map(mapStockItem));

    // Refresh customers and sellers to pick up decremented counters
    const { data: refreshedCustomers } = await supabase.from('customers').select('*');
    if (refreshedCustomers) setCustomers(refreshedCustomers.map(mapCustomer));

    const { data: refreshedSellers } = await supabase.from('sellers').select('*');
    if (refreshedSellers) setSellers(mapSellers(refreshedSellers));

    logDataEvent('sale_removed', 'PDVHistory', { saleId, total: saleBefore?.total ?? 0 });
  };


  const addCreditor = async (input: Omit<Creditor, 'id' | 'createdAt' | 'updatedAt'>): Promise<Creditor> => {
    const { data, error } = await supabase
      .from('creditors')
      .insert({
        id: newId('cred'),
        name: input.name.trim(),
        document: input.document || null,
        document_type: input.documentType || null,
        phone: input.phone || null,
        email: input.email || null,
        notes: input.notes || null
      })
      .select('*')
      .single();
    if (error) throw error;
    const mapped = mapCreditor(data);
    setCreditors((prev) => [...prev, mapped].sort((a, b) => a.name.localeCompare(b.name)));
    return mapped;
  };

  const updateCreditor = async (id: string, updates: Partial<Omit<Creditor, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> => {
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.document !== undefined) payload.document = updates.document || null;
    if (updates.documentType !== undefined) payload.document_type = updates.documentType || null;
    if (updates.phone !== undefined) payload.phone = updates.phone || null;
    if (updates.email !== undefined) payload.email = updates.email || null;
    if (updates.notes !== undefined) payload.notes = updates.notes || null;
    const { error } = await supabase.from('creditors').update(payload).eq('id', id);
    if (error) throw error;
    setCreditors((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const removeCreditor = async (id: string): Promise<void> => {
    const linked = payableDebts.some((d) => d.creditorId === id && d.status !== 'Quitada');
    if (linked) throw new Error('Credor possui dívidas em aberto. Quite as dívidas antes de excluir.');
    const { error } = await supabase.from('creditors').delete().eq('id', id);
    if (error) throw error;
    setCreditors((prev) => prev.filter((c) => c.id !== id));
  };

  const addPayableDebt = async (input: AddPayableDebtInput): Promise<PayableDebt> => {
    if (!input.amount || input.amount <= 0) throw new Error('Informe um valor de dívida maior que zero.');
    if (!input.account) throw new Error('Selecione a conta que receberá o valor da dívida.');
    const creditor = creditors.find((c) => c.id === input.creditorId);
    if (!creditor) throw new Error('Credor não encontrado.');
    const installmentsTotal = input.installmentsTotal ? Math.max(1, Math.floor(input.installmentsTotal)) : null;
    const firstDueDate = input.firstDueDate || input.dueDate || null;
    const { data, error } = await supabase
      .from('payable_debts')
      .insert({
        id: newId('pdbt'),
        creditor_id: creditor.id,
        creditor_name: creditor.name,
        creditor_document: creditor.document || null,
        creditor_phone: creditor.phone || null,
        original_amount: input.amount,
        remaining_amount: input.amount,
        status: 'Aberta',
        due_date: firstDueDate,
        first_due_date: firstDueDate,
        installments_total: installmentsTotal,
        notes: input.notes || null,
        source: 'manual',
        entry_account: input.account
      })
      .select('*')
      .single();
    if (error) throw error;
    const mapped = mapPayableDebt(data);
    setPayableDebts((prev) => [mapped, ...prev]);
    if (role === 'admin') {
      const { data: refreshedTransactions } = await supabase.from('transactions').select('*');
      if (refreshedTransactions) setTransactions(refreshedTransactions.map(mapTransaction));
    }
    logDataEvent('payable_debt_created', 'PayableDebts', { amount: input.amount, account: input.account });
    return mapped;
  };

  const updatePayableDebt = async (id: string, updates: UpdatePayableDebtInput): Promise<void> => {
    const current = payableDebts.find((d) => d.id === id);
    if (!current) throw new Error('Dívida não encontrada.');
    const payload: any = {};
    if (updates.amount !== undefined) {
      const numAmount = Number(updates.amount);
      if (!Number.isFinite(numAmount) || numAmount <= 0) throw new Error('Informe um valor válido.');
      const paidSoFar = current.originalAmount - current.remainingAmount;
      if (numAmount < paidSoFar) throw new Error('O valor não pode ser menor que o total já pago.');
      payload.original_amount = numAmount;
      if (Math.abs(current.originalAmount - current.remainingAmount) < 0.00001) {
        payload.remaining_amount = numAmount;
      }
    }
    const firstDueDate = updates.firstDueDate ?? updates.dueDate;
    if (firstDueDate !== undefined) {
      payload.first_due_date = firstDueDate || null;
      payload.due_date = firstDueDate || null;
    }
    if (updates.installmentsTotal !== undefined) {
      payload.installments_total = updates.installmentsTotal ? Math.max(1, Math.floor(updates.installmentsTotal)) : null;
    }
    if (updates.notes !== undefined) payload.notes = updates.notes || null;
    if (Object.keys(payload).length === 0) return;
    const { data, error } = await supabase.from('payable_debts').update(payload).eq('id', id).select('*').single();
    if (error) throw error;
    setPayableDebts((prev) => prev.map((d) => (d.id === id ? mapPayableDebt(data) : d)));
    logDataEvent('payable_debt_updated', 'PayableDebts', { debtId: id });
  };

  const removePayableDebt = async (id: string): Promise<void> => {
    const payments = payableDebtPayments.filter((p) => p.payableDebtId === id);
    if (payments.length > 0) throw new Error('Estorne todos os pagamentos antes de excluir a dívida.');
    const { error } = await supabase.from('payable_debts').delete().eq('id', id);
    if (error) throw error;
    setPayableDebts((prev) => prev.filter((d) => d.id !== id));
    // Remove a transação de entrada vinculada (deletada no DB pelo trigger)
    setTransactions((prev) => prev.filter((t) => t.payableDebtId !== id));
    logDataEvent('payable_debt_deleted', 'PayableDebts', { debtId: id });
  };

  const addPayableDebtPayment = async (input: AddPayableDebtPaymentInput): Promise<void> => {
    if (!input.amount || input.amount <= 0) throw new Error('Informe um valor maior que zero.');
    const { data: paymentData, error: paymentError } = await supabase
      .from('payable_debt_payments')
      .insert({
        id: newId('pdpm'),
        payable_debt_id: input.payableDebtId,
        amount: input.amount,
        payment_method: input.paymentMethod,
        account: input.account,
        paid_at: input.paidAt || new Date().toISOString(),
        notes: input.notes || null,
        attachment_path: input.attachmentPath || null,
        attachment_mime: input.attachmentMime || null,
        attachment_name: input.attachmentName || null,
        attachment_size: input.attachmentSize || null
      })
      .select('*')
      .single();
    if (paymentError) throw paymentError;
    const mappedPayment = mapPayableDebtPayment(paymentData);
    setPayableDebtPayments((prev) => [mappedPayment, ...prev]);

    const { data: updatedDebt, error: debtError } = await supabase
      .from('payable_debts')
      .select('*')
      .eq('id', input.payableDebtId)
      .single();
    if (debtError) throw debtError;
    setPayableDebts((prev) => prev.map((d) => (d.id === input.payableDebtId ? mapPayableDebt(updatedDebt) : d)));

    if (role === 'admin') {
      const { data: refreshedTransactions } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .limit(100000);
      if (refreshedTransactions) setTransactions(refreshedTransactions.map(mapTransaction));
    }
    logDataEvent('payable_debt_payment_registered', 'PayableDebts', {
      amount: input.amount,
      account: input.account,
      isFullSettlement: updatedDebt?.remaining_amount <= 0 ? true : false
    });
  };

  const revertPayableDebtPayment = async (paymentId: string): Promise<void> => {
    const existing = payableDebtPayments.find((p) => p.id === paymentId);
    const { error } = await supabase.from('payable_debt_payments').delete().eq('id', paymentId);
    if (error) throw error;
    setPayableDebtPayments((prev) => prev.filter((p) => p.id !== paymentId));
    setTransactions((prev) => prev.filter((t) => t.payableDebtPaymentId !== paymentId));
    if (existing?.payableDebtId) {
      const { data: refreshedDebt } = await supabase
        .from('payable_debts')
        .select('*')
        .eq('id', existing.payableDebtId)
        .maybeSingle();
      if (refreshedDebt) setPayableDebts((prev) => prev.map((d) => (d.id === existing.payableDebtId ? mapPayableDebt(refreshedDebt) : d)));
      logDataEvent('payable_debt_payment_reverted', 'PayableDebts', { debtId: existing.payableDebtId, amount: existing.amount });
    }
  };

  const getPayableDebtPayments = (payableDebtId: string) =>
    payableDebtPayments
      .filter((p) => p.payableDebtId === payableDebtId)
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());

  return (
      <DataContext.Provider value={{
      businessProfile, cardFeeSettings, stock, customers, sellers, debts, debtPayments, stores, deviceCatalog, transactions, sales, costHistory, partsInventory, loading,
      creditors, payableDebts, payableDebtPayments,
      refreshData: fetchData,
      updateBusinessProfile, updateCardFeeSettings,
      addStockItem, updateStockItem, removeStockItem,
      addCustomer, updateCustomer, removeCustomer,
      addSeller, updateSeller, removeSeller,
      addStore, updateStore, removeStore,
      addDeviceCatalogItem,
      addSale, updateSale, removeSale, addDebt, updateDebt, removeDebt, payDebt, getDebtPayments, removeDebtPayment, addTransaction, updateTransaction, removeTransaction,
      addCostHistory, getCostHistoryByModel, addCostToItem, addPart, updatePart, removePart, addPartCostToItem,
      financialCategories,
      addCreditor, updateCreditor, removeCreditor,
      addPayableDebt, updatePayableDebt, removePayableDebt, addPayableDebtPayment, revertPayableDebtPayment, getPayableDebtPayments,
      addFinancialCategory: async (category) => {
        const id = newId('fcat');
        const { data, error } = await supabase.from('finance_categories').insert({
          id,
          name: category.name,
          type: category.type,
          is_default: category.isDefault
        }).select().single();
        if (error) throw error;
        if (data) setFinancialCategories(prev => [...prev, mapFinancialCategory(data)]);
      },
      updateFinancialCategory: async (id, updates) => {
        const dbUpdates: any = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.type !== undefined) dbUpdates.type = updates.type;
        if (updates.isDefault !== undefined) dbUpdates.is_default = updates.isDefault;
        
        const { error } = await supabase.from('finance_categories').update(dbUpdates).eq('id', id);
        if (error) throw error;
        setFinancialCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
      },
      removeFinancialCategory: async (id) => {
        const { error } = await supabase.from('finance_categories').delete().eq('id', id);
        if (error) throw error;
        setFinancialCategories(prev => prev.filter(c => c.id !== id));
      }
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within a DataProvider");
  return context;
};
