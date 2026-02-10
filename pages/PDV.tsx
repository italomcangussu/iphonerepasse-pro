import React, { useState } from 'react';
import { useData } from '../services/dataContext';
import { StockStatus, StockItem, PaymentMethod, Sale, WarrantyType, Condition } from '../types';
import { Search, ShoppingCart, User, Smartphone, CreditCard, Printer, CheckCircle, ShieldCheck, Lock, Calendar, X, Calculator, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PDV: React.FC = () => {
  const { stock, customers, sellers, addSale, addStockItem } = useData();
  const navigate = useNavigate();
  
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedSeller, setSelectedSeller] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<StockItem | null>(null);
  const [tradeIn, setTradeIn] = useState<{ model: string; value: number; condition: string; storage: string } | null>(null);
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [commission, setCommission] = useState(50);
  
  // Card fee calculator
  const [showFeeCalculator, setShowFeeCalculator] = useState(false);
  const [feeAmount, setFeeAmount] = useState('');
  const [feeRate, setFeeRate] = useState(2.5);

  const availableStock = stock.filter(s => s.status === StockStatus.AVAILABLE);

  const subtotal = selectedProduct ? selectedProduct.sellPrice : 0;
  const tradeInValue = tradeIn ? tradeIn.value : 0;
  const totalToPay = Math.max(0, subtotal - tradeInValue);
  const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
  const remaining = totalToPay - totalPaid;

  const handleAddPayment = (type: PaymentMethod['type'], amount: number) => {
    if (amount <= 0) return;
    setPayments([...payments, { type, amount }]);
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

  const handleFinishSale = () => {
    if (!selectedProduct || !selectedClient || !selectedSeller) return;

    const newSale: Sale = {
      id: Math.random().toString(36).substr(2, 9),
      customerId: selectedClient,
      sellerId: selectedSeller,
      items: [selectedProduct],
      tradeIn: tradeIn ? {
        id: `trade-${Date.now()}`,
        type: selectedProduct.type,
        model: tradeIn.model,
        color: 'N/A',
        capacity: tradeIn.storage,
        imei: 'TRADE-IN',
        condition: Condition.USED,
        status: StockStatus.PREPARATION,
        storeLocation: selectedProduct.storeLocation,
        purchasePrice: tradeInValue,
        sellPrice: 0,
        maxDiscount: 0,
        warrantyType: WarrantyType.STORE,
        costs: [],
        photos: [],
        entryDate: new Date().toISOString()
      } : undefined,
      tradeInValue: tradeInValue,
      discount: 0,
      total: totalToPay,
      paymentMethods: payments,
      date: new Date().toISOString(),
      warrantyExpiresAt: getWarrantyDate().toISOString()
    };

    addSale(newSale);
    setLastSale(newSale);
    setStep(3);
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
              setTradeIn(null);
              setPayments([]);
              setLastSale(null);
              setCommission(50);
            }}
            className="ios-button-primary"
          >
            Nova Venda
          </button>
        </div>

        {/* Printable Receipt */}
        <div id="receipt-content" className="hidden print-only text-left font-mono text-black p-8 border max-w-[80mm] mx-auto bg-white">
          <div className="text-center mb-6 border-b-2 border-black pb-4">
            <h1 className="font-bold text-2xl uppercase">iPhone Repasse</h1>
            <p className="text-sm mt-2">Rua Exemplo, 123 - Centro</p>
            <p className="text-sm">CNPJ: 00.000.000/0001-00</p>
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-100px)] relative">
      {/* Left Panel */}
      <div className="lg:col-span-2 space-y-6 overflow-y-auto pr-2">
        {/* Seller & Client */}
        <div className="ios-card p-6">
          <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <User size={20} className="text-brand-500" />
            Vendedor e Cliente
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="ios-label">Vendedor</label>
              <select 
                className="ios-input"
                value={selectedSeller}
                onChange={(e) => setSelectedSeller(e.target.value)}
              >
                <option value="">Selecione Vendedor</option>
                {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="ios-label">Cliente</label>
              <select 
                className="ios-input"
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
              >
                <option value="">Selecione Cliente</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
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

        {/* Product */}
        <div className="ios-card p-6">
          <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Smartphone size={20} className="text-brand-500" />
            Produto
          </h3>
          {!selectedProduct ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {availableStock.map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelectedProduct(item)}
                  className="ios-card-hover p-4 text-left transition-all"
                >
                  <p className="font-bold text-gray-900 dark:text-white">{item.model}</p>
                  <p className="text-ios-body text-gray-500 dark:text-surface-dark-500">{item.capacity} • {item.color}</p>
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-brand-500 font-bold">R$ {item.sellPrice.toLocaleString('pt-BR')}</p>
                    <span className={`text-ios-footnote px-2 py-1 rounded-full ${item.condition === Condition.NEW ? 'bg-brand-100 text-brand-700' : 'bg-accent-100 text-accent-700'}`}>
                      {item.condition}
                    </span>
                  </div>
                </button>
              ))}
              {availableStock.length === 0 && (
                <p className="text-ios-body text-gray-500 col-span-2 text-center py-8">Sem estoque disponível.</p>
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
        <div className="ios-card p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white">Troca (Trade-In)</h3>
            {!tradeIn && (
              <button 
                onClick={() => setTradeIn({ model: '', value: 0, condition: 'Bom', storage: '' })} 
                className="text-brand-500 hover:text-brand-600 text-ios-subhead font-medium"
              >
                + Adicionar
              </button>
            )}
          </div>
          {tradeIn && (
            <div className="space-y-4 ios-card p-4 bg-gray-50 dark:bg-surface-dark-200">
              <div className="grid grid-cols-2 gap-4">
                <input 
                  type="text" 
                  placeholder="Modelo do aparelho" 
                  className="ios-input"
                  value={tradeIn.model}
                  onChange={(e) => setTradeIn({...tradeIn, model: e.target.value})}
                />
                <input 
                  type="text" 
                  placeholder="Armazenamento" 
                  className="ios-input"
                  value={tradeIn.storage}
                  onChange={(e) => setTradeIn({...tradeIn, storage: e.target.value})}
                />
              </div>
              <div className="flex gap-4">
                <input 
                  type="number" 
                  placeholder="Valor Avaliado" 
                  className="ios-input"
                  value={tradeIn.value || ''}
                  onChange={(e) => setTradeIn({...tradeIn, value: parseFloat(e.target.value) || 0})}
                />
                <button 
                  onClick={() => setTradeIn(null)} 
                  className="text-red-500 hover:text-red-600 px-4"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Card Fee Calculator */}
        <div className="ios-card p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white flex items-center gap-2">
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
      </div>

      {/* Right Panel: Totals */}
      <div className="ios-card p-6 flex flex-col h-full">
        <h3 className="text-ios-title-2 font-bold text-gray-900 dark:text-white mb-6">Resumo</h3>
        
        <div className="space-y-4 flex-1">
          <div className="flex justify-between text-gray-500 dark:text-surface-dark-500">
            <span className="text-ios-body">Subtotal</span>
            <span className="text-ios-body font-medium text-gray-900 dark:text-white">R$ {subtotal.toLocaleString('pt-BR')}</span>
          </div>
          {tradeIn && (
            <div className="flex justify-between text-green-600">
              <span className="text-ios-body">Desconto Troca</span>
              <span className="text-ios-body font-medium">- R$ {tradeInValue.toLocaleString('pt-BR')}</span>
            </div>
          )}
          <div className="border-t border-gray-200 dark:border-surface-dark-300 pt-4 flex justify-between items-center">
            <span className="text-ios-title-3 font-bold text-gray-900 dark:text-white">Total</span>
            <span className="text-ios-large font-bold text-brand-500">R$ {totalToPay.toLocaleString('pt-BR')}</span>
          </div>

          <div className="mt-8">
            <p className="text-ios-subhead font-medium text-gray-700 dark:text-surface-dark-700 mb-3">Forma de Pagamento</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {['Pix', 'Dinheiro', 'Cartão Crédito', 'Cartão Débito'].map(type => (
                <button
                  key={type}
                  disabled={remaining <= 0}
                  onClick={() => handleAddPayment(type as any, remaining)}
                  className="ios-button-secondary text-ios-footnote disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {payments.map((p, i) => (
                <div key={i} className="flex justify-between items-center ios-card p-3">
                  <span className="text-ios-subhead text-gray-600 dark:text-surface-dark-600">{p.type}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-ios-subhead font-medium text-gray-900 dark:text-white">R$ {p.amount.toLocaleString('pt-BR')}</span>
                    <button 
                      onClick={() => removePayment(i)}
                      className="text-red-500 hover:text-red-600"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-surface-dark-300">
          <div className="flex justify-between mb-4">
            <span className="text-gray-500 dark:text-surface-dark-500">Restante</span>
            <span className={`font-bold text-ios-title-3 ${remaining > 0 ? 'text-red-500' : 'text-green-600'}`}>
              R$ {remaining.toLocaleString('pt-BR')}
            </span>
          </div>
          
          <button
            disabled={remaining > 0 || !selectedProduct || !selectedClient || !selectedSeller}
            onClick={handleFinishSale}
            className="w-full ios-button-primary py-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!selectedSeller ? 'Selecione um Vendedor' : !selectedClient ? 'Selecione um Cliente' : !selectedProduct ? 'Selecione um Produto' : remaining > 0 ? 'Pagamento Pendente' : 'Finalizar Venda'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PDV;
