import React from "react";
import CRMSimpleCrud from "../../components/crm/CRMSimpleCrud";

const AutomationsPage: React.FC = () => {
  return (
    <CRMSimpleCrud
      table="crm_automation_rules"
      title="Automações"
      description="Configuração de regras automáticas por trigger, canal e funil."
      fields={[
        { key: "description", label: "Nome da automação", required: true, placeholder: "Ex.: Boas-vindas fora do horário" },
        { key: "trigger_type", label: "Quando disparar", required: true, type: "select", options: [{ value: "inbound_message", label: "Quando o cliente envia mensagem" }] },
        { key: "message_content", label: "Mensagem enviada", type: "textarea", required: true },
        { key: "delay_minutes", label: "Esperar (minutos)", type: "number", hint: "0 envia na hora." },
        { key: "channel_id", label: "Canal", type: "lookup", lookup: { table: "crm_channels", valueKey: "id", labelKey: "name", storeScoped: true, emptyLabel: "Todos os canais" } },
        { key: "funnel_stage", label: "Etapa do funil", type: "lookup", lookup: { table: "crm_funnel_stages", valueKey: "id", labelKey: "name", emptyLabel: "Qualquer etapa" } },
        { key: "switch_to_human_handling", label: "Passar para atendente", type: "boolean", hint: "Depois de enviar, a conversa sai da IA e vai para um humano." },
        { key: "is_active", label: "Automação ligada", type: "boolean" },
        { key: "message_variants", label: "Variações da mensagem (JSON)", type: "json", hint: "Textos alternativos para não repetir a mesma mensagem." },
      ]}
      columns={[
        { key: "description", label: "Automação" },
        { key: "trigger_type", label: "Disparo" },
        { key: "delay_minutes", label: "Espera (min)" },
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
