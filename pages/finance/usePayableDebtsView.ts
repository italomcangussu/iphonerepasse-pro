import { useEffect, useMemo, useState } from 'react';
import type { Creditor, PayableDebt, PayableDebtStatus } from '../../types';
import { calculatePayableDebtSummary, filterPayableDebts, sortPayableDebtsByDueDate } from '../../utils/payableDebts';

// Aba Contas a pagar: totais, busca, filtros e página da lista somente leitura.
export const usePayableDebtsView = (payableDebts: PayableDebt[], creditors: Creditor[]) => {
  const [pdSearchTerm, setPdSearchTerm] = useState('');
  const [pdStatusFilter, setPdStatusFilter] = useState<PayableDebtStatus | 'all'>('all');
  const [pdPage, setPdPage] = useState(0);

  useEffect(() => { setPdPage(0); }, [pdSearchTerm, pdStatusFilter]);

  const creditorById = useMemo(() => {
    const map = new Map<string, string>();
    creditors.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [creditors]);

  const payableDebtSummary = useMemo(() => calculatePayableDebtSummary(payableDebts), [payableDebts]);
  const payableDebtRows = useMemo(() => {
    const filtered = filterPayableDebts(payableDebts, { searchTerm: pdSearchTerm, statusFilter: pdStatusFilter, creditorById });
    return sortPayableDebtsByDueDate(filtered);
  }, [payableDebts, creditorById, pdSearchTerm, pdStatusFilter]);

  return {
    payableDebtSummary,
    payableDebtRows,
    creditorById,
    pdSearchTerm,
    setPdSearchTerm,
    pdStatusFilter,
    setPdStatusFilter,
    pdPage,
    setPdPage
  };
};
