import React from 'react';
import { DeviceType, Condition, StockStatus, WarrantyType } from '../../types';
import { DEFAULT_CARD_FEE_SETTINGS } from '../../utils/cardFees';

const stores = [
  { id: 'store-1', name: 'iPhoneRepasse Sobral', city: 'Sobral' },
  { id: 'store-2', name: 'iPhoneRepasse Fortaleza', city: 'Fortaleza' },
];

const sellers = [
  { id: 'seller-1', name: 'Maria Vendedora', email: 'maria@x.com', authUserId: 'a1', storeId: 'store-1', totalSales: 12 },
  { id: 'seller-2', name: 'João Vendedor', email: 'joao@x.com', authUserId: 'a2', storeId: 'store-1', totalSales: 7 },
];

const customers = [
  { id: 'cust-1', name: 'CARLOS EDUARDO DE ALMEIDA SOUZA', cpf: '123.456.789-00', phone: '(88) 99999-0000', email: 'carlos@x.com', purchases: 3, totalSpent: 9000 },
  { id: 'cust-2', name: 'ANA PAULA', cpf: '987.654.321-00', phone: '(88) 98888-0000', email: 'ana@x.com', purchases: 1, totalSpent: 3000 },
];

const baseItem = {
  hasBox: true,
  maxDiscount: 0,
  warrantyType: WarrantyType.STORE,
  origin: 'Cliente',
  costs: [],
  photos: [],
  entryDate: new Date().toISOString(),
  simType: 'Physical' as const,
};

const stock = [
  {
    ...baseItem,
    id: 'stk-1', type: DeviceType.IPHONE, model: 'iPhone 13 Pro', color: 'Grafite',
    capacity: '256 GB', imei: '356789012345678', condition: Condition.USED,
    status: StockStatus.AVAILABLE, batteryHealth: 91, storeId: 'store-1',
    purchasePrice: 3200, sellPrice: 4500, originalSellPrice: 4500,
  },
  {
    ...baseItem,
    id: 'stk-2', type: DeviceType.IPHONE, model: 'iPhone 15', color: 'Azul',
    capacity: '128 GB', imei: '356789012345999', condition: Condition.NEW,
    status: StockStatus.AVAILABLE, storeId: 'store-1',
    purchasePrice: 5200, sellPrice: 6200, originalSellPrice: 6200,
  },
  {
    ...baseItem,
    id: 'stk-3', type: DeviceType.IPHONE, model: 'iPhone 12', color: 'Branco',
    capacity: '64 GB', imei: '356789012340000', condition: Condition.USED,
    status: StockStatus.AVAILABLE, batteryHealth: 84, storeId: 'store-1',
    purchasePrice: 2200, sellPrice: 3100, originalSellPrice: 3100,
  },
];

const businessProfile = {
  storeId: 'store-1',
  name: 'iPhoneRepasse',
  cnpj: '12.345.678/0001-90',
  address: 'Av. Principal, 1000 - Centro, Sobral - CE',
  phone: '(88) 3000-0000',
  logoUrl: '',
};

const noop = async () => {};

// Catch-all so any field/function PDV-tree reads resolves to a sane default.
const target: Record<string, unknown> = {
  stock, customers, sellers, stores, businessProfile,
  cardFeeSettings: DEFAULT_CARD_FEE_SETTINGS,
  simulatorTradeInValues: [], simulatorTradeInAdjustments: [],
  debts: [], debtPayments: [], deviceCatalog: [], partsInventory: [],
  transactions: [], sales: [], costHistory: [], financialCategories: [],
  creditors: [], payableDebts: [], payableDebtPayments: [],
  loading: false,
  addSale: noop, removeStockItem: noop, addCustomer: noop, refreshData: noop,
  addStockItem: noop, updateStockItem: noop,
  addCostHistory: noop, addCostToItem: noop, addPartCostToItem: noop,
  addDeviceCatalogItem: async () => ({ id: 'd1', type: DeviceType.IPHONE, model: 'x', color: '' }),
  getDebtPayments: () => [], getCostHistoryByModel: () => [], getPayableDebtPayments: () => [],
};

const mockData = new Proxy(target, {
  get(obj, prop: string) {
    if (prop in obj) return obj[prop];
    // default any unknown action to an async no-op
    return async () => {};
  },
});

export const useData = () => mockData as any;
export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;
export default { useData, DataProvider };
