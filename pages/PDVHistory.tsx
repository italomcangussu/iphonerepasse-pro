import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDisclosure } from '../hooks/useDisclosure';
import { CalendarDays, Copy, Edit, Eye, Filter, MessageCircle, Printer, RotateCcw, Search, ShoppingCart, User, Users, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../services/dataContext';
import { useSalesHistoryDemand } from '../hooks/useDataGroupDemand';
import { BusinessProfile, Condition, PaymentMethod, Sale } from '../types';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import DesktopContextMenuHost from '../components/ui/DesktopContextMenu';
import Modal from '../components/ui/Modal';
import IOSButton from '../components/ui/IOSButton';
import Pagination from '../components/ui/Pagination';
import type { ContextMenuAction } from '../components/ui/contextMenuCore';
import SaleCompleteEditModal from '../components/SaleCompleteEditModal';
import { useToast } from '../components/ui/ToastProvider';
import { useAsyncHandler } from '../hooks/useAsyncHandler';
import { usePaginatedRows } from '../hooks/usePaginatedRows';
import { useDesktopContextMenu } from '../hooks/useDesktopContextMenu';
import { formatCpfOrCnpj, formatCurrencyBRL, getCpfOrCnpjLabel } from '../utils/inputMasks';
import { formatBirthdayLabel } from '../utils/birthday';
import { roundCurrency } from '../utils/pdvPricing';
import { sendReceiptWhatsApp } from '../utils/sendReceiptWhatsApp';
import { asWhatsAppSendError, whatsAppSendErrorToastText } from '../utils/whatsappSendError';
import { formatSaleNumber } from '../utils/saleCode';
import { getTradeInObservations } from '../utils/observations';
import { ObservationsList } from '../components/ObservationsList';
import { buildSaleReceiptBuffer, useThermalPrinter } from '../utils/thermalPrinter';
import {
  buildCustomerReceiptFields,
  buildSaleReceiptData,
  getItemWarrantyLabel,
  getNegotiatedSubtotal,
  getPaymentCustomerAmount,
  getPaymentLabel,
  getSaleFinancialPaymentTotal,
  getSaleHistoryTotal,
  getSalePaidTotal,
  getSaleTradeInSubtotal,
  getSaleTradeIns,
  toReceiptCustomer,
  type ReceiptCustomerInfo
} from '../utils/receiptData';
import { buildSaleSearchIndex, matchesSaleSearch } from '../utils/saleSearch';
import { useReceiptPrint } from '../hooks/useReceiptPrint';
import type { ReceiptPrintLayout } from '../utils/receiptPdf';

type PeriodPreset = 'today' | 'last7' | 'custom';
type SaleState = 'completed' | 'debt' | 'warranty_active' | 'warranty_expired';
type SaleStateFilter = 'all' | SaleState;
type ConditionFilter = 'all' | Condition;
type PaymentFilter = 'all' | PaymentMethod['type'];
const PDV_HISTORY_PAGE_SIZE_MOBILE = 10;
const PDV_HISTORY_PAGE_SIZE_DESKTOP = 25;

const formatDateForInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseStartDate = (value: string) => new Date(`${value}T00:00:00`);
const parseEndDate = (value: string) => new Date(`${value}T23:59:59.999`);

const formatCurrency = (value: number): string => formatCurrencyBRL(roundCurrency(value));

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
  sale.originalSubtotal ?? sale.items.reduce((acc, item) => acc + Number(item.originalSellPrice ?? item.sellPrice ?? 0), 0);

const hasNegotiationSnapshot = (sale: Sale): boolean => {
  const original = getOriginalSubtotal(sale);
  const negotiated = getNegotiatedSubtotal(sale);
  return Math.abs(original - negotiated) > 0.009 || Number(sale.discount || 0) > 0;
};

const getSaleItemsSummary = (sale: Sale): string =>
  sale.items
    .map((item) => [item.model, item.capacity].filter(Boolean).join(' ').trim())
    .filter(Boolean)
    .join(', ');

const PDVHistory: React.FC = () => {
  const { sales, stores, sellers, customers, businessProfile, removeSale, updateSale } = useData();
  const salesHistoryLoading = useSalesHistoryDemand();
  const { profile, role } = useAuth();
  const toast = useToast();
  const run = useAsyncHandler();
  const isCompactLayout = useIsMobileViewport(1023);
  const isAdmin = role === 'admin';
  const contextMenu = useDesktopContextMenu();

  const todayStr = useMemo(() => formatDateForInput(new Date()), []);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('last7');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return formatDateForInput(d);
  });
  const [endDate, setEndDate] = useState(todayStr);
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  const [selectedSellerId, setSelectedSellerId] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<SaleStateFilter>('all');
  const [selectedCondition, setSelectedCondition] = useState<ConditionFilter>('all');
  const [selectedPayment, setSelectedPayment] = useState<PaymentFilter>('all');
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [saleToView, setSaleToView] = useState<Sale | null>(null);
  const [saleToPrint, setSaleToPrint] = useState<Sale | null>(null);
  const { isOpen: isPrintFormatModalOpen, open: openPrintFormatModal, close: closePrintFormatModal } = useDisclosure();
  const [receiptPrintLayout, setReceiptPrintLayout] = useState<ReceiptPrintLayout>('80mm');
  const [saleToEditComplete, setSaleToEditComplete] = useState<Sale | null>(null);
  const [isCancellingSale, setIsCancellingSale] = useState(false);
  const [sendingReceiptSaleId, setSendingReceiptSaleId] = useState<string | null>(null);

  const thermalPrinter = useThermalPrinter();
  const { printReceipt } = useReceiptPrint({
    armManualPrint: Boolean(saleToPrint),
    layout: receiptPrintLayout,
    logoUrl: businessProfile?.logoUrl
  });

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
    if (sale.storeId) return sale.storeId;
    if (sale.items[0]?.storeId) return sale.items[0].storeId;
    const sellerStoreId = sellersById.get(sale.sellerId)?.storeId;
    return sellerStoreId || '';
  };

  const getStoreName = (sale: Sale) => {
    const storeId = getSaleStoreId(sale);
    return storesById.get(storeId)?.name || 'Sem loja';
  };

  const getSellerName = (sale: Sale) => sellersById.get(sale.sellerId)?.name || 'Sem vendedor';
  const getCustomerName = (sale: Sale) => customersById.get(sale.customerId)?.name || 'Sem cliente';

  /**
   * Índice de busca por venda. Montar o texto é a parte cara, então ele não
   * pode depender de `searchTerm` — a cada tecla só sobra o `includes`.
   */
  const searchIndexBySaleId = useMemo(() => {
    const index = new Map<string, ReturnType<typeof buildSaleSearchIndex>>();
    for (const sale of sales) {
      index.set(
        sale.id,
        buildSaleSearchIndex({
          sale,
          customer: customersById.get(sale.customerId),
          sellerName: sellersById.get(sale.sellerId)?.name,
          storeName: storesById.get(getSaleStoreId(sale))?.name
        })
      );
    }
    return index;
  }, [sales, customersById, sellersById, storesById]);

  const filteredSales = useMemo(() => {
    const now = new Date();
    const start = parseStartDate(startDate);
    const end = parseEndDate(endDate);
    const query = searchTerm.trim();

    return sales
      .filter((sale) => {
        const saleDate = new Date(sale.date);
        if (Number.isNaN(saleDate.getTime())) return false;

        if (selectedStoreId !== 'all' && getSaleStoreId(sale) !== selectedStoreId) {
          return false;
        }

        if (selectedSellerId !== 'all' && sale.sellerId !== selectedSellerId) {
          return false;
        }

        if (selectedState !== 'all' && getSaleState(sale, now) !== selectedState) {
          return false;
        }

        if (selectedCondition !== 'all' && !sale.items.some(item => item.condition === selectedCondition)) {
          return false;
        }

        if (selectedPayment !== 'all' && !sale.paymentMethods.some((payment) => payment.type === selectedPayment)) {
          return false;
        }

        if (!Number.isNaN(start.getTime()) && saleDate < start) return false;
        if (!Number.isNaN(end.getTime()) && saleDate > end) return false;

        if (query) {
          const index = searchIndexBySaleId.get(sale.id);
          if (!index || !matchesSaleSearch(index, query)) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [
    sales,
    selectedStoreId,
    selectedSellerId,
    selectedState,
    selectedCondition,
    selectedPayment,
    startDate,
    endDate,
    sellersById,
    searchTerm,
    searchIndexBySaleId
  ]);

  const filteredTotal = useMemo(
    () => filteredSales.reduce((acc, sale) => acc + getSaleHistoryTotal(sale), 0),
    [filteredSales]
  );
  const filteredCommissionTotal = useMemo(
    () => filteredSales.reduce((acc, sale) => acc + roundCurrency(Number(sale.commission || 0)), 0),
    [filteredSales]
  );
  const salesPagination = usePaginatedRows(filteredSales, {
    pageSize: isCompactLayout ? PDV_HISTORY_PAGE_SIZE_MOBILE : PDV_HISTORY_PAGE_SIZE_DESKTOP,
    resetKey: `${periodPreset}|${startDate}|${endDate}|${selectedStoreId}|${selectedSellerId}|${selectedState}|${selectedCondition}|${selectedPayment}|${searchTerm.trim()}|${isCompactLayout ? 'compact' : 'desktop'}`,
  });

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

  const handleOpenPrintForSale = (sale: Sale) => {
    setSaleToPrint(sale);
    openPrintFormatModal();
  };

  const waitForReceiptTemplateRender = () =>
    new Promise<void>((resolve) => {
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => resolve());
        return;
      }
      window.setTimeout(resolve, 0);
    });

  const handleSendWhatsAppReceipt = async (sale: Sale) => {
    const customer = customersById.get(sale.customerId);
    if (!customer?.phone) {
      toast.error('Cliente sem número de telefone cadastrado.');
      return;
    }
    const storeId = sale.storeId || sellersById.get(sale.sellerId)?.storeId || selectedStoreId;
    if (!storeId || storeId === 'all') {
      toast.error('Venda sem loja vinculada para envio pelo CRM.');
      return;
    }

    setSendingReceiptSaleId(sale.id);
    setSaleToPrint(sale);
    try {
      await waitForReceiptTemplateRender();
      await sendReceiptWhatsApp({
        phone: customer.phone,
        storeId,
        saleId: sale.id,
        customerName: customer.name,
        sellerName: getSellerName(sale),
        saleNumber: sale.saleNumber
      });
      toast.success('Comprovante reenviado via WhatsApp.');
    } catch (err: unknown) {
      const failure = asWhatsAppSendError(err, customer.phone);
      toast.error(whatsAppSendErrorToastText(failure), {
        title: 'Comprovante não reenviado',
        // Tempo de ler a causa e alcançar o botão; número errado não se resolve reenviando.
        durationMs: 8000,
        ...(failure.kind === 'invalid-number'
          ? {}
          : { action: { label: 'Tentar de novo', onClick: () => void handleSendWhatsAppReceipt(sale) } })
      });
    } finally {
      setSendingReceiptSaleId(null);
    }
  };

  const handlePrintReceipt = () => {
    if (!saleToPrint) return;
    const sale = saleToPrint;
    const selectedLayout = receiptPrintLayout;
    const receiptData = buildSaleReceiptData(sale, {
      businessProfile,
      customer: toReceiptCustomer(customersById.get(sale.customerId), 'Sem cliente'),
      sellerName: getSellerName(sale)
    });

    closePrintFormatModal();

    // ESC/POS direto na térmica (80mm + impressora conectada): melhor qualidade
    // possível de cupom, sem passar por PDF.
    if (selectedLayout === '80mm' && thermalPrinter.status === 'connected') {
      const buffer = buildSaleReceiptBuffer(receiptData);
      thermalPrinter.print(buffer).catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : 'Erro ao imprimir na térmica.');
      });
      return;
    }

    void printReceipt(receiptData, selectedLayout).catch(() => {
      toast.error('Não foi possível gerar o comprovante.');
    });
  };

  const handleCancelSale = async () => {
    if (!saleToCancel) return;
    await run(async () => {
      await removeSale(saleToCancel.id);
      toast.success('Venda cancelada e transações revertidas.');
      setSaleToCancel(null);
      if (saleToView?.id === saleToCancel.id) {
        setSaleToView(null);
      }
    }, { errorMsg: 'Não foi possível cancelar a venda.', setLoading: setIsCancellingSale });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedStoreId(defaultUserStoreId === 'all' ? 'all' : defaultUserStoreId);
    setSelectedSellerId('all');
    setSelectedState('all');
    setSelectedCondition('all');
    setSelectedPayment('all');
    setPeriodPreset('last7');
    const d = new Date();
    d.setDate(d.getDate() - 6);
    setStartDate(formatDateForInput(d));
    setEndDate(todayStr);
  };

  const handleUpdateCompleteSale = async (updates: Partial<Sale>) => {
    if (!saleToEditComplete) return;
    try {
      await updateSale(saleToEditComplete.id, updates);
      toast.success('Venda atualizada com sucesso.');
      setSaleToEditComplete(null);
      if (saleToView?.id === saleToEditComplete.id) {
        setSaleToView(null);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao atualizar venda.');
      throw err;
    }
  };

  const copySaleNumber = async (sale: Sale) => {
    try {
      await navigator.clipboard?.writeText(formatSaleNumber(sale));
      toast.success('Número da venda copiado.');
    } catch {
      toast.error('Não foi possível copiar o número da venda.');
    }
  };

  const buildSaleContextActions = (sale: Sale): ContextMenuAction[] => {
    const actions: ContextMenuAction[] = [
      {
        id: 'details',
        label: 'Ver detalhes',
        icon: <Eye size={16} />,
        onSelect: () => setSaleToView(sale),
      },
    ];

    if (isAdmin) {
      actions.push(
        {
          id: 'edit',
          label: 'Editar',
          icon: <Edit size={16} />,
          onSelect: () => setSaleToEditComplete(sale),
        },
      );
    }

    actions.push({
      id: 'copy-number',
      label: 'Copiar número da venda',
      icon: <Copy size={16} />,
      separatorBefore: true,
      onSelect: () => void copySaleNumber(sale),
    });

    if (isAdmin) {
      actions.push({
        id: 'cancel',
        label: 'Cancelar venda',
        icon: <RotateCcw size={16} />,
        destructive: true,
        separatorBefore: true,
        onSelect: () => setSaleToCancel(sale),
      });
    }

    return actions;
  };

  return (
    <>
    <div className="pdv-history-page screen-only space-y-4 md:space-y-6">
      {salesHistoryLoading && <p role="status" className="text-ios-subhead app-text-muted">Carregando historico de vendas...</p>}
      <section className="pdv-history-hero ios-card p-3 md:p-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">PDV</p>
          <h1 className="pdv-history-title text-ios-title-1 font-bold text-gray-900 dark:text-white mt-1">Historico de Vendas</h1>
          <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-1">
            {filteredSales.length} venda(s) • R$ {filteredTotal.toLocaleString('pt-BR')}
            {selectedSellerId !== 'all' && (
              <> • R$ {filteredCommissionTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} comissão</>
            )}
          </p>
        </div>
        <div className="pdv-history-actions grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="ios-button-secondary inline-flex w-full items-center justify-center gap-2 md:w-auto"
          >
            <Filter size={18} />
            {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </button>
          <Link to="/pdv/nova-venda" className="ios-button-primary inline-flex w-full items-center justify-center gap-2 md:w-auto">
            <ShoppingCart size={18} />
            Nova venda
          </Link>
        </div>
      </section>

      <section className="pdv-history-search ios-card p-3 md:p-4">
        <div className="app-search-wrap group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 app-search-icon pointer-events-none" size={18} />
          <input
            id="pdv-history-search"
            type="text"
            inputMode="search"
            autoComplete="off"
            aria-label="Buscar vendas"
            placeholder="Buscar por cliente, vendedor, aparelho, IMEI, CPF, nº da venda..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="ios-input pl-10 pr-12 transition-all focus:ring-4 focus:ring-brand-500/15 focus:border-brand-500"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 app-search-clear"
              aria-label="Limpar busca"
            >
              <X size={12} />
            </button>
          )}
        </div>
        {/* Zero resultado é dito pela lista, que ainda oferece "Limpar busca" —
            repetir aqui só duplicaria a mesma frase na mesma dobra. */}
        {searchTerm.trim() && filteredSales.length > 0 && (
          <p className="text-xs text-gray-600 dark:text-surface-dark-600 mt-2 px-1">
            {filteredSales.length} {filteredSales.length === 1 ? 'venda encontrada' : 'vendas encontradas'} — a busca
            respeita o período e os filtros atuais.
          </p>
        )}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="min-w-0">
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

            <div className="min-w-0">
              <label htmlFor="pdv-history-seller-filter" className="ios-label">
                Vendedor
              </label>
              <select
                id="pdv-history-seller-filter"
                className="ios-input"
                value={selectedSellerId}
                onChange={(event) => setSelectedSellerId(event.target.value)}
              >
                <option value="all">Todos os vendedores</option>
                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label htmlFor="pdv-history-condition-filter" className="ios-label">
                Estado
              </label>
              <select
                id="pdv-history-condition-filter"
                className="ios-input"
                value={selectedCondition}
                onChange={(event) => setSelectedCondition(event.target.value as ConditionFilter)}
              >
                <option value="all">Todos</option>
                <option value={Condition.NEW}>Novo</option>
                <option value={Condition.USED}>Seminovo</option>
              </select>
            </div>

            <div className="min-w-0">
              <label htmlFor="pdv-history-state-filter" className="ios-label">
                Garantia / Status
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

            <div className="min-w-0">
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
                <option value="Cartão">Cartão Crédito</option>
                <option value="Cartão Débito">Cartão Débito</option>
                <option value="Devedor">Devedor</option>
              </select>
            </div>

            <div className="min-w-0">
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

          <div className="flex flex-col sm:flex-row gap-3 mt-3">
            <div className="flex-1 min-w-0">
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
            <div className="flex-1 min-w-0">
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

      <section
        data-testid="pdv-history-seller-summary"
        className="ios-card p-4 md:p-6 bg-gradient-to-r from-brand-50/80 to-blue-50/80 dark:from-brand-950/30 dark:to-blue-950/30 border border-brand-200 dark:border-brand-800/50"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400">
              {selectedSellerId !== 'all' ? <User size={24} /> : <Users size={24} />}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                {selectedSellerId !== 'all' ? 'Total vendido pelo funcionário' : 'Total vendido por todos os funcionários'}
              </p>
              <h3 className="text-ios-title-2 font-bold text-gray-900 dark:text-white mt-0.5">
                {selectedSellerId !== 'all' ? (sellersById.get(selectedSellerId)?.name || 'Vendedor') : 'Todos os funcionários'}
              </h3>
              <p className="text-xs text-gray-600 dark:text-surface-dark-600 mt-0.5">
                {filteredSales.length} {filteredSales.length === 1 ? 'venda realizada' : 'vendas realizadas'} segundo os filtros selecionados
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 border-t sm:border-t-0 pt-3 sm:pt-0 border-brand-200/50 dark:border-brand-800/40 text-left sm:text-right">
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-surface-dark-600">Valor total vendido</p>
              <p className="text-ios-title-1 font-bold text-brand-600 dark:text-brand-400 font-mono mt-0.5">
                R$ {filteredTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="sm:border-l sm:border-brand-200/60 dark:sm:border-brand-800/60 sm:pl-6">
              <p className="text-xs font-semibold text-gray-600 dark:text-surface-dark-600">Comissões recebidas</p>
              <p className="text-ios-title-1 font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                R$ {filteredCommissionTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="pdv-history-list ios-card overflow-hidden">
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
              {searchTerm.trim()
                ? `Nenhuma venda para "${searchTerm.trim()}" com os filtros atuais.`
                : 'Nenhuma venda encontrada com os filtros atuais.'}
            </p>
            {/* Busca sem resultado quase sempre é período curto demais, não venda
                inexistente: a saída útil é limpar a busca, não abrir uma venda. */}
            {searchTerm.trim() ? (
              <button type="button" onClick={() => setSearchTerm('')} className="ios-button-secondary inline-flex mt-4">
                Limpar busca
              </button>
            ) : (
              <Link to="/pdv/nova-venda" className="ios-button-primary inline-flex mt-4">
                Nova venda
              </Link>
            )}
          </div>
        ) : isCompactLayout ? (
          <div>
            <div className="space-y-3 p-4 md:p-6">
              {salesPagination.rows.map((sale) => {
                const tradeInSubtotalMobile = getSaleTradeInSubtotal(sale);
                const paymentMethodsMobile = sale.paymentMethods.map((payment) => payment.type);
                if (tradeInSubtotalMobile > 0) paymentMethodsMobile.push('Trade-in');
                const paymentSummary = paymentMethodsMobile.join(', ') || 'Sem metodo';
                const originalSubtotal = getOriginalSubtotal(sale);
                const negotiatedSubtotal = getNegotiatedSubtotal(sale);
                const hasNegotiation = hasNegotiationSnapshot(sale);
                const discount = Number(sale.discount || 0);
                const historyTotal = getSaleHistoryTotal(sale);

                return (
                  <div
                    key={sale.id}
                    className="ios-card p-4 space-y-3"
                    onContextMenu={contextMenu.bind(buildSaleContextActions(sale), { label: `Ações da venda ${formatSaleNumber(sale)}` })}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-surface-dark-500">
                          {new Date(sale.date).toLocaleString('pt-BR')}
                        </p>
                        <p className="text-brand-500 text-ios-footnote font-mono mt-1">#{formatSaleNumber(sale)}</p>
                      </div>
                      <span className="text-base font-semibold text-gray-900 dark:text-white">
                        R$ {historyTotal.toLocaleString('pt-BR')}
                      </span>
                    </div>

                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getSaleStateClass(sale)}`}>
                      {getSaleStateLabel(sale)}
                    </span>
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-surface-dark-200 dark:text-surface-dark-700">
                      {sale.items.length} aparelho{sale.items.length !== 1 ? 's' : ''} · {getSaleTradeIns(sale).length} trade-in{getSaleTradeIns(sale).length !== 1 ? 's' : ''}
                    </span>

                    <div className="space-y-1 text-sm text-gray-700 dark:text-surface-dark-700">
                      {getSaleItemsSummary(sale) && (
                        <p><span className="font-semibold text-gray-900 dark:text-white">Aparelho(s):</span> {getSaleItemsSummary(sale)}</p>
                      )}
                      <p><span className="font-semibold text-gray-900 dark:text-white">Cliente:</span> {getCustomerName(sale)}</p>
                      <p><span className="font-semibold text-gray-900 dark:text-white">Vendedor:</span> {getSellerName(sale)}</p>
                      <p><span className="font-semibold text-gray-900 dark:text-white">Loja:</span> {getStoreName(sale)}</p>
                      <p><span className="font-semibold text-gray-900 dark:text-white">Método:</span> {paymentSummary}</p>
                      {hasNegotiation && (
                        <p>
                          <span className="font-semibold text-gray-900 dark:text-white">Negociação:</span>{' '}
                          R$ {originalSubtotal.toLocaleString('pt-BR')} {'->'} R$ {negotiatedSubtotal.toLocaleString('pt-BR')}
                          {discount > 0 ? ` (-R$ ${discount.toLocaleString('pt-BR')})` : ''}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setSaleToView(sale)}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-ios border border-gray-200 dark:border-surface-dark-200 bg-white dark:bg-surface-dark-100 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-surface-dark-700 hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors"
                      >
                        <Eye size={12} />
                        Detalhes
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setSaleToEditComplete(sale)}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-ios border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                        >
                          <Edit size={12} />
                          Editar
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setSaleToCancel(sale)}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-ios border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                        >
                          <RotateCcw size={12} />
                          Cancelar venda
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <Pagination
              page={salesPagination.page}
              totalPages={salesPagination.totalPages}
              totalItems={salesPagination.totalItems}
              pageSize={salesPagination.pageSize}
              onPageChange={salesPagination.setPage}
            />
          </div>
        ) : (
          <div>
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
                    <th className="p-4 font-medium">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-200">
                  {salesPagination.rows.map((sale) => {
                    const tradeInSubtotalRow = getSaleTradeInSubtotal(sale);
                    const paymentMethodsRow = sale.paymentMethods.map((payment) => payment.type);
                    if (tradeInSubtotalRow > 0) paymentMethodsRow.push('Trade-in');
                    const paymentSummary = paymentMethodsRow.join(', ') || 'Sem metodo';
                    const originalSubtotal = getOriginalSubtotal(sale);
                    const negotiatedSubtotal = getNegotiatedSubtotal(sale);
                    const hasNegotiation = hasNegotiationSnapshot(sale);
                    const discount = Number(sale.discount || 0);
                    const historyTotal = getSaleHistoryTotal(sale);

                    return (
                      <tr
                        key={sale.id}
                        className="hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors"
                        onContextMenu={contextMenu.bind(buildSaleContextActions(sale), { label: `Ações da venda ${formatSaleNumber(sale)}` })}
                      >
                        <td className="p-4 text-ios-subhead text-gray-700 dark:text-surface-dark-700">
                          {new Date(sale.date).toLocaleString('pt-BR')}
                        </td>
                        <td className="p-4">
                          <p className="text-brand-500 text-ios-footnote font-mono">#{formatSaleNumber(sale)}</p>
                          {getSaleItemsSummary(sale) && (
                            <p className="text-ios-subhead font-medium text-gray-900 dark:text-white mt-1 max-w-[220px] truncate" title={getSaleItemsSummary(sale)}>
                              {getSaleItemsSummary(sale)}
                            </p>
                          )}
                          <p className="text-[11px] text-gray-500 dark:text-surface-dark-500 mt-1">
                            {sale.items.length} aparelho{sale.items.length !== 1 ? 's' : ''} · {getSaleTradeIns(sale).length} trade-in{getSaleTradeIns(sale).length !== 1 ? 's' : ''}
                          </p>
                        </td>
                        <td className="p-4 text-ios-subhead text-gray-900 dark:text-white">{getStoreName(sale)}</td>
                        <td className="p-4 text-ios-subhead text-gray-900 dark:text-white">{getSellerName(sale)}</td>
                        <td className="p-4 text-ios-subhead text-gray-900 dark:text-white">{getCustomerName(sale)}</td>
                        <td className="p-4 text-ios-subhead text-gray-700 dark:text-surface-dark-700">{paymentSummary}</td>
                        <td className="p-4 text-right text-ios-subhead font-semibold text-gray-900 dark:text-white">
                          <p>R$ {historyTotal.toLocaleString('pt-BR')}</p>
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
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSaleToView(sale)}
                              className="inline-flex items-center gap-1.5 rounded-ios border border-gray-200 dark:border-surface-dark-200 bg-white dark:bg-surface-dark-100 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:text-surface-dark-700 hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors whitespace-nowrap"
                            >
                              <Eye size={12} />
                              Detalhes
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => setSaleToEditComplete(sale)}
                                className="inline-flex items-center gap-1.5 rounded-ios border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors whitespace-nowrap"
                              >
                                <Edit size={12} />
                                Editar
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => setSaleToCancel(sale)}
                                className="inline-flex items-center gap-1.5 rounded-ios border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors whitespace-nowrap"
                              >
                                <RotateCcw size={12} />
                                Cancelar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={salesPagination.page}
              totalPages={salesPagination.totalPages}
              totalItems={salesPagination.totalItems}
              pageSize={salesPagination.pageSize}
              onPageChange={salesPagination.setPage}
            />
          </div>
        )}
      </section>

      <DesktopContextMenuHost controller={contextMenu} />

      <SaleDetailsModal
        open={!!saleToView}
        onClose={() => setSaleToView(null)}
        sale={saleToView}
        isAdmin={isAdmin}
        getCustomerName={getCustomerName}
        getCustomer={(sale) => customersById.get(sale.customerId)}
        getSellerName={getSellerName}
        getStoreName={getStoreName}
        onOpenPrint={handleOpenPrintForSale}
        onSendWhatsApp={(sale) => {
          void handleSendWhatsAppReceipt(sale);
        }}
        isSendingWhatsApp={!!saleToView && sendingReceiptSaleId === saleToView.id}
        onEdit={(sale) => {
          setSaleToView(null);
          setSaleToEditComplete(sale);
        }}
      />

      <Modal
        open={isPrintFormatModalOpen}
        onClose={() => closePrintFormatModal()}
        title="Escolher formato de impressão"
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" className="ios-button-secondary" onClick={() => closePrintFormatModal()}>
              Cancelar
            </button>
            <button type="button" className="ios-button-primary" onClick={handlePrintReceipt}>
              Imprimir agora
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-ios-subhead text-gray-600 dark:text-surface-dark-600">
            Escolha o layout ideal para o comprovante desta venda.
          </p>
          <button
            type="button"
            onClick={() => setReceiptPrintLayout('80mm')}
            aria-pressed={receiptPrintLayout === '80mm'}
            className={`w-full text-left rounded-ios-lg border p-4 transition-colors ${
              receiptPrintLayout === '80mm'
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                : 'app-border bg-white dark:bg-surface-dark-100'
            }`}
          >
            <p className="font-semibold text-gray-900 dark:text-white">80mm (térmica/cupom)</p>
            <p className="text-sm text-gray-600 dark:text-surface-dark-600 mt-1">
              Layout compacto para impressora térmica.
            </p>
          </button>

          {receiptPrintLayout === '80mm' && thermalPrinter.isSupported && (
            <div className="rounded-ios-lg border app-border p-3 space-y-2">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Impressora USB/Serial</p>
              {thermalPrinter.status === 'connected' || thermalPrinter.status === 'printing' ? (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    {thermalPrinter.status === 'printing' ? 'Imprimindo...' : 'Conectada'}
                  </span>
                  <button
                    type="button"
                    onClick={thermalPrinter.disconnect}
                    className="text-xs text-gray-500 hover:text-red-500 dark:text-surface-dark-500 dark:hover:text-red-400 transition-colors"
                  >
                    Desconectar
                  </button>
                </div>
              ) : thermalPrinter.status === 'connecting' ? (
                <p className="text-sm text-gray-500 dark:text-surface-dark-500">Conectando...</p>
              ) : (
                <button
                  type="button"
                  onClick={thermalPrinter.connect}
                  className="ios-button-secondary w-full text-sm"
                >
                  Conectar impressora
                </button>
              )}
              {thermalPrinter.errorMessage && (
                <p className="text-xs text-red-500">{thermalPrinter.errorMessage}</p>
              )}
              <p className="text-xs text-gray-500 dark:text-surface-dark-500">
                {thermalPrinter.status === 'connected'
                  ? 'Impressão via ESC/POS direto — sem diálogo do sistema.'
                  : 'Sem conexão: abre o diálogo padrão do sistema. Funciona em Chrome/Edge.'}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setReceiptPrintLayout('a4')}
            aria-pressed={receiptPrintLayout === 'a4'}
            className={`w-full text-left rounded-ios-lg border p-4 transition-colors ${
              receiptPrintLayout === 'a4'
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                : 'app-border bg-white dark:bg-surface-dark-100'
            }`}
          >
            <p className="font-semibold text-gray-900 dark:text-white">A4 (arquivo/entrega formal)</p>
            <p className="text-sm text-gray-600 dark:text-surface-dark-600 mt-1">
              Modelo detalhado para PDF ou impressão em folha.
            </p>
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!saleToCancel}
        onClose={() => {
          if (!isCancellingSale) setSaleToCancel(null);
        }}
        title="Cancelar venda"
        description={
          saleToCancel
            ? `Confirmar cancelamento da venda #${formatSaleNumber(saleToCancel)} de R$ ${saleToCancel.total.toLocaleString('pt-BR')}? As transações financeiras e dívidas serão revertidas, o item vendido voltará ao estoque e aparelhos de entrada serão removidos.`
            : undefined
        }
        confirmLabel={isCancellingSale ? 'Cancelando...' : 'Cancelar venda'}
        variant="danger"
        onConfirm={() => {
          void handleCancelSale();
        }}
      />
      <SaleCompleteEditModal
        open={!!saleToEditComplete}
        onClose={() => setSaleToEditComplete(null)}
        sale={saleToEditComplete}
        onSave={handleUpdateCompleteSale}
      />
    </div>

    <SaleReceiptPrintTemplates
      sale={saleToPrint}
      businessProfile={businessProfile}
      customer={toReceiptCustomer(saleToPrint ? customersById.get(saleToPrint.customerId) : null, 'Sem cliente')}
      sellerName={saleToPrint ? getSellerName(saleToPrint) : 'Não identificado'}
    />
    </>
  );
};

interface SaleDetailsModalProps {
  open: boolean;
  onClose: () => void;
  sale: Sale | null;
  isAdmin: boolean;
  getCustomerName: (sale: Sale) => string;
  getCustomer: (sale: Sale) => import('../types').Customer | undefined;
  getSellerName: (sale: Sale) => string;
  getStoreName: (sale: Sale) => string;
  onOpenPrint: (sale: Sale) => void;
  onSendWhatsApp: (sale: Sale) => void;
  isSendingWhatsApp: boolean;
  onEdit: (sale: Sale) => void;
}

const SaleDetailsModal: React.FC<SaleDetailsModalProps> = ({
  open,
  onClose,
  sale,
  isAdmin,
  getCustomerName,
  getCustomer,
  getSellerName,
  getStoreName,
  onOpenPrint,
  onSendWhatsApp,
  isSendingWhatsApp,
  onEdit
}) => {
  const { stock } = useData();
  const customer = sale ? getCustomer(sale) : undefined;
  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    return phone;
  };
  const formatBirthDate = (date: string) => formatBirthdayLabel(date) || date;
  if (!sale) return null;

  const tradeIns = getSaleTradeIns(sale);
  const tradeInSubtotal = getSaleTradeInSubtotal(sale);
  const originalSubtotal = roundCurrency(getOriginalSubtotal(sale));
  const negotiatedSubtotal = roundCurrency(getNegotiatedSubtotal(sale));
  const discountAmount = roundCurrency(Number(sale.discount || 0));
  const cardFeeTotal = roundCurrency(sale.paymentMethods.reduce((acc, payment) => acc + Number(payment.feeAmount || 0), 0));
  const saleGrossTotal = getSaleHistoryTotal(sale);
  const financialPaymentTotal = getSaleFinancialPaymentTotal(sale);
  const totalPaidByCustomer = getSalePaidTotal(sale);

  return (
    <Modal open={open} onClose={onClose} title="Detalhes da Venda" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-ios border app-border p-3">
            <p className="text-xs text-gray-500 uppercase tracking-[0.08em]">Venda</p>
            <p className="font-mono text-sm mt-1">#{formatSaleNumber(sale)}</p>
            <p className="text-sm text-gray-600 dark:text-surface-dark-600 mt-1">{new Date(sale.date).toLocaleString('pt-BR')}</p>
          </div>
          <div className="rounded-ios border app-border p-3">
            <p className="text-xs text-gray-500 uppercase tracking-[0.08em]">Pessoas</p>
            <p className="text-sm mt-1"><span className="font-semibold">Cliente:</span> {getCustomerName(sale)}</p>
            {customer?.cpf && (
              <p className="text-sm text-gray-600 dark:text-surface-dark-600">
                <span className="font-semibold">{getCpfOrCnpjLabel(customer.cpf)}:</span>{' '}
                {formatCpfOrCnpj(customer.cpf)}
              </p>
            )}
            {customer?.phone && (
              <p className="text-sm text-gray-600 dark:text-surface-dark-600">
                <span className="font-semibold">Telefone:</span> {formatPhone(customer.phone)}
              </p>
            )}
            {customer?.birthDate && (
              <p className="text-sm text-gray-600 dark:text-surface-dark-600">
                <span className="font-semibold">Nascimento:</span> {formatBirthDate(customer.birthDate)}
              </p>
            )}
            <p className="text-sm mt-1"><span className="font-semibold">Vendedor:</span> {getSellerName(sale)}</p>
            <p className="text-sm"><span className="font-semibold">Loja:</span> {getStoreName(sale)}</p>
          </div>
        </div>

        <div className="rounded-ios border app-border p-3">
          <p className="text-xs text-gray-500 uppercase tracking-[0.08em] mb-2">Aparelho(s) vendido(s)</p>
          <div className="space-y-2">
            {sale.items.map((item, index) => (
              <div key={`${item.id}-${index}`} className="rounded-ios bg-gray-50 dark:bg-surface-dark-200 px-3 py-2">
                <p className="text-sm font-semibold">{item.model} {item.capacity || ''}</p>
                <p className="text-xs text-gray-500">
                  {item.color || 'Sem cor'} · {item.condition} · IMEI/Serial: {item.imei || '-'}
                </p>
                {item.condition === 'Seminovo' && item.batteryHealth != null && (
                  <p className="text-xs text-gray-500">Saúde da bateria: {item.batteryHealth}%</p>
                )}
                <p className="text-xs text-gray-600 dark:text-surface-dark-600 mt-1">
                  Original: {formatCurrency(item.originalSellPrice ?? item.sellPrice)} · Negociado: {formatCurrency(item.sellPrice)}
                </p>
                {getItemWarrantyLabel(sale, item) && (
                  <p className="text-xs text-gray-600 dark:text-surface-dark-600 mt-1">
                    {getItemWarrantyLabel(sale, item)}
                  </p>
                )}
                <ObservationsList raw={item.observations || item.notes} className="mt-1" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-ios border app-border p-3">
          <p className="text-xs text-gray-500 uppercase tracking-[0.08em] mb-2">Aparelho(s) trade-in</p>
          {tradeIns.length === 0 ? (
            <p className="text-sm text-gray-500">Sem trade-in nesta venda.</p>
          ) : (
            <div className="space-y-2">
              {tradeIns.map((tradeIn, index) => (
                <div key={`${tradeIn.id}-${index}`} className="rounded-ios bg-gray-50 dark:bg-surface-dark-200 px-3 py-2">
                  <p className="text-sm font-semibold">
                    {tradeIn.model}
                    {tradeIn.capacity ? ` ${tradeIn.capacity}` : ''}
                    {tradeIn.color ? ` • ${tradeIn.color}` : ''}
                  </p>
                  <p className="text-xs text-gray-500">IMEI/Serial: {tradeIn.imei || '-'}</p>
                  {tradeIn.condition && <p className="text-xs text-gray-500">Condição: {tradeIn.condition}</p>}
                  <ObservationsList
                    raw={getTradeInObservations(tradeIn, stock)}
                    className="mt-1"
                  />
                  <p className="text-xs text-green-700 mt-1">Usado no pagamento: {formatCurrency(tradeIn.receivedValue || 0)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-ios border app-border p-3">
            <p className="text-xs text-gray-500 uppercase tracking-[0.08em] mb-2">Pagamentos</p>
            <div className="space-y-2">
              {sale.paymentMethods.map((payment, index) => (
                <div key={`${payment.type}-${index}`} className="rounded-ios bg-gray-50 dark:bg-surface-dark-200 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{getPaymentLabel(payment)}</span>
                    <span className="text-sm">{formatCurrency(getPaymentCustomerAmount(payment))}</span>
                  </div>
                  {payment.customerAmount !== undefined && payment.customerAmount !== payment.amount && (
                    <p className="text-xs text-gray-500 mt-1">Líquido loja: {formatCurrency(payment.amount)}</p>
                  )}
                  {payment.type === 'Devedor' && payment.debtDueDate && (
                    <p className="text-xs text-gray-500 mt-1">Vencimento: {new Date(`${payment.debtDueDate}T00:00:00`).toLocaleDateString('pt-BR')}</p>
                  )}
                </div>
              ))}
              {tradeInSubtotal > 0 && (
                <div className="rounded-ios bg-gray-50 dark:bg-surface-dark-200 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">Trade-in ({tradeIns.length} aparelho{tradeIns.length !== 1 ? 's' : ''})</span>
                    <span className="text-sm">{formatCurrency(tradeInSubtotal)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Entrada usada como forma de pagamento</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-ios border app-border p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span>Subtotal original</span>
              <span className="font-medium">{formatCurrency(originalSubtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Subtotal negociado</span>
              <span className="font-medium">{formatCurrency(negotiatedSubtotal)}</span>
            </div>
            <div className="flex justify-between text-red-700">
              <span>Desconto</span>
              <span>- {formatCurrency(discountAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Acréscimo cartão</span>
              <span>{formatCurrency(cardFeeTotal)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 dark:border-surface-dark-200 pt-2 font-semibold">
              <span>Total da venda</span>
              <span>{formatCurrency(saleGrossTotal)}</span>
            </div>
            <div className="flex justify-between font-semibold text-brand-600">
              <span>Total pago</span>
              <span>{formatCurrency(totalPaidByCustomer)}</span>
            </div>
            {tradeInSubtotal > 0 && (
              <>
                <div className="flex justify-between text-red-700">
                  <span>Saída compra trade-in</span>
                  <span>- {formatCurrency(tradeInSubtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-700 dark:text-surface-dark-700">
                  <span>Pagamentos financeiros</span>
                  <span>{formatCurrency(financialPaymentTotal)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <IOSButton variant="secondary" onClick={() => onSendWhatsApp(sale)} loading={isSendingWhatsApp}>
            <span className="inline-flex items-center gap-2">
              <MessageCircle size={16} />
              {isSendingWhatsApp ? 'Reenviando...' : 'Reenviar comprovante via WhatsApp'}
            </span>
          </IOSButton>
          <IOSButton variant="secondary" onClick={() => onOpenPrint(sale)}>
            <span className="inline-flex items-center gap-2">
              <Printer size={16} />
              Comprovantes imprimíveis
            </span>
          </IOSButton>
          {isAdmin && (
            <IOSButton variant="primary" onClick={() => onEdit(sale)}>
              <span className="inline-flex items-center gap-2">
                <Edit size={16} />
                Editar venda
              </span>
            </IOSButton>
          )}
        </div>
      </div>
    </Modal>
  );
};


interface SaleReceiptPrintTemplatesProps {
  sale: Sale | null;
  businessProfile: BusinessProfile;
  customer: ReceiptCustomerInfo;
  sellerName: string;
}

const SaleReceiptPrintTemplates: React.FC<SaleReceiptPrintTemplatesProps> = ({
  sale,
  businessProfile,
  customer,
  sellerName
}) => {
  if (!sale) return null;

  // Mesma lista que o PDF vetorial e a térmica imprimem — o comprovante do
  // WhatsApp sai destes templates, e sair com menos dados seria divergir.
  const [customerNameField, ...customerDetailFields] = buildCustomerReceiptFields(customer);

  const tradeIns = getSaleTradeIns(sale);
  const tradeInSubtotal = getSaleTradeInSubtotal(sale);

  const negotiatedSubtotal = roundCurrency(getNegotiatedSubtotal(sale));
  const discountAmount = roundCurrency(Number(sale.discount || 0));
  const discountPercent = sale.discountPercent ?? null;

  const cardFeeTotal = roundCurrency(sale.paymentMethods.reduce((acc, payment) => acc + Number(payment.feeAmount || 0), 0));
  const totalCustomerWithTradeIn = getSalePaidTotal(sale);
  const saleGrossTotal = getSaleHistoryTotal(sale);
  return createPortal(
    <>
      <div
        id="receipt-content-80mm"
        className="hidden print-only print-layout print-layout-80mm text-left font-mono text-black bg-white mx-auto w-[72mm] max-w-[72mm] border border-black/20 px-2 py-4"
      >
        <div className="text-center border-b border-black pb-3 mb-3">
          {businessProfile?.logoUrl && (
            <img
              src={businessProfile.logoUrl}
              alt="Logo da empresa"
              className="mx-auto mb-2 h-10 w-auto max-w-[40mm] object-contain"
            />
          )}
          <h1 className="font-bold uppercase tracking-wide text-[14px]">{businessProfile?.name || 'iPhoneRepasse'}</h1>
          {businessProfile?.address && <p className="text-[10px] mt-1 leading-tight">{businessProfile.address}</p>}
          {businessProfile?.cnpj && <p className="text-[10px] mt-1">CNPJ: {businessProfile.cnpj}</p>}
        </div>

        <div className="text-[11px] space-y-1 mb-3">
          <p className="font-semibold">Venda #{formatSaleNumber(sale)}</p>
          <p>{new Date(sale.date).toLocaleString('pt-BR')}</p>
          <p>Cliente: {customerNameField.value}</p>
          {customerDetailFields.map((field) => (
            <p key={field.label} className="break-all">{field.label}: {field.value}</p>
          ))}
          <p>Vendedor: {sellerName}</p>
        </div>

        <div className="border-y border-black py-2 space-y-2 text-[11px]">
          {sale.items.map((item, index) => (
            <div key={`${item.id}-${index}`}>
              <p className="font-semibold">
                {item.model}
                {item.capacity ? ` ${item.capacity}` : ''}
              </p>
              <p className="text-[10px] leading-tight break-all">IMEI/Serial: {item.imei || '-'}</p>
              <p className="text-[10px] leading-tight">Cor: {item.color || 'Sem cor'}</p>
              {item.condition === 'Seminovo' && item.batteryHealth != null && (
                <p className="text-[10px] leading-tight">Saúde da bateria: {item.batteryHealth}%</p>
              )}
              {getItemWarrantyLabel(sale, item) && (
                <p className="text-[10px] leading-tight">
                  {getItemWarrantyLabel(sale, item)}
                </p>
              )}
              <div className="flex justify-between">
                <span>1 x {formatCurrency(item.sellPrice)}</span>
                <span>{formatCurrency(item.sellPrice)}</span>
              </div>
            </div>
          ))}
        </div>

        {tradeIns.length > 0 && (
          <div className="mt-3 border-t border-black pt-2 text-[11px] space-y-2">
            <p className="font-semibold">Aparelhos de entrada</p>
            {tradeIns.map((tradeIn, index) => (
              <div key={`${tradeIn.id}-${index}`} className="space-y-0.5">
                <p className="leading-tight wrap-break-word">
                  {tradeIn.model}
                  {tradeIn.capacity ? ` ${tradeIn.capacity}` : ''}
                  {tradeIn.color ? ` • ${tradeIn.color}` : ''}
                </p>
                <p className="text-[10px] leading-tight break-all">IMEI/Serial: {tradeIn.imei || '-'}</p>
                <div className="flex justify-between">
                  <span>Usado no pagamento</span>
                  <span>- {formatCurrency(tradeIn.receivedValue || 0)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-black mt-3 pt-2 text-[11px] space-y-1">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(negotiatedSubtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-red-700">
              <span>
                Desconto
                {sale.discountType === 'percent' && discountPercent !== null ? ` (${discountPercent.toFixed(2)}%)` : ''}
              </span>
              <span>- {formatCurrency(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-[13px]">
            <span>Total venda</span>
            <span>{formatCurrency(saleGrossTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Acréscimo cartão</span>
            <span>{formatCurrency(cardFeeTotal)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total pago</span>
            <span>{formatCurrency(totalCustomerWithTradeIn)}</span>
          </div>
          {tradeInSubtotal > 0 && (
            <>
              <div className="flex justify-between">
                <span>Trade-in pago</span>
                <span>{formatCurrency(tradeInSubtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Líquido em contas</span>
                <span>{formatCurrency(sale.total)}</span>
              </div>
            </>
          )}
        </div>

        <div className="mt-3 border-t border-black pt-2 text-[11px]">
          <p className="font-semibold mb-1">Pagamentos</p>
          {sale.paymentMethods.map((payment, index) => (
            <div key={`${payment.type}-${index}`} className="space-y-0.5 mb-1.5 last:mb-0">
              <div className="flex justify-between">
                <span>{getPaymentLabel(payment)}</span>
                <span>{formatCurrency(getPaymentCustomerAmount(payment))}</span>
              </div>
              {payment.customerAmount !== undefined && payment.customerAmount !== payment.amount && (
                <div className="flex justify-between text-[10px]">
                  <span>Líquido loja</span>
                  <span>{formatCurrency(payment.amount)}</span>
                </div>
              )}
            </div>
          ))}
          {tradeInSubtotal > 0 && (
            <div className="flex justify-between mt-1">
              <span>Troca ({tradeIns.length} aparelho{tradeIns.length !== 1 ? 's' : ''})</span>
              <span>{formatCurrency(tradeInSubtotal)}</span>
            </div>
          )}
        </div>

        <div className="mt-3 border-t border-black pt-3 text-center text-[10px]">
          {sale.items.some((item) => getItemWarrantyLabel(sale, item)) ? (
            <>
              <p className="font-semibold">Garantias por aparelho</p>
              {sale.items.map((item, index) => {
                const warrantyLabel = getItemWarrantyLabel(sale, item);
                if (!warrantyLabel) return null;
                return (
                  <p key={`${item.id}-warranty-${index}`}>
                    {item.model}: {warrantyLabel}
                  </p>
                );
              })}
            </>
          ) : (
            <p>Sem garantia de app para esta venda.</p>
          )}
          <p className="mt-2">Obrigado pela preferência.</p>
        </div>
      </div>

      <div
        id="receipt-content-a4"
        className="hidden print-only print-layout print-layout-a4 text-black bg-white mx-auto w-full max-w-[210mm] border border-gray-300 px-6 py-5"
      >
        <header className="flex justify-between items-start border-b border-gray-300 pb-3 gap-4">
          <div className="flex items-start gap-3">
            {businessProfile?.logoUrl && (
              <img
                src={businessProfile.logoUrl}
                alt="Logo da empresa"
                className="h-12 w-auto max-w-[48mm] object-contain"
              />
            )}
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{businessProfile?.name || 'iPhoneRepasse'}</h1>
              {businessProfile?.cnpj && <p className="text-xs text-gray-700 mt-0.5">CNPJ: {businessProfile.cnpj}</p>}
              {businessProfile?.address && <p className="text-xs text-gray-700">{businessProfile.address}</p>}
              {businessProfile?.phone && <p className="text-xs text-gray-700">Telefone: {businessProfile.phone}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Comprovante de venda</p>
            <p className="text-base font-semibold mt-1">#{formatSaleNumber(sale)}</p>
            <p className="text-xs text-gray-600 mt-0.5">{new Date(sale.date).toLocaleString('pt-BR')}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-4 mt-4">
          <div className="rounded border border-gray-300 p-2">
            <p className="text-xs uppercase tracking-[0.12em] text-gray-500">Cliente</p>
            <p className="text-sm font-medium mt-0.5">{customerNameField.value}</p>
            {customerDetailFields.map((field) => (
              <p key={field.label} className="text-xs text-gray-600 mt-0.5 break-words">
                {field.label}: {field.value}
              </p>
            ))}
          </div>
          <div className="rounded border border-gray-300 p-2">
            <p className="text-xs uppercase tracking-[0.12em] text-gray-500">Vendedor</p>
            <p className="text-sm font-medium mt-0.5">{sellerName}</p>
          </div>
        </section>

        <section className="mt-4">
          <h2 className="text-xs uppercase tracking-[0.12em] text-gray-500 mb-1">Itens vendidos</h2>
          <table className="w-full text-sm border border-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2 border-b border-gray-300">Descrição</th>
                <th className="text-right p-2 border-b border-gray-300">Quantidade</th>
                <th className="text-right p-2 border-b border-gray-300">Valor unitário</th>
                <th className="text-right p-2 border-b border-gray-300">Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item, index) => (
                <tr key={`${item.id}-${index}`}>
                  <td className="p-2 border-b border-gray-200">
                    <p className="font-medium">{item.model}</p>
                    <p className="text-xs text-gray-500">
                      {item.capacity || 'Sem capacidade'} • {item.color || 'Sem cor'} • IMEI/Serial {item.imei || '-'}
                    </p>
                    {item.condition === 'Seminovo' && item.batteryHealth != null && (
                      <p className="text-xs text-gray-500">Saúde da bateria: {item.batteryHealth}%</p>
                    )}
                    {getItemWarrantyLabel(sale, item) && (
                      <p className="text-xs text-gray-600">
                        {getItemWarrantyLabel(sale, item)}
                      </p>
                    )}
                  </td>
                  <td className="p-2 text-right border-b border-gray-200">1</td>
                  <td className="p-2 text-right border-b border-gray-200">{formatCurrency(item.sellPrice)}</td>
                  <td className="p-2 text-right border-b border-gray-200">{formatCurrency(item.sellPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {tradeIns.length > 0 && (
          <section className="mt-4">
            <h2 className="text-xs uppercase tracking-[0.12em] text-gray-500 mb-1">Aparelhos recebidos na troca</h2>
            <table className="w-full text-sm border border-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2 border-b border-gray-300">Descrição</th>
                  <th className="text-left p-2 border-b border-gray-300">IMEI/Serial</th>
                  <th className="text-right p-2 border-b border-gray-300">Usado no pagamento</th>
                </tr>
              </thead>
              <tbody>
                {tradeIns.map((tradeIn, index) => (
                  <tr key={`${tradeIn.id}-${index}`}>
                    <td className="p-2 border-b border-gray-200">
                      <p className="font-medium">{tradeIn.model}</p>
                      <p className="text-xs text-gray-500">
                        {tradeIn.capacity || 'Sem capacidade'} • {tradeIn.color || 'Sem cor'}
                      </p>
                    </td>
                    <td className="p-2 border-b border-gray-200 font-mono text-xs">{tradeIn.imei || '-'}</td>
                    <td className="p-2 text-right border-b border-gray-200">
                      - {formatCurrency(tradeIn.receivedValue || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded border border-gray-300 p-2">
            <h3 className="text-xs uppercase tracking-[0.12em] text-gray-500 mb-1">Pagamentos</h3>
            <div className="space-y-1 text-sm">
              {sale.paymentMethods.map((payment, index) => (
                <div key={`${payment.type}-${index}`} className="rounded border border-gray-200 px-2 py-1">
                  <div className="flex justify-between">
                    <span className="font-medium">{getPaymentLabel(payment)}</span>
                    <span>{formatCurrency(getPaymentCustomerAmount(payment))}</span>
                  </div>
                  {payment.customerAmount !== undefined && payment.customerAmount !== payment.amount && (
                    <div className="flex justify-between text-xs text-gray-500 mt-0.5">
                      <span>Líquido loja</span>
                      <span>{formatCurrency(payment.amount)}</span>
                    </div>
                  )}
                  {payment.customerAmount !== undefined && payment.customerAmount !== payment.amount && (
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Acréscimo</span>
                      <span>{formatCurrency((payment.customerAmount ?? 0) - payment.amount)}</span>
                    </div>
                  )}
                </div>
              ))}
              {tradeInSubtotal > 0 && (
                <div className="rounded border border-gray-200 px-2 py-1">
                  <div className="flex justify-between">
                    <span className="font-medium">Troca ({tradeIns.length} aparelho{tradeIns.length !== 1 ? 's' : ''})</span>
                    <span>{formatCurrency(tradeInSubtotal)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded border border-gray-300 p-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-medium">{formatCurrency(negotiatedSubtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-red-700">
                <span>
                  Desconto
                  {sale.discountType === 'percent' && discountPercent !== null ? ` (${discountPercent.toFixed(2)}%)` : ''}
                </span>
                <span>- {formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Total da venda</span>
              <span className="font-medium">{formatCurrency(saleGrossTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Acréscimo cartão</span>
              <span>{formatCurrency(cardFeeTotal)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-300 pt-1 font-semibold text-sm">
              <span>Total pago</span>
              <span>{formatCurrency(totalCustomerWithTradeIn)}</span>
            </div>
            {tradeInSubtotal > 0 && (
              <>
                <div className="flex justify-between">
                  <span>Trade-in pago</span>
                  <span className="font-medium">{formatCurrency(tradeInSubtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Líquido em contas</span>
                  <span className="font-medium">{formatCurrency(sale.total)}</span>
                </div>
              </>
            )}
          </div>
        </section>

        <footer className="mt-4 border-t border-gray-300 pt-3 text-sm text-gray-700">
          {sale.items.some((item) => getItemWarrantyLabel(sale, item)) ? (
            <div>
              <p className="font-semibold">Garantias por aparelho:</p>
              {sale.items.map((item, index) => {
                const warrantyLabel = getItemWarrantyLabel(sale, item);
                if (!warrantyLabel) return null;
                return (
                  <p key={`${item.id}-a4-warranty-${index}`}>
                    {item.model}
                    {item.capacity ? ` ${item.capacity}` : ''}: {warrantyLabel}
                  </p>
                );
              })}
            </div>
          ) : (
            <p>Sem garantia de app para esta venda.</p>
          )}
          <p className="mt-1">Obrigado pela preferência.</p>
        </footer>
      </div>
    </>,
    document.body
  );
};

export default PDVHistory;
