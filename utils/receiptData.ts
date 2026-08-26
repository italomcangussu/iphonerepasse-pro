/**
 * Modelo de dados único do comprovante de venda.
 *
 * Antes deste módulo, PDV e PDVHistory derivavam os totais do comprovante cada
 * um do seu jeito, e o mesmo pedido saía diferente conforme a tela de origem.
 * Aqui ficam as funções puras que traduzem uma `Sale` no que o recibo mostra —
 * consumidas pelo ESC/POS (térmica), pelo PDF e pelos templates em tela.
 */

import { BusinessProfile, Condition, Customer, PaymentMethod, Sale, SaleTradeInItem, StockItem } from '../types';
import { formatCpfOrCnpj, formatDateBRL, formatPhone, getCpfOrCnpjLabel } from './inputMasks';
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

/**
 * Ficha cadastral do cliente como o comprovante a enxerga. Espelha os campos de
 * `Customer`, mas com `name` já resolvido pela tela (que conhece o fallback de
 * venda sem cliente) e todo o resto opcional — cadastro incompleto é comum.
 */
export interface ReceiptCustomerInfo {
  name: string;
  cpf?: string | null;
  phone?: string | null;
  alternativePhone?: string | null;
  email?: string | null;
  birthDate?: string | null;
}

export interface ReceiptField {
  label: string;
  value: string;
}

/**
 * Cadastro do cliente da venda. Venda sem cliente vinculado ainda emite
 * comprovante, daí o nome de fallback ser da tela que chama.
 */
export const toReceiptCustomer = (
  customer: Customer | null | undefined,
  fallbackName = 'Não identificado'
): ReceiptCustomerInfo => ({
  name: customer?.name || fallbackName,
  cpf: customer?.cpf,
  phone: customer?.phone,
  alternativePhone: customer?.alternativePhone,
  email: customer?.email,
  birthDate: customer?.birthDate
});

const trimmed = (value?: string | null): string => String(value ?? '').trim();

/**
 * Telefones do cadastro já entram mascarados (ver `Clients.tsx`), mas dados
 * antigos/importados podem chegar em qualquer forma. Só reformata o que tem
 * cara de telefone brasileiro; o resto sai como está, em vez de ser truncado.
 */
const formatReceiptPhone = (value: string): string => {
  // Número internacional já vem com o país explícito: aplicar a máscara de DDD
  // brasileiro nele produziria um telefone que não existe.
  if (value.startsWith('+')) return value;
  const digits = value.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11 ? formatPhone(digits) : value;
};

/**
 * Identificação completa do cliente, na ordem em que o comprovante mostra.
 *
 * Esta é a definição única de "dados do cliente no comprovante": ESC/POS, PDF
 * vetorial e os templates A4/80mm em tela consomem esta mesma lista, então uma
 * venda não sai com um conjunto de campos na térmica e outro no WhatsApp.
 * Campo vazio não vira linha em branco — simplesmente não entra.
 */
export function buildCustomerReceiptFields(customer: ReceiptCustomerInfo): ReceiptField[] {
  const fields: ReceiptField[] = [{ label: 'Cliente', value: trimmed(customer.name) || 'Não identificado' }];

  const document = trimmed(customer.cpf);
  if (document) fields.push({ label: getCpfOrCnpjLabel(document), value: formatCpfOrCnpj(document) });

  const phone = trimmed(customer.phone);
  if (phone) fields.push({ label: 'Telefone', value: formatReceiptPhone(phone) });

  const alternativePhone = trimmed(customer.alternativePhone);
  if (alternativePhone) fields.push({ label: 'Telefone alternativo', value: formatReceiptPhone(alternativePhone) });

  const email = trimmed(customer.email);
  if (email) fields.push({ label: 'E-mail', value: email });

  const birthDate = trimmed(customer.birthDate);
  if (birthDate) {
    const formattedBirthDate = formatDateBRL(birthDate);
    if (formattedBirthDate !== '-') fields.push({ label: 'Nascimento', value: formattedBirthDate });
  }

  return fields;
}

/** Mesma lista de `buildCustomerReceiptFields`, a partir do payload do recibo. */
export function getReceiptCustomerFields(data: ThermalReceiptData): ReceiptField[] {
  return buildCustomerReceiptFields({
    name: data.customerName,
    cpf: data.customerCpf,
    phone: data.customerPhone,
    alternativePhone: data.customerAlternativePhone,
    email: data.customerEmail,
    birthDate: data.customerBirthDate
  });
}

export interface SaleReceiptContext {
  businessProfile?: BusinessProfile | null;
  customer: ReceiptCustomerInfo;
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
    customerName: ctx.customer.name,
    customerCpf: ctx.customer.cpf || undefined,
    customerPhone: ctx.customer.phone || undefined,
    customerAlternativePhone: ctx.customer.alternativePhone || undefined,
    customerEmail: ctx.customer.email || undefined,
    customerBirthDate: ctx.customer.birthDate || undefined,
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
