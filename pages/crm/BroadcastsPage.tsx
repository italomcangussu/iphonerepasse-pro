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
        { key: "channel_id", label: "Canal (UUID)" },
        { key: "message_template", label: "Mensagem", type: "textarea", required: true },
        { key: "recipient_filters", label: "Filtros (JSON)", type: "json" },
        { key: "status", label: "Status", required: true },
        { key: "scheduled_for", label: "Agendar para (ISO UTC)" },
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
