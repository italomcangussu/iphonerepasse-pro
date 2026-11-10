import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import IOSButton from '../ui/IOSButton';
import { useToast } from '../ui/ToastProvider';
import { useAsyncHandler } from '../../hooks/useAsyncHandler';
import { findStore, stockTransferTargets, storeLabel, transferButtonLabel, type StoreOption } from '../../lib/companies';
import { transferStockItems, type TransferTenant } from '../../services/tenants';
import ItemsChecklist from './ItemsChecklist';
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

  // Lista nova (outra loja ou recarga) começa sem seleção.
  useEffect(() => {
    setSelected(new Set());
  }, [state]);

  const chooseOrigin = (nextOriginId: string) => {
    setOriginId(nextOriginId);
    if (nextOriginId === targetId) setTargetId('');
  };

  const toggleAll = () => setSelected(selected.size === items.length ? new Set() : new Set(items.map((item) => item.id)));

  const handleTransfer = async () => {
    if (!target || selected.size === 0) return;
    await run(
      async () => {
        const result = await transferStockItems([...selected], target.storeId);
        toast.success(`${result.moved} ${result.moved === 1 ? 'aparelho foi' : 'aparelhos foram'} para ${storeLabel(target, showTenant)}.`);
        reload();
        onTransferred();
      },
      { setLoading: setIsMoving },
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={LABEL_CLASS}>De</span>
          <select value={originId} onChange={(event) => chooseOrigin(event.target.value)} className={SELECT_CLASS}>
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
          <select value={targetId} onChange={(event) => setTargetId(event.target.value)} disabled={!origin} className={SELECT_CLASS}>
            <option value="">{origin ? 'Loja de destino' : 'Escolha a origem primeiro'}</option>
            {targets.map((store) => (
              <option key={store.storeId} value={store.storeId}>
                {storeLabel(store, showTenant)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ItemsStatus state={state} originName={origin?.storeName ?? ''} onRetry={reload} />
      {items.length > 0 && (
        <ItemsChecklist items={items} selected={selected} onToggle={(id) => setSelected((current) => toggled(current, id))} onToggleAll={toggleAll} />
      )}

      <IOSButton
        type="button"
        variant="primary"
        disabled={selected.size === 0 || !target}
        loading={isMoving}
        onClick={() => void handleTransfer()}
        leftIcon={<ArrowRightLeft size={18} />}
        className="w-full min-h-12 sm:w-auto"
      >
        {transferButtonLabel(selected.size, target)}
      </IOSButton>
      {crossesCompanies(origin, target) && (
        <p className="text-ios-caption text-gray-500 dark:text-surface-dark-500">
          Os aparelhos mudam de empresa junto com os custos. Para trazer de volta, faça o caminho inverso.
        </p>
      )}
    </div>
  );
}
