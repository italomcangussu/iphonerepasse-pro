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

const describeSaveError = (error: unknown): string | undefined => {
  if (typeof error === 'string') return error;
  const details = error as { message?: string; error_description?: string; details?: string } | null;
  return details?.message || details?.error_description || details?.details;
};

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

  // Aviso de saldo: nada impede tecnicamente uma saída maior que o saldo
  // (despesas podem ser registradas com atraso), mas o usuário precisa
  // confirmar que a conta ficará negativa em vez de descobrir depois.
  const confirmNegativeBalance = async (amount: number): Promise<boolean> => {
    const isNewCashOutflow =
      transFormData.type === 'OUT' && !editingTransactionId && CASH_EQUIVALENT_ACCOUNTS.includes(transFormData.account);
    if (!isNewCashOutflow) return true;
    const currentBalance = transFormData.account === ACCOUNT_BANK ? bankBalance : safeBalance;
    if (amount <= currentBalance + 0.001) return true;
    return toast.confirm({
      title: 'Saldo insuficiente',
      description: `O saldo de ${transFormData.account} é ${formatSignedBRL(currentBalance)} e ficará negativo com esta saída. Deseja registrar mesmo assim?`,
      confirmLabel: 'Registrar mesmo assim',
      variant: 'danger',
    });
  };

  const buildPayload = (amount: number): Omit<Transaction, 'id'> => ({
    type: transFormData.type,
    category: transFormData.category,
    amount,
    description: transFormData.description.trim() || buildDefaultTransactionDescription(transFormData.type, transFormData.account),
    date: transFormData.date || new Date().toISOString(),
    account: transFormData.account
  });

  const persist = async (payload: Omit<Transaction, 'id'>) => {
    if (editingTransactionId) {
      await updateTransaction(editingTransactionId, payload);
      toast.success('Lançamento atualizado.');
      return;
    }
    await addTransaction({ id: newId('trx'), ...payload });
    toast.success('Movimentação registrada.');
  };

  const handleSaveTransaction = async () => {
    const amount = parseDecimalBRL(transFormData.amount);
    if (amount <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }
    if (!(await confirmNegativeBalance(amount))) return;

    setIsSavingTransaction(true);
    try {
      await persist(buildPayload(amount));
      closeTransactionModal();
    } catch (error: unknown) {
      console.error('[Finance] handleSaveTransaction error:', error);
      toast.error(describeSaveError(error) || 'Não foi possível salvar o lançamento.');
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
