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
  conversation_id?: string;
  toChannelId?: string;
  toStoreId?: string;
  reason?: string;
  target?: "ai";
};

const nonEmpty = (value: unknown): string => String(value ?? "").trim();

const buildSummaryShort = (lead: Record<string, unknown> | null): string | null => {
  const parts = [
    nonEmpty(lead?.name),
    nonEmpty(lead?.phone),
    `etapa: ${nonEmpty(lead?.sales_stage) || "entrada"}`,
  ];
  const intent = nonEmpty(lead?.intent);
  if (intent) parts.push(`intencao: ${intent}`);
  return parts.filter(Boolean).join(" | ") || null;
};

const buildSummaryOperational = (
  lead: Record<string, unknown> | null,
  conversationStatus: string,
): string | null => {
  const nameOrPhone = nonEmpty(lead?.name) || nonEmpty(lead?.phone) || "sem identificacao";
  const parts = [
    `lead: ${nameOrPhone}`,
    `etapa: ${nonEmpty(lead?.sales_stage) || "entrada"}`,
  ];

  const intent = nonEmpty(lead?.intent);
  if (intent) parts.push(`intencao: ${intent}`);
  if (conversationStatus) parts.push(`status: ${conversationStatus}`);

  const lastMessage = nonEmpty(lead?.last_message_content);
  if (lastMessage) parts.push(`ultima mensagem enviada: ${lastMessage.slice(0, 240)}`);

  const lastEventName = nonEmpty(lead?.last_event_name);
  if (lastEventName) parts.push(`ultimo evento: ${lastEventName}`);

  const lastEventAt = nonEmpty(lead?.last_event_at);
  if (lastEventAt) parts.push(`ultimo evento em: ${lastEventAt}`);

  const lastOrderSummary = nonEmpty(lead?.last_order_summary);
  if (lastOrderSummary) parts.push(`ultima compra: ${lastOrderSummary.slice(0, 180)}`);

  const lastInteractionAt = nonEmpty(lead?.last_interaction_at);
  if (lastInteractionAt) parts.push(`ultima interacao em: ${lastInteractionAt}`);

  return parts.filter(Boolean).join(" | ") || null;
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

  const conversationId = sanitizeText(body.conversationId) || sanitizeText(body.conversation_id);
  const toChannelId = sanitizeText(body.toChannelId);
  const toStoreId = sanitizeText(body.toStoreId);
  const reason = sanitizeText(body.reason) || "manual_handoff";
  const target = sanitizeText(body.target);

  if (!conversationId) return jsonResponse({ error: "conversationId é obrigatório." }, 400);

  const { data: conversation, error: conversationError } = await supabase
    .from("crm_conversations")
    .select("id, store_id, lead_id, channel_id, status, ai_enabled")
    .eq("id", conversationId)
    .maybeSingle();

  if (conversationError) return jsonResponse({ error: conversationError.message }, 500);
  if (!conversation) return jsonResponse({ error: "Conversa não encontrada." }, 404);

  if (target === "ai") {
    if (conversation.status === "ai_handling" && conversation.ai_enabled === true) {
      return jsonResponse({
        success: true,
        noop: true,
        conversationId,
        triggerDispatched: false,
        message: "Conversa já está em atendimento por IA.",
      });
    }

    const { data: channel, error: channelError } = await supabase
      .from("crm_channels")
      .select("id, store_id, name, provider, ai_resume_webhook_url")
      .eq("id", conversation.channel_id)
      .maybeSingle();

    if (channelError) return jsonResponse({ error: channelError.message }, 500);
    if (!channel) return jsonResponse({ error: "Canal da conversa não encontrado." }, 404);

    const aiResumeWebhookUrl = String(channel.ai_resume_webhook_url || "").trim();
    if (!aiResumeWebhookUrl) {
      return jsonResponse({ error: "Canal sem ai_resume_webhook_url configurada" }, 422);
    }
    if (!aiResumeWebhookUrl.toLowerCase().startsWith("https://")) {
      return jsonResponse({ error: "ai_resume_webhook_url deve usar HTTPS" }, 422);
    }

    const { data: lead } = await supabase
      .from("crm_leads")
      .select("*")
      .eq("id", conversation.lead_id)
      .maybeSingle();

    const { data: rawMessages, error: messagesError } = await supabase
      .from("crm_messages")
      .select("id,direction,sender_type,content,created_at,media_url,media_type,webhook_payload")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (messagesError) return jsonResponse({ error: messagesError.message }, 500);

    const messages = [...((rawMessages || []) as Array<Record<string, unknown>>)].reverse();
    const summary = messages
      .map((message) => {
        const direction = String(message.direction || "");
        const senderType = String(message.sender_type || "");
        const who = direction === "inbound" ? "Cliente" : senderType.includes("ai") ? "IA" : "Humano";
        const content = String(message.content || message.media_type || "[midia]").slice(0, 600);
        return `${who}: ${content}`;
      })
      .join("\n")
      .slice(0, 8000);

    const now = new Date().toISOString();
    const leadRecord = (lead as Record<string, unknown> | null) || null;
    const summaryShort = buildSummaryShort(leadRecord);
    const summaryOperational = buildSummaryOperational(leadRecord, "em_atendimento_ia");

    const { error: updateConversationError } = await supabase
      .from("crm_conversations")
      .update({
        status: "ai_handling",
        ai_enabled: true,
        updated_at: now,
      })
      .eq("id", conversationId);

    if (updateConversationError) return jsonResponse({ error: updateConversationError.message }, 500);

    await supabase
      .from("crm_leads")
      .update({
        conversation_status: "em_atendimento_ia",
        attendance_owner: "ia",
        handoff_at: now,
        last_agent_type: "alana",
        summary_short: summaryShort,
        summary_operational: summaryOperational,
        updated_at: now,
      })
      .eq("id", conversation.lead_id);

    const triggerPayload = {
      event: "manual_handoff_to_ai",
      instanceName: "crm",
      type: "manual_handoff",
      lead_id: String(conversation.lead_id),
      store_id: String(conversation.store_id),
      body: {
        sender: String((lead as Record<string, unknown> | null)?.phone || ""),
        message: {
          messageTimestamp: Date.now(),
          text: summary,
          senderName: String((lead as Record<string, unknown> | null)?.name || "Cliente"),
          messageid: `manual-ai-${conversationId}-${Date.now()}`,
          fromMe: false,
          edited: "",
          owner: "",
          chatid: String((lead as Record<string, unknown> | null)?.phone || ""),
          content: summary,
        },
        BaseUrl: "https://crm.internal/manual-handoff",
        EventType: "manual_handoff",
        chatid: String((lead as Record<string, unknown> | null)?.phone || ""),
        mediaType: "",
      },
      lead_detail: lead || null,
      meta: {
        source: "crm_manual_handoff",
        conversation_id: conversationId,
        channel_id: conversation.channel_id,
        actor_user_id: auth.userId,
        reason,
      },
      conversation_context: messages,
      summary,
    };

    let triggerDispatched = false;
    let triggerStatusCode: number | null = null;
    let triggerError: string | null = null;
    let triggerResponseBody: string | null = null;
    try {
      const triggerResponse = await fetch(aiResumeWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(triggerPayload),
        signal: AbortSignal.timeout(15_000),
      });
      triggerStatusCode = triggerResponse.status;
      triggerResponseBody = (await triggerResponse.text()).slice(0, 1000);
      triggerDispatched = triggerResponse.ok;
      if (!triggerResponse.ok) triggerError = `HTTP ${triggerResponse.status}`;
    } catch (error) {
      triggerError = error instanceof Error ? error.message : String(error || "dispatch_failed");
    }

    await logCRMEvent({
      supabase,
      storeId: String(conversation.store_id),
      eventType: "crm_manual_handoff_to_ai",
      payload: {
        source: "crm_manual_handoff",
        target: "ai",
        conversation_id: conversationId,
        trigger_dispatched: triggerDispatched,
        trigger_status_code: triggerStatusCode,
        trigger_error: triggerError,
        trigger_response_body: triggerResponseBody,
        trigger_payload: triggerPayload,
      },
      channelId: sanitizeText(conversation.channel_id),
      leadId: String(conversation.lead_id),
      conversationId,
    });

    return jsonResponse({
      success: true,
      noop: false,
      conversationId,
      triggerDispatched,
      triggerStatusCode,
      triggerError,
    });
  }

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
