import React, { createContext, useContext, useState, useEffect } from 'react';
import { StockItem, Customer, Seller, Transaction, Sale, StockStatus, DeviceType, Condition, WarrantyType, StoreLocation, BusinessProfile } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface DataContextType {
  businessProfile: BusinessProfile;
  stock: StockItem[];
  customers: Customer[];
  sellers: Seller[];
  stores: StoreLocation[];
  transactions: Transaction[];
  sales: Sale[];
  costHistory: CostHistoryItem[];
  
  // Actions
  updateBusinessProfile: (profile: BusinessProfile) => void;
  addStockItem: (item: StockItem) => void;
  updateStockItem: (id: string, updates: Partial<StockItem>) => void;
  removeStockItem: (id: string) => void;
  
  addCustomer: (customer: Customer) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  removeCustomer: (id: string) => void;
  
  addSeller: (seller: Seller) => void;
  updateSeller: (id: string, updates: Partial<Seller>) => void;
  removeSeller: (id: string) => void;
  
  addStore: (store: StoreLocation) => void;
  updateStore: (id: string, updates: Partial<StoreLocation>) => void;
  removeStore: (id: string) => void;
  
  addSale: (sale: Sale) => void;
  addTransaction: (transaction: Transaction) => void;
  removeTransaction: (id: string) => void;
  
  // Cost management
  addCostHistory: (model: string, description: string, amount: number) => void;
  getCostHistoryByModel: (model: string) => CostHistoryItem[];
  addCostToItem: (itemId: string, cost: CostItem) => void;
}

export interface CostItem {
  id: string;
  description: string;
  amount: number;
  date: string;
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

const STORAGE_KEYS = {
  businessProfile: 'iphonerepasse-business',
  stock: 'iphonerepasse-stock',
  customers: 'iphonerepasse-customers',
  sellers: 'iphonerepasse-sellers',
  stores: 'iphonerepasse-stores',
  transactions: 'iphonerepasse-transactions',
  sales: 'iphonerepasse-sales',
  costHistory: 'iphonerepasse-cost-history',
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Business Profile
  const [businessProfile, setBusinessProfile] = useLocalStorage<BusinessProfile>(STORAGE_KEYS.businessProfile, {
    name: 'iPhoneRepasse',
    cnpj: '',
    phone: '',
    email: '',
    address: '',
    instagram: '',
  });

  // Data with localStorage persistence
  const [stock, setStock] = useLocalStorage<StockItem[]>(STORAGE_KEYS.stock, []);
  const [customers, setCustomers] = useLocalStorage<Customer[]>(STORAGE_KEYS.customers, []);
  const [sellers, setSellers] = useLocalStorage<Seller[]>(STORAGE_KEYS.sellers, []);
  const [stores, setStores] = useLocalStorage<StoreLocation[]>(STORAGE_KEYS.stores, []);
  const [transactions, setTransactions] = useLocalStorage<Transaction[]>(STORAGE_KEYS.transactions, []);
  const [sales, setSales] = useLocalStorage<Sale[]>(STORAGE_KEYS.sales, []);
  const [costHistory, setCostHistory] = useLocalStorage<CostHistoryItem[]>(STORAGE_KEYS.costHistory, []);

  // Actions Implementations
  const updateBusinessProfile = (profile: BusinessProfile) => setBusinessProfile(profile);

  const addStockItem = (item: StockItem) => setStock(prev => [...prev, item]);
  
  const updateStockItem = (id: string, updates: Partial<StockItem>) => {
    setStock(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const removeStockItem = (id: string) => {
    setStock(prev => prev.filter(item => item.id !== id));
  };

  const addCustomer = (customer: Customer) => setCustomers(prev => [...prev, customer]);
  
  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const removeCustomer = (id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
  };

  const addSeller = (seller: Seller) => setSellers(prev => [...prev, seller]);
  
  const updateSeller = (id: string, updates: Partial<Seller>) => {
    setSellers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const removeSeller = (id: string) => {
    setSellers(prev => prev.filter(s => s.id !== id));
  };

  const addStore = (store: StoreLocation) => setStores(prev => [...prev, store]);
  
  const updateStore = (id: string, updates: Partial<StoreLocation>) => {
    setStores(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const removeStore = (id: string) => {
    setStores(prev => prev.filter(s => s.id !== id));
  };
  
  const addTransaction = (transaction: Transaction) => setTransactions(prev => [...prev, transaction]);

  const removeTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  // Cost History Management
  const addCostHistory = (model: string, description: string, amount: number) => {
    setCostHistory(prev => {
      const existingIndex = prev.findIndex(
        item => item.model === model && item.description === description
      );
      
      if (existingIndex >= 0) {
        // Update existing
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          amount,
          count: updated[existingIndex].count + 1,
          lastUsed: new Date().toISOString(),
        };
        return updated;
      } else {
        // Add new
        return [...prev, {
          id: `cost-${Date.now()}`,
          model,
          description,
          amount,
          count: 1,
          lastUsed: new Date().toISOString(),
        }];
      }
    });
  };

  const getCostHistoryByModel = (model: string) => {
    return costHistory.filter(item => item.model === model).sort((a, b) => b.count - a.count);
  };

  const addCostToItem = (itemId: string, cost: CostItem) => {
    setStock(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          costs: [...item.costs, cost]
        };
      }
      return item;
    }));
    
    // Also add to history
    const item = stock.find(i => i.id === itemId);
    if (item) {
      addCostHistory(item.model, cost.description, cost.amount);
    }
  };

  const addSale = (sale: Sale) => {
    setSales(prev => [...prev, sale]);
    
    // Update Stock status
    sale.items.forEach(item => {
      updateStockItem(item.id, { status: StockStatus.SOLD });
    });
    
    // Add revenue transaction
    addTransaction({
      id: `trx-${Date.now()}`,
      type: 'IN',
      category: 'Venda',
      amount: sale.total,
      date: sale.date,
      description: `Venda #${sale.id.slice(-4)} - ${sale.items[0].model}`,
      account: 'Caixa'
    });

    // Handle Trade-in
    if (sale.tradeIn) {
      addStockItem(sale.tradeIn);
      addTransaction({
        id: `trx-ti-${Date.now()}`,
        type: 'OUT',
        category: 'Compra',
        amount: sale.tradeInValue,
        date: sale.date,
        description: `Entrada (Troca) - ${sale.tradeIn.model}`,
        account: 'Caixa'
      });
    }

    // Update Customer stats
    const customer = customers.find(c => c.id === sale.customerId);
    if(customer) {
      updateCustomer(customer.id, {
        purchases: customer.purchases + 1,
        totalSpent: customer.totalSpent + sale.total
      });
    }

    // Update Seller stats
    const seller = sellers.find(s => s.id === sale.sellerId);
    if (seller) {
      updateSeller(seller.id, {
        totalSales: seller.totalSales + sale.total
      });
    }
  };

  return (
    <DataContext.Provider value={{
      businessProfile, stock, customers, sellers, stores, transactions, sales, costHistory,
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
