import { isCRMPlusHashRoute, isCRMStandaloneHost } from "./crmRouting";

/**
 * Push notification product/topic catalog, mirrors
 * supabase/functions/_shared/push_topics.ts. Keep both in sync.
 *
 * See tasks/prd-pwa-push-independente-erp-crmplus-ios.md (US-006/007/008).
 */

export type PushProduct = "erp" | "crmplus";

export const PUSH_TOPIC_CATALOG: Record<PushProduct, string[]> = {
  erp: ["sale", "new_lead", "finance_due", "stock_alert"],
  crmplus: ["crm_inbox", "new_lead", "transfer_pending"],
};

/** Resolves which installable PWA the current runtime belongs to. */
export function resolvePushProduct(): PushProduct {
  if (typeof window === "undefined") return "erp";
  if (isCRMStandaloneHost(window.location.hostname)) return "crmplus";
  if (isCRMPlusHashRoute(window.location.hash)) return "crmplus";
  return "erp";
}

export function getDefaultPushTopics(product: PushProduct = resolvePushProduct()): string[] {
  return PUSH_TOPIC_CATALOG[product];
}

/** Namespaces a localStorage key by product so ERP and CRM Plus never read/write each other's state. */
export function namespacedPushKey(key: string, product: PushProduct = resolvePushProduct()): string {
  return `${key}:${product}`;
}

/** Copy for the HIG pre-permission sheet, branded per product (US-003). */
export interface PushPermissionCopy {
  title: string;
  reason: string;
  deniedMessage: string;
  deniedSub: string;
}

const PUSH_PERMISSION_COPY: Record<PushProduct, PushPermissionCopy> = {
  erp: {
    title: "Notificações Push",
    reason:
      "Receba alertas em tempo real sobre vendas finalizadas, novos leads e cobranças a vencer — mesmo com o app fechado. Você pode desativar a qualquer momento.",
    deniedMessage: "Notificações bloqueadas",
    deniedSub:
      "Para reativar, vá em Ajustes > Notificações > iPhoneRepasse Pro e ative os alertas.",
  },
  crmplus: {
    title: "Notificações Push do CRM Plus",
    reason:
      "Receba alertas em tempo real sobre novas mensagens, leads capturados e conversas aguardando atendimento humano — mesmo com o app fechado. Você pode desativar a qualquer momento.",
    deniedMessage: "Notificações bloqueadas",
    deniedSub:
      "Para reativar, vá em Ajustes > Notificações > CRM Plus e ative os alertas.",
  },
};

/** Returns the per-product copy for the notifications pre-permission sheet. */
export function getPushPermissionCopy(
  product: PushProduct = resolvePushProduct(),
): PushPermissionCopy {
  return PUSH_PERMISSION_COPY[product];
}
