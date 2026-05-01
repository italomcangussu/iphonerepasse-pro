import React, { lazy, Suspense } from "react";
const CRMChannels = lazy(() => import("../CRMChannels"));
import CRMSimpleCrud from "../../components/crm/CRMSimpleCrud";

const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
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
        description="Parâmetros do assistente de atendimento automático do CRM Plus."
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
