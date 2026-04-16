import React, { useEffect, useMemo, useState } from 'react';
import { Edit, Plus, RefreshCw, Save, Settings2, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import Modal from '../components/ui/Modal';
import { useData } from '../services/dataContext';
import { supabase } from '../services/supabase';
import { useToast } from '../components/ui/ToastProvider';
import type { CRMChannel, CRMProvider } from '../types';

const PROVIDER_OPTIONS: Array<{ value: CRMProvider; label: string }> = [
  { value: 'uazapi', label: 'UAZAPI' },
  { value: 'instagram_official', label: 'Instagram Oficial' },
];

const UAZ_SUBDOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

type FunnelOption = {
  id: string;
  name: string;
  store_id: string;
};

const DEFAULT_FORM = {
  id: '',
  storeId: '',
  name: '',
  provider: 'uazapi' as CRMProvider,
  phoneNumber: '',
  isActive: true,
  useForManual: true,
  useForAutomation: true,
  apiEndpoint: '',
  apiKey: '',
  uazSubdomain: 'api',
  webhookSecret: '',
  inboundFunnelId: '',
  inboundFunnelStage: 'new_lead',
  instagramVerifyToken: '',
  instagramIgUserId: '',
  instagramUsername: '',
};

const mapChannel = (raw: any): CRMChannel => ({
  id: raw.id,
  storeId: raw.store_id,
  name: raw.name,
  provider: raw.provider,
  isActive: Boolean(raw.is_active),
  useForManual: Boolean(raw.use_for_manual),
  useForAutomation: Boolean(raw.use_for_automation),
  phoneNumber: raw.phone_number || '',
  apiEndpoint: raw.api_endpoint || '',
  apiKey: raw.api_key || '',
  uazSubdomain: raw.uaz_subdomain || 'api',
  webhookSecret: raw.webhook_secret || '',
  inboundFunnelId: raw.inbound_funnel_id || null,
  inboundFunnelStage: raw.inbound_funnel_stage || null,
  instagramVerifyToken: raw.instagram_verify_token || null,
  instagramIgUserId: raw.instagram_ig_user_id || null,
  instagramUsername: raw.instagram_username || null,
  createdAt: raw.created_at,
  updatedAt: raw.updated_at,
});

const CRMChannels: React.FC = () => {
  const { stores } = useData();
  const toast = useToast();

  const [channels, setChannels] = useState<CRMChannel[]>([]);
  const [funnels, setFunnels] = useState<FunnelOption[]>([]);
  const [stageOptions, setStageOptions] = useState<string[]>([]);

  const [selectedStore, setSelectedStore] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_FORM);

  const storeOptions = useMemo(() => stores, [stores]);

  const filteredChannels = useMemo(() => {
    if (!selectedStore) return channels;
    return channels.filter((channel) => channel.storeId === selectedStore);
  }, [channels, selectedStore]);
  const funnelNameById = useMemo(() => {
    const map = new Map<string, string>();
    funnels.forEach((funnel) => map.set(funnel.id, funnel.name));
    return map;
  }, [funnels]);

  const loadChannels = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('crm_channels')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setChannels((data || []).map(mapChannel));
    } catch (error: any) {
      toast.error(error?.message || 'Falha ao carregar canais CRM.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadFunnels = async () => {
    try {
      const [{ data: funnelsData, error: funnelsError }, { data: stageData, error: stageError }] = await Promise.all([
        supabase
          .from('crm_funnels')
          .select('id, name, store_id')
          .eq('funnel_type', 'sales')
          .eq('is_active', true)
          .order('created_at', { ascending: true }),
        supabase
          .from('crm_funnel_stages')
          .select('id')
          .eq('funnel_type', 'sales')
          .eq('is_active', true)
          .order('order', { ascending: true }),
      ]);

      if (funnelsError) throw funnelsError;
      if (stageError) throw stageError;

      setFunnels((funnelsData || []) as FunnelOption[]);
      setStageOptions((stageData || []).map((entry: any) => String(entry.id)));
    } catch (error: any) {
      toast.error(error?.message || 'Falha ao carregar funis CRM.');
    }
  };

  useEffect(() => {
    void loadChannels();
    void loadFunnels();
  }, []);

  useEffect(() => {
    if (!selectedStore && storeOptions.length > 0) {
      setSelectedStore(storeOptions[0].id);
    }
  }, [selectedStore, storeOptions]);

  const resetForm = () => {
    setFormData((prev) => ({
      ...DEFAULT_FORM,
      storeId: selectedStore || storeOptions[0]?.id || prev.storeId,
    }));
  };

  const openCreateModal = () => {
    setIsEditing(false);
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (channel: CRMChannel) => {
    setIsEditing(true);
    setFormData({
      id: channel.id,
      storeId: channel.storeId,
      name: channel.name,
      provider: channel.provider,
      phoneNumber: channel.phoneNumber || '',
      isActive: channel.isActive,
      useForManual: channel.useForManual,
      useForAutomation: channel.useForAutomation,
      apiEndpoint: channel.apiEndpoint || '',
      apiKey: channel.apiKey || '',
      uazSubdomain: channel.uazSubdomain || 'api',
      webhookSecret: channel.webhookSecret || '',
      inboundFunnelId: channel.inboundFunnelId || '',
      inboundFunnelStage: channel.inboundFunnelStage || 'new_lead',
      instagramVerifyToken: channel.instagramVerifyToken || '',
      instagramIgUserId: channel.instagramIgUserId || '',
      instagramUsername: channel.instagramUsername || '',
    });
    setIsModalOpen(true);
  };

  const saveChannel = async () => {
    if (!formData.storeId || !formData.name.trim()) {
      toast.error('Informe loja e nome do canal.');
      return;
    }

    if (!PROVIDER_OPTIONS.some((provider) => provider.value === formData.provider)) {
      toast.error('Provider inválido. Permitidos: UAZAPI e Instagram Oficial.');
      return;
    }

    setIsSaving(true);
    try {
      const normalizedUazSubdomain = formData.uazSubdomain.trim().toLowerCase() || 'api';
      if (formData.provider === 'uazapi' && !UAZ_SUBDOMAIN_REGEX.test(normalizedUazSubdomain)) {
        toast.error('Subdomínio UAZ inválido. Use apenas letras minúsculas, números e hífen (sem começar/terminar com hífen).');
        return;
      }

      const payload = {
        store_id: formData.storeId,
        name: formData.name.trim(),
        provider: formData.provider,
        phone_number: formData.phoneNumber.trim(),
        is_active: formData.isActive,
        use_for_manual: formData.useForManual,
        use_for_automation: formData.useForAutomation,
        api_endpoint: formData.apiEndpoint.trim() || null,
        api_key: formData.apiKey.trim() || null,
        uaz_subdomain: formData.provider === 'uazapi' ? normalizedUazSubdomain : 'api',
        webhook_secret: formData.webhookSecret.trim() || null,
        inbound_funnel_id: formData.inboundFunnelId || null,
        inbound_funnel_stage: formData.inboundFunnelStage || null,
        instagram_verify_token: formData.provider === 'instagram_official' ? formData.instagramVerifyToken.trim() || null : null,
        instagram_ig_user_id: formData.provider === 'instagram_official' ? formData.instagramIgUserId.trim() || null : null,
        instagram_username: formData.provider === 'instagram_official' ? formData.instagramUsername.trim() || null : null,
      };

      if (isEditing && formData.id) {
        const { error } = await supabase.from('crm_channels').update(payload).eq('id', formData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('crm_channels').insert(payload);
        if (error) throw error;
      }

      toast.success(isEditing ? 'Canal CRM atualizado.' : 'Canal CRM criado.');
      setIsModalOpen(false);
      await loadChannels();
    } catch (error: any) {
      toast.error(error?.message || 'Falha ao salvar canal CRM.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleChannelActive = async (channel: CRMChannel) => {
    try {
      const { error } = await supabase
        .from('crm_channels')
        .update({ is_active: !channel.isActive })
        .eq('id', channel.id);

      if (error) throw error;
      await loadChannels();
    } catch (error: any) {
      toast.error(error?.message || 'Falha ao atualizar status do canal.');
    }
  };

  const removeChannel = async (channel: CRMChannel) => {
    if (!confirm(`Remover o canal "${channel.name}"?`)) return;

    try {
      const { error } = await supabase.from('crm_channels').delete().eq('id', channel.id);
      if (error) throw error;
      toast.success('Canal removido.');
      await loadChannels();
    } catch (error: any) {
      toast.error(error?.message || 'Falha ao remover canal.');
    }
  };

  const visibleFunnels = useMemo(() => funnels.filter((funnel) => funnel.store_id === formData.storeId), [funnels, formData.storeId]);
  const modalFooter = (
    <div className="flex justify-end gap-3">
      <button type="button" className="ios-button-secondary" onClick={() => setIsModalOpen(false)}>
        Cancelar
      </button>
      <button type="button" className="ios-button-primary flex items-center gap-2" onClick={() => void saveChannel()} disabled={isSaving}>
        <Save size={16} />
        {isSaving ? 'Salvando...' : 'Salvar Canal'}
      </button>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-[28px] md:text-ios-large font-bold text-gray-900 dark:text-white tracking-tight">CRM Canais</h2>
          <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-0.5">
            Configuração de canais CRM Plus (somente UAZAPI e Instagram Oficial).
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button type="button" className="ios-button-secondary flex items-center gap-2 justify-center" onClick={() => void loadChannels()}>
            <RefreshCw size={18} />
            Atualizar
          </button>
          <button type="button" className="ios-button-primary flex items-center gap-2 justify-center" onClick={openCreateModal}>
            <Plus size={18} />
            Novo Canal
          </button>
        </div>
      </div>

      <div className="ios-card p-4 md:p-5">
        <label className="ios-label">Loja</label>
        <select
          className="ios-input"
          value={selectedStore}
          onChange={(event) => setSelectedStore(event.target.value)}
        >
          <option value="">Todas as lojas</option>
          {storeOptions.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>
      </div>

      <div className="ios-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead className="bg-gray-50 dark:bg-surface-dark-200/60 border-b border-gray-200 dark:border-surface-dark-300">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Canal</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Roteamento</th>
                <th className="px-4 py-3">Funil Inbound</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-gray-500" colSpan={6}>Carregando canais CRM...</td>
                </tr>
              ) : filteredChannels.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-gray-500" colSpan={6}>Nenhum canal CRM encontrado para o filtro atual.</td>
                </tr>
              ) : (
                filteredChannels.map((channel) => (
                  <tr key={channel.id} className="border-b border-gray-100 dark:border-surface-dark-300/60 text-sm">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 dark:text-white">{channel.name}</p>
                      <p className="text-gray-500">{storeOptions.find((store) => store.id === channel.storeId)?.name || channel.storeId}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-200">
                        {channel.provider === 'uazapi' ? 'UAZAPI' : 'Instagram Oficial'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-surface-dark-600">
                      <p>Manual: {channel.useForManual ? 'Ativo' : 'Inativo'}</p>
                      <p>Automação: {channel.useForAutomation ? 'Ativo' : 'Inativo'}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-surface-dark-600">
                      <p>{funnelNameById.get(channel.inboundFunnelId || '') || 'Padrão da loja'}</p>
                      <p className="text-xs text-gray-500">Etapa: {channel.inboundFunnelStage || 'new_lead'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void toggleChannelActive(channel)}
                        className="inline-flex items-center gap-2 text-sm"
                      >
                        {channel.isActive ? (
                          <>
                            <ToggleRight className="text-green-500" size={20} />
                            <span className="text-green-600">Ativo</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="text-gray-400" size={20} />
                            <span className="text-gray-500">Inativo</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" className="p-2 rounded-ios hover:bg-gray-100 dark:hover:bg-surface-dark-200" onClick={() => openEditModal(channel)}>
                          <Edit size={16} />
                        </button>
                        <button type="button" className="p-2 rounded-ios hover:bg-gray-100 dark:hover:bg-surface-dark-200" onClick={() => void removeChannel(channel)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? 'Editar Canal CRM' : 'Novo Canal CRM'}
        size="xl"
        footer={modalFooter}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="ios-label">Loja</label>
              <select className="ios-input" value={formData.storeId} onChange={(event) => setFormData((prev) => ({ ...prev, storeId: event.target.value }))}>
                <option value="">Selecione</option>
                {storeOptions.map((store) => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="ios-label">Nome do Canal</label>
              <input className="ios-input" value={formData.name} onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="ios-label">Provider</label>
              <select
                className="ios-input"
                value={formData.provider}
                onChange={(event) => setFormData((prev) => ({ ...prev, provider: event.target.value as CRMProvider }))}
              >
                {PROVIDER_OPTIONS.map((provider) => (
                  <option key={provider.value} value={provider.value}>{provider.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="ios-label">Telefone / Identificador</label>
              <input className="ios-input" value={formData.phoneNumber} onChange={(event) => setFormData((prev) => ({ ...prev, phoneNumber: event.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="ios-label">API Endpoint</label>
              <input className="ios-input" value={formData.apiEndpoint} onChange={(event) => setFormData((prev) => ({ ...prev, apiEndpoint: event.target.value }))} placeholder="https://..." />
            </div>
            <div>
              <label className="ios-label">Token / API Key</label>
              <input className="ios-input" value={formData.apiKey} onChange={(event) => setFormData((prev) => ({ ...prev, apiKey: event.target.value }))} />
            </div>
            <div>
              <label className="ios-label">Webhook Secret</label>
              <input className="ios-input" value={formData.webhookSecret} onChange={(event) => setFormData((prev) => ({ ...prev, webhookSecret: event.target.value }))} />
            </div>
          </div>

          {formData.provider === 'uazapi' ? (
            <div className="ios-card p-4 border border-gray-200 dark:border-surface-dark-300">
              <h4 className="text-ios-subhead font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Settings2 size={16} className="text-brand-500" /> UAZAPI
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="ios-label">Subdomínio UAZ</label>
                  <input
                    type="text"
                    className="ios-input"
                    value={formData.uazSubdomain}
                    placeholder="ex: api, free, meu-subdominio"
                    onChange={(event) => setFormData((prev) => ({ ...prev, uazSubdomain: event.target.value.toLowerCase() }))}
                  />
                </div>
                <div>
                  <label className="ios-label">Etapa inbound</label>
                  <select
                    className="ios-input"
                    value={formData.inboundFunnelStage}
                    onChange={(event) => setFormData((prev) => ({ ...prev, inboundFunnelStage: event.target.value }))}
                  >
                    {stageOptions.map((stage) => (
                      <option key={stage} value={stage}>{stage}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="ios-card p-4 border border-gray-200 dark:border-surface-dark-300">
              <h4 className="text-ios-subhead font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Settings2 size={16} className="text-brand-500" /> Instagram Oficial
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="ios-label">Verify Token</label>
                  <input className="ios-input" value={formData.instagramVerifyToken} onChange={(event) => setFormData((prev) => ({ ...prev, instagramVerifyToken: event.target.value }))} />
                </div>
                <div>
                  <label className="ios-label">IG User ID</label>
                  <input className="ios-input" value={formData.instagramIgUserId} onChange={(event) => setFormData((prev) => ({ ...prev, instagramIgUserId: event.target.value }))} />
                </div>
                <div>
                  <label className="ios-label">@Username</label>
                  <input className="ios-input" value={formData.instagramUsername} onChange={(event) => setFormData((prev) => ({ ...prev, instagramUsername: event.target.value }))} />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="ios-label">Funil inbound</label>
              <select
                className="ios-input"
                value={formData.inboundFunnelId}
                onChange={(event) => setFormData((prev) => ({ ...prev, inboundFunnelId: event.target.value }))}
              >
                <option value="">Usar padrão da loja</option>
                {visibleFunnels.map((funnel) => (
                  <option key={funnel.id} value={funnel.id}>{funnel.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3 items-end">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-surface-dark-600">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(event) => setFormData((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
                Ativo
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-surface-dark-600">
                <input
                  type="checkbox"
                  checked={formData.useForManual}
                  onChange={(event) => setFormData((prev) => ({ ...prev, useForManual: event.target.checked }))}
                />
                Manual
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-surface-dark-600">
                <input
                  type="checkbox"
                  checked={formData.useForAutomation}
                  onChange={(event) => setFormData((prev) => ({ ...prev, useForAutomation: event.target.checked }))}
                />
                Automação
              </label>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CRMChannels;
