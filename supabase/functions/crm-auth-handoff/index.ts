/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  createServiceClient,
  jsonResponse,
  logCRMEvent,
  parseJsonBody,
  requireAuthenticatedRole,
  sanitizeText,
} from "../_shared/crm.ts";

type HandoffBody = {
  action?: "create" | "consume";
  accessToken?: string;
  refreshToken?: string;
  targetPath?: string;
  code?: string;
};

const DEFAULT_CRM_BASE_URL = "https://crm.iphonerepasse.com.br";

const resolveCRMBaseUrl = () => {
  const explicit = String(Deno.env.get("CRM_BASE_URL") || "").trim();
  return explicit || DEFAULT_CRM_BASE_URL;
};

const normalizeTargetPath = (value: string | null) => {
  const raw = String(value || "").trim();
  if (!raw) return "/";
  return raw.startsWith("/") ? raw : `/${raw}`;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Failed to initialize Supabase." }, 500);
  }

  const body = await parseJsonBody<HandoffBody>(req);
  if (!body) return jsonResponse({ error: "Invalid JSON body." }, 400);

  if (body.action === "create") {
    let auth;
    try {
      auth = await requireAuthenticatedRole(req, supabase);
    } catch (error: any) {
      return jsonResponse({ error: error?.message || "Unauthorized." }, 401);
    }

    const accessToken = sanitizeText(body.accessToken);
    const refreshToken = sanitizeText(body.refreshToken);
    if (!accessToken || !refreshToken) {
      return jsonResponse({ error: "accessToken e refreshToken são obrigatórios." }, 400);
    }

    const targetPath = normalizeTargetPath(sanitizeText(body.targetPath));
    const code = crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("seller_id")
      .eq("id", auth.userId)
      .maybeSingle();

    if (profileError) return jsonResponse({ error: profileError.message }, 500);

    let storeId: string | null = null;
    if (profile?.seller_id) {
      const { data: seller, error: sellerError } = await supabase
        .from("sellers")
        .select("store_id")
        .eq("id", profile.seller_id)
        .maybeSingle();
      if (sellerError) return jsonResponse({ error: sellerError.message }, 500);
      storeId = sanitizeText(seller?.store_id);
    }

    const { error: insertError } = await supabase
      .from("crm_auth_handoffs")
      .insert({
        code,
        user_id: auth.userId,
        store_id: storeId,
        access_token: accessToken,
        refresh_token: refreshToken,
        target_path: targetPath,
        expires_at: expiresAt,
      });

    if (insertError) return jsonResponse({ error: insertError.message }, 500);

    if (storeId) {
      await logCRMEvent({
        supabase,
        storeId,
        eventType: "crm_auth_handoff_created",
        payload: { user_id: auth.userId, target_path: targetPath, expires_at: expiresAt },
      });
    }

    const url = new URL(resolveCRMBaseUrl());
    url.pathname = targetPath;
    url.searchParams.set("handoff", code);

    return jsonResponse({
      success: true,
      code,
      expires_at: expiresAt,
      redirect_url: url.toString(),
    });
  }

  if (body.action === "consume") {
    const code = sanitizeText(body.code);
    if (!code) return jsonResponse({ error: "code é obrigatório." }, 400);

    const { data: row, error } = await supabase
      .from("crm_auth_handoffs")
      .select("id, user_id, store_id, access_token, refresh_token, expires_at, consumed_at, target_path")
      .eq("code", code)
      .maybeSingle();

    if (error) return jsonResponse({ error: error.message }, 500);
    if (!row) return jsonResponse({ error: "handoff_not_found" }, 404);
    if (row.consumed_at) return jsonResponse({ error: "handoff_already_consumed" }, 410);
    if (new Date(row.expires_at).getTime() <= Date.now()) return jsonResponse({ error: "handoff_expired" }, 410);

    const { error: consumeError } = await supabase
      .from("crm_auth_handoffs")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("consumed_at", null);

    if (consumeError) return jsonResponse({ error: consumeError.message }, 500);

    if (row.store_id) {
      await logCRMEvent({
        supabase,
        storeId: String(row.store_id),
        eventType: "crm_auth_handoff_consumed",
        payload: { user_id: row.user_id, target_path: row.target_path || "/" },
      });
    }

    return jsonResponse({
      success: true,
      session: {
        access_token: row.access_token,
        refresh_token: row.refresh_token,
      },
      target_path: row.target_path || "/",
    });
  }

  return jsonResponse({ error: "action inválida. Use create ou consume." }, 400);
});
