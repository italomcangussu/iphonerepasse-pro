import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Edit, Filter, RotateCcw, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../services/dataContext';
import { PaymentMethod, Sale } from '../types';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Modal from '../components/ui/Modal';
import IOSButton from '../components/ui/IOSButton';
import { useToast } from '../components/ui/ToastProvider';

type PeriodPreset = 'today' | 'last7' | 'custom';
type SaleState = 'completed' | 'debt' | 'warranty_active' | 'warranty_expired';
type SaleStateFilter = 'all' | SaleState;
type PaymentFilter = 'all' | PaymentMethod['type'];

const formatDateForInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseStartDate = (value: string) => new Date(`${value}T00:00:00`);
const parseEndDate = (value: string) => new Date(`${value}T23:59:59.999`);

const getSaleState = (sale: Sale, now: Date): SaleState => {
  if (sale.paymentMethods.some((payment) => payment.type === 'Devedor')) {
    return 'debt';
  }

  if (sale.warrantyExpiresAt) {
    const warrantyDate = new Date(sale.warrantyExpiresAt);
    if (!Number.isNaN(warrantyDate.getTime())) {
      return warrantyDate >= now ? 'warranty_active' : 'warranty_expired';
    }
  }

  return 'completed';
};

const getOriginalSubtotal = (sale: Sale): number =>
  sale.originalSubtotal ??
  sale.items.reduce((acc, item) => acc + Number(item.originalSellPrice ?? item.sellPrice ?? 0), 0);

const getNegotiatedSubtotal = (sale: Sale): number =>
  sale.negotiatedSubtotal ??
  sale.items.reduce((acc, item) => acc + Number(item.sellPrice || 0), 0);

const hasNegotiationSnapshot = (sale: Sale): boolean => {
  const original = getOriginalSubtotal(sale);
  const negotiated = getNegotiatedSubtotal(sale);
  return Math.abs(original - negotiated) > 0.009 || Number(sale.discount || 0) > 0;
};

const PDVHistory: React.FC = () => {
  const { sales, stores, sellers, customers, removeSale, updateSale } = useData();
  const { profile, role } = useAuth();
  const toast = useToast();
  const isMobile = useIsMobileViewport();
  const isAdmin = role === 'admin';

  const todayStr = useMemo(() => formatDateForInput(new Date()), []);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('last7');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return formatDateForInput(d);
  });
  const [endDate, setEndDate] = useState(todayStr);
  const [showFilters, setShowFilters] = useState(true);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<SaleStateFilter>('all');
  const [selectedPayment, setSelectedPayment] = useState<PaymentFilter>('all');
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null);
  const [isCancellingSale, setIsCancellingSale] = useState(false);
  const [isUpdatingSale, setIsUpdatingSale] = useState(false);

  const sellersById = useMemo(() => new Map(sellers.map((seller) => [seller.id, seller])), [sellers]);
  const storesById = useMemo(() => new Map(stores.map((store) => [store.id, store])), [stores]);
  const customersById = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);

  const defaultUserStoreId = useMemo(() => {
    if (!profile?.sellerId) return 'all';
    const seller = sellersById.get(profile.sellerId);
    return seller?.storeId || 'all';
  }, [profile?.sellerId, sellersById]);

  useEffect(() => {
    if (defaultUserStoreId === 'all') return;
    setSelectedStoreId((current) => (current === 'all' ? defaultUserStoreId : current));
  }, [defaultUserStoreId]);

  useEffect(() => {
    if (periodPreset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
      return;
    }

    if (periodPreset === 'last7') {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 6);
      setStartDate(formatDateForInput(start));
      setEndDate(formatDateForInput(end));
    }
  }, [periodPreset, todayStr]);

  const getSaleStoreId = (sale: Sale) => {
    const sellerStoreId = sellersById.get(sale.sellerId)?.storeId;
    if (sellerStoreId) return sellerStoreId;
    return sale.items[0]?.storeId || '';
  };

  const filteredSales = useMemo(() => {
    const now = new Date();
    const start = parseStartDate(startDate);
    const end = parseEndDate(endDate);

    return sales
      .filter((sale) => {
        const saleDate = new Date(sale.date);
        if (Number.isNaN(saleDate.getTime())) return false;

        if (selectedStoreId !== 'all' && getSaleStoreId(sale) !== selectedStoreId) {
          return false;
        }

        if (selectedState !== 'all' && getSaleState(sale, now) !== selectedState) {
          return false;
        }

        if (selectedPayment !== 'all' && !sale.paymentMethods.some((payment) => payment.type === selectedPayment)) {
          return false;
        }

        if (!Number.isNaN(start.getTime()) && saleDate < start) return false;
        if (!Number.isNaN(end.getTime()) && saleDate > end) return false;

        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, selectedStoreId, selectedState, selectedPayment, startDate, endDate]);

  const filteredTotal = useMemo(
    () => filteredSales.reduce((acc, sale) => acc + Number(sale.total || 0), 0),
    [filteredSales]
  );

  const getSaleStateLabel = (sale: Sale) => {
    const state = getSaleState(sale, new Date());
    if (state === 'debt') return 'Com devedor';
    if (state === 'warranty_active') return 'Garantia ativa';
    if (state === 'warranty_expired') return 'Garantia expirada';
    return 'Concluida';
  };

  const getSaleStateClass = (sale: Sale) => {
    const state = getSaleState(sale, new Date());
    if (state === 'debt') {
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300';
    }
    if (state === 'warranty_active') {
      return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300';
    }
    if (state === 'warranty_expired') {
      return 'bg-gray-200 text-gray-700 dark:bg-surface-dark-200 dark:text-surface-dark-700';
    }
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300';
  };

  const handleCancelSale = async () => {
    if (!saleToCancel) return;
    setIsCancellingSale(true);
    try {
      await removeSale(saleToCancel.id);
      toast.success('Venda cancelada e transações revertidas.');
      setSaleToCancel(null);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível cancelar a venda.');
    } finally {
      setIsCancellingSale(false);
    }
  };

  const clearFilters = () => {
    setSelectedStoreId(defaultUserStoreId === 'all' ? 'all' : defaultUserStoreId);
    setSelectedState('all');
    setSelectedPayment('all');
    setPeriodPreset('last7');
    const d = new Date();
    d.setDate(d.getDate() - 6);
    setStartDate(formatDateForInput(d));
    setEndDate(todayStr);
  };

  const handleUpdateSale = async (updates: Partial<Sale>) => {
    if (!saleToEdit) return;
    setIsUpdatingSale(true);
    try {
      await updateSale(saleToEdit.id, updates);
      toast.success('Venda atualizada com sucesso.');
      setSaleToEdit(null);
    } catch (err) {
      toast.error('Erro ao atualizar venda.');
    } finally {
      setIsUpdatingSale(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <section className="ios-card p-4 md:p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">PDV</p>
          <h1 className="text-ios-title-1 font-bold text-gray-900 dark:text-white mt-1">Historico de Vendas</h1>
          <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-1">
            {filteredSales.length} venda(s) • R$ {filteredTotal.toLocaleString('pt-BR')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="ios-button-secondary inline-flex items-center justify-center gap-2"
          >
            <Filter size={18} />
            {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </button>
          <Link to="/pdv/nova-venda" className="ios-button-primary inline-flex items-center justify-center gap-2">
            <ShoppingCart size={18} />
            Nova venda
          </Link>
        </div>
      </section>

      {showFilters && (
        <section className="ios-card p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-gray-700 dark:text-surface-dark-700">
            <Filter size={16} />
            <p className="text-ios-subhead font-semibold">Filtros</p>
          </div>
          <button type="button" onClick={clearFilters} className="ios-button-secondary text-xs md:text-sm">
            Limpar filtros
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label htmlFor="pdv-history-store-filter" className="ios-label">
              Loja
            </label>
            <select
              id="pdv-history-store-filter"
              className="ios-input"
              value={selectedStoreId}
              onChange={(event) => setSelectedStoreId(event.target.value)}
            >
              <option value="all">Todas as lojas</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="pdv-history-state-filter" className="ios-label">
              Estado
            </label>
            <select
              id="pdv-history-state-filter"
              className="ios-input"
              value={selectedState}
              onChange={(event) => setSelectedState(event.target.value as SaleStateFilter)}
            >
              <option value="all">Todos</option>
              <option value="completed">Concluida</option>
              <option value="debt">Com devedor</option>
              <option value="warranty_active">Garantia ativa</option>
              <option value="warranty_expired">Garantia expirada</option>
            </select>
          </div>

          <div>
            <label htmlFor="pdv-history-payment-filter" className="ios-label">
              Metodo de pagamento
            </label>
            <select
              id="pdv-history-payment-filter"
              className="ios-input"
              value={selectedPayment}
              onChange={(event) => setSelectedPayment(event.target.value as PaymentFilter)}
            >
              <option value="all">Todos</option>
              <option value="Pix">Pix</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="Cartão">Cartao</option>
              <option value="Devedor">Devedor</option>
            </select>
          </div>

          <div>
            <label htmlFor="pdv-history-period-filter" className="ios-label">
              Periodo
            </label>
            <select
              id="pdv-history-period-filter"
              className="ios-input"
              value={periodPreset}
              onChange={(event) => setPeriodPreset(event.target.value as PeriodPreset)}
            >
              <option value="today">Hoje</option>
              <option value="last7">Ultimos 7 dias</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="pdv-history-start-date" className="ios-label">
              Data inicial
            </label>
            <input
              id="pdv-history-start-date"
              type="date"
              className="ios-input"
              value={startDate}
              onChange={(event) => {
                setPeriodPreset('custom');
                setStartDate(event.target.value);
              }}
            />
          </div>
          <div>
            <label htmlFor="pdv-history-end-date" className="ios-label">
              Data final
            </label>
            <input
              id="pdv-history-end-date"
              type="date"
              className="ios-input"
              value={endDate}
              onChange={(event) => {
                setPeriodPreset('custom');
                setEndDate(event.target.value);
              }}
            />
          </div>
        </div>
      </section>
    )}

    <section className="ios-card overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-200 dark:border-surface-dark-200 flex items-center justify-between">
          <h2 className="text-ios-title-3 font-bold text-gray-900 dark:text-white">Vendas</h2>
          <span className="text-xs md:text-sm text-gray-500 dark:text-surface-dark-500">
            <CalendarDays size={14} className="inline mr-1" />
            {startDate} ate {endDate}
          </span>
        </div>

        {filteredSales.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-ios-body text-gray-600 dark:text-surface-dark-600">
              Nenhuma venda encontrada com os filtros atuais.
            </p>
            <Link to="/pdv/nova-venda" className="ios-button-primary inline-flex mt-4">
              Nova venda
            </Link>
          </div>
        ) : isMobile ? (
          <div className="space-y-3 p-4 md:p-6">
            {filteredSales.map((sale) => {
              const storeId = getSaleStoreId(sale);
              const storeName = storesById.get(storeId)?.name || 'Sem loja';
              const sellerName = sellersById.get(sale.sellerId)?.name || 'Sem vendedor';
              const customerName = customersById.get(sale.customerId)?.name || 'Sem cliente';
              const paymentSummary = sale.paymentMethods.map((payment) => payment.type).join(', ') || 'Sem metodo';
              const originalSubtotal = getOriginalSubtotal(sale);
              const negotiatedSubtotal = getNegotiatedSubtotal(sale);
              const hasNegotiation = hasNegotiationSnapshot(sale);
              const discount = Number(sale.discount || 0);

              return (
                <div key={sale.id} className="ios-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-surface-dark-500">
                        {new Date(sale.date).toLocaleString('pt-BR')}
                      </p>
                      <p className="text-brand-500 text-ios-footnote font-mono mt-1">#{sale.id.slice(-6).toUpperCase()}</p>
                    </div>
                    <span className="text-base font-semibold text-gray-900 dark:text-white">
                      R$ {sale.total.toLocaleString('pt-BR')}
                    </span>
                  </div>

                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getSaleStateClass(sale)}`}>
                    {getSaleStateLabel(sale)}
                  </span>

                  <div className="space-y-1 text-sm text-gray-700 dark:text-surface-dark-700">
                    <p><span className="font-semibold text-gray-900 dark:text-white">Cliente:</span> {customerName}</p>
                    <p><span className="font-semibold text-gray-900 dark:text-white">Vendedor:</span> {sellerName}</p>
                    <p><span className="font-semibold text-gray-900 dark:text-white">Loja:</span> {storeName}</p>
                    <p><span className="font-semibold text-gray-900 dark:text-white">Método:</span> {paymentSummary}</p>
                    {hasNegotiation && (
                      <p>
                        <span className="font-semibold text-gray-900 dark:text-white">Negociação:</span>{' '}
                        R$ {originalSubtotal.toLocaleString('pt-BR')} {'->'} R$ {negotiatedSubtotal.toLocaleString('pt-BR')}
                        {discount > 0 ? ` (-R$ ${discount.toLocaleString('pt-BR')})` : ''}
                      </p>
                    )}
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setSaleToCancel(sale)}
                      className="inline-flex items-center gap-1.5 rounded-ios border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    >
                      <RotateCcw size={12} />
                      Cancelar venda
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-ios-footnote text-gray-500 border-b border-gray-200 dark:border-surface-dark-200 bg-gray-50 dark:bg-surface-dark-200">
                  <th className="p-4 font-medium">Data</th>
                  <th className="p-4 font-medium">Venda</th>
                  <th className="p-4 font-medium">Loja</th>
                  <th className="p-4 font-medium">Vendedor</th>
                  <th className="p-4 font-medium">Cliente</th>
                  <th className="p-4 font-medium">Metodo</th>
                  <th className="p-4 font-medium text-right">Total</th>
                  <th className="p-4 font-medium">Estado</th>
                  {isAdmin && <th className="p-4 font-medium"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-200">
                {filteredSales.map((sale) => {
                  const storeId = getSaleStoreId(sale);
                  const storeName = storesById.get(storeId)?.name || 'Sem loja';
                  const sellerName = sellersById.get(sale.sellerId)?.name || 'Sem vendedor';
                  const customerName = customersById.get(sale.customerId)?.name || 'Sem cliente';
                  const paymentSummary = sale.paymentMethods.map((payment) => payment.type).join(', ') || 'Sem metodo';
                  const originalSubtotal = getOriginalSubtotal(sale);
                  const negotiatedSubtotal = getNegotiatedSubtotal(sale);
                  const hasNegotiation = hasNegotiationSnapshot(sale);
                  const discount = Number(sale.discount || 0);

                  return (
                    <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors">
                      <td className="p-4 text-ios-subhead text-gray-700 dark:text-surface-dark-700">
                        {new Date(sale.date).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-4 text-brand-500 text-ios-footnote font-mono">#{sale.id.slice(-6).toUpperCase()}</td>
                      <td className="p-4 text-ios-subhead text-gray-900 dark:text-white">{storeName}</td>
                      <td className="p-4 text-ios-subhead text-gray-900 dark:text-white">{sellerName}</td>
                      <td className="p-4 text-ios-subhead text-gray-900 dark:text-white">{customerName}</td>
                      <td className="p-4 text-ios-subhead text-gray-700 dark:text-surface-dark-700">{paymentSummary}</td>
                      <td className="p-4 text-right text-ios-subhead font-semibold text-gray-900 dark:text-white">
                        <p>R$ {sale.total.toLocaleString('pt-BR')}</p>
                        {hasNegotiation && (
                          <p className="text-[11px] font-normal text-gray-500 dark:text-surface-dark-500 mt-1">
                            R$ {originalSubtotal.toLocaleString('pt-BR')} {'->'} R$ {negotiatedSubtotal.toLocaleString('pt-BR')}
                            {discount > 0 ? ` (-R$ ${discount.toLocaleString('pt-BR')})` : ''}
                          </p>
                        )}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getSaleStateClass(sale)}`}
                        >
                          {getSaleStateLabel(sale)}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSaleToEdit(sale)}
                              className="inline-flex items-center gap-1.5 rounded-ios border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors whitespace-nowrap"
                            >
                              <Edit size={12} />
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => setSaleToCancel(sale)}
                              className="inline-flex items-center gap-1.5 rounded-ios border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors whitespace-nowrap"
                            >
                              <RotateCcw size={12} />
                              Cancelar
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

      <SaleEditModal
        open={!!saleToEdit}
        onClose={() => setSaleToEdit(null)}
        sale={saleToEdit}
        onSave={handleUpdateSale}
      />

      <ConfirmDialog
        open={!!saleToCancel}
        onClose={() => {
          if (!isCancellingSale) setSaleToCancel(null);
        }}
        title="Cancelar venda"
        description={
          saleToCancel
            ? `Confirmar cancelamento da venda #${saleToCancel.id.slice(-6).toUpperCase()} de R$ ${saleToCancel.total.toLocaleString('pt-BR')}? Todas as transações financeiras, dívidas e itens de estoque serão revertidos.`
            : undefined
        }
        confirmLabel={isCancellingSale ? 'Cancelando...' : 'Cancelar venda'}
        variant="danger"
        onConfirm={() => {
          void handleCancelSale();
        }}
      />
    </div>
  );
};

interface SaleEditModalProps {
  open: boolean;
  onClose: () => void;
  sale: Sale | null;
  onSave: (updates: Partial<Sale>) => Promise<void>;
}

const SaleEditModal: React.FC<SaleEditModalProps> = ({ open, onClose, sale, onSave }) => {
  const { customers, sellers } = useData();
  const [customerId, setCustomerId] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open && sale) {
      setCustomerId(sale.customerId);
      setSellerId(sale.sellerId);
      setNotes(sale.notes || '');
    }
  }, [open, sale]);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave({ customerId, sellerId, notes });
    setIsSaving(false);
  };

  if (!sale) return null;

  return (
    <Modal open={open} onClose={onClose} title="Editar Venda" size="md">
      <div className="space-y-4">
        <div>
          <label className="ios-label">Cliente</label>
          <select className="ios-input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="ios-label">Vendedor</label>
          <select className="ios-input" value={sellerId} onChange={(e) => setSellerId(e.target.value)}>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="ios-label">Observações</label>
          <textarea
            className="ios-input min-h-[100px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações internas da venda..."
          />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <IOSButton variant="secondary" onClick={onClose}>
            Cancelar
          </IOSButton>
          <IOSButton variant="primary" onClick={handleSave} loading={isSaving}>
            Salvar Alterações
          </IOSButton>
        </div>
      </div>
    </Modal>
  );
};

export default PDVHistory;
