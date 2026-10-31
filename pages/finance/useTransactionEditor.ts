import { useState } from 'react';
import { useDisclosure } from '../../hooks/useDisclosure';
import { useToast } from '../../components/ui/ToastProvider';
import type { FinancialAccount, FinancialCategory, Transaction } from '../../types';
import { ACCOUNT_BANK, CASH_EQUIVALENT_ACCOUNTS } from '../../utils/financialAccounts';
import { newId } from '../../utils/id';
import { toFiniteNumber } from '../../utils/number';
import { formatDecimalBRL, parseDecimalBRL } from '../../utils/inputMasks';
import { buildDefaultTransactionDescription, formatSignedBRL, isManualCategory } from './financeHelpers';
import type { TransactionFormData } from './TransactionFormModal';

interface TransactionEditorDeps {
  financialCategories: FinancialCategory[];
  bankBalance: number;
  safeBalance: number;
  addTransaction: (transaction: Transaction) => Promise<unknown>;
  updateTransaction: (id: string, patch: Omit<Transaction, 'id'>) => Promise<unknown>;
  // Abrir o formulário fecha o modal de detalhes que estiver aberto.
  onOpen: () => void;
}

// Estado e ações do formulário de aporte/pagamento (novo ou edição).
export const useTransactionEditor = ({
  financialCategories,
  bankBalance,
  safeBalance,
  addTransaction,
  updateTransaction,
  onOpen
}: TransactionEditorDeps) => {
  const toast = useToast();
  const { isOpen, open: openTransModal, close: closeTransModal } = useDisclosure();
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [transFormData, setTransFormData] = useState<TransactionFormData>({
    type: 'IN',
    category: '',
    amount: '',
    description: '',
    date: new Date().toISOString(),
    account: ACCOUNT_BANK
  });
  const closeTransactionModal = () => {
    closeTransModal();
    setEditingTransactionId(null);
    setTransFormData({
      type: 'IN',
      category: 'Aporte',
      amount: '',
      description: '',
      date: new Date().toISOString(),
      account: ACCOUNT_BANK
    });
  };

  const handleSaveTransaction = async () => {
    console.log('[Finance] handleSaveTransaction start', {
      amount: transFormData.amount,
      description: transFormData.description,
      type: transFormData.type,
      category: transFormData.category,
      account: transFormData.account,
      editingTransactionId,
    });

    const amount = parseDecimalBRL(transFormData.amount);
    if (amount <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }

    // Aviso de saldo: nada impede tecnicamente uma saída maior que o saldo
    // (despesas podem ser registradas com atraso), mas o usuário precisa
    // confirmar que a conta ficará negativa em vez de descobrir depois.
    if (transFormData.type === 'OUT' && !editingTransactionId && CASH_EQUIVALENT_ACCOUNTS.includes(transFormData.account)) {
      const currentBalance = transFormData.account === ACCOUNT_BANK ? bankBalance : safeBalance;
      if (amount > currentBalance + 0.001) {
        const proceed = await toast.confirm({
          title: 'Saldo insuficiente',
          description: `O saldo de ${transFormData.account} é ${formatSignedBRL(currentBalance)} e ficará negativo com esta saída. Deseja registrar mesmo assim?`,
          confirmLabel: 'Registrar mesmo assim',
          variant: 'danger',
        });
        if (!proceed) return;
      }
    }

    const trimmedDescription = transFormData.description.trim();
    const effectiveDescription =
      trimmedDescription ||
      buildDefaultTransactionDescription(transFormData.type, transFormData.account);

    const payload: Omit<Transaction, 'id'> = {
      type: transFormData.type,
      category: transFormData.category,
      amount,
      description: effectiveDescription,
      date: transFormData.date || new Date().toISOString(),
      account: transFormData.account
    };

    setIsSavingTransaction(true);
    try {
      if (editingTransactionId) {
        await updateTransaction(editingTransactionId, payload);
        toast.success('Lançamento atualizado.');
      } else {
        await addTransaction({
          id: newId('trx'),
          ...payload
        });
        toast.success('Movimentação registrada.');
      }
      closeTransactionModal();
    } catch (error: any) {
      console.error('[Finance] handleSaveTransaction error:', error);
      const fallbackMessage =
        typeof error === 'string' ? error : error?.message || error?.error_description || error?.details;
      toast.error(fallbackMessage || 'Não foi possível salvar o lançamento.');
    } finally {
      setIsSavingTransaction(false);
    }
  };


  const findDefaultManualCategory = (type: 'IN' | 'OUT') =>
    financialCategories.find(c => c.type === type && c.isDefault && isManualCategory(c.name))
    || financialCategories.find(c => c.type === type && isManualCategory(c.name));

  const openTransactionModal = (type: 'IN' | 'OUT', account: FinancialAccount) => {
    setEditingTransactionId(null);
    onOpen();
    const defaultCat = findDefaultManualCategory(type);
    setTransFormData({
      type,
      category: defaultCat ? defaultCat.name : '',
      amount: '',
      description: buildDefaultTransactionDescription(type, account),
      date: new Date().toISOString(),
      account
    });
    openTransModal();
  };

  const openEditTransactionModal = (transaction: Transaction) => {
    setEditingTransactionId(transaction.id);
    setTransFormData({
      type: transaction.type,
      category: transaction.category,
      amount: formatDecimalBRL(toFiniteNumber(transaction.amount)),
      description: transaction.description,
      date: transaction.date,
      account: transaction.account
    });
    onOpen();
    openTransModal();
  };


  const submitTransactionForm = () => {
    handleSaveTransaction().catch((err) => {
      console.error('[Finance] unhandled error from handleSaveTransaction:', err);
      toast.error(err?.message || 'Erro inesperado ao salvar.');
      setIsSavingTransaction(false);
    });
  };


  return {
    isOpen,
    isEditing: !!editingTransactionId,
    isSaving: isSavingTransaction,
    formData: transFormData,
    setFormData: setTransFormData,
    findDefaultManualCategory,
    open: openTransactionModal,
    openEdit: openEditTransactionModal,
    close: closeTransactionModal,
    submit: submitTransactionForm
  };
};
