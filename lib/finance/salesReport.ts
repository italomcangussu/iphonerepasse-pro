import type { Sale } from '../../types';
import { toFiniteNumber } from '../../utils/number';

export type SalesReportRow = Sale & {
  items: NonNullable<Sale['items']>;
  // Faturamento = valor financeiro + aparelho recebido na troca.
  total: number;
  netFinancialTotal: number;
  tradeInValue: number;
  costOfGoods: number;
  commission: number;
  profit: number;
  cardSurcharge: number;
  customerChargedTotal: number;
};

const sum = <T,>(rows: T[], pick: (row: T) => unknown) => rows.reduce((acc, row) => acc + toFiniteNumber(pick(row)), 0);

// Custo dos aparelhos vendidos: preço de compra mais os reparos de cada um.
const costOfGoodsOf = (items: NonNullable<Sale['items']>) =>
  sum(items, (item) => toFiniteNumber(item.purchasePrice) + sum(Array.isArray(item.costs) ? item.costs : [], (cost) => cost.amount));

export const toSalesReportRow = (sale: Sale): SalesReportRow => {
  const items = Array.isArray(sale.items) ? sale.items : [];
  const payments = sale.paymentMethods || [];
  const netFinancialTotal = toFiniteNumber(sale.total);
  const tradeInValue = toFiniteNumber(sale.tradeInValue);
  const revenue = netFinancialTotal + tradeInValue;
  const costOfGoods = costOfGoodsOf(items);
  const commission = toFiniteNumber(sale.commission);

  return {
    ...sale,
    items,
    total: revenue,
    netFinancialTotal,
    tradeInValue,
    costOfGoods,
    commission,
    profit: revenue - costOfGoods - commission,
    cardSurcharge: sum(payments, (payment) => payment.feeAmount),
    customerChargedTotal: sum(payments, (payment) => payment.customerAmount ?? payment.amount) + tradeInValue
  };
};

// Vendas do período, já com custo, lucro e cobrado, da mais recente para a mais antiga.
export const buildSalesReport = (sales: Sale[], isInPeriod: (date: string) => boolean): SalesReportRow[] =>
  sales
    .filter((sale) => isInPeriod(sale.date))
    .map(toSalesReportRow)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

export const summarizeSalesReport = (rows: SalesReportRow[]) => ({
  count: rows.length,
  revenue: sum(rows, (row) => row.total),
  commission: sum(rows, (row) => row.commission),
  profit: sum(rows, (row) => row.profit),
  cardSurcharge: sum(rows, (row) => row.cardSurcharge),
  customerCharged: sum(rows, (row) => row.customerChargedTotal)
});
