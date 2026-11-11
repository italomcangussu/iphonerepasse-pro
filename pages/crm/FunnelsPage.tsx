import React from "react";
import CRMSimpleCrud from "../../components/crm/CRMSimpleCrud";

const FunnelsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <CRMSimpleCrud
        table="crm_funnels"
        title="Funis"
        description="Gestão de funis de venda por canal."
        fields={[
          { key: "name", label: "Nome", required: true },
          { key: "description", label: "Descrição", type: "textarea" },
          { key: "funnel_type", label: "Tipo", required: true, type: "select", options: [{ value: "sales", label: "Vendas" }, { value: "post_sale", label: "Pós-venda" }] },
          { key: "is_default", label: "Funil padrão", type: "boolean", hint: "Novos leads deste tipo entram neste funil." },
          { key: "is_active", label: "Ativo", type: "boolean" },
          { key: "stages", label: "Etapas próprias (JSON)", type: "json", hint: "Deixe vazio para usar as Etapas Globais abaixo." },
        ]}
        columns={[
          { key: "name", label: "Nome" },
          { key: "funnel_type", label: "Tipo" },
          { key: "is_default", label: "Padrão", render: (row) => (row.is_default ? "Sim" : "Não") },
          { key: "is_active", label: "Ativo", render: (row) => (row.is_active ? "Sim" : "Não") },
          { key: "updated_at", label: "Atualização" },
        ]}
        defaultValues={{
          name: "",
          description: "",
          funnel_type: "sales",
          is_default: false,
          is_active: true,
          stages: "{}",
        }}
        orderBy={{ column: "created_at", ascending: false }}
      />

      <CRMSimpleCrud
        table="crm_funnel_stages"
        title="Etapas Globais"
        description="Etapas padrão de funil utilizadas no CRM Plus."
        fields={[
          { key: "id", label: "Identificador", required: true, hint: "Sem espaços nem acentos. Ex.: negociacao" },
          { key: "name", label: "Nome", required: true },
          { key: "funnel_type", label: "Tipo", required: true, type: "select", options: [{ value: "sales", label: "Vendas" }, { value: "post_sale", label: "Pós-venda" }] },
          { key: "color", label: "Cor", required: true, hint: "Código da cor. Ex.: #2563eb" },
          { key: "order", label: "Ordem", type: "number" },
          { key: "is_won", label: "Etapa de venda ganha", type: "boolean" },
          { key: "is_lost", label: "Etapa de venda perdida", type: "boolean" },
          { key: "is_active", label: "Ativo", type: "boolean" },
        ]}
        columns={[
          { key: "id", label: "ID" },
          { key: "name", label: "Nome" },
          { key: "funnel_type", label: "Tipo" },
          { key: "order", label: "Ordem" },
          { key: "color", label: "Cor" },
          { key: "is_active", label: "Ativo", render: (row) => (row.is_active ? "Sim" : "Não") },
        ]}
        defaultValues={{
          id: "",
          name: "",
          funnel_type: "sales",
          color: "#3b82f6",
          order: 0,
          is_won: false,
          is_lost: false,
          is_active: true,
        }}
        requireStore={false}
        orderBy={{ column: "order", ascending: true }}
      />
    </div>
  );
};

export default FunnelsPage;
