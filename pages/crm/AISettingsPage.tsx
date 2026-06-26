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

const INVOCATION_STATUS: Record<string, string> = {
  success: 'Sucesso',
  error: 'Falha',
  dispatched: 'Despachado',
  pending: 'Pendente',
  skipped: 'Ignorado',
};

function IOSSwitch({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 min-h-[44px]">
      <span id={id} className="text-sm font-semibold text-slate-700 dark:text-slate-200 select-none">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        onClick={() => onChange(!checked)}
        style={{ WebkitTapHighlightColor: 'transparent' }}
        className={`relative inline-flex h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
          checked ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-ios26-sm transition-transform duration-200 ${
            checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
          }`}
        />
      </button>
    </div>
  );
}

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
    const confirmed = await toast.confirm({
      title: 'Excluir agente IA',
      description: `O agente "${draft.name}" será excluído permanentemente.`,
      confirmLabel: 'Excluir',
      variant: 'danger',
    });
    if (!confirmed) return;
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
        <aside className="crm-card p-3">
          <button
            type="button"
            className="crm-btn crm-btn-primary mb-3 w-full justify-center"
            onClick={() => setDraft({ ...EMPTY_AGENT, store_id: selectedStoreId })}
          >
            <Bot size={16} /> Novo agente
          </button>
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
              ))}
            </div>
          ) : agents.length === 0 ? (
            <p className="p-3 text-sm text-slate-500 dark:text-slate-400">Nenhum agente configurado.</p>
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
                  <span className="text-xs text-slate-500 dark:text-slate-400">{agent.is_active ? 'Ativo' : 'Inativo'} · {agent.total_invocations || 0} chamadas</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="space-y-4">
          <div className="crm-card p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="crm-field-label">Nome</span>
                <input className="crm-input" value={draft.name} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} />
              </label>
              <label className="block">
                <span className="crm-field-label">Modelo</span>
                <input className="crm-input" value={draft.model} onChange={(event) => setDraft((prev) => ({ ...prev, model: event.target.value }))} />
              </label>
            </div>
            <label className="mt-4 block">
              <span className="crm-field-label">System prompt</span>
              <textarea className="crm-input min-h-28" value={draft.system_prompt || ''} onChange={(event) => setDraft((prev) => ({ ...prev, system_prompt: event.target.value }))} />
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              {BEHAVIOR_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  className={`min-h-[44px] px-4 rounded-full text-xs font-semibold transition-colors ${draft.behavior_modes?.includes(mode.value) ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                  onClick={() => toggleBehaviorMode(mode.value)}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-1 md:grid-cols-2">
              <IOSSwitch
                id="is-active"
                checked={Boolean(draft.is_active)}
                onChange={(v) => setDraft((prev) => ({ ...prev, is_active: v }))}
                label="Agente ativo"
              />
              <IOSSwitch
                id="auto-send"
                checked={Boolean(draft.auto_send_response)}
                onChange={(v) => setDraft((prev) => ({ ...prev, auto_send_response: v }))}
                label="Auto enviar resposta"
              />
            </div>

            <div className="mt-4">
              <p className="crm-field-label">Canais vinculados</p>
              <div className="grid gap-2 md:grid-cols-2">
                {channels.map((channel) => (
                  <label key={channel.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                    <span>
                      <span className="block font-semibold text-slate-900 dark:text-slate-100">{channel.name || channel.provider}</span>
                      <span className={channel.ai_resume_webhook_url?.startsWith('https://') ? 'text-xs text-emerald-600 dark:text-emerald-400' : 'text-xs text-red-600 dark:text-red-400'}>
                        {channel.ai_resume_webhook_url?.startsWith('https://') ? 'Webhook IA configurado' : 'Sem webhook IA'}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      checked={Boolean(draft.channel_ids?.includes(channel.id))}
                      onChange={() => toggleChannel(channel.id)}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className="crm-btn crm-btn-primary" disabled={saving} onClick={() => void saveAgent()}>
                <Save size={16} /> {saving ? 'Salvando...' : 'Salvar'}
              </button>
              {draft.id && (
                <button type="button" className="crm-btn crm-btn-secondary text-red-600 dark:text-red-400 border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => void deleteAgent()}>
                  <Trash2 size={16} /> Excluir
                </button>
              )}
              <button type="button" className="crm-btn crm-btn-secondary" onClick={() => void loadData()}>
                <RefreshCw size={16} /> Atualizar
              </button>
            </div>
          </div>

          <div className="crm-card p-4">
            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-slate-100">Invocações recentes</h3>
            <div className="space-y-2">
              {selectedAgentInvocations.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum log recente.</p>
              ) : selectedAgentInvocations.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{item.source} · {item.routing_reason || 'sem roteamento'}</span>
                    <span className={item.status === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                      {INVOCATION_STATUS[item.status] ?? item.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{new Date(item.created_at).toLocaleString('pt-BR')}</p>
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
