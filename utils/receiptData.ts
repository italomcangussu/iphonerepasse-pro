/**
 * Modelo de dados único do comprovante de venda.
 *
 * Antes deste módulo, PDV e PDVHistory derivavam os totais do comprovante cada
 * um do seu jeito, e o mesmo pedido saía diferente conforme a tela de origem.
 * Aqui ficam as funções puras que traduzem uma `Sale` no que o recibo mostra —
 * consumidas pelo ESC/POS (térmica), pelo PDF e pelos templates em tela.
 */

import { BusinessProfile, Condition, PaymentMethod, Sale, SaleTradeInItem, StockItem } from '../types';
import { roundCurrency } from './pdvPricing';
import type { ThermalReceiptData } from './thermalPrinter';

export const getNegotiatedSubtotal = (sale: Sale): number =>
  sale.negotiatedSubtotal ?? sale.items.reduce((acc, item) => acc + Number(item.sellPrice || 0), 0);

export const getPaymentLabel = (payment: PaymentMethod): string => {
  if (payment.type === 'Cartão Débito') {
    return 'Cartão Débito';
  }
  if (payment.type !== 'Cartão') {
    return payment.installments ? `${payment.type} ${payment.installments}x` : payment.type;
  }
  const brandLabel = payment.cardBrand === 'outras' ? 'Outras' : 'Visa/Master';
  const installmentsLabel = payment.installments ? ` ${payment.installments}x` : '';
  return `Cartão ${brandLabel}${installmentsLabel}`;
};

export const getSaleTradeIns = (sale: Sale): SaleTradeInItem[] => {
  if (sale.tradeIns && sale.tradeIns.length > 0) return sale.tradeIns;
  if (!sale.tradeIn) return [];

  return [
    {
      id: `legacy-${sale.id}`,
      stockItemId: sale.tradeIn.id,
      model: sale.tradeIn.model,
      capacity: sale.tradeIn.capacity || undefined,
      color: sale.tradeIn.color || undefined,
      imei: sale.tradeIn.imei || undefined,
      condition: sale.tradeIn.condition || undefined,
      receivedValue: sale.tradeInValue
    }
  ];
};

export const getSaleTradeInSubtotal = (sale: Sale): number => {
  const tradeIns = getSaleTradeIns(sale);
  return roundCurrency(
    tradeIns.length > 0
      ? tradeIns.reduce((acc, item) => acc + Number(item.receivedValue || 0), 0)
      : Number(sale.tradeInValue || 0)
  );
};

export const getSaleHistoryTotal = (sale: Sale): number =>
  roundCurrency(Number(sale.total || 0) + getSaleTradeInSubtotal(sale));

export const getPaymentCustomerAmount = (payment: PaymentMethod): number =>
  roundCurrency(Number(payment.customerAmount ?? payment.amount ?? 0));

export const getSaleFinancialPaymentTotal = (sale: Sale): number =>
  roundCurrency(sale.paymentMethods.reduce((acc, payment) => acc + getPaymentCustomerAmount(payment), 0));

export const getSalePaidTotal = (sale: Sale): number =>
  roundCurrency(getSaleFinancialPaymentTotal(sale) + getSaleTradeInSubtotal(sale));

export const getItemWarrantyDate = (sale: Sale, item: StockItem): string | null => {
  if (item.condition !== Condition.USED) return null;
  return item.warrantyExpiresAt || item.warrantyEnd || sale.warrantyExpiresAt || null;
};

export const getItemWarrantyLabel = (sale: Sale, item: StockItem): string | null => {
  if (item.condition === Condition.NEW) return 'Garantia Apple: 1 ano';
  const warrantyDate = getItemWarrantyDate(sale, item);
  if (!warrantyDate) return null;
  return `Garantia loja: até ${new Date(warrantyDate).toLocaleDateString('pt-BR')}`;
};

export const getSaleCardFeeTotal = (sale: Sale): number =>
  roundCurrency(sale.paymentMethods.reduce((acc, payment) => acc + Number(payment.feeAmount || 0), 0));

export const getSaleDiscountLabel = (sale: Sale): string =>
  sale.discountType === 'percent' && (sale.discountPercent ?? null) !== null
    ? `Desconto (${Number(sale.discountPercent).toFixed(2)}%)`
    : 'Desconto';

export interface SaleReceiptContext {
  businessProfile?: BusinessProfile | null;
  customerName: string;
  customerCpf?: string | null;
  sellerName: string;
}

/**
 * Traduz uma venda no payload do comprovante. É a fonte única consumida pelo
 * ESC/POS, pelo PDF e pelo envio por WhatsApp — se o número muda aqui, muda em
 * todos os canais ao mesmo tempo.
 */
export function buildSaleReceiptData(sale: Sale, ctx: SaleReceiptContext): ThermalReceiptData {
  const tradeIns = getSaleTradeIns(sale);
  const hasWarrantyByItem = sale.items.some((item) => getItemWarrantyLabel(sale, item));

  return {
    saleId: sale.id,
    saleNumber: sale.saleNumber,
    saleDate: sale.date,
    businessName: ctx.businessProfile?.name || 'iPhoneRepasse',
    businessAddress: ctx.businessProfile?.address || undefined,
    businessCnpj: ctx.businessProfile?.cnpj || undefined,
    businessPhone: ctx.businessProfile?.phone || undefined,
    customerName: ctx.customerName,
    customerCpf: ctx.customerCpf || undefined,
    sellerName: ctx.sellerName,
    items: sale.items.map((item) => ({
      model: item.model,
      capacity: item.capacity,
      color: item.color,
      imei: item.imei,
      sellPrice: item.sellPrice,
      condition: item.condition,
      batteryHealth: item.batteryHealth,
      warrantyExpiresAt: getItemWarrantyDate(sale, item)
    })),
    tradeIns: tradeIns.map((tradeIn) => ({
      model: tradeIn.model,
      capacity: tradeIn.capacity,
      color: tradeIn.color,
      imei: tradeIn.imei,
      receivedValue: tradeIn.receivedValue
    })),
    tradeInSubtotal: getSaleTradeInSubtotal(sale),
    payments: sale.paymentMethods.map((payment) => ({
      label: getPaymentLabel(payment),
      customerAmount: getPaymentCustomerAmount(payment),
      storeAmount: roundCurrency(payment.amount),
      isPending: payment.type === 'Devedor'
    })),
    negotiatedSubtotal: roundCurrency(getNegotiatedSubtotal(sale)),
    discountAmount: roundCurrency(Number(sale.discount || 0)),
    discountLabel: getSaleDiscountLabel(sale),
    saleGrossTotal: getSaleHistoryTotal(sale),
    cardFeeTotal: getSaleCardFeeTotal(sale),
    totalCustomerWithTradeIn: getSalePaidTotal(sale),
    saleNetTotal: sale.total,
    warrantyLine: hasWarrantyByItem ? 'Garantias descritas por aparelho.' : null
  };
}
