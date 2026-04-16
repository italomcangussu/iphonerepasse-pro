import React from "react";
import CRMSimpleCrud from "../../components/crm/CRMSimpleCrud";

const TemplatesPage: React.FC = () => {
  return (
    <CRMSimpleCrud
      table="crm_message_templates"
      title="Templates"
      description="Modelos de mensagens reutilizáveis por canal, cenário e etapa."
      fields={[
        { key: "name", label: "Nome", required: true },
        { key: "content", label: "Conteúdo", type: "textarea", required: true },
        { key: "channel_id", label: "Canal (UUID)" },
        { key: "category", label: "Categoria" },
        { key: "variables", label: "Variáveis (JSON)", type: "json" },
        { key: "is_active", label: "Ativo", type: "boolean" },
      ]}
      columns={[
        { key: "name", label: "Nome" },
        { key: "category", label: "Categoria" },
        { key: "channel_id", label: "Canal" },
        { key: "is_active", label: "Ativo", render: (row) => (row.is_active ? "Sim" : "Não") },
      ]}
      defaultValues={{
        name: "",
        content: "",
        channel_id: "",
        category: "general",
        variables: "{}",
        is_active: true,
      }}
      orderBy={{ column: "created_at", ascending: false }}
    />
  );
};

export default TemplatesPage;
