import React from "react";
import CRMSimpleCrud from "../../components/crm/CRMSimpleCrud";

const FormsPage: React.FC = () => {
  return (
    <CRMSimpleCrud
      table="crm_public_registration_links"
      title="Formulários"
      description="Links públicos para captura e enriquecimento de dados de leads."
      fields={[
        { key: "lead_id", label: "Lead (ID)", required: true, hint: "Identificador do lead que vai receber o link." },
        { key: "token", label: "Código do link", required: true, hint: "Código único que identifica este link." },
        { key: "slug", label: "Final do endereço", required: true, hint: "Sem espaços. Ex.: cadastro-joao" },
        { key: "utm_source", label: "Origem (UTM source)" },
        { key: "utm_campaign", label: "Campanha (UTM campaign)" },
        { key: "expires_at", label: "Expira em", type: "datetime", hint: "No seu horário local. Vazio não expira." },
        { key: "is_active", label: "Ativo", type: "boolean" },
      ]}
      columns={[
        { key: "lead_id", label: "Lead" },
        { key: "slug", label: "Slug" },
        { key: "token", label: "Token" },
        { key: "is_active", label: "Ativo", render: (row) => (row.is_active ? "Sim" : "Não") },
        { key: "expires_at", label: "Expira em" },
      ]}
      defaultValues={{
        lead_id: "",
        token: "",
        slug: "",
        utm_source: "",
        utm_campaign: "",
        expires_at: "",
        is_active: true,
      }}
      orderBy={{ column: "created_at", ascending: false }}
    />
  );
};

export default FormsPage;
