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

  const leadId = String(conversation.lead_id);

  const { data: leadConversations, error: leadConversationsError } = await supabase
    .from("crm_conversations")
    .select("id")
    .eq("lead_id", leadId);

  if (leadConversationsError) return jsonResponse({ error: leadConversationsError.message }, 500);

  const conversationIds = Array.from(new Set([
    conversationId,
    ...((leadConversations || []).map((item: { id: string }) => String(item.id)).filter(Boolean)),
  ]));

  let deletedMessages = 0;
  if (conversationIds.length > 0) {
    const { data, error } = await supabase
      .from("crm_messages")
      .delete()
      .in("conversation_id", conversationIds)
      .select("id");

    if (error) return jsonResponse({ error: error.message }, 500);
    deletedMessages += data?.length || 0;
  }

  const { data: directlyLinkedMessages, error: directMessagesError } = await supabase
    .from("crm_messages")
    .delete()
    .eq("lead_id", leadId)
    .select("id");

  if (directMessagesError) return jsonResponse({ error: directMessagesError.message }, 500);
  deletedMessages += directlyLinkedMessages?.length || 0;

  const { data: deletedLeadStateRows, error: deleteLeadStateError } = await supabase
    .from("lead_state")
    .delete()
    .eq("lead_id", leadId)
    .select("lead_id");

  if (deleteLeadStateError) return jsonResponse({ error: deleteLeadStateError.message }, 500);

  const { data: deletedLeadRows, error: deleteLeadError } = await supabase
    .from("crm_leads")
    .delete()
    .eq("id", leadId)
    .select("id");

  if (deleteLeadError) return jsonResponse({ error: deleteLeadError.message }, 500);
  if (!deletedLeadRows?.length) return jsonResponse({ error: "Lead não encontrado para exclusão." }, 404);

  const deletedLeadState = (deletedLeadStateRows?.length || 0) > 0;
  const deletedLead = deletedLeadRows.length > 0;

  await logCRMEvent({
    supabase,
    storeId: String(conversation.store_id),
    eventType: "crm_lead_deleted_from_conversations",
    payload: {
      conversation_id: conversationId,
      conversation_ids: conversationIds,
      deleted_messages: deletedMessages,
      deleted_lead_state: deletedLeadState,
      deleted_lead: deletedLead,
      preserved_customer_data: true,
    },
    leadId,
    conversationId,
  });

  return jsonResponse({
    success: true,
    conversationId,
    leadId,
    deletedMessages,
    deletedLeadState,
    deletedLead,
  });
});
