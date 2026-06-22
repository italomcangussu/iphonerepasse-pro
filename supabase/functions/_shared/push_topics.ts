/// <reference lib="deno.ns" />

/**
 * Push notification product/topic catalog, shared by push-subscribe and
 * push-send. Keep in sync with the frontend catalog in lib/pushProduct.ts.
 *
 * See tasks/prd-pwa-push-independente-erp-crmplus-ios.md (US-006/007/008).
 */

export type PushProduct = "erp" | "crmplus";

export const PUSH_PRODUCTS: PushProduct[] = ["erp", "crmplus"];

export const PUSH_TOPIC_CATALOG: Record<PushProduct, string[]> = {
  erp: ["sale", "new_lead", "finance_due", "stock_alert"],
  crmplus: ["crm_inbox", "new_lead", "transfer_pending"],
};

export const PUSH_DEFAULT_TOPICS: Record<PushProduct, string[]> = {
  erp: ["sale"],
  crmplus: ["crm_inbox", "new_lead", "transfer_pending"],
};

export function isPushProduct(value: unknown): value is PushProduct {
  return typeof value === "string" &&
    (PUSH_PRODUCTS as string[]).includes(value);
}

export function getDefaultTopics(product: PushProduct): string[] {
  return PUSH_DEFAULT_TOPICS[product];
}

/** Returns the subset of `topics` that are NOT valid for `product`. */
export function findInvalidTopics(
  product: PushProduct,
  topics: string[],
): string[] {
  const allowed = new Set(PUSH_TOPIC_CATALOG[product]);
  return topics.filter((topic) => !allowed.has(topic));
}
