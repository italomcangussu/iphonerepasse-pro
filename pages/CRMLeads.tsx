import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Eye, RefreshCw, Search, UserRound, UserRoundCheck } from 'lucide-react';
import { useData } from '../services/dataContext';
import { supabase } from '../services/supabase';
import { useToast } from '../components/ui/ToastProvider';
import type { CRMLead } from '../types';
import CRMPageFrame from '../components/crm/CRMPageFrame';

type LeadRow = CRMLead & {
  customerName?: string | null;
  sourceChannelName?: string | null;
  sourceChannelProvider?: string | null;
  conversationId?: string | null;
  conversationStatus?: string | null;
  unreadCount?: number;
  messageCount?: number;
};

type LeadDetailResponse = {
  success: boolean;
  lead?: any;
  conversations?: any[];
  stage_history?: any[];
};

const MOBILE_MEDIA_QUERY = '(max-width: 1023px)';

const mapLeadRow = (raw: any): LeadRow => ({
  id: raw.id,
  storeId: raw.store_id,
  sourceChannelId: raw.source_channel_id,
  name: raw.name,
  phone: raw.phone,
  email: raw.email,
  funnelId: raw.funnel_id,
  funnelStage: raw.funnel_stage,
  intent: raw.intent,
  isCustomer: Boolean(raw.is_customer),
  customerId: raw.customer_id,
  purchaseCount: Number(raw.purchase_count || 0),
  lastPurchaseAt: raw.last_purchase_at,
  lastOrderId: raw.last_order_id,
  lastOrderAt: raw.last_order_at,
  lastOrderValue: raw.last_order_value != null ? Number(raw.last_order_value) : null,
  lastOrderSummary: raw.last_order_summary,
  lifetimeValue: raw.lifetime_value != null ? Number(raw.lifetime_value) : null,
  lastInteractionAt: raw.last_interaction_at,
  createdAt: raw.created_at,
  updatedAt: raw.updated_at,
  customerName: raw.customer_name || null,
  sourceChannelName: raw.source_channel_name || null,
  sourceChannelProvider: raw.source_channel_provider || null,
  conversationId: raw.conversation_id || null,
  conversationStatus: raw.conversation_status || null,
  unreadCount: Number(raw.unread_count || 0),
  messageCount: Number(raw.message_count || 0),
});

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR');
};

const providerLabel = (provider: string | null | undefined) => {
  if (provider === 'uazapi') return 'UAZAPI';
  if (provider === 'instagram_official') return 'Instagram Oficial';
  return provider || 'Canal indefinido';
};

const CRMLeads: React.FC = () => {
  const { stores } = useData();
  const toast = useToast();

  const [selectedStore, setSelectedStore] = useState('');
  const [search, setSearch] = useState('');
  const [funnelStage, setFunnelStage] = useState('');
  const [customerFilter, setCustomerFilter] = useState<'all' | 'customer' | 'lead'>('all');

  const [stageOptions, setStageOptions] = useState<string[]>([]);

  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [detail, setDetail] = useState<LeadDetailResponse | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
  });
  const isMobileViewportRef = useRef(isMobileViewport);

  useEffect(() => {
    isMobileViewportRef.current = isMobileViewport;
  }, [isMobileViewport]);

  const selectedLead = useMemo(() => leads.find((lead) => lead.id === selectedLeadId) || null, [leads, selectedLeadId]);

  const loadStageOptions = async () => {
    try {
      const { data, error } = await supabase
        .from('crm_funnel_stages')
        .select('id')
        .eq('funnel_type', 'sales')
        .eq('is_active', true)
        .order('order', { ascending: true });

      if (error) throw error;
      setStageOptions((data || []).map((item: any) => String(item.id)));
    } catch (error: any) {
      toast.error(error?.message || 'Falha ao carregar etapas do funil.');
    }
  };

  const loadLeads = async (options?: { showLoader?: boolean; silent?: boolean }) => {
    if (!selectedStore) return;

    const showLoader = options?.showLoader ?? true;
    const silent = options?.silent ?? false;
    if (showLoader) setIsLoading(true);

    try {
      const filters: Record<string, unknown> = {};
      if (search.trim()) filters.search = search.trim();
      if (funnelStage.trim()) filters.funnel_stage = funnelStage.trim();
      if (customerFilter === 'customer') filters.is_customer = true;
      if (customerFilter === 'lead') filters.is_customer = false;

      const { data, error } = await supabase.rpc('search_leads', {
        p_store_id: selectedStore,
        p_filters: filters,
        p_limit: 100,
        p_offset: 0,
      });

      if (error) throw error;

      const rows = Array.isArray((data as any)?.items)
        ? (data as any).items
        : Array.isArray(data)
          ? data
          : [];

      const mapped = rows.map(mapLeadRow);
      setLeads(mapped);

      if (mapped.length > 0 && (!selectedLeadId || !mapped.some((lead) => lead.id === selectedLeadId))) {
        setSelectedLeadId(isMobileViewportRef.current ? '' : mapped[0].id);
      }

      if (mapped.length === 0) {
        setSelectedLeadId('');
        setDetail(null);
      }
    } catch (error: any) {
      if (!silent) {
        toast.error(error?.message || 'Falha ao carregar leads CRM.');
      }
    } finally {
      if (showLoader) setIsLoading(false);
    }
  };

  const loadLeadDetail = async (leadId: string, options?: { silent?: boolean }) => {
    if (!leadId) return;

    const silent = options?.silent ?? false;
    setIsDetailLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_lead_full_data', {
        p_lead_id: leadId,
      });

      if (error) throw error;
      setDetail((data || null) as LeadDetailResponse | null);
    } catch (error: any) {
      if (!silent) {
        toast.error(error?.message || 'Falha ao carregar detalhe do lead.');
      }
    } finally {
      setIsDetailLoading(false);
    }
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const onMediaChange = (event: MediaQueryListEvent) => setIsMobileViewport(event.matches);

    setIsMobileViewport(mediaQuery.matches);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', onMediaChange);
      return () => mediaQuery.removeEventListener('change', onMediaChange);
    }

    mediaQuery.addListener(onMediaChange);
    return () => mediaQuery.removeListener(onMediaChange);
  }, []);

  useEffect(() => {
    void loadStageOptions();
  }, []);

  useEffect(() => {
    if (!selectedStore && stores.length > 0) {
      setSelectedStore(stores[0].id);
    }
  }, [selectedStore, stores]);

  useEffect(() => {
    void loadLeads();
  }, [selectedStore, search, funnelStage, customerFilter]);

  useEffect(() => {
    if (selectedLeadId) {
      void loadLeadDetail(selectedLeadId);
    }
  }, [selectedLeadId]);

  useEffect(() => {
    if (!selectedStore) return;

    const intervalId = window.setInterval(() => {
      void loadLeads({ showLoader: false, silent: true });
      if (selectedLeadId) {
        void loadLeadDetail(selectedLeadId, { silent: true });
      }
    }, 25_000);

    return () => window.clearInterval(intervalId);
  }, [selectedStore, selectedLeadId, search, funnelStage, customerFilter]);

  useEffect(() => {
    if (!selectedStore) return;

    const handleFocus = () => {
      void loadLeads({ showLoader: false, silent: true });
      if (selectedLeadId) {
        void loadLeadDetail(selectedLeadId, { silent: true });
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [selectedStore, selectedLeadId, search, funnelStage, customerFilter]);

  useEffect(() => {
    if (!isMobileViewport && !selectedLeadId && leads.length > 0) {
      setSelectedLeadId(leads[0].id);
    }
  }, [isMobileViewport, leads, selectedLeadId]);

  const markAsCustomer = async () => {
    if (!selectedLeadId) return;

    try {
      const { data, error } = await supabase.rpc('mark_lead_as_customer', {
        p_lead_id: selectedLeadId,
        p_customer_id: null,
      });

      if (error) throw error;
      const success = Boolean((data as any)?.success ?? true);
      if (!success) {
        toast.error((data as any)?.error || 'Não foi possível marcar como cliente.');
        return;
      }

      toast.success('Lead marcado como cliente.');
      await loadLeads({ showLoader: false });
      await loadLeadDetail(selectedLeadId, { silent: true });
    } catch (error: any) {
      toast.error(error?.message || 'Falha ao marcar lead como cliente.');
    }
  };

  const moveLeadStage = async (toStage: string) => {
    if (!selectedLeadId || !toStage) return;

    try {
      const { error } = await supabase.rpc('move_crm_lead_stage', {
        p_lead_id: selectedLeadId,
        p_to_stage: toStage,
        p_to_funnel_id: null,
        p_changed_by: null,
        p_notes: 'crm_leads_ui',
      });

      if (error) throw error;
      toast.success(`Lead movido para etapa: ${toStage}.`);
      await loadLeads({ showLoader: false });
      await loadLeadDetail(selectedLeadId, { silent: true });
    } catch (error: any) {
      toast.error(error?.message || 'Falha ao mover etapa do lead.');
    }
  };

  const refreshAll = async () => {
    setIsRefreshing(true);
    await loadLeads({ showLoader: false });
    if (selectedLeadId) {
      await loadLeadDetail(selectedLeadId, { silent: true });
    }
    setIsRefreshing(false);
  };

  const leadDetail = detail?.lead || null;
  const conversations = Array.isArray(detail?.conversations) ? detail?.conversations : [];
  const stageHistory = Array.isArray(detail?.stage_history) ? detail?.stage_history : [];

  const listVisible = !isMobileViewport || !selectedLeadId;
  const detailVisible = !isMobileViewport || Boolean(selectedLeadId);

  return (
    <CRMPageFrame
      title="CRM Leads"
      description="Triagem, qualificação e conversão de leads com contexto de compra e canal."
      actions={(
        <button type="button" className="crm-btn crm-btn-secondary" onClick={() => void refreshAll()} disabled={isRefreshing}>
          <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          {isRefreshing ? 'Atualizando' : 'Atualizar'}
        </button>
      )}
    >
      <div className="crm-card overflow-hidden">
        <div className="flex h-[76vh] min-h-[600px]">
          <aside
            className={`w-full lg:w-[380px] lg:shrink-0 border-r border-slate-200/70 dark:border-slate-700/70 bg-white/90 dark:bg-slate-900/80 backdrop-blur ${listVisible ? 'flex' : 'hidden'} flex-col`}
          >
            <div className="sticky top-0 z-10 border-b border-slate-200/70 dark:border-slate-700/70 bg-white/95 dark:bg-slate-900/95 px-4 py-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {leads.length} lead(s)
                </p>
                <span className="inline-flex rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
                  Store CRM
                </span>
              </div>

              <div className="space-y-2">
                <label className="space-y-1 block">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Loja</span>
                  <select className="crm-input" value={selectedStore} onChange={(event) => setSelectedStore(event.target.value)}>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>{store.name}</option>
                    ))}
                  </select>
                </label>

                <label className="relative block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input
                    className="crm-input w-full pl-9"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar nome ou telefone"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1 block">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Etapa</span>
                    <select className="crm-input" value={funnelStage} onChange={(event) => setFunnelStage(event.target.value)}>
                      <option value="">Todas</option>
                      {stageOptions.map((stage) => (
                        <option key={stage} value={stage}>{stage}</option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tipo</span>
                    <select className="crm-input" value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value as 'all' | 'customer' | 'lead')}>
                      <option value="all">Todos</option>
                      <option value="customer">Clientes</option>
                      <option value="lead">Leads</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-sm text-slate-500">Carregando leads...</div>
              ) : leads.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">Nenhum lead encontrado para os filtros atuais.</div>
              ) : (
                leads.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => setSelectedLeadId(lead.id)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-100/90 dark:border-slate-800 transition-colors ${
                      selectedLeadId === lead.id
                        ? 'bg-brand-50/90 dark:bg-brand-500/12'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                          <UserRound size={14} />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{lead.name || lead.phone}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{lead.phone}</p>
                        </div>
                      </div>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${lead.isCustomer ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200'}`}>
                        {lead.isCustomer ? 'Cliente' : 'Lead'}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="truncate">Etapa: {lead.funnelStage || 'new_lead'}</span>
                      <span>Compras: {lead.purchaseCount}</span>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="truncate">{lead.sourceChannelName || 'Canal indefinido'}</span>
                      <span>R$ {(lead.lifetimeValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className={`flex-1 min-w-0 bg-slate-50/70 dark:bg-slate-950/70 ${detailVisible ? 'flex' : 'hidden'} flex-col`}>
            {selectedLead ? (
              <>
                <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200/70 dark:border-slate-700/70 bg-white/95 dark:bg-slate-900/95 px-4 py-3 backdrop-blur">
                  {isMobileViewport ? (
                    <button
                      type="button"
                      onClick={() => setSelectedLeadId('')}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      aria-label="Voltar para lista"
                    >
                      <ArrowLeft size={16} />
                    </button>
                  ) : null}

                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
                    <UserRound size={16} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{leadDetail?.name || selectedLead.name || selectedLead.phone}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{leadDetail?.phone || selectedLead.phone}</p>
                  </div>

                  {!selectedLead.isCustomer && (
                    <button type="button" className="crm-btn crm-btn-primary" onClick={() => void markAsCustomer()}>
                      <UserRoundCheck size={14} />
                      Marcar Cliente
                    </button>
                  )}
                </header>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {isDetailLoading ? (
                    <p className="text-sm text-slate-500">Carregando detalhe do lead...</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                        <article className="crm-card p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Status Cliente</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {selectedLead.isCustomer ? 'Cliente reconhecido' : 'Lead ainda não convertido'}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">Customer ID: {selectedLead.customerId || '-'}</p>
                        </article>

                        <article className="crm-card p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Compras</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedLead.purchaseCount} compra(s)</p>
                          <p className="text-xs text-slate-500 mt-1">Última compra: {formatDateTime(selectedLead.lastPurchaseAt)}</p>
                        </article>

                        <article className="crm-card p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Lifetime Value</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                            R$ {(selectedLead.lifetimeValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">Canal: {providerLabel(selectedLead.sourceChannelProvider)}</p>
                        </article>
                      </div>

                      <article className="crm-card p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Dados do lead</h3>
                          <button type="button" className="crm-btn crm-btn-secondary" onClick={() => void loadLeadDetail(selectedLead.id)}>
                            <Eye size={14} />
                            Recarregar
                          </button>
                        </div>
                        {leadDetail?.email && <p className="text-sm text-slate-700 dark:text-slate-300">Email: {leadDetail.email}</p>}
                        <p className="text-sm text-slate-700 dark:text-slate-300">Telefone: {leadDetail?.phone || selectedLead.phone}</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">Último pedido: {selectedLead.lastOrderId || '-'}</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">Resumo: {selectedLead.lastOrderSummary || '-'}</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          Valor último pedido: R$ {(selectedLead.lastOrderValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </article>

                      <article className="crm-card p-4 space-y-3">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Mover Etapa</h3>
                        <div className="flex flex-wrap gap-2">
                          {stageOptions.map((stage) => (
                            <button
                              key={stage}
                              type="button"
                              onClick={() => void moveLeadStage(stage)}
                              className={`px-3 py-1.5 rounded-xl text-xs border transition-colors ${
                                (selectedLead.funnelStage || 'new_lead') === stage
                                  ? 'bg-brand-50 border-brand-300 text-brand-700 dark:bg-brand-500/15 dark:border-brand-500/40 dark:text-brand-200'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                              }`}
                            >
                              {(selectedLead.funnelStage || 'new_lead') === stage ? <CheckCircle2 size={12} className="inline mr-1" /> : null}
                              {stage}
                            </button>
                          ))}
                        </div>
                      </article>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <article className="crm-card p-4">
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Histórico de Conversas</h4>
                          {conversations.length === 0 ? (
                            <p className="text-sm text-slate-500">Sem conversas registradas.</p>
                          ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                              {conversations.map((conversation: any) => (
                                <div key={conversation.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Conversa {String(conversation.id).slice(0, 8)}</p>
                                    <span className="text-xs text-slate-500">{conversation.status || 'open'}</span>
                                  </div>
                                  <p className="text-xs text-slate-500 mt-1">Mensagens: {conversation.message_count || 0} | Não lidas: {conversation.unread_count || 0}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </article>

                        <article className="crm-card p-4">
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Histórico de Etapas</h4>
                          {stageHistory.length === 0 ? (
                            <p className="text-sm text-slate-500">Sem histórico de movimentação.</p>
                          ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                              {stageHistory.map((item: any) => (
                                <div key={item.id} className="text-sm text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">
                                  <p>
                                    {item.from_stage || '-'} → <strong>{item.to_stage || '-'}</strong>
                                  </p>
                                  <p className="text-xs text-slate-500">{item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '-'}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </article>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center px-6 text-center">
                <div className="max-w-sm space-y-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Selecione um lead</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Escolha um lead na lista para visualizar contexto, histórico e ações de conversão.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </CRMPageFrame>
  );
};

export default CRMLeads;
