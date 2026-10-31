import React from 'react';
import { Link } from 'react-router-dom';
import Pagination from '../../components/ui/Pagination';
import type { PayableDebt, PayableDebtStatus } from '../../types';
import { formatCurrencyBRL } from '../../utils/inputMasks';
import { getPayableDebtDeadlineBadge, getPayableDebtDueDate, isPayableDebtOverdue } from '../../utils/payableDebts';
import AccountSummaryCard from './AccountSummaryCard';

const PAGE_SIZE_PD = 15;

interface PayableDebtsTabProps {
  payableDebtSummary: { openAmount: number; overdueAmount: number; settledAmount: number };
  payableDebtRows: PayableDebt[];
  creditorById: Map<string, string>;
  pdSearchTerm: string;
  setPdSearchTerm: (value: string) => void;
  pdStatusFilter: PayableDebtStatus | 'all';
  setPdStatusFilter: (value: PayableDebtStatus | 'all') => void;
  pdOnlyOverdue: boolean;
  setPdOnlyOverdue: (value: boolean) => void;
  pdPage: number;
  setPdPage: (page: number) => void;
  isMobile: boolean;
}

const PayableDebtsTab: React.FC<PayableDebtsTabProps> = ({
  payableDebtSummary,
  payableDebtRows,
  creditorById,
  pdSearchTerm,
  setPdSearchTerm,
  pdStatusFilter,
  setPdStatusFilter,
  pdOnlyOverdue,
  setPdOnlyOverdue,
  pdPage,
  setPdPage,
  isMobile
}) => (
  <div className="space-y-5" data-testid="finance-tab-payable_debts">
    <div className="ios-card divide-y divide-gray-100 dark:divide-surface-dark-200 md:grid md:grid-cols-3 md:divide-y-0 md:divide-x">
      <AccountSummaryCard label="Total a Pagar" value={payableDebtSummary.openAmount} tone="out" />
      <AccountSummaryCard label="Vencidas" value={payableDebtSummary.overdueAmount} tone="out" />
      <AccountSummaryCard label="Quitadas (Histórico)" value={payableDebtSummary.settledAmount} tone="in" />
    </div>

    <div className="ios-card p-4 space-y-3">
      <div className="relative">
        <input
          type="search"
          aria-label="Buscar dívidas ativas"
          className="ios-input pl-4"
          placeholder="Buscar por credor ou observação..."
          value={pdSearchTerm}
          onChange={(e) => setPdSearchTerm(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <select aria-label="Status da dívida" className="ios-input w-auto" value={pdStatusFilter} onChange={(e) => setPdStatusFilter(e.target.value as PayableDebtStatus | 'all')}>
          <option value="all">Todos os status</option>
          <option value="Aberta">Aberta</option>
          <option value="Parcial">Parcial</option>
          <option value="Quitada">Quitada</option>
        </select>
        <label className="flex min-h-11 items-center gap-2 text-ios-subhead text-gray-700 dark:text-surface-dark-700">
          <input type="checkbox" className="h-5 w-5" checked={pdOnlyOverdue} onChange={(e) => setPdOnlyOverdue(e.target.checked)} />
          Apenas vencidas
        </label>
      </div>
    </div>

    <div className="ios-card overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-surface-dark-200 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white">Dívidas Ativas</h3>
          <p className="text-xs text-gray-500 dark:text-surface-dark-500">Somente leitura. Gerencie na tela dedicada.</p>
        </div>
        <Link to="/payable-debts" className="ios-button-secondary shrink-0 whitespace-nowrap">
          Gerenciar
        </Link>
      </div>
      {(() => {
        const pdTotalPages = Math.ceil(payableDebtRows.length / PAGE_SIZE_PD);
        const pdPaginated = payableDebtRows.slice(pdPage * PAGE_SIZE_PD, (pdPage + 1) * PAGE_SIZE_PD);
        return isMobile ? (
          <div>
            <div className="p-4 space-y-3">
              {pdPaginated.map((debt) => (
                <div key={debt.id} className={`ios-card p-4 space-y-2 ${isPayableDebtOverdue(debt) ? 'bg-red-50/40 dark:bg-red-900/10' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {creditorById.get(debt.creditorId) || debt.creditorName}
                    </p>
                    <p className={`shrink-0 whitespace-nowrap font-semibold tabular-nums ${debt.remainingAmount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-surface-dark-500'}`}>{formatCurrencyBRL(debt.remainingAmount)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`ios-badge ${debt.status === 'Quitada' ? 'ios-badge-green' : debt.status === 'Parcial' ? 'ios-badge-blue' : 'ios-badge-orange'}`}>{debt.status}</span>
                    <span className={`ios-badge ${getPayableDebtDeadlineBadge(debt) === 'Atrasado' ? 'ios-badge-red' : getPayableDebtDeadlineBadge(debt) === 'Em dias' ? 'ios-badge-green' : 'ios-badge-blue'}`}>
                      {getPayableDebtDeadlineBadge(debt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-surface-dark-500">1º Venc.: {debt.firstDueDate || debt.dueDate ? new Date(`${(debt.firstDueDate || debt.dueDate) as string}T00:00:00`).toLocaleDateString('pt-BR') : '-'}</p>
                </div>
              ))}
              {payableDebtRows.length === 0 && (
                <div className="p-6 text-center text-gray-500 dark:text-surface-dark-500">Nenhuma dívida ativa cadastrada.</div>
              )}
            </div>
            <Pagination page={pdPage} totalPages={pdTotalPages} totalItems={payableDebtRows.length} pageSize={PAGE_SIZE_PD} onPageChange={setPdPage} />
          </div>
        ) : (
          <div>
            <table className="w-full table-fixed text-left">
              <colgroup>
                <col className="w-[30%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[18%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
              </colgroup>
              <thead className="bg-gray-50 dark:bg-surface-dark-200 text-xs uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Credor</th>
                  <th className="px-4 py-3 font-semibold">Situação</th>
                  <th className="px-4 py-3 font-semibold">Prazo</th>
                  <th className="px-4 py-3 text-right font-semibold">Valor Orig.</th>
                  <th className="px-4 py-3 text-right font-semibold">Saldo</th>
                  <th className="px-4 py-3 font-semibold">1º Venc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-300">
                {pdPaginated.map((debt) => (
                  <tr key={debt.id} className={isPayableDebtOverdue(debt) ? 'bg-red-50/40 dark:bg-red-900/10' : ''}>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{creditorById.get(debt.creditorId) || debt.creditorName}</td>
                    <td className="px-4 py-3">
                      <span className={`ios-badge ${debt.status === 'Quitada' ? 'ios-badge-green' : debt.status === 'Parcial' ? 'ios-badge-blue' : 'ios-badge-orange'}`}>{debt.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`ios-badge ${getPayableDebtDeadlineBadge(debt) === 'Atrasado' ? 'ios-badge-red' : getPayableDebtDeadlineBadge(debt) === 'Em dias' ? 'ios-badge-green' : 'ios-badge-blue'}`}>
                        {getPayableDebtDeadlineBadge(debt)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-700 dark:text-surface-dark-700">{formatCurrencyBRL(debt.originalAmount)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600 dark:text-red-400">{formatCurrencyBRL(debt.remainingAmount)}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-surface-dark-700">
                      {debt.firstDueDate || debt.dueDate ? new Date(`${(getPayableDebtDueDate(debt)) as string}T00:00:00`).toLocaleDateString('pt-BR') : '-'}
                    </td>
                  </tr>
                ))}
                {payableDebtRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-surface-dark-500">Nenhuma dívida ativa cadastrada.</td>
                  </tr>
                )}
              </tbody>
            </table>
            <Pagination page={pdPage} totalPages={pdTotalPages} totalItems={payableDebtRows.length} pageSize={PAGE_SIZE_PD} onPageChange={setPdPage} />
          </div>
        );
      })()}
    </div>
  </div>
);

export default PayableDebtsTab;
