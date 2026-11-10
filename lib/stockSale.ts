import { formatCurrencyBRL, parseCurrencyBRL } from '../utils/inputMasks';
import type { SaleAccount, StockSale, TransferableItem } from '../services/tenants';

// Venda de aparelhos entre empresas. Os valores editados ficam como dígitos
// (centavos), o mesmo formato de maskCurrencyInput; o que não foi editado vale
// o custo do aparelho. Quem valida e lança no financeiro é o banco.

export type SaleMode = 'move' | 'sale';
export type EditedPrices = Record<string, string>;

export const SALE_ACCOUNTS: SaleAccount[] = ['Conta Bancária', 'Cofre'];

export const costDigits = (cost: number | string | null | undefined): string =>
  String(Math.max(Math.round(Number(cost ?? 0) * 100), 0));

export const salePriceDigits = (item: TransferableItem, edited: EditedPrices): string =>
  edited[item.id] ?? costDigits(item.cost);

export const salePriceMissing = (items: TransferableItem[], edited: EditedPrices): boolean =>
  items.some((item) => salePriceDigits(item, edited) === '');

export const saleTotal = (items: TransferableItem[], edited: EditedPrices): number =>
  items.reduce((sum, item) => sum + parseCurrencyBRL(salePriceDigits(item, edited)), 0);

export const buildStockSale = (account: SaleAccount, items: TransferableItem[], edited: EditedPrices): StockSale => ({
  account,
  prices: Object.fromEntries(items.map((item) => [item.id, parseCurrencyBRL(salePriceDigits(item, edited))])),
});

const devices = (count: number) => `${count} ${count === 1 ? 'aparelho' : 'aparelhos'}`;

export const saleButtonLabel = (count: number, targetTenantName: string, total: number): string =>
  `Vender ${devices(count)} por ${formatCurrencyBRL(total)} para ${targetTenantName}`;

export type SaleParties = { originName: string; targetName: string };

export const saleSummary = ({ originName, targetName }: SaleParties, account: SaleAccount, total: number): string =>
  `A ${originName} recebe ${formatCurrencyBRL(total)} em ${account} e a ${targetName} lança a compra na mesma conta. Os custos já lançados ficam na ${originName}.`;

export const saleToast = (count: number, targetName: string, total: number): string =>
  `${devices(count)} ${count === 1 ? 'vendido' : 'vendidos'} para ${targetName} por ${formatCurrencyBRL(total)}.`;
