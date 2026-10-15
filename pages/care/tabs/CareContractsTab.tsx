import React, { useMemo, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { listCareContracts } from '../../../services/careApi';
import { useCareQuery } from '../useCareQuery';
import { CareEmpty, CareLoadError, CareLoading } from '../CareStates';
import CareStatusBadge from '../../../components/care/CareStatusBadge';
import { CARE_CONTRACT_STATUS, conditionLabel } from '../../../lib/care/careLabels';
import type { CareContract, CareContractStatus } from '../../../lib/care/careTypes';
import { formatCurrencyBRL, formatDateTimeBRL } from '../../../utils/inputMasks';

type StatusFilter = 'vigentes' | 'pendentes' | 'todos' | CareContractStatus;

const FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'vigentes', label: 'Vigentes' },
  { key: 'pendentes', label: 'Pendentes' },
  { key: 'cancelado', label: 'Cancelados' },
  { key: 'todos', label: 'Todos' },
];

const GROUPS: Partial<Record<StatusFilter, CareContractStatus[]>> = {
  vigentes: ['ativo', 'suspenso'],
  pendentes: ['rascunho', 'aguardando_assinatura', 'assinado_aguardando_primeiro_pagamento'],
};

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filterContracts(contracts: CareContract[], filter: StatusFilter, search: string): CareContract[] {
  const allowed = GROUPS[filter] ?? (filter === 'todos' ? null : [filter as CareContractStatus]);
  const term = normalize(search.trim());
  return contracts.filter((c) => {
    if (allowed && !allowed.includes(c.status)) return false;
    if (!term) return true;
    const haystack = normalize(`${c.contract_number} ${c.customer_name} ${c.device_model} ${c.device_imei ?? ''} ${c.customer_phone}`);
    return haystack.includes(term);
  });
}

const ContractRow: React.FC<{ contract: CareContract; onOpen: (id: string) => void }> = ({ contract, onOpen }) => {
  const status = CARE_CONTRACT_STATUS[contract.status];
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(contract.id)}
        className="flex w-full min-h-[64px] items-center gap-3 px-4 py-3 text-left app-surface-soft-hover"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs app-text-muted">nº {contract.contract_number}</span>
            <CareStatusBadge tone={status.tone} label={status.label} />
          </div>
          <p className="mt-1 truncate text-sm font-semibold app-text-primary">{contract.customer_name}</p>
          <p className="truncate text-xs app-text-muted">
            {contract.device_model} · {conditionLabel(contract.condition)} · criado {formatDateTimeBRL(contract.created_at)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold tabular-nums app-text-primary">{formatCurrencyBRL(contract.total_programmed)}</p>
          <p className="text-xs app-text-muted">1 + {contract.subsequent_count}×</p>
        </div>
        <ChevronRight size={18} className="app-text-muted shrink-0" aria-hidden />
      </button>
    </li>
  );
};

const CareContractsTab: React.FC<{ onOpen: (id: string) => void; refreshKey: number }> = ({ onOpen, refreshKey }) => {
  const query = useCareQuery(listCareContracts, [refreshKey]);
  const [filter, setFilter] = useState<StatusFilter>('vigentes');
  const [search, setSearch] = useState('');
  const visible = useMemo(() => filterContracts(query.data ?? [], filter, search), [query.data, filter, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="app-search-wrap relative md:w-96">
          <Search size={18} className="app-search-icon absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cliente, modelo, nº do contrato ou IMEI"
            aria-label="Buscar contratos"
            className="ios-input w-full pl-10"
          />
        </div>
        <div role="radiogroup" aria-label="Situação" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="radio"
              aria-checked={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`min-h-[44px] rounded-full px-4 text-sm font-semibold ${filter === f.key ? 'bg-brand-500 text-white' : 'app-surface-soft app-text-secondary'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {query.loading && !query.data && <CareLoading />}
      {query.error && <CareLoadError message={query.error} onRetry={query.reload} />}
      {query.data && visible.length === 0 && (
        <CareEmpty
          title={search ? 'Nada encontrado' : 'Nenhum contrato nesta situação'}
          message={search ? 'Confira o nome, o modelo ou o número do contrato.' : 'Contratos nascem no fim da venda ou no histórico de vendas, pelo botão Repasse Care+.'}
        />
      )}
      {visible.length > 0 && (
        <ul className="ios-card overflow-hidden divide-y divide-gray-100 dark:divide-surface-dark-200">
          {visible.map((c) => <ContractRow key={c.id} contract={c} onOpen={onOpen} />)}
        </ul>
      )}
    </div>
  );
};

export default CareContractsTab;
