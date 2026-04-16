import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, DollarSign, Download, Pencil, Plus, Search, UserRound, Wallet } from 'lucide-react';
import Modal from '../components/ui/Modal';
import { Combobox } from '../components/ui/Combobox';
import { useToast } from '../components/ui/ToastProvider';
import { useData } from '../services/dataContext';
import type { Debt, DebtStatus, FinancialAccount } from '../types';
import { calculateDebtSummary, filterDebts, getDebtDeadlineBadge, getDebtDueDate, isDebtOverdue, validateDebtPaymentAmount } from '../utils/debts';
import { trackUxEvent } from '../services/telemetry';
import { ACCOUNT_BANK, FINANCIAL_ACCOUNTS } from '../utils/financialAccounts';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';
import { formatCpf, formatPhone } from '../utils/inputMasks';

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (value?: string) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR') : '-');
const calculateInstallmentAmount = (debt: Debt) => {
  const installments = Math.max(1, debt.installmentsTotal || 1);
  if (installments <= 1 || debt.remainingAmount <= 0) return null;
  return debt.remainingAmount / installments;
};

const statusBadgeClass: Record<DebtStatus, string> = {
  Aberta: 'ios-badge-orange',
  Parcial: 'ios-badge-blue',
  Quitada: 'ios-badge-green'
};

const deadlineBadgeClass: Record<'Em aberto' | 'Atrasado' | 'Em dias', string> = {
  'Em aberto': 'ios-badge-blue',
  Atrasado: 'ios-badge-red',
  'Em dias': 'ios-badge-green'
};

const Debtors: React.FC = () => {
  const { debts, customers, addDebt, updateDebt, payDebt, getDebtPayments } = useData();
  const toast = useToast();
  const isMobile = useIsMobileViewport();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DebtStatus | 'all'>('all');
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  const [isNewDebtModalOpen, setIsNewDebtModalOpen] = useState(false);
  const [isSavingDebt, setIsSavingDebt] = useState(false);
  const [newDebtErrors, setNewDebtErrors] = useState<{ customer?: string; amount?: string }>({});
  const [newDebtForm, setNewDebtForm] = useState({
    customerId: '',
    customerName: '',
    cpf: '',
    phone: '',
    email: '',
    amount: '',
    firstDueDate: '',
    installmentsTotal: '1',
    notes: ''
  });

  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [isEditDebtModalOpen, setIsEditDebtModalOpen] = useState(false);
  const [isUpdatingDebt, setIsUpdatingDebt] = useState(false);
  const [editDebtErrors, setEditDebtErrors] = useState<{ amount?: string; installments?: string }>({});
  const [editDebtForm, setEditDebtForm] = useState({
    amount: '',
    firstDueDate: '',
    installmentsTotal: '1',
    notes: ''
  });
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPayingDebt, setIsPayingDebt] = useState(false);
  const [paymentErrors, setPaymentErrors] = useState<{ amount?: string }>({});
  const [paymentForm, setPaymentForm] = useState<{
    amount: string;
    paymentMethod: 'Pix' | 'Dinheiro' | 'Cartão';
    account: FinancialAccount;
    notes: string;
  }>({
    amount: '',
    paymentMethod: 'Pix' as 'Pix' | 'Dinheiro' | 'Cartão',
    account: ACCOUNT_BANK,
    notes: ''
  });

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
        subLabel: customer.cpf ? `CPF: ${customer.cpf}` : customer.phone ? `Telefone: ${customer.phone}` : undefined
      })),
    [customers]
  );

  const resetNewDebtForm = () => {
    setNewDebtForm({
      customerId: '',
      customerName: '',
      cpf: '',
      phone: '',
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
    setIsSavingDebt(true);
    try {
      await addDebt({
        customerId: newDebtForm.customerId || undefined,
        customer: newDebtForm.customerId
          ? undefined
          : {
              name: newDebtForm.customerName.trim(),
              cpf: newDebtForm.cpf.trim(),
              phone: newDebtForm.phone.trim(),
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
      setIsNewDebtModalOpen(false);
      resetNewDebtForm();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível cadastrar o devedor.');
    } finally {
      setIsSavingDebt(false);
    }
  };

  const openPaymentModal = (debt: Debt) => {
    setSelectedDebt(debt);
    setPaymentForm({
      amount: debt.remainingAmount.toFixed(2),
      paymentMethod: 'Pix',
      account: ACCOUNT_BANK,
      notes: ''
    });
    setIsPaymentModalOpen(true);
  };

  const openEditDebtModal = (debt: Debt) => {
    setSelectedDebt(debt);
    setEditDebtForm({
      amount: debt.originalAmount.toFixed(2),
      firstDueDate: debt.firstDueDate || debt.dueDate || '',
      installmentsTotal: String(debt.installmentsTotal || 1),
      notes: debt.notes || ''
    });
    setEditDebtErrors({});
    setIsEditDebtModalOpen(true);
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

    setIsUpdatingDebt(true);
    try {
      await updateDebt(selectedDebt.id, {
        amount,
        firstDueDate: editDebtForm.firstDueDate || undefined,
        dueDate: editDebtForm.firstDueDate || undefined,
        installmentsTotal,
        notes: editDebtForm.notes.trim() || undefined
      });
      toast.success('Devedor atualizado com sucesso.');
      setIsEditDebtModalOpen(false);
      setSelectedDebt(null);
      trackUxEvent({
        name: 'debt_updated',
        screen: 'Debtors',
        metadata: { debtId: selectedDebt.id, amount, installmentsTotal },
        ts: new Date().toISOString()
      });
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível atualizar o devedor.');
    } finally {
      setIsUpdatingDebt(false);
    }
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
    setIsPayingDebt(true);
    try {
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
      setIsPaymentModalOpen(false);
      setSelectedDebt(null);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível registrar o pagamento.');
    } finally {
      setIsPayingDebt(false);
    }
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
          <button onClick={() => setIsNewDebtModalOpen(true)} className="ios-button-primary flex items-center gap-2">
            <Plus size={18} />
            Novo Devedor
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="ios-card p-5">
          <p className="text-ios-footnote text-gray-500 mb-1">Em Aberto</p>
          <p className="text-ios-title-2 font-bold text-gray-900 dark:text-white">{formatCurrency(summary.openAmount)}</p>
        </div>
        <div className="ios-card p-5">
          <p className="text-ios-footnote text-gray-500 mb-1">Vencidas</p>
          <p className="text-ios-title-2 font-bold text-red-600">{formatCurrency(summary.overdueAmount)}</p>
        </div>
        <div className="ios-card p-5">
          <p className="text-ios-footnote text-gray-500 mb-1">Quitadas (Histórico)</p>
          <p className="text-ios-title-2 font-bold text-green-600">{formatCurrency(summary.settledAmount)}</p>
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
              const installmentAmount = calculateInstallmentAmount(debt);

              return (
                <div
                  key={debt.id}
                  className={`ios-card p-4 space-y-3 ${isDebtOverdue(debt) ? 'bg-red-50/40 dark:bg-red-900/10' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-gray-900 dark:text-white break-words">{customerById.get(debt.customerId) || 'Cliente removido'}</p>
                    <p className="font-bold text-brand-500">{formatCurrency(debt.remainingAmount)}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className={`ios-badge ${deadlineBadgeClass[deadlineBadge]}`}>{deadlineBadge}</span>
                    <span className={statusBadgeClass[debt.status]}>{debt.status}</span>
                    <span className="ios-badge app-surface-soft app-text-secondary">
                      {debt.installmentsTotal || 1}x
                    </span>
                  </div>

                  <div className="space-y-1 text-sm text-gray-700 dark:text-surface-dark-700">
                    <p>Valor original: {formatCurrency(debt.originalAmount)}</p>
                    {installmentAmount !== null && <p>Valor da parcela: {formatCurrency(installmentAmount)}</p>}
                    <p>1º Vencimento: {formatDate(getDebtDueDate(debt))}</p>
                    {debt.notes && <p className="whitespace-pre-wrap break-words">Obs: {debt.notes}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => openEditDebtModal(debt)}
                      className="ios-button-secondary inline-flex items-center justify-center gap-2"
                    >
                      <Pencil size={14} />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => openPaymentModal(debt)}
                      disabled={debt.status === 'Quitada'}
                      className="ios-button-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Pagamento
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px]">
              <thead className="bg-gray-50 dark:bg-surface-dark-200 text-xs uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Cliente</th>
                  <th className="text-left px-4 py-3 font-semibold">Prazo</th>
                  <th className="text-left px-4 py-3 font-semibold">Situação</th>
                  <th className="text-right px-4 py-3 font-semibold">Valor Original</th>
                  <th className="text-right px-4 py-3 font-semibold">Saldo</th>
                  <th className="text-center px-4 py-3 font-semibold">Parcelas</th>
                  <th className="text-right px-4 py-3 font-semibold">Valor Parcela</th>
                  <th className="text-left px-4 py-3 font-semibold">1º Vencimento</th>
                  <th className="text-left px-4 py-3 font-semibold">Observação</th>
                  <th className="text-right px-4 py-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-300">
                {debtRows.map((debt) => {
                  const payments = paymentTimelineByDebt.get(debt.id) || [];
                  const deadlineBadge = getDebtDeadlineBadge(debt, payments);
                  const installmentAmount = calculateInstallmentAmount(debt);

                  return (
                    <tr
                      key={debt.id}
                      className={`hover:bg-gray-50/80 dark:hover:bg-surface-dark-200/60 transition-colors ${
                        isDebtOverdue(debt) ? 'bg-red-50/40 dark:bg-red-900/10' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{customerById.get(debt.customerId) || 'Cliente removido'}</td>
                      <td className="px-4 py-3">
                        <span className={`ios-badge ${deadlineBadgeClass[deadlineBadge]}`}>{deadlineBadge}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={statusBadgeClass[debt.status]}>{debt.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(debt.originalAmount)}</td>
                      <td className="px-4 py-3 text-right font-bold text-brand-500">{formatCurrency(debt.remainingAmount)}</td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-surface-dark-700">
                        {debt.installmentsTotal || 1}x
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-surface-dark-700">
                        {installmentAmount !== null ? formatCurrency(installmentAmount) : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-surface-dark-700">
                        {formatDate(getDebtDueDate(debt))}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-surface-dark-700 max-w-[320px] whitespace-normal break-words">{debt.notes || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditDebtModal(debt)}
                            className="ios-button-secondary inline-flex items-center gap-2"
                          >
                            <Pencil size={14} />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => openPaymentModal(debt)}
                            disabled={debt.status === 'Quitada'}
                            className="ios-button-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Pagamento
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {debtRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-gray-500 dark:text-surface-dark-500">
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
          setIsNewDebtModalOpen(false);
          resetNewDebtForm();
          setNewDebtErrors({});
        }}
        title="Novo Devedor"
        size="lg"
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button
              type="button"
              className="ios-button-secondary w-full sm:w-auto"
              onClick={() => {
                setIsNewDebtModalOpen(false);
                resetNewDebtForm();
                setNewDebtErrors({});
              }}
              disabled={isSavingDebt}
            >
              Cancelar
            </button>
            <button type="button" className="ios-button-primary w-full sm:w-auto" onClick={handleSaveDebt} disabled={isSavingDebt}>
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
                <label className="ios-label">Nome do Cliente</label>
                <input
                  type="text"
                  className="ios-input"
                  value={newDebtForm.customerName}
                  onChange={(e) => {
                    setNewDebtForm((prev) => ({ ...prev, customerName: e.target.value }));
                    setNewDebtErrors((prev) => ({ ...prev, customer: undefined }));
                  }}
                  placeholder="Nome completo"
                  disabled={!!newDebtForm.customerId}
                />
              </div>
              <div>
                <label className="ios-label">CPF</label>
                <input
                  type="text"
                  className="ios-input"
                  maxLength={14}
                  value={newDebtForm.cpf}
                  onChange={(e) => setNewDebtForm((prev) => ({ ...prev, cpf: formatCpf(e.target.value) }))}
                  placeholder="000.000.000-00"
                  disabled={!!newDebtForm.customerId}
                />
              </div>
              <div>
                <label className="ios-label">Telefone</label>
                <input
                  type="text"
                  className="ios-input"
                  maxLength={15}
                  value={newDebtForm.phone}
                  onChange={(e) => setNewDebtForm((prev) => ({ ...prev, phone: formatPhone(e.target.value) }))}
                  placeholder="(00) 00000-0000"
                  disabled={!!newDebtForm.customerId}
                />
              </div>
              <div>
                <label className="ios-label">Email</label>
                <input
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="ios-label">Valor da Dívida</label>
              <input
                type="number"
                className={`ios-input ${newDebtErrors.amount ? 'border-red-500' : ''}`}
                min={0.01}
                step="0.01"
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
          setIsEditDebtModalOpen(false);
          setSelectedDebt(null);
          setEditDebtErrors({});
        }}
        title="Editar Devedor"
        size="md"
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button
              type="button"
              className="ios-button-secondary w-full sm:w-auto"
              onClick={() => {
                setIsEditDebtModalOpen(false);
                setSelectedDebt(null);
                setEditDebtErrors({});
              }}
              disabled={isUpdatingDebt}
            >
              Cancelar
            </button>
            <button type="button" className="ios-button-primary w-full sm:w-auto" onClick={handleUpdateDebt} disabled={isUpdatingDebt}>
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
          setIsPaymentModalOpen(false);
          setSelectedDebt(null);
          setPaymentErrors({});
        }}
        title="Pagamento de Devedor"
        size="lg"
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button
              type="button"
              className="ios-button-secondary w-full sm:w-auto"
              onClick={() => {
                setIsPaymentModalOpen(false);
                setSelectedDebt(null);
                setPaymentErrors({});
              }}
              disabled={isPayingDebt}
            >
              Cancelar
            </button>
            <button type="button" className="ios-button-primary w-full sm:w-auto" onClick={handlePayDebt} disabled={isPayingDebt}>
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
                <p className="font-semibold text-gray-900 dark:text-white text-sm leading-snug break-words flex items-start gap-1">
                  <UserRound size={14} />
                  <span className="min-w-0 break-words">{customerById.get(selectedDebt.customerId) || 'Cliente'}</span>
                </p>
              </div>
              <div className="ios-card p-3 min-w-0">
                <p className="text-xs text-gray-500 mb-1">Saldo Atual</p>
                <p className="font-bold text-brand-500 text-sm flex items-center gap-1 break-words">
                  <Wallet size={14} />
                  {formatCurrency(selectedDebt.remainingAmount)}
                </p>
              </div>
              <div className="ios-card p-3 min-w-0">
                <p className="text-xs text-gray-500 mb-1">1º Vencimento</p>
                <p className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-1 break-words">
                  <Calendar size={14} />
                  {formatDate(getDebtDueDate(selectedDebt))}
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
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentMethod: e.target.value as 'Pix' | 'Dinheiro' | 'Cartão' }))}
                >
                  <option value="Pix">Pix</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Cartão">Cartão</option>
                </select>
              </div>
              <div>
                <label className="ios-label">Conta de Entrada</label>
                <select
                  className="ios-input"
                  value={paymentForm.account}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, account: e.target.value as FinancialAccount }))}
                >
                  {FINANCIAL_ACCOUNTS.map((account) => (
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
                    <div key={payment.id} className="flex items-center justify-between rounded-ios border border-gray-200 dark:border-surface-dark-300 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white break-words">{payment.paymentMethod} • {payment.account}</p>
                        <p className="text-xs text-gray-500">{new Date(payment.paidAt).toLocaleString('pt-BR')}</p>
                      </div>
                      <p className="font-bold text-green-600 flex items-center gap-1">
                        <DollarSign size={14} />
                        {formatCurrency(payment.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Debtors;
