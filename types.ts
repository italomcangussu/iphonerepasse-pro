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
  RESERVED = 'Reservado',
  IN_USE = 'Em Uso'
}

export enum WarrantyType {
  APPLE = 'Apple',
  STORE = 'Loja'
}

export interface BusinessProfile {
  storeId?: string;
  name: string;
  cnpj: string;
  phone: string;
  email: string;
  address: string;
  instagram: string;
  logoUrl?: string; // URL da imagem ou Base64
  primaryColor?: string; // Para customização futura
  businessHours?: BusinessHours;
  specialBusinessHours?: SpecialBusinessHours;
}

export type BusinessDayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type BusinessHours = Record<BusinessDayKey, {
  open: string;
  close: string;
}>;

export type SpecialBusinessHours = Record<string, {
  closed?: boolean;
  label?: string;
  open?: string;
  close?: string;
}>;

export interface Customer {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email: string;
  birthDate?: string;
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
  imei: string; // IMEI ou Serial (campo unico de identificacao)
  condition: Condition;
  status: StockStatus;
  batteryHealth?: number; // 0-100
  storeId: string;
  purchasePrice: number;
  sellPrice: number;
  originalSellPrice?: number;
  maxDiscount: number;
  warrantyType: WarrantyType;
  warrantyEnd?: string; // Date string
  warrantyExpiresAt?: string | null; // Snapshot used in sale receipts/history.
  origin?: string;
  notes?: string;
  observations?: string;
  costs: CostItem[];
  photos: string[];
  entryDate: string;
  simType?: 'Physical' | 'Virtual' | 'Both' | 'None';
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
  tradeIns?: SaleTradeInItem[]; // 1..N aparelhos de entrada (snapshot do momento da venda)
  tradeInValue: number;
  discount: number;
  discountType?: 'amount' | 'percent' | null;
  discountPercent?: number | null;
  originalSubtotal?: number;
  negotiatedSubtotal?: number;
  total: number;
  paymentMethods: PaymentMethod[];
  date: string;
  warrantyExpiresAt: string | null;
  storeId?: string;
  commission?: number; // Comissão do vendedor — gera despesa na Conta Bancária ao salvar a venda
  notes?: string;
  observations?: string;
  // Trade-in superior: loja paga diferença ao cliente
  clientPaymentAmount?: number | null;
  clientPaymentMode?: 'immediate' | 'payable_debt' | null;
  clientPaymentAccount?: string | null;
  clientPaymentMethod?: string | null;
  clientPaymentNotes?: string | null;
  clientPaymentDueDate?: string | null;
}

export interface SaleTradeInItem {
  id: string;
  saleId?: string;
  stockItemId?: string;
  model: string;
  capacity?: string;
  color?: string;
  imei?: string;
  condition?: string;
  receivedValue: number;
  stockSnapshot?: StockItem;
}

export type FinancialAccount = 'Conta Bancária' | 'Cofre' | 'Devedores';

export interface PaymentMethod {
  type: 'Pix' | 'Dinheiro' | 'Cartão' | 'Cartão Débito' | 'Devedor';
  amount: number;
  account?: FinancialAccount;
  installments?: number;
  cardBrand?: 'visa_master' | 'outras';
  customerAmount?: number;
  feeRate?: number;
  feeAmount?: number;
  debtDueDate?: string;
  debtInstallments?: number;
  debtNotes?: string;
}

export interface CardFeeSettings {
  visaMasterRates: number[];
  otherRates: number[];
  debitRate: number;
}

export interface SimulatorTradeInValue {
  id: string;
  model: string;
  capacity: string;
  baseValue: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SimulatorTradeInAdjustment {
  id: string;
  label: string;
  model?: string | null;
  capacity?: string | null;
  amountDelta: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  firstDueDate?: string;
  installmentsTotal?: number;
  notes?: string;
  source: DebtSource;
  createdAt: string;
  updatedAt: string;
  customBadge?: string;
}

export interface DebtPayment {
  id: string;
  debtId: string;
  amount: number;
  paymentMethod: 'Pix' | 'Dinheiro' | 'Cartão' | 'Cartão Débito';
  account: FinancialAccount;
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

export type AppRole = 'admin' | 'manager' | 'seller';

export interface UxEvent {
  name: string;
  screen: string;
  role?: AppRole;
  metadata?: Record<string, string | number | boolean>;
  ts: string;
}

export interface FinancialCategory {
  id: string;
  name: string;
  type: 'IN' | 'OUT';
  isDefault: boolean;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: 'IN' | 'OUT';
  category: string;
  amount: number;
  date: string;
  description: string;
  account: FinancialAccount;
  saleId?: string | null;
  debtPaymentId?: string | null;
  payableDebtPaymentId?: string | null;
  payableDebtId?: string | null;
  transferGroupId?: string | null;
}

export interface Creditor {
  id: string;
  name: string;
  document?: string;
  documentType?: 'CPF' | 'CNPJ';
  phone?: string;
  email?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type PayableDebtStatus = 'Aberta' | 'Parcial' | 'Quitada';
export type PayableDebtSource = 'manual' | 'import_anexo' | 'pdv';

export interface PayableDebt {
  id: string;
  creditorId: string;
  creditorName: string;
  creditorDocument?: string;
  creditorPhone?: string;
  originalAmount: number;
  remainingAmount: number;
  status: PayableDebtStatus;
  dueDate?: string;
  firstDueDate?: string;
  installmentsTotal?: number;
  notes?: string;
  source: PayableDebtSource;
  saleId?: string | null;
  entryAccount?: 'Conta Bancária' | 'Cofre';
  createdAt: string;
  updatedAt: string;
}

export interface PayableDebtPayment {
  id: string;
  payableDebtId: string;
  amount: number;
  paymentMethod: 'Pix' | 'Dinheiro' | 'Cartão' | 'Cartão Débito';
  account: 'Conta Bancária' | 'Cofre';
  paidAt: string;
  notes?: string;
  attachmentPath?: string;
  attachmentMime?: string;
  attachmentName?: string;
  attachmentSize?: number;
  createdAt: string;
}

export interface PublicWarrantyItem {
  model: string;
  capacity: string;
  color: string;
  condition: string;
  imeiMasked: string;
  warrantyExpiresAt?: string | null;
}

export interface PublicWarrantyView {
  certificateId: string;
  saleDate: string;
  warrantyExpiresAt: string;
  status: 'active' | 'expired';
  customerName: string;
  storeName: string;
  items: PublicWarrantyItem[];
}

export interface PublicWarrantyLookupView {
  mode: 'cpf';
  customerName: string;
  cpfMasked: string;
  warranties: PublicWarrantyView[];
}

export type CRMProvider = 'uazapi' | 'instagram_official';
export type CRMAIEntryMode = 'inherit' | 'force_ai' | 'force_human';

export interface CRMChannel {
  id: string;
  storeId: string;
  name: string;
  provider: CRMProvider;
  isActive: boolean;
  useForManual: boolean;
  useForAutomation: boolean;
  phoneNumber: string;
  apiEndpoint?: string;
  apiKey?: string;
  uazSubdomain?: string;
  uazInstanceToken?: string;
  uazAdminToken?: string;
  uazInstanceName?: string;
  uazWebhookId?: string | null;
  uazConnectionStatus?: 'unknown' | 'connecting' | 'connected' | 'disconnected' | 'error';
  uazLastStatus?: Record<string, unknown> | null;
  uazLastStatusAt?: string | null;
  webhookSecret?: string;
  aiResumeWebhookUrl?: string | null;
  aiEntryMode?: CRMAIEntryMode;
  inboundFunnelId?: string | null;
  inboundFunnelStage?: string | null;
  instagramVerifyToken?: string | null;
  instagramIgUserId?: string | null;
  instagramUsername?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CRMLead {
  id: string;
  storeId: string;
  sourceChannelId?: string | null;
  name?: string | null;
  phone: string;
  email?: string | null;
  funnelId?: string | null;
  funnelStage?: string | null;
  intent?: string | null;
  isCustomer: boolean;
  customerId?: string | null;
  purchaseCount: number;
  lastPurchaseAt?: string | null;
  lastOrderId?: string | null;
  lastOrderAt?: string | null;
  lastOrderValue?: number | null;
  lastOrderSummary?: string | null;
  lifetimeValue?: number | null;
  lastInteractionAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
