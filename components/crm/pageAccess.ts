import type { AppRole } from "../../types";

export type CRMPage =
  | "conversations"
  | "comments"
  | "leads"
  | "funnels"
  | "statistics"
  | "ads"
  | "forms"
  | "automations"
  | "broadcasts"
  | "templates"
  | "custom-fields"
  | "attendance-scripts"
  | "integrations"
  | "cashback"
  | "settings";

export type CRMPageSection = "service" | "admin";

export interface CRMPageAccessItem {
  id: CRMPage;
  label: string;
  section: CRMPageSection;
  roles: AppRole[];
}

export const DEFAULT_CRM_PAGE: CRMPage = "conversations";

export const CRM_PAGE_ACCESS: CRMPageAccessItem[] = [
  { id: "conversations", label: "Conversas", section: "service", roles: ["admin", "manager", "seller"] },
  { id: "comments", label: "Comentários", section: "service", roles: ["admin", "manager", "seller"] },
  { id: "leads", label: "Leads", section: "service", roles: ["admin", "manager", "seller"] },
  { id: "funnels", label: "Funis", section: "service", roles: ["admin", "manager", "seller"] },
  { id: "statistics", label: "Estatísticas", section: "service", roles: ["admin", "manager", "seller"] },
  { id: "ads", label: "Ads", section: "service", roles: ["admin", "manager", "seller"] },
  { id: "forms", label: "Formulários", section: "service", roles: ["admin", "manager", "seller"] },
  { id: "automations", label: "Automações", section: "admin", roles: ["admin"] },
  { id: "broadcasts", label: "Broadcasts", section: "admin", roles: ["admin"] },
  { id: "templates", label: "Templates", section: "admin", roles: ["admin"] },
  { id: "custom-fields", label: "Campos", section: "admin", roles: ["admin"] },
  { id: "attendance-scripts", label: "Scripts", section: "admin", roles: ["admin"] },
  { id: "integrations", label: "Integrações", section: "admin", roles: ["admin"] },
  { id: "cashback", label: "Cashback", section: "admin", roles: ["admin"] },
  { id: "settings", label: "Configurações", section: "admin", roles: ["admin"] },
];

export function isCRMPage(value: string): value is CRMPage {
  return CRM_PAGE_ACCESS.some((item) => item.id === value);
}

export function getCRMAvailablePagesByRole(role: AppRole | null | undefined): CRMPage[] {
  const resolvedRole: AppRole = role ?? "seller";
  return CRM_PAGE_ACCESS.filter((item) => item.roles.includes(resolvedRole)).map((item) => item.id);
}
