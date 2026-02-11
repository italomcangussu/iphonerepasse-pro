import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { StockItem, Customer, Seller, Transaction, Sale, StockStatus, DeviceType, Condition, WarrantyType, StoreLocation, BusinessProfile, CostItem, PaymentMethod } from '../types';
import { supabase } from './supabase';
import { newId } from '../utils/id';
import { useAuth } from '../contexts/AuthContext';

// Types for DB mapping if needed, or just map manually
interface DataContextType {
  businessProfile: BusinessProfile;
  stock: StockItem[];
  customers: Customer[];
  sellers: Seller[];
  stores: StoreLocation[];
  transactions: Transaction[];
  sales: Sale[];
  costHistory: CostHistoryItem[];
  loading: boolean;
  refreshData: () => Promise<void>;
  
  // Actions
  updateBusinessProfile: (profile: BusinessProfile) => Promise<void>;
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
  
  addSale: (sale: Sale) => Promise<void>;
  addTransaction: (transaction: Transaction) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  
  // Cost management
  addCostHistory: (model: string, description: string, amount: number) => Promise<void>;
  getCostHistoryByModel: (model: string) => CostHistoryItem[];
  addCostToItem: (itemId: string, cost: CostItem) => Promise<void>;
}

export interface CostHistoryItem {
  id: string;
  model: string;
  description: string;
  amount: number;
  count: number;
  lastUsed: string;
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

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading: authLoading, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(DEFAULT_BUSINESS_PROFILE);

  const [stock, setStock] = useState<StockItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [stores, setStores] = useState<StoreLocation[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [costHistory, setCostHistory] = useState<CostHistoryItem[]>([]);

  const resetState = useCallback(() => {
    setBusinessProfile(DEFAULT_BUSINESS_PROFILE);
    setStock([]);
    setCustomers([]);
    setSellers([]);
    setStores([]);
    setTransactions([]);
    setSales([]);
    setCostHistory([]);
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

        // Stores
        const { data: storesData } = await supabase.from('stores').select('*');
        if (storesData) setStores(storesData);

        // Customers
        const { data: customersData } = await supabase.from('customers').select('*');
        if (customersData) setCustomers(customersData.map(mapCustomer));

        // Sellers
        const { data: sellersData } = await supabase.from('sellers').select('*');
        if (sellersData) setSellers(mapSellers(sellersData));

        // Stock Items & Costs
        const { data: stockData } = await supabase.from('stock_items').select('*, costs(*)');
        if (stockData) setStock(stockData.map(mapStockItem));

        // Sales & Payment Methods & Sale Items (fetching complex structure)
        // For simplicity, fetching generic sales info. 
        // Note: Nested fetching in Supabase can be deep.
        const { data: salesData } = await supabase.from('sales').select('*, sale_items(*), payment_methods(*), customer:customers(*), seller:sellers(*)');
        // Mapping sales might be complex due to nested structures. We'll simplify for now.
        // If we strictly follow types, we need to map carefully.
        if (salesData) setSales(salesData.map(mapSale));

        if (role === 'admin') {
          const { data: trxData, error: trxError } = await supabase.from('transactions').select('*');
          if (trxError) console.error('Error fetching transactions:', trxError);
          if (trxData) setTransactions(trxData);
        } else {
          setTransactions([]);
        }

        // Cost History
        const { data: costHistoryData, error: costHistoryError } = await supabase.from('cost_history').select('*');
        if (costHistoryError) console.error('Error fetching cost history:', costHistoryError);
        if (costHistoryData) setCostHistory(costHistoryData.map(mapCostHistory));

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

  // --- Mappers ---
  const mapProfile = (p: any): BusinessProfile => ({
    name: p.name, cnpj: p.cnpj, phone: p.phone, email: p.email, address: p.address, instagram: p.instagram, logoUrl: p.logo_url, primaryColor: p.primary_color
  });

  const mapCustomer = (c: any): Customer => ({
    id: c.id,
    name: c.name,
    cpf: c.cpf,
    phone: c.phone,
    email: c.email,
    birthDate: c.birth_date,
    purchases: Number(c.purchases || 0),
    totalSpent: Number(c.total_spent || 0)
  });

  const mapSellers = (s: any[]): Seller[] => s.map(seller => ({
    id: seller.id,
    name: seller.name,
    email: seller.email || '',
    authUserId: seller.auth_user_id || '',
    totalSales: Number(seller.total_sales || 0)
  }));

  const mapStockItem = (i: any): StockItem => ({
     id: i.id, type: i.type, model: i.model, color: i.color, capacity: i.capacity, imei: i.imei, condition: i.condition, status: i.status, batteryHealth: i.battery_health, storeId: i.store_id, purchasePrice: i.purchase_price, sellPrice: i.sell_price, maxDiscount: i.max_discount, warrantyType: i.warranty_type, warrantyEnd: i.warranty_end, origin: i.origin, notes: i.notes, entryDate: i.entry_date, photos: i.photos || [],
     costs: i.costs?.map((c: any) => ({ id: c.id, description: c.description, amount: c.amount, date: c.date })) || []
  });

  const mapSale = (s: any): Sale => ({
      id: s.id, customerId: s.customer_id, sellerId: s.seller_id, total: s.total, discount: s.discount, date: s.date, warrantyExpiresAt: s.warranty_expires_at, tradeInValue: s.trade_in_value,
      // mapping items and methods might be tricky if not fetched. 
      // Assuming sale_items and payment_methods are fetched joined
      items: (s.sale_items || []).map((si: any) => ({ id: si.stock_item_id, model: 'Unknown' })), // Placeholder for model, ideally fetch complete item
      paymentMethods: s.payment_methods?.map((pm: any) => ({ type: pm.type, amount: pm.amount, installments: pm.installments })) || [],
      // tradeIn: ... if fetched
      tradeIn: undefined // Simplification
  });

  const mapCostHistory = (h: any): CostHistoryItem => ({
     id: h.id, model: h.model, description: h.description, amount: h.amount, count: h.count, lastUsed: h.last_used
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

  const addStockItem = async (item: StockItem) => {
     // Insert Stock Item
     const { data, error } = await supabase.from('stock_items').insert({
        id: item.id || newId('stk'),
        type: item.type, model: item.model, color: item.color, capacity: item.capacity, imei: item.imei, condition: item.condition, status: item.status, battery_health: item.batteryHealth, store_id: item.storeId, purchase_price: item.purchasePrice, sell_price: item.sellPrice, max_discount: item.maxDiscount, warranty_type: item.warrantyType, warranty_end: item.warrantyEnd, origin: item.origin, notes: item.notes, entry_date: item.entryDate, photos: item.photos
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
         if (newItem) setStock(prev => [...prev, mapStockItem(newItem)]);
     }
  };

  const updateStockItem = async (id: string, updates: Partial<StockItem>) => {
    // Map updates to snake_case
    const dbUpdates: any = {};
    if (updates.type) dbUpdates.type = updates.type;
    if (updates.model) dbUpdates.model = updates.model;
    if (updates.color) dbUpdates.color = updates.color;
    if (updates.capacity) dbUpdates.capacity = updates.capacity;
    if (updates.imei) dbUpdates.imei = updates.imei;
    if (updates.condition) dbUpdates.condition = updates.condition;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.batteryHealth !== undefined) dbUpdates.battery_health = updates.batteryHealth;
    if (updates.storeId) dbUpdates.store_id = updates.storeId;
    if (updates.purchasePrice !== undefined) dbUpdates.purchase_price = updates.purchasePrice;
    if (updates.sellPrice !== undefined) dbUpdates.sell_price = updates.sellPrice;
    if (updates.maxDiscount !== undefined) dbUpdates.max_discount = updates.maxDiscount;
    if (updates.warrantyType) dbUpdates.warranty_type = updates.warrantyType;
    if (updates.warrantyEnd) dbUpdates.warranty_end = updates.warrantyEnd;
    if (updates.origin) dbUpdates.origin = updates.origin;
    if (updates.notes) dbUpdates.notes = updates.notes;
    if (updates.photos) dbUpdates.photos = updates.photos;

    const { error } = await supabase.from('stock_items').update(dbUpdates).eq('id', id);
    if (error) {
        console.error('Error updating stock item:', error);
        throw error;
    }
    setStock(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const removeStockItem = async (id: string) => {
    const { error } = await supabase.from('stock_items').delete().eq('id', id);
    if (!error) setStock(prev => prev.filter(item => item.id !== id));
  };

  const addCustomer = async (customer: Customer) => {
    const { data, error } = await supabase.from('customers').insert({
        id: customer.id || newId('cust'),
        name: customer.name, cpf: customer.cpf, phone: customer.phone, email: customer.email, birth_date: customer.birthDate, purchases: customer.purchases, total_spent: customer.totalSpent
    }).select().single();
    if (!error && data) setCustomers(prev => [...prev, mapCustomer(data)]);
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.cpf) dbUpdates.cpf = updates.cpf;
    if (updates.phone) dbUpdates.phone = updates.phone;
    if (updates.email) dbUpdates.email = updates.email;
    if (updates.birthDate) dbUpdates.birth_date = updates.birthDate;
    if (updates.purchases !== undefined) dbUpdates.purchases = updates.purchases;
    if (updates.totalSpent !== undefined) dbUpdates.total_spent = updates.totalSpent;
    
    const { error } = await supabase.from('customers').update(dbUpdates).eq('id', id);
    if (!error) setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const removeCustomer = async (id: string) => {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if(!error) setCustomers(prev => prev.filter(c => c.id !== id));
  };

  const addSeller = async (seller: Seller) => {
      if (!seller.email || !seller.authUserId) {
          throw new Error('Seller precisa de email e authUserId.');
      }
      const { data, error } = await supabase.from('sellers').insert({
          id: seller.id || newId('sel'),
          name: seller.name,
          email: seller.email,
          auth_user_id: seller.authUserId,
          total_sales: seller.totalSales
      }).select().single();
      if(!error && data) setSellers(prev => [...prev, mapSellers([data])[0]]);
  };

  const updateSeller = async (id: string, updates: Partial<Seller>) => {
      const dbUpdates: any = {};
      if(updates.name) dbUpdates.name = updates.name;
      if(updates.email) dbUpdates.email = updates.email;
      if(updates.totalSales !== undefined) dbUpdates.total_sales = updates.totalSales;
      const { error } = await supabase.from('sellers').update(dbUpdates).eq('id', id);
      if(!error) setSellers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const removeSeller = async (id: string) => {
      const { error } = await supabase.from('sellers').delete().eq('id', id);
      if(!error) setSellers(prev => prev.filter(s => s.id !== id));
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

  const addTransaction = async (transaction: Transaction) => {
      const { data, error } = await supabase.from('transactions').insert({
          id: transaction.id || newId('trx'),
          type: transaction.type, category: transaction.category, amount: transaction.amount, date: transaction.date, description: transaction.description, account: transaction.account
      }).select().single();
      
      if (error) {
          console.error('Error adding transaction:', error);
          throw error;
      }
      
      if(data) setTransactions(prev => [...prev, data]);
  };

  const removeTransaction = async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if(!error) setTransactions(prev => prev.filter(t => t.id !== id));
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
      if(!error) {
          // Fetch updated stock item
          const { data: newItem } = await supabase.from('stock_items').select('*, costs(*)').eq('id', itemId).single();
          if (newItem) {
              setStock(prev => prev.map(item => item.id === itemId ? mapStockItem(newItem) : item));
              // Update local state is safer than mapStockItem logic duplications
              
               // Also add to history
                const item = stock.find(i => i.id === itemId);
                if (item) {
                    addCostHistory(item.model, cost.description, cost.amount);
                }
          }
      }
  };
  
  const addSale = async (sale: Sale) => {
      // 1. Create Sale
      const { data: saleData, error: saleError } = await supabase.from('sales').insert({
          id: sale.id || newId('sale'),
          customer_id: sale.customerId, seller_id: sale.sellerId, total: sale.total, discount: sale.discount, date: sale.date, warranty_expires_at: sale.warrantyExpiresAt, trade_in_value: sale.tradeInValue
      }).select().single();
      
      if(saleError || !saleData) return;

      const saleId = saleData.id;

      // 2. Create Sale Items
      const saleItemsFormatted = sale.items.map(i => ({
          id: newId('si'),
          sale_id: saleId, stock_item_id: i.id, price: i.sellPrice
      }));
      await supabase.from('sale_items').insert(saleItemsFormatted);

      // 3. Create Payment Methods
      const paymentMethodsFormatted = sale.paymentMethods.map(pm => ({
          id: newId('pm'),
          sale_id: saleId, type: pm.type, amount: pm.amount, installments: pm.installments
      }));
      await supabase.from('payment_methods').insert(paymentMethodsFormatted);

      // 4. Update Stock Items to SOLD
      for (const item of sale.items) {
          await updateStockItem(item.id, { status: StockStatus.SOLD });
      }

      // 5. Handle Trade In item registration (financial transaction now comes from DB trigger)
      if (sale.tradeIn) {
          await addStockItem(sale.tradeIn);
      }

       // Refresh Sales List
       const { data: refreshSales } = await supabase.from('sales').select('*, sale_items(*), payment_methods(*), customer:customers(*), seller:sellers(*)');
       if(refreshSales) setSales(refreshSales.map(mapSale));

       const { data: refreshedCustomers } = await supabase.from('customers').select('*');
       if (refreshedCustomers) setCustomers(refreshedCustomers.map(mapCustomer));

       const { data: refreshedSellers } = await supabase.from('sellers').select('*');
       if (refreshedSellers) setSellers(mapSellers(refreshedSellers));

       if (role === 'admin') {
           const { data: refreshedTransactions } = await supabase.from('transactions').select('*');
           if (refreshedTransactions) setTransactions(refreshedTransactions);
       }
  };


  return (
    <DataContext.Provider value={{
      businessProfile, stock, customers, sellers, stores, transactions, sales, costHistory, loading,
      refreshData: fetchData,
      updateBusinessProfile,
      addStockItem, updateStockItem, removeStockItem,
      addCustomer, updateCustomer, removeCustomer,
      addSeller, updateSeller, removeSeller,
      addStore, updateStore, removeStore,
      addSale, addTransaction, removeTransaction,
      addCostHistory, getCostHistoryByModel, addCostToItem,
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
