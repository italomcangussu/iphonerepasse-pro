import React from "react";
import CRMSimpleCrud from "../../components/crm/CRMSimpleCrud";

const BroadcastsPage: React.FC = () => {
  return (
    <CRMSimpleCrud
      table="crm_broadcasts"
      title="Broadcasts"
      description="Campanhas massivas de envio com filtros de público e agendamento."
      fields={[
        { key: "name", label: "Nome", required: true },
        { key: "channel_id", label: "Canal", type: "lookup", lookup: { table: "crm_channels", valueKey: "id", labelKey: "name", storeScoped: true, emptyLabel: "Todos os canais" } },
        { key: "message_template", label: "Mensagem", type: "textarea", required: true },
        { key: "recipient_filters", label: "Filtro de destinatários (JSON)", type: "json", hint: "Vazio envia para todos os leads do canal." },
        { key: "status", label: "Situação", required: true, type: "select", options: [{ value: "draft", label: "Rascunho" }, { value: "scheduled", label: "Agendado" }, { value: "processing", label: "Enviando" }, { value: "completed", label: "Concluído" }, { value: "failed", label: "Falhou" }, { value: "canceled", label: "Cancelado" }] },
        { key: "scheduled_for", label: "Agendar para", type: "datetime", hint: "No seu horário local." },
      ]}
      columns={[
        { key: "name", label: "Nome" },
        { key: "status", label: "Status" },
        { key: "scheduled_for", label: "Agendado" },
        { key: "sent_at", label: "Enviado em" },
      ]}
      defaultValues={{
        name: "",
        channel_id: "",
        message_template: "",
        recipient_filters: "{}",
        status: "draft",
        scheduled_for: "",
      }}
      orderBy={{ column: "created_at", ascending: false }}
    />
  );
};

export default BroadcastsPage;
