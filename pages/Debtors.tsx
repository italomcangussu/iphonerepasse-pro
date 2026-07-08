import React, { useEffect, useMemo, useState } from 'react';
import { useDisclosure } from '../hooks/useDisclosure';
import { Calendar, DollarSign, Download, Plus, RotateCcw, Search, Trash2, UserRound, Wallet } from 'lucide-react';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { Combobox } from '../components/ui/Combobox';
import { useToast } from '../components/ui/ToastProvider';
import { useAsyncHandler } from '../hooks/useAsyncHandler';
import { useData } from '../services/dataContext';
import type { Debt, DebtPayment, DebtStatus, FinancialAccount } from '../types';
import { calculateDebtSummary, filterDebts, getDebtDeadlineBadge, getDebtDueDate, isDebtOverdue, validateDebtPaymentAmount } from '../utils/debts';
import { trackUxEvent } from '../services/telemetry';
import { ACCOUNT_BANK, CASH_EQUIVALENT_ACCOUNTS } from '../utils/financialAccounts';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';
import { formatCpfOrCnpj, formatCurrencyBRL, formatDateBRL, formatPhone, getCpfOrCnpjLabel } from '../utils/inputMasks';
import { DEADLINE_BADGE, DEBT_STATUS_BADGE } from '../utils/badgeStyles';
import { useFinanceDemand } from '../hooks/useDataGroupDemand';

const calcInstallmentsPaid = (paymentsCount: number): number => paymentsCount;
const statusBadgeClass = DEBT_STATUS_BADGE;
const deadlineBadgeClass = DEADLINE_BADGE;

const Debtors: React.FC = () => {
  const { debts, customers, addDebt, updateDebt, removeDebt, payDebt, getDebtPayments, removeDebtPayment } = useData();
  useFinanceDemand();
  const toast = useToast();
  const run = useAsyncHandler();
  const isMobile = useIsMobileViewport();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DebtStatus | 'all'>('all');
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  const { isOpen: isNewDebtModalOpen, open: openNewDebtModal, close: closeNewDebtModal } = useDisclosure();
  const [isSavingDebt, setIsSavingDebt] = useState(false);
  const [newDebtErrors, setNewDebtErrors] = useState<{ customer?: string; amount?: string }>({});
  const [newDebtForm, setNewDebtForm] = useState({
    customerId: '',
    customerName: '',
    cpf: '',
    phone: '',
    alternativePhone: '',
    email: '',
    amount: '',
    firstDueDate: '',
    installmentsTotal: '1',
    notes: ''
  });

  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const { isOpen: isEditDebtModalOpen, open: openEditDebtModal, close: closeEditDebtModal } = useDisclosure();
  const [isUpdatingDebt, setIsUpdatingDebt] = useState(false);
  const [editDebtErrors, setEditDebtErrors] = useState<{ amount?: string; installments?: string }>({});
  const [editDebtForm, setEditDebtForm] = useState({
    amount: '',
    firstDueDate: '',
    installmentsTotal: '1',
    notes: ''
  });
  const { isOpen: isPaymentModalOpen, open: openPaymentModal, close: closePaymentModal } = useDisclosure();
  const [isPayingDebt, setIsPayingDebt] = useState(false);
  const [paymentErrors, setPaymentErrors] = useState<{ amount?: string }>({});
  const [paymentForm, setPaymentForm] = useState<{
    amount: string;
    paymentMethod: 'Pix' | 'Dinheiro' | 'Cartão' | 'Cartão Débito';
    account: FinancialAccount;
    notes: string;
  }>({
    amount: '',
    paymentMethod: 'Pix' as 'Pix' | 'Dinheiro' | 'Cartão' | 'Cartão Débito',
    account: ACCOUNT_BANK,
    notes: ''
  });
  const [paymentToReverse, setPaymentToReverse] = useState<DebtPayment | null>(null);
  const [isReversingPayment, setIsReversingPayment] = useState(false);
  const [debtToDelete, setDebtToDelete] = useState<Debt | null>(null);
  const [isDeletingDebt, setIsDeletingDebt] = useState(false);

  const customerById = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((customer) => map.set(customer.id, customer.name));
    return map;
  }, [customers]);

  const debtRows = useMemo(() => {
    const filtered = filterDebts(debts, {
      searchTerm,
      statusFilter,
      onlyOverdue,
      customerById
    });
    return filtered.sort((a, b) => {
      const overdueA = isDebtOverdue(a) ? 1 : 0;
      const overdueB = isDebtOverdue(b) ? 1 : 0;
      if (overdueA !== overdueB) return overdueB - overdueA;
      if (a.status !== b.status) {
        const statusWeight: Record<DebtStatus, number> = { Aberta: 3, Parcial: 2, Quitada: 1 };
        return statusWeight[b.status] - statusWeight[a.status];
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [debts, customerById, searchTerm, statusFilter, onlyOverdue]);

  const paymentTimelineByDebt = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getDebtPayments>>();
    debtRows.forEach((debt) => {
      map.set(debt.id, getDebtPayments(debt.id));
    });
    return map;
  }, [debtRows, getDebtPayments]);

  useEffect(() => {
    if (!onlyOverdue) return;
    trackUxEvent({
      name: 'debt_overdue_filter_used',
      screen: 'Debtors',
      metadata: { count: debtRows.length },
      ts: new Date().toISOString()
    });
  }, [onlyOverdue, debtRows.length]);

  const summary = useMemo(() => calculateDebtSummary(debts), [debts]);

  const customerOptions = useMemo(
    () =>
      customers.map((customer) => ({
        id: customer.id,
        label: customer.name,
        subLabel: customer.cpf ? `${getCpfOrCnpjLabel(customer.cpf)}: ${customer.cpf}` : customer.phone ? `Telefone: ${customer.phone}` : undefined
      })),
    [customers]
  );

  const resetNewDebtForm = () => {
    setNewDebtForm({
      customerId: '',
      customerName: '',
      cpf: '',
      phone: '',
      alternativePhone: '',
      email: '',
      amount: '',
      firstDueDate: '',
      installmentsTotal: '1',
      notes: ''
    });
  };

  const handleSaveDebt = async () => {
    const amount = Number(newDebtForm.amount);
    const installmentsTotal = Math.max(1, Math.floor(Number(newDebtForm.installmentsTotal || 1)));
    if (!amount || amount <= 0) {
      setNewDebtErrors((prev) => ({ ...prev, amount: 'Informe um valor válido.' }));
      toast.error('Informe um valor de dívida válido.');
      return;
    }
    if (!Number.isFinite(installmentsTotal) || installmentsTotal < 1) {
      toast.error('Informe ao menos 1 parcela.');
      return;
    }

    if (!newDebtForm.customerId && !newDebtForm.customerName.trim()) {
      setNewDebtErrors((prev) => ({ ...prev, customer: 'Selecione ou informe um cliente.' }));
      toast.error('Selecione um cliente ou informe o nome para cadastro.');
      return;
    }

    setNewDebtErrors({});
    await run(async () => {
      await addDebt({
        customerId: newDebtForm.customerId || undefined,
        customer: newDebtForm.customerId
          ? undefined
          : {
              name: newDebtForm.customerName.trim().toUpperCase(),
              cpf: newDebtForm.cpf.trim(),
              phone: newDebtForm.phone.trim(),
              alternativePhone: newDebtForm.alternativePhone.trim(),
              email: newDebtForm.email.trim()
            },
        amount,
        dueDate: newDebtForm.firstDueDate || undefined,
        firstDueDate: newDebtForm.firstDueDate || undefined,
        installmentsTotal,
        notes: newDebtForm.notes.trim() || undefined,
        source: 'manual'
      });

      toast.success('Devedor cadastrado com sucesso.');
      trackUxEvent({
        name: 'debt_created',
        screen: 'Debtors',
        metadata: {
          amount,
          installmentsTotal,
          source: newDebtForm.customerId ? 'existing_customer' : 'manual_customer'
        },
        ts: new Date().toISOString()
      });
      closeNewDebtModal();
      resetNewDebtForm();
    }, { errorMsg: 'Não foi possível cadastrar o devedor.', setLoading: setIsSavingDebt });
  };

  const handleOpenPaymentModal = (debt: Debt) => {
    setSelectedDebt(debt);
    setPaymentForm({
      amount: debt.remainingAmount.toFixed(2),
      paymentMethod: 'Pix',
      account: ACCOUNT_BANK,
      notes: ''
    });
    openPaymentModal();
  };

  const handleOpenEditDebtModal = (debt: Debt) => {
    setSelectedDebt(debt);
    setEditDebtForm({
      amount: debt.originalAmount.toFixed(2),
      firstDueDate: debt.firstDueDate || debt.dueDate || '',
      installmentsTotal: String(debt.installmentsTotal || 1),
      notes: debt.notes || ''
    });
    setEditDebtErrors({});
    openEditDebtModal();
  };

  const handleUpdateDebt = async () => {
    if (!selectedDebt) return;
    const amount = Number(editDebtForm.amount);
    const installmentsTotal = Math.max(1, Math.floor(Number(editDebtForm.installmentsTotal || 1)));

    if (!Number.isFinite(amount) || amount <= 0) {
      setEditDebtErrors((prev) => ({ ...prev, amount: 'Informe um valor válido.' }));
      toast.error('Informe um valor de dívida válido.');
      return;
    }
    if (!Number.isFinite(installmentsTotal) || installmentsTotal < 1) {
      setEditDebtErrors((prev) => ({ ...prev, installments: 'Informe ao menos 1 parcela.' }));
      toast.error('Informe ao menos 1 parcela.');
      return;
    }

    await run(async () => {
      await updateDebt(selectedDebt.id, {
        amount,
        firstDueDate: editDebtForm.firstDueDate || undefined,
        dueDate: editDebtForm.firstDueDate || undefined,
        installmentsTotal,
        notes: editDebtForm.notes.trim() || undefined
      });
      toast.success('Devedor atualizado com sucesso.');
      closeEditDebtModal();
      setSelectedDebt(null);
      trackUxEvent({
        name: 'debt_updated',
        screen: 'Debtors',
        metadata: { debtId: selectedDebt.id, amount, installmentsTotal },
        ts: new Date().toISOString()
      });
    }, { errorMsg: 'Não foi possível atualizar o devedor.', setLoading: setIsUpdatingDebt });
  };

  const handlePayDebt = async () => {
    if (!selectedDebt) return;

    const amount = Number(paymentForm.amount);
    if (!amount || amount <= 0) {
      setPaymentErrors({ amount: 'Informe um valor de pagamento válido.' });
      toast.error('Informe um valor de pagamento válido.');
      return;
    }

    if (!validateDebtPaymentAmount(amount, selectedDebt.remainingAmount)) {
      setPaymentErrors({ amount: 'O valor não pode ser maior que o saldo.' });
      toast.error('O valor não pode ser maior que o saldo da dívida.');
      return;
    }

    setPaymentErrors({});
    await run(async () => {
      await payDebt({
        debtId: selectedDebt.id,
        amount,
        paymentMethod: paymentForm.paymentMethod,
        account: paymentForm.account,
        notes: paymentForm.notes.trim() || undefined
      });
      toast.success('Pagamento registrado com sucesso.');
      trackUxEvent({
        name: 'debt_payment_registered',
        screen: 'Debtors',
        metadata: { amount, debtId: selectedDebt.id, account: paymentForm.account },
        ts: new Date().toISOString()
      });
      closePaymentModal();
      setSelectedDebt(null);
    }, { errorMsg: 'Não foi possível registrar o pagamento.', setLoading: setIsPayingDebt });
  };

  const handleReversePayment = async () => {
    if (!paymentToReverse) return;
    await run(async () => {
      await removeDebtPayment(paymentToReverse.id);
      toast.success('Pagamento estornado e valor devolvido à dívida.');
      trackUxEvent({
        name: 'debt_payment_reversed',
        screen: 'Debtors',
        metadata: { debtId: paymentToReverse.debtId, amount: paymentToReverse.amount },
        ts: new Date().toISOString()
      });
      setPaymentToReverse(null);
    }, { errorMsg: 'Não foi possível estornar o pagamento.', setLoading: setIsReversingPayment });
  };

  const handleDeleteDebt = async () => {
    if (!debtToDelete) return;
    await run(async () => {
      await removeDebt(debtToDelete.id);
      toast.success('Dívida excluída com sucesso.');
      trackUxEvent({
        name: 'debt_deleted',
        screen: 'Debtors',
        metadata: { debtId: debtToDelete.id, amount: debtToDelete.originalAmount },
        ts: new Date().toISOString()
      });
      setDebtToDelete(null);
    }, { errorMsg: 'Não foi possível excluir a dívida.', setLoading: setIsDeletingDebt });
  };

  const handleExportCurrentView = () => {
    const headers = ['cliente', 'status', 'valor_original', 'saldo', 'parcelas', 'primeiro_vencimento', 'observacao'];
    const rows = debtRows.map((debt) => [
      customerById.get(debt.customerId) || 'Cliente removido',
      debt.status,
      debt.originalAmount.toFixed(2),
      debt.remainingAmount.toFixed(2),
      String(debt.installmentsTotal || 1),
      debt.firstDueDate || debt.dueDate || '',
      debt.notes || ''
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `devedores_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-5 md:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h2 className="text-[28px] md:text-ios-large font-bold text-gray-900 dark:text-white tracking-tight">Devedores</h2>
          <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-0.5">Controle de recebimentos pendentes</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportCurrentView} className="ios-button-secondary flex items-center gap-2">
            <Download size={16} />
            Exportar visão
          </button>
          <button onClick={() => openNewDebtModal()} className="ios-button-primary flex items-center gap-2">
            <Plus size={18} />
            Novo Devedor
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="ios-card p-5">
          <p className="text-ios-footnote text-gray-500 mb-1">Em Aberto</p>
          <p className="text-ios-title-2 font-bold text-gray-900 dark:text-white">{formatCurrencyBRL(summary.openAmount)}</p>
        </div>
        <div className="ios-card p-5">
          <p className="text-ios-footnote text-gray-500 mb-1">Vencidas</p>
          <p className="text-ios-title-2 font-bold text-red-600">{formatCurrencyBRL(summary.overdueAmount)}</p>
        </div>
        <div className="ios-card p-5">
          <p className="text-ios-footnote text-gray-500 mb-1">Quitadas (Histórico)</p>
          <p className="text-ios-title-2 font-bold text-green-600">{formatCurrencyBRL(summary.settledAmount)}</p>
        </div>
      </div>

      <div className="ios-card p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
          <input
            type="text"
            className="ios-input pl-10"
            placeholder="Buscar por cliente ou observação..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select className="ios-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as DebtStatus | 'all')}>
            <option value="all">Todos os status</option>
            <option value="Aberta">Aberta</option>
            <option value="Parcial">Parcial</option>
            <option value="Quitada">Quitada</option>
          </select>
          <label className="flex items-center gap-2 text-ios-subhead text-gray-700 dark:text-surface-dark-700">
            <input type="checkbox" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} />
            Mostrar apenas vencidas
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {statusFilter !== 'all' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-xs font-semibold text-brand-700">
              Status: {statusFilter}
            </span>
          )}
          {onlyOverdue && (
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
              Apenas vencidas
            </span>
          )}
          {searchTerm && (
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 border border-gray-200 text-xs font-semibold text-gray-700">
              Busca: {searchTerm}
            </span>
          )}
        </div>
      </div>

      <div className="ios-card overflow-hidden">
        {isMobile ? (
          <div className="p-4 space-y-3">
            {debtRows.map((debt) => {
              const payments = paymentTimelineByDebt.get(debt.id) || [];
              const deadlineBadge = getDebtDeadlineBadge(debt, payments);
              const paidCount = calcInstallmentsPaid(payments.length);

              return (
                <div
                  key={debt.id}
                  onClick={() => handleOpenEditDebtModal(debt)}
                  className={`ios-card p-4 space-y-3 cursor-pointer ${isDebtOverdue(debt) ? 'bg-red-50/40 dark:bg-red-900/10' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-gray-900 dark:text-white wrap-break-word min-w-0 flex-1">{customerById.get(debt.customerId) || 'Cliente removido'}</p>
                    <p className="font-bold text-brand-500 shrink-0">{formatCurrencyBRL(debt.remainingAmount)}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 items-center">
                    <select
                      value={deadlineBadge}
                      onClick={(e) => e.stopPropagation()}
                      onChange={async (e) => {
                        const newValue = e.target.value;
                        if (newValue === deadlineBadge) return;
                        try {
                          await updateDebt(debt.id, { customBadge: newValue });
                          toast.success('Status de prazo atualizado.');
                        } catch (err: any) {
                          toast.error('Erro ao atualizar status.');
                        }
                      }}
                      className={`ios-badge appearance-none cursor-pointer outline-none ring-0 ${deadlineBadgeClass[deadlineBadge as keyof typeof deadlineBadgeClass]} pr-6`}
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.3rem center', backgroundSize: '1em' }}
                    >
                      <option value="Em aberto">Em aberto</option>
                      <option value="Atrasado">Atrasado</option>
                      <option value="Em dias">Em dias</option>
                      <option value="Pago">Pago</option>
                    </select>
                    <span className={statusBadgeClass[debt.status]}>{debt.status}</span>
                    <span className="ios-badge app-surface-soft app-text-secondary">
                      {paidCount}/{debt.installmentsTotal || 1} pagas
                    </span>
                  </div>

                  <div className="space-y-1 text-sm text-gray-700 dark:text-surface-dark-700">
                    <p>Valor original: {formatCurrencyBRL(debt.originalAmount)}</p>
                    <p>1º Vencimento: {formatDateBRL(getDebtDueDate(debt))}</p>
                    {debt.notes && <p className="whitespace-pre-wrap wrap-break-word">Obs: {debt.notes}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenPaymentModal(debt);
                      }}
                      disabled={debt.status === 'Quitada'}
                      className="ios-button-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Pagamento
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDebtToDelete(debt);
                      }}
                      className="ios-button-destructive inline-flex items-center justify-center gap-2"
                    >
                      <Trash2 size={14} />
                      Excluir
                    </button>
                  </div>
                </div>
              );
            })}
            {debtRows.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-500 dark:text-surface-dark-500">
                Nenhum devedor encontrado com os filtros atuais.
              </div>
            )}
          </div>
        ) : (
          <div>
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[13%]" />
                <col className="w-[11%]" />
                <col className="w-[10%]" />
                <col className="w-[11%]" />
                <col className="w-[13%]" />
              </colgroup>
              <thead className="bg-gray-50 dark:bg-surface-dark-200 text-xs uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">
                <tr>
                  <th className="text-left px-3 py-3 font-semibold">Cliente</th>
                  <th className="text-left px-3 py-3 font-semibold">Prazo</th>
                  <th className="text-left px-3 py-3 font-semibold">Situação</th>
                  <th className="text-right px-3 py-3 font-semibold">Valor Orig.</th>
                  <th className="text-right px-3 py-3 font-semibold">Saldo</th>
                  <th className="text-center px-3 py-3 font-semibold">Parc. Pagas</th>
                  <th className="text-left px-3 py-3 font-semibold">1º Venc.</th>
                  <th className="text-right px-3 py-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-300">
                {debtRows.map((debt) => {
                  const payments = paymentTimelineByDebt.get(debt.id) || [];
                  const deadlineBadge = getDebtDeadlineBadge(debt, payments);
                  const paidCount = calcInstallmentsPaid(payments.length);
                  const totalInstallments = debt.installmentsTotal || 1;

                  return (
                    <tr
                      key={debt.id}
                      onClick={() => handleOpenEditDebtModal(debt)}
                      className={`cursor-pointer hover:bg-gray-50/80 dark:hover:bg-surface-dark-200/60 transition-colors ${
                        isDebtOverdue(debt) ? 'bg-red-50/40 dark:bg-red-900/10' : ''
                      }`}
                    >
                      <td className="px-3 py-3 font-semibold text-gray-900 dark:text-white text-sm wrap-break-word">{customerById.get(debt.customerId) || 'Cliente removido'}</td>
                      <td className="px-3 py-3">
                        <select
                          value={deadlineBadge}
                          onClick={(e) => e.stopPropagation()}
                          onChange={async (e) => {
                            const newValue = e.target.value;
                            if (newValue === deadlineBadge) return;
                            await run(async () => {
                              await updateDebt(debt.id, { customBadge: newValue });
                              toast.success('Status de prazo atualizado.');
                            }, 'Erro ao atualizar status.');
                          }}
                          className={`ios-badge text-xs appearance-none cursor-pointer outline-none ring-0 ${deadlineBadgeClass[deadlineBadge as keyof typeof deadlineBadgeClass]} pr-6`}
                          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.3rem center', backgroundSize: '1em' }}
                        >
                          <option value="Em aberto">Em aberto</option>
                          <option value="Atrasado">Atrasado</option>
                          <option value="Em dias">Em dias</option>
                          <option value="Pago">Pago</option>
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`${statusBadgeClass[debt.status]} text-xs`}>{debt.status}</span>
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-medium text-gray-700 dark:text-surface-dark-700">{formatCurrencyBRL(debt.originalAmount)}</td>
                      <td className="px-3 py-3 text-right text-sm font-bold text-brand-500">{formatCurrencyBRL(debt.remainingAmount)}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex items-center justify-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
                          paidCount >= totalInstallments
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : paidCount > 0
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                              : 'bg-gray-100 dark:bg-surface-dark-300 text-gray-500'
                        }`}>
                          {paidCount}/{totalInstallments}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700 dark:text-surface-dark-700">
                        {formatDateBRL(getDebtDueDate(debt))}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPaymentModal(debt);
                            }}
                            disabled={debt.status === 'Quitada'}
                            className="ios-button-secondary disabled:opacity-40 disabled:cursor-not-allowed text-xs px-2.5 py-1.5"
                          >
                            Pagar
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDebtToDelete(debt);
                            }}
                            className="ios-button-destructive inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5"
                          >
                            <Trash2 size={12} />
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {debtRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-500 dark:text-surface-dark-500">
                      Nenhum devedor encontrado com os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={isNewDebtModalOpen}
        onClose={() => {
          if (isSavingDebt) return;
          closeNewDebtModal();
          resetNewDebtForm();
          setNewDebtErrors({});
        }}
        title="Novo Devedor"
        size="lg"
        centered={false}
        onSubmit={handleSaveDebt}
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button
              type="button"
              className="ios-button-secondary w-full sm:w-auto"
              onClick={() => {
                closeNewDebtModal();
                resetNewDebtForm();
                setNewDebtErrors({});
              }}
              disabled={isSavingDebt}
            >
              Cancelar
            </button>
            <button type="submit" className="ios-button-primary w-full sm:w-auto" disabled={isSavingDebt}>
              {isSavingDebt ? 'Salvando...' : 'Salvar Devedor'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <Combobox
            label="Cliente existente (opcional)"
            placeholder="Buscar cliente..."
            value={newDebtForm.customerId}
            onChange={(value) => {
              setNewDebtForm((prev) => ({ ...prev, customerId: value }));
              setNewDebtErrors((prev) => ({ ...prev, customer: undefined }));
            }}
            options={customerOptions}
            errorMessage={newDebtErrors.customer}
          />
          {newDebtForm.customerId && (
            <div className="flex justify-end">
              <button
                type="button"
                className="text-ios-footnote text-brand-500 hover:text-brand-600"
                onClick={() => setNewDebtForm((prev) => ({ ...prev, customerId: '' }))}
              >
                Limpar cliente selecionado
              </button>
            </div>
          )}
          <div className="ios-card p-4 space-y-3">
            <p className="text-ios-footnote text-gray-500">Se não selecionar cliente acima, informando nome o cadastro será criado automaticamente.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label htmlFor="debtor-customer-name" className="ios-label">Nome do Cliente</label>
                <input
                  id="debtor-customer-name"
                  type="text"
                  className="ios-input"
                  value={newDebtForm.customerName}
                  onChange={(e) => {
                    setNewDebtForm((prev) => ({ ...prev, customerName: e.target.value.toUpperCase() }));
                    setNewDebtErrors((prev) => ({ ...prev, customer: undefined }));
                  }}
                  placeholder="Nome completo"
                  disabled={!!newDebtForm.customerId}
                />
              </div>
              <div>
                <label htmlFor="debtor-customer-document" className="ios-label">CPF/CNPJ</label>
                <input
                  id="debtor-customer-document"
                  type="text"
                  className="ios-input"
                  maxLength={18}
                  inputMode="numeric"
                  value={newDebtForm.cpf}
                  onChange={(e) => setNewDebtForm((prev) => ({ ...prev, cpf: formatCpfOrCnpj(e.target.value) }))}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  disabled={!!newDebtForm.customerId}
                />
              </div>
              <div>
                <label htmlFor="debtor-customer-phone" className="ios-label">Telefone</label>
                <input
                  id="debtor-customer-phone"
                  type="tel"
                  className="ios-input"
                  maxLength={15}
                  inputMode="tel"
                  value={newDebtForm.phone}
                  onChange={(e) => setNewDebtForm((prev) => ({ ...prev, phone: formatPhone(e.target.value) }))}
                  placeholder="(00) 00000-0000"
                  disabled={!!newDebtForm.customerId}
                />
              </div>
              <div>
                <label htmlFor="debtor-customer-alternative-phone" className="ios-label">Telefone alternativo</label>
                <input
                  id="debtor-customer-alternative-phone"
                  type="tel"
                  className="ios-input"
                  maxLength={15}
                  inputMode="tel"
                  value={newDebtForm.alternativePhone}
                  onChange={(e) => setNewDebtForm((prev) => ({ ...prev, alternativePhone: formatPhone(e.target.value) }))}
                  placeholder="(00) 00000-0000"
                  disabled={!!newDebtForm.customerId}
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="debtor-customer-email" className="ios-label">Email</label>
                <input
                  id="debtor-customer-email"
                  type="email"
                  className="ios-input"
                  value={newDebtForm.email}
                  onChange={(e) => setNewDebtForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="cliente@email.com"
                  disabled={!!newDebtForm.customerId}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="ios-label">Valor da Dívida</label>
              <input
                type="number"
                className={`ios-input ${newDebtErrors.amount ? 'border-red-500' : ''}`}
                min={0.01}
                step="0.01"
                onFocus={(e) => e.target.select()}
                value={newDebtForm.amount}
                onChange={(e) => {
                  setNewDebtForm((prev) => ({ ...prev, amount: e.target.value }));
                  setNewDebtErrors((prev) => ({ ...prev, amount: undefined }));
                }}
                placeholder="0,00"
              />
              {newDebtErrors.amount && <p className="text-xs text-red-600 mt-1">{newDebtErrors.amount}</p>}
            </div>
            <div>
              <label className="ios-label">Parcelas</label>
              <input
                type="number"
                min={1}
                step={1}
                className="ios-input"
                onFocus={(e) => e.target.select()}
                value={newDebtForm.installmentsTotal}
                onChange={(e) => setNewDebtForm((prev) => ({ ...prev, installmentsTotal: e.target.value }))}
              />
            </div>
            <div>
              <label className="ios-label">1º Vencimento (opcional)</label>
              <input
                type="date"
                className="ios-input"
                value={newDebtForm.firstDueDate}
                onChange={(e) => setNewDebtForm((prev) => ({ ...prev, firstDueDate: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="ios-label">Observação</label>
            <textarea
              className="ios-input min-h-24"
              value={newDebtForm.notes}
              onChange={(e) => setNewDebtForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Ex: pagamento semanal, parcela dia 10..."
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={isEditDebtModalOpen}
        onClose={() => {
          if (isUpdatingDebt) return;
          closeEditDebtModal();
          setSelectedDebt(null);
          setEditDebtErrors({});
        }}
        title="Editar Devedor"
        size="lg"
        centered={false}
        onSubmit={handleUpdateDebt}
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button
              type="button"
              className="ios-button-secondary w-full sm:w-auto"
              onClick={() => {
                closeEditDebtModal();
                setSelectedDebt(null);
                setEditDebtErrors({});
              }}
              disabled={isUpdatingDebt}
            >
              Cancelar
            </button>
            <button type="submit" className="ios-button-primary w-full sm:w-auto" disabled={isUpdatingDebt}>
              {isUpdatingDebt ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="ios-label">Valor Original</label>
            <input
              type="number"
              min={0.01}
              step="0.01"
              className={`ios-input ${editDebtErrors.amount ? 'border-red-500' : ''}`}
              onFocus={(e) => e.target.select()}
              value={editDebtForm.amount}
              onChange={(e) => {
                setEditDebtForm((prev) => ({ ...prev, amount: e.target.value }));
                setEditDebtErrors((prev) => ({ ...prev, amount: undefined }));
              }}
            />
            {editDebtErrors.amount && <p className="text-xs text-red-600 mt-1">{editDebtErrors.amount}</p>}
          </div>
          <div>
            <label className="ios-label">Parcelas</label>
            <input
              type="number"
              min={1}
              step={1}
              className={`ios-input ${editDebtErrors.installments ? 'border-red-500' : ''}`}
              onFocus={(e) => e.target.select()}
              value={editDebtForm.installmentsTotal}
              onChange={(e) => {
                setEditDebtForm((prev) => ({ ...prev, installmentsTotal: e.target.value }));
                setEditDebtErrors((prev) => ({ ...prev, installments: undefined }));
              }}
            />
            {editDebtErrors.installments && <p className="text-xs text-red-600 mt-1">{editDebtErrors.installments}</p>}
          </div>
          <div>
            <label className="ios-label">1º Vencimento (opcional)</label>
            <input
              type="date"
              className="ios-input"
              value={editDebtForm.firstDueDate}
              onChange={(e) => setEditDebtForm((prev) => ({ ...prev, firstDueDate: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="ios-label">Observação</label>
            <textarea
              className="ios-input min-h-24"
              value={editDebtForm.notes}
              onChange={(e) => setEditDebtForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Ex: parcelas mensais todo dia 10"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={isPaymentModalOpen}
        onClose={() => {
          if (isPayingDebt) return;
          closePaymentModal();
          setSelectedDebt(null);
          setPaymentErrors({});
        }}
        title="Pagamento de Devedor"
        size="lg"
        centered={false}
        onSubmit={handlePayDebt}
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button
              type="button"
              className="ios-button-secondary w-full sm:w-auto"
              onClick={() => {
                closePaymentModal();
                setSelectedDebt(null);
                setPaymentErrors({});
              }}
              disabled={isPayingDebt}
            >
              Cancelar
            </button>
            <button type="submit" className="ios-button-primary w-full sm:w-auto" disabled={isPayingDebt}>
              {isPayingDebt ? 'Confirmando...' : 'Confirmar Pagamento'}
            </button>
          </div>
        }
      >
        {selectedDebt && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="ios-card p-3 min-w-0">
                <p className="text-xs text-gray-500 mb-1">Cliente</p>
                <p className="font-semibold text-gray-900 dark:text-white text-sm leading-snug wrap-break-word flex items-start gap-1">
                  <UserRound size={14} />
                  <span className="min-w-0 wrap-break-word">{customerById.get(selectedDebt.customerId) || 'Cliente'}</span>
                </p>
              </div>
              <div className="ios-card p-3 min-w-0">
                <p className="text-xs text-gray-500 mb-1">Saldo Atual</p>
                <p className="font-bold text-brand-500 text-sm flex items-center gap-1 wrap-break-word">
                  <Wallet size={14} />
                  {formatCurrencyBRL(selectedDebt.remainingAmount)}
                </p>
              </div>
              <div className="ios-card p-3 min-w-0">
                <p className="text-xs text-gray-500 mb-1">1º Vencimento</p>
                <p className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-1 wrap-break-word">
                  <Calendar size={14} />
                  {formatDateBRL(getDebtDueDate(selectedDebt))}
                </p>
              </div>
              <div className="ios-card p-3 min-w-0">
                <p className="text-xs text-gray-500 mb-1">Parcelas</p>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{selectedDebt.installmentsTotal || 1}x</p>
                  <span className={`ios-badge ${deadlineBadgeClass[getDebtDeadlineBadge(selectedDebt, paymentTimelineByDebt.get(selectedDebt.id) || [])]}`}>
                    {getDebtDeadlineBadge(selectedDebt, paymentTimelineByDebt.get(selectedDebt.id) || [])}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="ios-label">Valor do Pagamento</label>
                <input
                  type="number"
                  className={`ios-input ${paymentErrors.amount ? 'border-red-500' : ''}`}
                  onFocus={(e) => e.target.select()}
                  value={paymentForm.amount}
                  onChange={(e) => {
                    setPaymentForm((prev) => ({ ...prev, amount: e.target.value }));
                    setPaymentErrors({ amount: undefined });
                  }}
                  min={0.01}
                  max={selectedDebt.remainingAmount}
                  step="0.01"
                />
                {paymentErrors.amount && <p className="text-xs text-red-600 mt-1">{paymentErrors.amount}</p>}
              </div>
              <div>
                <label className="ios-label">Forma de Pagamento</label>
                <select
                  className="ios-input"
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentMethod: e.target.value as 'Pix' | 'Dinheiro' | 'Cartão' | 'Cartão Débito' }))}
                >
                  <option value="Pix">Pix</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Cartão">Cartão Crédito</option>
                  <option value="Cartão Débito">Cartão Débito</option>
                </select>
              </div>
              <div>
                <label className="ios-label">Conta de Entrada</label>
                <select
                  className="ios-input"
                  value={paymentForm.account}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, account: e.target.value as FinancialAccount }))}
                >
                  {/* Somente contas reais: um recebimento lançado na conta virtual
                      'Devedores' nunca aparece no saldo do Cofre/Conta. */}
                  {CASH_EQUIVALENT_ACCOUNTS.map((account) => (
                    <option key={account} value={account}>
                      {account}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="ios-label">Observação do pagamento</label>
              <textarea
                className="ios-input min-h-20"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Observação opcional"
              />
            </div>

            <div className="ios-card p-4">
              <p className="text-ios-footnote text-gray-500 mb-2">Histórico de pagamentos</p>
              {getDebtPayments(selectedDebt.id).length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum pagamento registrado.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {getDebtPayments(selectedDebt.id).map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between gap-3 rounded-ios border border-gray-200 dark:border-surface-dark-300 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white wrap-break-word">{payment.paymentMethod} • {payment.account}</p>
                        <p className="text-xs text-gray-500">{new Date(payment.paidAt).toLocaleString('pt-BR')}</p>
                      </div>
                      <p className="font-bold text-green-600 flex items-center gap-1 shrink-0">
                        <DollarSign size={14} />
                        {formatCurrencyBRL(payment.amount)}
                      </p>
                      <button
                        type="button"
                        onClick={() => setPaymentToReverse(payment)}
                        className="shrink-0 inline-flex items-center gap-1 rounded-ios border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 px-2 py-1 text-xs font-semibold text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                        title="Estornar pagamento"
                      >
                        <RotateCcw size={12} />
                        Estornar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!paymentToReverse}
        onClose={() => {
          if (!isReversingPayment) setPaymentToReverse(null);
        }}
        title="Estornar pagamento"
        description={
          paymentToReverse
            ? `Confirmar estorno de ${formatCurrencyBRL(paymentToReverse.amount)} pago em ${new Date(paymentToReverse.paidAt).toLocaleString('pt-BR')}? O valor voltará para o saldo da dívida e o lançamento financeiro será removido.`
            : undefined
        }
        confirmLabel={isReversingPayment ? 'Estornando...' : 'Estornar'}
        variant="danger"
        onConfirm={() => {
          void handleReversePayment();
        }}
      />

      <ConfirmDialog
        open={!!debtToDelete}
        onClose={() => {
          if (!isDeletingDebt) setDebtToDelete(null);
        }}
        title="Excluir dívida"
        description={
          debtToDelete
            ? `Excluir a dívida de ${customerById.get(debtToDelete.customerId) || 'Cliente removido'} removerá a dívida, pagamentos registrados e lançamentos financeiros vinculados. Esta ação não altera a venda original.`
            : undefined
        }
        confirmLabel={isDeletingDebt ? 'Excluindo...' : 'Excluir dívida'}
        variant="danger"
        onConfirm={() => {
          void handleDeleteDebt();
        }}
      />
    </div>
  );
};

export default Debtors;
