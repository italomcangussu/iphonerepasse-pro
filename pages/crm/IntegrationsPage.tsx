import React from "react";
import CRMSimpleCrud from "../../components/crm/CRMSimpleCrud";

const IntegrationsPage: React.FC = () => {
  return (
    <CRMSimpleCrud
      table="crm_webhook_subscriptions"
      title="Integrações"
      description="Assinaturas de webhooks para integrações externas e automações."
      fields={[
        { key: "name", label: "Nome", required: true },
        { key: "url", label: "Endereço (URL)", required: true, placeholder: "https://" },
        { key: "secret", label: "Chave secreta", hint: "Usada para assinar os envios. Opcional." },
        { key: "subscribed_events", label: "Eventos enviados (JSON)", type: "json", hint: "Lista de eventos. Ex.: [\"lead.created\"]" },
        { key: "is_active", label: "Ativo", type: "boolean" },
      ]}
      columns={[
        { key: "name", label: "Nome" },
        { key: "url", label: "URL" },
        { key: "is_active", label: "Ativo", render: (row) => (row.is_active ? "Sim" : "Não") },
        { key: "last_success_at", label: "Último sucesso" },
        { key: "last_error_message", label: "Último erro" },
      ]}
      defaultValues={{
        name: "",
        url: "",
        secret: "",
        subscribed_events: "[]",
        is_active: true,
      }}
      orderBy={{ column: "created_at", ascending: false }}
      requireStore={false}
    />
  );
};

export default IntegrationsPage;
