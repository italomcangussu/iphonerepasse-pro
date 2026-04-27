import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Download, HandCoins, Paperclip, Pencil, Plus, RotateCcw, Search, Trash2, Wallet, X } from 'lucide-react';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/ToastProvider';
import { useData } from '../services/dataContext';
import type { Creditor, PayableDebt, PayableDebtPayment, PayableDebtStatus } from '../types';
import {
  calculatePayableDebtSummary,
  filterPayableDebts,
  getPayableDebtDeadlineBadge,
  getPayableDebtDueDate,
  isPayableDebtOverdue,
  validatePayableDebtPaymentAmount
} from '../utils/payableDebts';
import { trackUxEvent } from '../services/telemetry';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';
import { supabase } from '../services/supabase';

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (value?: string) =>
  value ? new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR') : '-';

const statusBadgeClass: Record<PayableDebtStatus, string> = {
  Aberta: 'ios-badge-orange',
  Parcial: 'ios-badge-blue',
  Quitada: 'ios-badge-green'
};

const deadlineBadgeClass: Record<'Em aberto' | 'Atrasado' | 'Em dias', string> = {
  'Em aberto': 'ios-badge-blue',
  Atrasado: 'ios-badge-red',
  'Em dias': 'ios-badge-green'
};

const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const PayableDebts: React.FC = () => {
  const {
    creditors,
    payableDebts,
    addCreditor,
    updateCreditor,
    removeCreditor,
    addPayableDebt,
    updatePayableDebt,
    removePayableDebt,
    addPayableDebtPayment,
    revertPayableDebtPayment,
    getPayableDebtPayments
  } = useData();
  const toast = useToast();
  const isMobile = useIsMobileViewport();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    trackUxEvent({ name: 'payable_debts_view_opened', screen: 'PayableDebts', ts: new Date().toISOString() });
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PayableDebtStatus | 'all'>('all');
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  // ----- Creditor modal -----
  const [isCreditorModalOpen, setIsCreditorModalOpen] = useState(false);
  const [isSavingCreditor, setIsSavingCreditor] = useState(false);
  const [editingCreditor, setEditingCreditor] = useState<Creditor | null>(null);
  const [creditorForm, setCreditorForm] = useState({ name: '', document: '', documentType: '' as '' | 'CPF' | 'CNPJ', phone: '', email: '', notes: '' });
  const [creditorToDelete, setCreditorToDelete] = useState<Creditor | null>(null);

  const resetCreditorForm = () => setCreditorForm({ name: '', document: '', documentType: '', phone: '', email: '', notes: '' });

  const openNewCreditorModal = () => {
    setEditingCreditor(null);
    resetCreditorForm();
    setIsCreditorModalOpen(true);
  };

  const openEditCreditorModal = (c: Creditor) => {
    setEditingCreditor(c);
    setCreditorForm({
      name: c.name,
      document: c.document || '',
      documentType: c.documentType || '',
      phone: c.phone || '',
      email: c.email || '',
      notes: c.notes || ''
    });
    setIsCreditorModalOpen(true);
  };

  const handleSaveCreditor = async () => {
    if (!creditorForm.name.trim()) {
      toast.error('Informe o nome do credor.');
      return;
    }
    setIsSavingCreditor(true);
    try {
      const payload = {
        name: creditorForm.name.trim().toUpperCase(),
        document: creditorForm.document.trim() || undefined,
        documentType: creditorForm.documentType || undefined,
        phone: creditorForm.phone.trim() || undefined,
        email: creditorForm.email.trim() || undefined,
        notes: creditorForm.notes.trim() || undefined
      };
      if (editingCreditor) {
        await updateCreditor(editingCreditor.id, payload);
        toast.success('Credor atualizado.');
      } else {
        await addCreditor(payload);
        toast.success('Credor cadastrado.');
      }
      setIsCreditorModalOpen(false);
      setEditingCreditor(null);
      resetCreditorForm();
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível salvar o credor.');
    } finally {
      setIsSavingCreditor(false);
    }
  };

  // ----- Debt modal -----
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [isSavingDebt, setIsSavingDebt] = useState(false);
  const [editingDebt, setEditingDebt] = useState<PayableDebt | null>(null);
  const [debtForm, setDebtForm] = useState({
    creditorId: '',
    amount: '',
    firstDueDate: '',
    installmentsTotal: '1',
    notes: ''
  });
  const [debtErrors, setDebtErrors] = useState<{ creditorId?: string; amount?: string }>({});
  const [debtToDelete, setDebtToDelete] = useState<PayableDebt | null>(null);
  const [isDeletingDebt, setIsDeletingDebt] = useState(false);

  const resetDebtForm = () => setDebtForm({ creditorId: '', amount: '', firstDueDate: '', installmentsTotal: '1', notes: '' });

  const openNewDebtModal = () => {
    setEditingDebt(null);
    resetDebtForm();
    setDebtErrors({});
    setIsDebtModalOpen(true);
  };

  const openEditDebtModal = (debt: PayableDebt) => {
    setEditingDebt(debt);
    setDebtForm({
      creditorId: debt.creditorId,
      amount: debt.originalAmount.toFixed(2),
      firstDueDate: debt.firstDueDate || debt.dueDate || '',
      installmentsTotal: String(debt.installmentsTotal || 1),
      notes: debt.notes || ''
    });
    setDebtErrors({});
    setIsDebtModalOpen(true);
  };

  const handleSaveDebt = async () => {
    const amount = Number(debtForm.amount);
    const errors: typeof debtErrors = {};
    if (!debtForm.creditorId) errors.creditorId = 'Selecione um credor.';
    if (!amount || amount <= 0) errors.amount = 'Informe um valor válido.';
    if (Object.keys(errors).length) { setDebtErrors(errors); return; }
    setDebtErrors({});
    setIsSavingDebt(true);
    try {
      const payload = {
        creditorId: debtForm.creditorId,
        amount,
        firstDueDate: debtForm.firstDueDate || undefined,
        dueDate: debtForm.firstDueDate || undefined,
        installmentsTotal: Math.max(1, Math.floor(Number(debtForm.installmentsTotal || 1))),
        notes: debtForm.notes.trim() || undefined
      };
      if (editingDebt) {
        await updatePayableDebt(editingDebt.id, payload);
        toast.success('Dívida atualizada.');
      } else {
        await addPayableDebt(payload);
        toast.success('Dívida ativa cadastrada.');
      }
      setIsDebtModalOpen(false);
      setEditingDebt(null);
      resetDebtForm();
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível salvar a dívida.');
    } finally {
      setIsSavingDebt(false);
    }
  };

  const handleDeleteDebt = async () => {
    if (!debtToDelete) return;
    setIsDeletingDebt(true);
    try {
      await removePayableDebt(debtToDelete.id);
      toast.success('Dívida excluída.');
      setDebtToDelete(null);
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível excluir a dívida.');
    } finally {
      setIsDeletingDebt(false);
    }
  };

  // ----- Payment modal -----
  const [selectedDebt, setSelectedDebt] = useState<PayableDebt | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPayingDebt, setIsPayingDebt] = useState(false);
  const [paymentErrors, setPaymentErrors] = useState<{ amount?: string; file?: string }>({});
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'Pix' as 'Pix' | 'Dinheiro' | 'Cartão',
    account: 'Conta Bancária' as 'Conta Bancária' | 'Cofre',
    notes: '',
    paidAt: new Date().toISOString().slice(0, 10)
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [paymentToRevert, setPaymentToRevert] = useState<PayableDebtPayment | null>(null);
  const [isRevertingPayment, setIsRevertingPayment] = useState(false);
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);

  const openPaymentModal = (debt: PayableDebt) => {
    setSelectedDebt(debt);
    setPaymentForm({
      amount: debt.remainingAmount.toFixed(2),
      paymentMethod: 'Pix',
      account: 'Conta Bancária',
      notes: '',
      paidAt: new Date().toISOString().slice(0, 10)
    });
    setSelectedFile(null);
    setPaymentErrors({});
    setIsPaymentModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) { setSelectedFile(null); return; }
    if (!ACCEPTED_MIME.includes(file.type)) {
      setPaymentErrors((prev) => ({ ...prev, file: 'Tipo de arquivo inválido. Use JPG, PNG, WEBP ou PDF.' }));
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setPaymentErrors((prev) => ({ ...prev, file: 'Arquivo muito grande. Máximo 10 MB.' }));
      setSelectedFile(null);
      return;
    }
    setPaymentErrors((prev) => ({ ...prev, file: undefined }));
    setSelectedFile(file);
  };

  const handlePayDebt = async () => {
    if (!selectedDebt) return;
    const amount = Number(paymentForm.amount);
    const errors: typeof paymentErrors = {};
    if (!amount || amount <= 0) errors.amount = 'Informe um valor válido.';
    else if (!validatePayableDebtPaymentAmount(amount, selectedDebt.remainingAmount)) errors.amount = 'Valor não pode ser maior que o saldo.';
    if (Object.keys(errors).length) { setPaymentErrors(errors); return; }
    setPaymentErrors({});
    setIsPayingDebt(true);
    let attachmentPath: string | undefined;
    let attachmentMime: string | undefined;
    let attachmentName: string | undefined;
    let attachmentSize: number | undefined;
    try {
      if (selectedFile) {
        const ext = selectedFile.name.split('.').pop() || 'bin';
        const path = `${selectedDebt.creditorId}/${selectedDebt.id}/payment-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('payable-debt-receipts')
          .upload(path, selectedFile, { contentType: selectedFile.type, upsert: false });
        if (uploadError) throw new Error(`Erro ao enviar comprovante: ${uploadError.message}`);
        attachmentPath = path;
        attachmentMime = selectedFile.type;
        attachmentName = selectedFile.name;
        attachmentSize = selectedFile.size;
      }
      await addPayableDebtPayment({
        payableDebtId: selectedDebt.id,
        amount,
        paymentMethod: paymentForm.paymentMethod,
        account: paymentForm.account,
        notes: paymentForm.notes.trim() || undefined,
        paidAt: paymentForm.paidAt ? new Date(paymentForm.paidAt + 'T12:00:00').toISOString() : undefined,
        attachmentPath,
        attachmentMime,
        attachmentName,
        attachmentSize
      });
      toast.success('Pagamento registrado com sucesso.');
      setIsPaymentModalOpen(false);
      setSelectedDebt(null);
      setSelectedFile(null);
    } catch (e: any) {
      if (attachmentPath) {
        await supabase.storage.from('payable-debt-receipts').remove([attachmentPath]).catch(() => {});
      }
      toast.error(e?.message || 'Não foi possível registrar o pagamento.');
    } finally {
      setIsPayingDebt(false);
    }
  };

  const handleRevertPayment = async () => {
    if (!paymentToRevert) return;
    setIsRevertingPayment(true);
    try {
      if (paymentToRevert.attachmentPath) {
        await supabase.storage.from('payable-debt-receipts').remove([paymentToRevert.attachmentPath]).catch(() => {});
      }
      await revertPayableDebtPayment(paymentToRevert.id);
      toast.success('Pagamento estornado e valor devolvido à dívida.');
      setPaymentToRevert(null);
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível estornar o pagamento.');
    } finally {
      setIsRevertingPayment(false);
    }
  };

  const handleViewReceipt = async (path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('payable-debt-receipts')
        .createSignedUrl(path, 300);
      if (error || !data?.signedUrl) throw new Error('Não foi possível gerar o link do comprovante.');
      setViewingReceiptUrl(data.signedUrl);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao abrir comprovante.');
    }
  };

  // ----- Derived state -----
  const creditorById = useMemo(() => {
    const map = new Map<string, string>();
    creditors.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [creditors]);

  const debtRows = useMemo(() => {
    const filtered = filterPayableDebts(payableDebts, { searchTerm, statusFilter, onlyOverdue, creditorById });
    return filtered.sort((a, b) => {
      const overdueA = isPayableDebtOverdue(a) ? 1 : 0;
      const overdueB = isPayableDebtOverdue(b) ? 1 : 0;
      if (overdueA !== overdueB) return overdueB - overdueA;
      const statusWeight: Record<PayableDebtStatus, number> = { Aberta: 3, Parcial: 2, Quitada: 1 };
      if (a.status !== b.status) return statusWeight[b.status] - statusWeight[a.status];
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [payableDebts, creditorById, searchTerm, statusFilter, onlyOverdue]);

  const paymentTimelineByDebt = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getPayableDebtPayments>>();
    debtRows.forEach((debt) => map.set(debt.id, getPayableDebtPayments(debt.id)));
    return map;
  }, [debtRows, getPayableDebtPayments]);

  const summary = useMemo(() => calculatePayableDebtSummary(payableDebts), [payableDebts]);

  const creditorOptions = useMemo(
    () => creditors.map((c) => ({ value: c.id, label: c.name })),
    [creditors]
  );

  const handleExport = () => {
    const headers = ['credor', 'status', 'valor_original', 'saldo', 'parcelas', 'primeiro_vencimento', 'observacao'];
    const rows = debtRows.map((d) => [
      creditorById.get(d.creditorId) || d.creditorName,
      d.status,
      d.originalAmount.toFixed(2),
      d.remainingAmount.toFixed(2),
      String(d.installmentsTotal || 1),
      d.firstDueDate || d.dueDate || '',
      d.notes || ''
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `dividas_ativas_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-5 md:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h2 className="text-[28px] md:text-ios-large font-bold text-gray-900 dark:text-white tracking-tight">Dívidas Ativas</h2>
          <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-0.5">Contas a pagar para credores externos</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExport} className="ios-button-secondary flex items-center gap-2">
            <Download size={16} />
            Exportar
          </button>
          <button onClick={openNewCreditorModal} className="ios-button-secondary flex items-center gap-2">
            <Plus size={16} />
            Novo credor
          </button>
          <button onClick={openNewDebtModal} className="ios-button-primary flex items-center gap-2">
            <Plus size={18} />
            Nova dívida ativa
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="ios-card p-5">
          <p className="text-ios-footnote text-gray-500 mb-1">Total a Pagar</p>
          <p className="text-ios-title-2 font-bold text-red-600">{formatCurrency(summary.openAmount)}</p>
        </div>
        <div className="ios-card p-5">
          <p className="text-ios-footnote text-gray-500 mb-1">Vencidas</p>
          <p className="text-ios-title-2 font-bold text-red-700">{formatCurrency(summary.overdueAmount)}</p>
        </div>
        <div className="ios-card p-5">
          <p className="text-ios-footnote text-gray-500 mb-1">Quitadas (Histórico)</p>
          <p className="text-ios-title-2 font-bold text-green-600">{formatCurrency(summary.settledAmount)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="ios-card p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
          <input
            type="text"
            className="ios-input pl-10"
            placeholder="Buscar por credor ou observação..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select className="ios-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as PayableDebtStatus | 'all')}>
            <option value="all">Todos os status</option>
            <option value="Aberta">Aberta</option>
            <option value="Parcial">Parcial</option>
            <option value="Quitada">Quitada</option>
          </select>
          <label className="flex items-center gap-2 text-ios-subhead text-gray-700 dark:text-surface-dark-700">
            <input type="checkbox" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} />
            Apenas vencidas
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
        </div>
      </div>

      {/* Table */}
      <div className="ios-card overflow-hidden">
        {isMobile ? (
          <div className="p-4 space-y-3">
            {debtRows.map((debt) => {
              const payments = paymentTimelineByDebt.get(debt.id) || [];
              const deadlineBadge = getPayableDebtDeadlineBadge(debt, payments);
              return (
                <div key={debt.id} className={`ios-card p-4 space-y-3 ${isPayableDebtOverdue(debt) ? 'bg-red-50/40 dark:bg-red-900/10' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-gray-900 dark:text-white wrap-break-word min-w-0 flex-1">
                      {creditorById.get(debt.creditorId) || debt.creditorName}
                    </p>
                    <p className="font-bold text-red-600 shrink-0">{formatCurrency(debt.remainingAmount)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`ios-badge ${deadlineBadgeClass[deadlineBadge]}`}>{deadlineBadge}</span>
                    <span className={statusBadgeClass[debt.status]}>{debt.status}</span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-700 dark:text-surface-dark-700">
                    <p>Valor original: {formatCurrency(debt.originalAmount)}</p>
                    <p>1º Vencimento: {formatDate(getPayableDebtDueDate(debt))}</p>
                    {debt.notes && <p className="whitespace-pre-wrap wrap-break-word">Obs: {debt.notes}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => openEditDebtModal(debt)} className="ios-button-secondary inline-flex items-center justify-center gap-2">
                      <Pencil size={14} />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => openPaymentModal(debt)}
                      disabled={debt.status === 'Quitada'}
                      className="ios-button-secondary disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                    >
                      <HandCoins size={14} />
                      Pagar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDebtToDelete(debt)}
                      className="col-span-2 ios-button-destructive inline-flex items-center justify-center gap-2"
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
                Nenhuma dívida ativa encontrada.
              </div>
            )}
          </div>
        ) : (
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[13%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[13%]" />
            </colgroup>
            <thead className="bg-gray-50 dark:bg-surface-dark-200 text-xs uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">
              <tr>
                <th className="text-left px-3 py-3 font-semibold">Credor</th>
                <th className="text-left px-3 py-3 font-semibold">Prazo</th>
                <th className="text-left px-3 py-3 font-semibold">Situação</th>
                <th className="text-right px-3 py-3 font-semibold">Valor Orig.</th>
                <th className="text-right px-3 py-3 font-semibold">Saldo</th>
                <th className="text-left px-3 py-3 font-semibold">1º Venc.</th>
                <th className="text-right px-3 py-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-300">
              {debtRows.map((debt) => {
                const payments = paymentTimelineByDebt.get(debt.id) || [];
                const deadlineBadge = getPayableDebtDeadlineBadge(debt, payments);
                return (
                  <tr
                    key={debt.id}
                    className={`hover:bg-gray-50/80 dark:hover:bg-surface-dark-200/60 transition-colors ${isPayableDebtOverdue(debt) ? 'bg-red-50/40 dark:bg-red-900/10' : ''}`}
                  >
                    <td className="px-3 py-3 font-semibold text-gray-900 dark:text-white text-sm wrap-break-word">
                      {creditorById.get(debt.creditorId) || debt.creditorName}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`ios-badge ${deadlineBadgeClass[deadlineBadge]} text-xs`}>{deadlineBadge}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`${statusBadgeClass[debt.status]} text-xs`}>{debt.status}</span>
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-medium text-gray-700 dark:text-surface-dark-700">{formatCurrency(debt.originalAmount)}</td>
                    <td className="px-3 py-3 text-right text-sm font-bold text-red-600">{formatCurrency(debt.remainingAmount)}</td>
                    <td className="px-3 py-3 text-sm text-gray-700 dark:text-surface-dark-700">{formatDate(getPayableDebtDueDate(debt))}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button type="button" onClick={() => openEditDebtModal(debt)} className="ios-button-secondary inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5">
                          <Pencil size={12} />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => openPaymentModal(debt)}
                          disabled={debt.status === 'Quitada'}
                          className="ios-button-secondary disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5"
                        >
                          <HandCoins size={12} />
                          Pagar
                        </button>
                        <button type="button" onClick={() => setDebtToDelete(debt)} className="ios-button-destructive inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5">
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
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500 dark:text-surface-dark-500">
                    Nenhuma dívida ativa encontrada com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Creditor Modal */}
      <Modal
        open={isCreditorModalOpen}
        onClose={() => { if (!isSavingCreditor) { setIsCreditorModalOpen(false); setEditingCreditor(null); resetCreditorForm(); } }}
        title={editingCreditor ? 'Editar Credor' : 'Novo Credor'}
        size="md"
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button type="button" className="ios-button-secondary w-full sm:w-auto" onClick={() => { setIsCreditorModalOpen(false); setEditingCreditor(null); resetCreditorForm(); }} disabled={isSavingCreditor}>
              Cancelar
            </button>
            <button type="button" className="ios-button-primary w-full sm:w-auto" onClick={handleSaveCreditor} disabled={isSavingCreditor}>
              {isSavingCreditor ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="ios-label">Nome <span className="text-red-500">*</span></label>
            <input type="text" className="ios-input" value={creditorForm.name} onChange={(e) => setCreditorForm((p) => ({ ...p, name: e.target.value.toUpperCase() }))} placeholder="Nome do credor" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="ios-label">Tipo de documento</label>
              <select className="ios-input" value={creditorForm.documentType} onChange={(e) => setCreditorForm((p) => ({ ...p, documentType: e.target.value as '' | 'CPF' | 'CNPJ' }))}>
                <option value="">Sem tipo</option>
                <option value="CPF">CPF</option>
                <option value="CNPJ">CNPJ</option>
              </select>
            </div>
            <div>
              <label className="ios-label">Documento (opcional)</label>
              <input type="text" className="ios-input" value={creditorForm.document} onChange={(e) => setCreditorForm((p) => ({ ...p, document: e.target.value }))} placeholder="000.000.000-00" />
            </div>
            <div>
              <label className="ios-label">Telefone (opcional)</label>
              <input type="text" className="ios-input" value={creditorForm.phone} onChange={(e) => setCreditorForm((p) => ({ ...p, phone: e.target.value }))} placeholder="(00) 00000-0000" />
            </div>
            <div>
              <label className="ios-label">Email (opcional)</label>
              <input type="email" className="ios-input" value={creditorForm.email} onChange={(e) => setCreditorForm((p) => ({ ...p, email: e.target.value }))} placeholder="credor@email.com" />
            </div>
          </div>
          <div>
            <label className="ios-label">Observações</label>
            <textarea className="ios-input min-h-20" value={creditorForm.notes} onChange={(e) => setCreditorForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Informações adicionais..." />
          </div>
          {editingCreditor && (
            <div className="pt-2 border-t border-gray-200 dark:border-surface-dark-300">
              <button
                type="button"
                onClick={() => { setCreditorToDelete(editingCreditor); setIsCreditorModalOpen(false); }}
                className="ios-button-destructive inline-flex items-center gap-2 text-sm"
              >
                <Trash2 size={14} />
                Excluir credor
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* Debt Modal */}
      <Modal
        open={isDebtModalOpen}
        onClose={() => { if (!isSavingDebt) { setIsDebtModalOpen(false); setEditingDebt(null); resetDebtForm(); setDebtErrors({}); } }}
        title={editingDebt ? 'Editar Dívida Ativa' : 'Nova Dívida Ativa'}
        size="lg"
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button type="button" className="ios-button-secondary w-full sm:w-auto" onClick={() => { setIsDebtModalOpen(false); setEditingDebt(null); resetDebtForm(); setDebtErrors({}); }} disabled={isSavingDebt}>
              Cancelar
            </button>
            <button type="button" className="ios-button-primary w-full sm:w-auto" onClick={handleSaveDebt} disabled={isSavingDebt}>
              {isSavingDebt ? 'Salvando...' : editingDebt ? 'Salvar alterações' : 'Cadastrar dívida'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="ios-label">Credor <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              <select
                className={`ios-input flex-1 ${debtErrors.creditorId ? 'border-red-500' : ''}`}
                value={debtForm.creditorId}
                onChange={(e) => { setDebtForm((p) => ({ ...p, creditorId: e.target.value })); setDebtErrors((p) => ({ ...p, creditorId: undefined })); }}
              >
                <option value="">Selecione um credor...</option>
                {creditorOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <button type="button" onClick={openNewCreditorModal} className="ios-button-secondary shrink-0 flex items-center gap-1.5 text-sm px-3">
                <Plus size={14} />
                Novo
              </button>
            </div>
            {debtErrors.creditorId && <p className="text-xs text-red-600 mt-1">{debtErrors.creditorId}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="ios-label">Valor <span className="text-red-500">*</span></label>
              <input
                type="number"
                className={`ios-input ${debtErrors.amount ? 'border-red-500' : ''}`}
                min={0.01}
                step="0.01"
                value={debtForm.amount}
                onChange={(e) => { setDebtForm((p) => ({ ...p, amount: e.target.value })); setDebtErrors((p) => ({ ...p, amount: undefined })); }}
                placeholder="0,00"
              />
              {debtErrors.amount && <p className="text-xs text-red-600 mt-1">{debtErrors.amount}</p>}
            </div>
            <div>
              <label className="ios-label">Parcelas</label>
              <input type="number" min={1} step={1} className="ios-input" value={debtForm.installmentsTotal} onChange={(e) => setDebtForm((p) => ({ ...p, installmentsTotal: e.target.value }))} />
            </div>
            <div>
              <label className="ios-label">1º Vencimento (opcional)</label>
              <input type="date" className="ios-input" value={debtForm.firstDueDate} onChange={(e) => setDebtForm((p) => ({ ...p, firstDueDate: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="ios-label">Observação</label>
            <textarea className="ios-input min-h-24" value={debtForm.notes} onChange={(e) => setDebtForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Descrição da dívida, condições, etc..." />
          </div>
        </div>
      </Modal>

      {/* Payment Modal */}
      <Modal
        open={isPaymentModalOpen}
        onClose={() => { if (!isPayingDebt) { setIsPaymentModalOpen(false); setSelectedDebt(null); setSelectedFile(null); setPaymentErrors({}); } }}
        title="Registrar Pagamento"
        size="lg"
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button type="button" className="ios-button-secondary w-full sm:w-auto" onClick={() => { setIsPaymentModalOpen(false); setSelectedDebt(null); setSelectedFile(null); setPaymentErrors({}); }} disabled={isPayingDebt}>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="ios-card p-3">
                <p className="text-xs text-gray-500 mb-1">Credor</p>
                <p className="font-semibold text-gray-900 dark:text-white text-sm wrap-break-word">
                  {creditorById.get(selectedDebt.creditorId) || selectedDebt.creditorName}
                </p>
              </div>
              <div className="ios-card p-3">
                <p className="text-xs text-gray-500 mb-1">Saldo Atual</p>
                <p className="font-bold text-red-600 text-sm flex items-center gap-1">
                  <Wallet size={14} />
                  {formatCurrency(selectedDebt.remainingAmount)}
                </p>
              </div>
              <div className="ios-card p-3">
                <p className="text-xs text-gray-500 mb-1">Vencimento</p>
                <p className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-1">
                  <Calendar size={14} />
                  {formatDate(getPayableDebtDueDate(selectedDebt))}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="ios-label">Valor do Pagamento</label>
                <input
                  type="number"
                  className={`ios-input ${paymentErrors.amount ? 'border-red-500' : ''}`}
                  value={paymentForm.amount}
                  onChange={(e) => { setPaymentForm((p) => ({ ...p, amount: e.target.value })); setPaymentErrors((p) => ({ ...p, amount: undefined })); }}
                  min={0.01}
                  max={selectedDebt.remainingAmount}
                  step="0.01"
                />
                {paymentErrors.amount && <p className="text-xs text-red-600 mt-1">{paymentErrors.amount}</p>}
              </div>
              <div>
                <label className="ios-label">Data do Pagamento</label>
                <input type="date" className="ios-input" value={paymentForm.paidAt} onChange={(e) => setPaymentForm((p) => ({ ...p, paidAt: e.target.value }))} />
              </div>
              <div>
                <label className="ios-label">Forma de Pagamento</label>
                <select className="ios-input" value={paymentForm.paymentMethod} onChange={(e) => setPaymentForm((p) => ({ ...p, paymentMethod: e.target.value as 'Pix' | 'Dinheiro' | 'Cartão' }))}>
                  <option value="Pix">Pix</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Cartão">Cartão</option>
                </select>
              </div>
              <div>
                <label className="ios-label">Conta de Saída</label>
                <select className="ios-input" value={paymentForm.account} onChange={(e) => setPaymentForm((p) => ({ ...p, account: e.target.value as 'Conta Bancária' | 'Cofre' }))}>
                  <option value="Conta Bancária">Conta Bancária</option>
                  <option value="Cofre">Cofre</option>
                </select>
              </div>
            </div>

            <div>
              <label className="ios-label">Observação</label>
              <textarea className="ios-input min-h-20" value={paymentForm.notes} onChange={(e) => setPaymentForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Observação opcional" />
            </div>

            <div>
              <label className="ios-label">Comprovante (opcional)</label>
              <div
                className="border-2 border-dashed border-gray-300 dark:border-surface-dark-300 rounded-ios p-4 text-center cursor-pointer hover:border-brand-400 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip size={16} className="text-brand-500 shrink-0" />
                      <span className="text-sm text-gray-900 dark:text-white truncate">{selectedFile.name}</span>
                      <span className="text-xs text-gray-500">({(selectedFile.size / 1024).toFixed(0)} KB)</span>
                    </div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="shrink-0 p-1 hover:bg-gray-100 rounded">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Paperclip size={20} className="text-gray-400" />
                    <p className="text-sm text-gray-500">Clique para anexar comprovante</p>
                    <p className="text-xs text-gray-400">JPG, PNG, WEBP ou PDF · máx 10 MB</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={handleFileChange} />
              {paymentErrors.file && <p className="text-xs text-red-600 mt-1">{paymentErrors.file}</p>}
            </div>

            {/* Payment history */}
            <div className="ios-card p-4">
              <p className="text-ios-footnote text-gray-500 mb-2">Histórico de pagamentos</p>
              {(paymentTimelineByDebt.get(selectedDebt.id) || []).length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum pagamento registrado.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(paymentTimelineByDebt.get(selectedDebt.id) || []).map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between gap-3 rounded-ios border border-gray-200 dark:border-surface-dark-300 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white wrap-break-word">{payment.paymentMethod} • {payment.account}</p>
                        <p className="text-xs text-gray-500">{new Date(payment.paidAt).toLocaleString('pt-BR')}</p>
                        {payment.attachmentPath && (
                          <button type="button" onClick={() => handleViewReceipt(payment.attachmentPath!)} className="text-xs text-brand-500 hover:underline flex items-center gap-1 mt-0.5">
                            <Paperclip size={11} />
                            Ver comprovante
                          </button>
                        )}
                      </div>
                      <p className="font-bold text-red-600 flex items-center gap-1 shrink-0">
                        - {formatCurrency(payment.amount)}
                      </p>
                      <button
                        type="button"
                        onClick={() => setPaymentToRevert(payment)}
                        className="shrink-0 inline-flex items-center gap-1 rounded-ios border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 px-2 py-1 text-xs font-semibold text-red-600 dark:text-red-300 hover:bg-red-100 transition-colors"
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

      {/* Receipt viewer */}
      {viewingReceiptUrl && (
        <Modal
          open={!!viewingReceiptUrl}
          onClose={() => setViewingReceiptUrl(null)}
          title="Comprovante"
          size="lg"
        >
          {viewingReceiptUrl.includes('.pdf') || viewingReceiptUrl.includes('application/pdf') ? (
            <iframe src={viewingReceiptUrl} className="w-full h-96 rounded-ios" title="Comprovante" />
          ) : (
            <img src={viewingReceiptUrl} alt="Comprovante" className="w-full rounded-ios object-contain max-h-96" />
          )}
        </Modal>
      )}

      {/* Revert payment confirm */}
      <ConfirmDialog
        open={!!paymentToRevert}
        onClose={() => { if (!isRevertingPayment) setPaymentToRevert(null); }}
        title="Estornar pagamento"
        description={
          paymentToRevert
            ? `Confirmar estorno de ${formatCurrency(paymentToRevert.amount)} pago em ${new Date(paymentToRevert.paidAt).toLocaleString('pt-BR')}? O valor voltará para o saldo da dívida e o lançamento financeiro será removido.`
            : undefined
        }
        confirmLabel={isRevertingPayment ? 'Estornando...' : 'Estornar'}
        variant="danger"
        onConfirm={() => { void handleRevertPayment(); }}
      />

      {/* Delete debt confirm */}
      <ConfirmDialog
        open={!!debtToDelete}
        onClose={() => { if (!isDeletingDebt) setDebtToDelete(null); }}
        title="Excluir dívida"
        description={
          debtToDelete
            ? `Excluir a dívida com ${creditorById.get(debtToDelete.creditorId) || debtToDelete.creditorName}? Esta ação não pode ser desfeita. Estorne todos os pagamentos antes de excluir.`
            : undefined
        }
        confirmLabel={isDeletingDebt ? 'Excluindo...' : 'Excluir dívida'}
        variant="danger"
        onConfirm={() => { void handleDeleteDebt(); }}
      />

      {/* Delete creditor confirm */}
      <ConfirmDialog
        open={!!creditorToDelete}
        onClose={() => setCreditorToDelete(null)}
        title="Excluir credor"
        description={creditorToDelete ? `Excluir o credor "${creditorToDelete.name}"? Esta ação só é permitida se não houver dívidas ativas em aberto.` : undefined}
        confirmLabel="Excluir credor"
        variant="danger"
        onConfirm={async () => {
          if (!creditorToDelete) return;
          try {
            await removeCreditor(creditorToDelete.id);
            toast.success('Credor excluído.');
          } catch (e: any) {
            toast.error(e?.message || 'Não foi possível excluir o credor.');
          }
          setCreditorToDelete(null);
        }}
      />
    </div>
  );
};

export default PayableDebts;
