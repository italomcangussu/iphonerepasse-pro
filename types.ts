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

export interface StockItem {
  id: string;
  type: DeviceType;
  model: string;
  color: string;
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
  type: 'Pix' | 'Dinheiro' | 'Cartão Crédito' | 'Cartão Débito';
  amount: number;
  installments?: number;
}

export interface Seller {
  id: string;
  name: string;
  totalSales: number;
}

export interface Transaction {
  id: string;
  type: 'IN' | 'OUT';
  category: 'Venda' | 'Compra' | 'Insumo' | 'Aporte' | 'Retirada' | 'Serviço';
  amount: number;
  date: string;
  description: string;
  account: 'Caixa' | 'Cofre';
}