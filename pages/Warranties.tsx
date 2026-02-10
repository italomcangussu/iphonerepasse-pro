import React, { useState, useMemo } from 'react';
import { useData } from '../services/dataContext';
import { Sale, StockItem } from '../types';
import { 
  ShieldCheck, Search, Clock, Calendar, 
  ExternalLink, Printer, Share2, CheckCircle, 
  XCircle, Smartphone, User, AlertCircle, X, Copy
} from 'lucide-react';

const Warranties: React.FC = () => {
  const { sales, customers } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'active' | 'expired' | 'all'>('active');
  const [selectedWarranty, setSelectedWarranty] = useState<Sale | null>(null);

  // Helper: Calculate days remaining and progress
  const getWarrantyStatus = (saleDate: string, expiryDate: string) => {
    const start = new Date(saleDate).getTime();
    const end = new Date(expiryDate).getTime();
    const now = new Date().getTime();
    
    const totalDuration = end - start;
    const elapsed = now - start;
    const remaining = end - now;
    
    const daysRemaining = Math.ceil(remaining / (1000 * 60 * 60 * 24));
    const percentElapsed = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    const isExpired = now > end;

    return { daysRemaining, percentElapsed, isExpired };
  };

  const filteredWarranties = useMemo(() => {
    return sales
      .filter(sale => {
        const customer = customers.find(c => c.id === sale.customerId);
        const searchString = searchTerm.toLowerCase();
        
        const matchesSearch = 
          customer?.name.toLowerCase().includes(searchString) ||
          sale.items.some(item => item.model.toLowerCase().includes(searchString) || item.imei.toLowerCase().includes(searchString)) ||
          sale.id.toLowerCase().includes(searchString);

        const { isExpired } = getWarrantyStatus(sale.date, sale.warrantyExpiresAt);
        
        const matchesFilter = 
          filterStatus === 'all' ? true :
          filterStatus === 'active' ? !isExpired :
          isExpired;

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Newest first
  }, [sales, customers, searchTerm, filterStatus]);

  const handleCopyLink = (saleId: string) => {
    const fakeUrl = `https://iphonerepasse.app/garantia/${saleId}`;
    navigator.clipboard.writeText(fakeUrl);
    alert('Link da garantia copiado para a área de transferência!');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Controle de Garantias</h2>
          <p className="text-slate-400">Gerencie prazos e certificados digitais</p>
        </div>
        
        <div className="flex bg-dark-800 p-1 rounded-xl border border-dark-700">
          <button 
            onClick={() => setFilterStatus('active')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filterStatus === 'active' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            Ativas
          </button>
          <button 
            onClick={() => setFilterStatus('expired')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filterStatus === 'expired' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            Expiradas
          </button>
          <button 
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filterStatus === 'all' ? 'bg-dark-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Todas
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
        <input 
          type="text" 
          placeholder="Buscar por cliente, modelo ou IMEI..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-dark-800 border border-dark-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-primary-500 transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredWarranties.map(sale => {
          const customer = customers.find(c => c.id === sale.customerId);
          const { daysRemaining, percentElapsed, isExpired } = getWarrantyStatus(sale.date, sale.warrantyExpiresAt);
          const mainItem = sale.items[0];

          return (
            <div key={sale.id} className="bg-dark-800 rounded-2xl border border-dark-700 overflow-hidden group hover:border-primary-500/50 transition-all">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isExpired ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm truncate max-w-[150px]">{customer?.name || 'Cliente Desconhecido'}</p>
                      <p className="text-xs text-slate-500">Venda #{sale.id.slice(-4).toUpperCase()}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${isExpired ? 'bg-dark-700 text-slate-400' : 'bg-green-500 text-white'}`}>
                    {isExpired ? 'Expirada' : 'Ativa'}
                  </span>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Smartphone size={16} className="text-primary-500" />
                    <span className="truncate">{mainItem.model} ({mainItem.capacity})</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="bg-dark-900 px-2 py-1 rounded border border-dark-600">IMEI: {mainItem.imei}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Tempo de Cobertura</span>
                    <span className={isExpired ? 'text-red-400' : 'text-white'}>
                      {isExpired ? 'Finalizado' : `${daysRemaining} dias restantes`}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-dark-900 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${
                        isExpired ? 'bg-red-500' : 
                        percentElapsed > 80 ? 'bg-orange-500' : 
                        'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(100, percentElapsed)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                    <span>{new Date(sale.date).toLocaleDateString()}</span>
                    <span>{new Date(sale.warrantyExpiresAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedWarranty(sale)}
                  className="w-full mt-4 bg-dark-700 hover:bg-dark-600 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink size={16} />
                  Ver Certificado
                </button>
              </div>
            </div>
          );
        })}
        {filteredWarranties.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500">
            <AlertCircle size={48} className="mx-auto mb-4 opacity-50" />
            <p>Nenhuma garantia encontrada com os filtros atuais.</p>
          </div>
        )}
      </div>

      {/* CERTIFICATE MODAL */}
      {selectedWarranty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden relative text-slate-900">
            {/* Modal Header Actions */}
            <div className="absolute top-4 right-4 flex gap-2 no-print">
              <button 
                onClick={() => handleCopyLink(selectedWarranty.id)}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 transition-colors"
                title="Copiar Link Público"
              >
                <Copy size={20} />
              </button>
              <button 
                onClick={handlePrint}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 transition-colors"
                title="Imprimir"
              >
                <Printer size={20} />
              </button>
              <button 
                onClick={() => setSelectedWarranty(null)}
                className="p-2 bg-red-100 hover:bg-red-200 rounded-full text-red-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Certificate Content */}
            <div className="p-8 md:p-12 print-content">
              {/* Header */}
              <div className="text-center border-b-2 border-slate-100 pb-8 mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 text-white rounded-2xl mb-4 shadow-lg shadow-blue-200">
                  <ShieldCheck size={32} />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 uppercase tracking-wide">Certificado de Garantia</h2>
                <p className="text-slate-500 mt-2">iPhoneRepasse Store</p>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">Documento Oficial #{selectedWarranty.id.slice(-6).toUpperCase()}</p>
              </div>

              {/* Status Banner */}
              {(() => {
                 const status = getWarrantyStatus(selectedWarranty.date, selectedWarranty.warrantyExpiresAt);
                 return (
                   <div className={`rounded-xl p-4 mb-8 flex items-center gap-4 ${status.isExpired ? 'bg-red-50 border border-red-100' : 'bg-green-50 border border-green-100'}`}>
                     {status.isExpired ? <XCircle className="text-red-500" size={32} /> : <CheckCircle className="text-green-500" size={32} />}
                     <div>
                       <p className={`font-bold text-lg ${status.isExpired ? 'text-red-700' : 'text-green-700'}`}>
                         {status.isExpired ? 'GARANTIA EXPIRADA' : 'GARANTIA ATIVA'}
                       </p>
                       <p className="text-sm text-slate-600">
                         {status.isExpired 
                           ? `Expirou em ${new Date(selectedWarranty.warrantyExpiresAt).toLocaleDateString()}` 
                           : `Válida até ${new Date(selectedWarranty.warrantyExpiresAt).toLocaleDateString()} (${status.daysRemaining} dias restantes)`}
                       </p>
                     </div>
                   </div>
                 );
              })()}

              {/* Grid Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                 <div>
                   <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Dados do Aparelho</h4>
                   <div className="space-y-3">
                     {selectedWarranty.items.map((item, idx) => (
                       <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                         <p className="font-bold text-slate-800">{item.model}</p>
                         <p className="text-sm text-slate-600">{item.capacity} • {item.color}</p>
                         <p className="text-xs font-mono text-slate-500 mt-1">IMEI: {item.imei}</p>
                         <p className="text-xs font-medium text-blue-600 mt-1 bg-blue-50 inline-block px-2 py-0.5 rounded">
                           Estado: {item.condition}
                         </p>
                       </div>
                     ))}
                   </div>
                 </div>

                 <div>
                   <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Dados da Compra</h4>
                   <div className="space-y-3">
                     <div className="flex justify-between border-b border-slate-100 pb-2">
                       <span className="text-slate-500 text-sm">Cliente</span>
                       <span className="font-medium text-slate-800">
                         {customers.find(c => c.id === selectedWarranty.customerId)?.name}
                       </span>
                     </div>
                     <div className="flex justify-between border-b border-slate-100 pb-2">
                       <span className="text-slate-500 text-sm">Data da Venda</span>
                       <span className="font-medium text-slate-800">
                         {new Date(selectedWarranty.date).toLocaleDateString()}
                       </span>
                     </div>
                     <div className="flex justify-between border-b border-slate-100 pb-2">
                       <span className="text-slate-500 text-sm">Pagamento</span>
                       <span className="font-medium text-slate-800">
                         {selectedWarranty.paymentMethods.map(p => p.type).join(', ')}
                       </span>
                     </div>
                   </div>
                 </div>
              </div>

              {/* QR Code Simulation */}
              <div className="flex flex-col items-center justify-center border-t-2 border-slate-100 pt-8">
                <div className="w-32 h-32 bg-white border-2 border-slate-800 p-2 mb-4">
                  <div className="w-full h-full bg-slate-900 pattern-grid-lg opacity-90 flex items-center justify-center text-white text-xs text-center p-1">
                    [QR CODE]<br/>iphonerepasse.app
                  </div>
                </div>
                <p className="text-xs text-slate-400 text-center max-w-sm">
                  Escaneie este código para verificar a autenticidade da garantia e ver os termos de cobertura completos.
                </p>
              </div>

              <div className="mt-8 text-center text-[10px] text-slate-400">
                <p>iPhoneRepasse - Soluções em Apple</p>
                <p>Garantia cobre defeitos de fabricação e hardware. Não cobre danos por líquidos ou quedas.</p>
              </div>
            </div>
            
            {/* Modal Footer Action */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 text-center no-print">
               <button 
                 onClick={() => handleCopyLink(selectedWarranty.id)}
                 className="text-blue-600 font-medium text-sm hover:underline flex items-center justify-center gap-2"
               >
                 <Share2 size={16} /> Enviar Link para Cliente
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Warranties;