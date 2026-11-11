import React from "react";
import CRMSimpleCrud from "../../components/crm/CRMSimpleCrud";

const CustomFieldsPage: React.FC = () => {
  return (
    <CRMSimpleCrud
      table="crm_custom_fields"
      title="Campos Personalizados"
      description="Campos dinâmicos para enriquecimento de lead no CRM."
      fields={[
        { key: "key", label: "Identificador", required: true, hint: "Sem espaços nem acentos. Ex.: cidade_origem" },
        { key: "label", label: "Nome exibido", required: true },
        { key: "field_type", label: "Tipo", required: true, type: "select", options: [{ value: "text", label: "Texto" }, { value: "number", label: "Número" }, { value: "boolean", label: "Sim ou não" }, { value: "date", label: "Data" }, { value: "select", label: "Lista de opções" }, { value: "json", label: "JSON" }] },
        { key: "is_required", label: "Obrigatório", type: "boolean" },
        { key: "is_active", label: "Ativo", type: "boolean" },
        { key: "options", label: "Opções da lista (JSON)", type: "json", hint: "Só para o tipo Lista de opções. Ex.: [\"Fortaleza\", \"Sobral\"]" },
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
