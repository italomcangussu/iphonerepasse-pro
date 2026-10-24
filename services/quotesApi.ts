// Acesso a dados dos orçamentos do PDV (tabela pdv_quotes). Telas e componentes usam só este módulo.
import { supabase } from './supabase';
import type { NewQuote, SavedQuote } from '../pages/pdv/quote/quoteModel';

interface PdvQuoteRow {
  id: string;
  quote_number: number;
  created_at: string;
  expires_at: string;
  validity_days: number;
  status: 'aberto' | 'cancelado';
  store_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  seller_name: string | null;
  items: SavedQuote['items'];
  payment: SavedQuote['snapshot'];
  notes: string | null;
}

const COLUMNS =
  'id, quote_number, created_at, expires_at, validity_days, status, store_id, customer_id, customer_name, customer_phone, seller_name, items, payment, notes';

export class QuoteRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuoteRequestError';
  }
}

const fail = (action: string): never => {
  throw new QuoteRequestError(`Não foi possível ${action}. Verifique a conexão e tente de novo.`);
};

const fromRow = (row: PdvQuoteRow): SavedQuote => ({
  id: row.id,
  quoteNumber: row.quote_number,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  validityDays: row.validity_days,
  status: row.status,
  storeId: row.store_id,
  customerId: row.customer_id,
  customerName: row.customer_name,
  customerPhone: row.customer_phone,
  sellerName: row.seller_name,
  items: row.items,
  snapshot: row.payment,
  notes: row.notes,
});

export async function createQuote(quote: NewQuote, createdAt: Date): Promise<SavedQuote> {
  const { totals } = quote.snapshot;
  const { data, error } = await supabase
    .from('pdv_quotes')
    .insert({
      created_at: createdAt.toISOString(),
      expires_at: quote.expiresAt,
      validity_days: quote.validityDays,
      store_id: quote.storeId,
      customer_id: quote.customerId,
      customer_name: quote.customerName,
      customer_phone: quote.customerPhone,
      seller_name: quote.sellerName,
      items: quote.items,
      payment: quote.snapshot,
      subtotal: totals.subtotal,
      discount: totals.discount,
      total: totals.total,
      notes: quote.notes,
    })
    .select(COLUMNS)
    .single();
  if (error || !data) return fail('salvar o orçamento');
  return fromRow(data as PdvQuoteRow);
}

export async function listQuotes(limit = 200): Promise<SavedQuote[]> {
  const { data, error } = await supabase.from('pdv_quotes').select(COLUMNS).order('created_at', { ascending: false }).limit(limit);
  if (error) return fail('carregar os orçamentos');
  return (data as PdvQuoteRow[]).map(fromRow);
}

export async function cancelQuote(id: string): Promise<void> {
  const { error } = await supabase.from('pdv_quotes').update({ status: 'cancelado' }).eq('id', id);
  if (error) fail('cancelar o orçamento');
}
