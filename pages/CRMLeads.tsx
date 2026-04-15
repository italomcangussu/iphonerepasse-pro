import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Eye, RefreshCw, Search, UserRoundCheck } from 'lucide-react';
import { useData } from '../services/dataContext';
import { supabase } from '../services/supabase';
import { useToast } from '../components/ui/ToastProvider';
import type { CRMLead } from '../types';

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

  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [detail, setDetail] = useState<LeadDetailResponse | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

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

  const loadLeads = async () => {
    if (!selectedStore) return;
    setIsLoading(true);

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
        setSelectedLeadId(mapped[0].id);
      }

      if (mapped.length === 0) {
        setSelectedLeadId('');
        setDetail(null);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Falha ao carregar leads CRM.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadLeadDetail = async (leadId: string) => {
    if (!leadId) return;

    setIsDetailLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_lead_full_data', {
        p_lead_id: leadId,
      });

      if (error) throw error;
      setDetail((data || null) as LeadDetailResponse | null);
    } catch (error: any) {
      toast.error(error?.message || 'Falha ao carregar detalhe do lead.');
    } finally {
      setIsDetailLoading(false);
    }
  };

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
      await loadLeads();
      await loadLeadDetail(selectedLeadId);
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
      await loadLeads();
      await loadLeadDetail(selectedLeadId);
    } catch (error: any) {
      toast.error(error?.message || 'Falha ao mover etapa do lead.');
    }
  };

  const leadDetail = detail?.lead || null;
  const conversations = Array.isArray(detail?.conversations) ? detail?.conversations : [];
  const stageHistory = Array.isArray(detail?.stage_history) ? detail?.stage_history : [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-[28px] md:text-ios-large font-bold text-gray-900 dark:text-white tracking-tight">CRM Leads</h2>
          <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-0.5">
            Relacionamento de leads com clientes e inteligência de compra.
          </p>
        </div>
        <button type="button" className="ios-button-secondary flex items-center gap-2" onClick={() => void loadLeads()}>
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>

      <div className="ios-card p-4 md:p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="ios-label">Loja</label>
            <select className="ios-input" value={selectedStore} onChange={(event) => setSelectedStore(event.target.value)}>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="ios-label">Busca</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                className="ios-input pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nome, telefone..."
              />
            </div>
          </div>
          <div>
            <label className="ios-label">Etapa do Funil</label>
            <select className="ios-input" value={funnelStage} onChange={(event) => setFunnelStage(event.target.value)}>
              <option value="">Todas</option>
              {stageOptions.map((stage) => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="ios-label">Tipo</label>
            <select className="ios-input" value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value as 'all' | 'customer' | 'lead')}>
              <option value="all">Todos</option>
              <option value="customer">Clientes</option>
              <option value="lead">Apenas Leads</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-2 ios-card p-0 overflow-hidden">
          <div className="max-h-[70vh] overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-sm text-gray-500">Carregando leads...</div>
            ) : leads.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">Nenhum lead encontrado para os filtros atuais.</div>
            ) : (
              leads.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => setSelectedLeadId(lead.id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-surface-dark-300/60 transition-colors ${
                    selectedLeadId === lead.id ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-gray-50 dark:hover:bg-surface-dark-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{lead.name || lead.phone}</p>
                    {lead.isCustomer ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">Cliente</span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Lead</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-surface-dark-600 truncate">{lead.phone}</p>
                  <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                    <span>Etapa: {lead.funnelStage || 'new_lead'}</span>
                    <span>Compras: {lead.purchaseCount}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                    <span>{lead.sourceChannelName || 'Canal indefinido'}</span>
                    <span>R$ {(lead.lifetimeValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="xl:col-span-3 space-y-4">
          <div className="ios-card p-4 md:p-5 min-h-[240px]">
            {!selectedLead ? (
              <p className="text-sm text-gray-500">Selecione um lead para visualizar o detalhe.</p>
            ) : isDetailLoading ? (
              <p className="text-sm text-gray-500">Carregando detalhe do lead...</p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white">{leadDetail?.name || selectedLead.name || selectedLead.phone}</h3>
                    <p className="text-sm text-gray-600 dark:text-surface-dark-600">{leadDetail?.phone || selectedLead.phone}</p>
                    {leadDetail?.email && <p className="text-sm text-gray-600 dark:text-surface-dark-600">{leadDetail.email}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="ios-button-secondary flex items-center gap-2" onClick={() => void loadLeadDetail(selectedLead.id)}>
                      <Eye size={14} />
                      Recarregar
                    </button>
                    {!selectedLead.isCustomer && (
                      <button type="button" className="ios-button-primary flex items-center gap-2" onClick={() => void markAsCustomer()}>
                        <UserRoundCheck size={14} />
                        Marcar Cliente
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-ios-lg border border-gray-200 dark:border-surface-dark-300 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Status Cliente</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                      {selectedLead.isCustomer ? 'Cliente reconhecido' : 'Lead ainda não convertido'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Customer ID: {selectedLead.customerId || '-'}</p>
                  </div>

                  <div className="rounded-ios-lg border border-gray-200 dark:border-surface-dark-300 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Compras</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{selectedLead.purchaseCount} compra(s)</p>
                    <p className="text-xs text-gray-500 mt-1">Última compra: {selectedLead.lastPurchaseAt ? new Date(selectedLead.lastPurchaseAt).toLocaleString('pt-BR') : '-'}</p>
                  </div>
                </div>

                <div className="rounded-ios-lg border border-gray-200 dark:border-surface-dark-300 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Último Pedido</p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedLead.lastOrderId || '-'}</p>
                  <p className="text-sm text-gray-700 dark:text-surface-dark-600">{selectedLead.lastOrderSummary || '-'}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Valor: R$ {(selectedLead.lastOrderValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="rounded-ios-lg border border-gray-200 dark:border-surface-dark-300 p-3">
                  <label className="ios-label">Mover Etapa</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {stageOptions.map((stage) => (
                      <button
                        key={stage}
                        type="button"
                        onClick={() => void moveLeadStage(stage)}
                        className={`px-3 py-1.5 rounded-ios text-xs border ${
                          (selectedLead.funnelStage || 'new_lead') === stage
                            ? 'bg-brand-50 border-brand-300 text-brand-700'
                            : 'bg-white dark:bg-surface-dark-200 border-gray-200 dark:border-surface-dark-300 text-gray-600 dark:text-surface-dark-600'
                        }`}
                      >
                        {(selectedLead.funnelStage || 'new_lead') === stage ? <CheckCircle2 size={12} className="inline mr-1" /> : null}
                        {stage}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="ios-card p-4 md:p-5">
            <h4 className="text-ios-subhead font-semibold text-gray-900 dark:text-white mb-3">Histórico de Conversas</h4>
            {conversations.length === 0 ? (
              <p className="text-sm text-gray-500">Sem conversas registradas.</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {conversations.map((conversation: any) => (
                  <div key={conversation.id} className="rounded-ios-lg border border-gray-200 dark:border-surface-dark-300 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Conversa {String(conversation.id).slice(0, 8)}</p>
                      <span className="text-xs text-gray-500">{conversation.status || 'open'}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Mensagens: {conversation.message_count || 0} | Não lidas: {conversation.unread_count || 0}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="ios-card p-4 md:p-5">
            <h4 className="text-ios-subhead font-semibold text-gray-900 dark:text-white mb-3">Histórico de Etapas</h4>
            {stageHistory.length === 0 ? (
              <p className="text-sm text-gray-500">Sem histórico de movimentação.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {stageHistory.map((item: any) => (
                  <div key={item.id} className="text-sm text-gray-700 dark:text-surface-dark-600 border-b border-gray-100 dark:border-surface-dark-300/60 pb-2">
                    <p>
                      {item.from_stage || '-'} → <strong>{item.to_stage || '-'}</strong>
                    </p>
                    <p className="text-xs text-gray-500">{item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '-'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CRMLeads;
