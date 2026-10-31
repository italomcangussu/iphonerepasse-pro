import React from 'react';
import { Filter, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '../../components/ui/ToastProvider';
import { useAsyncHandler } from '../../hooks/useAsyncHandler';
import type { ContextMenuAction } from '../../components/ui/contextMenuCore';
import type { useData } from '../../services/dataContext';
import type { Transaction } from '../../types';
import { buildCancelTransactionMessage } from './financeHelpers';

type FinanceData = ReturnType<typeof useData>;

interface TransactionActionsDeps extends Pick<FinanceData, 'debtPayments' | 'debts' | 'customers' | 'transactions' | 'removeTransaction'> {
  canEdit: boolean;
  canDelete: boolean;
  setSelectedTransaction: React.Dispatch<React.SetStateAction<Transaction | null>>;
  openEdit: (transaction: Transaction) => void;
}

// Ações de um lançamento do extrato: ver, editar e cancelar (com estorno explicado).
export const useTransactionActions = ({
  debtPayments,
  debts,
  customers,
  transactions,
  removeTransaction,
  canEdit,
  canDelete,
  setSelectedTransaction,
  openEdit
}: TransactionActionsDeps) => {
  const toast = useToast();
  const run = useAsyncHandler();

  const handleCancelTransaction = async (target: Transaction) => {
    if (!target) return;

    const description = buildCancelTransactionMessage(target, { debtPayments, debts, customers, transactions });

    const confirmed = await toast.confirm({
      title: 'Cancelar lançamento',
      description,
      confirmLabel: 'Cancelar lançamento',
      variant: 'danger',
    });

    if (!confirmed) return;

    await run(async () => {
      await removeTransaction(target.id);
      setSelectedTransaction((prev) => (prev?.id === target.id ? null : prev));
      toast.success('Lançamento cancelado.');
    }, 'Não foi possível cancelar o lançamento.');
  };

  const buildTransactionContextActions = (transaction: Transaction): ContextMenuAction[] => {
    const actions: ContextMenuAction[] = [
      {
        id: 'details',
        label: 'Ver detalhes',
        icon: <Filter size={16} />,
        onSelect: () => setSelectedTransaction(transaction),
      },
    ];
    if (canEdit) {
      actions.push({
        id: 'edit',
        label: 'Editar',
        icon: <Pencil size={16} />,
        onSelect: () => openEdit(transaction),
      });
    }
    if (canDelete) {
      actions.push({
        id: 'cancel',
        label: 'Cancelar lançamento',
        icon: <Trash2 size={16} />,
        destructive: true,
        separatorBefore: true,
        onSelect: () => void handleCancelTransaction(transaction),
      });
    }
    return actions;
  };

  return { handleCancelTransaction, buildTransactionContextActions };
};
