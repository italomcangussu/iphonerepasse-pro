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
import {
  buildCompactManualHandoffPayload,
  buildTranscript,
  generateSummaryShort,
  readEnv,
  resolveLatestCustomerMessageForAi,
  selectLatestCustomerMessage,
  type CrmAiMessageRow,
} from "../_shared/crm_ai_payload.ts";

type Body = {
  conversationId?: string;
  conversation_id?: string;
  toChannelId?: string;
  toStoreId?: string;
  reason?: string;
  target?: "ai";
};

const nonEmpty = (value: unknown): string => String(value ?? "").trim();

const firstPresentIso = (...values: Array<unknown>): string => {
  const raw = values.map(nonEmpty).find((value) => Number.isFinite(Date.parse(value)));
  return raw || new Date(0).toISOString();
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
    .select("id, store_id, lead_id, channel_id, status, ai_enabled, created_at, talk_id")
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
      .select("id,direction,sender_type,content,created_at,media_url,media_type,webhook_payload,provider_message_id,event_origin")
      .eq("conversation_id", conversationId)
      .gte("created_at", firstPresentIso(
        (lead as Record<string, unknown> | null)?.handoff_at,
        (lead as Record<string, unknown> | null)?.human_started_at,
        conversation.created_at,
      ))
      .order("created_at", { ascending: true })
      .limit(500);

    if (messagesError) return jsonResponse({ error: messagesError.message }, 500);

    const leadRecord = (lead as Record<string, unknown> | null) || {};
    const contextMessages = ((rawMessages || []) as CrmAiMessageRow[]).filter((message) =>
      (message.direction === "inbound" && message.sender_type === "customer") ||
      (message.direction === "outbound" && message.sender_type === "human")
    );
    const latestCustomerMessage = selectLatestCustomerMessage(contextMessages);
    const latestResolution = await resolveLatestCustomerMessageForAi({
      message: latestCustomerMessage,
      env: readEnv(),
    });
    const transcript = buildTranscript(contextMessages);
    const summaryResult = await generateSummaryShort({
      transcript,
      latestCustomerText: latestResolution.text,
      env: readEnv(),
    });
    const summaryShort = summaryResult.summaryShort;

    const now = new Date().toISOString();

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
        summary_short: summaryShort,
        conversation_status: "em_atendimento_ia",
        attendance_owner: "ia",
        handoff_at: now,
        last_agent_type: "alana",
        updated_at: now,
      })
      .eq("id", conversation.lead_id);

    const triggerTimestamp = Date.now();
    const triggerPayload = buildCompactManualHandoffPayload({
      event: "manual_handoff_to_ai",
      instanceName: nonEmpty(channel.name) || nonEmpty(channel.id) || "crm",
      storeId: String(conversation.store_id),
      leadId: String(conversation.lead_id),
      leadPhone: nonEmpty(leadRecord.phone),
      chatid: nonEmpty(conversation.talk_id) || nonEmpty(leadRecord.phone),
      senderName: nonEmpty(leadRecord.name) || "Cliente",
      conversationId,
      channelId: nonEmpty(conversation.channel_id),
      reason,
      messageText: latestResolution.text,
      summaryShort,
      timestamp: triggerTimestamp,
    });

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
        summary_short: summaryShort,
        context_message_count: contextMessages.length,
        latest_message_id: latestCustomerMessage?.id || null,
        latest_media_kind: latestResolution.mediaKind,
        latest_message_fallback: latestResolution.usedFallback,
        latest_message_error: latestResolution.error,
        summary_fallback: summaryResult.usedFallback,
        summary_error: summaryResult.error,
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
      leadId: conversation.lead_id,
      summary_short: summaryShort,
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
