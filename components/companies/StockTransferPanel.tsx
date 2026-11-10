import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import IOSButton from '../ui/IOSButton';
import { useToast } from '../ui/ToastProvider';
import { useAsyncHandler } from '../../hooks/useAsyncHandler';
import { findStore, stockTransferTargets, storeLabel, transferButtonLabel, type StoreOption } from '../../lib/companies';
import { saleButtonLabel, saleToast } from '../../lib/stockSale';
import { transferStockItems, type TransferTenant } from '../../services/tenants';
import ItemsChecklist from './ItemsChecklist';
import SaleOptions from './SaleOptions';
import { useStockSale, type StockSaleState } from './useStockSale';
import { useTransferableStock, type ItemsState } from './useTransferableStock';

type StockTransferPanelProps = {
  catalog: TransferTenant[];
  onTransferred: () => void;
};

const SELECT_CLASS = 'ios-input mt-1 min-h-12 w-full text-base disabled:opacity-55';
const LABEL_CLASS = 'block text-ios-subhead font-semibold text-gray-900 dark:text-white';

function ItemsStatus({ state, originName, onRetry }: { state: ItemsState; originName: string; onRetry: () => void }) {
  if (state.status === 'loading') return <p className="text-sm text-gray-500 dark:text-surface-dark-500">Carregando aparelhos…</p>;
  if (state.status === 'error') {
    return (
      <p className="text-sm text-red-600 dark:text-red-300">
        {state.message}{' '}
        <button type="button" className="min-h-11 font-semibold underline" onClick={onRetry}>
          Tentar de novo
        </button>
      </p>
    );
  }
  if (state.status === 'ready' && state.items.length === 0) {
    return (
      <p className="rounded-ios-lg border border-gray-200 p-3 text-sm text-gray-600 dark:border-surface-dark-300 dark:text-surface-dark-500">
        Nenhum aparelho disponível em {originName}. Só aparelhos disponíveis e sem reserva podem mudar de loja.
      </p>
    );
  }
  return null;
}

const toggled = (current: Set<string>, itemId: string) => {
  const next = new Set(current);
  if (next.has(itemId)) next.delete(itemId);
  else next.add(itemId);
  return next;
};

const crossesCompanies = (origin: StoreOption | null, target: StoreOption | null) =>
  Boolean(origin && target && origin.tenantId !== target.tenantId);

const movedToast = (moved: number, targetName: string) =>
  `${moved} ${moved === 1 ? 'aparelho foi' : 'aparelhos foram'} para ${targetName}.`;

type StorePickersProps = {
  catalog: TransferTenant[];
  originId: string;
  targetId: string;
  targets: StoreOption[];
  showTenant: boolean;
  onOrigin: (storeId: string) => void;
  onTarget: (storeId: string) => void;
};

const StorePickers: React.FC<StorePickersProps> = ({ catalog, originId, targetId, targets, showTenant, onOrigin, onTarget }) => (
  <div className="grid gap-3 sm:grid-cols-2">
    <label className="block">
      <span className={LABEL_CLASS}>De</span>
      <select value={originId} onChange={(event) => onOrigin(event.target.value)} className={SELECT_CLASS}>
        <option value="">Loja de origem</option>
        {catalog.map((tenant) => (
          <optgroup key={tenant.id} label={tenant.name}>
            {tenant.stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name} ({store.transferableCount})
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
    <label className="block">
      <span className={LABEL_CLASS}>Para</span>
      <select value={targetId} onChange={(event) => onTarget(event.target.value)} disabled={!originId} className={SELECT_CLASS}>
        <option value="">{originId ? 'Loja de destino' : 'Escolha a origem primeiro'}</option>
        {targets.map((store) => (
          <option key={store.storeId} value={store.storeId}>
            {storeLabel(store, showTenant)}
          </option>
        ))}
      </select>
    </label>
  </div>
);

const actionLabel = (count: number, target: StoreOption | null, sale: StockSaleState) =>
  sale.isSale && count > 0 && target ? saleButtonLabel(count, target.tenantName, sale.total) : transferButtonLabel(count, target);

type TransferActionProps = { count: number; target: StoreOption | null; sale: StockSaleState; loading: boolean; onConfirm: () => void };

const TransferAction: React.FC<TransferActionProps> = ({ count, target, sale, loading, onConfirm }) => (
  <>
    <IOSButton
      type="button"
      variant="primary"
      disabled={count === 0 || !target || sale.missingPrice}
      loading={loading}
      onClick={onConfirm}
      leftIcon={<ArrowRightLeft size={18} />}
      className="w-full min-h-12 sm:w-auto"
    >
      {actionLabel(count, target, sale)}
    </IOSButton>
    {sale.missingPrice && <p className="text-ios-caption text-red-600 dark:text-red-300">Informe o valor de cada aparelho (pode ser R$ 0,00).</p>}
  </>
);

export default function StockTransferPanel({ catalog, onTransferred }: StockTransferPanelProps) {
  const toast = useToast();
  const run = useAsyncHandler();
  const [originId, setOriginId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isMoving, setIsMoving] = useState(false);
  const { state, items, reload } = useTransferableStock(originId);

  const showTenant = catalog.length > 1;
  const origin = findStore(catalog, originId);
  const targets = useMemo(() => stockTransferTargets(catalog, originId), [catalog, originId]);
  const target = targets.find((store) => store.storeId === targetId) ?? null;
  const sale = useStockSale({ items: items.filter((item) => selected.has(item.id)), canSell: crossesCompanies(origin, target) });
  const { resetPrices } = sale;

  // Lista nova (outra loja ou recarga) começa sem seleção e com os valores no custo.
  useEffect(() => {
    setSelected(new Set());
    resetPrices();
  }, [state, resetPrices]);

  const chooseOrigin = (nextOriginId: string) => {
    setOriginId(nextOriginId);
    if (nextOriginId === targetId) setTargetId('');
  };

  const toggleAll = () => setSelected(selected.size === items.length ? new Set() : new Set(items.map((item) => item.id)));

  const handleTransfer = async () => {
    if (!target || selected.size === 0) return;
    const { request, total } = sale;
    await run(
      async () => {
        const result = await transferStockItems([...selected], target.storeId, request);
        const targetName = storeLabel(target, showTenant);
        toast.success(request ? saleToast(result.moved, targetName, result.saleTotal ?? total) : movedToast(result.moved, targetName));
        reload();
        onTransferred();
      },
      { setLoading: setIsMoving },
    );
  };

  return (
    <div className="space-y-4">
      <StorePickers
        catalog={catalog}
        originId={originId}
        targetId={targetId}
        targets={targets}
        showTenant={showTenant}
        onOrigin={chooseOrigin}
        onTarget={setTargetId}
      />

      <ItemsStatus state={state} originName={origin?.storeName ?? ''} onRetry={reload} />
      {items.length > 0 && (
        <ItemsChecklist items={items} selected={selected} onToggle={(id) => setSelected((current) => toggled(current, id))} onToggleAll={toggleAll} />
      )}

      {origin && target && origin.tenantId !== target.tenantId && (
        <SaleOptions sale={sale} originName={origin.tenantName} targetName={target.tenantName} />
      )}

      <TransferAction count={selected.size} target={target} sale={sale} loading={isMoving} onConfirm={() => void handleTransfer()} />
    </div>
  );
}
