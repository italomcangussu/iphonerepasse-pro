import React, { createContext, useContext, useState, useEffect } from 'react';
import { StockItem, Customer, Seller, Transaction, Sale, StockStatus, DeviceType, Condition, WarrantyType, StoreLocation, BusinessProfile } from '../types';

interface DataContextType {
  businessProfile: BusinessProfile;
  stock: StockItem[];
  customers: Customer[];
  sellers: Seller[];
  stores: StoreLocation[];
  transactions: Transaction[];
  sales: Sale[];
  
  // Actions
  updateBusinessProfile: (profile: BusinessProfile) => void;
  addStockItem: (item: StockItem) => void;
  updateStockItem: (id: string, updates: Partial<StockItem>) => void;
  
  addCustomer: (customer: Customer) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  
  addSeller: (seller: Seller) => void;
  updateSeller: (id: string, updates: Partial<Seller>) => void;
  
  addStore: (store: StoreLocation) => void;
  updateStore: (id: string, updates: Partial<StoreLocation>) => void;
  
  addSale: (sale: Sale) => void;
  addTransaction: (transaction: Transaction) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  
  // Business Profile
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>({
    name: 'iPhoneRepasse',
    cnpj: '',
    phone: '',
    email: '',
    address: '',
    instagram: '',
    // logoUrl can be empty initially
  });

  // Data Initialization - Clean State for First Use
  const [stock, setStock] = useState<StockItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [stores, setStores] = useState<StoreLocation[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  // Actions Implementations
  const updateBusinessProfile = (profile: BusinessProfile) => setBusinessProfile(profile);

  const addStockItem = (item: StockItem) => setStock(prev => [...prev, item]);
  const updateStockItem = (id: string, updates: Partial<StockItem>) => {
    setStock(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const addCustomer = (customer: Customer) => setCustomers(prev => [...prev, customer]);
  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const addSeller = (seller: Seller) => setSellers(prev => [...prev, seller]);
  const updateSeller = (id: string, updates: Partial<Seller>) => {
    setSellers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const addStore = (store: StoreLocation) => setStores(prev => [...prev, store]);
  const updateStore = (id: string, updates: Partial<StoreLocation>) => {
    setStores(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };
  
  const addTransaction = (transaction: Transaction) => setTransactions(prev => [...prev, transaction]);

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
      businessProfile, stock, customers, sellers, stores, transactions, sales,
      updateBusinessProfile,
      addStockItem, updateStockItem, 
      addCustomer, updateCustomer,
      addSeller, updateSeller,
      addStore, updateStore,
      addSale, addTransaction
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