/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  createServiceClient,
  jsonResponse,
} from "../_shared/crm.ts";

const isWorkerAuthorized = (req: Request): boolean => {
  const expected = String(Deno.env.get("CRM_WORKER_SECRET") || "").trim();
  if (!expected) return true;
  const received = String(req.headers.get("x-worker-secret") || "").trim();
  return received !== "" && received === expected;
};

const signPayload = async (payload: string, secret: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!["GET", "POST"].includes(req.method)) return jsonResponse({ error: "Method not allowed." }, 405);

  if (!isWorkerAuthorized(req)) {
    return jsonResponse({ error: "Unauthorized worker call." }, 401);
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Failed to initialize Supabase." }, 500);
  }

  await supabase.rpc("crm_fanout_event_log", { p_limit: 500 });

  const { data: events, error: eventsError } = await supabase
    .from("crm_event_log")
    .select("id, store_id, event_type, payload, webhook_url, retry_count, subscription_id")
    .eq("is_outbound", true)
    .eq("sent", false)
    .not("webhook_url", "is", null)
    .order("created_at", { ascending: true })
    .limit(200);

  if (eventsError) return jsonResponse({ error: eventsError.message }, 500);

  const rows = (events || []) as Record<string, unknown>[];
  if (rows.length === 0) {
    return jsonResponse({ success: true, processed: 0, sent: 0, failed: 0 });
  }

  const subscriptionIds = Array.from(new Set(rows.map((event) => String(event.subscription_id || "").trim()).filter(Boolean)));
  const subscriptionSecretMap = new Map<string, string>();

  if (subscriptionIds.length > 0) {
    const { data: subscriptions } = await supabase
      .from("crm_webhook_subscriptions")
      .select("id, secret")
      .in("id", subscriptionIds);

    for (const subscription of (subscriptions || [])) {
      subscriptionSecretMap.set(String(subscription.id), String(subscription.secret || ""));
    }
  }

  let sent = 0;
  let failed = 0;

  for (const event of rows) {
    const eventId = String(event.id);
    const storeId = String(event.store_id || "");
    const eventType = String(event.event_type || "crm_event");
    const webhookUrl = String(event.webhook_url || "").trim();
    const retryCount = Number(event.retry_count || 0);
    const subscriptionId = String(event.subscription_id || "").trim();

    if (!webhookUrl) continue;

    const envelope = {
      id: eventId,
      store_id: storeId,
      event_type: eventType,
      payload: (event.payload && typeof event.payload === "object") ? event.payload : {},
      occurred_at: new Date().toISOString(),
    };

    try {
      const body = JSON.stringify(envelope);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      const secret = subscriptionId ? (subscriptionSecretMap.get(subscriptionId) || "") : "";
      if (secret) {
        headers["x-crm-signature"] = await signPayload(body, secret);
      }

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers,
        body,
      });

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(`webhook_publish_failed:${response.status}:${responseText.slice(0, 240)}`);
      }

      await supabase
        .from("crm_event_log")
        .update({
          sent: true,
          sent_at: new Date().toISOString(),
          processed: true,
          processed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", eventId);

      if (subscriptionId) {
        await supabase
          .from("crm_webhook_subscriptions")
          .update({
            failure_count: 0,
            last_success_at: new Date().toISOString(),
            last_error_at: null,
            last_error_message: null,
          })
          .eq("id", subscriptionId);
      }

      sent += 1;
    } catch (error: any) {
      failed += 1;
      const nextRetry = (Number.isFinite(retryCount) ? retryCount : 0) + 1;
      const message = String(error?.message || "webhook_publish_failed");

      await supabase
        .from("crm_event_log")
        .update({
          retry_count: nextRetry,
          error_message: message,
          processed: false,
        })
        .eq("id", eventId);

      if (subscriptionId) {
        const { data: updatedSubscription } = await supabase
          .from("crm_webhook_subscriptions")
          .update({
            failure_count: nextRetry,
            last_error_at: new Date().toISOString(),
            last_error_message: message,
            is_active: nextRetry < 10,
          })
          .eq("id", subscriptionId)
          .select("id")
          .maybeSingle();

        if (!updatedSubscription) {
          await supabase
            .from("crm_webhook_subscriptions")
            .update({
              failure_count: nextRetry,
              last_error_at: new Date().toISOString(),
              last_error_message: message,
            })
            .eq("id", subscriptionId);
        }
      }
    }
  }

  return jsonResponse({
    success: true,
    processed: rows.length,
    sent,
    failed,
  });
});
