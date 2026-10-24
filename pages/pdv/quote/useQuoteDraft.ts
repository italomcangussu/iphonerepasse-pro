import { useCallback, useMemo, useState } from 'react';
import type { CardFeeSettings, StockItem } from '../../../types';
import { newId } from '../../../utils/id';
import {
  computeQuoteTotals,
  createManualQuoteItem,
  DEFAULT_QUOTE_PAYMENT_PLAN,
  findQuoteDraftIssues,
  stockItemToQuoteItem,
  type QuoteItem,
  type QuotePaymentPlan,
  type QuotePresentation,
  type SavedQuote,
} from './quoteModel';

export interface QuoteCustomerDraft {
  customerId: string | null;
  name: string;
  phone: string;
}

const EMPTY_CUSTOMER: QuoteCustomerDraft = { customerId: null, name: '', phone: '' };

/** Duplicar parte do orçamento antigo, mas recalcula com as taxas de hoje. */
const freshCopyOf = (base?: SavedQuote | null) => ({
  items: base ? base.items.map((item) => ({ ...item, key: newId('qi') })) : [],
  presentation: base?.snapshot.presentation ?? ('sum' as QuotePresentation),
  plan: base?.snapshot.plan ?? DEFAULT_QUOTE_PAYMENT_PLAN,
  discount: base?.snapshot.totals.discount ?? 0,
  notes: base?.notes ?? '',
  customer: base
    ? { customerId: base.customerId, name: base.customerName ?? '', phone: base.customerPhone ?? '' }
    : EMPTY_CUSTOMER,
});

export function useQuoteDraft(cardFeeSettings: CardFeeSettings, base?: SavedQuote | null) {
  const [initial] = useState(() => freshCopyOf(base));
  const [items, setItems] = useState<QuoteItem[]>(initial.items);
  const [presentation, setPresentation] = useState<QuotePresentation>(initial.presentation);
  const [plan, setPlan] = useState<QuotePaymentPlan>(initial.plan);
  const [discount, setDiscount] = useState(initial.discount);
  const [notes, setNotes] = useState(initial.notes);
  const [customer, setCustomer] = useState<QuoteCustomerDraft>(initial.customer);

  const addStockItem = useCallback((stockItem: StockItem) => {
    setItems((prev) => (prev.some((item) => item.stockItemId === stockItem.id) ? prev : [...prev, stockItemToQuoteItem(stockItem, newId('qi'))]));
  }, []);

  const addManualItem = useCallback(() => {
    const item = createManualQuoteItem(newId('qi'));
    setItems((prev) => [...prev, item]);
    return item.key;
  }, []);

  const updateItem = useCallback((key: string, patch: Partial<QuoteItem>) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }, []);

  const removeItem = useCallback((key: string) => {
    let removed: { item: QuoteItem; index: number } | null = null;
    setItems((prev) => {
      const index = prev.findIndex((item) => item.key === key);
      if (index < 0) return prev;
      removed = { item: prev[index], index };
      return prev.filter((item) => item.key !== key);
    });
    return () => {
      const snapshot = removed;
      if (!snapshot) return;
      setItems((prev) => [...prev.slice(0, snapshot.index), snapshot.item, ...prev.slice(snapshot.index)]);
    };
  }, []);

  const effectivePresentation: QuotePresentation = items.length < 2 ? 'sum' : presentation;

  const totals = useMemo(
    () => computeQuoteTotals({ items, discount, presentation: effectivePresentation, plan }, cardFeeSettings),
    [items, discount, effectivePresentation, plan, cardFeeSettings],
  );

  const issues = useMemo(() => findQuoteDraftIssues(items), [items]);

  return {
    items,
    presentation: effectivePresentation,
    plan,
    discount,
    notes,
    customer,
    totals,
    issues,
    addStockItem,
    addManualItem,
    updateItem,
    removeItem,
    setPresentation,
    setPlan,
    setDiscount,
    setNotes,
    setCustomer,
  };
}

export type QuoteDraft = ReturnType<typeof useQuoteDraft>;
