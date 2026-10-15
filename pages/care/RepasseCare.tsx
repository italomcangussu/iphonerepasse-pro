import React, { lazy, Suspense, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CareLogo from '../../components/care/CareLogo';
import { useAuth } from '../../contexts/AuthContext';
import { CareLoading } from './CareStates';
import CareContractsTab from './tabs/CareContractsTab';
import ContractDetailModal from './contract/ContractDetailModal';

const CareDashboardTab = lazy(() => import('./tabs/CareDashboardTab'));
const CareServiceRequestsTab = lazy(() => import('./tabs/CareServiceRequestsTab'));
const CareRulesTab = lazy(() => import('./tabs/CareRulesTab'));
const CareSimulatorTab = lazy(() => import('./tabs/CareSimulatorTab'));

type TabKey = 'painel' | 'contratos' | 'acionamentos' | 'regras' | 'simulador';

const TABS: Array<{ key: TabKey; label: string; adminOnly: boolean }> = [
  { key: 'painel', label: 'Painel', adminOnly: true },
  { key: 'contratos', label: 'Contratos', adminOnly: false },
  { key: 'acionamentos', label: 'Acionamentos', adminOnly: false },
  { key: 'regras', label: 'Regras', adminOnly: true },
  { key: 'simulador', label: 'Simulador', adminOnly: false },
];

// Aba Repasse Care+: painel, contratos vigentes, acionamentos e toda a configuração comercial.
const RepasseCare: React.FC = () => {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const [params, setParams] = useSearchParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const tabs = TABS.filter((t) => isAdmin || !t.adminOnly);
  const requested = params.get('aba') as TabKey | null;
  const active = tabs.find((t) => t.key === requested)?.key ?? (isAdmin ? 'painel' : 'contratos');
  const contractId = params.get('contrato');

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <CareLogo className="h-12 w-auto" />
          <div>
            <h2 className="app-page-title">Repasse Care+</h2>
            <p className="app-page-subtitle">Assistência técnica continuada dos aparelhos vendidos</p>
          </div>
        </div>
      </div>
      <nav role="tablist" aria-label="Seções do Repasse Care+" className="flex gap-1 overflow-x-auto rounded-ios-lg app-surface-soft p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            onClick={() => update({ aba: t.key })}
            className={`min-h-[44px] flex-1 whitespace-nowrap rounded-ios px-4 text-sm font-semibold transition-colors ${active === t.key ? 'bg-white text-brand-600 shadow-ios dark:bg-surface-dark-200 dark:text-brand-300' : 'app-text-secondary'}`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <Suspense fallback={<CareLoading />}>
        <div role="tabpanel">
          {active === 'painel' && <CareDashboardTab />}
          {active === 'contratos' && <CareContractsTab refreshKey={refreshKey} onOpen={(id) => update({ contrato: id })} />}
          {active === 'acionamentos' && <CareServiceRequestsTab isAdmin={isAdmin} onOpenContract={(id) => update({ contrato: id })} />}
          {active === 'regras' && <CareRulesTab />}
          {active === 'simulador' && <CareSimulatorTab />}
        </div>
      </Suspense>
      {contractId && (
        <ContractDetailModal
          contractId={contractId}
          isAdmin={isAdmin}
          onClose={() => update({ contrato: null })}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
};

export default RepasseCare;
