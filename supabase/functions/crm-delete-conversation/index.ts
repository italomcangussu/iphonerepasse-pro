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
import { removeStoredLeadAvatar } from "../_shared/uazLeadAvatar.ts";

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

  // Best-effort cleanup: a Storage outage must not block the lead deletion.
  const { data: leadAvatar } = await supabase
    .from("crm_leads")
    .select("avatar_storage_path")
    .eq("id", leadId)
    .eq("store_id", String(conversation.store_id))
    .maybeSingle();
  const avatarRemoved = await removeStoredLeadAvatar({
    supabase,
    storagePath: sanitizeText(leadAvatar?.avatar_storage_path),
  });

  const { data: deletedLeadRows, error: deleteLeadError } = await supabase
    .from("crm_leads")
    .delete()
    .eq("id", leadId)
    .select("id");

  if (deleteLeadError) return jsonResponse({ error: deleteLeadError.message }, 500);
  if (!deletedLeadRows?.length) return jsonResponse({ error: "Lead não encontrado para exclusão." }, 404);

  const deletedLeadState = (deletedLeadStateRows?.length || 0) > 0;
  const deletedLead = deletedLeadRows.length > 0;

  // The agents' conversational chat memory lives in `n8n_chat_histories` on a
  // SEPARATE database (n8n's own Postgres), not reachable from this Supabase
  // client. The "apagar memoria" n8n workflow owns that delete: POST { lead_id }
  // and it wipes every session_id variant for this lead (prefixes '', 'm', '2m').
  // Best-effort: a purge failure must never block the lead deletion itself.
  const agentMemoryPurge = await purgeAgentChatMemory(leadId);

  // NOTE: leadId/conversationId are passed as null here on purpose. crm_event_log
  // has FK constraints (lead_id -> crm_leads, conversation_id -> crm_conversations)
  // and we just deleted both, so binding the audit row to them violates the FK and
  // the insert is silently dropped (logCRMEvent swallows errors). Keep the ids in
  // the payload for traceability and leave the FK columns null.
  await logCRMEvent({
    supabase,
    storeId: String(conversation.store_id),
    eventType: "crm_lead_deleted_from_conversations",
    payload: {
      lead_id: leadId,
      conversation_id: conversationId,
      conversation_ids: conversationIds,
      deleted_messages: deletedMessages,
      deleted_lead_state: deletedLeadState,
      deleted_lead: deletedLead,
      avatar_removed: avatarRemoved,
      agent_memory_purge: agentMemoryPurge,
      preserved_customer_data: true,
    },
    leadId: null,
    conversationId: null,
  });

  return jsonResponse({
    success: true,
    conversationId,
    leadId,
    deletedMessages,
    deletedLeadState,
    deletedLead,
    agentMemoryPurge,
  });
});

const DEFAULT_MEMORY_PURGE_WEBHOOK_URL = "https://n8n.iatende.sbs/webhook/apagar";
const MEMORY_PURGE_TIMEOUT_MS = 10_000;

type AgentMemoryPurge = {
  attempted: boolean;
  ok: boolean;
  status?: number;
  error?: string;
};

// Fire the n8n "apagar memoria" workflow to wipe this lead's agent chat memory.
// Best-effort: any failure is captured and returned, never thrown.
async function purgeAgentChatMemory(leadId: string): Promise<AgentMemoryPurge> {
  const url = (Deno.env.get("CRM_MEMORY_PURGE_WEBHOOK_URL") || DEFAULT_MEMORY_PURGE_WEBHOOK_URL).trim();
  if (!url) return { attempted: false, ok: false, error: "no webhook url configured" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MEMORY_PURGE_TIMEOUT_MS);
  try {
    const apiKey = Deno.env.get("CRM_MEMORY_PURGE_API_KEY");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
      body: JSON.stringify({ lead_id: leadId }),
      signal: controller.signal,
    });
    return { attempted: true, ok: response.ok, status: response.status };
  } catch (error: any) {
    return { attempted: true, ok: false, error: error?.message || "purge request failed" };
  } finally {
    clearTimeout(timer);
  }
}
