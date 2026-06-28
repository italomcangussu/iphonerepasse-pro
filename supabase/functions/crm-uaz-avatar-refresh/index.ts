/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  createServiceClient,
  jsonResponse,
  parseJsonBody,
  sanitizeText,
} from "../_shared/crm.ts";
import {
  syncUazLeadAvatar,
  type UazLeadAvatarSyncResult,
} from "../_shared/uazLeadAvatar.ts";

type RefreshBody = {
  leadId?: string;
  force?: boolean;
};

type RefreshHandlerDeps = {
  createClient?: () => any;
  syncAvatar?: (args: Record<string, unknown>) => Promise<UazLeadAvatarSyncResult>;
};

const verifiedServiceRoleClaims = (req: Request): boolean => {
  const token = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return false;
  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) return false;
    const base64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/")
      .padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
    const claims = JSON.parse(atob(base64)) as Record<string, unknown>;
    const projectRef = new URL(String(Deno.env.get("SUPABASE_URL") || ""))
      .hostname.split(".")[0];
    return claims.role === "service_role" && claims.ref === projectRef;
  } catch {
    return false;
  }
};

const normalizeRelation = (value: unknown): Record<string, unknown> | null => {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object"
      ? first as Record<string, unknown>
      : null;
  }
  return value && typeof value === "object"
    ? value as Record<string, unknown>
    : null;
};

export const createUazAvatarRefreshHandler = (
  deps: RefreshHandlerDeps = {},
) => async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  // `verify_jwt=true` validates the signature before this handler runs. The
  // claims check narrows accepted valid JWTs to this project's service role.
  if (!verifiedServiceRoleClaims(req)) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const body = await parseJsonBody<RefreshBody>(req);
  const leadId = sanitizeText(body?.leadId);
  if (!leadId) return jsonResponse({ error: "leadId é obrigatório." }, 400);

  let supabase;
  try {
    supabase = (deps.createClient || createServiceClient)();
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : "Failed to initialize Supabase.",
    }, 500);
  }

  const { data, error } = await supabase
    .from("crm_conversations")
    .select(
      "id,store_id,lead_id,channel_id,talk_id,crm_channels!inner(id,provider,is_active,api_endpoint,uaz_subdomain,uaz_instance_token,api_key)",
    )
    .eq("lead_id", leadId)
    .eq("is_group", false)
    .eq("crm_channels.provider", "uazapi")
    .eq("crm_channels.is_active", true)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) return jsonResponse({ error: error.message }, 500);
  if (!data) return jsonResponse({ error: "Conversa UAZAPI não encontrada." }, 404);
  const conversation = data as Record<string, unknown>;
  const channel = normalizeRelation(conversation.crm_channels);
  if (!channel) return jsonResponse({ error: "Canal UAZAPI não encontrado." }, 404);

  const result = await (deps.syncAvatar || syncUazLeadAvatar)({
    supabase,
    channel,
    storeId: String(conversation.store_id || ""),
    leadId,
    channelId: String(conversation.channel_id || ""),
    conversationId: String(conversation.id || ""),
    talkId: sanitizeText(conversation.talk_id),
    payloadAvatarUrl: null,
    trigger: "backfill",
    force: body?.force === true,
  });

  return jsonResponse({
    success: result.status === "synced" || result.status === "missing" ||
      result.status === "skipped_cooldown",
    status: result.status,
    retriedAfterExpiry: result.retriedAfterExpiry,
  }, result.status === "failed" ? 502 : 200);
};

export const handler = createUazAvatarRefreshHandler();

if (import.meta.main) Deno.serve(handler);
