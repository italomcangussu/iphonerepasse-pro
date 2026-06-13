/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  createServiceClient,
  jsonResponse,
  parseJsonBody,
} from "../_shared/crm.ts";
import {
  findInvalidTopics,
  getDefaultTopics,
  isPushProduct,
  type PushProduct,
} from "../_shared/push_topics.ts";

/**
 * push-subscribe — manage a user's push subscription.
 *
 * POST  /push-subscribe   — upsert subscription (endpoint + VAPID keys)
 * DELETE /push-subscribe  — deactivate subscription by endpoint
 *
 * Both require a valid Bearer JWT (authenticated user).
 */

type AuthUser = { id: string };

type PushSubscribeDeps = {
  createServiceClient?: () => any;
  getUser?: (authHeader: string) => Promise<AuthUser | null>;
  now?: () => string;
};

type SubscribeBody = {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string;
  platform?: "ios" | "android" | "desktop";
  topics?: string[];
  store_id?: string;
  product?: PushProduct;
};

async function getUserFromBearer(authHeader: string): Promise<AuthUser | null> {
  const { createClient } = await import(
    "https://esm.sh/@supabase/supabase-js@2.57.4"
  );
  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authErr } = await anonClient.auth.getUser();
  if (authErr || !user) return null;
  return { id: user.id };
}

export async function handlePushSubscribe(
  req: Request,
  deps: PushSubscribeDeps = {},
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing authorization" }, 401);
  }

  const getUser = deps.getUser ?? getUserFromBearer;
  const user = await getUser(authHeader);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  // ── DELETE ───────────────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const body = await parseJsonBody<{ endpoint: string }>(req);
    if (!body?.endpoint) {
      return jsonResponse({ error: "endpoint required" }, 400);
    }
    const supabase = (deps.createServiceClient ?? createServiceClient)();
    const { error } = await supabase
      .from("push_subscriptions")
      .update({ is_active: false, last_error_message: "User unsubscribed" })
      .eq("user_id", user.id)
      .eq("endpoint", body.endpoint);
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ ok: true });
  }

  // ── POST ─────────────────────────────────────────────────────────────────────
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const body = await parseJsonBody<SubscribeBody>(req);
  if (!body?.endpoint || !body?.p256dh || !body?.auth) {
    return jsonResponse(
      { error: "endpoint, p256dh and auth are required" },
      400,
    );
  }

  const product: PushProduct = isPushProduct(body.product)
    ? body.product
    : "erp";

  const topics = Array.isArray(body.topics)
    ? body.topics
    : getDefaultTopics(product);

  const invalidTopics = findInvalidTopics(product, topics);
  if (invalidTopics.length) {
    return jsonResponse(
      {
        error: `topics not valid for product '${product}': ${
          invalidTopics.join(", ")
        }`,
      },
      400,
    );
  }

  const supabase = (deps.createServiceClient ?? createServiceClient)();

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        store_id: body.store_id ?? null,
        endpoint: body.endpoint,
        p256dh: body.p256dh,
        auth: body.auth,
        user_agent: body.user_agent ?? null,
        platform: body.platform ?? null,
        product,
        topics,
        is_active: true,
        last_seen_at: (deps.now ?? (() => new Date().toISOString()))(),
      },
      { onConflict: "endpoint" },
    );

  if (error) return jsonResponse({ error: error.message }, 500);
  return jsonResponse({ ok: true });
}

if (Deno.env.get("DENO_TEST") !== "1") {
  Deno.serve((req) => handlePushSubscribe(req));
}
