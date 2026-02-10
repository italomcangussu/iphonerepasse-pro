import React, { useState } from 'react';
import { useData } from '../services/dataContext';
import { StockStatus, StockItem, PaymentMethod, Sale, WarrantyType, Condition } from '../types';
import { Search, ShoppingCart, User, Smartphone, CreditCard, Printer, CheckCircle, ShieldCheck, Lock, Calendar, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PDV: React.FC = () => {
  const { stock, customers, sellers, addSale } = useData();
  const navigate = useNavigate();
  
  // State
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Select Items/Client, 2: Payment, 3: Success
  const [selectedSeller, setSelectedSeller] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<StockItem | null>(null);
  const [tradeIn, setTradeIn] = useState<{ model: string; value: number } | null>(null);
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [lastSale, setLastSale] = useState<Sale | null>(null);

  // Warranty State
  const [showWarrantyModal, setShowWarrantyModal] = useState(false);
  const [warrantyPassword, setWarrantyPassword] = useState('');
  const [isWarrantyAuthenticated, setIsWarrantyAuthenticated] = useState(false);
  const [customWarrantyMonths, setCustomWarrantyMonths] = useState(6);
  const [warrantyApplied, setWarrantyApplied] = useState(false);

  const availableStock = stock.filter(s => s.status === StockStatus.AVAILABLE);

  // Computed
  const subtotal = selectedProduct ? selectedProduct.sellPrice : 0;
  const tradeInValue = tradeIn ? tradeIn.value : 0;
  const totalToPay = Math.max(0, subtotal - tradeInValue);
  const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
  const remaining = totalToPay - totalPaid;

  const handleAddPayment = (type: PaymentMethod['type'], amount: number) => {
    if (amount <= 0) return;
    setPayments([...payments, { type, amount }]);
  };

  const handleOpenWarranty = () => {
    setWarrantyPassword('');
    setIsWarrantyAuthenticated(false);
    setShowWarrantyModal(true);
  };

  const handleVerifyPassword = () => {
    if (warrantyPassword === '0305') {
      setIsWarrantyAuthenticated(true);
    } else {
      alert('Senha incorreta');
      setWarrantyPassword('');
    }
  };

  const handleApplyWarranty = () => {
    setWarrantyApplied(true);
    setShowWarrantyModal(false);
  };

  const getWarrantyDate = () => {
    const months = warrantyApplied ? customWarrantyMonths : 3; // 3 months (90 days) default
    const date = new Date();
    date.setMonth(date.getMonth() + months);
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
        capacity: 'N/A',
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

  // Reset Warranty when product changes
  React.useEffect(() => {
    setWarrantyApplied(false);
    setCustomWarrantyMonths(6);
  }, [selectedProduct]);

  if (step === 3 && lastSale) {
    const warrantyDuration = Math.round((new Date(lastSale.warrantyExpiresAt).getTime() - new Date(lastSale.date).getTime()) / (1000 * 60 * 60 * 24 * 30));
    
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white mb-4 shadow-lg shadow-green-500/30">
          <CheckCircle size={40} />
        </div>
        <h2 className="text-3xl font-bold text-white">Venda Realizada!</h2>
        <p className="text-slate-400">A venda foi registrada e o estoque atualizado.</p>
        
        <div className="flex gap-4 mt-8 no-print">
          <button 
            onClick={printReceipt}
            className="flex items-center gap-2 bg-dark-700 hover:bg-dark-600 px-6 py-3 rounded-xl text-white font-medium"
          >
            <Printer size={20} />
            Imprimir Comprovante
          </button>
          <button 
            onClick={() => window.location.reload()}
            className="bg-primary-600 hover:bg-primary-500 px-6 py-3 rounded-xl text-white font-medium"
          >
            Nova Venda
          </button>
        </div>

        {/* Printable Area - Hidden in CSS, Visible on Print */}
        <div id="receipt-content" className="hidden print-only text-left font-mono text-black p-4 border max-w-[80mm] mx-auto">
          <div className="text-center mb-4 border-b pb-2">
            <h1 className="font-bold text-xl uppercase">iPhone Repasse</h1>
            <p className="text-sm">Rua Exemplo, 123 - Centro</p>
            <p className="text-sm">CNPJ: 00.000.000/0001-00</p>
          </div>
          
          <div className="mb-4">
            <p className="font-bold">VENDA #{lastSale.id.slice(-4).toUpperCase()}</p>
            <p className="text-sm">{new Date(lastSale.date).toLocaleString()}</p>
            <p className="text-sm">Cliente: {customers.find(c => c.id === lastSale.customerId)?.name}</p>
          </div>

          <div className="border-b pb-2 mb-2">
            {lastSale.items.map((item, idx) => (
               <div key={idx} className="mb-1">
                 <p className="font-bold">{item.model} {item.capacity}</p>
                 <div className="flex justify-between text-sm">
                   <span>1 x R$ {item.sellPrice.toLocaleString()}</span>
                   <span>R$ {item.sellPrice.toLocaleString()}</span>
                 </div>
               </div>
            ))}
          </div>

          {lastSale.tradeIn && (
            <div className="flex justify-between text-sm mb-1">
              <span>(-) Trade-In ({lastSale.tradeIn.model})</span>
              <span>R$ {lastSale.tradeInValue.toLocaleString()}</span>
            </div>
          )}

          <div className="border-t pt-2 mt-2 font-bold text-lg flex justify-between">
            <span>TOTAL A PAGAR</span>
            <span>R$ {lastSale.total.toLocaleString()}</span>
          </div>

          <div className="mt-4 border-t pt-2 text-sm">
            <p>Formas de Pagamento:</p>
            {lastSale.paymentMethods.map((pm, i) => (
              <div key={i} className="flex justify-between">
                <span>{pm.type}</span>
                <span>R$ {pm.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
          
          <div className="mt-8 text-center text-xs">
            <p className="font-bold">Garantia de {warrantyDuration} meses</p>
            <p>Vencimento: {new Date(lastSale.warrantyExpiresAt).toLocaleDateString()}</p>
            <p className="mt-2">Obrigado pela preferência!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-100px)] relative">
      {/* Left Panel: Selection */}
      <div className="lg:col-span-2 space-y-6 overflow-y-auto pr-2">
        <div className="bg-dark-800 p-6 rounded-2xl border border-dark-700">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <User size={20} className="text-primary-500" />
            Vendedor e Cliente
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <select 
               className="bg-dark-900 border border-dark-600 rounded-xl p-3 text-white"
               value={selectedSeller}
               onChange={(e) => setSelectedSeller(e.target.value)}
             >
               <option value="">Selecione Vendedor</option>
               {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
             </select>
             <select 
               className="bg-dark-900 border border-dark-600 rounded-xl p-3 text-white"
               value={selectedClient}
               onChange={(e) => setSelectedClient(e.target.value)}
             >
               <option value="">Selecione Cliente</option>
               {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
             </select>
          </div>
        </div>

        <div className="bg-dark-800 p-6 rounded-2xl border border-dark-700">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Smartphone size={20} className="text-primary-500" />
            Produto
          </h3>
          {!selectedProduct ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {availableStock.map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelectedProduct(item)}
                  className="bg-dark-900 p-4 rounded-xl border border-dark-600 hover:border-primary-500 text-left transition-all"
                >
                  <p className="font-bold text-white">{item.model}</p>
                  <p className="text-sm text-slate-400">{item.capacity} • {item.color}</p>
                  <div className="flex justify-between items-center mt-2">
                     <p className="text-primary-500 font-bold">R$ {item.sellPrice.toLocaleString()}</p>
                     <span className={`text-xs px-2 py-0.5 rounded ${item.condition === Condition.NEW ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
                       {item.condition}
                     </span>
                  </div>
                </button>
              ))}
              {availableStock.length === 0 && <p className="text-slate-500">Sem estoque disponível.</p>}
            </div>
          ) : (
            <div className="bg-dark-900 p-4 rounded-xl border border-primary-500/50">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="font-bold text-white text-lg">{selectedProduct.model}</p>
                  <p className="text-slate-400">{selectedProduct.capacity} • {selectedProduct.color}</p>
                </div>
                <button onClick={() => setSelectedProduct(null)} className="text-red-400 hover:text-red-300 text-sm">Remover</button>
              </div>
              
              {/* Extended Warranty Option for Used Phones */}
              {selectedProduct.condition === Condition.USED && (
                <div className="mt-4 pt-4 border-t border-dark-700 flex justify-between items-center">
                   <div className="flex items-center gap-2 text-sm text-slate-300">
                      <ShieldCheck size={18} className={warrantyApplied ? "text-green-500" : "text-slate-500"} />
                      <span>
                        {warrantyApplied 
                          ? `Garantia Estendida: ${customWarrantyMonths} Meses`
                          : "Garantia Padrão: 90 Dias"}
                      </span>
                   </div>
                   <button 
                     onClick={handleOpenWarranty}
                     className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                       warrantyApplied 
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                        : 'bg-dark-700 text-slate-300 hover:text-white hover:bg-dark-600'
                     }`}
                   >
                     {warrantyApplied ? 'Alterar Garantia' : 'Estender Garantia'}
                   </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Trade In Section */}
        <div className="bg-dark-800 p-6 rounded-2xl border border-dark-700">
           <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">Troca (Trade-In)</h3>
              {!tradeIn && (
                 <button onClick={() => setTradeIn({ model: '', value: 0 })} className="text-sm text-primary-500 hover:underline">+ Adicionar</button>
              )}
           </div>
           {tradeIn && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-dark-900 p-4 rounded-xl">
               <input 
                 type="text" 
                 placeholder="Modelo do aparelho" 
                 className="bg-dark-800 border border-dark-600 rounded-lg p-2 text-white"
                 value={tradeIn.model}
                 onChange={(e) => setTradeIn({...tradeIn, model: e.target.value})}
               />
               <input 
                 type="number" 
                 placeholder="Valor Avaliado" 
                 className="bg-dark-800 border border-dark-600 rounded-lg p-2 text-white"
                 value={tradeIn.value || ''}
                 onChange={(e) => setTradeIn({...tradeIn, value: parseFloat(e.target.value)})}
               />
               <button onClick={() => setTradeIn(null)} className="text-red-400 text-xs md:col-span-2 text-right">Remover Troca</button>
             </div>
           )}
        </div>
      </div>

      {/* Right Panel: Totals & Payment */}
      <div className="bg-dark-800 p-6 rounded-2xl border border-dark-700 flex flex-col h-full">
        <h3 className="text-xl font-bold text-white mb-6">Resumo</h3>
        
        <div className="space-y-4 flex-1">
          <div className="flex justify-between text-slate-400">
            <span>Subtotal</span>
            <span className="text-white">R$ {subtotal.toLocaleString()}</span>
          </div>
          {tradeIn && (
            <div className="flex justify-between text-green-400">
              <span>Desconto Troca</span>
              <span>- R$ {tradeInValue.toLocaleString()}</span>
            </div>
          )}
          <div className="border-t border-dark-600 pt-4 flex justify-between items-center">
            <span className="text-lg font-bold text-white">Total a Pagar</span>
            <span className="text-2xl font-bold text-primary-500">R$ {totalToPay.toLocaleString()}</span>
          </div>

          <div className="mt-8">
            <p className="text-sm font-medium text-slate-300 mb-2">Adicionar Pagamento</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {['Pix', 'Dinheiro', 'Cartão Crédito', 'Cartão Débito'].map(type => (
                <button
                  key={type}
                  disabled={remaining <= 0}
                  onClick={() => handleAddPayment(type as any, remaining)}
                  className="bg-dark-700 hover:bg-dark-600 p-2 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50"
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {payments.map((p, i) => (
                <div key={i} className="flex justify-between bg-dark-900 p-2 rounded text-sm">
                  <span className="text-slate-300">{p.type}</span>
                  <span className="text-white font-medium">R$ {p.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-dark-600">
           <div className="flex justify-between mb-4">
             <span className="text-slate-400">Restante</span>
             <span className={`font-bold ${remaining > 0 ? 'text-red-400' : 'text-green-500'}`}>R$ {remaining.toLocaleString()}</span>
           </div>
           
           <button 
             disabled={remaining > 0 || !selectedProduct}
             onClick={handleFinishSale}
             className="w-full bg-primary-600 hover:bg-primary-500 disabled:bg-dark-700 disabled:text-slate-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-primary-500/20 disabled:shadow-none"
           >
             Finalizar Venda
           </button>
        </div>
      </div>

      {/* Warranty Modal */}
      {showWarrantyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-dark-900 w-full max-w-sm rounded-2xl border border-dark-700 shadow-2xl">
            <div className="p-6 border-b border-dark-700 flex justify-between items-center bg-dark-800 rounded-t-2xl">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="text-primary-500" size={20} />
                Garantia Estendida
              </h3>
              <button onClick={() => setShowWarrantyModal(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            
            <div className="p-6">
              {!isWarrantyAuthenticated ? (
                <div className="space-y-4">
                   <p className="text-slate-400 text-sm">Insira a senha de vendedor/gerente para alterar o tempo de garantia.</p>
                   <div>
                     <label className="block text-sm font-medium text-slate-300 mb-1">Senha de Acesso</label>
                     <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input 
                          type="password" 
                          autoFocus
                          className="w-full bg-dark-800 border border-dark-600 rounded-lg p-2.5 pl-10 text-white outline-none focus:border-primary-500"
                          value={warrantyPassword}
                          onChange={(e) => setWarrantyPassword(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                        />
                     </div>
                   </div>
                   <button 
                     onClick={handleVerifyPassword}
                     className="w-full bg-primary-600 hover:bg-primary-500 text-white font-bold py-2.5 rounded-xl transition-colors"
                   >
                     Autenticar
                   </button>
                </div>
              ) : (
                <div className="space-y-4">
                   <p className="text-slate-400 text-sm">Selecione o tempo total de garantia para este aparelho seminovo.</p>
                   <div>
                     <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                       <Calendar size={16} /> Tempo de Garantia
                     </label>
                     <div className="grid grid-cols-4 gap-2">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                          <button
                            key={m}
                            onClick={() => setCustomWarrantyMonths(m)}
                            className={`py-2 rounded-lg text-sm font-bold transition-all ${
                              customWarrantyMonths === m 
                                ? 'bg-primary-600 text-white ring-2 ring-primary-500 ring-offset-2 ring-offset-dark-900' 
                                : 'bg-dark-800 border border-dark-600 text-slate-400 hover:text-white hover:border-slate-500'
                            }`}
                          >
                            {m}M
                          </button>
                        ))}
                     </div>
                   </div>
                   <div className="pt-2">
                     <button 
                       onClick={handleApplyWarranty}
                       className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2.5 rounded-xl transition-colors shadow-lg shadow-green-500/20"
                     >
                       Confirmar Garantia ({customWarrantyMonths} Meses)
                     </button>
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDV;