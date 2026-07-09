import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDisclosure } from '../hooks/useDisclosure';
import { Copy, Edit, Eye, EyeOff, Link2, Loader2, Plus, Power, QrCode, RefreshCw, Save, Settings2, Smartphone, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import Modal from '../components/ui/Modal';
import { supabase, supabaseAnonKey, supabaseUrl } from '../services/supabase';
import { useToast } from '../components/ui/ToastProvider';
import { useAsyncHandler } from '../hooks/useAsyncHandler';
import { assertNoError } from '../utils/supabase';
import type { CRMAIEntryMode, CRMChannel, CRMProvider, UazInstanceSnapshot } from '../types';
import { useCRMStore } from '../components/crm/useCRMStore';

type UazAction = 'create_instance' | 'connect_instance' | 'status_instance' | 'sync_webhook' | 'disconnect_instance';

type UazStatus = NonNullable<CRMChannel['uazConnectionStatus']>;

const UAZ_STATUS_STYLE: Record<UazStatus, { dot: string; text: string; label: string }> = {
  connected: { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', label: 'Conectado' },
  connecting: { dot: 'bg-amber-500 animate-pulse', text: 'text-amber-600 dark:text-amber-400', label: 'Conectando' },
  disconnected: { dot: 'bg-gray-400', text: 'text-gray-500 dark:text-surface-dark-500', label: 'Desconectado' },
  error: { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', label: 'Erro' },
  unknown: { dot: 'bg-gray-300 dark:bg-surface-dark-400', text: 'text-gray-400 dark:text-surface-dark-500', label: 'Desconhecido' },
};

const UazStatusBadge: React.FC<{ status?: CRMChannel['uazConnectionStatus'] }> = ({ status }) => {
  const style = UAZ_STATUS_STYLE[(status || 'unknown') as UazStatus] || UAZ_STATUS_STYLE.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${style.text}`}>
      <span className={`inline-block w-2 h-2 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
};

// How long to keep auto-checking after a QR is issued before declaring it stale.
const UAZ_CONNECT_POLL_MS = 4000;
const UAZ_CONNECT_TIMEOUT_MS = 120000;

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

// Account-level UAZAPI server subdomain (e.g. "iatende" for iatende.uazapi.com),
// used as the default for new channels so nobody has to remember/type it. Reads
// a build-time VITE var (bare subdomain or a full server URL); falls back to
// "api". Mirrors the edge-function UAZ_SUBDOMAIN secret on the server side.
const resolveDefaultUazSubdomain = (): string => {
  const bare = String(import.meta.env.VITE_UAZ_SUBDOMAIN || '').trim().toLowerCase();
  if (bare && UAZ_SUBDOMAIN_REGEX.test(bare)) return bare;
  const serverUrl = String(import.meta.env.VITE_UAZAPI_SERVER_URL || '').trim();
  if (serverUrl) {
    try {
      const host = new URL(serverUrl.includes('://') ? serverUrl : `https://${serverUrl}`).hostname;
      const sub = host.replace(/\.uazapi\.com$/i, '').toLowerCase();
      if (sub && sub !== host.toLowerCase() && UAZ_SUBDOMAIN_REGEX.test(sub)) return sub;
    } catch {
      // ignore malformed URL and fall through to the default
    }
  }
  return 'api';
};

const DEFAULT_UAZ_SUBDOMAIN = resolveDefaultUazSubdomain();

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
  isAdminConsole: false,
  useForManual: true,
  useForAutomation: true,
  apiEndpoint: '',
  apiKey: '',
  uazSubdomain: DEFAULT_UAZ_SUBDOMAIN,
  uazInstanceToken: '',
  uazAdminToken: '',
  uazInstanceName: '',
  uazWebhookId: '',
  uazConnectionStatus: 'unknown' as NonNullable<CRMChannel['uazConnectionStatus']>,
  uazLastStatusAt: '',
  webhookSecret: '',
  aiResumeWebhookUrl: '',
  aiEntryMode: 'inherit' as CRMAIEntryMode,
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
  isAdminConsole: Boolean(raw.is_admin_console),
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
  aiResumeWebhookUrl: raw.ai_resume_webhook_url || '',
  aiEntryMode: raw.ai_entry_mode || 'inherit',
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
  isAdminConsole: Boolean(channel.isAdminConsole),
  useForManual: channel.useForManual,
  useForAutomation: channel.useForAutomation,
  apiEndpoint: channel.apiEndpoint || '',
  apiKey: channel.apiKey || '',
  uazSubdomain: channel.uazSubdomain || DEFAULT_UAZ_SUBDOMAIN,
  uazInstanceToken: channel.uazInstanceToken || '',
  uazAdminToken: channel.uazAdminToken || '',
  uazInstanceName: channel.uazInstanceName || '',
  uazWebhookId: channel.uazWebhookId || '',
  uazConnectionStatus: channel.uazConnectionStatus || 'unknown',
  uazLastStatusAt: channel.uazLastStatusAt || '',
  webhookSecret: channel.webhookSecret || '',
  aiResumeWebhookUrl: channel.aiResumeWebhookUrl || '',
  aiEntryMode: channel.aiEntryMode || 'inherit',
  inboundFunnelId: channel.inboundFunnelId || '',
  inboundFunnelStage: channel.inboundFunnelStage || 'new_lead',
  instagramVerifyToken: channel.instagramVerifyToken || '',
  instagramIgUserId: channel.instagramIgUserId || '',
  instagramUsername: channel.instagramUsername || '',
});

const AI_ENTRY_LABELS: Record<CRMAIEntryMode | 'force_ai_store' | 'force_human_store', string> = {
  inherit: 'Herdar padrão da loja',
  force_ai: 'IA',
  force_human: 'Humano',
  force_ai_store: 'IA',
  force_human_store: 'Humano',
};

const isValidAIWebhook = (value?: string | null): boolean => Boolean(value?.trim().startsWith('https://'));

const resolveAccessToken = async (forceRefresh = false): Promise<string> => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error(sessionError.message || 'Não foi possível validar sua sessão.');
  }

  const session = sessionData.session;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = session?.expires_at ?? 0;
  let accessToken = session?.access_token;

  if (forceRefresh || !accessToken || expiresAt <= nowInSeconds + 30) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    accessToken = refreshed.session?.access_token;
  }

  if (!accessToken) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  return accessToken;
};

const invokeAuthorizedFunction = async (
  functionName: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown> | null> => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configuração do Supabase ausente no frontend.');
  }

  const invokeWithToken = async (token: string) =>
    fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

  let accessToken = await resolveAccessToken(true);
  let response = await invokeWithToken(accessToken);
  let data = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  if (response.status === 401) {
    accessToken = await resolveAccessToken(true);
    response = await invokeWithToken(accessToken);
    data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  }

  if (!response.ok) {
    const resolvedError = String(data?.error || data?.message || '').trim();
    if (response.status === 401) {
      throw new Error(resolvedError || 'Sessão expirada ou inválida. Faça login novamente.');
    }
    throw new Error(resolvedError || `Falha ao executar ${functionName} (${response.status}).`);
  }

  return data;
};

const CRMChannels: React.FC = () => {
  const { selectedStoreId } = useCRMStore();
  const toast = useToast();
  const run = useAsyncHandler();

  const [channels, setChannels] = useState<CRMChannel[]>([]);
  const [funnels, setFunnels] = useState<FunnelOption[]>([]);
  const [stageOptions, setStageOptions] = useState<string[]>([]);
  const [storeAIFallbackMode, setStoreAIFallbackMode] = useState<'force_ai' | 'force_human'>('force_human');
  const [isSavingStoreRouting, setIsSavingStoreRouting] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { isOpen: isModalOpen, open: openModal, close: closeModal } = useDisclosure();
  const [isEditing, setIsEditing] = useState(false);
  const [runningUazAction, setRunningUazAction] = useState<UazAction | null>(null);
  const [showInstanceToken, setShowInstanceToken] = useState(false);
  const [showAdminToken, setShowAdminToken] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_FORM);

  // Live WhatsApp connection state for the channel open in the modal.
  const [uazSnapshot, setUazSnapshot] = useState<UazInstanceSnapshot | null>(null);
  const [connMessage, setConnMessage] = useState<string | null>(null);
  const [isPollingConn, setIsPollingConn] = useState(false);
  const pollChannelRef = useRef<string>('');
  const pollDeadlineRef = useRef<number>(0);

  const filteredChannels = channels;
  const funnelNameById = useMemo(() => {
    const map = new Map<string, string>();
    funnels.forEach((funnel) => map.set(funnel.id, funnel.name));
    return map;
  }, [funnels]);
  const visibleFunnels = funnels;
  const resolveEffectiveEntryMode = (channel: CRMChannel | typeof DEFAULT_FORM): 'force_ai' | 'force_human' => {
    return channel.aiEntryMode && channel.aiEntryMode !== 'inherit' ? channel.aiEntryMode : storeAIFallbackMode;
  };

  const loadChannels = async () => {
    await run(async () => {
      const [channelsResult, settingsResult] = await Promise.all([
        supabase
          .from('crm_channels')
          .select('*')
          .order('created_at', { ascending: false }),
        selectedStoreId
          ? supabase
            .from('crm_ai_entry_settings')
            .select('fallback_mode')
            .eq('store_id', selectedStoreId)
            .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      const data = assertNoError(channelsResult);
      const settings = assertNoError(settingsResult) as { fallback_mode?: string } | null;
      setStoreAIFallbackMode(settings?.fallback_mode === 'force_ai' ? 'force_ai' : 'force_human');
      setChannels((data || []).map(mapChannel));
    }, { errorMsg: 'Falha ao carregar canais CRM.', setLoading: setIsLoading });
  };

  const loadFunnels = async () => {
    await run(async () => {
      const [funnelsData, stageData] = await Promise.all([
        supabase
          .from('crm_funnels')
          .select('id, name, store_id')
          .eq('funnel_type', 'sales')
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .then(assertNoError),
        supabase
          .from('crm_funnel_stages')
          .select('id')
          .eq('funnel_type', 'sales')
          .eq('is_active', true)
          .order('order', { ascending: true })
          .then(assertNoError),
      ]);
      setFunnels((funnelsData || []) as FunnelOption[]);
      setStageOptions((stageData || []).map((entry: any) => String(entry.id)));
    }, 'Falha ao carregar funis CRM.');
  };

  useEffect(() => {
    void loadChannels();
    void loadFunnels();
  }, [selectedStoreId]);

  // Refresh the list without flashing the loading skeleton (for realtime ticks).
  const refreshChannelsSilently = async () => {
    const { data, error } = await supabase
      .from('crm_channels')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && Array.isArray(data)) {
      setChannels(data.map(mapChannel));
    }
  };

  const callUazAction = (action: UazAction, channelId: string) =>
    invokeAuthorizedFunction('crm-uaz-instance-admin', {
      action,
      channelId,
      payload: { instance_name: formData.uazInstanceName || undefined },
    });

  const stopPolling = () => {
    pollChannelRef.current = '';
    setIsPollingConn(false);
  };

  const startPolling = (channelId: string) => {
    pollChannelRef.current = channelId;
    pollDeadlineRef.current = Date.now() + UAZ_CONNECT_TIMEOUT_MS;
    setConnMessage(null);
    setIsPollingConn(true);
  };

  // While a QR/pair code is live, poll the provider until the phone pairs (or
  // the QR expires). This is what makes the app "recognize" the connection
  // without the admin clicking refresh.
  useEffect(() => {
    if (!isPollingConn) return;
    const interval = window.setInterval(async () => {
      const channelId = pollChannelRef.current;
      if (!channelId) {
        setIsPollingConn(false);
        return;
      }
      if (Date.now() > pollDeadlineRef.current) {
        setIsPollingConn(false);
        setConnMessage('O QR expirou sem leitura. Gere um novo código para conectar.');
        return;
      }
      try {
        const data = await callUazAction('status_instance', channelId);
        if (data?.error) return;
        const snap = (data?.snapshot as UazInstanceSnapshot | undefined) ?? null;
        if (snap) setUazSnapshot(snap);
        if (snap?.connected) {
          setIsPollingConn(false);
          setConnMessage(null);
          toast.success('WhatsApp conectado com sucesso.');
          await refreshChannelById(channelId);
          await refreshChannelsSilently();
        }
      } catch {
        // transient network/provider hiccup — keep polling until the deadline
      }
    }, UAZ_CONNECT_POLL_MS);
    return () => window.clearInterval(interval);
  }, [isPollingConn]);

  // Reflect connection changes pushed by the UAZAPI `connection` webhook live in
  // the list, even when nobody is on the connect screen.
  useEffect(() => {
    const sub = supabase
      .channel('crm-channels-live-status')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'crm_channels' },
        () => { void refreshChannelsSilently(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(sub); };
  }, []);

  const saveStoreRouting = async (mode: 'force_ai' | 'force_human') => {
    if (!selectedStoreId) {
      toast.error('Não foi possível resolver a loja padrão do CRM.');
      return;
    }
    setIsSavingStoreRouting(true);
    try {
      assertNoError(await supabase
        .from('crm_ai_entry_settings')
        .upsert({
          store_id: selectedStoreId,
          is_enabled: true,
          fallback_mode: mode,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'store_id' }));
      setStoreAIFallbackMode(mode);
      toast.success('Padrão de entrada atualizado.');
    } catch (error) {
      toast.error((error as Error)?.message || 'Falha ao salvar padrão de entrada.');
    } finally {
      setIsSavingStoreRouting(false);
    }
  };

  const resetForm = () => {
    setFormData((prev) => ({
      ...DEFAULT_FORM,
      storeId: selectedStoreId || prev.storeId,
    }));
    setShowAdminToken(false);
    setShowInstanceToken(false);
    setUazSnapshot(null);
    setConnMessage(null);
  };

  const openCreateModal = () => {
    setIsEditing(false);
    resetForm();
    openModal();
  };

  const openEditModal = (channel: CRMChannel) => {
    setIsEditing(true);
    setFormData(channelToForm(channel));
    setUazSnapshot(null);
    setConnMessage(null);
    openModal();

    // Fetch a fresh connection snapshot on open so the badge/QR reflect reality,
    // not just the last persisted status.
    if (channel.provider === 'uazapi' && (channel.uazInstanceToken || channel.apiKey)) {
      void callUazAction('status_instance', channel.id)
        .then((data) => {
          const snap = (data?.snapshot as UazInstanceSnapshot | undefined) ?? null;
          if (snap) setUazSnapshot(snap);
          void refreshChannelById(channel.id);
        })
        .catch(() => { /* best-effort; the form still shows the persisted status */ });
    }
  };

  const closeChannelModal = () => {
    stopPolling();
    setUazSnapshot(null);
    setConnMessage(null);
    closeModal();
  };

  const refreshChannelById = async (channelId: string) => {
    const data = assertNoError(await supabase
      .from('crm_channels')
      .select('*')
      .eq('id', channelId)
      .maybeSingle());
    if (!data) return;

    const mapped = mapChannel(data);
    setFormData(channelToForm(mapped));
  };

  const saveChannel = async () => {
    if (!selectedStoreId && !formData.storeId) {
      toast.error('Não foi possível resolver a loja padrão do CRM.');
      return;
    }

    if (!formData.name.trim()) {
      toast.error('Informe o nome do canal.');
      return;
    }

    if (!PROVIDER_OPTIONS.some((provider) => provider.value === formData.provider)) {
      toast.error('Provider inválido. Permitidos: UAZAPI e Instagram Oficial.');
      return;
    }

    await run(async () => {
      const normalizedUazSubdomain = formData.uazSubdomain.trim().toLowerCase() || DEFAULT_UAZ_SUBDOMAIN;
      if (formData.provider === 'uazapi' && !UAZ_SUBDOMAIN_REGEX.test(normalizedUazSubdomain)) {
        toast.error('Subdomínio UAZ inválido. Use apenas letras minúsculas, números e hífen (sem começar/terminar com hífen).');
        return;
      }

      const payload = {
        store_id: formData.storeId || selectedStoreId,
        name: formData.name.trim(),
        provider: formData.provider,
        phone_number: formData.phoneNumber.trim(),
        is_active: formData.isActive,
        is_admin_console: formData.isAdminConsole,
        use_for_manual: formData.useForManual,
        use_for_automation: formData.useForAutomation,
        api_endpoint: formData.apiEndpoint.trim() || null,
        api_key: formData.apiKey.trim() || null,
        uaz_subdomain: formData.provider === 'uazapi' ? normalizedUazSubdomain : 'api',
        webhook_secret: formData.webhookSecret.trim() || null,
        ai_resume_webhook_url: formData.aiResumeWebhookUrl.trim() || null,
        ai_entry_mode: formData.aiEntryMode,
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
        assertNoError(await supabase.from('crm_channels').update(payload).eq('id', formData.id));
      } else {
        assertNoError(await supabase.from('crm_channels').insert(payload));
      }

      toast.success(isEditing ? 'Canal CRM atualizado.' : 'Canal CRM criado.');
      await loadChannels();
      if (isEditing && formData.id) {
        await refreshChannelById(formData.id);
      } else {
        closeChannelModal();
      }
    }, { errorMsg: 'Falha ao salvar canal CRM.', setLoading: setIsSaving });
  };

  const runUazAction = async (action: UazAction) => {
    if (!formData.id) {
      toast.error('Salve o canal antes de executar operações UAZAPI.');
      return;
    }

    const channelId = formData.id;
    setRunningUazAction(action);
    try {
      const data = await callUazAction(action, channelId);
      if (data?.error) throw new Error(String(data.error));

      const snap = (data?.snapshot as UazInstanceSnapshot | undefined) ?? null;
      if (snap) setUazSnapshot(snap);

      await refreshChannelById(channelId);
      await refreshChannelsSilently();

      if (action === 'sync_webhook' && data?.webhookUrl) {
        toast.success('Webhook sincronizado.');
      } else if (action === 'create_instance') {
        setUazSnapshot(null);
        toast.success('Instância criada. Clique em “Conectar / Gerar QR”.');
      } else if (action === 'connect_instance') {
        if (snap?.connected) {
          stopPolling();
          toast.success('WhatsApp já está conectado.');
        } else if (snap?.qrCode || snap?.pairCode) {
          startPolling(channelId);
          toast.success('QR gerado. Escaneie no WhatsApp para conectar.');
        } else {
          startPolling(channelId);
          toast.success('Solicitação de conexão enviada.');
        }
      } else if (action === 'disconnect_instance') {
        stopPolling();
        setConnMessage(null);
        toast.success('WhatsApp desconectado.');
      } else if (action === 'status_instance') {
        if (snap?.connected) stopPolling();
        toast.success('Status atualizado.');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Falha ao executar ação UAZAPI.');
    } finally {
      setRunningUazAction(null);
    }
  };

  const copyText = async (text: string, successMessage = 'Copiado.') => {
    await run(async () => {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    }, 'Falha ao copiar.');
  };

  const toggleChannelActive = async (channel: CRMChannel) => {
    await run(async () => {
      assertNoError(await supabase
        .from('crm_channels')
        .update({ is_active: !channel.isActive })
        .eq('id', channel.id));
      await loadChannels();
    }, 'Falha ao atualizar status do canal.');
  };

  const removeChannel = async (channel: CRMChannel) => {
    const confirmed = await toast.confirm({
      title: 'Remover Canal',
      description: `Deseja realmente remover o canal "${channel.name}"? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Remover',
      variant: 'danger',
    });
    if (!confirmed) return;

    await run(async () => {
      assertNoError(await supabase.from('crm_channels').delete().eq('id', channel.id));
      toast.success('Canal removido.');
      await loadChannels();
    }, 'Falha ao remover canal.');
  };

  const liveUazStatus: CRMChannel['uazConnectionStatus'] =
    uazSnapshot?.status || formData.uazConnectionStatus || 'unknown';
  const uazConnected = uazSnapshot ? uazSnapshot.connected : formData.uazConnectionStatus === 'connected';
  const uazQrCode = uazSnapshot?.qrCode || null;
  const uazPairCode = uazSnapshot?.pairCode || null;

  const modalFooter = (
    <div className="flex justify-end gap-3">
      <button type="button" className="ios-button-secondary" onClick={() => closeChannelModal()}>
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

      <div className="ios-card p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Padrão da loja para novos leads</h3>
          <p className="text-sm text-gray-500 dark:text-surface-dark-500">
            Canais em modo herdado seguem este destino quando uma nova mensagem do cliente chega.
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-surface-dark-300 dark:bg-surface-dark-200">
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${storeAIFallbackMode === 'force_ai' ? 'bg-white text-brand-700 shadow-sm dark:bg-surface-dark-100 dark:text-brand-200' : 'text-gray-500 dark:text-surface-dark-600'}`}
            disabled={isSavingStoreRouting}
            onClick={() => void saveStoreRouting('force_ai')}
          >
            IA
          </button>
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${storeAIFallbackMode === 'force_human' ? 'bg-white text-brand-700 shadow-sm dark:bg-surface-dark-100 dark:text-brand-200' : 'text-gray-500 dark:text-surface-dark-600'}`}
            disabled={isSavingStoreRouting}
            onClick={() => void saveStoreRouting('force_human')}
          >
            Humano
          </button>
        </div>
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
                  <td className="px-4 py-6 text-sm text-gray-500" colSpan={6}>Nenhum canal CRM encontrado.</td>
                </tr>
              ) : (
                filteredChannels.map((channel) => {
                  const effectiveEntryMode = resolveEffectiveEntryMode(channel);
                  const aiReady = effectiveEntryMode === 'force_ai' && isValidAIWebhook(channel.aiResumeWebhookUrl);
                  return (
                  <tr key={channel.id} className="border-b border-gray-100 dark:border-surface-dark-300/60 text-sm">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 dark:text-white">{channel.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-200">
                        {channel.provider === 'uazapi' ? 'UAZAPI' : 'Instagram Oficial'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-surface-dark-600">
                      <p>Entrada: {channel.aiEntryMode === 'inherit' ? 'Herdar padrão' : AI_ENTRY_LABELS[channel.aiEntryMode || 'inherit']}</p>
                      <p className="text-xs text-gray-500">Destino efetivo: {effectiveEntryMode === 'force_ai' ? 'IA' : 'Humano'}</p>
                      {effectiveEntryMode === 'force_ai' ? (
                        <p className={`text-xs ${aiReady ? 'text-emerald-600' : 'text-red-600'}`}>
                          {aiReady ? 'IA pronta' : 'IA sem webhook HTTPS'}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-surface-dark-600">
                      <p>{funnelNameById.get(channel.inboundFunnelId || '') || 'Padrão do CRM'}</p>
                      <p className="text-xs text-gray-500">Etapa: {channel.inboundFunnelStage || 'new_lead'}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-surface-dark-600">
                      <p>{channel.isActive ? 'Canal ativo' : 'Canal inativo'}</p>
                      {channel.provider === 'uazapi' ? (
                        <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2 py-0.5 dark:bg-surface-dark-200">
                          <UazStatusBadge status={channel.uazConnectionStatus} />
                        </span>
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={isModalOpen}
        onClose={() => closeChannelModal()}
        title={isEditing ? 'Editar Canal CRM' : 'Novo Canal CRM'}
        size="xl"
        footer={modalFooter}
      >
        <div className="space-y-4">
          <div>
            <label className="ios-label" htmlFor="crm-channel-name">Nome do Canal</label>
            <input
              id="crm-channel-name"
              className="ios-input"
              value={formData.name}
              onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
            />
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
                <option value="">Usar padrão do CRM</option>
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

          <div>
            <label className="ios-label">Webhook de retomada da IA</label>
            <input
              className="ios-input font-mono text-xs"
              value={formData.aiResumeWebhookUrl}
              placeholder="https://seu-n8n.com/webhook/ai-agent"
              onChange={(event) => setFormData((prev) => ({ ...prev, aiResumeWebhookUrl: event.target.value }))}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-surface-dark-500">
              Endpoint HTTPS do n8n usado quando a IA assume, retoma ou recebe mensagens deste canal.
            </p>
          </div>

          <label className="flex items-start gap-3 ios-card p-3 border border-gray-200 dark:border-surface-dark-300 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={formData.isAdminConsole}
              onChange={(event) => setFormData((prev) => ({ ...prev, isAdminConsole: event.target.checked }))}
            />
            <span>
              <span className="block text-ios-subhead font-semibold text-gray-900 dark:text-white">
                Console financeiro (assistente admin)
              </span>
              <span className="block mt-0.5 text-xs text-gray-500 dark:text-surface-dark-500">
                Mensagens recebidas neste canal NÃO vão para o fluxo de clientes (Bia). Vão para o assistente financeiro interno,
                que só responde a números cadastrados na lista de administradores. Use um número dedicado.
              </span>
            </span>
          </label>

          <div>
            <label className="ios-label">Novos leads deste canal</label>
            <select
              aria-label="Novos leads deste canal"
              className="ios-input"
              value={formData.aiEntryMode}
              onChange={(event) => setFormData((prev) => ({ ...prev, aiEntryMode: event.target.value as CRMAIEntryMode }))}
            >
              <option value="inherit">Herdar padrão da loja</option>
              <option value="force_ai">IA</option>
              <option value="force_human">Humano</option>
            </select>
            <p className={`mt-1 text-xs ${resolveEffectiveEntryMode(formData) === 'force_ai' && !isValidAIWebhook(formData.aiResumeWebhookUrl) ? 'text-red-600' : 'text-gray-500 dark:text-surface-dark-500'}`}>
              {resolveEffectiveEntryMode(formData) === 'force_ai'
                ? isValidAIWebhook(formData.aiResumeWebhookUrl)
                  ? 'IA pronta para este canal.'
                  : 'Este canal cairá para humano enquanto não houver webhook HTTPS.'
                : 'Novas mensagens entrarão para atendimento humano.'}
            </p>
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
                    placeholder={`ex: ${DEFAULT_UAZ_SUBDOMAIN}`}
                    onChange={(event) => setFormData((prev) => ({ ...prev, uazSubdomain: event.target.value.toLowerCase() }))}
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-surface-dark-500">
                    Servidor UAZAPI: <span className="font-mono">{(formData.uazSubdomain.trim().toLowerCase() || DEFAULT_UAZ_SUBDOMAIN)}.uazapi.com</span>
                  </p>
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

              <div className="rounded-xl border border-gray-200 dark:border-surface-dark-300 p-4 space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Smartphone size={16} className="text-brand-500" />
                  <span className="text-ios-subhead font-semibold text-gray-900 dark:text-white">Conexão do WhatsApp</span>
                  <UazStatusBadge status={liveUazStatus} />
                  {isPollingConn ? <Loader2 size={14} className="animate-spin text-amber-500" /> : null}
                </div>

                {uazConnected ? (
                  <div className="flex items-center gap-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-3">
                    {uazSnapshot?.profilePicUrl ? (
                      <img src={uazSnapshot.profilePicUrl} alt="" className="w-11 h-11 rounded-full object-cover" />
                    ) : (
                      <span className="w-11 h-11 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                        <Smartphone size={20} />
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-emerald-700 dark:text-emerald-300 truncate">
                        {uazSnapshot?.profileName || 'WhatsApp conectado'}
                      </p>
                      <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">
                        {uazSnapshot?.connectedNumber ? `+${uazSnapshot.connectedNumber}` : 'Linha ativa e pronta para enviar/receber.'}
                      </p>
                    </div>
                  </div>
                ) : uazQrCode ? (
                  <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                    <img
                      src={uazQrCode}
                      alt="QR Code para conectar o WhatsApp"
                      className="w-44 h-44 shrink-0 rounded-lg border border-gray-200 dark:border-surface-dark-300 bg-white p-2"
                    />
                    <div className="flex-1 space-y-2 text-sm text-gray-600 dark:text-surface-dark-600">
                      <p className="font-medium text-gray-900 dark:text-white">Escaneie para conectar</p>
                      <p className="text-xs">
                        No celular: WhatsApp → <b>Aparelhos conectados</b> → <b>Conectar um aparelho</b> e aponte para o QR.
                      </p>
                      {uazPairCode ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs">ou use o código:</span>
                          <code className="px-2 py-1 rounded bg-gray-100 dark:bg-surface-dark-200 font-mono tracking-widest text-gray-900 dark:text-white">{uazPairCode}</code>
                          <button
                            type="button"
                            className="ios-button-secondary px-2 py-1 text-xs"
                            onClick={() => void copyText(uazPairCode, 'Código de pareamento copiado.')}
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      ) : null}
                      {isPollingConn ? (
                        <p className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs">
                          <Loader2 size={13} className="animate-spin" /> Aguardando leitura do QR...
                        </p>
                      ) : null}
                      {connMessage ? <p className="text-xs text-red-600 dark:text-red-400">{connMessage}</p> : null}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-surface-dark-500">
                    {connMessage
                      || (liveUazStatus === 'disconnected'
                        ? 'Número desconectado. Clique em “Conectar / Gerar QR” para parear novamente.'
                        : 'Clique em “Conectar / Gerar QR” para parear este número. Se ainda não houver instância, crie uma primeiro.')}
                  </p>
                )}

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
                    className="ios-button-primary flex items-center gap-1"
                    disabled={!formData.id || runningUazAction !== null}
                    onClick={() => void runUazAction('connect_instance')}
                  >
                    <QrCode size={14} />
                    {runningUazAction === 'connect_instance'
                      ? 'Gerando...'
                      : uazConnected
                        ? 'Reconectar'
                        : 'Conectar / Gerar QR'}
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
                  {uazConnected ? (
                    <button
                      type="button"
                      className="ios-button-secondary flex items-center gap-1 text-red-600 dark:text-red-400"
                      disabled={!formData.id || runningUazAction !== null}
                      onClick={() => void runUazAction('disconnect_instance')}
                    >
                      <Power size={14} />
                      {runningUazAction === 'disconnect_instance' ? 'Desconectando...' : 'Desconectar'}
                    </button>
                  ) : null}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
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
