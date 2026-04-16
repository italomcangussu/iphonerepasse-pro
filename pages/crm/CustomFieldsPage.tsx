import React from "react";
import CRMSimpleCrud from "../../components/crm/CRMSimpleCrud";

const CustomFieldsPage: React.FC = () => {
  return (
    <CRMSimpleCrud
      table="crm_custom_fields"
      title="Campos Personalizados"
      description="Campos dinâmicos para enriquecimento de lead no CRM."
      fields={[
        { key: "key", label: "Chave", required: true },
        { key: "label", label: "Rótulo", required: true },
        { key: "field_type", label: "Tipo", required: true },
        { key: "is_required", label: "Obrigatório", type: "boolean" },
        { key: "is_active", label: "Ativo", type: "boolean" },
        { key: "options", label: "Opções (JSON)", type: "json" },
      ]}
      columns={[
        { key: "key", label: "Chave" },
        { key: "label", label: "Rótulo" },
        { key: "field_type", label: "Tipo" },
        { key: "is_required", label: "Obrigatório", render: (row) => (row.is_required ? "Sim" : "Não") },
        { key: "is_active", label: "Ativo", render: (row) => (row.is_active ? "Sim" : "Não") },
      ]}
      defaultValues={{
        key: "",
        label: "",
        field_type: "text",
        is_required: false,
        is_active: true,
        options: "{}",
      }}
      orderBy={{ column: "created_at", ascending: false }}
    />
  );
};

export default CustomFieldsPage;
