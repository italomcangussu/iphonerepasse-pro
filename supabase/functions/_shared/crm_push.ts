/// <reference lib="deno.ns" />
import { sanitizeText } from "./crm.ts";

/**
 * Shared CRM Plus Web Push helpers, reused by both inbound webhooks
 * (crm-uaz-webhook-receiver / crm-instagram-webhook-receiver) and by the
 * AI handoff flow (crm-ai-inbound). Every CRM push is tagged product='crmplus'
 * so push-send can never deliver it to the ERP PWA.
 *
 * See tasks/prd-pwa-push-independente-erp-crmplus-ios.md (US-009/US-015/US-016).
 */

export type CrmPushTopic = "crm_inbox" | "new_lead" | "transfer_pending";

const NOTIFICATION_ICON = "/brand/crm/icon-192.png";

/** Resolves the dedicated CRM host origin used for deep links (clean paths). */
export const getCrmNotificationBaseUrl = (): string => {
  const explicitUrl = String(Deno.env.get("CRM_BASE_URL") || "").trim();
  if (explicitUrl) return explicitUrl.replace(/\/$/, "");

  const hostname = String(
    Deno.env.get("CRM_HOSTNAME") || "crm.iphonerepasse.com.br",
  ).trim();
  return `https://${hostname || "crm.iphonerepasse.com.br"}`;
};

/** Trims notification text to a lock-screen-friendly length. */
export const compactNotificationText = (
  value: string | null,
  fallback: string,
): string => {
  const normalized = sanitizeText(value) || fallback;
  return normalized.length > 120
    ? `${normalized.slice(0, 117)}...`
    : normalized;
};

/**
 * Builds the deep link for a CRM notification on the dedicated CRM host
 * (BrowserRouter clean paths). Falls back to the lead profile, then root.
 */
export const buildCrmNotificationUrl = (
  conversationId: string,
  leadId: string,
): string => {
  const baseUrl = getCrmNotificationBaseUrl();
  const target = conversationId
    ? `/conversations/${encodeURIComponent(conversationId)}`
    : leadId
    ? `/leads/${encodeURIComponent(leadId)}`
    : "/";
  return `${baseUrl}${target}`;
};

const defaultTitleFor = (topic: CrmPushTopic): string => {
  switch (topic) {
    case "new_lead":
      return "Novo lead no CRM";
    case "transfer_pending":
      return "Atendimento aguardando humano";
    default:
      return "Nova mensagem CRM";
  }
};

const defaultBodyFor = (topic: CrmPushTopic): string => {
  switch (topic) {
    case "new_lead":
      return "Novo lead recebido.";
    case "transfer_pending":
      return "A IA transferiu uma conversa para atendimento humano.";
    default:
      return "Nova mensagem recebida.";
  }
};

export type CrmPushNotificationRequest = {
  endpoint: string;
  init: RequestInit;
  payload: {
    product: "crmplus";
    topic: CrmPushTopic;
    store_id?: string;
    notification: Record<string, unknown>;
  };
};

/**
 * Builds the HTTP request to push-send for a CRM notification, or null when
 * the Supabase env is not configured. Always tags product='crmplus'.
 */
export const buildCrmPushNotificationRequest = (args: {
  topic: CrmPushTopic;
  title: string;
  body: string;
  conversationId: string;
  leadId: string;
  storeId?: string;
  requireInteraction?: boolean;
}): CrmPushNotificationRequest | null => {
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").replace(
    /\/$/,
    "",
  );
  const serviceRoleKey = String(
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );
  if (!supabaseUrl || !serviceRoleKey) return null;

  const payload = {
    product: "crmplus" as const,
    topic: args.topic,
    ...(args.storeId ? { store_id: args.storeId } : {}),
    notification: {
      title: compactNotificationText(args.title, defaultTitleFor(args.topic)),
      body: compactNotificationText(args.body, defaultBodyFor(args.topic)),
      url: buildCrmNotificationUrl(args.conversationId, args.leadId),
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      tag: `crm-${args.topic}-${args.conversationId || args.leadId || "inbox"}`,
      requireInteraction: args.requireInteraction ??
        (args.topic === "new_lead" || args.topic === "transfer_pending"),
    },
  };

  return {
    endpoint: `${supabaseUrl}/functions/v1/push-send`,
    payload,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(payload),
    },
  };
};

/** Fire-and-forget CRM push delivery; never throws into the caller's flow. */
export const sendCrmPushNotification = async (args: {
  topic: CrmPushTopic;
  title: string;
  body: string;
  conversationId: string;
  leadId: string;
  storeId?: string;
  requireInteraction?: boolean;
}): Promise<void> => {
  try {
    const request = buildCrmPushNotificationRequest(args);
    if (!request) return;

    const response = await fetch(request.endpoint, request.init);

    if (!response.ok) {
      const responseText = await response.text();
      console.warn(
        "[crm-push] push-send failed",
        response.status,
        responseText.slice(0, 240),
      );
    }
  } catch (error) {
    console.warn("[crm-push] delivery failed", error);
  }
};
