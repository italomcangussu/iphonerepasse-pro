import { useMemo, useState } from 'react';
import { useToast } from '../../components/ui/ToastProvider';
import { useAsyncHandler } from '../../hooks/useAsyncHandler';
import type { Customer, Debt } from '../../types';
import { sortDebtsByDueDate } from '../../utils/debts';
import { summarizeCustomerDebts } from './financeHelpers';

interface CustomerDebtsDeps {
  debts: Debt[];
  customers: Customer[];
  removeDebt: (debtId: string) => Promise<unknown>;
}

// Aba Devedores: totais, lista por vencimento, página e exclusão com confirmação.
export const useCustomerDebtsView = ({ debts, customers, removeDebt }: CustomerDebtsDeps) => {
  const toast = useToast();
  const run = useAsyncHandler();
  const [debtorsPage, setDebtorsPage] = useState(0);
  const customerById = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((customer) => map.set(customer.id, customer.name));
    return map;
  }, [customers]);

  const debtSummary = useMemo(() => summarizeCustomerDebts(debts), [debts]);
  const debtRows = useMemo(() => sortDebtsByDueDate(debts), [debts]);

  const handleDeleteDebt = async (debtId: string) => {
    const targetDebt = debts.find((debt) => debt.id === debtId);
    if (!targetDebt) return;

    const customerLabel = customerById.get(targetDebt.customerId) || 'Cliente removido';
    const confirmed = await toast.confirm({
      title: 'Excluir dívida',
      description: `Excluir a dívida de ${customerLabel} removerá a dívida, pagamentos registrados e lançamentos financeiros vinculados. Esta ação não altera a venda original.`,
      confirmLabel: 'Excluir dívida',
      variant: 'danger',
    });

    if (!confirmed) return;

    await run(async () => {
      await removeDebt(debtId);
      toast.success('Dívida excluída com sucesso.');
    }, 'Não foi possível excluir a dívida.');
  };

  return { debtSummary, debtRows, customerById, debtorsPage, setDebtorsPage, handleDeleteDebt };
};
