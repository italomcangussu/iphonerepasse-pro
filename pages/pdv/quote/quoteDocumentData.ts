import type { BusinessProfile } from '../../../types';
import type { QuoteDocumentData } from './quoteDocument';
import type { SavedQuote } from './quoteModel';

export const savedQuoteToDocumentData = (
  quote: SavedQuote,
  business: BusinessProfile,
  logoDataUrl: string | null,
): QuoteDocumentData => ({
  quoteNumber: quote.quoteNumber,
  createdAt: new Date(quote.createdAt),
  expiresAt: new Date(quote.expiresAt),
  validityDays: quote.validityDays,
  business,
  logoDataUrl,
  customerName: quote.customerName,
  customerPhone: quote.customerPhone,
  sellerName: quote.sellerName,
  items: quote.items,
  presentation: quote.snapshot.presentation,
  cardBrand: quote.snapshot.plan.cardBrand,
  totals: quote.snapshot.totals,
  notes: quote.notes,
});
