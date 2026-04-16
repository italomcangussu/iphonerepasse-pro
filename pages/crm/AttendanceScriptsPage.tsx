import React from "react";
import CRMSimpleCrud from "../../components/crm/CRMSimpleCrud";

const AttendanceScriptsPage: React.FC = () => {
  return (
    <CRMSimpleCrud
      table="crm_attendance_scripts"
      title="Scripts de Atendimento"
      description="Playbooks de resposta para abordagem comercial e pós-venda."
      fields={[
        { key: "name", label: "Nome", required: true },
        { key: "script_content", label: "Conteúdo", type: "textarea", required: true },
        { key: "context", label: "Contexto", required: true },
        { key: "is_active", label: "Ativo", type: "boolean" },
      ]}
      columns={[
        { key: "name", label: "Nome" },
        { key: "context", label: "Contexto" },
        { key: "is_active", label: "Ativo", render: (row) => (row.is_active ? "Sim" : "Não") },
      ]}
      defaultValues={{
        name: "",
        script_content: "",
        context: "general",
        is_active: true,
      }}
      orderBy={{ column: "created_at", ascending: false }}
    />
  );
};

export default AttendanceScriptsPage;
