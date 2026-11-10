import React, { useMemo, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import IOSButton from '../ui/IOSButton';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToast } from '../ui/ToastProvider';
import { useAsyncHandler } from '../../hooks/useAsyncHandler';
import { describeStoreTransfer, findStore, storeTransferTargets } from '../../lib/companies';
import { transferStoreToTenant, type TransferTenant } from '../../services/tenants';

type StoreTransferPanelProps = {
  catalog: TransferTenant[];
  onTransferred: () => void;
};

export default function StoreTransferPanel({ catalog, onTransferred }: StoreTransferPanelProps) {
  const toast = useToast();
  const run = useAsyncHandler();
  const [storeId, setStoreId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  const store = findStore(catalog, storeId);
  const targets = useMemo(() => storeTransferTargets(catalog, storeId), [catalog, storeId]);
  const target = targets.find((tenant) => tenant.id === targetId) ?? null;
  const summary = store && target ? describeStoreTransfer(store, target.name) : null;

  const chooseStore = (nextStoreId: string) => {
    setStoreId(nextStoreId);
    setTargetId('');
  };

  const handleConfirm = async () => {
    setConfirming(false);
    if (!store || !target) return;
    await run(
      async () => {
        const result = await transferStoreToTenant(store.storeId, target.id);
        toast.success(`${store.storeName} agora é da ${target.name} (${result.movedItems} aparelhos foram junto).`);
        setStoreId('');
        setTargetId('');
        onTransferred();
      },
      { setLoading: setIsMoving },
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="block text-ios-subhead font-semibold text-gray-900 dark:text-white">Loja</span>
          <select value={storeId} onChange={(event) => chooseStore(event.target.value)} className="ios-input mt-1 min-h-12 w-full text-base">
            <option value="">Escolha a loja</option>
            {catalog.map((tenant) => (
              <optgroup key={tenant.id} label={tenant.name}>
                {tenant.stores.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-ios-subhead font-semibold text-gray-900 dark:text-white">Para a empresa</span>
          <select
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
            disabled={!store}
            className="ios-input mt-1 min-h-12 w-full text-base disabled:opacity-55"
          >
            <option value="">{store ? 'Escolha a empresa' : 'Escolha a loja primeiro'}</option>
            {targets.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {summary && (
        <ul className="space-y-1 rounded-ios-lg border border-brand-200 bg-brand-50 p-3 text-sm text-gray-800 dark:border-brand-800/50 dark:bg-brand-900/20 dark:text-gray-100">
          {summary.map((line) => (
            <li key={line}>{line}</li>
          ))}
          <li className="text-gray-600 dark:text-surface-dark-500">Loja com aparelho reservado não pode sair: finalize ou cancele a reserva antes.</li>
        </ul>
      )}

      <IOSButton
        type="button"
        variant="primary"
        disabled={!summary}
        loading={isMoving}
        onClick={() => setConfirming(true)}
        leftIcon={<ArrowRightLeft size={18} />}
        className="w-full min-h-12 sm:w-auto"
      >
        {store && target ? `Transferir ${store.storeName} para ${target.name}` : 'Escolha a loja e a empresa'}
      </IOSButton>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Transferir a loja?"
        description={
          store && target
            ? `${store.storeName} sai da ${store.tenantName} e vai para a ${target.name}. Para desfazer, transfira de volta.`
            : undefined
        }
        confirmLabel="Transferir"
        variant="warning"
        onConfirm={() => void handleConfirm()}
      />
    </div>
  );
}
