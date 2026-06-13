/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  createServiceClient,
  jsonResponse,
  parseJsonBody,
  requireAuthenticatedRole,
  sanitizeText,
} from "../_shared/crm.ts";

/**
 * sales-notify — fires the ERP "sale completed" Web Push (US-014).
 *
 * The sale itself is created by the `create_sale_full` RPC, which runs under the
 * caller's user JWT. That JWT cannot call `push-send` (it rejects anything that
 * is not a service-role token or the worker secret). So the ERP frontend calls
 * this function fire-and-forget right after the sale succeeds; it authenticates
 * the user, then relays to `push-send` with the service-role bearer.
 *
 * Notifications are NOT store-scoped: the app operates both stores with shared
 * access, so every active 'erp' subscriber opted into the 'sale' topic is
 * notified (mirrors the CRM push behavior — see _shared/crm_push.ts).
 */

const NOTIFICATION_ICON = "/brand/icon-192.png";
// ERP runs under HashRouter; "/finance" is where a new sale's revenue shows up.
const SALE_DEEP_LINK = "/#/finance";

type SalesNotifyBody = {
  sale_id?: string;
  total?: number | string;
  customer_name?: string;
  seller_name?: string;
};

type ErpPushRequest = {
  endpoint: string;
  init: RequestInit;
};

const formatBRL = (value: number | string | undefined): string => {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
  } catch {
    return `R$ ${amount.toFixed(2)}`;
  }
};

/** Builds the sale notification body, e.g. "Maria • R$ 1.200,00 — João". */
export const buildSaleNotificationBody = (body: SalesNotifyBody): string => {
  const seller = sanitizeText(body.seller_name) || "";
  const customer = sanitizeText(body.customer_name) || "cliente";
  const amount = formatBRL(body.total);
  const parts = [seller, amount].filter(Boolean).join(" • ");
  return parts ? `${parts} — ${customer}` : `Venda para ${customer}`;
};

/**
 * Builds the request to push-send for the ERP sale notification, or null when
 * the Supabase env is not configured. Always tags product='erp', topic='sale'.
 */
export const buildSalePushRequest = (
  body: SalesNotifyBody,
): ErpPushRequest | null => {
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").replace(
    /\/$/,
    "",
  );
  const serviceRoleKey = String(
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );
  if (!supabaseUrl || !serviceRoleKey) return null;

  const payload = {
    product: "erp" as const,
    topic: "sale",
    notification: {
      title: "Nova venda registrada",
      body: buildSaleNotificationBody(body),
      url: SALE_DEEP_LINK,
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      tag: `erp-sale-${sanitizeText(body.sale_id) || "latest"}`,
    },
  };

  return {
    endpoint: `${supabaseUrl}/functions/v1/push-send`,
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

export type SalesNotifyDeps = {
  createServiceClient?: typeof createServiceClient;
  authenticate?: typeof requireAuthenticatedRole;
  fetchImpl?: typeof fetch;
};

export async function handleSalesNotify(
  req: Request,
  deps: SalesNotifyDeps = {},
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabase = (deps.createServiceClient ?? createServiceClient)();
  const authenticate = deps.authenticate ?? requireAuthenticatedRole;

  try {
    await authenticate(req, supabase);
  } catch (_err) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const body = (await parseJsonBody<SalesNotifyBody>(req)) ?? {};

  const request = buildSalePushRequest(body);
  if (!request) {
    // Push not configured — the sale itself already succeeded, so don't fail.
    return jsonResponse({ ok: true, sent: false });
  }

  try {
    const fetchImpl = deps.fetchImpl ?? fetch;
    const response = await fetchImpl(request.endpoint, request.init);
    if (!response.ok) {
      const text = await response.text();
      console.warn("[sales-notify] push-send failed", response.status, text.slice(0, 240));
      return jsonResponse({ ok: true, sent: false });
    }
  } catch (error) {
    console.warn("[sales-notify] delivery failed", error);
    return jsonResponse({ ok: true, sent: false });
  }

  return jsonResponse({ ok: true, sent: true });
}

Deno.serve((req) => handleSalesNotify(req));
