import React from 'react';
import type { Debt } from '../../types';
import { getDebtSchedule, isDebtOverdue } from '../../utils/debts';
import { formatCurrencyBRL, formatDateBRL } from '../../utils/inputMasks';

// Uma linha que explica o selo de prazo: quanto está em atraso ou quando vence a próxima parcela.
const DebtScheduleHint: React.FC<{ debt: Debt; className?: string }> = ({ debt, className = '' }) => {
  const schedule = getDebtSchedule(debt);
  if (!schedule.nextDueDate) return null;
  const nextDue = formatDateBRL(schedule.nextDueDate);

  if (isDebtOverdue(debt)) {
    const text = schedule.overdueAmount > 0
      ? `${formatCurrencyBRL(schedule.overdueAmount)} em atraso · parcela de ${nextDue}`
      : 'Marcado como atrasado';
    return <p className={`font-semibold text-red-600 dark:text-red-400 ${className}`}>{text}</p>;
  }
  if (schedule.overdueAmount > 0) {
    return (
      <p className={`text-gray-500 dark:text-surface-dark-500 ${className}`}>
        Marcado em dias · pelas parcelas faltam {formatCurrencyBRL(schedule.overdueAmount)}
      </p>
    );
  }
  return <p className={`text-gray-700 dark:text-surface-dark-700 ${className}`}>Próxima parcela: {nextDue}</p>;
};

export default DebtScheduleHint;
