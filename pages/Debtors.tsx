import React, { useMemo, useState } from 'react';
import { Calendar, DollarSign, Plus, Search, UserRound, Wallet } from 'lucide-react';
import Modal from '../components/ui/Modal';
import { Combobox } from '../components/ui/Combobox';
import { useToast } from '../components/ui/ToastProvider';
import { useData } from '../services/dataContext';
import type { Debt, DebtStatus } from '../types';
import { calculateDebtSummary, filterDebts, validateDebtPaymentAmount } from '../utils/debts';

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusBadgeClass: Record<DebtStatus, string> = {
  Aberta: 'ios-badge-orange',
  Parcial: 'ios-badge-blue',
  Quitada: 'ios-badge-green'
};

const Debtors: React.FC = () => {
  const { debts, customers, addDebt, payDebt, getDebtPayments } = useData();
  const toast = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DebtStatus | 'all'>('all');
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  const [isNewDebtModalOpen, setIsNewDebtModalOpen] = useState(false);
  const [isSavingDebt, setIsSavingDebt] = useState(false);
  const [newDebtForm, setNewDebtForm] = useState({
    customerId: '',
    customerName: '',
    cpf: '',
    phone: '',
    email: '',
    amount: '',
    dueDate: '',
    notes: ''
  });

  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPayingDebt, setIsPayingDebt] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'Pix' as 'Pix' | 'Dinheiro' | 'Cartão',
    account: 'Caixa' as 'Caixa' | 'Cofre',
    notes: ''
  });

  const customerById = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((customer) => map.set(customer.id, customer.name));
    return map;
  }, [customers]);

  const debtRows = useMemo(() => {
    return filterDebts(debts, {
      searchTerm,
      statusFilter,
      onlyOverdue,
      customerById
    });
  }, [debts, customerById, searchTerm, statusFilter, onlyOverdue]);

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
      dueDate: '',
      notes: ''
    });
  };

  const handleSaveDebt = async () => {
    const amount = Number(newDebtForm.amount);
    if (!amount || amount <= 0) {
      toast.error('Informe um valor de dívida válido.');
      return;
    }

    if (!newDebtForm.customerId && !newDebtForm.customerName.trim()) {
      toast.error('Selecione um cliente ou informe o nome para cadastro.');
      return;
    }

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
        dueDate: newDebtForm.dueDate || undefined,
        notes: newDebtForm.notes.trim() || undefined,
        source: 'manual'
      });

      toast.success('Devedor cadastrado com sucesso.');
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
      account: 'Caixa',
      notes: ''
    });
    setIsPaymentModalOpen(true);
  };

  const handlePayDebt = async () => {
    if (!selectedDebt) return;

    const amount = Number(paymentForm.amount);
    if (!amount || amount <= 0) {
      toast.error('Informe um valor de pagamento válido.');
      return;
    }

    if (!validateDebtPaymentAmount(amount, selectedDebt.remainingAmount)) {
      toast.error('O valor não pode ser maior que o saldo da dívida.');
      return;
    }

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
      setIsPaymentModalOpen(false);
      setSelectedDebt(null);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível registrar o pagamento.');
    } finally {
      setIsPayingDebt(false);
    }
  };

  return (
    <div className="space-y-5 md:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h2 className="text-[28px] md:text-ios-large font-bold text-gray-900 dark:text-white tracking-tight">Devedores</h2>
          <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-0.5">Controle de recebimentos pendentes</p>
        </div>
        <button onClick={() => setIsNewDebtModalOpen(true)} className="ios-button-primary flex items-center gap-2">
          <Plus size={18} />
          Novo Devedor
        </button>
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
      </div>

      <div className="ios-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50 dark:bg-surface-dark-200 text-xs uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3 font-semibold">Valor Original</th>
                <th className="text-right px-4 py-3 font-semibold">Saldo</th>
                <th className="text-left px-4 py-3 font-semibold">Vencimento</th>
                <th className="text-left px-4 py-3 font-semibold">Observação</th>
                <th className="text-right px-4 py-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-300">
              {debtRows.map((debt) => (
                <tr key={debt.id} className="hover:bg-gray-50/80 dark:hover:bg-surface-dark-200/60 transition-colors">
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{customerById.get(debt.customerId) || 'Cliente removido'}</td>
                  <td className="px-4 py-3">
                    <span className={statusBadgeClass[debt.status]}>{debt.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(debt.originalAmount)}</td>
                  <td className="px-4 py-3 text-right font-bold text-brand-500">{formatCurrency(debt.remainingAmount)}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-surface-dark-700">
                    {debt.dueDate ? new Date(`${debt.dueDate}T00:00:00`).toLocaleDateString('pt-BR') : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-surface-dark-700 max-w-[320px] truncate">{debt.notes || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openPaymentModal(debt)}
                      disabled={debt.status === 'Quitada'}
                      className="ios-button-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Pagamento
                    </button>
                  </td>
                </tr>
              ))}
              {debtRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500 dark:text-surface-dark-500">
                    Nenhum devedor encontrado com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={isNewDebtModalOpen}
        onClose={() => {
          if (isSavingDebt) return;
          setIsNewDebtModalOpen(false);
          resetNewDebtForm();
        }}
        title="Novo Devedor"
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="ios-button-secondary"
              onClick={() => {
                setIsNewDebtModalOpen(false);
                resetNewDebtForm();
              }}
              disabled={isSavingDebt}
            >
              Cancelar
            </button>
            <button type="button" className="ios-button-primary" onClick={handleSaveDebt} disabled={isSavingDebt}>
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
            onChange={(value) => setNewDebtForm((prev) => ({ ...prev, customerId: value }))}
            options={customerOptions}
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
                  onChange={(e) => setNewDebtForm((prev) => ({ ...prev, customerName: e.target.value }))}
                  placeholder="Nome completo"
                  disabled={!!newDebtForm.customerId}
                />
              </div>
              <div>
                <label className="ios-label">CPF</label>
                <input
                  type="text"
                  className="ios-input"
                  value={newDebtForm.cpf}
                  onChange={(e) => setNewDebtForm((prev) => ({ ...prev, cpf: e.target.value }))}
                  placeholder="000.000.000-00"
                  disabled={!!newDebtForm.customerId}
                />
              </div>
              <div>
                <label className="ios-label">Telefone</label>
                <input
                  type="text"
                  className="ios-input"
                  value={newDebtForm.phone}
                  onChange={(e) => setNewDebtForm((prev) => ({ ...prev, phone: e.target.value }))}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="ios-label">Valor da Dívida</label>
              <input
                type="number"
                className="ios-input"
                min={0.01}
                step="0.01"
                value={newDebtForm.amount}
                onChange={(e) => setNewDebtForm((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="0,00"
              />
            </div>
            <div>
              <label className="ios-label">Vencimento (opcional)</label>
              <input
                type="date"
                className="ios-input"
                value={newDebtForm.dueDate}
                onChange={(e) => setNewDebtForm((prev) => ({ ...prev, dueDate: e.target.value }))}
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
        open={isPaymentModalOpen}
        onClose={() => {
          if (isPayingDebt) return;
          setIsPaymentModalOpen(false);
          setSelectedDebt(null);
        }}
        title="Pagamento da Dívida"
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="ios-button-secondary"
              onClick={() => {
                setIsPaymentModalOpen(false);
                setSelectedDebt(null);
              }}
              disabled={isPayingDebt}
            >
              Cancelar
            </button>
            <button type="button" className="ios-button-primary" onClick={handlePayDebt} disabled={isPayingDebt}>
              {isPayingDebt ? 'Confirmando...' : 'Confirmar Pagamento'}
            </button>
          </div>
        }
      >
        {selectedDebt && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="ios-card p-3">
                <p className="text-xs text-gray-500 mb-1">Cliente</p>
                <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-1">
                  <UserRound size={14} />
                  {customerById.get(selectedDebt.customerId) || 'Cliente'}
                </p>
              </div>
              <div className="ios-card p-3">
                <p className="text-xs text-gray-500 mb-1">Saldo Atual</p>
                <p className="font-bold text-brand-500 flex items-center gap-1">
                  <Wallet size={14} />
                  {formatCurrency(selectedDebt.remainingAmount)}
                </p>
              </div>
              <div className="ios-card p-3">
                <p className="text-xs text-gray-500 mb-1">Vencimento</p>
                <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-1">
                  <Calendar size={14} />
                  {selectedDebt.dueDate ? new Date(`${selectedDebt.dueDate}T00:00:00`).toLocaleDateString('pt-BR') : '-'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="ios-label">Valor do Pagamento</label>
                <input
                  type="number"
                  className="ios-input"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                  min={0.01}
                  max={selectedDebt.remainingAmount}
                  step="0.01"
                />
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
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, account: e.target.value as 'Caixa' | 'Cofre' }))}
                >
                  <option value="Caixa">Caixa</option>
                  <option value="Cofre">Cofre</option>
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
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{payment.paymentMethod} • {payment.account}</p>
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
