import React from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import Pagination from '../../components/ui/Pagination';
import type { Debt } from '../../types';
import { isDebtOverdue } from '../../utils/debts';
import { formatCurrencyBRL } from '../../utils/inputMasks';
import AccountSummaryCard from './AccountSummaryCard';

const PAGE_SIZE_DEBTS = 15;

interface DebtorsTabProps {
  debtSummary: { openAmount: number; overdueAmount: number; settledAmount: number };
  debtRows: Debt[];
  customerById: Map<string, string>;
  debtorsPage: number;
  setDebtorsPage: (page: number) => void;
  isMobile: boolean;
  canDeleteDebt: boolean;
  handleDeleteDebt: (debtId: string) => Promise<void>;
}

const DebtorsTab: React.FC<DebtorsTabProps> = ({
  debtSummary,
  debtRows,
  customerById,
  debtorsPage,
  setDebtorsPage,
  isMobile,
  canDeleteDebt,
  handleDeleteDebt
}) => (
  <div className="space-y-4">
    <div className="ios-card divide-y divide-gray-100 dark:divide-surface-dark-200 md:grid md:grid-cols-3 md:divide-y-0 md:divide-x">
      <AccountSummaryCard label="Em Aberto" value={debtSummary.openAmount} tone="neutral" />
      <AccountSummaryCard label="Vencidas" value={debtSummary.overdueAmount} tone="out" />
      <AccountSummaryCard label="Quitadas" value={debtSummary.settledAmount} tone="in" />
    </div>

    <div className="ios-card overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-surface-dark-200 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white">Devedores</h3>
          <p className="text-xs text-gray-500 dark:text-surface-dark-500">Resumo integrado do módulo de recebíveis.</p>
        </div>
        <Link to="/debtors" className="ios-button-secondary shrink-0 whitespace-nowrap">
          Gerenciar
        </Link>
      </div>
      {(() => {
        const debtTotalPages = Math.ceil(debtRows.length / PAGE_SIZE_DEBTS);
        const debtPaginated = debtRows.slice(debtorsPage * PAGE_SIZE_DEBTS, (debtorsPage + 1) * PAGE_SIZE_DEBTS);
        return isMobile ? (
          <div>
            <div className="p-4 space-y-3">
              {debtPaginated.map((debt) => (
                <div key={debt.id} className={`ios-card p-4 space-y-2 ${isDebtOverdue(debt) ? 'bg-red-50/40 dark:bg-red-900/10' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {customerById.get(debt.customerId) || 'Cliente removido'}
                    </p>
                    <p className={`shrink-0 whitespace-nowrap font-semibold tabular-nums ${debt.remainingAmount > 0 ? 'text-brand-500' : 'text-gray-500 dark:text-surface-dark-500'}`}>{formatCurrencyBRL(debt.remainingAmount)}</p>
                  </div>
                  <span
                    className={`ios-badge ${
                      debt.status === 'Quitada' ? 'ios-badge-green' : debt.status === 'Parcial' ? 'ios-badge-blue' : 'ios-badge-orange'
                    }`}
                  >
                    {debt.status}
                  </span>
                  <div className="text-sm text-gray-700 dark:text-surface-dark-700 space-y-1">
                    <p>Parcelas: {debt.installmentsTotal || 1}x</p>
                    <p>
                      1º Vencimento:{' '}
                      {debt.firstDueDate || debt.dueDate
                        ? new Date(`${(debt.firstDueDate || debt.dueDate) as string}T00:00:00`).toLocaleDateString('pt-BR')
                        : '-'}
                    </p>
                  </div>
                  <div className="flex justify-end">
                    {canDeleteDebt && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteDebt(debt.id)}
                      className="ios-button-destructive inline-flex items-center gap-2 text-xs px-3 py-2"
                      aria-label={`Excluir dívida de ${customerById.get(debt.customerId) || 'Cliente removido'}`}
                    >
                      <Trash2 size={14} />
                      Excluir
                    </button>
                    )}
                  </div>
                </div>
              ))}
              {debtRows.length === 0 && (
                <div className="p-6 text-center text-gray-500 dark:text-surface-dark-500">
                  Nenhum devedor cadastrado.
                </div>
              )}
            </div>
            <Pagination page={debtorsPage} totalPages={debtTotalPages} totalItems={debtRows.length} pageSize={PAGE_SIZE_DEBTS} onPageChange={setDebtorsPage} />
          </div>
        ) : (
          <div>
            <table className="w-full table-fixed text-left">
              <colgroup>
                <col className="w-[26%]" />
                <col className="w-[14%]" />
                <col className="w-[18%]" />
                <col className="w-[16%]" />
                <col className="w-[18%]" />
                <col className="w-[8%]" />
              </colgroup>
              <thead className="bg-gray-50 dark:bg-surface-dark-200 text-xs uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Saldo</th>
                  <th className="px-4 py-3 font-semibold text-center">Parcelas</th>
                  <th className="px-4 py-3 font-semibold">1º Vencimento</th>
                  <th className="px-4 py-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-300">
                {debtPaginated.map((debt) => (
                  <tr key={debt.id} className={isDebtOverdue(debt) ? 'bg-red-50/40 dark:bg-red-900/10' : ''}>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{customerById.get(debt.customerId) || 'Cliente removido'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`ios-badge ${
                          debt.status === 'Quitada' ? 'ios-badge-green' : debt.status === 'Parcial' ? 'ios-badge-blue' : 'ios-badge-orange'
                        }`}
                      >
                        {debt.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-brand-500">{formatCurrencyBRL(debt.remainingAmount)}</td>
                    <td className="px-4 py-3 text-center text-gray-700 dark:text-surface-dark-700">{debt.installmentsTotal || 1}x</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-surface-dark-700">
                      {debt.firstDueDate || debt.dueDate
                        ? new Date(`${(debt.firstDueDate || debt.dueDate) as string}T00:00:00`).toLocaleDateString('pt-BR')
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canDeleteDebt && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteDebt(debt.id)}
                        className="ios-button-destructive inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5"
                        aria-label={`Excluir dívida de ${customerById.get(debt.customerId) || 'Cliente removido'}`}
                      >
                        <Trash2 size={12} />
                        Excluir
                      </button>
                      )}
                    </td>
                  </tr>
                ))}
                {debtRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-surface-dark-500">
                      Nenhum devedor cadastrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <Pagination page={debtorsPage} totalPages={debtTotalPages} totalItems={debtRows.length} pageSize={PAGE_SIZE_DEBTS} onPageChange={setDebtorsPage} />
          </div>
        );
      })()}
    </div>
  </div>
);

export default DebtorsTab;
