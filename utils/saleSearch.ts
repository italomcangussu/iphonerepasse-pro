/**
 * Busca do histórico de vendas.
 *
 * Os filtros do histórico respondem a perguntas fechadas ("quais vendas da loja
 * X no cartão?"). A busca responde à pergunta aberta que o balcão realmente faz
 * — "cadê a venda do Jorge?", "de quem é esse IMEI?", "qual foi a #377?" — e
 * para isso precisa varrer tudo que a venda carrega, não uma coluna só.
 *
 * O índice é montado uma vez por venda e reaproveitado a cada tecla: montar o
 * texto é a parte cara, comparar é `includes`.
 */

import type { Customer, Sale } from '../types';
import { getPaymentLabel, getSaleHistoryTotal, getSaleTradeIns } from './receiptData';
import { formatSaleNumber } from './saleCode';

export interface SaleSearchSubject {
  sale: Sale;
  customer?: Customer | null;
  sellerName?: string | null;
  storeName?: string | null;
}

export interface SaleSearchIndex {
  /** Tudo que a venda mostra, em minúsculas e sem acento. */
  text: string;
  /**
   * Sequências numéricas campo a campo (IMEI, CPF, telefone, nº, valores).
   * Separadas porque um número digitado inteiro não pode casar por acidente
   * atravessando a fronteira de dois campos vizinhos.
   */
  digits: string[];
}

/** Minúsculas, sem acento e sem espaço duplicado — os dois lados da comparação. */
export const normalizeSearchText = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const onlyDigits = (value: unknown): string => String(value ?? '').replace(/\D/g, '');

/** Um termo é numérico quando não tem nenhuma letra — "4.390,00", "(85) 9…", "#377". */
const isNumericTerm = (term: string): boolean => /\d/.test(term) && !/[a-z]/.test(term);

const centsOf = (value: number): string => String(Math.round(Math.abs(value) * 100));

export function buildSaleSearchIndex({ sale, customer, sellerName, storeName }: SaleSearchSubject): SaleSearchIndex {
  const parts: unknown[] = [];
  const digits: string[] = [];

  const pushText = (...values: unknown[]) => parts.push(...values);
  const pushDigits = (...values: unknown[]) => {
    for (const value of values) {
      const numeric = onlyDigits(value);
      if (numeric) digits.push(numeric);
    }
  };

  // Identificação da venda
  const saleNumber = formatSaleNumber(sale);
  pushText(saleNumber, `#${saleNumber}`);
  pushDigits(saleNumber);

  const saleDate = new Date(sale.date);
  if (!Number.isNaN(saleDate.getTime())) {
    pushText(saleDate.toLocaleDateString('pt-BR'), saleDate.toLocaleTimeString('pt-BR'));
  }

  // Pessoas e loja
  pushText(customer?.name, customer?.email, customer?.cpf, customer?.phone, customer?.alternativePhone);
  pushDigits(customer?.cpf, customer?.phone, customer?.alternativePhone);
  pushText(sellerName, storeName);

  // Aparelhos vendidos e recebidos na troca
  for (const item of sale.items) {
    pushText(item.model, item.capacity, item.color, item.condition, item.imei);
    pushDigits(item.imei);
  }
  for (const tradeIn of getSaleTradeIns(sale)) {
    pushText(tradeIn.model, tradeIn.capacity, tradeIn.color, tradeIn.imei);
    pushDigits(tradeIn.imei);
  }

  // Pagamento e valores — "4390", "4.390,00" e "R$ 4.390,00" são a mesma busca.
  for (const payment of sale.paymentMethods) {
    pushText(getPaymentLabel(payment), payment.account);
  }
  const total = getSaleHistoryTotal(sale);
  pushText(total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  pushDigits(String(Math.round(total)), centsOf(total));

  return {
    text: normalizeSearchText(parts.filter(Boolean).join(' ')),
    digits
  };
}

/**
 * Todos os termos precisam casar (E, não OU): "kauan 15 pro" é a venda de um
 * iPhone 15 Pro feita pelo Kauan, não toda venda que cite qualquer um deles.
 */
export function matchesSaleSearch(index: SaleSearchIndex, query: string): boolean {
  const terms = normalizeSearchText(query).split(' ').filter(Boolean);
  if (terms.length === 0) return true;

  return terms.every((term) => {
    if (index.text.includes(term)) return true;
    if (!isNumericTerm(term)) return false;
    const numeric = onlyDigits(term);
    return Boolean(numeric) && index.digits.some((value) => value.includes(numeric));
  });
}
