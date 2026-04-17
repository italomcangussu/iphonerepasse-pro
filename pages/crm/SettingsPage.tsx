import React, { lazy, Suspense } from "react";
const CRMChannels = lazy(() => import("../CRMChannels"));
import CRMSimpleCrud from "../../components/crm/CRMSimpleCrud";
import { supabase } from "../../services/supabase";

const SettingsPage: React.FC = () => {
  const [isCentralized, setIsCentralized] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState(true);
  const [updating, setUpdating] = React.useState(false);

  React.useEffect(() => {
    async function loadSettings() {
      try {
        const { data, error } = await supabase
          .from("crm_settings")
          .select("value_bool")
          .eq("id", "centralized_service")
          .maybeSingle();

        if (data) setIsCentralized(data.value_bool);
      } catch (err) {
        console.error("Erro ao carregar configurações do CRM:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const toggleCentralized = async () => {
    setUpdating(true);
    const newValue = !isCentralized;
    try {
      const { error } = await supabase
        .from("crm_settings")
        .upsert({ id: "centralized_service", value_bool: newValue, updated_at: new Date().toISOString() });

      if (error) throw error;
      setIsCentralized(newValue);
    } catch (err: any) {
      alert("Falha ao atualizar configuração: " + err.message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="crm-card p-5">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Configurações Gerais</h3>
        <p className="text-sm text-slate-500 mb-4">Ajuste o comportamento global do CRM Plus.</p>

        <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div>
            <p className="font-semibold text-slate-900 dark:text-white text-sm">Centralizar Atendimento</p>
            <p className="text-xs text-slate-500">Exibe conversas de todas as lojas em um único canal, ignorando a divisão por loja.</p>
          </div>
          {loading ? (
            <div className="h-6 w-10 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full" />
          ) : (
            <button
              onClick={toggleCentralized}
              disabled={updating}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                isCentralized ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isCentralized ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          )}
        </div>
      </div>

      <Suspense fallback={null}>
        <CRMChannels />
      </Suspense>

      <CRMSimpleCrud
        table="crm_utm_config"
        title="Configuração UTM"
        description="Mapeamento de campanhas e tags para atribuição de origem."
        fields={[
          { key: "source_key", label: "Source", required: true },
          { key: "campaign_key", label: "Campaign", required: true },
          { key: "medium_key", label: "Medium" },
          { key: "default_channel_id", label: "Canal padrão (UUID)" },
          { key: "is_active", label: "Ativo", type: "boolean" },
        ]}
        columns={[
          { key: "source_key", label: "Source" },
          { key: "campaign_key", label: "Campaign" },
          { key: "medium_key", label: "Medium" },
          { key: "is_active", label: "Ativo", render: (row) => (row.is_active ? "Sim" : "Não") },
        ]}
        defaultValues={{
          source_key: "",
          campaign_key: "",
          medium_key: "",
          default_channel_id: "",
          is_active: true,
        }}
        orderBy={{ column: "created_at", ascending: false }}
      />

      <CRMSimpleCrud
        table="crm_ai_agent_configs"
        title="Configuração de Agente AI"
        description="Parâmetros do assistente de atendimento automático por loja."
        fields={[
          { key: "name", label: "Nome", required: true },
          { key: "is_active", label: "Ativo", type: "boolean" },
          { key: "model", label: "Modelo", required: true },
          { key: "system_prompt", label: "System Prompt", type: "textarea" },
          { key: "config", label: "Config (JSON)", type: "json" },
        ]}
        columns={[
          { key: "name", label: "Nome" },
          { key: "model", label: "Modelo" },
          { key: "is_active", label: "Ativo", render: (row) => (row.is_active ? "Sim" : "Não") },
        ]}
        defaultValues={{
          name: "Agente CRM",
          is_active: false,
          model: "gpt-4.1-mini",
          system_prompt: "",
          config: "{}",
        }}
        orderBy={{ column: "created_at", ascending: false }}
      />
    </div>
  );
};

export default SettingsPage;
