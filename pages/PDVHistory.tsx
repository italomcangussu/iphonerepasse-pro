import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDisclosure } from '../hooks/useDisclosure';
import { CalendarDays, Copy, Edit, Eye, Filter, MessageCircle, Plus, Printer, RotateCcw, ShoppingCart, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../services/dataContext';
import { useSalesHistoryDemand } from '../hooks/useDataGroupDemand';
import { BusinessProfile, Condition, PaymentMethod, Sale, SaleTradeInItem, StockItem, StockStatus } from '../types';
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
import { FINANCIAL_ACCOUNTS } from '../utils/financialAccounts';
import { newId } from '../utils/id';
import { formatCurrencyBRL } from '../utils/inputMasks';
import { roundCurrency } from '../utils/pdvPricing';
import { sendReceiptWhatsApp } from '../utils/sendReceiptWhatsApp';
import { formatSaleNumber } from '../utils/saleCode';
import { buildSaleReceiptBuffer, useThermalPrinter, ThermalReceiptData } from '../utils/thermalPrinter';

type PeriodPreset = 'today' | 'last7' | 'custom';
type SaleState = 'completed' | 'debt' | 'warranty_active' | 'warranty_expired';
type SaleStateFilter = 'all' | SaleState;
type ConditionFilter = 'all' | Condition;
type PaymentFilter = 'all' | PaymentMethod['type'];
type ReceiptPrintLayout = '80mm' | 'a4';
type DiscountInputType = 'amount' | 'percent';

type EditableSoldItemRow = {
  id: string;
  stockItemId: string;
  sellPrice: string;
  originalSellPrice: string;
};

type EditableTradeInRow = {
  id: string;
  stockItemId: string;
  model: string;
  capacity: string;
  color: string;
  imei: string;
  condition: string;
  receivedValue: string;
};

type EditablePaymentRow = {
  id: string;
  type: PaymentMethod['type'];
  amount: string;
  account: string;
  installments: string;
  cardBrand: 'visa_master' | 'outras';
  customerAmount: string;
  feeRate: string;
  feeAmount: string;
  debtDueDate: string;
  debtInstallments: string;
  debtNotes: string;
};

const PRINT_PAGE_STYLE_ID = 'pdv-history-print-page-style';
const PRINT_MODAL_EXIT_DELAY_MS = 180;
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

const parseNumberInput = (value: string, fallback = 0): number => {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toDateTimeLocalInput = (isoDate: string): string => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
};

const fromDateTimeLocalInput = (value: string, fallbackIso: string): string => {
  if (!value) return fallbackIso;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallbackIso;
  return parsed.toISOString();
};

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

const getNegotiatedSubtotal = (sale: Sale): number =>
  sale.negotiatedSubtotal ?? sale.items.reduce((acc, item) => acc + Number(item.sellPrice || 0), 0);

const hasNegotiationSnapshot = (sale: Sale): boolean => {
  const original = getOriginalSubtotal(sale);
  const negotiated = getNegotiatedSubtotal(sale);
  return Math.abs(original - negotiated) > 0.009 || Number(sale.discount || 0) > 0;
};

const getPaymentLabel = (payment: PaymentMethod) => {
  if (payment.type === 'Cartão Débito') {
    return 'Cartão Débito';
  }
  if (payment.type !== 'Cartão') {
    return payment.installments ? `${payment.type} ${payment.installments}x` : payment.type;
  }
  const brandLabel = payment.cardBrand === 'outras' ? 'Outras' : 'Visa/Master';
  const installmentsLabel = payment.installments ? ` ${payment.installments}x` : '';
  return `Cartão ${brandLabel}${installmentsLabel}`;
};

const getSaleTradeIns = (sale: Sale): SaleTradeInItem[] => {
  if (sale.tradeIns && sale.tradeIns.length > 0) return sale.tradeIns;
  if (!sale.tradeIn) return [];

  return [
    {
      id: `legacy-${sale.id}`,
      stockItemId: sale.tradeIn.id,
      model: sale.tradeIn.model,
      capacity: sale.tradeIn.capacity || undefined,
      color: sale.tradeIn.color || undefined,
      imei: sale.tradeIn.imei || undefined,
      condition: sale.tradeIn.condition || undefined,
      receivedValue: sale.tradeInValue
    }
  ];
};

const getSaleTradeInSubtotal = (sale: Sale): number => {
  const tradeIns = getSaleTradeIns(sale);
  return roundCurrency(
    tradeIns.length > 0
      ? tradeIns.reduce((acc, item) => acc + Number(item.receivedValue || 0), 0)
      : Number(sale.tradeInValue || 0)
  );
};

const getSaleHistoryTotal = (sale: Sale): number => roundCurrency(Number(sale.total || 0) + getSaleTradeInSubtotal(sale));

const getPaymentCustomerAmount = (payment: PaymentMethod): number =>
  roundCurrency(Number(payment.customerAmount ?? payment.amount ?? 0));

const getSaleFinancialPaymentTotal = (sale: Sale): number =>
  roundCurrency(sale.paymentMethods.reduce((acc, payment) => acc + getPaymentCustomerAmount(payment), 0));

const getSalePaidTotal = (sale: Sale): number =>
  roundCurrency(getSaleFinancialPaymentTotal(sale) + getSaleTradeInSubtotal(sale));

const getItemWarrantyDate = (sale: Sale, item: StockItem): string | null => {
  if (item.condition !== Condition.USED) return null;
  return item.warrantyExpiresAt || item.warrantyEnd || sale.warrantyExpiresAt || null;
};

const getItemWarrantyLabel = (sale: Sale, item: StockItem): string | null => {
  if (item.condition === Condition.NEW) return 'Garantia Apple: 1 ano';
  const warrantyDate = getItemWarrantyDate(sale, item);
  if (!warrantyDate) return null;
  return `Garantia loja: até ${new Date(warrantyDate).toLocaleDateString('pt-BR')}`;
};

const buildDefaultPaymentRow = (): EditablePaymentRow => ({
  id: newId('pmedit'),
  type: 'Pix',
  amount: '',
  account: FINANCIAL_ACCOUNTS[0],
  installments: '',
  cardBrand: 'visa_master',
  customerAmount: '',
  feeRate: '',
  feeAmount: '',
  debtDueDate: '',
  debtInstallments: '1',
  debtNotes: ''
});

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
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<SaleStateFilter>('all');
  const [selectedCondition, setSelectedCondition] = useState<ConditionFilter>('all');
  const [selectedPayment, setSelectedPayment] = useState<PaymentFilter>('all');
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null);
  const [saleToView, setSaleToView] = useState<Sale | null>(null);
  const [saleToPrint, setSaleToPrint] = useState<Sale | null>(null);
  const { isOpen: isPrintFormatModalOpen, open: openPrintFormatModal, close: closePrintFormatModal } = useDisclosure();
  const [receiptPrintLayout, setReceiptPrintLayout] = useState<ReceiptPrintLayout>('80mm');
  const [saleToEditComplete, setSaleToEditComplete] = useState<Sale | null>(null);
  const [isCancellingSale, setIsCancellingSale] = useState(false);
  const [sendingReceiptSaleId, setSendingReceiptSaleId] = useState<string | null>(null);

  const thermalPrinter = useThermalPrinter();
  const pendingPrintTimeoutRef = useRef<number | null>(null);

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

        if (selectedCondition !== 'all' && !sale.items.some(item => item.condition === selectedCondition)) {
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
  }, [sales, selectedStoreId, selectedState, selectedCondition, selectedPayment, startDate, endDate, sellersById]);

  const filteredTotal = useMemo(
    () => filteredSales.reduce((acc, sale) => acc + getSaleHistoryTotal(sale), 0),
    [filteredSales]
  );
  const salesPagination = usePaginatedRows(filteredSales, {
    pageSize: isCompactLayout ? PDV_HISTORY_PAGE_SIZE_MOBILE : PDV_HISTORY_PAGE_SIZE_DESKTOP,
    resetKey: `${periodPreset}|${startDate}|${endDate}|${selectedStoreId}|${selectedState}|${selectedCondition}|${selectedPayment}|${isCompactLayout ? 'compact' : 'desktop'}`,
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

  const clearPrintLayout = () => {
    if (pendingPrintTimeoutRef.current !== null) {
      window.clearTimeout(pendingPrintTimeoutRef.current);
      pendingPrintTimeoutRef.current = null;
    }
    const pageStyleTag = document.getElementById(PRINT_PAGE_STYLE_ID);
    pageStyleTag?.remove();
    document.body.removeAttribute('data-print-layout');
  };

  const applyPrintPageSize = (layout: ReceiptPrintLayout) => {
    const existingPageStyle = document.getElementById(PRINT_PAGE_STYLE_ID);
    existingPageStyle?.remove();

    const pageStyle = document.createElement('style');
    pageStyle.id = PRINT_PAGE_STYLE_ID;
    pageStyle.media = 'print';
    pageStyle.textContent =
      layout === '80mm'
        ? '@page { size: 80mm auto; margin: 0; }'
        : '@page { size: A4 portrait; margin: 10mm; }';
    document.head.appendChild(pageStyle);
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
    await run(async () => {
      await waitForReceiptTemplateRender();
      await sendReceiptWhatsApp({ phone: customer.phone, storeId, saleId: sale.id, customerName: customer.name });
      toast.success('Comprovante reenviado via WhatsApp.');
    }, 'Erro ao reenviar comprovante.');
    setSendingReceiptSaleId(null);
  };

  const handlePrintReceipt = () => {
    if (!saleToPrint) return;
    const selectedLayout = receiptPrintLayout;

    // ESC/POS direct-to-thermal path (80mm + printer connected)
    if (selectedLayout === '80mm' && thermalPrinter.status === 'connected') {
      closePrintFormatModal();
      const sale = saleToPrint;
      const tradeIns = getSaleTradeIns(sale);
      const tradeInSubtotal = getSaleTradeInSubtotal(sale);
      const negotiatedSubtotal = roundCurrency(getNegotiatedSubtotal(sale));
      const originalSubtotal = roundCurrency(getOriginalSubtotal(sale));
      const discountAmount = roundCurrency(Number(sale.discount || 0));
      const hasPriceAdjustment = Math.abs(originalSubtotal - negotiatedSubtotal) > 0.009;
      const cardFeeTotal = roundCurrency(
        sale.paymentMethods.reduce((acc, p) => acc + Number(p.feeAmount || 0), 0)
      );
      const saleGrossTotal = getSaleHistoryTotal(sale);
      const totalCustomerWithTradeIn = getSalePaidTotal(sale);
      const hasWarrantyByItem = sale.items.some((item) => getItemWarrantyLabel(sale, item));
      const warrantyLine = hasWarrantyByItem ? 'Garantias descritas por aparelho.' : null;
      const discountLabel = sale.discountType === 'percent' && (sale.discountPercent ?? null) !== null
        ? `Desconto (${sale.discountPercent!.toFixed(2)}%)`
        : 'Desconto';

      const receiptData: ThermalReceiptData = {
        saleId: sale.id,
        saleNumber: sale.saleNumber,
        saleDate: sale.date,
        businessName: businessProfile?.name || 'iPhoneRepasse',
        businessAddress: businessProfile?.address || undefined,
        businessCnpj: businessProfile?.cnpj || undefined,
        businessPhone: businessProfile?.phone || undefined,
        customerName: getCustomerName(sale),
        customerCpf: customersById.get(sale.customerId)?.cpf || undefined,
        sellerName: getSellerName(sale),
        items: sale.items.map((item) => ({
          model: item.model,
          capacity: item.capacity,
          color: item.color,
          imei: item.imei,
          sellPrice: item.sellPrice,
          condition: item.condition,
          warrantyExpiresAt: getItemWarrantyDate(sale, item),
        })),
        tradeIns: tradeIns.map((ti) => ({
          model: ti.model,
          capacity: ti.capacity,
          color: ti.color,
          imei: ti.imei,
          receivedValue: ti.receivedValue,
        })),
        tradeInSubtotal,
        payments: sale.paymentMethods.map((p) => ({
          label: getPaymentLabel(p),
          customerAmount: getPaymentCustomerAmount(p),
          storeAmount: roundCurrency(p.amount),
        })),
        negotiatedSubtotal,
        originalSubtotal,
        hasPriceAdjustment,
        discountAmount,
        discountLabel,
        saleGrossTotal,
        cardFeeTotal,
        totalCustomerWithTradeIn,
        saleNetTotal: sale.total,
        warrantyLine,
      };

      const buffer = buildSaleReceiptBuffer(receiptData);
      thermalPrinter.print(buffer).catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : 'Erro ao imprimir na térmica.');
      });
      return;
    }

    // Standard window.print() path
    clearPrintLayout();
    applyPrintPageSize(selectedLayout);
    document.body.setAttribute('data-print-layout', selectedLayout);
    closePrintFormatModal();

    window.addEventListener('afterprint', clearPrintLayout, { once: true });

    const runPrint = () => {
      applyPrintPageSize(selectedLayout);
      document.body.setAttribute('data-print-layout', selectedLayout);
      window.print();
    };

    pendingPrintTimeoutRef.current = window.setTimeout(() => {
      pendingPrintTimeoutRef.current = null;
      runPrint();
    }, PRINT_MODAL_EXIT_DELAY_MS);
  };

  useEffect(() => {
    return () => {
      clearPrintLayout();
    };
  }, []);

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
    setSelectedStoreId(defaultUserStoreId === 'all' ? 'all' : defaultUserStoreId);
    setSelectedState('all');
    setSelectedCondition('all');
    setSelectedPayment('all');
    setPeriodPreset('last7');
    const d = new Date();
    d.setDate(d.getDate() - 6);
    setStartDate(formatDateForInput(d));
    setEndDate(todayStr);
  };

  const handleUpdateSale = async (updates: Partial<Sale>) => {
    if (!saleToEdit) return;
    try {
      await updateSale(saleToEdit.id, updates);
      toast.success('Venda atualizada com sucesso.');
      setSaleToEdit(null);
      if (saleToView?.id === saleToEdit.id) {
        setSaleToView(null);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao atualizar venda.');
      throw err;
    } finally {
    }
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
          onSelect: () => setSaleToEdit(sale),
        },
        {
          id: 'complete-edit',
          label: 'Edição completa',
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
              Nenhuma venda encontrada com os filtros atuais.
            </p>
            <Link to="/pdv/nova-venda" className="ios-button-primary inline-flex mt-4">
              Nova venda
            </Link>
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
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-ios border border-gray-200 dark:border-surface-dark-200 bg-white dark:bg-surface-dark-100 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-surface-dark-700 hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors"
                      >
                        <Eye size={12} />
                        Detalhes
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setSaleToEdit(sale)}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-ios border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                        >
                          <Edit size={12} />
                          Editar
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setSaleToCancel(sale)}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-ios border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                        >
                          <RotateCcw size={12} />
                          Cancelar venda
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setSaleToEditComplete(sale)}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-ios border border-purple-200 dark:border-purple-900/40 bg-purple-50 dark:bg-purple-900/20 px-3 py-2 text-xs font-semibold text-purple-600 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                        >
                          <Edit size={12} />
                          Edição Completa
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
                                onClick={() => setSaleToEdit(sale)}
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
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => setSaleToEditComplete(sale)}
                                className="inline-flex items-center gap-1.5 rounded-ios border border-purple-200 dark:border-purple-900/40 bg-purple-50 dark:bg-purple-900/20 px-2.5 py-1 text-xs font-semibold text-purple-600 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors whitespace-nowrap"
                              >
                                <Edit size={12} />
                                Edição Completa
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
          setSaleToEdit(sale);
        }}
      />

      <SaleEditModal
        open={!!saleToEdit}
        onClose={() => setSaleToEdit(null)}
        sale={saleToEdit}
        onSave={handleUpdateSale}
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
      customerName={saleToPrint ? getCustomerName(saleToPrint) : 'Não identificado'}
      customerCpf={saleToPrint ? customersById.get(saleToPrint.customerId)?.cpf : undefined}
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
  const customer = sale ? getCustomer(sale) : undefined;
  const formatCpf = (cpf: string) => {
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11) return cpf;
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };
  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    return phone;
  };
  const formatBirthDate = (date: string) => {
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString('pt-BR');
  };
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
                <span className="font-semibold">CPF:</span> {formatCpf(customer.cpf)}
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
                <p className="text-xs text-gray-600 dark:text-surface-dark-600 mt-1">
                  Original: {formatCurrency(item.originalSellPrice ?? item.sellPrice)} · Negociado: {formatCurrency(item.sellPrice)}
                </p>
                {getItemWarrantyLabel(sale, item) && (
                  <p className="text-xs text-gray-600 dark:text-surface-dark-600 mt-1">
                    {getItemWarrantyLabel(sale, item)}
                  </p>
                )}
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

interface SaleEditModalProps {
  open: boolean;
  onClose: () => void;
  sale: Sale | null;
  onSave: (updates: Partial<Sale>) => Promise<void>;
}

const SaleEditModal: React.FC<SaleEditModalProps> = ({ open, onClose, sale, onSave }) => {
  const { customers, sellers, stock } = useData();

  const [customerId, setCustomerId] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [saleDateInput, setSaleDateInput] = useState('');
  const [notes, setNotes] = useState('');
  const [discountType, setDiscountType] = useState<DiscountInputType>('amount');
  const [discountValue, setDiscountValue] = useState('0');
  const [soldItems, setSoldItems] = useState<EditableSoldItemRow[]>([]);
  const [tradeInItems, setTradeInItems] = useState<EditableTradeInRow[]>([]);
  const [payments, setPayments] = useState<EditablePaymentRow[]>([]);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const stockItems = stock ?? [];
  const sellersList = sellers ?? [];
  const customersList = customers ?? [];

  const stockById = useMemo(() => new Map(stockItems.map((item) => [item.id, item])), [stockItems]);

  useEffect(() => {
    if (!open || !sale) return;

    setCustomerId(sale.customerId);
    setSellerId(sale.sellerId);
    setSaleDateInput(toDateTimeLocalInput(sale.date));
    setNotes(sale.notes || sale.observations || '');

    setDiscountType(sale.discountType === 'percent' ? 'percent' : 'amount');
    setDiscountValue(
      sale.discountType === 'percent'
        ? String(roundCurrency(Number(sale.discountPercent || 0)))
        : String(roundCurrency(Number(sale.discount || 0)))
    );

    setSoldItems(
      sale.items.length > 0
        ? sale.items.map((item, index) => ({
            id: `${item.id}-${index}`,
            stockItemId: item.id,
            sellPrice: String(roundCurrency(item.sellPrice || 0)),
            originalSellPrice: String(roundCurrency(item.originalSellPrice ?? item.sellPrice ?? 0))
          }))
        : [
            {
              id: newId('sedit'),
              stockItemId: '',
              sellPrice: '',
              originalSellPrice: ''
            }
          ]
    );

    const tradeIns = getSaleTradeIns(sale);
    setTradeInItems(
      tradeIns.map((tradeIn, index) => ({
        id: `${tradeIn.id || 'sti'}-${index}`,
        stockItemId: tradeIn.stockItemId || '',
        model: tradeIn.model || '',
        capacity: tradeIn.capacity || '',
        color: tradeIn.color || '',
        imei: tradeIn.imei || '',
        condition: tradeIn.condition || '',
        receivedValue: String(roundCurrency(Number(tradeIn.receivedValue || 0)))
      }))
    );

    setPayments(
      sale.paymentMethods.length > 0
        ? sale.paymentMethods.map((payment, index) => ({
            id: `pm-${index}-${payment.type}`,
            type: payment.type,
            amount: String(roundCurrency(payment.amount || 0)),
            account: payment.account || FINANCIAL_ACCOUNTS[0],
            installments: payment.installments ? String(payment.installments) : '',
            cardBrand: payment.cardBrand || 'visa_master',
            customerAmount: payment.customerAmount !== undefined ? String(roundCurrency(payment.customerAmount)) : '',
            feeRate: payment.feeRate !== undefined ? String(roundCurrency(payment.feeRate)) : '',
            feeAmount: payment.feeAmount !== undefined ? String(roundCurrency(payment.feeAmount)) : '',
            debtDueDate: payment.debtDueDate || '',
            debtInstallments: payment.debtInstallments ? String(payment.debtInstallments) : '1',
            debtNotes: payment.debtNotes || ''
          }))
        : [buildDefaultPaymentRow()]
    );

    setFormError('');
  }, [open, sale]);

  const soldSelectableStock = useMemo(() => {
    const selectedIds = new Set(soldItems.map((item) => item.stockItemId).filter(Boolean));
    return stockItems.filter((item) => item.status === StockStatus.AVAILABLE || selectedIds.has(item.id));
  }, [stockItems, soldItems]);

  const negotiatedSubtotal = useMemo(
    () => roundCurrency(soldItems.reduce((acc, item) => acc + Math.max(0, parseNumberInput(item.sellPrice, 0)), 0)),
    [soldItems]
  );

  const originalSubtotal = useMemo(
    () =>
      roundCurrency(
        soldItems.reduce((acc, item) => {
          const negotiated = Math.max(0, parseNumberInput(item.sellPrice, 0));
          const original = Math.max(0, parseNumberInput(item.originalSellPrice, negotiated));
          return acc + original;
        }, 0)
      ),
    [soldItems]
  );

  const tradeInSubtotal = useMemo(
    () =>
      roundCurrency(
        tradeInItems.reduce((acc, item) => acc + Math.max(0, parseNumberInput(item.receivedValue, 0)), 0)
      ),
    [tradeInItems]
  );

  const discountAmount = useMemo(() => {
    const discountRaw = Math.max(0, parseNumberInput(discountValue, 0));
    if (discountType === 'percent') {
      return roundCurrency(Math.min(negotiatedSubtotal, negotiatedSubtotal * (discountRaw / 100)));
    }
    return roundCurrency(Math.min(negotiatedSubtotal, discountRaw));
  }, [discountType, discountValue, negotiatedSubtotal]);

  const grossSaleTotal = useMemo(
    () => roundCurrency(Math.max(0, negotiatedSubtotal - discountAmount)),
    [negotiatedSubtotal, discountAmount]
  );

  const netFinancialTotal = useMemo(
    () => roundCurrency(Math.max(0, grossSaleTotal - tradeInSubtotal)),
    [grossSaleTotal, tradeInSubtotal]
  );

  const paymentsTotal = useMemo(
    () => roundCurrency(payments.reduce((acc, payment) => acc + Math.max(0, parseNumberInput(payment.amount, 0)), 0)),
    [payments]
  );

  const combinedPaymentsTotal = useMemo(
    () => roundCurrency(paymentsTotal + tradeInSubtotal),
    [paymentsTotal, tradeInSubtotal]
  );

  const hasBalancedPayments = Math.abs(combinedPaymentsTotal - grossSaleTotal) < 0.01;

  const setSoldItemField = (rowId: string, field: keyof EditableSoldItemRow, value: string) => {
    setSoldItems((prev) => prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)));
  };

  const setTradeInField = (rowId: string, field: keyof EditableTradeInRow, value: string) => {
    setTradeInItems((prev) => prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)));
  };

  const setPaymentField = (rowId: string, field: keyof EditablePaymentRow, value: string) => {
    setPayments((prev) => prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)));
  };

  const handleSoldStockChange = (rowId: string, stockItemId: string) => {
    const stockItem = stockById.get(stockItemId);
    setSoldItems((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              stockItemId,
              sellPrice: stockItem ? String(roundCurrency(stockItem.sellPrice)) : row.sellPrice,
              originalSellPrice: stockItem ? String(roundCurrency(stockItem.sellPrice)) : row.originalSellPrice
            }
          : row
      )
    );
  };

  const handleTradeInStockChange = (rowId: string, stockItemId: string) => {
    const stockItem = stockById.get(stockItemId);
    setTradeInItems((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        if (!stockItem) return { ...row, stockItemId };

        return {
          ...row,
          stockItemId,
          model: stockItem.model || row.model,
          capacity: stockItem.capacity || row.capacity,
          color: stockItem.color || row.color,
          imei: stockItem.imei || row.imei,
          condition: stockItem.condition || row.condition,
          receivedValue:
            row.receivedValue.trim().length > 0
              ? row.receivedValue
              : String(roundCurrency(stockItem.purchasePrice || 0))
        };
      })
    );
  };

  const addSoldItemRow = () => {
    setSoldItems((prev) => [
      ...prev,
      {
        id: newId('sedit'),
        stockItemId: '',
        sellPrice: '',
        originalSellPrice: ''
      }
    ]);
  };

  const addTradeInRow = () => {
    setTradeInItems((prev) => [
      ...prev,
      {
        id: newId('tedit'),
        stockItemId: '',
        model: '',
        capacity: '',
        color: '',
        imei: '',
        condition: '',
        receivedValue: ''
      }
    ]);
  };

  const addPaymentRow = () => {
    setPayments((prev) => [...prev, buildDefaultPaymentRow()]);
  };

  const removeSoldItemRow = (rowId: string) => {
    setSoldItems((prev) => prev.filter((row) => row.id !== rowId));
  };

  const removeTradeInRow = (rowId: string) => {
    setTradeInItems((prev) => prev.filter((row) => row.id !== rowId));
  };

  const removePaymentRow = (rowId: string) => {
    setPayments((prev) => prev.filter((row) => row.id !== rowId));
  };

  const handleSave = async () => {
    if (!sale) return;

    setFormError('');

    if (!customerId || !sellerId) {
      setFormError('Selecione cliente e vendedor para salvar.');
      return;
    }

    if (soldItems.length === 0) {
      setFormError('Adicione ao menos um aparelho vendido.');
      return;
    }

    if (payments.length === 0) {
      setFormError('Adicione ao menos uma forma de pagamento.');
      return;
    }

    const saleItemsById = new Map(sale.items.map((item) => [item.id, item]));

    let normalizedItems: StockItem[] = [];
    try {
      normalizedItems = soldItems.map((row) => {
        if (!row.stockItemId) {
          throw new Error('Selecione o aparelho vendido em todas as linhas.');
        }

        const sourceItem = stockById.get(row.stockItemId) || saleItemsById.get(row.stockItemId);
        if (!sourceItem) {
          throw new Error('Um aparelho selecionado não foi encontrado no estoque.');
        }

        const negotiatedPrice = roundCurrency(Math.max(0, parseNumberInput(row.sellPrice, sourceItem.sellPrice || 0)));
        const originalPrice = roundCurrency(
          Math.max(0, parseNumberInput(row.originalSellPrice, negotiatedPrice || sourceItem.sellPrice || 0))
        );

        return {
          ...sourceItem,
          sellPrice: negotiatedPrice,
          originalSellPrice: originalPrice
        };
      });
    } catch (error: any) {
      setFormError(error?.message || 'Não foi possível validar os itens vendidos.');
      return;
    }

    const normalizedTradeIns: SaleTradeInItem[] = tradeInItems
      .map((row) => {
        const stockItem = row.stockItemId ? stockById.get(row.stockItemId) : undefined;
        const receivedValue = roundCurrency(Math.max(0, parseNumberInput(row.receivedValue, 0)));
        const model = (row.model || stockItem?.model || '').trim();

        return {
          id: row.id || newId('sti'),
          stockItemId: row.stockItemId || stockItem?.id || undefined,
          model: model || 'Trade-in',
          capacity: (row.capacity || stockItem?.capacity || '').trim() || undefined,
          color: (row.color || stockItem?.color || '').trim() || undefined,
          imei: (row.imei || stockItem?.imei || '').trim() || undefined,
          condition: (row.condition || stockItem?.condition || '').trim() || undefined,
          receivedValue
        };
      })
      .filter((tradeIn) => tradeIn.receivedValue > 0);

    const normalizedPayments: PaymentMethod[] = payments
      .map((row) => {
        const amount = roundCurrency(Math.max(0, parseNumberInput(row.amount, 0)));
        if (amount <= 0) return null;

        const installmentsNumber = Math.trunc(Math.max(1, parseNumberInput(row.installments, 1)));
        const debtInstallmentsNumber = Math.trunc(Math.max(1, parseNumberInput(row.debtInstallments, 1)));
        const customerAmount = roundCurrency(Math.max(0, parseNumberInput(row.customerAmount, amount)));
        const feeRate = roundCurrency(Math.max(0, parseNumberInput(row.feeRate, 0)));
        const feeAmount = roundCurrency(Math.max(0, parseNumberInput(row.feeAmount, 0)));

        return {
          type: row.type,
          amount,
          account: row.type === 'Devedor' ? undefined : (row.account as PaymentMethod['account']),
          installments: row.type === 'Cartão' ? installmentsNumber : undefined,
          cardBrand: row.type === 'Cartão' ? row.cardBrand : undefined,
          customerAmount: row.type === 'Cartão' || row.type === 'Cartão Débito' ? customerAmount : undefined,
          feeRate: (row.type === 'Cartão' || row.type === 'Cartão Débito') && feeRate > 0 ? feeRate : undefined,
          feeAmount: (row.type === 'Cartão' || row.type === 'Cartão Débito') && feeAmount > 0 ? feeAmount : undefined,
          debtDueDate: row.type === 'Devedor' ? row.debtDueDate || undefined : undefined,
          debtInstallments: row.type === 'Devedor' ? debtInstallmentsNumber : undefined,
          debtNotes: row.type === 'Devedor' ? row.debtNotes || undefined : undefined
        } as PaymentMethod;
      })
      .filter((payment): payment is PaymentMethod => payment !== null);

    if (normalizedPayments.length === 0) {
      setFormError('Informe pelo menos uma forma de pagamento com valor maior que zero.');
      return;
    }

    const normalizedPaymentsTotal = roundCurrency(
      normalizedPayments.reduce((acc, payment) => acc + Number(payment.amount || 0), 0)
    );
    const tradeInValue = roundCurrency(normalizedTradeIns.reduce((acc, tradeIn) => acc + Number(tradeIn.receivedValue || 0), 0));
    if (Math.abs(roundCurrency(normalizedPaymentsTotal + tradeInValue) - grossSaleTotal) > 0.01) {
      setFormError('A soma dos pagamentos financeiros mais o trade-in deve ser igual ao total da venda.');
      return;
    }

    const discountPercentValue = roundCurrency(Math.max(0, parseNumberInput(discountValue, 0)));
    const selectedSellerStoreId = sellersList.find((seller) => seller.id === sellerId)?.storeId;

    const firstTradeInStockItemId = normalizedTradeIns[0]?.stockItemId;
    const legacyTradeIn = firstTradeInStockItemId ? stockById.get(firstTradeInStockItemId) : undefined;

    const payload: Partial<Sale> = {
      customerId,
      sellerId,
      storeId: selectedSellerStoreId || sale.storeId,
      date: fromDateTimeLocalInput(saleDateInput, sale.date),
      notes: notes.trim(),
      observations: notes.trim(),
      items: normalizedItems,
      tradeIns: normalizedTradeIns,
      tradeIn: legacyTradeIn,
      tradeInValue,
      discount: discountAmount,
      discountType: discountAmount > 0 ? discountType : null,
      discountPercent: discountAmount > 0 && discountType === 'percent' ? discountPercentValue : null,
      originalSubtotal,
      negotiatedSubtotal,
      total: netFinancialTotal,
      paymentMethods: normalizedPayments
    };

    setIsSaving(true);
    try {
      await onSave(payload);
      setFormError('');
    } catch (error: any) {
      setFormError(error?.message || 'Não foi possível salvar as alterações da venda.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!sale) return null;

  return (
    <Modal open={open} onClose={onClose} title="Editar Venda Concluida" size="xl">
      <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="ios-label">Cliente</label>
            <select className="ios-input" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              {customersList.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="ios-label">Vendedor</label>
            <select className="ios-input" value={sellerId} onChange={(event) => setSellerId(event.target.value)}>
              {sellersList.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="ios-label">Data da venda</label>
            <input
              type="datetime-local"
              className="ios-input"
              value={saleDateInput}
              onChange={(event) => setSaleDateInput(event.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="ios-label">Observações</label>
          <textarea
            className="ios-input min-h-[90px]"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Observações internas da venda..."
          />
        </div>

        <div className="rounded-ios border app-border p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Desconto</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="ios-label">Tipo</label>
              <select
                className="ios-input"
                value={discountType}
                onChange={(event) => setDiscountType(event.target.value as DiscountInputType)}
              >
                <option value="amount">Valor (R$)</option>
                <option value="percent">Percentual (%)</option>
              </select>
            </div>
            <div>
              <label className="ios-label">Valor</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="ios-input"
                onFocus={(e) => e.target.select()}
                value={discountValue}
                onChange={(event) => setDiscountValue(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="rounded-ios border app-border p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Aparelho(s) vendido(s)</p>
            <button type="button" className="ios-button-secondary text-xs" onClick={addSoldItemRow}>
              <span className="inline-flex items-center gap-1">
                <Plus size={12} />
                Adicionar item
              </span>
            </button>
          </div>

          <div className="space-y-3">
            {soldItems.map((item) => (
              <div key={item.id} className="rounded-ios border app-border p-3 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div>
                    <label className="ios-label">Aparelho</label>
                    <select
                      className="ios-input"
                      value={item.stockItemId}
                      onChange={(event) => handleSoldStockChange(item.id, event.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {soldSelectableStock.map((stockItem) => (
                        <option key={stockItem.id} value={stockItem.id}>
                          {stockItem.model} {stockItem.capacity || ''} · IMEI/Serial {stockItem.imei || '-'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="ios-label">Valor original (R$)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="ios-input"
                      onFocus={(e) => e.target.select()}
                      value={item.originalSellPrice}
                      onChange={(event) => setSoldItemField(item.id, 'originalSellPrice', event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="ios-label">Valor negociado (R$)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="ios-input"
                      onFocus={(e) => e.target.select()}
                      value={item.sellPrice}
                      onChange={(event) => setSoldItemField(item.id, 'sellPrice', event.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                    onClick={() => removeSoldItemRow(item.id)}
                    disabled={soldItems.length === 1}
                  >
                    <Trash2 size={12} />
                    Remover item
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-ios border app-border p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Aparelho(s) trade-in</p>
            <button type="button" className="ios-button-secondary text-xs" onClick={addTradeInRow}>
              <span className="inline-flex items-center gap-1">
                <Plus size={12} />
                Adicionar trade-in
              </span>
            </button>
          </div>

          {tradeInItems.length === 0 ? (
            <p className="text-sm text-gray-500">Sem trade-in nesta venda.</p>
          ) : (
            <div className="space-y-3">
              {tradeInItems.map((tradeIn) => (
                <div key={tradeIn.id} className="rounded-ios border app-border p-3 space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <label className="ios-label">Selecionar do estoque (opcional)</label>
                      <select
                        className="ios-input"
                        value={tradeIn.stockItemId}
                        onChange={(event) => handleTradeInStockChange(tradeIn.id, event.target.value)}
                      >
                        <option value="">Não vincular</option>
                        {stockItems.map((stockItem) => (
                          <option key={stockItem.id} value={stockItem.id}>
                            {stockItem.model} {stockItem.capacity || ''} · IMEI/Serial {stockItem.imei || '-'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="ios-label">Modelo</label>
                      <input
                        className="ios-input"
                        value={tradeIn.model}
                        onChange={(event) => setTradeInField(tradeIn.id, 'model', event.target.value)}
                        placeholder="Ex.: iPhone 13"
                      />
                    </div>
                    <div>
                      <label className="ios-label">Valor recebido (R$)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="ios-input"
                        onFocus={(e) => e.target.select()}
                        value={tradeIn.receivedValue}
                        onChange={(event) => setTradeInField(tradeIn.id, 'receivedValue', event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div>
                      <label className="ios-label">Capacidade</label>
                      <input
                        className="ios-input"
                        value={tradeIn.capacity}
                        onChange={(event) => setTradeInField(tradeIn.id, 'capacity', event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="ios-label">Cor</label>
                      <input
                        className="ios-input"
                        value={tradeIn.color}
                        onChange={(event) => setTradeInField(tradeIn.id, 'color', event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="ios-label">IMEI/Serial</label>
                      <input
                        className="ios-input"
                        value={tradeIn.imei}
                        onChange={(event) => setTradeInField(tradeIn.id, 'imei', event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="ios-label">Condição</label>
                      <input
                        className="ios-input"
                        value={tradeIn.condition}
                        onChange={(event) => setTradeInField(tradeIn.id, 'condition', event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                      onClick={() => removeTradeInRow(tradeIn.id)}
                    >
                      <Trash2 size={12} />
                      Remover trade-in
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-ios border app-border p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Formas de pagamento</p>
            <button type="button" className="ios-button-secondary text-xs" onClick={addPaymentRow}>
              <span className="inline-flex items-center gap-1">
                <Plus size={12} />
                Adicionar pagamento
              </span>
            </button>
          </div>

          <div className="space-y-3">
            {payments.map((payment) => (
              <div key={payment.id} className="rounded-ios border app-border p-3 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div>
                    <label className="ios-label">Tipo</label>
                    <select
                      className="ios-input"
                      value={payment.type}
                      onChange={(event) => setPaymentField(payment.id, 'type', event.target.value)}
                    >
                      <option value="Pix">Pix</option>
                      <option value="Dinheiro">Dinheiro</option>
                      <option value="Cartão">Cartão Crédito</option>
                      <option value="Cartão Débito">Cartão Débito</option>
                      <option value="Devedor">Devedor</option>
                    </select>
                  </div>
                  <div>
                    <label className="ios-label">Valor líquido (R$)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="ios-input"
                      onFocus={(e) => e.target.select()}
                      value={payment.amount}
                      onChange={(event) => setPaymentField(payment.id, 'amount', event.target.value)}
                    />
                  </div>
                  {payment.type !== 'Devedor' && (
                    <div>
                      <label className="ios-label">Conta</label>
                      <select
                        className="ios-input"
                        value={payment.account}
                        onChange={(event) => setPaymentField(payment.id, 'account', event.target.value)}
                      >
                        {FINANCIAL_ACCOUNTS.map((account) => (
                          <option key={account} value={account}>
                            {account}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {payment.type === 'Cartão' && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div>
                      <label className="ios-label">Parcelas</label>
                      <input
                        type="number"
                        min="1"
                        className="ios-input"
                        onFocus={(e) => e.target.select()}
                        value={payment.installments}
                        onChange={(event) => setPaymentField(payment.id, 'installments', event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="ios-label">Bandeira</label>
                      <select
                        className="ios-input"
                        value={payment.cardBrand}
                        onChange={(event) => setPaymentField(payment.id, 'cardBrand', event.target.value)}
                      >
                        <option value="visa_master">Visa/Master</option>
                        <option value="outras">Outras</option>
                      </select>
                    </div>
                    <div>
                      <label className="ios-label">Valor cliente (R$)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="ios-input"
                        onFocus={(e) => e.target.select()}
                        value={payment.customerAmount}
                        onChange={(event) => setPaymentField(payment.id, 'customerAmount', event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="ios-label">Taxa (R$)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="ios-input"
                        onFocus={(e) => e.target.select()}
                        value={payment.feeAmount}
                        onChange={(event) => setPaymentField(payment.id, 'feeAmount', event.target.value)}
                      />
                    </div>
                  </div>
                )}

                {payment.type === 'Cartão Débito' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <label className="ios-label">Valor cliente (R$)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="ios-input"
                        onFocus={(e) => e.target.select()}
                        value={payment.customerAmount}
                        onChange={(event) => setPaymentField(payment.id, 'customerAmount', event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="ios-label">Taxa (%)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="ios-input"
                        onFocus={(e) => e.target.select()}
                        value={payment.feeRate}
                        onChange={(event) => setPaymentField(payment.id, 'feeRate', event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="ios-label">Taxa (R$)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="ios-input"
                        onFocus={(e) => e.target.select()}
                        value={payment.feeAmount}
                        onChange={(event) => setPaymentField(payment.id, 'feeAmount', event.target.value)}
                      />
                    </div>
                  </div>
                )}

                {payment.type === 'Devedor' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <label className="ios-label">Vencimento</label>
                      <input
                        type="date"
                        className="ios-input"
                        value={payment.debtDueDate}
                        onChange={(event) => setPaymentField(payment.id, 'debtDueDate', event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="ios-label">Parcelas</label>
                      <input
                        type="number"
                        min="1"
                        className="ios-input"
                        onFocus={(e) => e.target.select()}
                        value={payment.debtInstallments}
                        onChange={(event) => setPaymentField(payment.id, 'debtInstallments', event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="ios-label">Observações</label>
                      <input
                        className="ios-input"
                        value={payment.debtNotes}
                        onChange={(event) => setPaymentField(payment.id, 'debtNotes', event.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                    onClick={() => removePaymentRow(payment.id)}
                    disabled={payments.length === 1}
                  >
                    <Trash2 size={12} />
                    Remover pagamento
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-ios border app-border p-3 text-sm space-y-1.5">
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
          <div className="flex justify-between text-red-700">
            <span>Saída compra trade-in</span>
            <span>- {formatCurrency(tradeInSubtotal)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 dark:border-surface-dark-200 pt-2 font-semibold">
            <span>Total da venda</span>
            <span>{formatCurrency(grossSaleTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Pagamentos financeiros</span>
            <span>{formatCurrency(paymentsTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Trade-in como pagamento</span>
            <span>{formatCurrency(tradeInSubtotal)}</span>
          </div>
          <div className={`flex justify-between font-semibold ${hasBalancedPayments ? 'text-green-600' : 'text-red-600'}`}>
            <span>Soma pagamentos</span>
            <span>{formatCurrency(combinedPaymentsTotal)}</span>
          </div>
          <div className="flex justify-between text-gray-700 dark:text-surface-dark-700">
            <span>Líquido em contas</span>
            <span>{formatCurrency(netFinancialTotal)}</span>
          </div>
          {!hasBalancedPayments && (
            <p className="text-xs text-red-600">
              A soma dos pagamentos financeiros mais o trade-in deve igualar o total da venda.
            </p>
          )}
        </div>

        {formError && (
          <div className="rounded-ios border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
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

interface SaleReceiptPrintTemplatesProps {
  sale: Sale | null;
  businessProfile: BusinessProfile;
  customerName: string;
  customerCpf?: string;
  sellerName: string;
}

const SaleReceiptPrintTemplates: React.FC<SaleReceiptPrintTemplatesProps> = ({
  sale,
  businessProfile,
  customerName,
  customerCpf,
  sellerName
}) => {
  if (!sale) return null;

  const tradeIns = getSaleTradeIns(sale);
  const tradeInSubtotal = getSaleTradeInSubtotal(sale);

  const negotiatedSubtotal = roundCurrency(getNegotiatedSubtotal(sale));
  const originalSubtotal = roundCurrency(getOriginalSubtotal(sale));
  const discountAmount = roundCurrency(Number(sale.discount || 0));
  const discountPercent = sale.discountPercent ?? null;
  const hasPriceAdjustment = Math.abs(originalSubtotal - negotiatedSubtotal) > 0.009;

  const cardFeeTotal = roundCurrency(sale.paymentMethods.reduce((acc, payment) => acc + Number(payment.feeAmount || 0), 0));
  const totalCustomerWithTradeIn = getSalePaidTotal(sale);
  const saleGrossTotal = getSaleHistoryTotal(sale);
  return (
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
          <p>Cliente: {customerName}</p>
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
            <span>Subtotal negociado</span>
            <span>{formatCurrency(negotiatedSubtotal)}</span>
          </div>
          {hasPriceAdjustment && (
            <div className="flex justify-between">
              <span>Subtotal original</span>
              <span>{formatCurrency(originalSubtotal)}</span>
            </div>
          )}
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
            <p className="text-sm font-medium mt-0.5">{customerName}</p>
            {customerCpf && <p className="text-xs text-gray-600 mt-0.5">CPF: {customerCpf}</p>}
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
              <span>Subtotal negociado</span>
              <span className="font-medium">{formatCurrency(negotiatedSubtotal)}</span>
            </div>
            {hasPriceAdjustment && (
              <div className="flex justify-between">
                <span>Subtotal original</span>
                <span className="font-medium">{formatCurrency(originalSubtotal)}</span>
              </div>
            )}
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
    </>
  );
};

export default PDVHistory;
