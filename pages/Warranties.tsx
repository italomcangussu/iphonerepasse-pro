import React, { useState, useMemo } from 'react';
import { useData } from '../services/dataContext';
import { Sale } from '../types';
import { ShieldCheck, Search, Clock, Calendar, ExternalLink, Printer, CheckCircle, XCircle, Smartphone, Copy, QrCode } from 'lucide-react';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/ToastProvider';

const Warranties: React.FC = () => {
  const { sales, customers } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'active' | 'expired' | 'all'>('active');
  const [selectedWarranty, setSelectedWarranty] = useState<Sale | null>(null);
  const toast = useToast();

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
          sale.items.some(item => item.model.toLowerCase().includes(searchString) || item.imei.toLowerCase().includes(searchString));

        const { isExpired } = getWarrantyStatus(sale.date, sale.warrantyExpiresAt);
        
        const matchesFilter = 
          filterStatus === 'all' ? true :
          filterStatus === 'active' ? !isExpired :
          isExpired;

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, customers, searchTerm, filterStatus]);

  const handleCopyLink = async (saleId: string) => {
    const url = `${window.location.origin}/#/garantia/${saleId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link da garantia copiado.');
    } catch {
      toast.error('Nao foi possivel copiar o link.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-ios-large font-bold text-gray-900 dark:text-white">Controle de Garantias</h2>
          <p className="text-ios-body text-gray-500 dark:text-surface-dark-500">Gerencie prazos e certificados digitais</p>
        </div>
        
        <div className="flex bg-white dark:bg-surface-dark-100 p-1 rounded-ios-lg border border-gray-200 dark:border-surface-dark-200 shadow-ios">
          {[
            { id: 'active', label: 'Ativas', color: 'bg-green-500' },
            { id: 'expired', label: 'Expiradas', color: 'bg-red-500' },
            { id: 'all', label: 'Todas', color: 'bg-gray-500' },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setFilterStatus(tab.id as any)}
              className={`px-4 py-2 rounded-ios text-ios-subhead font-medium transition-all ${
                filterStatus === tab.id 
                  ? `${tab.color} text-white shadow-ios` 
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Buscar por cliente, modelo ou IMEI..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="ios-input pl-10"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredWarranties.map(sale => {
          const customer = customers.find(c => c.id === sale.customerId);
          const { daysRemaining, percentElapsed, isExpired } = getWarrantyStatus(sale.date, sale.warrantyExpiresAt);
          const mainItem = sale.items[0];

          return (
            <div key={sale.id} className="ios-card-hover overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isExpired ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <p className="text-ios-subhead font-bold text-gray-900 dark:text-white truncate max-w-[150px]">{customer?.name}</p>
                      <p className="text-ios-footnote text-gray-500">Venda #{sale.id.slice(-4).toUpperCase()}</p>
                    </div>
                  </div>
                  <span className={`ios-badge ${isExpired ? 'bg-gray-100 text-gray-600' : 'bg-green-500 text-white'}`}>
                    {isExpired ? 'Expirada' : 'Ativa'}
                  </span>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 text-ios-subhead text-gray-700 dark:text-surface-dark-700">
                    <Smartphone size={16} className="text-brand-500" />
                    <span className="truncate">{mainItem.model} ({mainItem.capacity})</span>
                  </div>
                  <div className="flex items-center gap-2 text-ios-footnote text-gray-500">
                    <span className="bg-gray-100 dark:bg-surface-dark-200 px-2 py-1 rounded-ios">IMEI: {mainItem.imei}</span>
                  </div>
                </div>

                <div className="mb-2">
                  <div className="flex justify-between text-ios-footnote mb-1">
                    <span className="text-gray-500">Tempo de Cobertura</span>
                    <span className={isExpired ? 'text-red-500' : 'text-gray-900 dark:text-white'}>
                      {isExpired ? 'Finalizado' : `${daysRemaining} dias restantes`}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-surface-dark-300 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${isExpired ? 'bg-red-500' : percentElapsed > 80 ? 'bg-orange-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(100, percentElapsed)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-ios-footnote text-gray-400 mt-1">
                    <span>{new Date(sale.date).toLocaleDateString('pt-BR')}</span>
                    <span>{new Date(sale.warrantyExpiresAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedWarranty(sale)}
                  className="w-full mt-4 ios-button-secondary"
                >
                  <ExternalLink size={16} className="inline mr-2" />
                  Ver Certificado
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={!!selectedWarranty}
        onClose={() => setSelectedWarranty(null)}
        title="Certificado de Garantia"
        size="lg"
      >
        {selectedWarranty && (
          <div className="print-content space-y-6">
            <div className="flex justify-end gap-2 no-print">
              <button
                type="button"
                onClick={() => handleCopyLink(selectedWarranty.id)}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
                title="Copiar link"
              >
                <Copy size={20} />
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
                title="Imprimir"
              >
                <Printer size={20} />
              </button>
            </div>

            <div className="p-4 md:p-6">
              <div className="text-center border-b-2 border-gray-200 pb-8 mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-500 text-white rounded-ios-xl mb-4 shadow-ios-lg">
                  <ShieldCheck size={32} />
                </div>
                <h2 className="text-ios-large font-bold text-gray-900 uppercase tracking-wide">Certificado de Garantia</h2>
                <p className="text-gray-500 mt-2">iPhoneRepasse Store</p>
                <p className="text-ios-footnote text-gray-400 mt-1 uppercase tracking-widest">#{selectedWarranty.id.slice(-6).toUpperCase()}</p>
              </div>

              {(() => {
                const status = getWarrantyStatus(selectedWarranty.date, selectedWarranty.warrantyExpiresAt);
                return (
                  <div className={`rounded-ios-xl p-4 mb-8 flex items-center gap-4 ${status.isExpired ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                    {status.isExpired ? <XCircle className="text-red-500" size={32} /> : <CheckCircle className="text-green-500" size={32} />}
                    <div>
                      <p className={`font-bold text-ios-title-3 ${status.isExpired ? 'text-red-700' : 'text-green-700'}`}>
                        {status.isExpired ? 'GARANTIA EXPIRADA' : 'GARANTIA ATIVA'}
                      </p>
                      <p className="text-ios-subhead text-gray-600">
                        {status.isExpired 
                          ? `Expirou em ${new Date(selectedWarranty.warrantyExpiresAt).toLocaleDateString('pt-BR')}` 
                          : `Válida até ${new Date(selectedWarranty.warrantyExpiresAt).toLocaleDateString('pt-BR')} (${status.daysRemaining} dias)`}
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h4 className="text-ios-footnote font-bold text-gray-500 uppercase tracking-wider mb-3">Dados do Aparelho</h4>
                  <div className="space-y-3">
                    {selectedWarranty.items.map((item, idx) => (
                      <div key={idx} className="bg-gray-50 p-3 rounded-ios-lg border border-gray-200">
                        <p className="font-bold text-gray-900">{item.model}</p>
                        <p className="text-ios-subhead text-gray-600">{item.capacity} • {item.color}</p>
                        <p className="text-ios-footnote text-gray-500 mt-1">IMEI: {item.imei}</p>
                        <p className="text-ios-footnote font-medium text-brand-600 mt-1 bg-brand-50 inline-block px-2 py-0.5 rounded-ios">
                          {item.condition}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-ios-footnote font-bold text-gray-500 uppercase tracking-wider mb-3">Dados da Compra</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between border-b border-gray-200 pb-2">
                      <span className="text-gray-500 text-ios-subhead">Cliente</span>
                      <span className="font-medium text-gray-900">
                        {customers.find(c => c.id === selectedWarranty.customerId)?.name}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 pb-2">
                      <span className="text-gray-500 text-ios-subhead">Data</span>
                      <span className="font-medium text-gray-900">
                        {new Date(selectedWarranty.date).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 pb-2">
                      <span className="text-gray-500 text-ios-subhead">Pagamento</span>
                      <span className="font-medium text-gray-900">
                        {selectedWarranty.paymentMethods.map(p => p.type).join(', ')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center border-t-2 border-gray-200 pt-8">
                <div className="w-32 h-32 bg-white border-2 border-gray-900 p-2 mb-4 rounded-ios-lg">
                  <div className="w-full h-full bg-gray-900 flex items-center justify-center text-white text-xs text-center p-1 rounded">
                    <QrCode size={80} />
                  </div>
                </div>
                <p className="text-ios-footnote text-gray-400 text-center max-w-sm">
                  Escaneie para verificar a autenticidade da garantia
                </p>
              </div>

              <div className="mt-8 text-center text-ios-footnote text-gray-400">
                <p>iPhoneRepasse - Soluções em Apple</p>
                <p>Garantia cobre defeitos de fabricação e hardware.</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Warranties;
