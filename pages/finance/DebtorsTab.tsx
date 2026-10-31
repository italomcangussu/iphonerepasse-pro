import React from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import Pagination from '../../components/ui/Pagination';
import type { Debt } from '../../types';
import { isDebtOverdue } from '../../utils/debts';
import { formatCurrencyBRL, formatDateTimeBRL } from '../../utils/inputMasks';
import AccountSummaryCard from './AccountSummaryCard';
import { debtStatusBadgeClass, formatDueDate } from './financeHelpers';

const PAGE_SIZE_DEBTS = 15;
const EMPTY_MESSAGE = 'Nenhum devedor cadastrado.';
const OVERDUE_ROW_CLASS = 'bg-red-50/40 dark:bg-red-900/10';

interface DebtRowProps {
  debt: Debt;
  customerName: string;
  canDeleteDebt: boolean;
  onDelete: (debtId: string) => void;
}

const DeleteDebtButton: React.FC<{ customerName: string; compact: boolean; onClick: () => void }> = ({ customerName, compact, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`ios-button-destructive inline-flex items-center text-xs ${compact ? 'gap-1.5 px-2.5 py-1.5' : 'gap-2 px-3 py-2'}`}
    aria-label={`Excluir dívida de ${customerName}`}
  >
    <Trash2 size={compact ? 12 : 14} />
    Excluir
  </button>
);

const DebtCard: React.FC<DebtRowProps> = ({ debt, customerName, canDeleteDebt, onDelete }) => (
  <div className={`ios-card p-4 space-y-2 ${isDebtOverdue(debt) ? OVERDUE_ROW_CLASS : ''}`}>
    <div className="flex items-start justify-between gap-3">
      <p className="font-semibold text-gray-900 dark:text-white">{customerName}</p>
      <div className="shrink-0 text-right">
        <p className={`whitespace-nowrap font-semibold tabular-nums ${debt.remainingAmount > 0 ? 'text-brand-500' : 'text-gray-500 dark:text-surface-dark-500'}`}>
          {formatCurrencyBRL(debt.remainingAmount)}
        </p>
        <p className="whitespace-nowrap text-ios-caption tabular-nums text-gray-500 dark:text-surface-dark-500">de {formatCurrencyBRL(debt.originalAmount)}</p>
      </div>
    </div>
    <span className={`ios-badge ${debtStatusBadgeClass(debt.status)}`}>{debt.status}</span>
    <div className="text-sm text-gray-700 dark:text-surface-dark-700 space-y-1">
      <p>Parcelas: {debt.installmentsTotal || 1}x</p>
      <p>1º Vencimento: {formatDueDate(debt.firstDueDate || debt.dueDate)}</p>
      <p className="tabular-nums text-gray-500 dark:text-surface-dark-500">Criada em {formatDateTimeBRL(debt.createdAt)}</p>
    </div>
    <div className="flex justify-end">
      {canDeleteDebt && <DeleteDebtButton customerName={customerName} compact={false} onClick={() => onDelete(debt.id)} />}
    </div>
  </div>
);

const DebtTableRow: React.FC<DebtRowProps> = ({ debt, customerName, canDeleteDebt, onDelete }) => (
  <tr className={isDebtOverdue(debt) ? OVERDUE_ROW_CLASS : ''}>
    <td className="px-4 py-3">
      <span className="block font-medium text-gray-900 dark:text-white">{customerName}</span>
      <span className="block text-xs tabular-nums text-gray-500 dark:text-surface-dark-500">Criada em {formatDateTimeBRL(debt.createdAt)}</span>
    </td>
    <td className="px-4 py-3">
      <span className={`ios-badge ${debtStatusBadgeClass(debt.status)}`}>{debt.status}</span>
    </td>
    <td className="px-4 py-3 text-right tabular-nums">
      <span className="block font-semibold text-brand-500">{formatCurrencyBRL(debt.remainingAmount)}</span>
      <span className="block text-xs text-gray-500 dark:text-surface-dark-500">de {formatCurrencyBRL(debt.originalAmount)}</span>
    </td>
    <td className="px-4 py-3 text-center text-gray-700 dark:text-surface-dark-700">{debt.installmentsTotal || 1}x</td>
    <td className="px-4 py-3 text-gray-700 dark:text-surface-dark-700">{formatDueDate(debt.firstDueDate || debt.dueDate)}</td>
    <td className="px-4 py-3 text-right">
      {canDeleteDebt && <DeleteDebtButton customerName={customerName} compact onClick={() => onDelete(debt.id)} />}
    </td>
  </tr>
);

const DebtTable: React.FC<{ children: React.ReactNode; isEmpty: boolean }> = ({ children, isEmpty }) => (
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
      {children}
      {isEmpty && (
        <tr>
          <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-surface-dark-500">
            {EMPTY_MESSAGE}
          </td>
        </tr>
      )}
    </tbody>
  </table>
);

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
}) => {
  const totalPages = Math.ceil(debtRows.length / PAGE_SIZE_DEBTS);
  const pageRows = debtRows.slice(debtorsPage * PAGE_SIZE_DEBTS, (debtorsPage + 1) * PAGE_SIZE_DEBTS);
  const rowProps = (debt: Debt): DebtRowProps => ({
    debt,
    customerName: customerById.get(debt.customerId) || 'Cliente removido',
    canDeleteDebt,
    onDelete: (debtId) => void handleDeleteDebt(debtId)
  });

  return (
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
        {isMobile ? (
          <div className="p-4 space-y-3">
            {pageRows.map((debt) => (
              <DebtCard key={debt.id} {...rowProps(debt)} />
            ))}
            {debtRows.length === 0 && <div className="p-6 text-center text-gray-500 dark:text-surface-dark-500">{EMPTY_MESSAGE}</div>}
          </div>
        ) : (
          <DebtTable isEmpty={debtRows.length === 0}>
            {pageRows.map((debt) => (
              <DebtTableRow key={debt.id} {...rowProps(debt)} />
            ))}
          </DebtTable>
        )}
        <Pagination page={debtorsPage} totalPages={totalPages} totalItems={debtRows.length} pageSize={PAGE_SIZE_DEBTS} onPageChange={setDebtorsPage} />
      </div>
    </div>
  );
};

export default DebtorsTab;
