import React, { useState } from 'react';
import Banner from '../ui/Banner';
import StoreTransferPanel from './StoreTransferPanel';
import StockTransferPanel from './StockTransferPanel';
import type { TransferTenant } from '../../services/tenants';

type TransferTab = 'stock' | 'store';

type TransferSectionProps = {
  catalog: TransferTenant[] | null;
  error: string | null;
  canCreate: boolean;
  onRetry: () => void;
  onTransferred: () => void;
};

const TABS: ReadonlyArray<[TransferTab, string]> = [
  ['stock', 'Aparelhos'],
  ['store', 'Loja inteira'],
];

function TransferBody({ catalog, canCreate, onTransferred }: { catalog: TransferTenant[]; canCreate: boolean; onTransferred: () => void }) {
  const [tab, setTab] = useState<TransferTab>('stock');

  if (catalog.length < 2) {
    return (
      <p className="rounded-ios-lg border border-gray-200 p-3 text-sm text-gray-600 dark:border-surface-dark-300 dark:text-surface-dark-500">
        Para transferir, você precisa administrar pelo menos duas empresas.
        {canCreate ? ' Crie uma em “Nova empresa”.' : ''}
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Tipo de transferência">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`ios-button-secondary min-h-[44px] ${tab === id ? 'border-brand-500 font-semibold text-brand-600 dark:text-brand-300' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'stock' ? (
        <StockTransferPanel catalog={catalog} onTransferred={onTransferred} />
      ) : (
        <StoreTransferPanel catalog={catalog} onTransferred={onTransferred} />
      )}
    </>
  );
}

export default function TransferSection({ catalog, error, canCreate, onRetry, onTransferred }: TransferSectionProps) {
  return (
    <section aria-labelledby="transfer-title" className="ios-card space-y-4 p-4 md:p-5">
      <div>
        <h3 id="transfer-title" className="text-ios-headline font-semibold text-gray-900 dark:text-white">Transferir</h3>
        <p className="mt-0.5 text-ios-caption text-gray-500 dark:text-surface-dark-500">
          Mova uma loja inteira para outra empresa, ou só alguns aparelhos entre lojas, em qualquer sentido.
        </p>
      </div>
      {error && <Banner kind="error" message={error} action={{ label: 'Tentar de novo', onClick: onRetry }} />}
      {!error && catalog === null && <p className="text-sm text-gray-500 dark:text-surface-dark-500">Carregando lojas…</p>}
      {catalog && <TransferBody catalog={catalog} canCreate={canCreate} onTransferred={onTransferred} />}
    </section>
  );
}
