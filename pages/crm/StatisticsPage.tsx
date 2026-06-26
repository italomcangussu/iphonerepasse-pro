import React, { useEffect, useState } from "react";
import { Banknote, MessageCircle, MessageSquare, RefreshCw, Send, TrendingUp, UserCheck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "../../services/supabase";
import { useAsyncHandler } from "../../hooks/useAsyncHandler";
import { assertNoError } from "../../utils/supabase";
import CRMPageFrame from "../../components/crm/CRMPageFrame";
import { useCRMStore } from "../../components/crm/useCRMStore";

type Stats = {
  total_leads: number;
  total_customers: number;
  open_conversations: number;
  sent_messages_24h: number;
  inbound_messages_24h: number;
  conversion_rate: number;
  pipeline_value: number;
};

const defaultStats: Stats = {
  total_leads: 0,
  total_customers: 0,
  open_conversations: 0,
  sent_messages_24h: 0,
  inbound_messages_24h: 0,
  conversion_rate: 0,
  pipeline_value: 0,
};

type StatCard = {
  key: keyof Stats;
  label: string;
  format?: (value: number) => string;
  Icon: LucideIcon;
  iconClass: string;
  valueClass?: string;
};

const CARDS: StatCard[] = [
  { key: "total_leads", label: "Leads Totais", Icon: Users, iconClass: "bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-300" },
  { key: "total_customers", label: "Convertidos", Icon: UserCheck, iconClass: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300", valueClass: "text-emerald-700 dark:text-emerald-300" },
  { key: "open_conversations", label: "Conversas Abertas", Icon: MessageSquare, iconClass: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300" },
  { key: "sent_messages_24h", label: "Enviadas (24h)", Icon: Send, iconClass: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300" },
  { key: "inbound_messages_24h", label: "Recebidas (24h)", Icon: MessageCircle, iconClass: "bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-300" },
  {
    key: "conversion_rate",
    label: "Taxa de Conversão",
    format: (v) => `${v.toFixed(1)}%`,
    Icon: TrendingUp,
    iconClass: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300",
    valueClass: "text-emerald-700 dark:text-emerald-300",
  },
  {
    key: "pipeline_value",
    label: "Valor no Pipeline",
    format: (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    Icon: Banknote,
    iconClass: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300",
    valueClass: "text-brand-700 dark:text-brand-300",
  },
];

const StatisticsPage: React.FC = () => {
  const run = useAsyncHandler();
  const { selectedStoreId } = useCRMStore();
  const [stats, setStats] = useState<Stats>(defaultStats);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    if (!selectedStoreId) return;
    await run(async () => {
      const data = assertNoError(await supabase.rpc("get_crm_statistics", {
        p_store_id: selectedStoreId,
      }));
      setStats({ ...defaultStats, ...(data || {}) });
    }, { errorMsg: "Falha ao carregar estatísticas.", setLoading });
  };

  useEffect(() => {
    void loadStats();
  }, [selectedStoreId]);

  return (
    <CRMPageFrame
      title="Estatísticas"
      description="Indicadores operacionais e comerciais do CRM Plus."
      actions={(
        <button type="button" className="crm-btn crm-btn-secondary" onClick={() => void loadStats()}>
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          {loading ? "Carregando..." : "Atualizar"}
        </button>
      )}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map((card) => {
          const value = Number(stats[card.key] || 0);
          return (
            <article key={card.key} className="crm-card flex items-start gap-4 p-4">
              <div className={`shrink-0 flex h-10 w-10 items-center justify-center rounded-xl ${card.iconClass}`} aria-hidden="true">
                <card.Icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{card.label}</p>
                <p className={`mt-1 text-2xl font-black leading-none ${card.valueClass ?? "text-slate-900 dark:text-slate-50"}`}>
                  {loading ? (
                    <span className="inline-block h-7 w-20 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" aria-label="Carregando" />
                  ) : (
                    card.format ? card.format(value) : value.toLocaleString("pt-BR")
                  )}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </CRMPageFrame>
  );
};

export default StatisticsPage;
