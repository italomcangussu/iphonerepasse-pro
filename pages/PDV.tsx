import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../services/dataContext';
import { StockStatus, StockItem, PaymentMethod, Sale, Condition } from '../types';
import { User, Smartphone, Printer, CheckCircle, ShieldCheck, X, Calculator, Trash2, Battery } from 'lucide-react';
import { Combobox } from '../components/ui/Combobox';
import { AddCustomerModal } from '../components/AddCustomerModal';
import { AddSellerModal } from '../components/AddSellerModal';
import { StockFormModal } from '../components/StockFormModal';
import { useToast } from '../components/ui/ToastProvider';
import Modal from '../components/ui/Modal';
import { newId } from '../utils/id';
import { PDV_PAYMENT_METHODS } from '../utils/payments';
import { useAuth } from '../contexts/AuthContext';
import { trackUxEvent } from '../services/telemetry';
import { Link } from 'react-router-dom';

const PDV_DRAFT_KEY = 'pdv:draft:v1';

type FieldErrors = {
  seller?: string;
  client?: string;
  product?: string;
  payment?: string;
};

const PDV: React.FC = () => {
  const { stock, customers, sellers, addSale, businessProfile } = useData();
  const { role } = useAuth();
  const toast = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedSeller, setSelectedSeller] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Modal states
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isSellerModalOpen, setIsSellerModalOpen] = useState(false);
  const [isTradeInModalOpen, setIsTradeInModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StockItem | null>(null);
  const [tradeInItem, setTradeInItem] = useState<StockItem | null>(null);
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [commission, setCommission] = useState(50);
  
  // Card fee calculator
  const [showFeeCalculator, setShowFeeCalculator] = useState(false);
  const [feeAmount, setFeeAmount] = useState('');
  const [feeRate, setFeeRate] = useState(2.5);
  const [isDebtPaymentModalOpen, setIsDebtPaymentModalOpen] = useState(false);
  const [debtPaymentForm, setDebtPaymentForm] = useState({
    dueDate: '',
    notes: ''
  });

  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(PDV_DRAFT_KEY);
      if (!rawDraft) return;
      const draft = JSON.parse(rawDraft) as {
        selectedSeller?: string;
        selectedClient?: string;
        selectedProductId?: string;
        payments?: PaymentMethod[];
        commission?: number;
      };
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
    if (step === 1 && selectedSeller && selectedClient) {
      setStep(2);
    }
  }, [step, selectedSeller, selectedClient]);

  useEffect(() => {
    if (step === 2 && selectedProduct) {
      setStep(3);
    }
  }, [step, selectedProduct]);

  useEffect(() => {
    if (step === 3 && !selectedProduct) {
      setStep(2);
    }
  }, [step, selectedProduct]);

  const availableStock = stock.filter(s => s.status === StockStatus.AVAILABLE);
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

  const subtotal = selectedProduct ? selectedProduct.sellPrice : 0;
  const tradeInValue = tradeInItem ? tradeInItem.purchasePrice : 0;
  const totalToPay = Math.max(0, subtotal - tradeInValue);
  const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
  const remaining = totalToPay - totalPaid;
  const canFinish = remaining <= 0 && !!selectedProduct && !!selectedClient && !!selectedSeller;

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

  const goToStep = (nextStep: 1 | 2 | 3) => {
    if (nextStep === 2 && !selectedSeller) {
      setFieldErrors((prev) => ({
        ...prev,
        seller: 'Selecione um vendedor.',
        client: undefined
      }));
      toast.error('Selecione um vendedor antes de avançar.');
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

  const handleSaveDraft = () => {
    const draft = {
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
    if (remaining <= 0) return;

    if (type === 'Devedor') {
      if (!selectedClient) {
        toast.error('Selecione um cliente antes de usar Devedor.');
        return;
      }
      setDebtPaymentForm({ dueDate: '', notes: '' });
      setIsDebtPaymentModalOpen(true);
      return;
    }

    handleAddPayment({ type, amount: remaining });
  };

  const handleConfirmDebtPayment = () => {
    if (remaining <= 0) {
      setIsDebtPaymentModalOpen(false);
      return;
    }

    handleAddPayment({
      type: 'Devedor',
      amount: remaining,
      debtDueDate: debtPaymentForm.dueDate || undefined,
      debtNotes: debtPaymentForm.notes.trim() || undefined
    });
    setIsDebtPaymentModalOpen(false);
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const calculateFee = () => {
    const amount = parseFloat(feeAmount) || 0;
    const fee = amount * (feeRate / 100);
    return { fee, total: amount + fee };
  };

  const getWarrantyDate = () => {
    const date = new Date();
    date.setMonth(date.getMonth() + 3);
    return date;
  };

  const handleFinishSale = async () => {
    if (step !== 3) {
      toast.error('Conclua as etapas antes de finalizar a venda.');
      return;
    }
    if (!selectedSeller) {
      setFieldErrors((prev) => ({ ...prev, seller: 'Selecione um vendedor.' }));
      toast.error('Selecione um vendedor.');
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
    if (remaining > 0) {
      setFieldErrors((prev) => ({ ...prev, payment: 'Existe pagamento pendente.' }));
      toast.error('Pagamento pendente.');
      return;
    }

    const saleDate = new Date().toISOString();

    const newSale: Sale = {
      id: newId('sale'),
      customerId: selectedClient,
      sellerId: selectedSeller,
      items: [selectedProduct],
      tradeIn: tradeInItem || undefined,
      tradeInValue: tradeInValue,
      discount: 0,
      total: totalToPay,
      paymentMethods: payments,
      date: saleDate,
      warrantyExpiresAt: getWarrantyDate().toISOString()
    };

    // Trade-in item is already saved to stock by StockFormModal,
    // so we pass tradeIn as undefined to addSale to avoid duplicate insert.
    const saleForDb: Sale = { ...newSale, tradeIn: undefined };

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
    }
  };

  const printReceipt = () => {
    window.print();
  };

  if (step === 3 && lastSale) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-ios-fade">
        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white mb-4 shadow-ios-lg">
          <CheckCircle size={40} />
        </div>
        <h2 className="text-ios-large font-bold text-gray-900 dark:text-white">Venda Realizada!</h2>
        <p className="text-ios-body text-gray-500 dark:text-surface-dark-500">A venda foi registrada e o estoque atualizado.</p>
        
        <div className="flex gap-4 mt-8 no-print">
          <button 
            onClick={printReceipt}
            className="ios-button-secondary flex items-center gap-2"
          >
            <Printer size={20} />
            Imprimir Comprovante
          </button>
          <button
            onClick={() => {
              setStep(1);
              setSelectedSeller('');
              setSelectedClient('');
              setSelectedProduct(null);
              setTradeInItem(null);
              setPayments([]);
              setLastSale(null);
              setCommission(50);
              setFieldErrors({});
              window.localStorage.removeItem(PDV_DRAFT_KEY);
            }}
            className="ios-button-primary"
          >
            Nova Venda
          </button>
        </div>

        {/* Printable Receipt */}
        <div id="receipt-content" className="hidden print-only text-left font-mono text-black p-8 border max-w-[80mm] mx-auto bg-white">
          <div className="text-center mb-6 border-b-2 border-black pb-4">
            <h1 className="font-bold text-2xl uppercase">{businessProfile?.name || 'iPhoneRepasse'}</h1>
            {businessProfile?.address && <p className="text-sm mt-2">{businessProfile.address}</p>}
            {businessProfile?.cnpj && <p className="text-sm">CNPJ: {businessProfile.cnpj}</p>}
          </div>
          
          <div className="mb-4">
            <p className="font-bold text-lg">VENDA #{lastSale.id.slice(-4).toUpperCase()}</p>
            <p className="text-sm">{new Date(lastSale.date).toLocaleString('pt-BR')}</p>
          </div>

          <div className="border-b-2 border-black pb-4 mb-4">
            {lastSale.items.map((item, idx) => (
              <div key={idx} className="mb-2">
                <p className="font-bold">{item.model} {item.capacity}</p>
                <div className="flex justify-between text-sm">
                  <span>1 x R$ {item.sellPrice.toLocaleString('pt-BR')}</span>
                  <span>R$ {item.sellPrice.toLocaleString('pt-BR')}</span>
                </div>
              </div>
            ))}
          </div>

          {lastSale.tradeIn && (
            <div className="flex justify-between text-sm mb-2 text-red-600">
              <span>(-) Trade-In ({lastSale.tradeIn.model})</span>
              <span>R$ {lastSale.tradeInValue.toLocaleString('pt-BR')}</span>
            </div>
          )}

          <div className="border-t-2 border-black pt-4 mt-4">
            <div className="flex justify-between font-bold text-xl">
              <span>TOTAL</span>
              <span>R$ {lastSale.total.toLocaleString('pt-BR')}</span>
            </div>
          </div>

          <div className="mt-6 text-sm">
            <p className="font-bold mb-2">Formas de Pagamento:</p>
            {lastSale.paymentMethods.map((pm, i) => (
              <div key={i} className="flex justify-between">
                <span>{pm.type}</span>
                <span>R$ {pm.amount.toLocaleString('pt-BR')}</span>
              </div>
            ))}
          </div>
          
          <div className="mt-8 text-center text-xs border-t pt-4">
            <p className="font-bold">Garantia de 90 dias</p>
            <p>Vencimento: {new Date(lastSale.warrantyExpiresAt).toLocaleDateString('pt-BR')}</p>
            <p className="mt-4">Obrigado pela preferência!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="ios-card p-3 md:p-4 sticky top-0 z-10">
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 1 as const, title: 'Cliente/Vendedor' },
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
                className={`px-2 py-2.5 rounded-ios-lg text-xs md:text-sm font-semibold border transition-colors ${
                  isCurrent
                    ? 'bg-brand-500 text-white border-brand-500'
                    : isCompleted
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-white dark:bg-surface-dark-100 text-gray-600 dark:text-surface-dark-600 border-gray-200 dark:border-surface-dark-300'
                }`}
              >
                {item.id}. {item.title}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 lg:h-[calc(100vh-170px)] relative">
      {/* Left Panel */}
      <div className="lg:col-span-2 space-y-4 md:space-y-6 lg:overflow-y-auto lg:pr-2">
        {/* Seller & Client */}
        {step === 1 && (
        <div className="ios-card p-4 md:p-6">
          <h3 className="text-[17px] md:text-ios-title-3 font-bold text-gray-900 dark:text-white mb-3 md:mb-4 flex items-center gap-2">
            <User size={20} className="text-brand-500" />
            Vendedor e Cliente
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="mt-4 p-4 bg-gray-50 dark:bg-surface-dark-200 rounded-ios-lg">
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
        <>
        {/* Product */}
        <div className="ios-card p-4 md:p-6">
          <h3 className="text-[17px] md:text-ios-title-3 font-bold text-gray-900 dark:text-white mb-3 md:mb-4 flex items-center gap-2">
            <Smartphone size={20} className="text-brand-500" />
            Produto
          </h3>
          {!selectedProduct ? (
            <div className="space-y-3">
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
              {availableStock.length === 0 && (
                <div className="text-center py-6 space-y-2">
                  <p className="text-ios-body text-gray-500">Sem estoque disponível.</p>
                  <Link to="/inventory" className="ios-button-tinted inline-flex">
                    Ir para Estoque
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="ios-card p-4 border-2 border-brand-500 bg-brand-50 dark:bg-brand-900/20">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="font-bold text-gray-900 dark:text-white text-lg">{selectedProduct.model}</p>
                  <p className="text-gray-500 dark:text-surface-dark-500">{selectedProduct.capacity} • {selectedProduct.color}</p>
                </div>
                <button onClick={() => setSelectedProduct(null)} className="text-red-500 hover:text-red-600 text-ios-subhead">Remover</button>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-surface-dark-300 flex justify-between items-center">
                <div className="flex items-center gap-2 text-ios-subhead text-gray-600 dark:text-surface-dark-600">
                  <ShieldCheck size={18} className="text-green-500" />
                  <span>Garantia: 90 Dias</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Trade In */}
        <div className="ios-card p-4 md:p-6">
          <div className="flex justify-between items-center mb-3 md:mb-4">
            <h3 className="text-[17px] md:text-ios-title-3 font-bold text-gray-900 dark:text-white">Troca (Trade-In)</h3>
            {!tradeInItem && (
              <button
                onClick={() => setIsTradeInModalOpen(true)}
                className="text-brand-500 hover:text-brand-600 text-ios-subhead font-medium"
              >
                + Adicionar
              </button>
            )}
          </div>
          {tradeInItem && (
            <div className="ios-card p-4 border-2 border-accent-500 bg-accent-50 dark:bg-accent-900/20">
              <div className="flex justify-between items-start">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-900 dark:text-white text-[17px]">{tradeInItem.model}</p>
                  <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500">
                    {tradeInItem.capacity} · {tradeInItem.color || 'N/A'}
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    {tradeInItem.condition === Condition.USED && tradeInItem.batteryHealth && (
                      <span className="flex items-center gap-1 text-ios-caption font-semibold" style={{ color: tradeInItem.batteryHealth > 89 ? '#34C759' : tradeInItem.batteryHealth > 79 ? '#FF9500' : '#FF3B30' }}>
                        <Battery size={14} />
                        {tradeInItem.batteryHealth}%
                      </span>
                    )}
                    <span className="text-ios-caption text-gray-500">{tradeInItem.condition}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-3 shrink-0">
                  <span className="text-[17px] font-bold text-accent-600 dark:text-accent-400">
                    R$ {tradeInItem.purchasePrice.toLocaleString('pt-BR')}
                  </span>
                  <button
                    onClick={() => setTradeInItem(null)}
                    className="w-9 h-9 flex items-center justify-center text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                    aria-label="Remover troca"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Card Fee Calculator */}
        <div className="ios-card p-4 md:p-6">
          <div className="flex justify-between items-center mb-3 md:mb-4">
            <h3 className="text-[17px] md:text-ios-title-3 font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Calculator size={20} className="text-brand-500" />
              Calculadora de Taxas
            </h3>
            <button
              onClick={() => setShowFeeCalculator(!showFeeCalculator)}
              className="text-brand-500 text-ios-subhead"
            >
              {showFeeCalculator ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          
          {showFeeCalculator && (
            <div className="space-y-4 animate-ios-fade">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="ios-label">Valor da Venda</label>
                  <input
                    type="number"
                    className="ios-input"
                    value={feeAmount}
                    onChange={(e) => setFeeAmount(e.target.value)}
                    placeholder="R$ 0,00"
                  />
                </div>
                <div>
                  <label className="ios-label">Taxa (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="ios-input"
                    value={feeRate}
                    onChange={(e) => setFeeRate(parseFloat(e.target.value))}
                  />
                </div>
              </div>
              {feeAmount && (
                <div className="p-4 bg-gray-50 dark:bg-surface-dark-200 rounded-ios-lg">
                  <div className="flex justify-between text-ios-subhead mb-2">
                    <span>Taxa:</span>
                    <span className="text-red-500">R$ {calculateFee().fee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-ios-title-3 font-bold">
                    <span>Total a Receber:</span>
                    <span className="text-green-600">R$ {calculateFee().total.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        </>
        )}

        {step === 3 && (
          <div className="ios-card p-4 md:p-6">
            <h3 className="text-[17px] md:text-ios-title-3 font-bold text-gray-900 dark:text-white mb-3 md:mb-4">
              Checklist de Conclusão
            </h3>
            <div className="space-y-2 text-sm">
              <p className={selectedSeller ? 'text-green-600' : 'text-red-600'}>
                {selectedSeller ? 'OK' : 'Pendente'}: Vendedor selecionado
              </p>
              <p className={selectedClient ? 'text-green-600' : 'text-red-600'}>
                {selectedClient ? 'OK' : 'Pendente'}: Cliente selecionado
              </p>
              <p className={selectedProduct ? 'text-green-600' : 'text-red-600'}>
                {selectedProduct ? 'OK' : 'Pendente'}: Produto selecionado
              </p>
              <p className={remaining <= 0 ? 'text-green-600' : 'text-red-600'}>
                {remaining <= 0 ? 'OK' : 'Pendente'}: Pagamento completo
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => step > 1 && setStep((prev) => (prev - 1) as 1 | 2 | 3)}
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
      <div className="ios-card p-4 md:p-6 flex flex-col lg:h-full">
        <h3 className="text-ios-title-2 font-bold text-gray-900 dark:text-white mb-4 md:mb-6">Resumo</h3>

        <div className="space-y-3 md:space-y-4 flex-1">
          <div className="flex justify-between text-gray-500 dark:text-surface-dark-500">
            <span className="text-ios-subhead">Subtotal</span>
            <span className="text-ios-subhead font-medium text-gray-900 dark:text-white">R$ {subtotal.toLocaleString('pt-BR')}</span>
          </div>
          {tradeInItem && (
            <div className="flex justify-between text-green-600">
              <span className="text-ios-subhead">Desconto Troca</span>
              <span className="text-ios-subhead font-medium">- R$ {tradeInValue.toLocaleString('pt-BR')}</span>
            </div>
          )}
          <div className="border-t border-gray-200 dark:border-surface-dark-300 pt-3 flex justify-between items-center">
            <span className="text-ios-title-3 font-bold text-gray-900 dark:text-white">Total</span>
            <span className="text-[24px] md:text-ios-large font-bold text-brand-500">R$ {totalToPay.toLocaleString('pt-BR')}</span>
          </div>

          <div className="mt-4 md:mt-8">
            <p className="ios-section-header px-0 mb-2">Forma de Pagamento</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {PDV_PAYMENT_METHODS.map(type => (
                <button
                  key={type}
                  disabled={remaining <= 0}
                  onClick={() => handleSelectPaymentType(type as PaymentMethod['type'])}
                  className="ios-button-secondary text-ios-caption disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {payments.map((p, i) => (
                <div key={i} className="flex justify-between items-center bg-gray-50 dark:bg-surface-dark-200 rounded-ios px-3 py-2.5">
                  <div className="min-w-0">
                    <span className="text-ios-subhead text-gray-600 dark:text-surface-dark-600">{p.type}</span>
                    {p.type === 'Devedor' && (
                      <p className="text-xs text-gray-500 dark:text-surface-dark-500 truncate">
                        {p.debtDueDate ? `Venc.: ${new Date(`${p.debtDueDate}T00:00:00`).toLocaleDateString('pt-BR')} • ` : ''}
                        {p.debtNotes || 'Pagamento pendente'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-ios-subhead font-medium text-gray-900 dark:text-white">R$ {p.amount.toLocaleString('pt-BR')}</span>
                    <button
                      onClick={() => removePayment(i)}
                      className="w-8 h-8 flex items-center justify-center text-red-500 hover:text-red-600 active:scale-95 rounded-full"
                      aria-label="Remover pagamento"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {fieldErrors.payment && <p className="text-xs text-red-600 mt-2">{fieldErrors.payment}</p>}
          </div>
        </div>

        <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-gray-200 dark:border-surface-dark-300 space-y-2">
          <div className="flex justify-between mb-3">
            <span className="text-gray-500 dark:text-surface-dark-500">Restante</span>
            <span className={`font-bold text-ios-title-3 ${remaining > 0 ? 'text-ios-red' : 'text-green-600'}`}>
              R$ {remaining.toLocaleString('pt-BR')}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSaveDraft}
            className="w-full ios-button-secondary"
          >
            Salvar rascunho
          </button>

          <button
            onClick={handleFinishSale}
            className={`w-full min-h-[50px] text-[17px] font-semibold rounded-ios ${
              canFinish && step === 3 ? 'ios-button-primary' : 'ios-button-secondary opacity-60 cursor-not-allowed'
            }`}
          >
            {step !== 3
              ? 'Finalize as etapas para concluir'
              : !selectedSeller
                ? 'Selecione um Vendedor'
                : !selectedClient
                  ? 'Selecione um Cliente'
                  : !selectedProduct
                    ? 'Selecione um Produto'
                    : remaining > 0
                      ? 'Pagamento Pendente'
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
        onClose={() => setIsTradeInModalOpen(false)}
        defaultStatus={StockStatus.PREPARATION}
        onSave={(item) => {
          setTradeInItem(item);
          setIsTradeInModalOpen(false);
        }}
      />

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
            <p className="text-xs text-gray-500 mb-1">Valor em aberto</p>
            <p className="text-ios-title-3 font-bold text-brand-500">R$ {remaining.toLocaleString('pt-BR')}</p>
          </div>
          <div>
            <label className="ios-label">Vencimento (opcional)</label>
            <input
              type="date"
              className="ios-input"
              value={debtPaymentForm.dueDate}
              onChange={(e) => setDebtPaymentForm((prev) => ({ ...prev, dueDate: e.target.value }))}
            />
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
