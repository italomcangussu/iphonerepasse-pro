import React from "react";
import CRMSimpleCrud from "../../components/crm/CRMSimpleCrud";

const FormsPage: React.FC = () => {
  return (
    <CRMSimpleCrud
      table="crm_public_registration_links"
      title="Formulários"
      description="Links públicos para captura e enriquecimento de dados de leads."
      fields={[
        { key: "lead_id", label: "Lead ID", required: true },
        { key: "token", label: "Token", required: true },
        { key: "slug", label: "Slug", required: true },
        { key: "utm_source", label: "UTM Source" },
        { key: "utm_campaign", label: "UTM Campaign" },
        { key: "expires_at", label: "Expira em (ISO UTC)" },
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
