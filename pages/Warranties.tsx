import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../services/dataContext';
import { Sale } from '../types';
import { ShieldCheck, Search, ExternalLink, Printer, CheckCircle, XCircle, Smartphone, Copy } from 'lucide-react';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/ToastProvider';
import { supabase, supabaseAnonKey, supabaseUrl } from '../services/supabase';
import QRCode from 'qrcode';
import { formatWarrantyDevice } from '../utils/warrantyDevice';

const Warranties: React.FC = () => {
  const { sales, customers } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'active' | 'expired' | 'all'>('active');
  const [selectedWarranty, setSelectedWarranty] = useState<Sale | null>(null);
  const [publicLinkBySale, setPublicLinkBySale] = useState<Record<string, string>>({});
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState('');
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

  const fetchWarrantyLink = async (saleId: string) => {
    if (publicLinkBySale[saleId]) return publicLinkBySale[saleId];

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      throw new Error(sessionError.message || 'Nao foi possivel validar sua sessao.');
    }

    let accessToken = sessionData.session?.access_token;
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const expiresAt = sessionData.session?.expires_at ?? 0;

    if (!accessToken || expiresAt <= nowInSeconds + 30) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        throw new Error('Sessao expirada. Faca login novamente.');
      }
      accessToken = refreshed.session?.access_token;
    }

    if (!accessToken) {
      throw new Error('Sessao expirada. Faca login novamente.');
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Configuracao do Supabase ausente no frontend.');
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/warranty-link-create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ saleId })
    });

    const payload = await response.json().catch(() => null) as { publicUrl?: string; error?: string; message?: string } | null;
    if (!response.ok) {
      throw new Error(payload?.error || payload?.message || `Falha ao gerar link (${response.status}).`);
    }

    const link = payload?.publicUrl;
    if (!link) {
      throw new Error('Resposta invalida ao gerar link da garantia.');
    }

    setPublicLinkBySale((prev) => ({ ...prev, [saleId]: link }));
    return link;
  };

  const loadQrForSale = async (saleId: string) => {
    setQrLoading(true);
    setQrError('');
    setQrDataUrl('');
    try {
      const link = await fetchWarrantyLink(saleId);
      const generatedQr = await QRCode.toDataURL(link, {
        width: 320,
        margin: 1,
        errorCorrectionLevel: 'M'
      });
      setQrDataUrl(generatedQr);
    } catch (error: any) {
      setQrError(error?.message || 'Nao foi possivel gerar o QR Code da garantia.');
    } finally {
      setQrLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedWarranty) {
      setQrLoading(false);
      setQrError('');
      setQrDataUrl('');
      return;
    }
    void loadQrForSale(selectedWarranty.id);
  }, [selectedWarranty]);

  const handleCopyLink = async (saleId: string) => {
    try {
      const link = publicLinkBySale[saleId] || (await fetchWarrantyLink(saleId));
      await navigator.clipboard.writeText(link);
      toast.success('Link da garantia copiado.');
    } catch (error: any) {
      toast.error(error?.message || 'Nao foi possivel copiar o link.');
    }
  };

  return (
    <div className="space-y-5 md:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h2 className="text-[28px] md:text-ios-large font-bold text-gray-900 dark:text-white tracking-tight">Garantias</h2>
          <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-0.5">Prazos e certificados digitais</p>
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
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
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
          const mainItemDisplay = formatWarrantyDevice(mainItem);

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
                    <div className="flex items-start gap-2 text-ios-subhead text-gray-700 dark:text-surface-dark-700">
                      <Smartphone size={16} className="text-brand-500 mt-0.5" />
                      <div className="min-w-0">
                        <span className="block truncate">{mainItemDisplay.title}</span>
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-ios-footnote text-gray-500">
                          {mainItemDisplay.capacity && (
                            <span className="bg-gray-100 dark:bg-surface-dark-200 px-2 py-1 rounded-ios">{mainItemDisplay.capacity}</span>
                          )}
                          {mainItemDisplay.battery && (
                            <span className="bg-gray-100 dark:bg-surface-dark-200 px-2 py-1 rounded-ios">{mainItemDisplay.battery}🔋</span>
                          )}
                          <span className="bg-gray-100 dark:bg-surface-dark-200 px-2 py-1 rounded-ios">
                            IMEI: {mainItemDisplay.imei || '-'}
                          </span>
                        </div>
                      </div>
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
                    {selectedWarranty.items.map((item, idx) => {
                      const itemDisplay = formatWarrantyDevice(item);
                      return (
                        <div key={idx} className="bg-gray-50 p-3 rounded-ios-lg border border-gray-200">
                          <p className="font-bold text-gray-900">{itemDisplay.title}</p>
                          <div className="flex flex-wrap gap-2 mt-2 text-ios-footnote text-gray-600">
                            {itemDisplay.capacity && (
                              <span className="bg-white px-2 py-0.5 rounded-ios border border-gray-200">{itemDisplay.capacity}</span>
                            )}
                            {itemDisplay.battery && (
                              <span className="bg-white px-2 py-0.5 rounded-ios border border-gray-200">{itemDisplay.battery}🔋</span>
                            )}
                            <span className="bg-white px-2 py-0.5 rounded-ios border border-gray-200">IMEI: {itemDisplay.imei || '-'}</span>
                            <span className="text-ios-footnote font-medium text-brand-600 bg-brand-50 inline-block px-2 py-0.5 rounded-ios">
                              {item.condition}
                            </span>
                          </div>
                        </div>
                      );
                    })}
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
                {qrLoading && (
                  <div className="w-40 h-40 rounded-ios-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 text-sm">
                    Gerando QR Code...
                  </div>
                )}
                {!qrLoading && qrError && (
                  <div className="w-full max-w-md rounded-ios-lg border border-red-200 bg-red-50 text-red-600 text-sm px-4 py-3 text-center">
                    {qrError}
                  </div>
                )}
                {!qrLoading && !qrError && qrDataUrl && (
                  <img
                    src={qrDataUrl}
                    alt="QR Code da garantia"
                    className="w-40 h-40 rounded-ios-lg border border-gray-200 bg-white p-2"
                  />
                )}
                <p className="text-ios-footnote text-gray-400 text-center max-w-sm mt-4">
                  Escaneie para abrir sua garantia digital
                </p>
                {publicLinkBySale[selectedWarranty.id] && (
                  <p className="text-xs text-gray-500 mt-2 break-all text-center">
                    {publicLinkBySale[selectedWarranty.id]}
                  </p>
                )}
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
