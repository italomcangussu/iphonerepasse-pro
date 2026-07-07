import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  StockItem,
  Customer,
  Seller,
  Transaction,
  Sale,
  StockStatus,
  DeviceType,
  StoreLocation,
  BusinessProfile,
  CostItem,
  PaymentMethod,
  DeviceCatalogItem,
  Debt,
  DebtPayment,
  PartStockItem,
  CardFeeSettings,
  SaleTradeInItem,
  FinancialCategory,
  Creditor,
  PayableDebt,
  PayableDebtPayment,
  PayableDebtStatus,
  SimulatorTradeInAdjustment,
  SimulatorTradeInValue,
  StockReservation,
  StockReservationInput,
  FinancialAccount
} from '../types';
import type {
  AddDebtInput,
  AddPartInput,
  AddPayableDebtInput,
  AddPayableDebtPaymentInput,
  CostHistoryItem,
  DataContextType,
  PayDebtInput,
  UpdateDebtInput,
  UpdatePartInput,
  UpdatePayableDebtInput
} from './data/dataContextTypes';
import {
  fetchAllTransactions,
  loadFinanceData,
  loadSalesHistoryData,
  loadShellAndCoreData,
  SALES_SELECT
} from './data/dataLoaders';
import {
  removeById,
  removeDebtCascade,
  removePayableDebtCascade,
  removeSaleCascade,
  upsertById,
  upsertManyById
} from './data/realtime/realtimeState';
import { useDataRealtime } from './data/useDataRealtime';
import { supabase } from './supabase';
import { removeImages } from './storage';
import { newId } from '../utils/id';
import { useAuth } from '../contexts/AuthContext';
import { matchCustomerByPriority } from '../utils/debts';
import { DEFAULT_CARD_FEE_SETTINGS, normalizeCardFeeSettings } from '../utils/cardFees';
import { trackUxEvent } from './telemetry';
import { normalizeFinancialAccount } from '../utils/financialAccounts';
import {
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_SPECIAL_BUSINESS_HOURS,
  normalizeBusinessHours,
  normalizeSpecialBusinessHours
} from '../utils/businessHours';

export type {
  AddDebtInput,
  AddPartInput,
  AddPayableDebtInput,
  AddPayableDebtPaymentInput,
  CostHistoryItem,
  PayDebtInput,
  UpdateDebtInput,
  UpdatePartInput,
  UpdatePayableDebtInput
} from './data/dataContextTypes';

const DataContext = createContext<DataContextType | undefined>(undefined);

const DEFAULT_BUSINESS_PROFILE: BusinessProfile = {
  name: 'iPhoneRepasse',
  cnpj: '',
  phone: '',
  email: '',
  address: '',
  instagram: '',
  businessHours: DEFAULT_BUSINESS_HOURS,
  specialBusinessHours: DEFAULT_SPECIAL_BUSINESS_HOURS,
};

const RESYNC_DEBOUNCE_MS = 250;

const mergeSaleLinkedRows = <T extends { id: string; saleId?: string | null }>(
  currentRows: T[],
  saleId: string,
  incomingRows: T[]
) => {
  const incomingIds = new Set(incomingRows.map((row) => row.id));
  return [
    ...incomingRows,
    ...currentRows.filter((row) => row.saleId !== saleId && !incomingIds.has(row.id))
  ];
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading: authLoading, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [salesHistoryLoading, setSalesHistoryLoading] = useState(false);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(DEFAULT_BUSINESS_PROFILE);
  const [cardFeeSettings, setCardFeeSettings] = useState<CardFeeSettings>(DEFAULT_CARD_FEE_SETTINGS);
  const [simulatorTradeInValues, setSimulatorTradeInValues] = useState<SimulatorTradeInValue[]>([]);
  const [simulatorTradeInAdjustments, setSimulatorTradeInAdjustments] = useState<SimulatorTradeInAdjustment[]>([]);

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
  const salesRef = useRef<Sale[]>([]);
  const transactionsRef = useRef<Transaction[]>([]);
  const debtsRef = useRef<Debt[]>([]);
  const debtPaymentsRef = useRef<DebtPayment[]>([]);
  const payableDebtsRef = useRef<PayableDebt[]>([]);
  const payableDebtPaymentsRef = useRef<PayableDebtPayment[]>([]);
  const mapSaleRef = useRef<(s: any) => Sale>((s: any) => s as Sale);
  const fetchSequenceRef = useRef(0);
  const appliedFetchSequenceRef = useRef(0);
  const lastFetchAtRef = useRef(0);
  const salesHistoryLoadedRef = useRef(false);
  const financeLoadedRef = useRef(false);
  const salesHistoryPromiseRef = useRef<Promise<void> | null>(null);
  const financePromiseRef = useRef<Promise<void> | null>(null);
  const pendingSaleMutationsRef = useRef<Map<string, { type: 'add' | 'remove'; sale?: Sale; timestamp: number }>>(new Map());
  const pendingMutationsRef = useRef<Map<string, { type: 'add' | 'update' | 'remove'; timestamp: number }>>(new Map());

  const recordPendingSaleMutation = useCallback((saleId: string, type: 'add' | 'remove', sale?: Sale) => {
    const timestamp = Date.now();
    pendingSaleMutationsRef.current.set(saleId, { type, sale, timestamp });
    setTimeout(() => {
      const current = pendingSaleMutationsRef.current.get(saleId);
      if (current && current.timestamp === timestamp) {
        pendingSaleMutationsRef.current.delete(saleId);
      }
    }, 8000);
  }, []);

  const recordPendingMutation = useCallback((table: string, id: string, type: 'add' | 'update' | 'remove') => {
    const key = `${table}:${id}`;
    const timestamp = Date.now();
    pendingMutationsRef.current.set(key, { type, timestamp });
    setTimeout(() => {
      const current = pendingMutationsRef.current.get(key);
      if (current && current.timestamp === timestamp) {
        pendingMutationsRef.current.delete(key);
      }
    }, 8000);
  }, []);

  const hasPendingMutation = (table: string, id: string, types?: Array<'add' | 'update' | 'remove'>) => {
    const entry = pendingMutationsRef.current.get(`${table}:${id}`);
    if (!entry) return false;
    return types ? types.includes(entry.type) : true;
  };

  useEffect(() => {
    salesRef.current = sales;
  }, [sales]);

  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

  useEffect(() => {
    debtsRef.current = debts;
  }, [debts]);

  useEffect(() => {
    debtPaymentsRef.current = debtPayments;
  }, [debtPayments]);

  useEffect(() => {
    payableDebtsRef.current = payableDebts;
  }, [payableDebts]);

  useEffect(() => {
    payableDebtPaymentsRef.current = payableDebtPayments;
  }, [payableDebtPayments]);

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
    setSimulatorTradeInValues([]);
    setSimulatorTradeInAdjustments([]);
    setSalesHistoryLoading(false);
    setFinanceLoading(false);
    salesHistoryLoadedRef.current = false;
    financeLoadedRef.current = false;
    salesHistoryPromiseRef.current = null;
    financePromiseRef.current = null;
  }, []);

  const invalidatePendingFetches = useCallback(() => {
    const sequence = ++fetchSequenceRef.current;
    appliedFetchSequenceRef.current = Math.max(appliedFetchSequenceRef.current, sequence);
  }, []);

  const applyShellAndCoreData = useCallback((results: Awaited<ReturnType<typeof loadShellAndCoreData>>) => {
    const {
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
    } = results;

    if (cardFeeSettingsResult.error) console.error('Error fetching card fee settings:', cardFeeSettingsResult.error);
    if (aiEntrySettingsResult.error) console.error('Error fetching AI entry settings:', aiEntrySettingsResult.error);
    if (simulatorTradeInValuesResult.error) console.error('Error fetching simulator trade-in values:', simulatorTradeInValuesResult.error);
    if (simulatorTradeInAdjustmentsResult.error) console.error('Error fetching simulator trade-in adjustments:', simulatorTradeInAdjustmentsResult.error);
    if (stockReservationsResult.error) console.error('Error fetching stock reservations:', stockReservationsResult.error);
    if (deviceCatalogResult.error) console.error('Error fetching device catalog:', deviceCatalogResult.error);

    const storesData = storesResult.data || [];
    const defaultStoreId = storesData[0]?.id;
    const aiEntrySettingsData = aiEntrySettingsResult.data || [];
    const profileAiSettings = aiEntrySettingsData.find((settings: any) => settings.store_id === defaultStoreId)
      || aiEntrySettingsData[0]
      || null;
    const profile = profileResult.data;

    setBusinessProfile(profile ? mapProfile(profile, profileAiSettings) : {
      ...DEFAULT_BUSINESS_PROFILE,
      storeId: defaultStoreId,
      businessHours: normalizeBusinessHours(profileAiSettings?.business_hours),
      specialBusinessHours: normalizeSpecialBusinessHours(profileAiSettings?.special_business_hours),
    });
    setCardFeeSettings(
      cardFeeSettingsResult.data
        ? normalizeCardFeeSettings({
            visaMasterRates: cardFeeSettingsResult.data.visa_master_rates,
            otherRates: cardFeeSettingsResult.data.other_rates,
            debitRate: cardFeeSettingsResult.data.debit_rate
          })
        : DEFAULT_CARD_FEE_SETTINGS
    );
    setStores(storesData);
    setSimulatorTradeInValues((simulatorTradeInValuesResult.data || []).map(mapSimulatorTradeInValue));
    setSimulatorTradeInAdjustments((simulatorTradeInAdjustmentsResult.data || []).map(mapSimulatorTradeInAdjustment));
    setCustomers((customersResult.data || []).map(mapCustomer));
    setSellers(mapSellers(sellersResult.data || []));

    const reservationByStockItem = new Map<string, StockReservation>(
      (stockReservationsResult.data || []).map((reservation: any) => {
        const mapped = mapStockReservation(reservation);
        return [mapped.stockItemId, mapped] as const;
      })
    );
    setStock((stockResult.data || []).map((item: any) => mapStockItem(item, reservationByStockItem.get(item.id) || null)));
    setDeviceCatalog((deviceCatalogResult.data || []).map(mapDeviceCatalogItem));
  }, []);

  const applySalesHistoryData = useCallback((salesResult: { data: any[] | null; error: any }) => {
    if (salesResult.error) {
      console.error('Error fetching sales:', salesResult.error);
      return;
    }

    const mappedSales = (salesResult.data || [])
      .map((sale) => mapSaleRef.current(sale))
      .filter((sale) => pendingSaleMutationsRef.current.get(sale.id)?.type !== 'remove');
    const presentIds = new Set(mappedSales.map((sale) => sale.id));
    const pendingAdds: Sale[] = [];
    pendingSaleMutationsRef.current.forEach((entry, id) => {
      if (entry.type === 'add' && entry.sale && !presentIds.has(id)) {
        pendingAdds.push(entry.sale);
      }
    });
    setSales([...mappedSales, ...pendingAdds]);
    salesHistoryLoadedRef.current = true;
  }, []);

  const applyFinanceData = useCallback((results: {
    debtsResult: any;
    debtPaymentsResult: any;
    partsResult: any;
    transactionsResult: any;
    costHistoryResult: any;
    categoriesResult: any;
    creditorsResult: any;
    payableDebtsResult: any;
    payableDebtPaymentsResult: any;
  }) => {
    const {
      debtsResult,
      debtPaymentsResult,
      partsResult,
      transactionsResult,
      costHistoryResult,
      categoriesResult,
      creditorsResult,
      payableDebtsResult,
      payableDebtPaymentsResult
    } = results;

    if (debtsResult.error) console.error('Error fetching debts:', debtsResult.error);
    if (debtPaymentsResult.error) console.error('Error fetching debt payments:', debtPaymentsResult.error);
    if (partsResult.error) console.error('Error fetching parts inventory:', partsResult.error);
    if (transactionsResult.error) console.error('Error fetching transactions:', transactionsResult.error);
    if (costHistoryResult.error) console.error('Error fetching cost history:', costHistoryResult.error);
    if (categoriesResult.error) console.error('Error fetching finance categories:', categoriesResult.error);
    if (creditorsResult.error) console.error('Error fetching creditors:', creditorsResult.error);
    if (payableDebtsResult.error) console.error('Error fetching payable debts:', payableDebtsResult.error);
    if (payableDebtPaymentsResult.error) console.error('Error fetching payable debt payments:', payableDebtPaymentsResult.error);

    setDebts(role === 'admin' ? (debtsResult.data || []).map(mapDebt) : []);
    setDebtPayments(role === 'admin' ? (debtPaymentsResult.data || []).map(mapDebtPayment) : []);
    setPartsInventory((partsResult.data || []).map(mapPartStockItem));
    setTransactions(role === 'admin' ? (transactionsResult.data || []).map(mapTransaction) : []);
    setCostHistory((costHistoryResult.data || []).map(mapCostHistory));
    setFinancialCategories((categoriesResult.data || []).map(mapFinancialCategory));
    setCreditors(role === 'admin' ? (creditorsResult.data || []).map(mapCreditor) : []);
    setPayableDebts(role === 'admin' ? (payableDebtsResult.data || []).map(mapPayableDebt) : []);
    setPayableDebtPayments(role === 'admin' ? (payableDebtPaymentsResult.data || []).map(mapPayableDebtPayment) : []);
    financeLoadedRef.current = true;
  }, [role]);

  const ensureSalesHistoryLoaded = useCallback(async () => {
    if (!isAuthenticated || salesHistoryLoadedRef.current) return;
    if (salesHistoryPromiseRef.current) return salesHistoryPromiseRef.current;

    setSalesHistoryLoading(true);
    const promise = Promise.resolve(loadSalesHistoryData(supabase))
      .then(applySalesHistoryData)
      .finally(() => {
        setSalesHistoryLoading(false);
        salesHistoryPromiseRef.current = null;
      });
    salesHistoryPromiseRef.current = promise;
    return promise;
  }, [isAuthenticated, applySalesHistoryData]);

  const ensureFinanceLoaded = useCallback(async () => {
    if (!isAuthenticated || financeLoadedRef.current) return;
    if (financePromiseRef.current) return financePromiseRef.current;

    setFinanceLoading(true);
    const promise = loadFinanceData(supabase, role)
      .then(applyFinanceData)
      .finally(() => {
        setFinanceLoading(false);
        financePromiseRef.current = null;
      });
    financePromiseRef.current = promise;
    return promise;
  }, [isAuthenticated, role, applyFinanceData]);

  const bootstrapData = useCallback(async () => {
    if (!isAuthenticated) {
      resetState();
      setLoading(false);
      return;
    }

    const fetchSequence = ++fetchSequenceRef.current;
    setLoading(true);
    try {
      const results = await loadShellAndCoreData(supabase);
      if (fetchSequence < appliedFetchSequenceRef.current) return;
      appliedFetchSequenceRef.current = fetchSequence;
      applyShellAndCoreData(results);
    } catch (error) {
      console.error('Error bootstrapping data:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, resetState, applyShellAndCoreData]);

  const fetchData = useCallback(async (options?: { silent?: boolean; force?: boolean; reason?: string }) => {
    if (!isAuthenticated) {
      resetState();
      setLoading(false);
      return;
    }

    const silent = options?.silent ?? false;
    const force = options?.force ?? false;
    const now = Date.now();

    if (!force && now - lastFetchAtRef.current < RESYNC_DEBOUNCE_MS) {
      return;
    }

    lastFetchAtRef.current = now;
    const fetchSequence = ++fetchSequenceRef.current;

    if (!silent) {
      setLoading(true);
    }

    try {
        const [
          profileResult,
          cardFeeSettingsResult,
          aiEntrySettingsResult,
          simulatorTradeInValuesResult,
          simulatorTradeInAdjustmentsResult,
          storesResult,
          customersResult,
          sellersResult,
          debtsResult,
          debtPaymentsResult,
          stockResult,
          stockReservationsResult,
          deviceCatalogResult,
          partsResult,
          salesResult,
          transactionsResult,
          costHistoryResult,
          categoriesResult,
          creditorsResult,
          payableDebtsResult,
          payableDebtPaymentsResult
        ] = await Promise.all([
          supabase.from('business_profile').select('*').single(),
          supabase.from('card_fee_settings').select('*').eq('id', 'default').single(),
          supabase.from('crm_ai_entry_settings').select('store_id,business_hours,special_business_hours'),
          supabase.from('simulator_trade_in_values').select('*').order('model', { ascending: true }),
          supabase.from('simulator_trade_in_adjustments').select('*').order('label', { ascending: true }),
          supabase.from('stores').select('*'),
          supabase.from('customers').select('*'),
          supabase.from('sellers').select('*'),
          role === 'admin'
            ? supabase.from('debts').select('*').order('created_at', { ascending: false })
            : Promise.resolve({ data: [], error: null }),
          role === 'admin'
            ? supabase.from('debt_payments').select('*').order('paid_at', { ascending: false })
            : Promise.resolve({ data: [], error: null }),
          supabase.from('stock_items').select('*, costs(*)'),
          supabase.from('stock_reservations').select('*').eq('status', 'active'),
          supabase.from('device_catalog').select('*').order('created_at', { ascending: false }),
          supabase.from('parts_inventory').select('*').order('name', { ascending: true }),
          supabase.from('sales').select(SALES_SELECT),
          role === 'admin'
            ? fetchAllTransactions(supabase)
            : Promise.resolve({ data: [], error: null }),
          supabase.from('cost_history').select('*'),
          supabase.from('finance_categories').select('*').order('name', { ascending: true }),
          role === 'admin'
            ? supabase.from('creditors').select('*').order('name', { ascending: true })
            : Promise.resolve({ data: [], error: null }),
          role === 'admin'
            ? supabase.from('payable_debts').select('*').order('created_at', { ascending: false })
            : Promise.resolve({ data: [], error: null }),
          role === 'admin'
            ? supabase.from('payable_debt_payments').select('*').order('paid_at', { ascending: false })
            : Promise.resolve({ data: [], error: null })
        ]);

        const { data: profile } = profileResult;
        const { data: cardFeeSettingsData, error: cardFeeSettingsError } = cardFeeSettingsResult;
        const { data: aiEntrySettingsData, error: aiEntrySettingsError } = aiEntrySettingsResult;
        const { data: simulatorTradeInValuesData, error: simulatorTradeInValuesError } = simulatorTradeInValuesResult;
        const { data: simulatorTradeInAdjustmentsData, error: simulatorTradeInAdjustmentsError } = simulatorTradeInAdjustmentsResult;
        const { data: storesData } = storesResult;
        const { data: customersData } = customersResult;
        const { data: sellersData } = sellersResult;
        const { data: stockData } = stockResult;
        const { data: stockReservationsData, error: stockReservationsError } = stockReservationsResult;
        const { data: deviceCatalogData, error: deviceCatalogError } = deviceCatalogResult;
        const { data: partsData, error: partsError } = partsResult;
        const { data: salesData } = salesResult;
        const { data: costHistoryData, error: costHistoryError } = costHistoryResult;
        const { data: categoriesData, error: categoriesError } = categoriesResult;

        if (cardFeeSettingsError) console.error('Error fetching card fee settings:', cardFeeSettingsError);
        if (aiEntrySettingsError) console.error('Error fetching AI entry settings:', aiEntrySettingsError);
        if (simulatorTradeInValuesError) console.error('Error fetching simulator trade-in values:', simulatorTradeInValuesError);
        if (simulatorTradeInAdjustmentsError) console.error('Error fetching simulator trade-in adjustments:', simulatorTradeInAdjustmentsError);
        if (debtsResult.error) console.error('Error fetching debts:', debtsResult.error);
        if (debtPaymentsResult.error) console.error('Error fetching debt payments:', debtPaymentsResult.error);
        if (stockReservationsError) console.error('Error fetching stock reservations:', stockReservationsError);
        if (deviceCatalogError) console.error('Error fetching device catalog:', deviceCatalogError);
        if (partsError) console.error('Error fetching parts inventory:', partsError);
        if (transactionsResult.error) console.error('Error fetching transactions:', transactionsResult.error);
        if (costHistoryError) console.error('Error fetching cost history:', costHistoryError);
        if (categoriesError) console.error('Error fetching finance categories:', categoriesError);
        if (creditorsResult.error) console.error('Error fetching creditors:', creditorsResult.error);
        if (payableDebtsResult.error) console.error('Error fetching payable debts:', payableDebtsResult.error);
        if (payableDebtPaymentsResult.error) console.error('Error fetching payable debt payments:', payableDebtPaymentsResult.error);

        if (fetchSequence < appliedFetchSequenceRef.current) {
          return;
        }
        appliedFetchSequenceRef.current = fetchSequence;

        const defaultStoreId = (storesData || [])[0]?.id;
        const profileAiSettings = (aiEntrySettingsData || []).find((settings: any) => settings.store_id === defaultStoreId)
          || (aiEntrySettingsData || [])[0]
          || null;

        setBusinessProfile(profile ? mapProfile(profile, profileAiSettings) : {
          ...DEFAULT_BUSINESS_PROFILE,
          storeId: defaultStoreId,
          businessHours: normalizeBusinessHours(profileAiSettings?.business_hours),
          specialBusinessHours: normalizeSpecialBusinessHours(profileAiSettings?.special_business_hours),
        });
        setCardFeeSettings(
          cardFeeSettingsData
            ? normalizeCardFeeSettings({
                visaMasterRates: cardFeeSettingsData.visa_master_rates,
                otherRates: cardFeeSettingsData.other_rates,
                debitRate: cardFeeSettingsData.debit_rate
              })
            : DEFAULT_CARD_FEE_SETTINGS
        );
        setStores(storesData || []);
        setSimulatorTradeInValues((simulatorTradeInValuesData || []).map(mapSimulatorTradeInValue));
        setSimulatorTradeInAdjustments((simulatorTradeInAdjustmentsData || []).map(mapSimulatorTradeInAdjustment));
        setCustomers((customersData || []).map(mapCustomer));
        setSellers(mapSellers(sellersData || []));
        setDebts(role === 'admin' ? (debtsResult.data || []).map(mapDebt) : []);
        setDebtPayments(role === 'admin' ? (debtPaymentsResult.data || []).map(mapDebtPayment) : []);
        const reservationByStockItem = new Map(
          (stockReservationsData || []).map((reservation: any) => {
            const mapped = mapStockReservation(reservation);
            return [mapped.stockItemId, mapped] as const;
          })
        );
        setStock((stockData || []).map((item) => mapStockItem(item, reservationByStockItem.get(item.id) || null)));
        setDeviceCatalog((deviceCatalogData || []).map(mapDeviceCatalogItem));
        setPartsInventory((partsData || []).map(mapPartStockItem));
        {
          const mappedSales = (salesData || [])
            .map((s) => mapSaleRef.current(s))
            .filter((s) => pendingSaleMutationsRef.current.get(s.id)?.type !== 'remove');
          const presentIds = new Set(mappedSales.map((s) => s.id));
          const pendingAdds: Sale[] = [];
          pendingSaleMutationsRef.current.forEach((entry, id) => {
            if (entry.type === 'add' && entry.sale && !presentIds.has(id)) {
              pendingAdds.push(entry.sale);
            }
          });
          setSales([...mappedSales, ...pendingAdds]);
        }
        setTransactions(role === 'admin' ? (transactionsResult.data || []).map(mapTransaction) : []);
        setCostHistory((costHistoryData || []).map(mapCostHistory));
        setFinancialCategories((categoriesData || []).map(mapFinancialCategory));
        setCreditors(role === 'admin' ? (creditorsResult.data || []).map(mapCreditor) : []);
        setPayableDebts(role === 'admin' ? (payableDebtsResult.data || []).map(mapPayableDebt) : []);
        setPayableDebtPayments(role === 'admin' ? (payableDebtPaymentsResult.data || []).map(mapPayableDebtPayment) : []);
        salesHistoryLoadedRef.current = !salesResult.error;
        financeLoadedRef.current = ![
          debtsResult.error,
          debtPaymentsResult.error,
          partsResult.error,
          transactionsResult.error,
          costHistoryResult.error,
          categoriesResult.error,
          creditorsResult.error,
          payableDebtsResult.error,
          payableDebtPaymentsResult.error
        ].some(Boolean);
    } catch (error) {
        console.error('Error fetching data:', error);
    } finally {
        if (!silent) {
          setLoading(false);
        }
    }
  }, [isAuthenticated, resetState, role]);

  const scheduleResync = useCallback((reason: string, options?: { force?: boolean }) => {
    void fetchData({ silent: true, force: options?.force ?? true, reason });
  }, [fetchData]);

  useEffect(() => {
    if (authLoading) return;
    void bootstrapData();
  }, [authLoading, bootstrapData]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleFocus = () => scheduleResync('window-focus');
    const handleOnline = () => scheduleResync('window-online');
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleResync('document-visible');
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, scheduleResync]);

  const fetchAndApplySale = useCallback(async (id: string) => {
    if (pendingSaleMutationsRef.current.get(id)?.type === 'remove') return;
    const { data } = await supabase.from('sales').select(SALES_SELECT).eq('id', id).single();
    if (!data) return;
    if (pendingSaleMutationsRef.current.get(id)?.type === 'remove') return;
    const mapped = mapSaleRef.current(data);
    setSales((prev) => (prev.some((s) => s.id === id)
      ? prev.map((s) => (s.id === id ? mapped : s))
      : [...prev, mapped]));
  }, []);

  const registerDataRealtime = useCallback((channel: RealtimeChannel) => channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_profile' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setBusinessProfile(DEFAULT_BUSINESS_PROFILE);
          return;
        }
        setBusinessProfile(mapProfile(payload.new));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'card_fee_settings' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setCardFeeSettings(DEFAULT_CARD_FEE_SETTINGS);
          return;
        }
        const settings = payload.new as {
          visa_master_rates?: CardFeeSettings['visaMasterRates'];
          other_rates?: CardFeeSettings['otherRates'];
          debit_rate?: CardFeeSettings['debitRate'];
        };
        setCardFeeSettings(normalizeCardFeeSettings({
          visaMasterRates: settings.visa_master_rates,
          otherRates: settings.other_rates,
          debitRate: settings.debit_rate
        }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'simulator_trade_in_values' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as { id?: string }).id;
          if (deletedId) setSimulatorTradeInValues((prev) => removeById(prev, deletedId));
          return;
        }
        const mapped = mapSimulatorTradeInValue(payload.new);
        setSimulatorTradeInValues((prev) => (
          prev.some((item) => item.id === mapped.id)
            ? prev.map((item) => (item.id === mapped.id ? mapped : item))
            : [...prev, mapped]
        ));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'simulator_trade_in_adjustments' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as { id?: string }).id;
          if (deletedId) setSimulatorTradeInAdjustments((prev) => removeById(prev, deletedId));
          return;
        }
        const mapped = mapSimulatorTradeInAdjustment(payload.new);
        setSimulatorTradeInAdjustments((prev) => (
          prev.some((item) => item.id === mapped.id)
            ? prev.map((item) => (item.id === mapped.id ? mapped : item))
            : [...prev, mapped]
        ));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sale_items' }, async (payload) => {
        const saleId =
          payload.eventType === 'DELETE'
            ? (payload.old as { sale_id?: string }).sale_id
            : (payload.new as { sale_id?: string }).sale_id;
        if (!saleId) return;
        if (pendingSaleMutationsRef.current.get(saleId)?.type === 'remove') return;
        await Promise.all([fetchAndApplySale(saleId), refreshSaleSideEffects(saleId)]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_methods' }, async (payload) => {
        const saleId =
          payload.eventType === 'DELETE'
            ? (payload.old as { sale_id?: string }).sale_id
            : (payload.new as { sale_id?: string }).sale_id;
        if (!saleId) return;
        if (pendingSaleMutationsRef.current.get(saleId)?.type === 'remove') return;
        await Promise.all([fetchAndApplySale(saleId), refreshSaleSideEffects(saleId)]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sale_trade_in_items' }, async (payload) => {
        const saleId =
          payload.eventType === 'DELETE'
            ? (payload.old as { sale_id?: string }).sale_id
            : (payload.new as { sale_id?: string }).sale_id;
        if (!saleId) return;
        if (pendingSaleMutationsRef.current.get(saleId)?.type === 'remove') return;
        await Promise.all([fetchAndApplySale(saleId), refreshSaleSideEffects(saleId)]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, async (payload) => {
        if (payload.eventType === 'DELETE') {
          const deletedSaleId = (payload.old as { id: string }).id;
          const cascadeState = {
            saleId: deletedSaleId,
            sales: salesRef.current,
            transactions: transactionsRef.current,
            debts: debtsRef.current,
            debtPayments: debtPaymentsRef.current,
            payableDebts: payableDebtsRef.current,
            payableDebtPayments: payableDebtPaymentsRef.current,
            stock: []
          };
          setSales((prev) => removeSaleCascade({ ...cascadeState, sales: prev }).sales);
          setTransactions((prev) => removeSaleCascade({ ...cascadeState, transactions: prev }).transactions);
          setDebts((prev) => removeSaleCascade({ ...cascadeState, debts: prev }).debts);
          setDebtPayments((prev) => removeSaleCascade({ ...cascadeState, debtPayments: prev }).debtPayments);
          setPayableDebts((prev) => removeSaleCascade({ ...cascadeState, payableDebts: prev }).payableDebts);
          setPayableDebtPayments((prev) => (
            removeSaleCascade({ ...cascadeState, payableDebtPayments: prev }).payableDebtPayments
          ));
          setStock((prev) => removeSaleCascade({ ...cascadeState, stock: prev }).stock);
          pendingSaleMutationsRef.current.delete(deletedSaleId);
          return;
        }
        const id = (payload.new as { id: string }).id;
        pendingSaleMutationsRef.current.delete(id);
        await Promise.all([fetchAndApplySale(id), refreshSaleSideEffects(id)]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, async (payload) => {
        if (role !== 'admin') return;
        if (payload.eventType === 'DELETE') {
          const deletedTransaction = payload.old as {
            id: string;
            debt_payment_id?: string | null;
            payable_debt_payment_id?: string | null;
          };
          const localTransaction = transactionsRef.current.find((transaction) => transaction.id === deletedTransaction.id);
          const debtPaymentId = deletedTransaction.debt_payment_id ?? localTransaction?.debtPaymentId ?? null;
          const payableDebtPaymentId =
            deletedTransaction.payable_debt_payment_id ?? localTransaction?.payableDebtPaymentId ?? null;
          setTransactions((prev) => prev.filter((t) => t.id !== deletedTransaction.id));

          if (debtPaymentId) {
            const linkedPayment = debtPaymentsRef.current.find((payment) => payment.id === debtPaymentId);
            setDebtPayments((prev) => prev.filter((payment) => payment.id !== debtPaymentId));
            if (linkedPayment?.debtId) {
              await refreshDebtById(linkedPayment.debtId);
            }
          }

          if (payableDebtPaymentId) {
            const linkedPayment = payableDebtPaymentsRef.current.find((payment) => payment.id === payableDebtPaymentId);
            setPayableDebtPayments((prev) => prev.filter((payment) => payment.id !== payableDebtPaymentId));
            if (linkedPayment?.payableDebtId) {
              await refreshPayableDebtById(linkedPayment.payableDebtId);
            }
          }
        } else if (payload.eventType === 'INSERT') {
          const mapped = mapTransaction(payload.new);
          setTransactions((prev) => upsertById(prev, mapped));
          await refreshTransactionSideEffects(mapped);
        } else {
          const mapped = mapTransaction(payload.new);
          setTransactions((prev) => prev.map((t) => (t.id === mapped.id ? mapped : t)));
          await refreshTransactionSideEffects(mapped);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'debts' }, (payload) => {
        if (role !== 'admin') return;
        if (payload.eventType === 'DELETE') {
          const deletedDebtId = (payload.old as { id: string }).id;
          const cascadeState = {
            debtId: deletedDebtId,
            debts: debtsRef.current,
            debtPayments: debtPaymentsRef.current,
            transactions: transactionsRef.current
          };
          setDebts((prev) => removeDebtCascade({ ...cascadeState, debts: prev }).debts);
          setDebtPayments((prev) => (
            removeDebtCascade({ ...cascadeState, debtPayments: prev }).debtPayments
          ));
          setTransactions((prev) => (
            removeDebtCascade({ ...cascadeState, transactions: prev }).transactions
          ));
        } else if (payload.eventType === 'INSERT') {
          const mapped = mapDebt(payload.new);
          setDebts((prev) => (prev.some((d) => d.id === mapped.id) ? prev : [...prev, mapped]));
        } else {
          const mapped = mapDebt(payload.new);
          setDebts((prev) => prev.map((d) => (d.id === mapped.id ? mapped : d)));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'debt_payments' }, async (payload) => {
        if (role !== 'admin') return;
        if (payload.eventType === 'DELETE') {
          const deletedPayment = payload.old as { id: string; debt_id?: string | null };
          const linkedPayment = debtPaymentsRef.current.find((payment) => payment.id === deletedPayment.id);
          const debtId = linkedPayment?.debtId || deletedPayment.debt_id;
          setDebtPayments((prev) => prev.filter((p) => p.id !== deletedPayment.id));
          setTransactions((prev) => prev.filter((transaction) => transaction.debtPaymentId !== deletedPayment.id));
          if (debtId) {
            await refreshDebtById(debtId);
          }
        } else if (payload.eventType === 'INSERT') {
          const mapped = mapDebtPayment(payload.new);
          setDebtPayments((prev) => (prev.some((p) => p.id === mapped.id) ? prev : [...prev, mapped]));
          await Promise.all([
            refreshDebtById(mapped.debtId),
            refreshTransactionByColumn('debt_payment_id', mapped.id)
          ]);
        } else {
          const mapped = mapDebtPayment(payload.new);
          setDebtPayments((prev) => prev.map((p) => (p.id === mapped.id ? mapped : p)));
          await Promise.all([
            refreshDebtById(mapped.debtId),
            refreshTransactionByColumn('debt_payment_id', mapped.id)
          ]);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_items' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as { id: string }).id;
          setStock((prev) => removeById(prev, deletedId));
          pendingMutationsRef.current.delete(`stock_items:${deletedId}`);
          return;
        }
        const mapped = mapStockItem(payload.new);
        if (hasPendingMutation('stock_items', mapped.id, ['remove'])) return;
        if (payload.eventType === 'INSERT') {
          setStock((prev) => (prev.some((s) => s.id === mapped.id) ? prev : [...prev, mapped]));
        } else {
          setStock((prev) => prev.map((s) => (s.id === mapped.id ? { ...mapped, costs: s.costs, reservation: s.reservation } : s)));
        }
        pendingMutationsRef.current.delete(`stock_items:${mapped.id}`);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_reservations' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const deleted = payload.old as { stock_item_id?: string };
          if (deleted.stock_item_id) {
            setStock((prev) => prev.map((item) => (
              item.id === deleted.stock_item_id ? { ...item, reservation: null } : item
            )));
          }
          return;
        }

        const mapped = mapStockReservation(payload.new);
        setStock((prev) => prev.map((item) => {
          if (item.id !== mapped.stockItemId) return item;
          return {
            ...item,
            reservation: mapped.status === 'active' ? mapped : null
          };
        }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setCustomers((prev) => removeById(prev, (payload.old as { id: string }).id));
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
          setSellers((prev) => removeById(prev, (payload.old as { id: string }).id));
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
          setStores((prev) => removeById(prev, (payload.old as { id: string }).id));
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
          setPartsInventory((prev) => removeById(prev, (payload.old as { id: string }).id));
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
          setDeviceCatalog((prev) => removeById(prev, (payload.old as { id: string }).id));
        } else {
          const mapped = mapDeviceCatalogItem(payload.new);
          if (payload.eventType === 'INSERT') {
            setDeviceCatalog((prev) => (prev.some((d) => d.id === mapped.id) ? prev : [mapped, ...prev]));
          } else {
            setDeviceCatalog((prev) => prev.map((d) => (d.id === mapped.id ? mapped : d)));
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cost_history' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setCostHistory((prev) => removeById(prev, (payload.old as { id: string }).id));
        } else {
          const mapped = mapCostHistory(payload.new);
          if (payload.eventType === 'INSERT') {
            setCostHistory((prev) => (prev.some((item) => item.id === mapped.id) ? prev : [...prev, mapped]));
          } else {
            setCostHistory((prev) => prev.map((item) => (item.id === mapped.id ? mapped : item)));
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_categories' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setFinancialCategories((prev) => removeById(prev, (payload.old as { id: string }).id));
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
          setCreditors((prev) => removeById(prev, (payload.old as { id: string }).id));
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payable_debts' }, async (payload) => {
        if (role !== 'admin') return;
        if (payload.eventType === 'DELETE') {
          const deletedDebtId = (payload.old as { id: string }).id;
          const cascadeState = {
            payableDebtId: deletedDebtId,
            payableDebts: payableDebtsRef.current,
            payableDebtPayments: payableDebtPaymentsRef.current,
            transactions: transactionsRef.current
          };
          setPayableDebts((prev) => (
            removePayableDebtCascade({ ...cascadeState, payableDebts: prev }).payableDebts
          ));
          setPayableDebtPayments((prev) => (
            removePayableDebtCascade({
              ...cascadeState,
              payableDebtPayments: prev
            }).payableDebtPayments
          ));
          setTransactions((prev) => (
            removePayableDebtCascade({ ...cascadeState, transactions: prev }).transactions
          ));
        } else {
          const mapped = mapPayableDebt(payload.new);
          if (payload.eventType === 'INSERT') {
            setPayableDebts((prev) => (prev.some((d) => d.id === mapped.id) ? prev : [mapped, ...prev]));
            await refreshTransactionByColumn('payable_debt_id', mapped.id);
          } else {
            setPayableDebts((prev) => prev.map((d) => (d.id === mapped.id ? mapped : d)));
            await refreshTransactionByColumn('payable_debt_id', mapped.id);
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payable_debt_payments' }, async (payload) => {
        if (role !== 'admin') return;
        if (payload.eventType === 'DELETE') {
          const deletedPayment = payload.old as { id: string; payable_debt_id?: string | null };
          const linkedPayment = payableDebtPaymentsRef.current.find((payment) => payment.id === deletedPayment.id);
          const debtId = linkedPayment?.payableDebtId || deletedPayment.payable_debt_id;
          setPayableDebtPayments((prev) => prev.filter((p) => p.id !== deletedPayment.id));
          setTransactions((prev) => prev.filter((transaction) => transaction.payableDebtPaymentId !== deletedPayment.id));
          if (debtId) {
            await refreshPayableDebtById(debtId);
          }
        } else {
          const mapped = mapPayableDebtPayment(payload.new);
          if (payload.eventType === 'INSERT') {
            setPayableDebtPayments((prev) => (prev.some((p) => p.id === mapped.id) ? prev : [...prev, mapped]));
          } else {
            setPayableDebtPayments((prev) => prev.map((p) => (p.id === mapped.id ? mapped : p)));
          }
          await Promise.all([
            refreshPayableDebtById(mapped.payableDebtId),
            refreshTransactionByColumn('payable_debt_payment_id', mapped.id)
          ]);
        }
      }), [role]);

  useDataRealtime(isAuthenticated, registerDataRealtime, scheduleResync);

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

  const mapProfile = (p: any, aiSettings?: any): BusinessProfile => ({
    storeId: aiSettings?.store_id,
    name: p.name,
    cnpj: p.cnpj,
    phone: p.phone,
    email: p.email,
    address: p.address,
    instagram: p.instagram,
    logoUrl: p.logo_url,
    primaryColor: p.primary_color,
    businessHours: normalizeBusinessHours(aiSettings?.business_hours),
    specialBusinessHours: normalizeSpecialBusinessHours(aiSettings?.special_business_hours),
  });

  const mapSimulatorTradeInValue = (value: any): SimulatorTradeInValue => ({
    id: value.id,
    model: value.model || '',
    capacity: value.capacity || '',
    baseValue: toNumber(value.base_value),
    isActive: value.is_active !== false,
    createdAt: value.created_at,
    updatedAt: value.updated_at
  });

  const mapSimulatorTradeInAdjustment = (adjustment: any): SimulatorTradeInAdjustment => ({
    id: adjustment.id,
    label: adjustment.label || '',
    model: adjustment.model || null,
    capacity: adjustment.capacity || null,
    amountDelta: toNumber(adjustment.amount_delta),
    isActive: adjustment.is_active !== false,
    createdAt: adjustment.created_at,
    updatedAt: adjustment.updated_at
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

  const mapStockReservation = (reservation: any): StockReservation => ({
    id: reservation.id,
    stockItemId: reservation.stock_item_id,
    customerName: reservation.customer_name,
    customerPhone: reservation.customer_phone,
    reservedAt: reservation.reserved_at,
    expiresAt: reservation.expires_at || null,
    depositAmount: reservation.deposit_amount === null || reservation.deposit_amount === undefined ? null : toNumber(reservation.deposit_amount),
    depositPaymentMethod: reservation.deposit_payment_method || null,
    depositTransactionId: reservation.deposit_transaction_id || null,
    depositRefundTransactionId: reservation.deposit_refund_transaction_id || null,
    depositRefundedAt: reservation.deposit_refunded_at || null,
    depositRetainedAt: reservation.deposit_retained_at || null,
    soldSaleId: reservation.sold_sale_id || null,
    notes: reservation.notes || null,
    status: reservation.status,
    releasedAt: reservation.released_at || null,
    soldAt: reservation.sold_at || null,
    createdAt: reservation.created_at,
    updatedAt: reservation.updated_at
  });

  const normalizeReservationInput = (input: StockReservationInput) => {
    const customerName = input.customerName.trim();
    const customerPhone = input.customerPhone.trim();
    const depositAmount =
      input.depositAmount === null || input.depositAmount === undefined || Number(input.depositAmount) === 0
        ? null
        : Number(input.depositAmount);
    const depositPaymentMethod = depositAmount !== null && depositAmount > 0
      ? (input.depositPaymentMethod || '').trim()
      : null;

    if (!customerName) throw new Error('Informe o cliente da reserva.');
    if (!customerPhone) throw new Error('Informe o telefone da reserva.');
    if (depositAmount !== null && (!Number.isFinite(depositAmount) || depositAmount < 0)) {
      throw new Error('Valor do sinal inválido.');
    }
    if (depositAmount !== null && depositAmount > 0 && !depositPaymentMethod) {
      throw new Error('Informe a forma do sinal.');
    }

    return {
      customerName,
      customerPhone,
      expiresAt: input.expiresAt || null,
      depositAmount,
      depositPaymentMethod,
      notes: input.notes?.trim() || null,
    };
  };

  const mapReservationToDbPayload = (input: ReturnType<typeof normalizeReservationInput>) => ({
    customer_name: input.customerName,
    customer_phone: input.customerPhone,
    expires_at: input.expiresAt,
    deposit_amount: input.depositAmount,
    deposit_payment_method: input.depositPaymentMethod,
    notes: input.notes
  });

  const mapStockItem = (i: any, reservation?: StockReservation | null): StockItem => {
    const observations = i.observations ?? i.notes ?? '';
    const simType =
      i.sim_type === 'Physical' || i.sim_type === 'Virtual' || i.sim_type === 'Both' || i.sim_type === 'None'
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
      costs: i.costs?.map((c: any) => ({ id: c.id, description: c.description, amount: toNumber(c.amount), date: c.date })) || [],
      reservation: reservation || null
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
      source: pm.source || undefined,
      reservationId: pm.reservation_id || undefined,
      reservationDepositTransactionId: pm.reservation_deposit_transaction_id || undefined,
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
      saleNumber: toOptionalNumber(s.sale_number) ?? undefined,
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
      commission: toOptionalNumber(s.commission) ?? undefined,
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

  mapSaleRef.current = mapSale;

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
    payableDebtId: t.payable_debt_id ?? null,
    transferGroupId: t.transfer_group_id ?? null
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

  const refreshDebtById = async (debtId: string) => {
    const { data } = await supabase
      .from('debts')
      .select('*')
      .eq('id', debtId)
      .maybeSingle();

    if (!data) return;

    const mappedDebt = mapDebt(data);
    setDebts((prev) => (
      prev.some((debt) => debt.id === mappedDebt.id)
        ? prev.map((debt) => (debt.id === mappedDebt.id ? mappedDebt : debt))
        : [mappedDebt, ...prev]
    ));
  };

  const refreshPayableDebtById = async (debtId: string) => {
    const { data } = await supabase
      .from('payable_debts')
      .select('*')
      .eq('id', debtId)
      .maybeSingle();

    if (!data) return;

    const mappedDebt = mapPayableDebt(data);
    setPayableDebts((prev) => (
      prev.some((debt) => debt.id === mappedDebt.id)
        ? prev.map((debt) => (debt.id === mappedDebt.id ? mappedDebt : debt))
        : [mappedDebt, ...prev]
    ));
  };

  const refreshDebtPaymentById = async (paymentId: string) => {
    const { data } = await supabase
      .from('debt_payments')
      .select('*')
      .eq('id', paymentId)
      .maybeSingle();

    if (!data) return;

    const mappedPayment = mapDebtPayment(data);
    setDebtPayments((prev) => (
      prev.some((payment) => payment.id === mappedPayment.id)
        ? prev.map((payment) => (payment.id === mappedPayment.id ? mappedPayment : payment))
        : [mappedPayment, ...prev]
    ));
    await refreshDebtById(mappedPayment.debtId);
  };

  const refreshPayableDebtPaymentById = async (paymentId: string) => {
    const { data } = await supabase
      .from('payable_debt_payments')
      .select('*')
      .eq('id', paymentId)
      .maybeSingle();

    if (!data) return;

    const mappedPayment = mapPayableDebtPayment(data);
    setPayableDebtPayments((prev) => (
      prev.some((payment) => payment.id === mappedPayment.id)
        ? prev.map((payment) => (payment.id === mappedPayment.id ? mappedPayment : payment))
        : [mappedPayment, ...prev]
    ));
    await refreshPayableDebtById(mappedPayment.payableDebtId);
  };

  const refreshTransactionSideEffects = async (transaction: Transaction) => {
    await Promise.all([
      transaction.debtPaymentId ? refreshDebtPaymentById(transaction.debtPaymentId) : Promise.resolve(),
      transaction.payableDebtPaymentId ? refreshPayableDebtPaymentById(transaction.payableDebtPaymentId) : Promise.resolve(),
      transaction.payableDebtId ? refreshPayableDebtById(transaction.payableDebtId) : Promise.resolve()
    ]);
  };

  const refreshTransactionByColumn = async (column: string, value: string) => {
    if (role !== 'admin') return;

    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq(column, value)
      .maybeSingle();

    if (!data) return;

    const mappedTransaction = mapTransaction(data);
    setTransactions((prev) => (
      prev.some((transaction) => transaction.id === mappedTransaction.id)
        ? prev.map((transaction) => (transaction.id === mappedTransaction.id ? mappedTransaction : transaction))
        : [mappedTransaction, ...prev]
    ));
  };

  const refreshSaleSideEffects = async (saleId: string) => {
    if (role !== 'admin') return;

    const [transactionsResult, debtsResult, payableDebtsResult] = await Promise.all([
      supabase.from('transactions').select('*').eq('sale_id', saleId).order('date', { ascending: false }),
      supabase.from('debts').select('*').eq('sale_id', saleId).order('created_at', { ascending: false }),
      supabase.from('payable_debts').select('*').eq('sale_id', saleId).order('created_at', { ascending: false })
    ]);

    if (!transactionsResult.error && transactionsResult.data) {
      const mappedTransactions = transactionsResult.data.map(mapTransaction);
      setTransactions((prev) => mergeSaleLinkedRows(prev, saleId, mappedTransactions));
    }

    if (!debtsResult.error && debtsResult.data) {
      const mappedDebts = debtsResult.data.map(mapDebt);
      setDebts((prev) => mergeSaleLinkedRows(prev, saleId, mappedDebts));
    }

    if (!payableDebtsResult.error && payableDebtsResult.data) {
      const mappedPayableDebts = payableDebtsResult.data.map(mapPayableDebt);
      setPayableDebts((prev) => mergeSaleLinkedRows(prev, saleId, mappedPayableDebts));
    }
  };

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

    const storeId = profile.storeId
      || stores[0]?.id
      || String((await supabase.rpc('resolve_crm_default_store_id')).data || '').trim();

    if (storeId) {
      const { error: aiSettingsError } = await supabase
        .from('crm_ai_entry_settings')
        .upsert({
          store_id: storeId,
          business_hours: normalizeBusinessHours(profile.businessHours),
          special_business_hours: normalizeSpecialBusinessHours(profile.specialBusinessHours),
          updated_at: new Date().toISOString(),
        });

      if (aiSettingsError) {
        console.error('Error updating business hours:', aiSettingsError);
        throw aiSettingsError;
      }
    }

    setBusinessProfile({
      ...profile,
      storeId,
      businessHours: normalizeBusinessHours(profile.businessHours),
      specialBusinessHours: normalizeSpecialBusinessHours(profile.specialBusinessHours),
    });
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

  const upsertSimulatorTradeInValue = async (
    value: Partial<SimulatorTradeInValue> & Pick<SimulatorTradeInValue, 'model' | 'capacity' | 'baseValue'>
  ): Promise<void> => {
    const payload = {
      ...(value.id ? { id: value.id } : {}),
      model: value.model,
      capacity: value.capacity,
      base_value: value.baseValue,
      is_active: value.isActive ?? true
    };
    const { data, error } = await supabase
      .from('simulator_trade_in_values')
      .upsert(payload)
      .select('*')
      .single();
    if (error) throw error;
    const mapped = mapSimulatorTradeInValue(data || payload);
    setSimulatorTradeInValues((prev) => (
      prev.some((item) => item.id === mapped.id)
        ? prev.map((item) => (item.id === mapped.id ? mapped : item))
        : [...prev, mapped]
    ));
  };

  const updateSimulatorTradeInValue = async (
    id: string,
    updates: Partial<Omit<SimulatorTradeInValue, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> => {
    const payload: Record<string, unknown> = {};
    if (updates.model !== undefined) payload.model = updates.model;
    if (updates.capacity !== undefined) payload.capacity = updates.capacity;
    if (updates.baseValue !== undefined) payload.base_value = updates.baseValue;
    if (updates.isActive !== undefined) payload.is_active = updates.isActive;
    const { error } = await supabase.from('simulator_trade_in_values').update(payload).eq('id', id);
    if (error) throw error;
    setSimulatorTradeInValues((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const removeSimulatorTradeInValue = async (id: string): Promise<void> => {
    const { error } = await supabase.from('simulator_trade_in_values').delete().eq('id', id);
    if (error) throw error;
    setSimulatorTradeInValues((prev) => prev.filter((item) => item.id !== id));
  };

  const upsertSimulatorTradeInAdjustment = async (
    adjustment: Partial<SimulatorTradeInAdjustment> & Pick<SimulatorTradeInAdjustment, 'label' | 'amountDelta'>
  ): Promise<void> => {
    const payload = {
      ...(adjustment.id ? { id: adjustment.id } : {}),
      label: adjustment.label,
      model: adjustment.model || null,
      capacity: adjustment.capacity || null,
      amount_delta: adjustment.amountDelta,
      is_active: adjustment.isActive ?? true
    };
    const { data, error } = await supabase
      .from('simulator_trade_in_adjustments')
      .upsert(payload)
      .select('*')
      .single();
    if (error) throw error;
    const mapped = mapSimulatorTradeInAdjustment(data || payload);
    setSimulatorTradeInAdjustments((prev) => (
      prev.some((item) => item.id === mapped.id)
        ? prev.map((item) => (item.id === mapped.id ? mapped : item))
        : [...prev, mapped]
    ));
  };

  const updateSimulatorTradeInAdjustment = async (
    id: string,
    updates: Partial<Omit<SimulatorTradeInAdjustment, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> => {
    const payload: Record<string, unknown> = {};
    if (updates.label !== undefined) payload.label = updates.label;
    if (updates.model !== undefined) payload.model = updates.model || null;
    if (updates.capacity !== undefined) payload.capacity = updates.capacity || null;
    if (updates.amountDelta !== undefined) payload.amount_delta = updates.amountDelta;
    if (updates.isActive !== undefined) payload.is_active = updates.isActive;
    const { error } = await supabase.from('simulator_trade_in_adjustments').update(payload).eq('id', id);
    if (error) throw error;
    setSimulatorTradeInAdjustments((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const removeSimulatorTradeInAdjustment = async (id: string): Promise<void> => {
    const { error } = await supabase.from('simulator_trade_in_adjustments').delete().eq('id', id);
    if (error) throw error;
    setSimulatorTradeInAdjustments((prev) => prev.filter((item) => item.id !== id));
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
        sim_type: item.simType ?? null,
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
           setStock(prev =>
             prev.some((s) => s.id === newItem.id)
               ? prev.map((s) => (s.id === newItem.id ? mapStockItem(newItem) : s))
               : [...prev, mapStockItem(newItem)]
           );
           logDataEvent('inventory_item_created', 'Inventory', { itemId: data.id });
         }
     }
  };

  const updateStockItem = async (id: string, updates: Partial<StockItem>) => {
    const previousPhotos = stock.find(item => item.id === id)?.photos ?? [];
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

    // Limpa do storage as fotos que deixaram de ser referenciadas por este item.
    // Seguro: fotos só são referenciadas por stock_items.photos.
    if (updates.photos !== undefined) {
      const nextPhotos = updates.photos ?? [];
      const removedPhotos = previousPhotos.filter(url => !nextPhotos.includes(url));
      if (removedPhotos.length > 0) {
        void removeImages(removedPhotos, 'device-images');
      }
    }

    logDataEvent('inventory_item_updated', 'Inventory', {
      itemId: id,
      hasStatusChange: updates.status !== undefined,
    });
  };

  // As RPCs de reserva criam/atualizam/removem transações financeiras
  // (Adiantamento/Estorno de reserva) no servidor. O realtime de transactions
  // cobre o caso comum, mas pode estar dormindo (PWA em segundo plano,
  // reconexão); esta hidratação direta garante que o Financeiro reflita o
  // sinal imediatamente após a mutação.
  const refreshReservationDepositTransactions = async (
    ids: Array<string | null | undefined>
  ): Promise<void> => {
    if (role !== 'admin') return;
    const uniqueIds = Array.from(new Set(ids.filter((id): id is string => !!id)));
    if (uniqueIds.length === 0) return;

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .in('id', uniqueIds);
    if (error) return;

    const rows = data ?? [];
    const foundIds = new Set(rows.map((row: any) => row.id));
    setTransactions((prev) => upsertManyById(
      prev.filter((transaction) => !uniqueIds.includes(transaction.id) || foundIds.has(transaction.id)),
      rows.map(mapTransaction)
    ));
  };

  const reserveStockItem = async (stockItemId: string, input: StockReservationInput): Promise<void> => {
    const stockItem = stock.find((item) => item.id === stockItemId);
    if (!stockItem) throw new Error('Aparelho não encontrado no estoque.');
    if (stockItem.status !== StockStatus.AVAILABLE && stockItem.status !== StockStatus.RESERVED) {
      throw new Error(`Aparelho está em ${stockItem.status} e não pode ser reservado.`);
    }

    const normalized = normalizeReservationInput(input);
    const { data: savedReservation, error } = await supabase.rpc('reserve_stock_item', {
      p_stock_item_id: stockItemId,
      p_payload: normalized
    });

    if (error) throw error;

    const mappedReservation = mapStockReservation(savedReservation);
    recordPendingMutation('stock_items', stockItemId, 'update');
    setStock((prev) => prev.map((item) => (
      item.id === stockItemId
        ? { ...item, status: StockStatus.RESERVED, reservation: mappedReservation }
        : item
    )));
    await refreshReservationDepositTransactions([
      stockItem.reservation?.depositTransactionId,
      mappedReservation.depositTransactionId
    ]);
    logDataEvent('inventory_item_reserved', 'Inventory', { itemId: stockItemId });
  };

  const updateStockReservation = async (reservationId: string, input: StockReservationInput): Promise<void> => {
    const normalized = normalizeReservationInput(input);
    const { data, error } = await supabase
      .from('stock_reservations')
      .update(mapReservationToDbPayload(normalized))
      .eq('id', reservationId)
      .eq('status', 'active')
      .select('*')
      .single();

    if (error) throw error;

    const mappedReservation = mapStockReservation(data);
    setStock((prev) => prev.map((item) => (
      item.id === mappedReservation.stockItemId
        ? { ...item, reservation: mappedReservation }
        : item
    )));
    logDataEvent('inventory_reservation_updated', 'Inventory', { itemId: mappedReservation.stockItemId });
  };

  const releaseStockReservation = async (
    stockItemId: string,
    options: { refundDeposit?: boolean } = {}
  ): Promise<void> => {
    const stockItem = stock.find((item) => item.id === stockItemId);
    if (!stockItem) throw new Error('Aparelho não encontrado no estoque.');

    const { data: releasedReservation, error } = await supabase.rpc('release_stock_reservation', {
      p_stock_item_id: stockItemId,
      p_refund_deposit: options.refundDeposit === true
    });

    if (error) throw error;

    recordPendingMutation('stock_items', stockItemId, 'update');
    setStock((prev) => prev.map((item) => (
      item.id === stockItemId
        ? { ...item, status: StockStatus.AVAILABLE, reservation: null }
        : item
    )));
    await refreshReservationDepositTransactions([
      stockItem.reservation?.depositTransactionId,
      (releasedReservation as any)?.deposit_transaction_id,
      (releasedReservation as any)?.deposit_refund_transaction_id
    ]);
    logDataEvent('inventory_reservation_released', 'Inventory', {
      itemId: stockItemId,
      refundDeposit: options.refundDeposit === true
    });
  };

  const removeStockItem = async (id: string) => {
    const photosToCleanup = stock.find(item => item.id === id)?.photos ?? [];
    const { error } = await supabase.from('stock_items').delete().eq('id', id);
    if (error) {
      console.error('Error removing stock item:', error);
      throw error;
    }

    recordPendingMutation('stock_items', id, 'remove');
    setStock(prev => prev.filter(item => item.id !== id));

    // Remove as fotos do item do storage (best-effort). Seguro: nenhuma outra
    // tabela referencia objetos de device-images.
    if (photosToCleanup.length > 0) {
      void removeImages(photosToCleanup, 'device-images');
    }

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

  const findOrCreateCustomer = async (input: Partial<Customer> & { name: string }): Promise<Customer> => {
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
      const customer = await findOrCreateCustomer({ ...debt.customer, name: debt.customer.name.trim() });
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
      const { data: refreshedTransactions } = await fetchAllTransactions(supabase);
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
          account: normalizeFinancialAccount(transaction.account),
          transfer_group_id: transaction.transferGroupId ?? null
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

  // Transferência atômica entre Conta Bancária e Cofre via RPC: as duas pernas
  // (OUT na origem, IN no destino) nascem na mesma transação de banco. Substitui
  // os dois inserts sequenciais do cliente, que podiam deixar meia transferência
  // (dinheiro saindo da origem sem chegar ao destino) em caso de falha.
  const transferBetweenAccounts = async (from: FinancialAccount, to: FinancialAccount, amount: number) => {
      const { data, error } = await supabase.rpc('transfer_between_accounts', {
        p_from: from,
        p_to: to,
        p_amount: amount
      });

      if (error) {
        console.error('Error transferring between accounts:', error);
        throw new Error(error.message || 'Não foi possível realizar a transferência.');
      }

      if (!Array.isArray(data)) {
        throw new Error('Resposta inválida ao transferir entre contas.');
      }

      const mapped = data.map(mapTransaction);
      setTransactions((prev) => upsertManyById(prev, mapped));
      logDataEvent('finance_transfer_created', 'Finance', { from, to, amount });
  };

  // Lançamentos gerados por RPCs/triggers (vendas, dívidas, reservas) não podem
  // ser editados no Financeiro: o valor/conta deles é derivado do documento de
  // origem e a edição descolaria o extrato da venda/dívida/reserva.
  const assertTransactionEditable = (transaction: Transaction | undefined, updates?: Omit<Transaction, 'id'>) => {
    if (!transaction) return;
    if (transaction.payableDebtId) {
      throw new Error('Este lançamento é uma entrada de dívida ativa. Para revertê-lo, exclua a dívida correspondente na página Dívidas Ativas.');
    }
    if (transaction.debtPaymentId) {
      throw new Error('Este lançamento é um pagamento de dívida. Para corrigi-lo, cancele o lançamento (estorna o pagamento) e registre um novo pagamento.');
    }
    if (transaction.payableDebtPaymentId) {
      throw new Error('Este lançamento é um pagamento de dívida ativa. Para corrigi-lo, cancele o lançamento e registre um novo pagamento.');
    }
    if (transaction.saleId) {
      throw new Error('Este lançamento foi gerado por uma venda. Para corrigi-lo, edite ou cancele a venda correspondente no Histórico do PDV.');
    }
    if (transaction.category === 'Adiantamento de reserva' || transaction.category === 'Estorno de reserva') {
      throw new Error('Este lançamento pertence ao sinal de uma reserva. Gerencie o sinal pela reserva do aparelho no Estoque.');
    }
    if (updates && transaction.transferGroupId && (updates.account !== transaction.account || updates.type !== transaction.type)) {
      throw new Error('Transferências não podem mudar de conta ou tipo. Cancele a transferência e registre outra.');
    }
  };

  const updateTransaction = async (id: string, updates: Omit<Transaction, 'id'>) => {
      assertTransactionEditable(transactions.find(t => t.id === id), updates);

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

        // Lançamentos de transferência compartilham transfer_group_id e devem
        // manter valor e data idênticos nos dois lados. Ao editar um, propaga
        // valor/data para o par (tipo, categoria, conta e descrição permanecem
        // por serem opostos entre origem e destino).
        let pairedUpdates: Transaction[] = [];
        if (mapped.transferGroupId) {
          const { data: pairedData, error: pairedError } = await supabase
            .from('transactions')
            .update({ amount: updates.amount, date: updates.date })
            .eq('transfer_group_id', mapped.transferGroupId)
            .neq('id', id)
            .select();

          if (pairedError) {
            console.error('Error syncing paired transfer transaction:', pairedError);
            throw new Error(pairedError.message || 'Não foi possível sincronizar a transferência pareada.');
          }

          pairedUpdates = (pairedData || []).map(mapTransaction);
        }

        setTransactions((prev) => prev.map((item) => {
          if (item.id === id) return mapped;
          const pair = pairedUpdates.find((p) => p.id === item.id);
          return pair ?? item;
        }));
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

      // Espelha os bloqueios do RPC cancel_transaction para falhar com
      // mensagem amigável antes da ida ao banco: lançamentos gerados por
      // venda são revertidos pela venda; lançamentos de sinal, pela reserva.
      if (existingTrx?.saleId && !existingTrx.debtPaymentId && !existingTrx.payableDebtPaymentId) {
        throw new Error('Este lançamento foi gerado por uma venda. Para revertê-lo, cancele ou edite a venda correspondente no Histórico do PDV.');
      }
      if (existingTrx && (existingTrx.category === 'Adiantamento de reserva' || existingTrx.category === 'Estorno de reserva')) {
        throw new Error('Este lançamento pertence ao sinal de uma reserva. Gerencie o sinal pela reserva do aparelho no Estoque.');
      }

      const linkedPaymentId = existingTrx?.debtPaymentId ?? null;
      const linkedPayment = linkedPaymentId
        ? debtPayments.find(dp => dp.id === linkedPaymentId) ?? null
        : null;
      const linkedPayablePaymentId = existingTrx?.payableDebtPaymentId ?? null;
      const linkedPayablePayment = linkedPayablePaymentId
        ? payableDebtPayments.find(payment => payment.id === linkedPayablePaymentId) ?? null
        : null;

      // Lançamentos de transferência são pareados por transfer_group_id. O RPC
      // estorna ambos os lados; aqui removemos todos do grupo do estado local.
      const transferGroupId = existingTrx?.transferGroupId ?? null;
      const idsToRemove = new Set<string>([id]);
      if (transferGroupId) {
        transactions.forEach(t => {
          if (t.transferGroupId === transferGroupId) idsToRemove.add(t.id);
        });
      }

      // Usa RPC SECURITY DEFINER para garantir deleção mesmo com RLS e evitar
      // cascade recursivo entre o trigger e o FK payable_debt_payment_id.
      const { error } = await supabase.rpc('cancel_transaction', { p_transaction_id: id });
      if (error) {
        console.error('Error removing transaction:', error);
        throw new Error(error.message || 'Não foi possível cancelar o lançamento.');
      }

      setTransactions(prev => prev.filter(t => !idsToRemove.has(t.id)));

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
  
  const buildSaleFullPayload = (sale: Sale) => {
    const normalizedTradeInsFromSale = (sale.tradeIns || [])
      .map((tradeIn) => ({
        id: tradeIn.id || newId('sti'),
        stockItemId: tradeIn.stockItemId || null,
        model: tradeIn.model || 'Trade-in',
        capacity: tradeIn.capacity || null,
        color: tradeIn.color || null,
        imei: tradeIn.imei || null,
        condition: tradeIn.condition || null,
        receivedValue: toNumber(tradeIn.receivedValue),
        stockSnapshot: tradeIn.stockSnapshot ? {
          id: tradeIn.stockSnapshot.id,
          type: tradeIn.stockSnapshot.type,
          model: tradeIn.stockSnapshot.model,
          color: tradeIn.stockSnapshot.color,
          hasBox: tradeIn.stockSnapshot.hasBox,
          capacity: tradeIn.stockSnapshot.capacity,
          imei: tradeIn.stockSnapshot.imei,
          condition: tradeIn.stockSnapshot.condition,
          status: tradeIn.stockSnapshot.status,
          simType: tradeIn.stockSnapshot.simType,
          batteryHealth: tradeIn.stockSnapshot.batteryHealth,
          storeId: tradeIn.stockSnapshot.storeId,
          purchasePrice: tradeIn.stockSnapshot.purchasePrice,
          sellPrice: tradeIn.stockSnapshot.sellPrice,
          maxDiscount: tradeIn.stockSnapshot.maxDiscount,
          warrantyType: tradeIn.stockSnapshot.warrantyType,
          warrantyEnd: tradeIn.stockSnapshot.warrantyEnd,
          origin: tradeIn.stockSnapshot.origin,
          notes: tradeIn.stockSnapshot.notes,
          observations: tradeIn.stockSnapshot.observations,
          entryDate: tradeIn.stockSnapshot.entryDate,
          photos: tradeIn.stockSnapshot.photos || []
        } : null
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
              stockSnapshot: null
            }]
          : [];

    return {
      id: sale.id || newId('sale'),
      customerId: sale.customerId,
      sellerId: sale.sellerId,
      storeId: sale.storeId || sale.items[0]?.storeId || null,
      date: sale.date,
      total: toNumber(sale.total),
      discount: toNumber(sale.discount),
      discountType: sale.discountType || null,
      discountPercent: sale.discountPercent ?? null,
      originalSubtotal: toNumber(
        sale.originalSubtotal,
        sale.items.reduce((acc, item) => acc + toNumber(item.originalSellPrice ?? item.sellPrice), 0)
      ),
      negotiatedSubtotal: toNumber(
        sale.negotiatedSubtotal,
        sale.items.reduce((acc, item) => acc + toNumber(item.sellPrice), 0)
      ),
      commission: toNumber(sale.commission),
      warrantyExpiresAt: sale.warrantyExpiresAt,
      items: sale.items.map((item) => ({
        stockItemId: item.id,
        price: toNumber(item.sellPrice),
        originalPrice: toNumber(item.originalSellPrice ?? item.sellPrice),
        warrantyExpiresAt: item.warrantyExpiresAt || item.warrantyEnd || null
      })),
      paymentMethods: sale.paymentMethods.map((payment) => ({
        type: payment.type,
        amount: toNumber(payment.amount),
        account: payment.account ? normalizeFinancialAccount(payment.account) : null,
        source: payment.source || null,
        reservationId: payment.reservationId || null,
        reservationDepositTransactionId: payment.reservationDepositTransactionId || null,
        installments: payment.installments ?? null,
        cardBrand: payment.cardBrand || null,
        customerAmount: payment.customerAmount ?? null,
        feeRate: payment.feeRate ?? null,
        feeAmount: payment.feeAmount ?? null,
        debtDueDate: payment.debtDueDate || null,
        debtInstallments: payment.debtInstallments ?? null,
        debtNotes: payment.debtNotes || null
      })),
      tradeIns: normalizedTradeIns,
      clientPayment: {
        amount: sale.clientPaymentAmount ?? 0,
        mode: sale.clientPaymentMode ?? null,
        account: sale.clientPaymentAccount ?? null,
        method: sale.clientPaymentMethod ?? null,
        notes: sale.clientPaymentNotes ?? null,
        dueDate: sale.clientPaymentDueDate ?? null
      }
    };
  };

  const addSale = async (sale: Sale) => {
    const payload = buildSaleFullPayload(sale);
    const { data, error } = await supabase.rpc('create_sale_full', { p_payload: payload });
    if (error) throw error;
    if (!data) throw new Error('Falha ao registrar venda.');

    const saleId = payload.id;
    const localSale = mapSaleRef.current(data);

    recordPendingSaleMutation(saleId, 'add', localSale);
    invalidatePendingFetches();
    setSales((prev) => (prev.some((existingSale) => existingSale.id === saleId)
      ? prev.map((existingSale) => (existingSale.id === saleId ? localSale : existingSale))
      : [...prev, localSale]));

    const soldItemsById = new Map(localSale.items.map((item) => [item.id, item]));
    const tradeInSnapshots: StockItem[] = payload.tradeIns.flatMap((tradeIn) => (
      tradeIn.stockSnapshot ? [tradeIn.stockSnapshot as StockItem] : []
    ));

    setStock((prev) => [
      ...prev.map((item) => soldItemsById.get(item.id) || item),
      ...tradeInSnapshots.filter((snapshot) => !prev.some((item) => item.id === snapshot.id))
    ]);

    const grossTotal = toNumber(localSale.total) + toNumber(localSale.tradeInValue);
    setCustomers((prev) => prev.map((customer) => (
      customer.id === localSale.customerId
        ? {
            ...customer,
            purchases: (customer.purchases || 0) + 1,
            totalSpent: (customer.totalSpent || 0) + grossTotal
          }
        : customer
    )));
    setSellers((prev) => prev.map((seller) => (
      seller.id === localSale.sellerId
        ? {
            ...seller,
            totalSales: (seller.totalSales || 0) + grossTotal
          }
        : seller
    )));

    await refreshSaleSideEffects(saleId);

    if (isAuthenticated) {
      void fetchData({ silent: true, force: true, reason: 'sale-created-follow-up' });
    }

    // Fire-and-forget ERP "sale completed" push (US-014). Never block or fail
    // the sale on a notification error; the edge function relays to push-send.
    try {
      void supabase.functions
        .invoke('sales-notify', {
          body: {
            sale_id: saleId,
            total: grossTotal,
            customer_name: customers.find((c) => c.id === localSale.customerId)?.name,
            seller_name: sellers.find((s) => s.id === localSale.sellerId)?.name,
          },
        })
        .catch((err) => console.warn('[addSale] sales-notify failed', err));
    } catch (err) {
      console.warn('[addSale] sales-notify dispatch failed', err);
    }

    logDataEvent('sale_created', 'PDV', { saleId, total: localSale.total });
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

    const preliminaryTradeInValue = (mergedSale.tradeIns || [])
      .reduce((acc, tradeIn) => acc + toNumber(tradeIn.receivedValue), 0);
    const preliminaryTotal = toNumber(
      mergedSale.total,
      Math.max(0, toNumber(mergedSale.negotiatedSubtotal) - toNumber(mergedSale.discount) - preliminaryTradeInValue)
    );
    const normalizedPaymentMethods = (mergedSale.paymentMethods || [])
      .filter((paymentMethod) => toNumber(paymentMethod.amount) > 0);

    if (preliminaryTotal > 0 && normalizedPaymentMethods.length === 0) {
      throw new Error('A venda precisa ter ao menos uma forma de pagamento.');
    }

    const normalizedPaymentsTotal = normalizedPaymentMethods.reduce(
      (acc, paymentMethod) => acc + toNumber(paymentMethod.amount),
      0
    );
    if (Math.abs(normalizedPaymentsTotal - preliminaryTotal) > 0.01) {
      throw new Error('A soma dos pagamentos deve ser igual ao total da venda.');
    }

    const saleForPayload: Sale = {
      ...mergedSale,
      total: preliminaryTotal,
      tradeInValue: preliminaryTradeInValue,
      paymentMethods: normalizedPaymentMethods
    };
    const payload = buildSaleFullPayload(saleForPayload);
    const { data, error } = await supabase.rpc('update_sale_full', {
      p_sale_id: saleId,
      p_payload: payload
    });
    if (error) throw error;
    if (!data) throw new Error('Falha ao atualizar venda.');

    const mappedSale = mapSaleRef.current(data);
    recordPendingSaleMutation(saleId, 'add', mappedSale);
    invalidatePendingFetches();
    setSales((prev) => prev.map((sale) => (sale.id === saleId ? mappedSale : sale)));

    const soldItemsById = new Map(mappedSale.items.map((item) => [item.id, item]));
    const nextSoldIds = new Set(mappedSale.items.map((item) => item.id));
    const previousSoldIds = new Set(currentSale.items.map((item) => item.id));
    setStock((prev) => prev.map((item) => {
      const soldItem = soldItemsById.get(item.id);
      if (soldItem) return soldItem;
      if (previousSoldIds.has(item.id) && !nextSoldIds.has(item.id)) {
        return { ...item, status: StockStatus.AVAILABLE };
      }
      return item;
    }));

    const oldGrossTotal = toNumber(currentSale.total) + toNumber(currentSale.tradeInValue);
    const newGrossTotal = toNumber(mappedSale.total) + toNumber(mappedSale.tradeInValue);
    setCustomers((prev) => prev.map((customer) => {
      if (customer.id === currentSale.customerId && currentSale.customerId !== mappedSale.customerId) {
        return {
          ...customer,
          purchases: Math.max(0, (customer.purchases || 0) - 1),
          totalSpent: Math.max(0, (customer.totalSpent || 0) - oldGrossTotal)
        };
      }
      if (customer.id === mappedSale.customerId) {
        return {
          ...customer,
          purchases: currentSale.customerId === mappedSale.customerId ? customer.purchases : (customer.purchases || 0) + 1,
          totalSpent: Math.max(0, (customer.totalSpent || 0) + (currentSale.customerId === mappedSale.customerId ? newGrossTotal - oldGrossTotal : newGrossTotal))
        };
      }
      return customer;
    }));
    setSellers((prev) => prev.map((seller) => {
      if (seller.id === currentSale.sellerId && currentSale.sellerId !== mappedSale.sellerId) {
        return { ...seller, totalSales: Math.max(0, (seller.totalSales || 0) - oldGrossTotal) };
      }
      if (seller.id === mappedSale.sellerId) {
        return {
          ...seller,
          totalSales: Math.max(0, (seller.totalSales || 0) + (currentSale.sellerId === mappedSale.sellerId ? newGrossTotal - oldGrossTotal : newGrossTotal))
        };
      }
      return seller;
    }));

    await refreshSaleSideEffects(saleId);

    if (isAuthenticated) {
      void fetchData({ silent: true, force: true, reason: 'sale-updated-follow-up' });
    }

    logDataEvent('sale_updated', 'PDVHistory', { saleId, total: newGrossTotal });
  };

  const removeSale = async (saleId: string): Promise<void> => {
    const saleBefore = sales.find((s) => s.id === saleId);

    const { error } = await supabase.rpc('cancel_sale', { p_sale_id: saleId });
    if (error) {
      console.error('Error removing sale:', error);
      throw new Error(error.message || 'Não foi possível cancelar a venda.');
    }

    recordPendingSaleMutation(saleId, 'remove');
    invalidatePendingFetches();
    setSales((prev) => prev.filter((sale) => sale.id !== saleId));
    setTransactions((prev) => prev.filter((transaction) => transaction.saleId !== saleId));
    setDebts((prev) => prev.filter((debt) => debt.saleId !== saleId));
    setPayableDebts((prev) => prev.filter((debt) => debt.saleId !== saleId));
    if (saleBefore) {
      const releasedStockIds = new Set(saleBefore.items.map((item) => item.id));
      setStock((prev) => prev.map((item) => (
        releasedStockIds.has(item.id)
          ? { ...item, status: StockStatus.AVAILABLE }
          : item
      )));
    }

    if (isAuthenticated) {
      void fetchData({ silent: true, force: true, reason: 'sale-removed-follow-up' });
    }

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
      const { data: refreshedTransactions } = await fetchAllTransactions(supabase);
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
    // O trigger trg_payable_debts_after_update sincroniza o lançamento de
    // entrada quando o valor muda; recarrega as transações para refletir na UI.
    if (role === 'admin' && payload.original_amount !== undefined) {
      const { data: refreshedTransactions } = await fetchAllTransactions(supabase);
      if (refreshedTransactions) setTransactions(refreshedTransactions.map(mapTransaction));
    }
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
    invalidatePendingFetches();
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
      const { data: refreshedTransactions } = await fetchAllTransactions(supabase);
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

  const getPayableDebtPayments = useCallback((payableDebtId: string) =>
    payableDebtPayments
      .filter((p) => p.payableDebtId === payableDebtId)
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()),
  [payableDebtPayments]);

  const addFinancialCategory = useCallback(async (category: Omit<FinancialCategory, 'id' | 'createdAt'>) => {
    const id = newId('fcat');
    const { data, error } = await supabase.from('finance_categories').insert({
      id,
      name: category.name,
      type: category.type,
      is_default: category.isDefault
    }).select().single();
    if (error) throw error;
    if (data) setFinancialCategories(prev => [...prev, mapFinancialCategory(data)]);
  }, []);

  const updateFinancialCategory = useCallback(async (id: string, updates: Partial<FinancialCategory>) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.isDefault !== undefined) dbUpdates.is_default = updates.isDefault;
    const { error } = await supabase.from('finance_categories').update(dbUpdates).eq('id', id);
    if (error) throw error;
    setFinancialCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const removeFinancialCategory = useCallback(async (id: string) => {
    const { error } = await supabase.from('finance_categories').delete().eq('id', id);
    if (error) throw error;
    setFinancialCategories(prev => prev.filter(c => c.id !== id));
  }, []);

  // Memoize the context value so consumers only re-render when the relevant
  // slice of state they depend on actually changed — not on every provider render.
  const contextValue = useMemo(() => ({
    businessProfile, cardFeeSettings, simulatorTradeInValues, simulatorTradeInAdjustments, stock, customers, sellers, debts, debtPayments, stores, deviceCatalog, transactions, sales, costHistory, partsInventory, loading,
    salesHistoryLoading, financeLoading,
    creditors, payableDebts, payableDebtPayments,
    refreshData: fetchData,
    ensureSalesHistoryLoaded, ensureFinanceLoaded,
    updateBusinessProfile, updateCardFeeSettings,
    upsertSimulatorTradeInValue, updateSimulatorTradeInValue, removeSimulatorTradeInValue,
    upsertSimulatorTradeInAdjustment, updateSimulatorTradeInAdjustment, removeSimulatorTradeInAdjustment,
    addStockItem, updateStockItem, removeStockItem, reserveStockItem, updateStockReservation, releaseStockReservation,
    addCustomer, updateCustomer, removeCustomer, findOrCreateCustomer,
    addSeller, updateSeller, removeSeller,
    addStore, updateStore, removeStore,
    addDeviceCatalogItem,
    addSale, updateSale, removeSale, addDebt, updateDebt, removeDebt, payDebt, getDebtPayments, removeDebtPayment, addTransaction, updateTransaction, removeTransaction, transferBetweenAccounts,
    addCostHistory, getCostHistoryByModel, addCostToItem, addPart, updatePart, removePart, addPartCostToItem,
    financialCategories,
    addCreditor, updateCreditor, removeCreditor,
    addPayableDebt, updatePayableDebt, removePayableDebt, addPayableDebtPayment, revertPayableDebtPayment, getPayableDebtPayments,
    addFinancialCategory, updateFinancialCategory, removeFinancialCategory,
  }), [
    businessProfile, cardFeeSettings, simulatorTradeInValues, simulatorTradeInAdjustments, stock, customers, sellers, debts, debtPayments, stores, deviceCatalog,
    transactions, sales, costHistory, partsInventory, loading, salesHistoryLoading, financeLoading,
    creditors, payableDebts, payableDebtPayments, financialCategories,
    ensureSalesHistoryLoaded, ensureFinanceLoaded,
    getDebtPayments, getPayableDebtPayments,
    addFinancialCategory, updateFinancialCategory, removeFinancialCategory,
  ]);

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within a DataProvider");
  return context;
};
