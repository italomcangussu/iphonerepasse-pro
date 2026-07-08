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
  | "admin-agent"
  | "settings";

export const DEFAULT_CRM_PAGE: CRMPage = "conversations";

const DEFAULT_CRM_HOSTNAME = "crm.iphonerepasse.com.br";

const CRM_PAGE_PATHS: Record<CRMPage, string> = {
  conversations: "/",
  comments: "/comments",
  leads: "/leads",
  funnels: "/funnels",
  statistics: "/statistics",
  ads: "/ads",
  forms: "/forms",
  automations: "/automations",
  broadcasts: "/broadcasts",
  templates: "/templates",
  "custom-fields": "/custom-fields",
  "attendance-scripts": "/attendance-scripts",
  integrations: "/integrations",
  cashback: "/cashback",
  "admin-agent": "/admin-agent",
  settings: "/settings",
};

function normalizePath(pathname: string): string {
  if (!pathname) return "/";
  const normalized = pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "");
  return normalized || "/";
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
  );
}

export function getCRMHostname(): string {
  const explicitHostname = String(import.meta.env.VITE_CRM_HOSTNAME || "").trim();
  return explicitHostname || DEFAULT_CRM_HOSTNAME;
}

export function isCRMStandaloneHost(hostname?: string): boolean {
  if (!hostname && typeof window === "undefined") return false;
  const resolvedHostname = hostname || window.location.hostname;
  return resolvedHostname === getCRMHostname();
}

/** Legacy `#/crmplus` hash-route vector on the main host (no longer offered for new installs/subscriptions, kept for already-installed users). */
export function isCRMPlusHashRoute(hash?: string): boolean {
  const resolvedHash = hash ?? (typeof window === "undefined" ? "" : window.location.hash);
  return resolvedHash === "#/crmplus" || resolvedHash.startsWith("#/crmplus/");
}

export function getCRMPathForPage(page: CRMPage): string {
  return CRM_PAGE_PATHS[page] || CRM_PAGE_PATHS[DEFAULT_CRM_PAGE];
}

export function getCRMPageFromPathname(pathname: string): CRMPage | null {
  const normalized = normalizePath(pathname);
  const match = Object.entries(CRM_PAGE_PATHS).find(([, path]) => path === normalized);
  return (match?.[0] as CRMPage | undefined) || null;
}

export function getCRMHashForPage(page: CRMPage): string {
  const pagePath = getCRMPathForPage(page);
  return pagePath === "/" ? "#/crm" : `#/crm${pagePath}`;
}

export function getCRMBaseUrl(): string {
  const explicitUrl = String(import.meta.env.VITE_CRM_BASE_URL || "").trim();
  if (explicitUrl) return explicitUrl.replace(/\/$/, "");

  if (typeof window === "undefined") {
    return `https://${getCRMHostname()}`;
  }

  if (isCRMStandaloneHost(window.location.hostname)) {
    return window.location.origin.replace(/\/$/, "");
  }

  if (isLocalHostname(window.location.hostname)) {
    return window.location.origin.replace(/\/$/, "");
  }

  return `https://${getCRMHostname()}`;
}

export function getCRMUrl(page: CRMPage = DEFAULT_CRM_PAGE): string {
  const baseUrl = getCRMBaseUrl();

  if (
    typeof window !== "undefined" &&
    isLocalHostname(window.location.hostname) &&
    !isCRMStandaloneHost(window.location.hostname)
  ) {
    return `${baseUrl}${getCRMHashForPage(page)}`;
  }

  const pagePath = getCRMPathForPage(page);
  return pagePath === "/" ? baseUrl : `${baseUrl}${pagePath}`;
}
