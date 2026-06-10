import type { Sale } from '../types';

/**
 * Código de exibição da venda baseado no número sequencial e estável (#1, #2, ...).
 * Mantém um fallback para o antigo código derivado do id (últimos 6 caracteres)
 * caso o número ainda não esteja disponível (ex.: dados em cache antigo).
 */
export function formatSaleNumber(sale: Pick<Sale, 'id' | 'saleNumber'>): string {
  if (sale.saleNumber != null) return String(sale.saleNumber);
  return sale.id.slice(-6).toUpperCase();
}

/** Versão a partir de campos soltos (id + número opcional). */
export function formatSaleNumberFrom(id: string, saleNumber?: number | null): string {
  if (saleNumber != null) return String(saleNumber);
  return id.slice(-6).toUpperCase();
}
