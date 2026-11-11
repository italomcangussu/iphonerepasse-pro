import React from 'react';
import { Link } from 'react-router-dom';
import Pagination from '../../components/ui/Pagination';
import type { PayableDebt, PayableDebtStatus } from '../../types';
import { formatCurrencyBRL, formatDateTimeBRL } from '../../utils/inputMasks';
import AccountSummaryCard from './AccountSummaryCard';
import { debtStatusBadgeClass } from './financeHelpers';

const PAGE_SIZE_PD = 15;
const EMPTY_MESSAGE = 'Nenhuma conta a pagar cadastrada.';

interface PayableDebtRowProps {
  debt: PayableDebt;
  creditorName: string;
}

const PayableDebtCard: React.FC<PayableDebtRowProps> = ({ debt, creditorName }) => {
  return (
    <div className="ios-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-gray-900 dark:text-white">{creditorName}</p>
        <div className="shrink-0 text-right">
          <p className={`whitespace-nowrap font-semibold tabular-nums ${debt.remainingAmount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-surface-dark-500'}`}>
            {formatCurrencyBRL(debt.remainingAmount)}
          </p>
          <p className="whitespace-nowrap text-ios-caption tabular-nums text-gray-500 dark:text-surface-dark-500">de {formatCurrencyBRL(debt.originalAmount)}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className={`ios-badge ${debtStatusBadgeClass(debt.status)}`}>{debt.status}</span>
      </div>
      <div className="text-sm text-gray-500 dark:text-surface-dark-500 space-y-1">
        <p className="tabular-nums">Criada em {formatDateTimeBRL(debt.createdAt)}</p>
      </div>
    </div>
  );
};

const PayableDebtTableRow: React.FC<PayableDebtRowProps> = ({ debt, creditorName }) => {
  return (
    <tr>
      <td className="px-4 py-3">
        <span className="block font-medium text-gray-900 dark:text-white">{creditorName}</span>
        <span className="block text-xs tabular-nums text-gray-500 dark:text-surface-dark-500">Criada em {formatDateTimeBRL(debt.createdAt)}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`ios-badge ${debtStatusBadgeClass(debt.status)}`}>{debt.status}</span>
      </td>
      <td className="px-4 py-3 text-right font-medium text-gray-700 dark:text-surface-dark-700">{formatCurrencyBRL(debt.originalAmount)}</td>
      <td className="px-4 py-3 text-right font-semibold text-red-600 dark:text-red-400">{formatCurrencyBRL(debt.remainingAmount)}</td>
    </tr>
  );
};

const PayableDebtTable: React.FC<{ children: React.ReactNode; isEmpty: boolean }> = ({ children, isEmpty }) => (
  <table className="w-full table-fixed text-left">
    <colgroup>
      <col className="w-[40%]" />
      <col className="w-[18%]" />
      <col className="w-[21%]" />
      <col className="w-[21%]" />
    </colgroup>
    <thead className="bg-gray-50 dark:bg-surface-dark-200 text-xs uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">
      <tr>
        <th className="px-4 py-3 font-semibold">Credor</th>
        <th className="px-4 py-3 font-semibold">Situação</th>
        <th className="px-4 py-3 text-right font-semibold">Valor Orig.</th>
        <th className="px-4 py-3 text-right font-semibold">Saldo</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-300">
      {children}
      {isEmpty && (
        <tr>
          <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-surface-dark-500">{EMPTY_MESSAGE}</td>
        </tr>
      )}
    </tbody>
  </table>
);

interface PayableDebtFiltersProps {
  pdSearchTerm: string;
  setPdSearchTerm: (value: string) => void;
  pdStatusFilter: PayableDebtStatus | 'all';
  setPdStatusFilter: (value: PayableDebtStatus | 'all') => void;
}

const PayableDebtFilters: React.FC<PayableDebtFiltersProps> = ({
  pdSearchTerm,
  setPdSearchTerm,
  pdStatusFilter,
  setPdStatusFilter
}) => (
  <div className="ios-card p-4 space-y-3">
    <div className="relative">
      <input
        type="search"
        aria-label="Buscar contas a pagar"
        className="ios-input pl-4"
        placeholder="Buscar por credor ou observação..."
        value={pdSearchTerm}
        onChange={(e) => setPdSearchTerm(e.target.value)}
      />
    </div>
    <div className="flex flex-wrap gap-3">
      <select
        aria-label="Status da dívida"
        className="ios-input w-auto"
        value={pdStatusFilter}
        onChange={(e) => setPdStatusFilter(e.target.value as PayableDebtStatus | 'all')}
      >
        <option value="all">Todos os status</option>
        <option value="Aberta">Aberta</option>
        <option value="Parcial">Parcial</option>
        <option value="Quitada">Quitada</option>
      </select>
    </div>
  </div>
);

interface PayableDebtsTabProps extends PayableDebtFiltersProps {
  payableDebtSummary: { openAmount: number; settledAmount: number };
  payableDebtRows: PayableDebt[];
  creditorById: Map<string, string>;
  pdPage: number;
  setPdPage: (page: number) => void;
  isMobile: boolean;
}

const PayableDebtsTab: React.FC<PayableDebtsTabProps> = ({
  payableDebtSummary,
  payableDebtRows,
  creditorById,
  pdPage,
  setPdPage,
  isMobile,
  ...filters
}) => {
  const totalPages = Math.ceil(payableDebtRows.length / PAGE_SIZE_PD);
  const pageRows = payableDebtRows.slice(pdPage * PAGE_SIZE_PD, (pdPage + 1) * PAGE_SIZE_PD);
  const creditorName = (debt: PayableDebt) => creditorById.get(debt.creditorId) || debt.creditorName;

  return (
    <div className="space-y-5" data-testid="finance-tab-payable_debts">
      <div className="ios-card divide-y divide-gray-100 dark:divide-surface-dark-200 md:grid md:grid-cols-2 md:divide-y-0 md:divide-x">
        <AccountSummaryCard label="Total a Pagar" value={payableDebtSummary.openAmount} tone="out" />
        <AccountSummaryCard label="Quitadas (Histórico)" value={payableDebtSummary.settledAmount} tone="in" />
      </div>

      <PayableDebtFilters {...filters} />

      <div className="ios-card overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-surface-dark-200 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white">Contas a pagar</h3>
            <p className="text-xs text-gray-500 dark:text-surface-dark-500">Somente leitura. Gerencie na tela dedicada.</p>
          </div>
          <Link to="/payable-debts" className="ios-button-secondary shrink-0 whitespace-nowrap">
            Gerenciar
          </Link>
        </div>
        {isMobile ? (
          <div className="p-4 space-y-3">
            {pageRows.map((debt) => (
              <PayableDebtCard key={debt.id} debt={debt} creditorName={creditorName(debt)} />
            ))}
            {payableDebtRows.length === 0 && <div className="p-6 text-center text-gray-500 dark:text-surface-dark-500">{EMPTY_MESSAGE}</div>}
          </div>
        ) : (
          <PayableDebtTable isEmpty={payableDebtRows.length === 0}>
            {pageRows.map((debt) => (
              <PayableDebtTableRow key={debt.id} debt={debt} creditorName={creditorName(debt)} />
            ))}
          </PayableDebtTable>
        )}
        <Pagination page={pdPage} totalPages={totalPages} totalItems={payableDebtRows.length} pageSize={PAGE_SIZE_PD} onPageChange={setPdPage} />
      </div>
    </div>
  );
};

export default PayableDebtsTab;
