import React, { useMemo } from 'react';
import { Battery, PackagePlus, Smartphone, Trash2 } from 'lucide-react';
import { Combobox } from '../../../components/ui/Combobox';
import { StockStatus, type StockItem } from '../../../types';
import { formatCurrencyBRL } from '../../../utils/inputMasks';
import { filterProductSearchOptions } from '../../../utils/productSearch';
import { MoneyInput, QuantityStepper } from './QuoteControls';
import { itemLineTotal, type QuoteDraftIssue, type QuoteItem } from './quoteModel';

interface QuoteItemsCardProps {
  stock: StockItem[];
  items: QuoteItem[];
  issues: QuoteDraftIssue[];
  showIssues: boolean;
  onAddStock: (item: StockItem) => void;
  onAddManual: () => void;
  onUpdate: (key: string, patch: Partial<QuoteItem>) => void;
  onRemove: (item: QuoteItem) => void;
}

const stockLabel = (item: StockItem) => [item.model, item.capacity].filter(Boolean).join(' ');

function useStockOptions(stock: StockItem[], items: QuoteItem[]) {
  return useMemo(() => {
    const inQuote = new Set(items.map((item) => item.stockItemId).filter(Boolean));
    return stock
      .filter((item) => item.status === StockStatus.AVAILABLE && !inQuote.has(item.id))
      .map((item) => ({
        id: item.id,
        label: stockLabel(item),
        subLabel: `${item.color || 'Sem cor'} • ${item.condition} • ${formatCurrencyBRL(item.sellPrice)} • IMEI/Serial: ${item.imei || '-'}`,
        trailing: <span className="text-sm font-semibold tabular-nums app-text-primary">{formatCurrencyBRL(item.sellPrice)}</span>,
        description: (
          <span className="flex items-center gap-1.5 text-xs app-text-muted">
            {item.batteryHealth ? (<><Battery size={12} aria-hidden="true" />{item.batteryHealth}% · </>) : null}
            {item.color || 'Sem cor'} · {item.condition}
          </span>
        ),
      }));
  }, [stock, items]);
}

export function QuoteItemsCard({ stock, items, issues, showIssues, onAddStock, onAddManual, onUpdate, onRemove }: QuoteItemsCardProps) {
  const options = useStockOptions(stock, items);
  const issueFor = (key: string) => (showIssues ? issues.find((issue) => issue.itemKey === key)?.message : undefined);

  return (
    <section aria-labelledby="quote-items-title" className="ios-card p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 id="quote-items-title" className="text-[17px] font-bold app-text-primary">Produtos</h2>
        {items.length > 0 && <span className="text-xs font-medium app-text-muted">{items.length} {items.length === 1 ? 'item' : 'itens'}</span>}
      </div>

      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <Combobox
          label="Adicionar do estoque"
          placeholder="Buscar modelo, cor, IMEI…"
          searchPlaceholder="Digite o modelo, cor ou IMEI"
          value=""
          options={options}
          filterOptions={filterProductSearchOptions}
          minSearchChars={2}
          noResultsMessage="Nenhum aparelho disponível com esse termo. Use “Produto fora do estoque”."
          onChange={(id) => {
            const picked = stock.find((item) => item.id === id);
            if (picked) onAddStock(picked);
          }}
        />
        <button type="button" onClick={onAddManual} className="ios-button-secondary inline-flex items-center justify-center gap-2">
          <PackagePlus size={18} aria-hidden="true" />
          Produto fora do estoque
        </button>
      </div>

      {items.length === 0 ? (
        <div className={`mt-4 rounded-2xl border border-dashed p-6 text-center ${showIssues ? 'border-red-300 dark:border-red-800' : 'app-border'}`}>
          <Smartphone size={28} className="mx-auto app-text-muted" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold app-text-primary">Nenhum produto ainda</p>
          <p className="mt-1 text-sm app-text-muted">Busque um aparelho do estoque ou adicione um produto que não está no estoque.</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <QuoteItemRow key={item.key} item={item} error={issueFor(item.key)} onUpdate={onUpdate} onRemove={onRemove} />
          ))}
        </ul>
      )}
    </section>
  );
}

interface QuoteItemRowProps {
  item: QuoteItem;
  error?: string;
  onUpdate: (key: string, patch: Partial<QuoteItem>) => void;
  onRemove: (item: QuoteItem) => void;
}

const QuoteItemRow: React.FC<QuoteItemRowProps> = ({ item, error, onUpdate, onRemove }) => {
  const errorId = `quote-item-error-${item.key}`;
  const isManual = item.source === 'manual';

  return (
    <li className={`rounded-2xl p-3 md:p-4 app-surface-soft ${error ? 'ring-1 ring-red-400/60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <span className={`ios-badge ${isManual ? 'ios-badge-orange' : 'ios-badge-blue'}`}>{isManual ? 'Fora do estoque' : 'Estoque'}</span>
          {isManual ? (
            <ManualItemFields item={item} invalid={Boolean(error)} errorId={errorId} onUpdate={onUpdate} />
          ) : (
            <>
              <p className="mt-1.5 font-semibold app-text-primary">{item.name}</p>
              {item.details.length > 0 && <p className="text-sm app-text-muted">{item.details.join(' · ')}</p>}
            </>
          )}
        </div>
        <button type="button" aria-label={`Remover ${item.name || 'produto'}`} onClick={() => onRemove(item)}
          className="app-icon-button-muted grid h-11 w-11 shrink-0 place-items-center rounded-xl hover:text-red-600">
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-end gap-3 sm:grid-cols-[auto_minmax(0,180px)_minmax(0,1fr)]">
        <div>
          <span className="ios-label">Qtd.</span>
          <QuantityStepper label={`Quantidade de ${item.name || 'produto'}`} value={item.quantity} onChange={(quantity) => onUpdate(item.key, { quantity })} />
        </div>
        <div>
          <label htmlFor={`quote-price-${item.key}`} className="ios-label">Valor unitário à vista</label>
          <MoneyInput id={`quote-price-${item.key}`} value={item.unitPrice} invalid={Boolean(error) && item.unitPrice <= 0}
            describedBy={error ? errorId : undefined} onChange={(unitPrice) => onUpdate(item.key, { unitPrice })} />
        </div>
        <p className="col-span-2 text-right text-sm app-text-muted sm:col-span-1 sm:pb-3">
          Total <span className="font-semibold tabular-nums app-text-primary">{formatCurrencyBRL(itemLineTotal(item))}</span>
        </p>
      </div>
      {error && <p id={errorId} role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </li>
  );
};

interface ManualItemFieldsProps {
  item: QuoteItem;
  invalid: boolean;
  errorId: string;
  onUpdate: (key: string, patch: Partial<QuoteItem>) => void;
}

function ManualItemFields({ item, invalid, errorId, onUpdate }: ManualItemFieldsProps) {
  return (
    <div className="mt-2 grid gap-3">
      <div>
        <label htmlFor={`quote-name-${item.key}`} className="ios-label">Produto</label>
        <input id={`quote-name-${item.key}`} type="text" autoComplete="off" value={item.name} placeholder="Ex.: iPhone 16 Pro Max 256GB"
          aria-invalid={(invalid && !item.name.trim()) || undefined} aria-describedby={invalid ? errorId : undefined}
          onChange={(event) => onUpdate(item.key, { name: event.target.value })}
          className={`ios-input ${invalid && !item.name.trim() ? 'ios-input-error' : ''}`} />
      </div>
      <div>
        <label htmlFor={`quote-details-${item.key}`} className="ios-label">Detalhes <span className="font-normal app-text-muted">(opcional)</span></label>
        <input id={`quote-details-${item.key}`} type="text" autoComplete="off" value={item.details.join(', ')} placeholder="Cor, condição, garantia… separados por vírgula"
          onChange={(event) => onUpdate(item.key, { details: event.target.value.split(',').map((part) => part.trim()).filter(Boolean) })}
          className="ios-input" />
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm app-text-primary">
        <input type="checkbox" checked={item.madeToOrder} onChange={(event) => onUpdate(item.key, { madeToOrder: event.target.checked })}
          className="h-5 w-5 rounded accent-brand-600" />
        Sob encomenda <span className="app-text-muted">· não aparece no orçamento</span>
      </label>
      {item.madeToOrder && (
        <div>
          <label htmlFor={`quote-lead-${item.key}`} className="ios-label">Prazo de entrega <span className="font-normal app-text-muted">(opcional, aparece no orçamento)</span></label>
          <input id={`quote-lead-${item.key}`} type="text" autoComplete="off" value={item.leadTime ?? ''} placeholder="Ex.: até 7 dias úteis"
            onChange={(event) => onUpdate(item.key, { leadTime: event.target.value })} className="ios-input" />
        </div>
      )}
    </div>
  );
}
