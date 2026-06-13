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
