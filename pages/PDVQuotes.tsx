import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Copy, FilePlus2, FileText, RefreshCw, Search, XCircle } from 'lucide-react';
import { useData } from '../services/dataContext';
import { cancelQuote, listQuotes } from '../services/quotesApi';
import { useToast } from '../components/ui/ToastProvider';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { formatCurrencyBRL } from '../utils/inputMasks';
import { normalizeSearchText } from '../utils/saleSearch';
import { QuoteDocumentViewer } from './pdv/quote/QuoteDocumentViewer';
import { formatQuoteNumber, resolveQuoteLifecycle, type QuoteLifecycle, type SavedQuote } from './pdv/quote/quoteModel';

type QuoteFilter = 'todos' | QuoteLifecycle;

const FILTERS: { value: QuoteFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'valido', label: 'Válidos' },
  { value: 'vencido', label: 'Vencidos' },
  { value: 'cancelado', label: 'Cancelados' },
];

const LIFECYCLE_BADGE: Record<QuoteLifecycle, { label: string; className: string }> = {
  valido: { label: 'Válido', className: 'ios-badge-green' },
  vencido: { label: 'Vencido', className: 'ios-badge-orange' },
  cancelado: { label: 'Cancelado', className: 'ios-badge-red' },
};

const formatShortDateTime = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

const quoteHeadline = (quote: SavedQuote) => {
  const [first, ...rest] = quote.items.map((item) => item.name);
  return rest.length > 0 ? `${first} + ${rest.length}` : first;
};

const quoteTotalLabel = (quote: SavedQuote) =>
  quote.snapshot.presentation === 'compare'
    ? `${quote.items.length} opções`
    : formatCurrencyBRL(quote.snapshot.totals.total);

const matchesSearch = (quote: SavedQuote, query: string) => {
  if (!query) return true;
  const haystack = normalizeSearchText(
    [formatQuoteNumber(quote.quoteNumber), quote.customerName, quote.customerPhone, quote.sellerName, ...quote.items.map((item) => item.name)].join(' '),
  );
  return haystack.includes(query);
};

function useQuotesList() {
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      setQuotes(await listQuotes());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markCancelled = (id: string) =>
    setQuotes((prev) => prev.map((quote) => (quote.id === id ? { ...quote, status: 'cancelado' } : quote)));

  return { quotes, status, load, markCancelled };
}

export default function PDVQuotes() {
  const { businessProfile } = useData();
  const navigate = useNavigate();
  const toast = useToast();
  const { quotes, status, load, markCancelled } = useQuotesList();
  const [filter, setFilter] = useState<QuoteFilter>('todos');
  const [search, setSearch] = useState('');
  const [opened, setOpened] = useState<SavedQuote | null>(null);
  const [toCancel, setToCancel] = useState<SavedQuote | null>(null);
  const [now] = useState(() => new Date());

  const visible = useMemo(() => {
    const query = normalizeSearchText(search.trim());
    return quotes.filter((quote) => (filter === 'todos' || resolveQuoteLifecycle(quote, now) === filter) && matchesSearch(quote, query));
  }, [quotes, filter, search, now]);

  const duplicate = (quote: SavedQuote) => navigate('/pdv/orcamentos/novo', { state: { baseQuote: quote } });

  const confirmCancel = async () => {
    if (!toCancel) return;
    const target = toCancel;
    setToCancel(null);
    try {
      await cancelQuote(target.id);
      markCancelled(target.id);
      toast.success(`${formatQuoteNumber(target.quoteNumber)} cancelado.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível cancelar o orçamento.');
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <section className="ios-card flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between md:p-6">
        <div className="flex items-center gap-3">
          <Link to="/pdv" aria-label="Voltar para o PDV" className="app-icon-button-muted grid h-11 w-11 place-items-center rounded-xl">
            <ChevronLeft size={22} aria-hidden="true" />
          </Link>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] app-text-muted">PDV</p>
            <h1 className="text-ios-title-1 font-bold app-text-primary">Orçamentos</h1>
          </div>
        </div>
        <Link to="/pdv/orcamentos/novo" className="ios-button-primary inline-flex w-full items-center justify-center gap-2 md:w-auto">
          <FilePlus2 size={18} aria-hidden="true" />
          Novo orçamento
        </Link>
      </section>

      <section className="ios-card space-y-3 p-3 md:p-4">
        <div className="app-search-wrap group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 app-search-icon pointer-events-none" size={18} aria-hidden="true" />
          <input type="text" inputMode="search" autoComplete="off" aria-label="Buscar orçamentos" value={search}
            placeholder="Buscar por cliente, aparelho, vendedor ou nº ORC…" onChange={(event) => setSearch(event.target.value)}
            className="ios-input pl-10" />
        </div>
        <div role="radiogroup" aria-label="Filtrar orçamentos" className="ios-segmented-control grid grid-cols-4">
          {FILTERS.map((option) => (
            <button key={option.value} type="button" role="radio" aria-checked={filter === option.value} onClick={() => setFilter(option.value)}
              className={`ios-segment ${filter === option.value ? 'ios-segment-active' : ''}`}>
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <QuotesListBody
        status={status}
        quotes={visible}
        hasAny={quotes.length > 0}
        now={now}
        onRetry={() => void load()}
        onOpen={setOpened}
        onDuplicate={duplicate}
        onCancel={setToCancel}
      />

      <QuoteDocumentViewer quote={opened} business={businessProfile} onClose={() => setOpened(null)} />
      <ConfirmDialog
        open={Boolean(toCancel)}
        onClose={() => setToCancel(null)}
        title={toCancel ? `Cancelar ${formatQuoteNumber(toCancel.quoteNumber)}?` : 'Cancelar orçamento?'}
        description="O orçamento continua no histórico, marcado como cancelado. Isso não pode ser desfeito."
        confirmLabel="Cancelar orçamento"
        cancelLabel="Manter"
        variant="danger"
        onConfirm={() => void confirmCancel()}
      />
    </div>
  );
}

interface QuotesListBodyProps {
  status: 'loading' | 'ready' | 'error';
  quotes: SavedQuote[];
  hasAny: boolean;
  now: Date;
  onRetry: () => void;
  onOpen: (quote: SavedQuote) => void;
  onDuplicate: (quote: SavedQuote) => void;
  onCancel: (quote: SavedQuote) => void;
}

function QuotesListBody({ status, quotes, hasAny, now, onRetry, onOpen, onDuplicate, onCancel }: QuotesListBodyProps) {
  if (status === 'loading') {
    return (
      <div role="status" aria-label="Carregando orçamentos" className="space-y-2">
        {[0, 1, 2].map((key) => <div key={key} className="ios-card h-20 animate-pulse" />)}
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="ios-card p-6 text-center">
        <p className="font-semibold app-text-primary">Não foi possível carregar os orçamentos.</p>
        <p className="mt-1 text-sm app-text-muted">Verifique a conexão e tente de novo.</p>
        <button type="button" onClick={onRetry} className="ios-button-secondary mt-4 inline-flex items-center gap-2"><RefreshCw size={16} aria-hidden="true" />Tentar de novo</button>
      </div>
    );
  }
  if (quotes.length === 0) {
    return (
      <div className="ios-card p-8 text-center">
        <FileText size={32} className="mx-auto app-text-muted" aria-hidden="true" />
        <p className="mt-3 font-semibold app-text-primary">{hasAny ? 'Nenhum orçamento com esse filtro' : 'Nenhum orçamento ainda'}</p>
        <p className="mt-1 text-sm app-text-muted">{hasAny ? 'Troque o filtro ou a busca.' : 'Monte um orçamento com aparelhos do estoque ou produtos por encomenda.'}</p>
        {!hasAny && <Link to="/pdv/orcamentos/novo" className="ios-button-primary mt-4 inline-flex">Novo orçamento</Link>}
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {quotes.map((quote) => (
        <QuoteRow key={quote.id} quote={quote} lifecycle={resolveQuoteLifecycle(quote, now)} onOpen={onOpen} onDuplicate={onDuplicate} onCancel={onCancel} />
      ))}
    </ul>
  );
}

interface QuoteRowProps {
  quote: SavedQuote;
  lifecycle: QuoteLifecycle;
  onOpen: (quote: SavedQuote) => void;
  onDuplicate: (quote: SavedQuote) => void;
  onCancel: (quote: SavedQuote) => void;
}

const QuoteRow: React.FC<QuoteRowProps> = ({ quote, lifecycle, onOpen, onDuplicate, onCancel }) => {
  const badge = LIFECYCLE_BADGE[lifecycle];
  const expiryText = lifecycle === 'vencido' ? `Venceu ${formatShortDateTime(quote.expiresAt)}` : `Vale até ${formatShortDateTime(quote.expiresAt)}`;

  return (
    <li className="ios-card p-3 md:p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <button type="button" onClick={() => onOpen(quote)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
            <FileText size={20} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold tabular-nums app-text-primary">{formatQuoteNumber(quote.quoteNumber)}</span>
              <span className={`ios-badge ${badge.className}`}>{badge.label}</span>
            </span>
            <span className="mt-0.5 block truncate font-semibold app-text-primary">{quoteHeadline(quote)}</span>
            <span className="block truncate text-sm app-text-muted">
              {[quote.customerName || 'Sem cliente', lifecycle === 'cancelado' ? null : expiryText].filter(Boolean).join(' · ')}
            </span>
          </span>
          <span className="shrink-0 text-right text-base font-bold tabular-nums app-text-primary">{quoteTotalLabel(quote)}</span>
        </button>
        <div className="flex gap-2 md:shrink-0">
          <button type="button" onClick={() => onDuplicate(quote)} className="ios-button-secondary inline-flex flex-1 items-center justify-center gap-2 md:flex-none">
            <Copy size={16} aria-hidden="true" />{lifecycle === 'vencido' ? 'Renovar' : 'Duplicar'}
          </button>
          {lifecycle !== 'cancelado' && (
            <button type="button" onClick={() => onCancel(quote)} aria-label={`Cancelar ${formatQuoteNumber(quote.quoteNumber)}`}
              className="app-icon-button-muted grid h-11 w-11 place-items-center rounded-xl hover:text-red-600">
              <XCircle size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </li>
  );
};
