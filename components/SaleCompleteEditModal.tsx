import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useData } from '../services/dataContext';
import { PaymentMethod, Sale, SaleTradeInItem, StockItem, StockStatus } from '../types';
import IOSButton from './ui/IOSButton';
import Modal from './ui/Modal';
import { FINANCIAL_ACCOUNTS } from '../utils/financialAccounts';
import { newId } from '../utils/id';
import { formatCurrencyBRL } from '../utils/inputMasks';
import { roundCurrency } from '../utils/pdvPricing';

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

export interface SaleCompleteEditModalProps {
  open: boolean;
  onClose: () => void;
  sale: Sale | null;
  onSave: (updates: Partial<Sale>) => Promise<void>;
}

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

const SaleCompleteEditModal: React.FC<SaleCompleteEditModalProps> = ({ open, onClose, sale, onSave }) => {
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

  const summaryRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLDivElement>(null);
  const tradeInsRef = useRef<HTMLDivElement>(null);
  const paymentsRef = useRef<HTMLDivElement>(null);
  const totalsRef = useRef<HTMLDivElement>(null);

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

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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

    if (netFinancialTotal > 0 && normalizedPayments.length === 0) {
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
    <Modal
      open={open}
      onClose={onClose}
      title="Editar Venda Concluída"
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <IOSButton variant="secondary" onClick={onClose}>
            Cancelar
          </IOSButton>
          <IOSButton variant="primary" onClick={handleSave} loading={isSaving}>
            Salvar Alterações
          </IOSButton>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="sticky top-0 z-10 -mx-1 bg-white/95 dark:bg-surface-dark-100/95 pb-3 backdrop-blur">
          <div className="flex gap-2 overflow-x-auto px-1">
            <button type="button" className="ios-button-secondary whitespace-nowrap text-xs" onClick={() => scrollToSection(summaryRef)}>Resumo</button>
            <button type="button" className="ios-button-secondary whitespace-nowrap text-xs" onClick={() => scrollToSection(itemsRef)}>Itens vendidos</button>
            <button type="button" className="ios-button-secondary whitespace-nowrap text-xs" onClick={() => scrollToSection(tradeInsRef)}>Trade-in</button>
            <button type="button" className="ios-button-secondary whitespace-nowrap text-xs" onClick={() => scrollToSection(paymentsRef)}>Pagamentos</button>
            <button type="button" className="ios-button-secondary whitespace-nowrap text-xs" onClick={() => scrollToSection(totalsRef)}>Totais</button>
          </div>
        </div>

        {formError && (
          <div role="alert" className="rounded-ios border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
            {formError}
          </div>
        )}

        <section ref={summaryRef} className="scroll-mt-20 space-y-4">
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
        </section>

        <section ref={itemsRef} className="scroll-mt-20 rounded-ios border app-border p-3 space-y-3">
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
                    className="inline-flex items-center gap-1 min-h-[44px] px-2 text-xs text-red-600 hover:text-red-700"
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
        </section>

        <section ref={tradeInsRef} className="scroll-mt-20 rounded-ios border app-border p-3 space-y-3">
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
                      className="inline-flex items-center gap-1 min-h-[44px] px-2 text-xs text-red-600 hover:text-red-700"
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
        </section>

        <section ref={paymentsRef} className="scroll-mt-20 rounded-ios border app-border p-3 space-y-3">
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
                    className="inline-flex items-center gap-1 min-h-[44px] px-2 text-xs text-red-600 hover:text-red-700"
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
        </section>

        <section ref={totalsRef} className="scroll-mt-20 rounded-ios border app-border p-3 text-sm space-y-1.5">
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
        </section>

      </div>
    </Modal>
  );
};

export default SaleCompleteEditModal;
