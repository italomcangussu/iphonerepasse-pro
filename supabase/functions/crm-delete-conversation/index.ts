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

  try {
    await requireAuthenticatedRole(req, supabase);
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Unauthorized." }, 401);
  }

  const body = await parseJsonBody<Body>(req);
  if (!body) return jsonResponse({ error: "Invalid JSON body." }, 400);

  const conversationId = sanitizeText(body.conversationId);
  if (!conversationId) return jsonResponse({ error: "conversationId é obrigatório." }, 400);

  const { data: conversation, error: conversationError } = await supabase
    .from("crm_conversations")
    .select("id, store_id, lead_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (conversationError) return jsonResponse({ error: conversationError.message }, 500);
  if (!conversation) return jsonResponse({ error: "Conversa não encontrada." }, 404);

  const { count: messagesCount, error: countError } = await supabase
    .from("crm_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId);

  if (countError) return jsonResponse({ error: countError.message }, 500);

  const { error: deleteConversationError } = await supabase
    .from("crm_conversations")
    .delete()
    .eq("id", conversationId);

  if (deleteConversationError) return jsonResponse({ error: deleteConversationError.message }, 500);

  await logCRMEvent({
    supabase,
    storeId: String(conversation.store_id),
    eventType: "crm_conversation_deleted",
    payload: {
      conversation_id: conversationId,
      deleted_messages: Number(messagesCount || 0),
    },
    leadId: String(conversation.lead_id),
    conversationId,
  });

  return jsonResponse({
    success: true,
    conversationId,
    deletedMessages: Number(messagesCount || 0),
  });
});
