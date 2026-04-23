import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, m, useReducedMotion } from 'framer-motion';
import { useData } from '../services/dataContext';
import { StockStatus, StockItem, PaymentMethod, Sale, Condition, FinancialAccount, SaleTradeInItem } from '../types';
import { User, Smartphone, Printer, CheckCircle, ShieldCheck, X, Trash2, Battery, CreditCard } from 'lucide-react';
import { Combobox } from '../components/ui/Combobox';
import { AddCustomerModal } from '../components/AddCustomerModal';
import { AddSellerModal } from '../components/AddSellerModal';
import { StockFormModal } from '../components/StockFormModal';
import { useToast } from '../components/ui/ToastProvider';
import Modal from '../components/ui/Modal';
import { AnimatedNumber, SaleCelebration } from '../components/motion';
import { iosSnappySpring, iosSpring } from '../components/motion/transitions';
import { newId } from '../utils/id';
import { PDV_PAYMENT_METHODS } from '../utils/payments';
import { useAuth } from '../contexts/AuthContext';
import { trackUxEvent } from '../services/telemetry';
import { Link } from 'react-router-dom';
import { calculateCardCharge, getCardRate } from '../utils/cardFees';
import { ACCOUNT_BANK, CASH_EQUIVALENT_ACCOUNTS } from '../utils/financialAccounts';

const PDV_DRAFT_KEY = 'pdv:draft:v1';
const PDV_PRINT_PAGE_STYLE_ID = 'pdv-print-page-style';
const PRINT_MODAL_EXIT_DELAY_MS = 280;
const PRINT_LAYOUT_FALLBACK_CLEANUP_MS = 1800;

type FieldErrors = {
  store?: string;
  seller?: string;
  client?: string;
  product?: string;
  payment?: string;
  pricing?: string;
};

type ReceiptPrintLayout = '80mm' | 'a4';
type DiscountInputType = 'amount' | 'percent';

const roundCurrency = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
};

const toCurrencyInput = (value: number): string => roundCurrency(value).toFixed(2);

const PDV: React.FC = () => {
  const { stock, customers, sellers, stores = [], addSale, businessProfile, cardFeeSettings } = useData();
  const { role } = useAuth();
  const toast = useToast();
  const reducedMotion = useReducedMotion();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedSeller, setSelectedSeller] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Modal states
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isSellerModalOpen, setIsSellerModalOpen] = useState(false);
  const [isTradeInModalOpen, setIsTradeInModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StockItem | null>(null);
  const [tradeInItems, setTradeInItems] = useState<StockItem[]>([]);
  const [negotiatedPrice, setNegotiatedPrice] = useState(0);
  const [negotiatedPriceInput, setNegotiatedPriceInput] = useState('');
  const [discountConfig, setDiscountConfig] = useState<{ type: DiscountInputType; value: number }>({
    type: 'amount',
    value: 0
  });
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [discountDraftType, setDiscountDraftType] = useState<DiscountInputType>('amount');
  const [discountDraftValue, setDiscountDraftValue] = useState('');
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [commission, setCommission] = useState(50);
  const [isFinishingSale, setIsFinishingSale] = useState(false);
  const [isPrintFormatModalOpen, setIsPrintFormatModalOpen] = useState(false);
  const [receiptPrintLayout, setReceiptPrintLayout] = useState<ReceiptPrintLayout>('80mm');
  const pendingPrintTimeoutRef = useRef<number | null>(null);
  const printCleanupTimeoutRef = useRef<number | null>(null);

  const [isBasicPaymentModalOpen, setIsBasicPaymentModalOpen] = useState(false);
  const [basicPaymentType, setBasicPaymentType] = useState<'Pix' | 'Dinheiro'>('Pix');
  const [basicPaymentForm, setBasicPaymentForm] = useState<{ amount: string; account: FinancialAccount }>({
    amount: '',
    account: ACCOUNT_BANK
  });

  const [isCardPaymentModalOpen, setIsCardPaymentModalOpen] = useState(false);
  const [cardPaymentForm, setCardPaymentForm] = useState<{
    netAmount: string;
    account: FinancialAccount;
    brand: 'visa_master' | 'outras';
    selectedInstallments: number;
  }>({
    netAmount: '',
    account: ACCOUNT_BANK,
    brand: 'visa_master' as 'visa_master' | 'outras',
    selectedInstallments: 1
  });

  const [isDebtPaymentModalOpen, setIsDebtPaymentModalOpen] = useState(false);
  const [debtPaymentForm, setDebtPaymentForm] = useState({
    dueDate: '',
    installmentsTotal: '1',
    notes: ''
  });

  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(PDV_DRAFT_KEY);
      if (!rawDraft) return;
      const draft = JSON.parse(rawDraft) as {
        selectedStore?: string;
        selectedSeller?: string;
        selectedClient?: string;
        selectedProductId?: string;
        payments?: PaymentMethod[];
        commission?: number;
      };
      if (draft.selectedStore) setSelectedStore(draft.selectedStore);
      if (draft.selectedSeller) setSelectedSeller(draft.selectedSeller);
      if (draft.selectedClient) setSelectedClient(draft.selectedClient);
      if (Array.isArray(draft.payments)) setPayments(draft.payments);
      if (typeof draft.commission === 'number') setCommission(draft.commission);
      if (draft.selectedProductId) {
        const productFromDraft = stock.find((item) => item.id === draft.selectedProductId) || null;
        setSelectedProduct(productFromDraft);
      }
    } catch {
      // Ignore malformed draft payload.
    }
  }, [stock]);

  useEffect(() => {
    if (!selectedProduct || !selectedStore) return;
    if (selectedProduct.storeId !== selectedStore) {
      setSelectedProduct(null);
      setPayments([]);
      setFieldErrors((prev) => ({ ...prev, product: undefined, payment: undefined }));
    }
  }, [selectedProduct?.id, selectedProduct?.storeId, selectedStore]);

  useEffect(() => {
    if (step === 3 && !selectedProduct) {
      setStep(2);
    }
  }, [step, selectedProduct]);

  useEffect(() => {
    if (!selectedProduct) {
      setNegotiatedPrice(0);
      setNegotiatedPriceInput('');
      setDiscountConfig({ type: 'amount', value: 0 });
      setFieldErrors((prev) => ({ ...prev, pricing: undefined }));
      return;
    }

    const originalPrice = roundCurrency(selectedProduct.sellPrice);
    setNegotiatedPrice(originalPrice);
    setNegotiatedPriceInput(toCurrencyInput(originalPrice));
    setDiscountConfig({ type: 'amount', value: 0 });
    setFieldErrors((prev) => ({ ...prev, pricing: undefined }));
  }, [selectedProduct?.id]);

  const availableStock = useMemo(
    () => stock.filter((item) => item.status === StockStatus.AVAILABLE && item.storeId === selectedStore),
    [stock, selectedStore]
  );
  const productOptions = useMemo(() => {
    return availableStock.map((item) => ({
      id: item.id,
      label: `${item.model}${item.capacity ? ` ${item.capacity}` : ''}`,
      subLabel: `IMEI: ${item.imei || '-'} • ${item.color || 'Sem cor'} • R$ ${item.sellPrice.toLocaleString('pt-BR')} • ${item.condition}`
    }));
  }, [availableStock]);

  const handleSelectProduct = (productId: string) => {
    const product = availableStock.find((item) => item.id === productId) || null;
    setSelectedProduct(product);
    setFieldErrors((prev) => ({ ...prev, product: undefined }));
  };

  const originalSubtotal = selectedProduct ? roundCurrency(selectedProduct.sellPrice) : 0;
  const negotiatedSubtotal = selectedProduct ? roundCurrency(Math.max(0, negotiatedPrice)) : 0;
  const discountAmountRaw =
    discountConfig.type === 'percent'
      ? negotiatedSubtotal * (discountConfig.value / 100)
      : discountConfig.value;
  const discountAmount = roundCurrency(Math.min(Math.max(discountAmountRaw, 0), negotiatedSubtotal));
  const discountPercent =
    discountAmount > 0 && negotiatedSubtotal > 0
      ? roundCurrency((discountAmount / negotiatedSubtotal) * 100)
      : null;
  const tradeInValue = roundCurrency(tradeInItems.reduce((acc, item) => acc + item.purchasePrice, 0));
  const totalToPay = roundCurrency(Math.max(0, negotiatedSubtotal - discountAmount - tradeInValue));
  const totalPaidNet = payments.reduce((acc, payment) => acc + payment.amount, 0);
  const cardSurchargeTotal = payments.reduce((acc, payment) => acc + (payment.feeAmount || 0), 0);
  const totalPaidByCustomer = payments.reduce((acc, payment) => acc + (payment.customerAmount || payment.amount), 0);
  const remaining = roundCurrency(totalToPay - totalPaidNet);
  const isPaymentBalanced = Math.abs(remaining) < 0.01;
  const hasPaymentPending = remaining > 0.009;
  const hasPaymentOverage = remaining < -0.009;
  const canFinish = isPaymentBalanced && !!selectedProduct && !!selectedClient && !!selectedSeller && !!selectedStore;
  const hasNegotiatedPriceChange =
    selectedProduct !== null && Math.abs(negotiatedSubtotal - originalSubtotal) > 0.009;
  const cardRows = useMemo(() => {
    const netAmount = Number(cardPaymentForm.netAmount || 0);
    return Array.from({ length: 18 }, (_, index) => {
      const installments = index + 1;
      const rate = getCardRate(cardFeeSettings, cardPaymentForm.brand, installments);
      const result = calculateCardCharge(netAmount, rate, installments);
      return { installments, rate, ...result };
    });
  }, [cardFeeSettings, cardPaymentForm.brand, cardPaymentForm.netAmount]);

  useEffect(() => {
    if (hasPaymentOverage) {
      setFieldErrors((prev) => ({ ...prev, payment: 'Pagamento excede o total da venda.' }));
      return;
    }

    setFieldErrors((prev) =>
      prev.payment === 'Pagamento excede o total da venda.'
        ? { ...prev, payment: undefined }
        : prev
    );
  }, [hasPaymentOverage]);

  const handleAddPayment = (payment: PaymentMethod) => {
    if (payment.amount <= 0) return;
    setPayments([...payments, payment]);
    setFieldErrors((prev) => ({ ...prev, payment: undefined }));
    trackUxEvent({
      name: 'pdv_payment_added',
      screen: 'PDV',
      role: role || undefined,
      metadata: { type: payment.type, amount: payment.amount },
      ts: new Date().toISOString()
    });
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const mapTradeInItemToSaleTradeIn = (item: StockItem): SaleTradeInItem => ({
    id: newId('sti'),
    stockItemId: item.id,
    model: item.model || 'Trade-in',
    capacity: item.capacity || undefined,
    color: item.color || undefined,
    imei: item.imei || undefined,
    condition: item.condition,
    receivedValue: Number(item.purchasePrice || 0)
  });

  const handleNegotiatedPriceChange = (value: string) => {
    setNegotiatedPriceInput(value);
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;

    setNegotiatedPrice(roundCurrency(parsed));
    setFieldErrors((prev) => ({ ...prev, pricing: undefined, payment: undefined }));
  };

  const handleNegotiatedPriceBlur = () => {
    if (!selectedProduct) return;

    const parsed = Number(negotiatedPriceInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setFieldErrors((prev) => ({ ...prev, pricing: 'Informe um valor negociado maior que zero.' }));
      return;
    }

    const normalized = roundCurrency(parsed);
    setNegotiatedPrice(normalized);
    setNegotiatedPriceInput(toCurrencyInput(normalized));
    setFieldErrors((prev) => ({ ...prev, pricing: undefined }));

    if (Math.abs(normalized - roundCurrency(selectedProduct.sellPrice)) > 0.009) {
      trackUxEvent({
        name: 'pdv_price_overridden',
        screen: 'PDV',
        role: role || undefined,
        metadata: {
          original: roundCurrency(selectedProduct.sellPrice),
          negotiated: normalized
        },
        ts: new Date().toISOString()
      });
    }
  };

  const handleRestoreNegotiation = () => {
    if (!selectedProduct) return;
    const originalPrice = roundCurrency(selectedProduct.sellPrice);
    setNegotiatedPrice(originalPrice);
    setNegotiatedPriceInput(toCurrencyInput(originalPrice));
    setDiscountConfig({ type: 'amount', value: 0 });
    setFieldErrors((prev) => ({ ...prev, pricing: undefined, payment: undefined }));
  };

  const openDiscountModal = () => {
    setDiscountDraftType(discountConfig.type);
    setDiscountDraftValue(discountConfig.value > 0 ? String(discountConfig.value) : '');
    setIsDiscountModalOpen(true);
    trackUxEvent({
      name: 'pdv_discount_modal_opened',
      screen: 'PDV',
      role: role || undefined,
      ts: new Date().toISOString()
    });
  };

  const handleApplyDiscount = () => {
    if (!selectedProduct) {
      setIsDiscountModalOpen(false);
      return;
    }

    const parsed = Number(discountDraftValue || 0);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error('Informe um desconto válido.');
      return;
    }

    if (discountDraftType === 'percent' && parsed > 100) {
      toast.error('O desconto percentual deve ficar entre 0 e 100.');
      return;
    }

    if (discountDraftType === 'amount' && parsed > negotiatedSubtotal) {
      toast.error('O desconto em R$ não pode ser maior que o valor negociado.');
      return;
    }

    const normalizedValue = roundCurrency(parsed);
    setDiscountConfig({
      type: discountDraftType,
      value: normalizedValue
    });
    setFieldErrors((prev) => ({ ...prev, payment: undefined }));
    setIsDiscountModalOpen(false);
    trackUxEvent({
      name: 'pdv_discount_applied',
      screen: 'PDV',
      role: role || undefined,
      metadata: {
        type: discountDraftType,
        value: normalizedValue,
        amount: discountDraftType === 'percent'
          ? roundCurrency(negotiatedSubtotal * (normalizedValue / 100))
          : normalizedValue
      },
      ts: new Date().toISOString()
    });
  };

  const getPaymentLabel = (payment: PaymentMethod) => {
    if (payment.type !== 'Cartão') {
      return payment.installments ? `${payment.type} ${payment.installments}x` : payment.type;
    }
    const brandLabel = payment.cardBrand === 'outras' ? 'Outras' : 'Visa/Master';
    const installmentsLabel = payment.installments ? ` ${payment.installments}x` : '';
    return `Cartão ${brandLabel}${installmentsLabel}`;
  };

  const goToStep = (nextStep: 1 | 2 | 3) => {
    if (nextStep === 2 && (!selectedStore || !selectedSeller)) {
      setFieldErrors((prev) => ({
        ...prev,
        store: !selectedStore ? 'Selecione uma loja.' : undefined,
        seller: !selectedSeller ? 'Selecione um vendedor.' : undefined,
        client: undefined
      }));
      toast.error(!selectedStore ? 'Selecione uma loja antes de avançar.' : 'Selecione um vendedor antes de avançar.');
      return;
    }

    if (nextStep === 3 && (!selectedClient || !selectedProduct)) {
      setFieldErrors((prev) => ({ ...prev, product: 'Selecione um produto para continuar.' }));
      if (!selectedClient) {
        setFieldErrors((prev) => ({ ...prev, client: 'Selecione um cliente para continuar.' }));
      }
      toast.error('Selecione cliente e produto antes do pagamento.');
      return;
    }

    setStep(nextStep);
    trackUxEvent({
      name: 'pdv_step_completed',
      screen: 'PDV',
      role: role || undefined,
      metadata: { step: nextStep },
      ts: new Date().toISOString()
    });
  };

  const handleBackStep = () => {
    if (step === 1) return;
    setStep((prev) => (prev - 1) as 1 | 2 | 3);
  };

  const handleSaveDraft = () => {
    const draft = {
      selectedStore,
      selectedSeller,
      selectedClient,
      selectedProductId: selectedProduct?.id,
      payments,
      commission
    };
    window.localStorage.setItem(PDV_DRAFT_KEY, JSON.stringify(draft));
    toast.success('Rascunho salvo.');
  };

  const handleSelectPaymentType = (type: PaymentMethod['type']) => {
    if (!hasPaymentPending) return;

    if (type === 'Devedor') {
      if (!selectedClient) {
        toast.error('Selecione um cliente antes de usar Devedor.');
        return;
      }
      setDebtPaymentForm({ dueDate: '', installmentsTotal: '1', notes: '' });
      setIsDebtPaymentModalOpen(true);
      return;
    }

    if (type === 'Cartão') {
      setCardPaymentForm({
        netAmount: remaining.toFixed(2),
        account: ACCOUNT_BANK,
        brand: 'visa_master',
        selectedInstallments: 1
      });
      setIsCardPaymentModalOpen(true);
      return;
    }

    setBasicPaymentType(type as 'Pix' | 'Dinheiro');
    setBasicPaymentForm({
      amount: remaining.toFixed(2),
      account: ACCOUNT_BANK
    });
    setIsBasicPaymentModalOpen(true);
  };

  const handleConfirmDebtPayment = () => {
    if (!hasPaymentPending) {
      setIsDebtPaymentModalOpen(false);
      return;
    }

    const installmentsTotal = Math.max(1, Math.floor(Number(debtPaymentForm.installmentsTotal || 1)));
    if (!Number.isFinite(installmentsTotal) || installmentsTotal < 1) {
      toast.error('Informe ao menos 1 parcela.');
      return;
    }

    handleAddPayment({
      type: 'Devedor',
      amount: remaining,
      debtDueDate: debtPaymentForm.dueDate || undefined,
      debtInstallments: installmentsTotal,
      debtNotes: debtPaymentForm.notes.trim() || undefined
    });
    setIsDebtPaymentModalOpen(false);
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const handleConfirmBasicPayment = () => {
    const amount = Number(basicPaymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }
    if (amount > remaining) {
      toast.error('O valor não pode ser maior que o restante.');
      return;
    }

    handleAddPayment({
      type: basicPaymentType,
      amount: Number(amount.toFixed(2)),
      account: basicPaymentForm.account
    });
    setIsBasicPaymentModalOpen(false);
  };

  const handleConfirmCardPayment = () => {
    const netAmount = Number(cardPaymentForm.netAmount);
    if (!Number.isFinite(netAmount) || netAmount <= 0) {
      toast.error('Informe um valor líquido válido.');
      return;
    }
    if (netAmount > remaining) {
      toast.error('O valor líquido do cartão não pode ser maior que o restante.');
      return;
    }

    const rate = getCardRate(cardFeeSettings, cardPaymentForm.brand, cardPaymentForm.selectedInstallments);
    const charge = calculateCardCharge(netAmount, rate, cardPaymentForm.selectedInstallments);

    handleAddPayment({
      type: 'Cartão',
      amount: charge.netAmount,
      account: cardPaymentForm.account,
      installments: charge.installments,
      cardBrand: cardPaymentForm.brand,
      customerAmount: charge.customerAmount,
      feeRate: charge.feeRate,
      feeAmount: charge.feeAmount
    });
    setIsCardPaymentModalOpen(false);
  };

  const getWarrantyDate = (saleDate: Date) => {
    const date = new Date(saleDate);
    date.setMonth(date.getMonth() + 3);
    return date;
  };

  const handleFinishSale = async () => {
    if (isFinishingSale) return;

    if (step !== 3) {
      toast.error('Conclua as etapas antes de finalizar a venda.');
      return;
    }
    if (!selectedSeller) {
      setFieldErrors((prev) => ({ ...prev, seller: 'Selecione um vendedor.' }));
      toast.error('Selecione um vendedor.');
      return;
    }
    if (!selectedStore) {
      setFieldErrors((prev) => ({ ...prev, store: 'Selecione uma loja.' }));
      toast.error('Selecione uma loja.');
      return;
    }
    if (!selectedClient) {
      setFieldErrors((prev) => ({ ...prev, client: 'Selecione um cliente.' }));
      toast.error('Selecione um cliente.');
      return;
    }
    if (!selectedProduct) {
      setFieldErrors((prev) => ({ ...prev, product: 'Selecione um produto.' }));
      toast.error('Selecione um produto.');
      return;
    }
    if (negotiatedSubtotal <= 0) {
      setFieldErrors((prev) => ({ ...prev, pricing: 'Informe um valor negociado maior que zero.' }));
      toast.error('Valor negociado inválido.');
      return;
    }
    if (hasPaymentPending) {
      setFieldErrors((prev) => ({ ...prev, payment: 'Existe pagamento pendente.' }));
      toast.error('Pagamento pendente.');
      return;
    }
    if (hasPaymentOverage) {
      setFieldErrors((prev) => ({ ...prev, payment: 'Pagamento excede o total da venda.' }));
      toast.error('Pagamento excedente. Ajuste ou remova pagamentos.');
      return;
    }

    const saleDate = new Date();
    const hasStoreWarranty = selectedProduct.condition === Condition.USED;
    const saleProductSnapshot: StockItem = {
      ...selectedProduct,
      sellPrice: negotiatedSubtotal,
      originalSellPrice: roundCurrency(selectedProduct.sellPrice)
    };
    const normalizedDiscountType = discountAmount > 0 ? discountConfig.type : null;

    const newSale: Sale = {
      id: newId('sale'),
      customerId: selectedClient,
      sellerId: selectedSeller,
      items: [saleProductSnapshot],
      tradeIn: tradeInItems[0] || undefined,
      tradeIns: tradeInItems.map(mapTradeInItemToSaleTradeIn),
      tradeInValue: tradeInValue,
      discount: discountAmount,
      discountType: normalizedDiscountType,
      discountPercent: normalizedDiscountType === 'percent' ? discountPercent : null,
      originalSubtotal,
      negotiatedSubtotal,
      total: totalToPay,
      paymentMethods: payments,
      date: saleDate.toISOString(),
      storeId: selectedStore,
      warrantyExpiresAt: hasStoreWarranty ? getWarrantyDate(saleDate).toISOString() : null
    };

    // Trade-in item is already saved to stock by StockFormModal,
    // so we pass tradeIn as undefined to addSale to avoid duplicate insert.
    const saleForDb: Sale = { ...newSale, tradeIn: undefined };

    setIsFinishingSale(true);
    try {
      await addSale(saleForDb);
      setLastSale(newSale);
      setStep(3);
      window.localStorage.removeItem(PDV_DRAFT_KEY);
      trackUxEvent({
        name: 'pdv_sale_finished',
        screen: 'PDV',
        role: role || undefined,
        metadata: {
          total: newSale.total,
          payments: newSale.paymentMethods.length
        },
        ts: new Date().toISOString()
      });
      toast.success('Venda registrada.');
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível concluir a venda.');
    } finally {
      setIsFinishingSale(false);
    }
  };

  const resetSaleFlow = () => {
    setStep(1);
    setSelectedStore('');
    setSelectedSeller('');
    setSelectedClient('');
    setSelectedProduct(null);
    setTradeInItems([]);
    setPayments([]);
    setLastSale(null);
    setCommission(50);
    setIsFinishingSale(false);
    setFieldErrors({});
    setIsPrintFormatModalOpen(false);
    setReceiptPrintLayout('80mm');
    if (pendingPrintTimeoutRef.current !== null) {
      window.clearTimeout(pendingPrintTimeoutRef.current);
      pendingPrintTimeoutRef.current = null;
    }
    if (printCleanupTimeoutRef.current !== null) {
      window.clearTimeout(printCleanupTimeoutRef.current);
      printCleanupTimeoutRef.current = null;
    }
    const pageStyleTag = document.getElementById(PDV_PRINT_PAGE_STYLE_ID);
    pageStyleTag?.remove();
    document.body.removeAttribute('data-print-layout');
    window.localStorage.removeItem(PDV_DRAFT_KEY);
  };

  const openPrintReceiptModal = () => {
    if (!lastSale) return;
    setIsPrintFormatModalOpen(true);
  };

  const clearPrintLayout = () => {
    if (pendingPrintTimeoutRef.current !== null) {
      window.clearTimeout(pendingPrintTimeoutRef.current);
      pendingPrintTimeoutRef.current = null;
    }
    if (printCleanupTimeoutRef.current !== null) {
      window.clearTimeout(printCleanupTimeoutRef.current);
      printCleanupTimeoutRef.current = null;
    }
    const pageStyleTag = document.getElementById(PDV_PRINT_PAGE_STYLE_ID);
    pageStyleTag?.remove();
    document.body.removeAttribute('data-print-layout');
  };

  const applyPrintPageSize = (layout: ReceiptPrintLayout) => {
    const existingPageStyle = document.getElementById(PDV_PRINT_PAGE_STYLE_ID);
    existingPageStyle?.remove();

    const pageStyle = document.createElement('style');
    pageStyle.id = PDV_PRINT_PAGE_STYLE_ID;
    pageStyle.media = 'print';
    pageStyle.textContent =
      layout === '80mm'
        ? '@page { size: 80mm auto; margin: 0; }'
        : '@page { size: A4 portrait; margin: 10mm; }';
    document.head.appendChild(pageStyle);
  };

  const handlePrintReceipt = () => {
    if (!lastSale) return;
    clearPrintLayout();
    applyPrintPageSize(receiptPrintLayout);
    document.body.setAttribute('data-print-layout', receiptPrintLayout);
    setIsPrintFormatModalOpen(false);
    window.addEventListener(
      'afterprint',
      clearPrintLayout,
      { once: true }
    );

    const runPrint = () => {
      window.print();
      printCleanupTimeoutRef.current = window.setTimeout(() => {
        clearPrintLayout();
      }, PRINT_LAYOUT_FALLBACK_CLEANUP_MS);
    };

    pendingPrintTimeoutRef.current = window.setTimeout(() => {
      pendingPrintTimeoutRef.current = null;
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => runPrint());
        return;
      }
      runPrint();
    }, reducedMotion ? 60 : PRINT_MODAL_EXIT_DELAY_MS);
  };

  useEffect(() => {
    return () => {
      if (pendingPrintTimeoutRef.current !== null) {
        window.clearTimeout(pendingPrintTimeoutRef.current);
        pendingPrintTimeoutRef.current = null;
      }
      if (printCleanupTimeoutRef.current !== null) {
        window.clearTimeout(printCleanupTimeoutRef.current);
        printCleanupTimeoutRef.current = null;
      }
      const pageStyleTag = document.getElementById(PDV_PRINT_PAGE_STYLE_ID);
      pageStyleTag?.remove();
      document.body.removeAttribute('data-print-layout');
    };
  }, []);

  if (step === 3 && lastSale) {
    const saleCustomer = customers.find((customer) => customer.id === lastSale.customerId);
    const saleSeller = sellers.find((seller) => seller.id === lastSale.sellerId);
    const lastSaleCardFeeTotal = lastSale.paymentMethods.reduce((acc, payment) => acc + (payment.feeAmount || 0), 0);
    const lastSalePaidByCustomerTotal = lastSale.paymentMethods.reduce(
      (acc, payment) => acc + (payment.customerAmount || payment.amount),
      0
    );
    const lastSaleNegotiatedSubtotal =
      lastSale.negotiatedSubtotal ?? lastSale.items.reduce((acc, item) => acc + item.sellPrice, 0);
    const lastSaleOriginalSubtotal =
      lastSale.originalSubtotal ??
      lastSale.items.reduce((acc, item) => acc + (item.originalSellPrice ?? item.sellPrice), 0);
    const lastSaleDiscountAmount = roundCurrency(lastSale.discount || 0);
    const lastSaleDiscountPercent = lastSale.discountPercent ?? null;
    const lastSaleHasPriceAdjustment = Math.abs(lastSaleOriginalSubtotal - lastSaleNegotiatedSubtotal) > 0.009;
    const lastSaleTradeIns =
      lastSale.tradeIns && lastSale.tradeIns.length > 0
        ? lastSale.tradeIns
        : lastSale.tradeIn
          ? [{
              id: `legacy-${lastSale.id}`,
              stockItemId: lastSale.tradeIn.id,
              model: lastSale.tradeIn.model,
              capacity: lastSale.tradeIn.capacity || undefined,
              color: lastSale.tradeIn.color || undefined,
              imei: lastSale.tradeIn.imei || undefined,
              condition: lastSale.tradeIn.condition || undefined,
              receivedValue: lastSale.tradeInValue
            }]
          : [];
    const lastSaleTradeInSubtotal =
      lastSaleTradeIns.length > 0
        ? lastSaleTradeIns.reduce((acc, item) => acc + (item.receivedValue || 0), 0)
        : (lastSale.tradeInValue || 0);

    return (
      <div className="relative flex flex-col items-center justify-center h-full text-center space-y-6">
        <div className="screen-only flex flex-col items-center justify-center text-center space-y-6">
          <SaleCelebration show={!!lastSale} />
          <m.div
            initial={reducedMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
            animate={reducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
            transition={reducedMotion ? { duration: 0.2 } : iosSpring}
            className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white mb-4 shadow-ios-lg"
          >
            <CheckCircle size={40} />
          </m.div>
          <m.h2
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reducedMotion ? 0 : 0.12, duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            className="text-ios-large font-bold app-text-primary"
          >
            Venda Realizada!
          </m.h2>
          <m.p
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reducedMotion ? 0 : 0.18, duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            className="text-ios-body app-text-muted"
          >
            A venda foi registrada e o estoque atualizado.
          </m.p>

          <m.div
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reducedMotion ? 0 : 0.26, duration: 0.34, ease: [0.32, 0.72, 0, 1] }}
            className="flex gap-4 mt-8 no-print"
          >
            <button onClick={openPrintReceiptModal} className="ios-button-secondary flex items-center gap-2">
              <Printer size={20} />
              Imprimir Comprovante
            </button>
            <button onClick={resetSaleFlow} className="ios-button-primary">
              Nova Venda
            </button>
          </m.div>
        </div>

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
            <p className="font-semibold">Venda #{lastSale.id.slice(-6).toUpperCase()}</p>
            <p>{new Date(lastSale.date).toLocaleString('pt-BR')}</p>
            <p>Cliente: {saleCustomer?.name || 'Não identificado'}</p>
            <p>Vendedor: {saleSeller?.name || 'Não identificado'}</p>
          </div>

          <div className="border-y border-black py-2 space-y-2 text-[11px]">
            {lastSale.items.map((item, index) => (
              <div key={`${item.id}-${index}`}>
                <p className="font-semibold">
                  {item.model}
                  {item.capacity ? ` ${item.capacity}` : ''}
                </p>
                <p className="text-[10px] leading-tight break-all">IMEI: {item.imei || '-'}</p>
                <div className="flex justify-between">
                  <span>1 x R$ {formatCurrency(item.sellPrice)}</span>
                  <span>R$ {formatCurrency(item.sellPrice)}</span>
                </div>
              </div>
            ))}
          </div>

          {lastSaleTradeIns.length > 0 && (
            <div className="mt-3 border-t border-black pt-2 text-[11px] space-y-2">
              <p className="font-semibold">Aparelhos de entrada</p>
              {lastSaleTradeIns.map((tradeIn, index) => (
                <div key={`${tradeIn.id}-${index}`} className="space-y-0.5">
                  <p className="leading-tight wrap-break-word">
                    (-) {tradeIn.model}
                    {tradeIn.capacity ? ` ${tradeIn.capacity}` : ''}
                    {tradeIn.color ? ` • ${tradeIn.color}` : ''}
                  </p>
                  <p className="text-[10px] leading-tight break-all">IMEI: {tradeIn.imei || '-'}</p>
                  <div className="flex justify-between text-red-700">
                    <span>Valor recebido</span>
                    <span>- R$ {formatCurrency(tradeIn.receivedValue || 0)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-black mt-3 pt-2 text-[11px] space-y-1">
            <div className="flex justify-between">
              <span>Subtotal negociado</span>
              <span>R$ {formatCurrency(lastSaleNegotiatedSubtotal)}</span>
            </div>
            {lastSaleHasPriceAdjustment && (
              <div className="flex justify-between">
                <span>Subtotal original</span>
                <span>R$ {formatCurrency(lastSaleOriginalSubtotal)}</span>
              </div>
            )}
            {lastSaleDiscountAmount > 0 && (
              <div className="flex justify-between text-red-700">
                <span>
                  Desconto
                  {lastSale.discountType === 'percent' && lastSaleDiscountPercent !== null
                    ? ` (${lastSaleDiscountPercent.toFixed(2)}%)`
                    : ''}
                </span>
                <span>- R$ {formatCurrency(lastSaleDiscountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Subtotal após desconto</span>
              <span>R$ {formatCurrency(lastSaleNegotiatedSubtotal - lastSaleDiscountAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Subtotal troca</span>
              <span>- R$ {formatCurrency(lastSaleTradeInSubtotal)}</span>
            </div>
            <div className="flex justify-between font-bold text-[13px]">
              <span>Total líquido</span>
              <span>R$ {formatCurrency(lastSale.total)}</span>
            </div>
            <div className="flex justify-between">
              <span>Acréscimo cartão</span>
              <span>R$ {formatCurrency(lastSaleCardFeeTotal)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Total cliente</span>
              <span>R$ {formatCurrency(lastSalePaidByCustomerTotal + lastSaleTradeInSubtotal)}</span>
            </div>
          </div>

          <div className="mt-3 border-t border-black pt-2 text-[11px]">
            <p className="font-semibold mb-1">Pagamentos</p>
            {lastSale.paymentMethods.map((payment, index) => (
              <div key={`${payment.type}-${index}`} className="space-y-0.5 mb-1.5 last:mb-0">
                <div className="flex justify-between">
                  <span>{getPaymentLabel(payment)}</span>
                  <span>R$ {formatCurrency(payment.customerAmount || payment.amount)}</span>
                </div>
                {payment.customerAmount && payment.customerAmount !== payment.amount && (
                  <div className="flex justify-between text-[10px]">
                    <span>Líquido loja</span>
                    <span>R$ {formatCurrency(payment.amount)}</span>
                  </div>
                )}
              </div>
            ))}
            {lastSaleTradeInSubtotal > 0 && (
              <div className="flex justify-between mt-1">
                <span>Troca ({lastSaleTradeIns.length} aparelho{lastSaleTradeIns.length !== 1 ? 's' : ''})</span>
                <span>R$ {formatCurrency(lastSaleTradeInSubtotal)}</span>
              </div>
            )}
          </div>

          <div className="mt-3 border-t border-black pt-3 text-center text-[10px]">
            {lastSale.warrantyExpiresAt && (
              <>
                <p className="font-semibold">Garantia de 90 dias (loja)</p>
                <p>Válida até {new Date(lastSale.warrantyExpiresAt).toLocaleDateString('pt-BR')}</p>
              </>
            )}
            <p className="mt-2">Obrigado pela preferência.</p>
          </div>
        </div>

        <div
          id="receipt-content-a4"
          className="hidden print-only print-layout print-layout-a4 text-black bg-white mx-auto w-full max-w-[210mm] border border-gray-300 px-8 py-10"
        >
          <header className="flex justify-between items-start border-b border-gray-300 pb-6 gap-4">
            <div className="flex items-start gap-4">
              {businessProfile?.logoUrl && (
                <img
                  src={businessProfile.logoUrl}
                  alt="Logo da empresa"
                  className="h-16 w-auto max-w-[56mm] object-contain"
                />
              )}
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{businessProfile?.name || 'iPhoneRepasse'}</h1>
                {businessProfile?.cnpj && <p className="text-sm text-gray-700 mt-1">CNPJ: {businessProfile.cnpj}</p>}
                {businessProfile?.address && <p className="text-sm text-gray-700">{businessProfile.address}</p>}
                {businessProfile?.phone && <p className="text-sm text-gray-700">Telefone: {businessProfile.phone}</p>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Comprovante de venda</p>
              <p className="text-lg font-semibold mt-2">#{lastSale.id.slice(-6).toUpperCase()}</p>
              <p className="text-sm text-gray-600 mt-1">{new Date(lastSale.date).toLocaleString('pt-BR')}</p>
            </div>
          </header>

          <section className="grid grid-cols-2 gap-6 mt-6">
            <div className="rounded-lg border border-gray-300 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-gray-500">Cliente</p>
              <p className="text-base font-medium mt-1">{saleCustomer?.name || 'Não identificado'}</p>
              {saleCustomer?.cpf && <p className="text-sm text-gray-600 mt-1">CPF: {saleCustomer.cpf}</p>}
            </div>
            <div className="rounded-lg border border-gray-300 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-gray-500">Vendedor</p>
              <p className="text-base font-medium mt-1">{saleSeller?.name || 'Não identificado'}</p>
            </div>
          </section>

          <section className="mt-6">
            <h2 className="text-sm uppercase tracking-[0.12em] text-gray-500 mb-2">Itens vendidos</h2>
            <table className="w-full text-sm border border-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 border-b border-gray-300">Descrição</th>
                  <th className="text-right p-3 border-b border-gray-300">Quantidade</th>
                  <th className="text-right p-3 border-b border-gray-300">Valor unitário</th>
                  <th className="text-right p-3 border-b border-gray-300">Total</th>
                </tr>
              </thead>
              <tbody>
                {lastSale.items.map((item, index) => (
                  <tr key={`${item.id}-${index}`}>
                    <td className="p-3 border-b border-gray-200">
                      <p className="font-medium">{item.model}</p>
                      <p className="text-xs text-gray-500">
                        {item.capacity || 'Sem capacidade'} • {item.color || 'Sem cor'} • IMEI {item.imei || '-'}
                      </p>
                    </td>
                    <td className="p-3 text-right border-b border-gray-200">1</td>
                    <td className="p-3 text-right border-b border-gray-200">R$ {formatCurrency(item.sellPrice)}</td>
                    <td className="p-3 text-right border-b border-gray-200">R$ {formatCurrency(item.sellPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {lastSaleTradeIns.length > 0 && (
            <section className="mt-6">
              <h2 className="text-sm uppercase tracking-[0.12em] text-gray-500 mb-2">Aparelhos recebidos na troca</h2>
              <table className="w-full text-sm border border-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 border-b border-gray-300">Descrição</th>
                    <th className="text-left p-3 border-b border-gray-300">IMEI</th>
                    <th className="text-right p-3 border-b border-gray-300">Valor recebido</th>
                  </tr>
                </thead>
                <tbody>
                  {lastSaleTradeIns.map((tradeIn, index) => (
                    <tr key={`${tradeIn.id}-${index}`}>
                      <td className="p-3 border-b border-gray-200 text-red-700">
                        <p className="font-medium">{tradeIn.model}</p>
                        <p className="text-xs text-gray-500">
                          {tradeIn.capacity || 'Sem capacidade'} • {tradeIn.color || 'Sem cor'}
                        </p>
                      </td>
                      <td className="p-3 border-b border-gray-200 font-mono text-xs">{tradeIn.imei || '-'}</td>
                      <td className="p-3 text-right border-b border-gray-200 text-red-700">
                        - R$ {formatCurrency(tradeIn.receivedValue || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="mt-6 grid grid-cols-2 gap-6">
            <div className="rounded-lg border border-gray-300 p-4">
              <h3 className="text-xs uppercase tracking-[0.12em] text-gray-500 mb-2">Pagamentos</h3>
              <div className="space-y-2 text-sm">
                {lastSale.paymentMethods.map((payment, index) => (
                  <div key={`${payment.type}-${index}`} className="rounded border border-gray-200 px-3 py-2">
                    <div className="flex justify-between">
                      <span className="font-medium">{getPaymentLabel(payment)}</span>
                      <span>R$ {formatCurrency(payment.customerAmount || payment.amount)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Líquido loja</span>
                      <span>R$ {formatCurrency(payment.amount)}</span>
                    </div>
                    {payment.customerAmount && payment.customerAmount !== payment.amount && (
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Acréscimo</span>
                        <span>R$ {formatCurrency((payment.customerAmount || 0) - payment.amount)}</span>
                      </div>
                    )}
                  </div>
                ))}
                {lastSaleTradeInSubtotal > 0 && (
                  <div className="rounded border border-gray-200 px-3 py-2">
                    <div className="flex justify-between">
                      <span className="font-medium">Troca ({lastSaleTradeIns.length} aparelho{lastSaleTradeIns.length !== 1 ? 's' : ''})</span>
                      <span>R$ {formatCurrency(lastSaleTradeInSubtotal)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-gray-300 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal negociado</span>
                <span className="font-medium">R$ {formatCurrency(lastSaleNegotiatedSubtotal)}</span>
              </div>
              {lastSaleHasPriceAdjustment && (
                <div className="flex justify-between">
                  <span>Subtotal original</span>
                  <span className="font-medium">R$ {formatCurrency(lastSaleOriginalSubtotal)}</span>
                </div>
              )}
              {lastSaleDiscountAmount > 0 && (
                <div className="flex justify-between text-red-700">
                  <span>
                    Desconto
                    {lastSale.discountType === 'percent' && lastSaleDiscountPercent !== null
                      ? ` (${lastSaleDiscountPercent.toFixed(2)}%)`
                      : ''}
                  </span>
                  <span>- R$ {formatCurrency(lastSaleDiscountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Subtotal trade-in</span>
                <span className="font-medium text-red-700">- R$ {formatCurrency(lastSaleTradeInSubtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total líquido loja</span>
                <span className="font-medium">R$ {formatCurrency(lastSale.total)}</span>
              </div>
              <div className="flex justify-between">
                <span>Acréscimo cartão</span>
                <span>R$ {formatCurrency(lastSaleCardFeeTotal)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-300 pt-2 font-semibold text-base">
                <span>Total pago pelo cliente</span>
                <span>R$ {formatCurrency(lastSalePaidByCustomerTotal + lastSaleTradeInSubtotal)}</span>
              </div>
            </div>
          </section>

          <footer className="mt-8 border-t border-gray-300 pt-4 text-sm text-gray-700">
            {lastSale.warrantyExpiresAt ? (
              <p>
                Garantia loja: válida até {new Date(lastSale.warrantyExpiresAt).toLocaleDateString('pt-BR')}.
              </p>
            ) : (
              <p>Sem garantia de app para esta venda.</p>
            )}
            <p className="mt-1">Obrigado pela preferência.</p>
          </footer>
        </div>

        <Modal
          open={isPrintFormatModalOpen}
          onClose={() => setIsPrintFormatModalOpen(false)}
          title="Escolher formato de impressão"
          size="md"
          footer={
            <div className="flex justify-end gap-3">
              <button type="button" className="ios-button-secondary" onClick={() => setIsPrintFormatModalOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="ios-button-primary" onClick={handlePrintReceipt}>
                Imprimir agora
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-ios-subhead app-text-secondary">
              Escolha o layout ideal para o comprovante desta venda.
            </p>
            <button
              type="button"
              onClick={() => setReceiptPrintLayout('80mm')}
              aria-pressed={receiptPrintLayout === '80mm'}
              className={`w-full text-left rounded-ios-lg border p-4 transition-colors ${
                receiptPrintLayout === '80mm'
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                  : 'app-border'
              }`}
            >
              <p className="font-semibold app-text-primary">80mm (térmica/cupom)</p>
              <p className="text-sm app-text-secondary mt-1">
                Layout compacto, fonte monoespaçada e colunas simples para impressora térmica.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setReceiptPrintLayout('a4')}
              aria-pressed={receiptPrintLayout === 'a4'}
              className={`w-full text-left rounded-ios-lg border p-4 transition-colors ${
                receiptPrintLayout === 'a4'
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                  : 'app-border'
              }`}
            >
              <p className="font-semibold app-text-primary">A4 (arquivo/entrega formal)</p>
              <p className="text-sm app-text-secondary mt-1">
                Modelo com seções detalhadas para salvar em PDF ou imprimir em folha.
              </p>
            </button>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-5 lg:space-y-4">
      <div className="ios-card p-3 md:p-4 sticky top-0 z-10">
        <LayoutGroup id="pdv-step-nav">
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 1 as const, title: 'Loja/Cliente' },
              { id: 2 as const, title: 'Produto/Troca' },
              { id: 3 as const, title: 'Pagamento' }
            ].map((item) => {
              const isCurrent = step === item.id;
              const isCompleted = step > item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goToStep(item.id)}
                  className={`relative px-2 py-2.5 rounded-ios-lg text-xs md:text-sm font-semibold border transition-colors overflow-hidden ${
                    isCurrent
                      ? 'text-white border-brand-500'
                      : isCompleted
                        ? 'bg-green-50 dark:bg-green-900/15 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900/40'
                        : 'bg-(--ds-color-surface) app-text-secondary app-border'
                  }`}
                >
                  {isCurrent && (
                    <m.span
                      layoutId="pdv-active-step-pill"
                      aria-hidden="true"
                      className="absolute inset-0 bg-brand-500 shadow-ios26-md"
                      transition={iosSnappySpring}
                    />
                  )}
                  <span className="relative z-10">{item.id}. {item.title}</span>
                </button>
              );
            })}
          </div>
        </LayoutGroup>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(340px,1fr)] gap-4 md:gap-5 lg:gap-4 items-start">
      {/* Left Panel */}
      <div className="space-y-3 md:space-y-4 lg:space-y-3">
        {/* Seller & Client */}
        {step === 1 && (
        <div className="ios-card p-4 md:p-5 lg:p-4">
          <h3 className="text-[17px] md:text-ios-title-3 font-bold app-text-primary mb-3 lg:mb-2 flex items-center gap-2">
            <User size={20} className="text-brand-500" />
            Loja, Vendedor e Cliente
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Combobox
                label="Loja"
                placeholder="Selecionar Loja..."
                value={selectedStore}
                onChange={(value) => {
                  setSelectedStore(value);
                  setFieldErrors((prev) => ({ ...prev, store: undefined, product: undefined }));
                }}
                options={stores.map((store) => ({
                  id: store.id,
                  label: store.name,
                  subLabel: store.city
                }))}
                errorMessage={fieldErrors.store}
              />
            </div>
            <div>
              <Combobox
                label="Vendedor"
                placeholder="Buscar Vendedor..."
                value={selectedSeller}
                onChange={(value) => {
                  setSelectedSeller(value);
                  setFieldErrors((prev) => ({ ...prev, seller: undefined }));
                }}
                options={sellers.map(s => ({ id: s.id, label: s.name }))}
                onAddNew={role === 'admin' ? () => setIsSellerModalOpen(true) : undefined}
                addNewLabel="Novo Vendedor"
                errorMessage={fieldErrors.seller}
              />
            </div>
            <div>
              <Combobox
                label="Cliente"
                placeholder="Buscar Cliente..."
                value={selectedClient}
                onChange={(value) => {
                  setSelectedClient(value);
                  setFieldErrors((prev) => ({ ...prev, client: undefined }));
                }}
                options={customers.map(c => ({ 
                  id: c.id, 
                  label: c.name, 
                  subLabel: c.cpf ? `CPF: ${c.cpf}` : undefined 
                }))}
                onAddNew={() => setIsCustomerModalOpen(true)}
                addNewLabel="Novo Cliente"
                errorMessage={fieldErrors.client}
              />
            </div>
          </div>
          
          {selectedSeller && (
            <div className="mt-3 p-3 app-surface-soft rounded-ios-lg">
              <label className="ios-label">Comissão do Vendedor</label>
              <div className="flex items-center gap-3">
                <span className="text-ios-subhead">R$</span>
                <input
                  type="number"
                  className="ios-input w-32"
                  value={commission}
                  onChange={(e) => setCommission(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          )}
        </div>
        )}

        {step === 2 && (
        <div className="space-y-3 md:space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
            {/* Product */}
            <div className="ios-card p-4 md:p-5 lg:p-4">
              <h3 className="text-[17px] md:text-ios-title-3 font-bold app-text-primary mb-3 lg:mb-2 flex items-center gap-2">
                <Smartphone size={20} className="text-brand-500" />
                Produto
              </h3>
              {!selectedProduct ? (
                <div className="space-y-3">
                  {selectedStore && (
                    <p className="text-xs app-text-muted">
                      Mostrando aparelhos disponíveis de {stores.find((store) => store.id === selectedStore)?.name || 'loja selecionada'}.
                    </p>
                  )}
                  <Combobox
                    label="Produto"
                    placeholder="Buscar Produto..."
                    searchPlaceholder="Digite modelo, IMEI ou cor..."
                    value={selectedProduct?.id || ''}
                    onChange={handleSelectProduct}
                    options={productOptions}
                    minSearchChars={2}
                    minSearchMessage="Digite ao menos 2 caracteres."
                    errorMessage={fieldErrors.product}
                  />
                  {!selectedStore && (
                    <div className="text-center py-5 space-y-2">
                      <p className="text-ios-body app-text-muted">Selecione uma loja na etapa 1 para carregar os aparelhos.</p>
                    </div>
                  )}
                  {selectedStore && availableStock.length === 0 && (
                    <div className="text-center py-5 space-y-2">
                      <p className="text-ios-body app-text-muted">Sem estoque disponível nesta loja.</p>
                      <Link to="/inventory" className="ios-button-tinted inline-flex">
                        Ir para Estoque
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="ios-card p-3 border-2 border-brand-500 bg-brand-50 dark:bg-brand-900/20">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-bold app-text-primary text-base">{selectedProduct.model}</p>
                      <p className="text-sm app-text-muted">{selectedProduct.capacity} • {selectedProduct.color}</p>
                    </div>
                    <button onClick={() => setSelectedProduct(null)} className="text-red-500 hover:text-red-600 text-xs md:text-ios-subhead">Remover</button>
                  </div>

                  <div className="mt-3 pt-3 border-t app-border flex justify-between items-center">
                    <div className="flex items-center gap-2 text-sm app-text-secondary">
                      <ShieldCheck size={16} className="text-green-500 shrink-0" />
                      <span>{selectedProduct.condition === Condition.USED ? 'Garantia: 90 Dias' : 'Garantia Apple (fabricante)'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Trade In */}
            <div className="ios-card p-4 md:p-5 lg:p-4">
              <div className="flex justify-between items-center mb-3 lg:mb-2">
                <h3 className="text-[17px] md:text-ios-title-3 font-bold app-text-primary">Troca (Trade-In)</h3>
                <button
                  onClick={() => setIsTradeInModalOpen(true)}
                  className="text-brand-500 hover:text-brand-600 text-ios-subhead font-medium"
                >
                  + Adicionar
                </button>
              </div>
              {tradeInItems.length > 0 ? (
                <div className="space-y-2">
                  {tradeInItems.map((tradeInItem, index) => (
                    <div key={`${tradeInItem.id}-${index}`} className="ios-card p-3 border-2 border-accent-500 bg-accent-50 dark:bg-accent-900/20">
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold app-text-primary text-base">{tradeInItem.model}</p>
                          <p className="text-sm app-text-muted">
                            {tradeInItem.capacity} · {tradeInItem.color || 'N/A'} · IMEI {tradeInItem.imei || '-'}
                          </p>
                          <div className="flex items-center gap-4 mt-2">
                            {tradeInItem.condition === Condition.USED && tradeInItem.batteryHealth && (
                              <span className="flex items-center gap-1 text-ios-caption font-semibold" style={{ color: tradeInItem.batteryHealth > 89 ? '#34C759' : tradeInItem.batteryHealth > 79 ? '#FF9500' : '#FF3B30' }}>
                                <Battery size={14} />
                                {tradeInItem.batteryHealth}%
                              </span>
                            )}
                            <span className="text-ios-caption app-text-muted">{tradeInItem.condition}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 ml-3 shrink-0">
                          <span className="text-base font-bold text-accent-600 dark:text-accent-400">
                            R$ {tradeInItem.purchasePrice.toLocaleString('pt-BR')}
                          </span>
                          <button
                            onClick={() => setTradeInItems((prev) => prev.filter((item) => item.id !== tradeInItem.id))}
                            className="w-11 h-11 hit-target-44 flex items-center justify-center text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                            aria-label={`Remover troca ${tradeInItem.model}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="pt-1 text-sm app-text-secondary flex justify-between">
                    <span>Subtotal das entradas</span>
                    <span className="font-semibold">R$ {tradeInValue.toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm app-text-muted">
                  Nenhum aparelho de troca adicionado.
                </p>
              )}
            </div>
          </div>

          <details className="ios-card p-3 md:p-4">
            <summary className="flex items-center gap-2 cursor-pointer list-none select-none">
              <CreditCard size={18} className="text-brand-500" />
              <span className="font-semibold app-text-primary">Cartão com Acréscimo</span>
            </summary>
            <p className="text-sm app-text-secondary mt-3">
              No cartão, o valor informado no PDV é líquido para a loja. O cliente paga o valor bruto com acréscimo conforme bandeira e parcelas.
            </p>
          </details>
        </div>
        )}

        {step === 3 && (
          <div className="ios-card p-4 md:p-5 lg:p-4">
            <h3 className="text-[17px] md:text-ios-title-3 font-bold app-text-primary mb-3 lg:mb-2">
              Checklist de Conclusão
            </h3>
            <div className="space-y-2 text-sm">
              <p className={selectedSeller ? 'text-green-600' : 'text-red-600'}>
                {selectedSeller ? 'OK' : 'Pendente'}: Vendedor selecionado
              </p>
              <p className={selectedStore ? 'text-green-600' : 'text-red-600'}>
                {selectedStore ? 'OK' : 'Pendente'}: Loja selecionada
              </p>
              <p className={selectedClient ? 'text-green-600' : 'text-red-600'}>
                {selectedClient ? 'OK' : 'Pendente'}: Cliente selecionado
              </p>
              <p className={selectedProduct ? 'text-green-600' : 'text-red-600'}>
                {selectedProduct ? 'OK' : 'Pendente'}: Produto selecionado
              </p>
              <p className={isPaymentBalanced ? 'text-green-600' : 'text-red-600'}>
                {isPaymentBalanced ? 'OK' : 'Pendente'}: Pagamento completo
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBackStep}
            className="ios-button-secondary"
            disabled={step === 1}
          >
            Voltar etapa
          </button>
          {step < 3 && (
            <button
              type="button"
              onClick={() => goToStep((step + 1) as 2 | 3)}
              className="ios-button-primary"
            >
              Continuar
            </button>
          )}
        </div>
      </div>

      {/* Right Panel: Totals */}
      <div className="ios-card p-4 md:p-5 lg:p-4 flex flex-col">
        <h3 className="text-ios-title-2 font-bold app-text-primary mb-4 md:mb-5 lg:mb-4">Resumo</h3>

        <div className="space-y-2.5 md:space-y-3 flex-1">
          {step === 3 && selectedProduct && (
            <div className="rounded-ios-lg border app-border p-3 space-y-2">
              <label htmlFor="pdv-negotiated-price" className="ios-label">Valor negociado do aparelho</label>
              <input
                id="pdv-negotiated-price"
                type="number"
                min={0}
                step={0.01}
                className="ios-input"
                value={negotiatedPriceInput}
                onChange={(event) => handleNegotiatedPriceChange(event.target.value)}
                onBlur={handleNegotiatedPriceBlur}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button type="button" onClick={openDiscountModal} className="ios-button-secondary text-xs sm:text-sm">
                  Aplicar desconto
                </button>
                <button
                  type="button"
                  onClick={handleRestoreNegotiation}
                  className="ios-button-secondary text-xs sm:text-sm"
                  disabled={!hasNegotiatedPriceChange && discountAmount <= 0}
                >
                  Restaurar valor original
                </button>
              </div>
              {hasNegotiatedPriceChange && (
                <p className={`text-xs ${negotiatedSubtotal > originalSubtotal ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {negotiatedSubtotal > originalSubtotal ? 'Acima' : 'Abaixo'} do preço cadastrado (R$ {formatCurrency(originalSubtotal)})
                </p>
              )}
              {discountAmount > 0 && (
                <p className="text-xs text-emerald-600">
                  Desconto aplicado: -R$ {formatCurrency(discountAmount)}
                  {discountConfig.type === 'percent' && discountPercent !== null ? ` (${discountPercent.toFixed(2)}%)` : ''}
                </p>
              )}
              {fieldErrors.pricing && (
                <p className="text-xs text-red-600" role="alert">
                  {fieldErrors.pricing}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-between app-text-muted">
            <span className="text-ios-subhead">Preço de tabela</span>
            <span className="text-ios-subhead font-medium app-text-primary">R$ {formatCurrency(originalSubtotal)}</span>
          </div>
          <div className="flex justify-between app-text-muted">
            <span className="text-ios-subhead">Subtotal negociado</span>
            <span className="text-ios-subhead font-medium app-text-primary">R$ {formatCurrency(negotiatedSubtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-red-600">
              <span className="text-ios-subhead">
                Desconto
                {discountConfig.type === 'percent' && discountPercent !== null ? ` (${discountPercent.toFixed(2)}%)` : ''}
              </span>
              <span className="text-ios-subhead font-medium">- R$ {formatCurrency(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between app-text-muted">
            <span className="text-ios-subhead">Subtotal após desconto</span>
            <span className="text-ios-subhead font-medium app-text-primary">R$ {formatCurrency(negotiatedSubtotal - discountAmount)}</span>
          </div>
          {tradeInItems.length > 0 && (
            <div className="flex justify-between text-green-600">
              <span className="text-ios-subhead">Desconto Troca ({tradeInItems.length})</span>
              <span className="text-ios-subhead font-medium">- R$ {formatCurrency(tradeInValue)}</span>
            </div>
          )}
          <div className="border-t app-border pt-3 flex justify-between items-center">
            <span className="text-ios-title-3 font-bold app-text-primary">Total</span>
            <span className="text-[24px] md:text-ios-large font-bold text-brand-500 tabular-nums">
              R$ <AnimatedNumber value={totalToPay} format={(n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} />
            </span>
          </div>
          <div className="flex justify-between app-text-muted">
            <span className="text-ios-subhead">Total líquido recebido</span>
            <span className="text-ios-subhead font-medium app-text-primary">R$ {formatCurrency(totalPaidNet)}</span>
          </div>
          <div className="flex justify-between app-text-muted">
            <span className="text-ios-subhead">Acréscimo cartão</span>
            <span className="text-ios-subhead font-medium app-text-primary">R$ {formatCurrency(cardSurchargeTotal)}</span>
          </div>
          <div className="flex justify-between app-text-muted">
            <span className="text-ios-subhead">Total pago pelo cliente</span>
            <span className="text-ios-subhead font-medium app-text-primary">R$ {formatCurrency(totalPaidByCustomer + tradeInValue)}</span>
          </div>

          <div className="mt-3 md:mt-5 lg:mt-4">
            <p className="ios-section-header px-0 mb-2">Forma de Pagamento</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {PDV_PAYMENT_METHODS.map(type => (
                <m.button
                  key={type}
                  disabled={!hasPaymentPending}
                  onClick={() => handleSelectPaymentType(type as PaymentMethod['type'])}
                  whileTap={reducedMotion || !hasPaymentPending ? undefined : { scale: 0.96 }}
                  transition={{ type: 'tween', ease: [0.32, 0.72, 0, 1], duration: 0.15 }}
                  className="ios-button-secondary text-ios-caption disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {type}
                </m.button>
              ))}
            </div>

            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {payments.map((p, i) => (
                  <m.div
                    key={`${p.type}-${i}-${p.amount}`}
                    layout
                    initial={reducedMotion ? false : { opacity: 0, y: -10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 60, scale: 0.94, transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] } }}
                    transition={iosSpring}
                    className="flex justify-between items-center app-surface-soft rounded-ios px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <span className="text-ios-subhead app-text-secondary">
                        {p.type}
                        {p.type === 'Cartão' && p.installments ? ` ${p.installments}x` : ''}
                      </span>
                      {p.account && (
                        <p className="text-xs app-text-muted">
                          Conta: {p.account}
                        </p>
                      )}
                      {p.type === 'Cartão' && (
                        <p className="text-xs app-text-muted truncate">
                          {p.cardBrand === 'outras' ? 'Outras bandeiras' : 'Visa/Master'}
                          {p.feeRate ? ` • Taxa ${p.feeRate.toFixed(2)}%` : ''}
                          {p.customerAmount ? ` • Cliente R$ ${p.customerAmount.toLocaleString('pt-BR')}` : ''}
                        </p>
                      )}
                      {p.type === 'Devedor' && (
                        <p className="text-xs app-text-muted truncate">
                          {p.debtInstallments ? `${p.debtInstallments}x • ` : ''}
                          {p.debtDueDate ? `Venc.: ${new Date(`${p.debtDueDate}T00:00:00`).toLocaleDateString('pt-BR')} • ` : ''}
                          {p.debtNotes || 'Pagamento pendente'}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-ios-subhead font-medium app-text-primary tabular-nums">
                        R$ {(p.customerAmount || p.amount).toLocaleString('pt-BR')}
                      </span>
                      <m.button
                        onClick={() => removePayment(i)}
                        whileTap={reducedMotion ? undefined : { scale: 0.85 }}
                        className="w-11 h-11 hit-target-44 flex items-center justify-center text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                        aria-label="Remover pagamento"
                      >
                        <X size={16} />
                      </m.button>
                    </div>
                  </m.div>
                ))}
              </AnimatePresence>
              {tradeInValue > 0 && (
                <div className="flex justify-between items-center app-surface-soft rounded-ios px-3 py-2.5">
                  <span className="text-ios-subhead app-text-secondary">
                    Troca ({tradeInItems.length} aparelho{tradeInItems.length !== 1 ? 's' : ''})
                  </span>
                  <span className="text-ios-subhead font-medium app-text-primary tabular-nums">
                    R$ {tradeInValue.toLocaleString('pt-BR')}
                  </span>
                </div>
              )}
            </div>
            <AnimatePresence>
              {fieldErrors.payment && (
                <m.p
                  initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
                  className="text-xs text-red-600 mt-2"
                  role="alert"
                >
                  {fieldErrors.payment}
                </m.p>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-3 md:mt-5 lg:mt-4 pt-3 md:pt-4 border-t app-border space-y-2">
          <div className="flex justify-between mb-3">
            <span className="app-text-muted">Restante</span>
            <span className={`font-bold text-ios-title-3 ${hasPaymentPending || hasPaymentOverage ? 'text-ios-red' : 'text-green-600'}`}>
              R$ {formatCurrency(remaining)}
            </span>
          </div>
          {hasPaymentOverage && (
            <p className="text-xs text-red-600">
              Pagamento excedente detectado. Remova ou ajuste uma forma de pagamento.
            </p>
          )}

          <button
            type="button"
            onClick={handleSaveDraft}
            className="w-full ios-button-secondary"
          >
            Salvar rascunho
          </button>

          <button
            type="button"
            onClick={handleFinishSale}
            disabled={isFinishingSale}
            className={`w-full min-h-[50px] text-[17px] font-semibold rounded-ios ${
              canFinish && step === 3 ? 'ios-button-primary' : 'ios-button-secondary opacity-60 cursor-not-allowed'
            }`}
          >
            {isFinishingSale
              ? 'Finalizando...'
              : step !== 3
              ? 'Finalize as etapas para concluir'
              : !selectedSeller
                ? 'Selecione um Vendedor'
                : !selectedStore
                  ? 'Selecione uma Loja'
                  : !selectedClient
                    ? 'Selecione um Cliente'
                    : !selectedProduct
                      ? 'Selecione um Produto'
                      : hasPaymentPending
                        ? 'Pagamento Pendente'
                        : hasPaymentOverage
                          ? 'Pagamento Excedente'
                          : 'Finalizar Venda'}
          </button>
        </div>
      </div>

      
      <AddCustomerModal 
        open={isCustomerModalOpen} 
        onClose={() => setIsCustomerModalOpen(false)}
        onCustomerAdded={(id) => setSelectedClient(id)}
      />
      
      <AddSellerModal
        open={isSellerModalOpen}
        onClose={() => setIsSellerModalOpen(false)}
        onSellerAdded={(id) => setSelectedSeller(id)}
      />

      <StockFormModal
        open={isTradeInModalOpen}
        draftContext="pdv-tradein"
        onClose={() => setIsTradeInModalOpen(false)}
        defaultStatus={StockStatus.PREPARATION}
        onSave={(item) => {
          setTradeInItems((prev) => (prev.some((existing) => existing.id === item.id) ? prev : [...prev, item]));
          setIsTradeInModalOpen(false);
        }}
      />

      <Modal
        open={isDiscountModalOpen}
        onClose={() => setIsDiscountModalOpen(false)}
        title="Aplicar desconto"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" className="ios-button-secondary" onClick={() => setIsDiscountModalOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="ios-button-primary" onClick={handleApplyDiscount}>
              Aplicar
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="ios-label">Tipo de desconto</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`ios-button-secondary text-sm ${discountDraftType === 'amount' ? 'border-brand-500 text-brand-500' : ''}`}
                onClick={() => setDiscountDraftType('amount')}
              >
                R$
              </button>
              <button
                type="button"
                className={`ios-button-secondary text-sm ${discountDraftType === 'percent' ? 'border-brand-500 text-brand-500' : ''}`}
                onClick={() => setDiscountDraftType('percent')}
              >
                %
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="pdv-discount-value" className="ios-label">
              Valor do desconto ({discountDraftType === 'amount' ? 'R$' : '%'})
            </label>
            <input
              id="pdv-discount-value"
              type="number"
              min={0}
              step={discountDraftType === 'amount' ? 0.01 : 0.1}
              className="ios-input"
              value={discountDraftValue}
              onChange={(event) => setDiscountDraftValue(event.target.value)}
            />
          </div>
          <div className="rounded-ios-lg app-surface-soft p-3 text-sm space-y-1">
            <div className="flex justify-between app-text-muted">
              <span>Base negociada</span>
              <span>R$ {formatCurrency(negotiatedSubtotal)}</span>
            </div>
            <div className="flex justify-between text-red-600">
              <span>Desconto previsto</span>
              <span>
                - R$ {formatCurrency(
                  discountDraftType === 'percent'
                    ? roundCurrency(negotiatedSubtotal * (Number(discountDraftValue || 0) / 100))
                    : roundCurrency(Number(discountDraftValue || 0))
                )}
              </span>
            </div>
            <div className="flex justify-between font-semibold app-text-primary pt-1 border-t app-border">
              <span>Subtotal após desconto</span>
              <span>
                R$ {formatCurrency(
                  Math.max(
                    0,
                    negotiatedSubtotal - (
                      discountDraftType === 'percent'
                        ? roundCurrency(negotiatedSubtotal * (Number(discountDraftValue || 0) / 100))
                        : roundCurrency(Number(discountDraftValue || 0))
                    )
                  )
                )}
              </span>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={isBasicPaymentModalOpen}
        onClose={() => setIsBasicPaymentModalOpen(false)}
        title={`Adicionar ${basicPaymentType}`}
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" className="ios-button-secondary" onClick={() => setIsBasicPaymentModalOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="ios-button-primary" onClick={handleConfirmBasicPayment}>
              Adicionar
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="ios-label">Valor líquido para loja</label>
            <input
              type="number"
              className="ios-input"
              value={basicPaymentForm.amount}
              onChange={(e) => setBasicPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
            />
          </div>
          <div>
            <label className="ios-label">Conta de entrada</label>
            <select
              className="ios-input"
              value={basicPaymentForm.account}
              onChange={(e) => setBasicPaymentForm((prev) => ({ ...prev, account: e.target.value as FinancialAccount }))}
            >
              {CASH_EQUIVALENT_ACCOUNTS.map((account) => (
                <option key={account} value={account}>
                  {account}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      <Modal
        open={isCardPaymentModalOpen}
        onClose={() => setIsCardPaymentModalOpen(false)}
        title="Adicionar Cartão"
        size="xl"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" className="ios-button-secondary" onClick={() => setIsCardPaymentModalOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="ios-button-primary" onClick={handleConfirmCardPayment}>
              Adicionar Cartão
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-3">
            <div className="md:col-span-2 lg:col-span-3">
              <label className="ios-label">Valor líquido para loja</label>
              <input
                type="number"
                className="ios-input"
                value={cardPaymentForm.netAmount}
                onChange={(e) => setCardPaymentForm((prev) => ({ ...prev, netAmount: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="ios-label">Conta de entrada</label>
              <select
                className="ios-input"
                value={cardPaymentForm.account}
                onChange={(e) => setCardPaymentForm((prev) => ({ ...prev, account: e.target.value as FinancialAccount }))}
              >
                {CASH_EQUIVALENT_ACCOUNTS.map((account) => (
                  <option key={account} value={account}>
                    {account}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 lg:col-span-6">
              <label className="ios-label">Bandeira</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`ios-button-secondary text-xs ${cardPaymentForm.brand === 'visa_master' ? 'border-green-500 text-green-600' : ''}`}
                  onClick={() => setCardPaymentForm((prev) => ({ ...prev, brand: 'visa_master' }))}
                >
                  Visa / Master
                </button>
                <button
                  type="button"
                  className={`ios-button-secondary text-xs ${cardPaymentForm.brand === 'outras' ? 'border-orange-500 text-orange-600' : ''}`}
                  onClick={() => setCardPaymentForm((prev) => ({ ...prev, brand: 'outras' }))}
                >
                  Outras
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-ios-lg border app-border p-2 md:p-3">
            <p className="text-xs uppercase tracking-wide app-text-muted mb-2">
              Escolha as parcelas
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {cardRows.map((row) => {
                const isSelected = cardPaymentForm.selectedInstallments === row.installments;
                return (
                  <button
                    key={row.installments}
                    type="button"
                    onClick={() => setCardPaymentForm((prev) => ({ ...prev, selectedInstallments: row.installments }))}
                    className={`text-left rounded-ios border px-2.5 py-2 transition-colors ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                        : 'app-border app-surface-soft-hover'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-brand-500">{row.installments}x</span>
                      <span className="text-xs font-semibold app-text-primary">
                        R$ {row.customerAmount.toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-[11px] app-text-muted mt-1">
                      Taxa {row.rate.toFixed(2)}% • Parcela R$ {row.installmentAmount.toLocaleString('pt-BR')}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={isDebtPaymentModalOpen}
        onClose={() => setIsDebtPaymentModalOpen(false)}
        title="Configurar Devedor"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" className="ios-button-secondary" onClick={() => setIsDebtPaymentModalOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="ios-button-primary" onClick={handleConfirmDebtPayment}>
              Confirmar
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="ios-card p-3">
            <p className="text-xs app-text-muted mb-1">Valor em aberto</p>
            <p className="text-ios-title-3 font-bold text-brand-500">R$ {remaining.toLocaleString('pt-BR')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="ios-label">Parcelas</label>
              <input
                type="number"
                min={1}
                step={1}
                className="ios-input"
                value={debtPaymentForm.installmentsTotal}
                onChange={(e) => setDebtPaymentForm((prev) => ({ ...prev, installmentsTotal: e.target.value }))}
              />
            </div>
            <div>
              <label className="ios-label">1º Vencimento (opcional)</label>
              <input
                type="date"
                className="ios-input"
                value={debtPaymentForm.dueDate}
                onChange={(e) => setDebtPaymentForm((prev) => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="ios-label">Observação (opcional)</label>
            <textarea
              className="ios-input min-h-20"
              value={debtPaymentForm.notes}
              onChange={(e) => setDebtPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Ex: parcela mensal todo dia 10"
            />
          </div>
        </div>
      </Modal>
    </div>
    </div>
  );
};

export default PDV;
