export enum DeviceType {
  IPHONE = 'iPhone',
  IPAD = 'iPad',
  MACBOOK = 'Macbook',
  WATCH = 'Apple Watch',
  ACCESSORY = 'Acessório'
}

export enum Condition {
  NEW = 'Novo',
  USED = 'Seminovo'
}

export enum StockStatus {
  AVAILABLE = 'Disponível',
  PREPARATION = 'Em Preparação',
  SOLD = 'Vendido',
  RESERVED = 'Reservado'
}

export enum WarrantyType {
  APPLE = 'Apple',
  STORE = 'Loja'
}

export interface BusinessProfile {
  name: string;
  cnpj: string;
  phone: string;
  email: string;
  address: string;
  instagram: string;
  logoUrl?: string; // URL da imagem ou Base64
  primaryColor?: string; // Para customização futura
}

export interface Customer {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email: string;
  birthDate: string;
  purchases: number;
  totalSpent: number;
}

export interface StoreLocation {
  id: string;
  name: string;
  city: string;
}

export interface DeviceCatalogItem {
  id: string;
  type: DeviceType;
  model: string;
  color?: string;
}

export interface StockItem {
  id: string;
  type: DeviceType;
  model: string;
  color: string;
  hasBox?: boolean;
  capacity: string;
  imei: string;
  condition: Condition;
  status: StockStatus;
  batteryHealth?: number; // 0-100
  storeId: string;
  purchasePrice: number;
  sellPrice: number;
  maxDiscount: number;
  warrantyType: WarrantyType;
  warrantyEnd?: string; // Date string
  origin?: string;
  notes?: string;
  observations?: string;
  costs: CostItem[];
  photos: string[];
  entryDate: string;
}

export interface CostItem {
  id: string;
  description: string;
  amount: number;
  date: string;
}

export interface PartStockItem {
  id: string;
  name: string;
  quantity: number;
  unitCost: number;
  createdAt: string;
  updatedAt: string;
}

export interface Sale {
  id: string;
  customerId: string;
  sellerId: string;
  items: StockItem[];
  tradeIn?: StockItem; // Aparelho de entrada
  tradeInValue: number;
  discount: number;
  total: number;
  paymentMethods: PaymentMethod[];
  date: string;
  warrantyExpiresAt: string;
}

export interface PaymentMethod {
  type: 'Pix' | 'Dinheiro' | 'Cartão' | 'Devedor';
  amount: number;
  installments?: number;
  debtDueDate?: string;
  debtNotes?: string;
}

export type DebtStatus = 'Aberta' | 'Parcial' | 'Quitada';
export type DebtSource = 'manual' | 'pdv' | 'import_anexo';

export interface Debt {
  id: string;
  customerId: string;
  saleId?: string;
  originalAmount: number;
  remainingAmount: number;
  status: DebtStatus;
  dueDate?: string;
  notes?: string;
  source: DebtSource;
  createdAt: string;
  updatedAt: string;
}

export interface DebtPayment {
  id: string;
  debtId: string;
  amount: number;
  paymentMethod: 'Pix' | 'Dinheiro' | 'Cartão';
  account: 'Caixa' | 'Cofre';
  paidAt: string;
  notes?: string;
  createdAt: string;
}

export interface Seller {
  id: string;
  name: string;
  email: string;
  authUserId: string;
  storeId: string;
  totalSales: number;
}

export type AppRole = 'admin' | 'seller';

export interface Transaction {
  id: string;
  type: 'IN' | 'OUT';
  category: 'Venda' | 'Compra' | 'Insumo' | 'Aporte' | 'Retirada' | 'Serviço';
  amount: number;
  date: string;
  description: string;
  account: 'Caixa' | 'Cofre';
}
