import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../services/dataContext';
import { createQuote, QuoteRequestError } from '../services/quotesApi';
import { useToast } from '../components/ui/ToastProvider';
import { formatCurrencyBRL } from '../utils/inputMasks';
import { QuoteItemsCard } from './pdv/quote/QuoteItemsCard';
import { QuotePaymentCard } from './pdv/quote/QuotePaymentCard';
import { QuoteCustomerCard } from './pdv/quote/QuoteCustomerCard';
import { QuoteSummaryCard } from './pdv/quote/QuoteSummaryCard';
import { QuoteValidityDialog } from './pdv/quote/QuoteValidityDialog';
import { QuoteDocumentViewer } from './pdv/quote/QuoteDocumentViewer';
import { useQuoteDraft, type QuoteDraft } from './pdv/quote/useQuoteDraft';
import { computeQuoteExpiry, type NewQuote, type QuoteItem, type SavedQuote } from './pdv/quote/quoteModel';

interface QuoteNewLocationState {
  baseQuote?: SavedQuote;
}

interface QuoteSaveContext {
  sellerName: string;
  validityDays: number;
  createdAt: Date;
  storeId: string | null;
}

const toNewQuote = (draft: QuoteDraft, { sellerName, validityDays, createdAt, storeId }: QuoteSaveContext): NewQuote => ({
  expiresAt: computeQuoteExpiry(createdAt, validityDays).toISOString(),
  validityDays,
  storeId,
  customerId: draft.customer.customerId,
  customerName: draft.customer.name.trim() || null,
  customerPhone: draft.customer.phone || null,
  sellerName: sellerName.trim() || null,
  items: draft.items.map((item) => ({ ...item, name: item.name.trim(), leadTime: item.leadTime?.trim() || undefined })),
  snapshot: { plan: draft.plan, presentation: draft.presentation, totals: draft.totals },
  notes: draft.notes.trim() || null,
});

export default function PDVQuoteNew() {
  const { stock, customers, sellers, businessProfile, cardFeeSettings } = useData();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const baseQuote = (useLocation().state as QuoteNewLocationState | null)?.baseQuote ?? null;
  const draft = useQuoteDraft(cardFeeSettings, baseQuote);

  const [sellerName, setSellerName] = useState(
    () => baseQuote?.sellerName ?? sellers.find((seller) => seller.id === profile?.sellerId)?.name ?? '',
  );
  const [showIssues, setShowIssues] = useState(false);
  const [askValidity, setAskValidity] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedQuote | null>(null);

  const removeItem = (item: QuoteItem) => {
    const undo = draft.removeItem(item.key);
    toast.info(`${item.name || 'Produto'} removido.`, { action: { label: 'Desfazer', onClick: undo } });
  };

  const requestSave = () => {
    if (draft.issues.length > 0) {
      setShowIssues(true);
      toast.warning(draft.issues[0].message);
      return;
    }
    setAskValidity(true);
  };

  const save = async (validityDays: number) => {
    const createdAt = new Date();
    const firstStockId = draft.items.find((item) => item.stockItemId)?.stockItemId;
    const storeId = stock.find((item) => item.id === firstStockId)?.storeId ?? null;
    setSaving(true);
    try {
      const quote = await createQuote(toNewQuote(draft, { sellerName, validityDays, createdAt, storeId }), createdAt);
      setAskValidity(false);
      setSaved(quote);
      toast.success('Orçamento salvo.');
    } catch (error) {
      toast.error(error instanceof QuoteRequestError ? error.message : 'Não foi possível salvar o orçamento. Tente de novo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pb-24 md:space-y-6 lg:pb-0">
      <header className="flex items-center gap-3">
        <Link to="/pdv/orcamentos" aria-label="Voltar para orçamentos" className="app-icon-button-muted grid h-11 w-11 place-items-center rounded-xl">
          <ChevronLeft size={22} aria-hidden="true" />
        </Link>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] app-text-muted">PDV · Orçamento</p>
          <h1 className="text-ios-title-1 font-bold app-text-primary">{baseQuote ? 'Novo orçamento a partir de outro' : 'Novo orçamento'}</h1>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start md:gap-6">
        <div className="space-y-4 md:space-y-6">
          <QuoteItemsCard
            stock={stock}
            items={draft.items}
            issues={draft.issues}
            showIssues={showIssues}
            onAddStock={draft.addStockItem}
            onAddManual={draft.addManualItem}
            onUpdate={draft.updateItem}
            onRemove={removeItem}
          />
          <QuotePaymentCard
            plan={draft.plan}
            presentation={draft.presentation}
            itemCount={draft.items.length}
            onPlanChange={draft.setPlan}
            onPresentationChange={draft.setPresentation}
          />
          <QuoteCustomerCard
            customers={customers}
            sellers={sellers}
            customer={draft.customer}
            sellerName={sellerName}
            discount={draft.discount}
            subtotal={draft.totals.subtotal}
            showDiscount={draft.presentation === 'sum'}
            notes={draft.notes}
            onCustomerChange={draft.setCustomer}
            onSellerChange={setSellerName}
            onDiscountChange={draft.setDiscount}
            onNotesChange={draft.setNotes}
          />
        </div>

        <aside className="hidden lg:block lg:sticky lg:top-4">
          <QuoteSummaryCard
            totals={draft.totals}
            presentation={draft.presentation}
            itemNames={draft.items.map((item) => item.name)}
            issues={draft.issues}
            onSave={requestSave}
          />
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+3.75rem)] z-30 px-4 md:inset-x-auto md:right-6 md:bottom-6 md:w-96 md:px-0 lg:hidden">
        <div className="ios-card flex items-center justify-between gap-3 p-3 shadow-ios-lg">
          <div className="min-w-0">
            <p className="text-xs app-text-muted">{draft.presentation === 'compare' ? `${draft.items.length} opções` : 'Total à vista'}</p>
            <p className="truncate text-lg font-bold tabular-nums app-text-primary">{formatCurrencyBRL(draft.totals.total)}</p>
          </div>
          <button type="button" onClick={requestSave} className="ios-button-primary shrink-0">Salvar orçamento</button>
        </div>
      </div>

      <QuoteValidityDialog open={askValidity} saving={saving} onClose={() => setAskValidity(false)} onConfirm={(days) => void save(days)} />
      <QuoteDocumentViewer quote={saved} business={businessProfile} onClose={() => navigate('/pdv/orcamentos')} />
    </div>
  );
}
