import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, ShieldCheck, Smartphone, XCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { PublicWarrantyLookupView, PublicWarrantyView } from '../types';
import { supabase } from '../services/supabase';
import { formatWarrantyDevice } from '../utils/warrantyDevice';

const formatDate = (value?: string) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR');
};

const onlyDigits = (value?: string) => (value || '').replace(/\D/g, '');

const getStatusMeta = (status: 'active' | 'expired') =>
  status === 'active'
    ? {
        title: 'GARANTIA ATIVA',
        style: 'text-green-700 bg-green-50 border-green-200',
        icon: <CheckCircle className="text-green-500" size={24} />
      }
    : {
        title: 'GARANTIA EXPIRADA',
        style: 'text-red-700 bg-red-50 border-red-200',
        icon: <XCircle className="text-red-500" size={24} />
      };

const sortWarranties = (items: PublicWarrantyView[]) =>
  [...items].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    return new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime();
  });

const PublicWarranty: React.FC = () => {
  const { token, cpf } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warranty, setWarranty] = useState<PublicWarrantyView | null>(null);
  const [lookup, setLookup] = useState<PublicWarrantyLookupView | null>(null);

  useEffect(() => {
    const loadWarranty = async () => {
      const rawCpf = cpf || '';
      const cpfDigits = onlyDigits(rawCpf);
      const isCpfLookup = rawCpf.length > 0;

      if (!isCpfLookup && !token) {
        setError('Link de garantia inválido.');
        setLoading(false);
        return;
      }

      if (isCpfLookup && cpfDigits.length !== 11) {
        setError('CPF inválido.');
        setLoading(false);
        return;
      }

      try {
        const payloadBody = isCpfLookup ? { cpf: cpfDigits } : { token };
        const { data, error: invokeError } = await supabase.functions.invoke('warranty-public', {
          body: payloadBody
        });

        if (invokeError) throw new Error(invokeError.message || 'Falha ao consultar garantia.');

        if (isCpfLookup) {
          const payload = (data as { lookup?: PublicWarrantyLookupView } | null)?.lookup;
          if (!payload) throw new Error('Garantias não encontradas.');
          setLookup({ ...payload, warranties: sortWarranties(payload.warranties || []) });
          setWarranty(null);
          return;
        }

        const tokenWarranty = (data as { warranty?: PublicWarrantyView } | null)?.warranty;
        if (!tokenWarranty) throw new Error('Garantia não encontrada.');
        setWarranty(tokenWarranty);
        setLookup(null);
      } catch (err: any) {
        setError(err?.message || 'Não foi possível carregar a garantia.');
      } finally {
        setLoading(false);
      }
    };

    void loadWarranty();
  }, [token, cpf]);

  const warrantyStatusMeta = useMemo(() => {
    if (!warranty) return null;
    return getStatusMeta(warranty.status);
  }, [warranty]);

  return (
    <div className="min-h-screen bg-surface-light-100 dark:bg-surface-dark-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto ios-card p-5 md:p-8">
        {loading && (
          <div className="text-center py-20 text-gray-500">
            <p>Carregando garantia...</p>
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-10">
            <XCircle className="mx-auto text-red-500 mb-3" size={36} />
            <p className="text-gray-700 dark:text-surface-dark-700 font-semibold">{error}</p>
          </div>
        )}

        {!loading && !error && lookup && (
          <div className="space-y-6">
            <div className="text-center border-b border-gray-200 dark:border-surface-dark-300 pb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-ios-lg bg-brand-500 text-white mb-3">
                <ShieldCheck size={28} />
              </div>
              <h1 className="text-ios-title-2 font-bold text-gray-900 dark:text-white">Garantias do Cliente</h1>
              <p className="text-gray-500 mt-1">{lookup.customerName}</p>
              <p className="text-ios-footnote text-gray-400 mt-1">{lookup.cpfMasked}</p>
            </div>

            {lookup.warranties.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>Nenhuma garantia encontrada para este CPF.</p>
              </div>
            )}

            {lookup.warranties.length > 0 && (
              <div className="space-y-4">
                {lookup.warranties.map((item) => {
                  const statusMeta = getStatusMeta(item.status);
                  return (
                    <div key={item.certificateId} className="ios-card p-4 md:p-5 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-gray-900 dark:text-white font-bold">{item.certificateId}</p>
                          <p className="text-ios-footnote text-gray-500">
                            Compra: {formatDate(item.saleDate)} • Vence: {formatDate(item.warrantyExpiresAt)}
                          </p>
                        </div>
                        <div className={`rounded-ios-lg border px-3 py-2 flex items-center gap-2 ${statusMeta.style}`}>
                          {statusMeta.icon}
                          <span className="text-xs font-bold">{statusMeta.title}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {item.items.map((device, idx) => {
                          const deviceDisplay = formatWarrantyDevice(device);
                          return (
                            <div key={`${item.certificateId}-${device.imeiMasked}-${idx}`} className="ios-card p-3">
                              <div className="flex items-start gap-3">
                                <Smartphone className="text-brand-500 mt-0.5" size={18} />
                                <div className="min-w-0">
                                  <p className="font-semibold text-gray-900 dark:text-white">
                                    {deviceDisplay.title}
                                  </p>
                                  <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500 dark:text-surface-dark-500">
                                    {deviceDisplay.capacity && (
                                      <span className="bg-gray-100 dark:bg-surface-dark-200 px-2 py-1 rounded-ios">{deviceDisplay.capacity}</span>
                                    )}
                                    {deviceDisplay.battery && (
                                      <span className="bg-gray-100 dark:bg-surface-dark-200 px-2 py-1 rounded-ios">{deviceDisplay.battery}🔋</span>
                                    )}
                                    <span className="bg-gray-100 dark:bg-surface-dark-200 px-2 py-1 rounded-ios">
                                      IMEI: {deviceDisplay.imei || '-'}
                                    </span>
                                    <span className="bg-gray-100 dark:bg-surface-dark-200 px-2 py-1 rounded-ios">{device.condition || '-'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!loading && !error && warranty && warrantyStatusMeta && (
          <div className="space-y-6">
            <div className="text-center border-b border-gray-200 dark:border-surface-dark-300 pb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-ios-lg bg-brand-500 text-white mb-3">
                <ShieldCheck size={28} />
              </div>
              <h1 className="text-ios-title-2 font-bold text-gray-900 dark:text-white">Certificado de Garantia</h1>
              <p className="text-gray-500 mt-1">{warranty.storeName}</p>
              <p className="text-ios-footnote text-gray-400 mt-1">{warranty.certificateId}</p>
            </div>

            <div className={`rounded-ios-lg border px-4 py-3 flex items-center gap-3 ${warrantyStatusMeta.style}`}>
              {warrantyStatusMeta.icon}
              <div>
                <p className="font-bold">{warrantyStatusMeta.title}</p>
                <p className="text-sm">
                  Válida até {formatDate(warranty.warrantyExpiresAt)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="ios-card p-4">
                <p className="text-ios-footnote text-gray-500 uppercase tracking-wide mb-2">Cliente</p>
                <p className="font-semibold text-gray-900 dark:text-white">{warranty.customerName}</p>
              </div>
              <div className="ios-card p-4">
                <p className="text-ios-footnote text-gray-500 uppercase tracking-wide mb-2">Data da Compra</p>
                <p className="font-semibold text-gray-900 dark:text-white">{formatDate(warranty.saleDate)}</p>
              </div>
            </div>

            <div>
              <p className="text-ios-footnote text-gray-500 uppercase tracking-wide mb-3">Aparelhos</p>
              <div className="space-y-3">
                {warranty.items.map((item, idx) => {
                  const itemDisplay = formatWarrantyDevice(item);
                  return (
                    <div key={`${item.imeiMasked}-${idx}`} className="ios-card p-4">
                      <div className="flex items-start gap-3">
                        <Smartphone className="text-brand-500 mt-0.5" size={18} />
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {itemDisplay.title}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500 dark:text-surface-dark-500">
                            {itemDisplay.capacity && (
                              <span className="bg-gray-100 dark:bg-surface-dark-200 px-2 py-1 rounded-ios">{itemDisplay.capacity}</span>
                            )}
                            {itemDisplay.battery && (
                              <span className="bg-gray-100 dark:bg-surface-dark-200 px-2 py-1 rounded-ios">{itemDisplay.battery}🔋</span>
                            )}
                            <span className="bg-gray-100 dark:bg-surface-dark-200 px-2 py-1 rounded-ios">
                              IMEI: {itemDisplay.imei || '-'}
                            </span>
                            <span className="bg-gray-100 dark:bg-surface-dark-200 px-2 py-1 rounded-ios">{item.condition || '-'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicWarranty;
