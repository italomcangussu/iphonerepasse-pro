import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../../services/supabase";
import { useToast } from "../../components/ui/ToastProvider";
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

const StatisticsPage: React.FC = () => {
  const toast = useToast();
  const { selectedStoreId } = useCRMStore();
  const [stats, setStats] = useState<Stats>(defaultStats);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_crm_statistics", {
        p_store_id: selectedStoreId,
      });
      if (error) throw error;
      setStats({ ...defaultStats, ...(data || {}) });
    } catch (error: any) {
      toast.error(error?.message || "Falha ao carregar estatísticas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStats();
  }, [selectedStoreId]);

  const cards: Array<{ key: keyof Stats; label: string; format?: (value: number) => string }> = [
    { key: "total_leads", label: "Leads Totais" },
    { key: "total_customers", label: "Leads Convertidos" },
    { key: "open_conversations", label: "Conversas Abertas" },
    { key: "sent_messages_24h", label: "Mensagens Enviadas (24h)" },
    { key: "inbound_messages_24h", label: "Mensagens Recebidas (24h)" },
    {
      key: "conversion_rate",
      label: "Taxa de Conversão",
      format: (value) => `${value.toFixed(1)}%`,
    },
    {
      key: "pipeline_value",
      label: "Valor Potencial",
      format: (value) =>
        value.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        }),
    },
  ];

  return (
    <CRMPageFrame
      title="Estatísticas"
      description="Indicadores operacionais e comerciais do CRM Plus."
      actions={(
        <button type="button" className="crm-btn crm-btn-secondary" onClick={() => void loadStats()}>
          <RefreshCw size={16} />
          Atualizar
        </button>
      )}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map((card) => {
          const value = Number(stats[card.key] || 0);
          return (
            <article key={card.key} className="crm-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {loading ? "..." : card.format ? card.format(value) : value.toLocaleString("pt-BR")}
              </p>
            </article>
          );
        })}
      </div>
    </CRMPageFrame>
  );
};

export default StatisticsPage;
