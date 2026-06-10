import React from 'react';
import { AlertCircle, Bot, CheckCircle2, Clock3, GitCompare, ReceiptText } from 'lucide-react';
import {
  getMissingTradeInFields,
  type TradeInField,
} from '../../lib/crm/commerceState';
import type { AICommerceSnapshot } from '../../lib/crm/aiCommerceSnapshot';

type Props = {
  loading: boolean;
  snapshot: AICommerceSnapshot | null;
};

const FIELD_LABELS: Record<TradeInField, string> = {
  capacity: 'Armazenamento',
  color: 'Cor',
  scratches: 'Arranhões',
  liquid_contact: 'Contato com líquido',
  side_marks: 'Marcas laterais',
  parts_swapped: 'Peças trocadas',
  has_box_cable: 'Caixa e cabo',
  battery_pct: 'Bateria',
  apple_warranty: 'Garantia Apple',
  warranty_until: 'Validade da garantia',
};

const ACTION_LABELS: Record<string, string> = {
  ask_tradein_consent: 'Aguardando autorização para avaliação',
  send_tradein_questionnaire: 'Questionário de troca pendente',
  search_inventory: 'Busca de estoque pendente',
  simulate_quote: 'Pronto para simular',
  ask_missing_fields: 'Dados comerciais pendentes',
};

const MODE_LABELS: Record<string, string> = {
  single: 'Individual',
  comparison: 'Comparação',
  bundle: 'Compra conjunta',
};

const formatEventTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Horário indisponível'
    : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const AICommerceStatePanel: React.FC<Props> = ({ loading, snapshot }) => {
  if (loading) {
    return <div className="h-28 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" aria-label="Carregando estado comercial" />;
  }

  if (!snapshot) {
    return (
      <div className="flex items-start gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
        <Bot className="mt-0.5 shrink-0 text-slate-400" size={18} />
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Estado comercial ainda não iniciado</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">A IA ainda não persistiu decisões comerciais para este lead.</p>
        </div>
      </div>
    );
  }

  const missingFields = snapshot.commerceState.has_trade_in
    ? getMissingTradeInFields(snapshot.tradeInAssessment)
    : [];
  const nextAction = snapshot.commerceState.next_action || (missingFields.length > 0 ? 'send_tradein_questionnaire' : 'simulate_quote');
  const ready = nextAction === 'simulate_quote';

  return (
    <section className="border-t border-slate-200 pt-4 dark:border-slate-700" aria-labelledby="ai-commerce-state-title">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Bot className="shrink-0 text-brand-600 dark:text-brand-300" size={18} />
          <h3 id="ai-commerce-state-title" className="truncate text-sm font-bold text-slate-950 dark:text-slate-50">Estado comercial da IA</h3>
        </div>
        <span className="shrink-0 text-[11px] font-semibold text-slate-400">v{snapshot.stateVersion}</span>
      </div>

      <div className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5 ${ready ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200' : 'bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200'}`}>
        {ready ? <CheckCircle2 className="mt-0.5 shrink-0" size={16} /> : <AlertCircle className="mt-0.5 shrink-0" size={16} />}
        <p className="text-sm font-semibold">{ACTION_LABELS[nextAction] || nextAction}</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <p className="text-[11px] font-bold uppercase text-slate-400">Modo</p>
          <p className="mt-1 flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
            <GitCompare size={14} />
            {MODE_LABELS[snapshot.commerceState.simulation_mode || 'single'] || snapshot.commerceState.simulation_mode}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase text-slate-400">Cotações</p>
          <p className="mt-1 flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
            <ReceiptText size={14} />
            {snapshot.quoteVersions.length} {snapshot.quoteVersions.length === 1 ? 'versão' : 'versões'}
          </p>
        </div>
      </div>

      {missingFields.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase text-slate-400">Respostas ainda necessárias</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missingFields.map((field) => (
              <span key={field} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {FIELD_LABELS[field]}
              </span>
            ))}
          </div>
        </div>
      )}

      {snapshot.lastEvent && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Clock3 size={13} />
          Última ação: {ACTION_LABELS[snapshot.lastEvent.action] || snapshot.lastEvent.action} · {formatEventTime(snapshot.lastEvent.createdAt)}
        </p>
      )}
    </section>
  );
};

export default AICommerceStatePanel;
