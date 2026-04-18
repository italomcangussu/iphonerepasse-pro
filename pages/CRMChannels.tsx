import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Edit, Eye, EyeOff, Link2, Plus, RefreshCw, Save, Settings2, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import Modal from '../components/ui/Modal';
import { useData } from '../services/dataContext';
import { supabase, supabaseUrl } from '../services/supabase';
import { useToast } from '../components/ui/ToastProvider';
import type { CRMChannel, CRMProvider } from '../types';

type UazAction = 'create_instance' | 'connect_instance' | 'status_instance' | 'sync_webhook';

const getWebhookUrl = (channelId: string, webhookSecret?: string | null): string => {
  const base = (supabaseUrl || 'https://example.supabase.co').replace('.supabase.co', '.functions.supabase.co');
  const url = new URL('/crm-uaz-webhook-receiver', base.endsWith('/') ? base : `${base}/`);
  url.searchParams.set('channel_id', channelId);
  if (webhookSecret?.trim()) url.searchParams.set('webhook_secret', webhookSecret.trim());
  return url.toString();
};

const PROVIDER_OPTIONS: Array<{ value: CRMProvider; label: string }> = [
  { value: 'uazapi', label: 'UAZAPI' },
  { value: 'instagram_official', label: 'Instagram Oficial' },
];

const UAZ_SUBDOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

const UAZ_STATUS_LABEL: Record<NonNullable<CRMChannel['uazConnectionStatus']>, string> = {
  unknown: 'Desconhecido',
  connecting: 'Conectando',
  connected: 'Conectado',
  disconnected: 'Desconectado',
  error: 'Erro',
};

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
  uazInstanceToken: '',
  uazAdminToken: '',
  uazInstanceName: '',
  uazWebhookId: '',
  uazConnectionStatus: 'unknown' as NonNullable<CRMChannel['uazConnectionStatus']>,
  uazLastStatusAt: '',
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
  uazInstanceToken: raw.uaz_instance_token || '',
  uazAdminToken: raw.uaz_admin_token || '',
  uazInstanceName: raw.uaz_instance_name || '',
  uazWebhookId: raw.uaz_webhook_id || null,
  uazConnectionStatus: raw.uaz_connection_status || 'unknown',
  uazLastStatus: raw.uaz_last_status || null,
  uazLastStatusAt: raw.uaz_last_status_at || null,
  webhookSecret: raw.webhook_secret || '',
  inboundFunnelId: raw.inbound_funnel_id || null,
  inboundFunnelStage: raw.inbound_funnel_stage || null,
  instagramVerifyToken: raw.instagram_verify_token || null,
  instagramIgUserId: raw.instagram_ig_user_id || null,
  instagramUsername: raw.instagram_username || null,
  createdAt: raw.created_at,
  updatedAt: raw.updated_at,
});

const channelToForm = (channel: CRMChannel) => ({
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
  uazInstanceToken: channel.uazInstanceToken || '',
  uazAdminToken: channel.uazAdminToken || '',
  uazInstanceName: channel.uazInstanceName || '',
  uazWebhookId: channel.uazWebhookId || '',
  uazConnectionStatus: channel.uazConnectionStatus || 'unknown',
  uazLastStatusAt: channel.uazLastStatusAt || '',
  webhookSecret: channel.webhookSecret || '',
  inboundFunnelId: channel.inboundFunnelId || '',
  inboundFunnelStage: channel.inboundFunnelStage || 'new_lead',
  instagramVerifyToken: channel.instagramVerifyToken || '',
  instagramIgUserId: channel.instagramIgUserId || '',
  instagramUsername: channel.instagramUsername || '',
});

const formatUazStatus = (status: CRMChannel['uazConnectionStatus'] | undefined): string => {
  const normalized = (status || 'unknown') as NonNullable<CRMChannel['uazConnectionStatus']>;
  return UAZ_STATUS_LABEL[normalized] || UAZ_STATUS_LABEL.unknown;
};

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
  const [runningUazAction, setRunningUazAction] = useState<UazAction | null>(null);
  const [showInstanceToken, setShowInstanceToken] = useState(false);
  const [showAdminToken, setShowAdminToken] = useState(false);
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
  const visibleFunnels = useMemo(() => funnels.filter((funnel) => funnel.store_id === formData.storeId), [funnels, formData.storeId]);

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
    setShowAdminToken(false);
    setShowInstanceToken(false);
  };

  const openCreateModal = () => {
    setIsEditing(false);
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (channel: CRMChannel) => {
    setIsEditing(true);
    setFormData(channelToForm(channel));
    setIsModalOpen(true);
  };

  const refreshChannelById = async (channelId: string) => {
    const { data, error } = await supabase
      .from('crm_channels')
      .select('*')
      .eq('id', channelId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return;

    const mapped = mapChannel(data);
    setFormData(channelToForm(mapped));
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
        uaz_instance_token: formData.provider === 'uazapi' ? formData.uazInstanceToken.trim() || null : null,
        uaz_admin_token: formData.provider === 'uazapi' ? formData.uazAdminToken.trim() || null : null,
        uaz_instance_name: formData.provider === 'uazapi' ? formData.uazInstanceName.trim() || null : null,
        uaz_webhook_id: formData.provider === 'uazapi' ? formData.uazWebhookId.trim() || null : null,
        uaz_connection_status: formData.provider === 'uazapi' ? formData.uazConnectionStatus : 'unknown',
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
      await loadChannels();
      if (isEditing && formData.id) {
        await refreshChannelById(formData.id);
      } else {
        setIsModalOpen(false);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Falha ao salvar canal CRM.');
    } finally {
      setIsSaving(false);
    }
  };

  const runUazAction = async (action: UazAction) => {
    if (!formData.id) {
      toast.error('Salve o canal antes de executar operações UAZAPI.');
      return;
    }

    setRunningUazAction(action);
    try {
      const { data, error } = await supabase.functions.invoke('crm-uaz-instance-admin', {
        body: {
          action,
          channelId: formData.id,
          payload: {
            instance_name: formData.uazInstanceName || undefined,
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));

      await refreshChannelById(formData.id);
      await loadChannels();

      if (action === 'sync_webhook' && data?.webhookUrl) {
        toast.success('Webhook sincronizado.');
      } else if (action === 'create_instance') {
        toast.success('Instância criada.');
      } else if (action === 'connect_instance') {
        toast.success('Solicitação de conexão enviada.');
      } else if (action === 'status_instance') {
        toast.success('Status atualizado.');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Falha ao executar ação UAZAPI.');
    } finally {
      setRunningUazAction(null);
    }
  };

  const copyText = async (text: string, successMessage = 'Copiado.') => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch {
      toast.error('Falha ao copiar.');
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
    const confirmed = await toast.confirm({
      title: 'Remover Canal',
      description: `Deseja realmente remover o canal "${channel.name}"? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Remover',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('crm_channels').delete().eq('id', channel.id);
      if (error) throw error;
      toast.success('Canal removido.');
      await loadChannels();
    } catch (error: any) {
      toast.error(error?.message || 'Falha ao remover canal.');
    }
  };

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
        <select className="ios-input" value={selectedStore} onChange={(event) => setSelectedStore(event.target.value)}>
          <option value="">Todas as lojas</option>
          {storeOptions.map((store) => (
            <option key={store.id} value={store.id}>{store.name}</option>
          ))}
        </select>
      </div>

      <div className="ios-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
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
                    <td className="px-4 py-3 text-gray-700 dark:text-surface-dark-600">
                      <p>{channel.isActive ? 'Canal ativo' : 'Canal inativo'}</p>
                      {channel.provider === 'uazapi' ? (
                        <p className="text-xs text-gray-500">UAZ: {formatUazStatus(channel.uazConnectionStatus)}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" className="p-2 rounded-ios hover:bg-gray-100 dark:hover:bg-surface-dark-200" onClick={() => void toggleChannelActive(channel)}>
                          {channel.isActive ? <ToggleRight className="text-green-500" size={18} /> : <ToggleLeft className="text-gray-400" size={18} />}
                        </button>
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
              <label className="ios-label">Webhook Secret</label>
              <input className="ios-input" value={formData.webhookSecret} onChange={(event) => setFormData((prev) => ({ ...prev, webhookSecret: event.target.value }))} />
            </div>
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

          {formData.provider === 'uazapi' ? (
            <div className="ios-card p-4 border border-gray-200 dark:border-surface-dark-300 space-y-4">
              <h4 className="text-ios-subhead font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                <Settings2 size={16} className="text-brand-500" /> UAZAPI
              </h4>

              {isEditing && formData.id ? (
                <div>
                  <label className="ios-label">URL do Webhook da Instância</label>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      className="ios-input flex-1 bg-gray-50 dark:bg-surface-dark-200 text-xs font-mono select-all"
                      value={getWebhookUrl(formData.id, formData.webhookSecret)}
                    />
                    <button
                      type="button"
                      className="ios-button-secondary shrink-0 flex items-center gap-1 text-xs"
                      onClick={() => void copyText(getWebhookUrl(formData.id, formData.webhookSecret), 'URL do webhook copiada.')}
                    >
                      <Copy size={14} />
                      Copiar
                    </button>
                  </div>
                </div>
              ) : null}

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
                  <label className="ios-label">Nome da Instância</label>
                  <input
                    className="ios-input"
                    value={formData.uazInstanceName}
                    placeholder="ex: loja-centro"
                    onChange={(event) => setFormData((prev) => ({ ...prev, uazInstanceName: event.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="ios-label">Token da Instância</label>
                  <div className="flex items-center gap-2">
                    <input
                      type={showInstanceToken ? 'text' : 'password'}
                      className="ios-input flex-1"
                      value={formData.uazInstanceToken}
                      onChange={(event) => setFormData((prev) => ({ ...prev, uazInstanceToken: event.target.value }))}
                    />
                    <button
                      type="button"
                      className="ios-button-secondary px-3"
                      onClick={() => setShowInstanceToken((current) => !current)}
                    >
                      {showInstanceToken ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      type="button"
                      className="ios-button-secondary px-3"
                      onClick={() => void copyText(formData.uazInstanceToken, 'Token da instância copiado.')}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="ios-label">Admin Token</label>
                  <div className="flex items-center gap-2">
                    <input
                      type={showAdminToken ? 'text' : 'password'}
                      className="ios-input flex-1"
                      value={formData.uazAdminToken}
                      onChange={(event) => setFormData((prev) => ({ ...prev, uazAdminToken: event.target.value }))}
                    />
                    <button
                      type="button"
                      className="ios-button-secondary px-3"
                      onClick={() => setShowAdminToken((current) => !current)}
                    >
                      {showAdminToken ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      type="button"
                      className="ios-button-secondary px-3"
                      onClick={() => void copyText(formData.uazAdminToken, 'Admin token copiado.')}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="ios-label">Status da Conexão</label>
                  <input className="ios-input bg-gray-50 dark:bg-surface-dark-200" readOnly value={formatUazStatus(formData.uazConnectionStatus)} />
                </div>
                <div>
                  <label className="ios-label">Webhook ID</label>
                  <input className="ios-input bg-gray-50 dark:bg-surface-dark-200" readOnly value={formData.uazWebhookId || '-'} />
                </div>
                <div>
                  <label className="ios-label">Última Atualização</label>
                  <input
                    className="ios-input bg-gray-50 dark:bg-surface-dark-200"
                    readOnly
                    value={formData.uazLastStatusAt ? new Date(formData.uazLastStatusAt).toLocaleString('pt-BR') : '-'}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="ios-button-secondary flex items-center gap-1"
                  disabled={!formData.id || runningUazAction !== null}
                  onClick={() => void runUazAction('create_instance')}
                >
                  <Settings2 size={14} />
                  {runningUazAction === 'create_instance' ? 'Criando...' : 'Criar Instância'}
                </button>
                <button
                  type="button"
                  className="ios-button-secondary flex items-center gap-1"
                  disabled={!formData.id || runningUazAction !== null}
                  onClick={() => void runUazAction('connect_instance')}
                >
                  <Link2 size={14} />
                  {runningUazAction === 'connect_instance' ? 'Conectando...' : 'Conectar'}
                </button>
                <button
                  type="button"
                  className="ios-button-secondary flex items-center gap-1"
                  disabled={!formData.id || runningUazAction !== null}
                  onClick={() => void runUazAction('status_instance')}
                >
                  <RefreshCw size={14} />
                  {runningUazAction === 'status_instance' ? 'Atualizando...' : 'Atualizar Status'}
                </button>
                <button
                  type="button"
                  className="ios-button-secondary flex items-center gap-1"
                  disabled={!formData.id || runningUazAction !== null}
                  onClick={() => void runUazAction('sync_webhook')}
                >
                  <Link2 size={14} />
                  {runningUazAction === 'sync_webhook' ? 'Sincronizando...' : 'Configurar Webhook'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="ios-label">API Endpoint (legado/fallback)</label>
                  <input
                    className="ios-input"
                    value={formData.apiEndpoint}
                    onChange={(event) => setFormData((prev) => ({ ...prev, apiEndpoint: event.target.value }))}
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="ios-label">Token/API Key legado (fallback)</label>
                  <input
                    className="ios-input"
                    value={formData.apiKey}
                    onChange={(event) => setFormData((prev) => ({ ...prev, apiKey: event.target.value }))}
                    placeholder="Opcional"
                  />
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="ios-label">API Endpoint</label>
                  <input className="ios-input" value={formData.apiEndpoint} onChange={(event) => setFormData((prev) => ({ ...prev, apiEndpoint: event.target.value }))} placeholder="https://..." />
                </div>
                <div>
                  <label className="ios-label">Token / API Key</label>
                  <input className="ios-input" value={formData.apiKey} onChange={(event) => setFormData((prev) => ({ ...prev, apiKey: event.target.value }))} />
                </div>
              </div>
            </div>
          )}

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
      </Modal>
    </div>
  );
};

export default CRMChannels;
