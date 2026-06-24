import React, { useState } from 'react';
import { useSalesHistoryDemand } from '../hooks/useDataGroupDemand';
import OpportunitiesTab from '../components/marketing/OpportunitiesTab';
import AudienceTab from '../components/marketing/AudienceTab';

type MarketingTab = 'opportunities' | 'audience';
type PeriodOption = { id: string; label: string; days: number | null };

const PERIOD_OPTIONS: PeriodOption[] = [
  { id: '30', label: '30 dias', days: 30 },
  { id: '90', label: '90 dias', days: 90 },
  { id: '180', label: '180 dias', days: 180 },
  { id: 'all', label: 'Tudo', days: null },
];

const Marketing: React.FC = () => {
  const salesHistoryLoading = useSalesHistoryDemand();
  const [activeTab, setActiveTab] = useState<MarketingTab>('opportunities');
  const [periodId, setPeriodId] = useState<string>('90');

  const periodDays = PERIOD_OPTIONS.find((p) => p.id === periodId)?.days ?? null;

  return (
    <div className="space-y-4 md:space-y-6">
      <section className="ios-card p-4 md:p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Relacionamento</p>
        <h1 className="text-ios-title-1 font-bold text-gray-900 dark:text-white mt-1">Marketing</h1>
        <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-1">
          Estatísticas, oportunidades e audiências para planejar campanhas e compras.
        </p>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="ios-segmented-control grid grid-cols-2 sm:inline-flex">
          {[
            { id: 'opportunities', label: 'Oportunidades' },
            { id: 'audience', label: 'Audiência' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as MarketingTab)}
              data-testid={`marketing-tab-${tab.id}`}
              className={`ios-segment min-w-0 px-3 text-center whitespace-nowrap ${activeTab === tab.id ? 'ios-segment-active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'opportunities' && (
          <div className="ios-segmented-control grid grid-cols-4 sm:inline-flex">
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriodId(p.id)}
                data-testid={`marketing-period-${p.id}`}
                className={`ios-segment min-w-0 px-2 text-center text-ios-footnote whitespace-nowrap ${periodId === p.id ? 'ios-segment-active' : ''}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {salesHistoryLoading && (
        <p role="status" className="text-ios-subhead app-text-muted">
          Carregando histórico de vendas...
        </p>
      )}

      {activeTab === 'opportunities' ? <OpportunitiesTab periodDays={periodDays} /> : <AudienceTab />}
    </div>
  );
};

export default Marketing;
