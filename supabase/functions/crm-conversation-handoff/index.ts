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

type Body = {
  conversationId?: string;
  toChannelId?: string;
  toStoreId?: string;
  reason?: string;
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

  let auth;
  try {
    auth = await requireAuthenticatedRole(req, supabase);
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Unauthorized." }, 401);
  }

  const body = await parseJsonBody<Body>(req);
  if (!body) return jsonResponse({ error: "Invalid JSON body." }, 400);

  const conversationId = sanitizeText(body.conversationId);
  const toChannelId = sanitizeText(body.toChannelId);
  const toStoreId = sanitizeText(body.toStoreId);
  const reason = sanitizeText(body.reason) || "manual_handoff";

  if (!conversationId) return jsonResponse({ error: "conversationId é obrigatório." }, 400);

  const { data: conversation, error: conversationError } = await supabase
    .from("crm_conversations")
    .select("id, store_id, lead_id, channel_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (conversationError) return jsonResponse({ error: conversationError.message }, 500);
  if (!conversation) return jsonResponse({ error: "Conversa não encontrada." }, 404);

  let transferResult: any = null;
  if (toStoreId && toStoreId !== String(conversation.store_id)) {
    const { data, error } = await supabase.rpc("transfer_lead_store", {
      p_lead_id: conversation.lead_id,
      p_to_store_id: toStoreId,
    });
    if (error) return jsonResponse({ error: error.message }, 500);
    transferResult = data;
  }

  let channelResult: any = null;
  if (toChannelId && toChannelId !== String(conversation.channel_id || "")) {
    const { data, error } = await supabase.rpc("crm_apply_channel_to_conversation", {
      p_conversation_id: conversationId,
      p_channel_id: toChannelId,
      p_changed_by: auth.userId,
      p_reason: reason,
    });
    if (error) return jsonResponse({ error: error.message }, 500);
    channelResult = data;
  }

  const { error: updateStatusError } = await supabase
    .from("crm_conversations")
    .update({ status: "human_handling", updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (updateStatusError) return jsonResponse({ error: updateStatusError.message }, 500);

  await logCRMEvent({
    supabase,
    storeId: String(toStoreId || conversation.store_id),
    eventType: "crm_conversation_handoff",
    payload: {
      conversation_id: conversationId,
      from_store_id: conversation.store_id,
      to_store_id: toStoreId,
      from_channel_id: conversation.channel_id,
      to_channel_id: toChannelId,
      reason,
      actor: auth.userId,
    },
    channelId: toChannelId || sanitizeText(conversation.channel_id),
    leadId: String(conversation.lead_id),
    conversationId,
  });

  return jsonResponse({
    success: true,
    conversationId,
    transferResult,
    channelResult,
  });
});
