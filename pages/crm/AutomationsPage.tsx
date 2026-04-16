import React from "react";
import CRMSimpleCrud from "../../components/crm/CRMSimpleCrud";

const AutomationsPage: React.FC = () => {
  return (
    <CRMSimpleCrud
      table="crm_automation_rules"
      title="Automações"
      description="Configuração de regras automáticas por trigger, canal e funil."
      fields={[
        { key: "description", label: "Descrição", required: true },
        { key: "trigger_type", label: "Trigger", required: true },
        { key: "message_content", label: "Mensagem", type: "textarea", required: true },
        { key: "delay_minutes", label: "Delay (min)", type: "number" },
        { key: "channel_id", label: "Canal (UUID)" },
        { key: "funnel_stage", label: "Etapa" },
        { key: "switch_to_human_handling", label: "Handoff humano", type: "boolean" },
        { key: "is_active", label: "Ativo", type: "boolean" },
        { key: "message_variants", label: "Variações (JSON)", type: "json" },
      ]}
      columns={[
        { key: "description", label: "Descrição" },
        { key: "trigger_type", label: "Trigger" },
        { key: "delay_minutes", label: "Delay" },
        { key: "funnel_stage", label: "Etapa" },
        { key: "is_active", label: "Ativo", render: (row) => (row.is_active ? "Sim" : "Não") },
      ]}
      defaultValues={{
        description: "",
        trigger_type: "inbound_message",
        message_content: "",
        delay_minutes: 0,
        channel_id: "",
        funnel_stage: "",
        switch_to_human_handling: false,
        is_active: true,
        message_variants: "{}",
      }}
      orderBy={{ column: "created_at", ascending: false }}
    />
  );
};

export default AutomationsPage;
