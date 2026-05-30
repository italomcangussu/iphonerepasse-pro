import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, RefreshCw, Save, Trash2 } from 'lucide-react';
import CRMPageFrame from '../../components/crm/CRMPageFrame';
import { supabase } from '../../services/supabase';
import { useToast } from '../../components/ui/ToastProvider';
import { useCRMStore } from '../../components/crm/useCRMStore';
import { assertNoError } from '../../utils/supabase';

type AgentConfig = {
  id: string;
  store_id: string;
  name: string;
  model: string;
  system_prompt: string | null;
  is_active: boolean | null;
  behavior_modes: string[] | null;
  auto_send_response: boolean | null;
  channel_ids: string[] | null;
  total_invocations: number | null;
  total_successes: number | null;
  total_failures: number | null;
};

type Channel = {
  id: string;
  name: string | null;
  provider: string | null;
  ai_resume_webhook_url: string | null;
};

type Invocation = {
  id: string;
  agent_config_id: string | null;
  source: string;
  status: string;
  routing_reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const EMPTY_AGENT: AgentConfig = {
  id: '',
  store_id: '',
  name: 'Agente CRM',
  model: 'gpt-4.1-mini',
  system_prompt: '',
  is_active: false,
  behavior_modes: ['auto_response', 'lead_qualification', 'sentiment_analysis'],
  auto_send_response: true,
  channel_ids: [],
  total_invocations: 0,
  total_successes: 0,
  total_failures: 0,
};

const BEHAVIOR_MODES = [
  { value: 'auto_response', label: 'Resposta automática' },
  { value: 'lead_qualification', label: 'Qualificação' },
  { value: 'sentiment_analysis', label: 'Escala por sentimento' },
  { value: 'suggest_response', label: 'Sugestão para humano' },
];

const AISettingsPage: React.FC = () => {
  const { selectedStoreId } = useCRMStore();
  const toast = useToast();
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [invocations, setInvocations] = useState<Invocation[]>([]);
  const [draft, setDraft] = useState<AgentConfig>(EMPTY_AGENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedAgentInvocations = useMemo(
    () => invocations.filter((item) => !draft.id || item.agent_config_id === draft.id),
    [draft.id, invocations],
  );

  const loadData = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const [agentResult, channelResult, invocationResult] = await Promise.all([
        supabase
          .from('crm_ai_agent_configs')
          .select('*')
          .eq('store_id', selectedStoreId)
          .order('created_at', { ascending: false }),
        supabase
          .from('crm_channels')
          .select('id,name,provider,ai_resume_webhook_url')
          .eq('store_id', selectedStoreId)
          .eq('is_active', true)
          .order('name', { ascending: true }),
        supabase
          .from('crm_ai_agent_invocations')
          .select('id,agent_config_id,source,status,routing_reason,metadata,created_at')
          .eq('store_id', selectedStoreId)
          .order('created_at', { ascending: false })
          .limit(40),
      ]);

      const agentRows = assertNoError(agentResult) as AgentConfig[];
      setAgents(agentRows);
      setChannels((assertNoError(channelResult) || []) as Channel[]);
      setInvocations((assertNoError(invocationResult) || []) as Invocation[]);
      setDraft(agentRows[0] || { ...EMPTY_AGENT, store_id: selectedStoreId });
    } catch (error) {
      toast.error((error as Error)?.message || 'Falha ao carregar agentes IA.');
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const toggleBehaviorMode = (mode: string) => {
    setDraft((prev) => {
      const modes = new Set(prev.behavior_modes || []);
      if (modes.has(mode)) modes.delete(mode);
      else modes.add(mode);
      return { ...prev, behavior_modes: Array.from(modes) };
    });
  };

  const toggleChannel = (channelId: string) => {
    setDraft((prev) => {
      const ids = new Set(prev.channel_ids || []);
      if (ids.has(channelId)) ids.delete(channelId);
      else ids.add(channelId);
      return { ...prev, channel_ids: Array.from(ids) };
    });
  };

  const saveAgent = async () => {
    if (!selectedStoreId) return;
    if (!draft.name.trim()) return toast.warning('Informe o nome do agente.');

    setSaving(true);
    try {
      const payload = {
        store_id: selectedStoreId,
        name: draft.name.trim(),
        model: draft.model.trim() || 'gpt-4.1-mini',
        system_prompt: draft.system_prompt?.trim() || null,
        is_active: Boolean(draft.is_active),
        behavior_modes: draft.behavior_modes || [],
        auto_send_response: Boolean(draft.auto_send_response),
        channel_ids: draft.channel_ids || [],
      };

      if (draft.id) {
        assertNoError(await supabase.from('crm_ai_agent_configs').update(payload).eq('id', draft.id));
      } else {
        const created = assertNoError(await supabase.from('crm_ai_agent_configs').insert(payload).select('*').single()) as AgentConfig;
        setDraft(created);
      }
      toast.success('Agente IA salvo.');
      await loadData();
    } catch (error) {
      toast.error((error as Error)?.message || 'Falha ao salvar agente IA.');
    } finally {
      setSaving(false);
    }
  };

  const deleteAgent = async () => {
    if (!draft.id) return;
    if (!window.confirm('Excluir este agente IA?')) return;
    assertNoError(await supabase.from('crm_ai_agent_configs').delete().eq('id', draft.id));
    toast.success('Agente IA excluído.');
    await loadData();
  };

  return (
    <CRMPageFrame
      title="Agentes IA"
      description="Configuração, teste e logs dos agentes externos conectados via n8n/webhook."
    >
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white"
            onClick={() => setDraft({ ...EMPTY_AGENT, store_id: selectedStoreId })}
          >
            <Bot size={16} /> Novo agente
          </button>
          {loading ? (
            <p className="p-3 text-sm text-slate-500">Carregando...</p>
          ) : agents.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">Nenhum agente configurado.</p>
          ) : (
            <div className="space-y-2">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  className={`w-full rounded-xl border p-3 text-left text-sm transition-colors ${agent.id === draft.id ? 'border-brand-300 bg-brand-50 text-brand-900 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-100' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}`}
                  onClick={() => setDraft(agent)}
                >
                  <span className="block font-semibold">{agent.name}</span>
                  <span className="text-xs text-slate-500">{agent.is_active ? 'Ativo' : 'Inativo'} · {agent.total_invocations || 0} chamadas</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="ios-label">Nome</span>
                <input className="ios-input" value={draft.name} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} />
              </label>
              <label className="block">
                <span className="ios-label">Modelo</span>
                <input className="ios-input" value={draft.model} onChange={(event) => setDraft((prev) => ({ ...prev, model: event.target.value }))} />
              </label>
            </div>
            <label className="mt-4 block">
              <span className="ios-label">System prompt</span>
              <textarea className="ios-input min-h-28" value={draft.system_prompt || ''} onChange={(event) => setDraft((prev) => ({ ...prev, system_prompt: event.target.value }))} />
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              {BEHAVIOR_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${draft.behavior_modes?.includes(mode.value) ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                  onClick={() => toggleBehaviorMode(mode.value)}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={Boolean(draft.is_active)} onChange={(event) => setDraft((prev) => ({ ...prev, is_active: event.target.checked }))} />
                Ativo
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={Boolean(draft.auto_send_response)} onChange={(event) => setDraft((prev) => ({ ...prev, auto_send_response: event.target.checked }))} />
                Auto enviar
              </label>
            </div>

            <div className="mt-4">
              <p className="ios-label">Canais vinculados</p>
              <div className="grid gap-2 md:grid-cols-2">
                {channels.map((channel) => (
                  <label key={channel.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                    <span>
                      <span className="block font-semibold">{channel.name || channel.provider}</span>
                      <span className={channel.ai_resume_webhook_url?.startsWith('https://') ? 'text-xs text-emerald-600' : 'text-xs text-red-600'}>
                        {channel.ai_resume_webhook_url?.startsWith('https://') ? 'Webhook IA configurado' : 'Sem webhook IA'}
                      </span>
                    </span>
                    <input type="checkbox" checked={Boolean(draft.channel_ids?.includes(channel.id))} onChange={() => toggleChannel(channel.id)} />
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className="ios-button-primary inline-flex items-center gap-2" disabled={saving} onClick={() => void saveAgent()}>
                <Save size={16} /> {saving ? 'Salvando...' : 'Salvar'}
              </button>
              {draft.id && (
                <button type="button" className="ios-button-secondary inline-flex items-center gap-2 text-red-600" onClick={() => void deleteAgent()}>
                  <Trash2 size={16} /> Excluir
                </button>
              )}
              <button type="button" className="ios-button-secondary inline-flex items-center gap-2" onClick={() => void loadData()}>
                <RefreshCw size={16} /> Atualizar
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-slate-100">Invocações recentes</h3>
            <div className="space-y-2">
              {selectedAgentInvocations.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum log recente.</p>
              ) : selectedAgentInvocations.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{item.source} · {item.routing_reason || 'sem roteamento'}</span>
                    <span className={item.status === 'success' ? 'text-emerald-600' : 'text-red-600'}>{item.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{new Date(item.created_at).toLocaleString('pt-BR')}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </CRMPageFrame>
  );
};

export default AISettingsPage;
