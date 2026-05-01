/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  createServiceClient,
  getHeaderSecret,
  jsonResponse,
  logCRMEvent,
  parseJsonBody,
  randomProviderMessageId,
  resolveProvider,
  sanitizeText,
} from "../_shared/crm.ts";
import {
  extractInboundMessageId,
  extractInboundPhone,
  extractInboundText,
  extractUazEditedText,
  extractUazEvent,
  extractUazInstanceName,
  extractUazMedia,
  extractUazMessageStatus,
  extractUazPayloadData,
  extractUazReaction,
  extractUazReply,
  isUazApiEcho,
  isUazDeletedMessageUpdate,
  isUazFromMe,
  isUazMessageUpdateEvent,
  isUazWebhookAuthMatch,
  parseUazConnectionStatus,
  parseUazProviderMessageId,
  resolveInstanceToken,
} from "../_shared/uazapi.ts";

type UazWebhookBody = Record<string, unknown>;

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const pickFirstText = (...values: unknown[]): string | null => {
  for (const value of values) {
    const normalized = sanitizeText(value);
    if (normalized) return normalized;
  }
  return null;
};

const parseUazTimestamp = (value: unknown): string => {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();

  const raw = String(value ?? "").trim();
  if (!raw) return new Date().toISOString();

  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) {
    const millis = numeric > 10_000_000_000 ? numeric : numeric * 1000;
    const parsed = new Date(millis);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }

  const parsed = new Date(raw);
  if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  return new Date().toISOString();
};

const isConnectionEvent = (event: string): boolean => event.includes("connection");

const isMessageEvent = (event: string, payload: UazWebhookBody): boolean => {
  if (event === "messages" || event === "message" || event === "message.received") return true;
  if (event.includes("message") && !isUazMessageUpdateEvent(event)) return true;

  const data = extractUazPayloadData(payload);
  return Boolean(data.message || data.key || data.remoteJid || data.from || data.to);
};

const formatReactionContent = (emoji: string | null, fromMe: boolean): string | null => {
  if (!emoji) return null;
  return fromMe ? `Você reagiu com ${emoji}` : `Cliente reagiu com ${emoji}`;
};

const resolveLeadName = (payload: UazWebhookBody, fromMe: boolean): string | null => {
  if (fromMe) return null;
  const data = extractUazPayloadData(payload);
  const contact = asRecord(payload.contact);
  const chat = asRecord(payload.chat || data.chat);
  const message = asRecord(data.message);
  return pickFirstText(
    payload.name,
    payload.pushName,
    payload.contact_name,
    data.name,
    data.pushName,
    data.senderName,
    message.senderName,
    chat.name,
    chat.wa_name,
    chat.wa_contactName,
    chat.lead_name,
    chat.lead_fullName,
    contact.name,
  );
};

const resolveTalkId = (payload: UazWebhookBody): string | null => {
  const data = extractUazPayloadData(payload);
  const key = asRecord(data.key);
  return pickFirstText(
    data.remoteJid,
    data.chatid,
    data.chatId,
    data.talk_id,
    payload.remoteJid,
    payload.chatid,
    payload.chatId,
    key.remoteJid,
  );
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

  const body = await parseJsonBody<UazWebhookBody>(req);
  if (!body) return jsonResponse({ error: "Invalid JSON body." }, 400);

  const payloadProvider = sanitizeText(body.provider);
  if (payloadProvider && payloadProvider.toLowerCase() !== "uazapi") {
    return jsonResponse({ error: "provider legado não suportado. Permitido: uazapi." }, 422);
  }

  const url = new URL(req.url);
  const channelId = sanitizeText(
    body.channel_id || body.channelId ||
    url.searchParams.get("channel_id") || url.searchParams.get("channelId"),
  );
  const storeIdFromPayload = sanitizeText(
    body.store_id || body.storeId ||
    url.searchParams.get("store_id") || url.searchParams.get("storeId"),
  );
  const instanceName = extractUazInstanceName(body);
  const payloadToken = sanitizeText(body.token);
  const queryWebhookSecret = sanitizeText(url.searchParams.get("webhook_secret"));

  let channel: Record<string, unknown> | null = null;

  if (channelId) {
    const { data, error } = await supabase
      .from("crm_channels")
      .select("id, store_id, provider, is_active, webhook_secret, uaz_instance_token, api_key")
      .eq("id", channelId)
      .maybeSingle();
    if (error) return jsonResponse({ error: error.message }, 500);
    channel = (data as Record<string, unknown> | null) || null;
  }

  if (!channel && instanceName) {
    const { data, error } = await supabase
      .from("crm_channels")
      .select("id, store_id, provider, is_active, webhook_secret, uaz_instance_token, api_key")
      .eq("provider", "uazapi")
      .eq("uaz_instance_name", instanceName)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (error) return jsonResponse({ error: error.message }, 500);
    channel = (data as Record<string, unknown> | null) || null;
  }

  if (!channel && payloadToken) {
    const { data, error } = await supabase
      .from("crm_channels")
      .select("id, store_id, provider, is_active, webhook_secret, uaz_instance_token, api_key")
      .eq("provider", "uazapi")
      .eq("uaz_instance_token", payloadToken)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (error) return jsonResponse({ error: error.message }, 500);
    channel = (data as Record<string, unknown> | null) || null;
  }

  if (!channel && payloadToken) {
    const { data, error } = await supabase
      .from("crm_channels")
      .select("id, store_id, provider, is_active, webhook_secret, uaz_instance_token, api_key")
      .eq("provider", "uazapi")
      .eq("api_key", payloadToken)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (error) return jsonResponse({ error: error.message }, 500);
    channel = (data as Record<string, unknown> | null) || null;
  }

  if (!channel && storeIdFromPayload) {
    const { data, error } = await supabase
      .from("crm_channels")
      .select("id, store_id, provider, is_active, webhook_secret, uaz_instance_token, api_key")
      .eq("store_id", storeIdFromPayload)
      .eq("provider", "uazapi")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (error) return jsonResponse({ error: error.message }, 500);
    channel = (data as Record<string, unknown> | null) || null;
  }

  if (!channel) {
    return jsonResponse({ error: "Canal UAZAPI não encontrado. Informe channel_id, store_id, instanceName ou token válido." }, 404);
  }

  if (resolveProvider(channel.provider) !== "uazapi") {
    return jsonResponse({ error: "Canal inválido para webhook UAZAPI." }, 422);
  }
  if (!Boolean(channel.is_active)) {
    return jsonResponse({ error: "Canal inativo." }, 409);
  }

  const expectedSecret = sanitizeText(channel.webhook_secret);
  const headerSecret = getHeaderSecret(req);
  const receivedSecret = headerSecret || queryWebhookSecret;
  if (!isUazWebhookAuthMatch({
    expectedSecret,
    receivedSecret,
    instanceToken: resolveInstanceToken(channel),
    payloadToken,
  })) {
    return jsonResponse({ error: "Invalid webhook secret." }, 401);
  }

  const event = extractUazEvent(body);
  const data = extractUazPayloadData(body);
  const storeId = String(channel.store_id || "");

  if (isConnectionEvent(event)) {
    const connectionStatus = parseUazConnectionStatus(body);
    await supabase
      .from("crm_channels")
      .update({
        uaz_connection_status: connectionStatus,
        uaz_last_status: body,
        uaz_last_status_at: new Date().toISOString(),
      })
      .eq("id", String(channel.id));

    await logCRMEvent({
      supabase,
      storeId,
      eventType: "crm_uaz_connection_event",
      payload: {
        channel_id: channel.id,
        event,
        connection_status: connectionStatus,
      },
      channelId: String(channel.id),
    });

    return jsonResponse({ success: true, handled: "connection", status: connectionStatus });
  }

  if (isUazMessageUpdateEvent(event)) {
    const providerMessageId = extractInboundMessageId(body) || parseUazProviderMessageId(body);
    if (!providerMessageId) {
      return jsonResponse({ success: true, ignored: true, reason: "provider_message_id_not_found" }, 202);
    }

    const { data: message, error: messageError } = await supabase
      .from("crm_messages")
      .select("id, store_id, conversation_id, status, delivered_at, read_at, content")
      .eq("channel_id", String(channel.id))
      .eq("provider_message_id", providerMessageId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (messageError) return jsonResponse({ error: messageError.message }, 500);
    if (!message) {
      return jsonResponse({ success: true, ignored: true, reason: "message_not_found" }, 202);
    }

    const nowIso = new Date().toISOString();
    const patch: Record<string, unknown> = {
      webhook_payload: body,
    };
    let operation = "status";
    const nextStatus = extractUazMessageStatus(body);
    const editedText = extractUazEditedText(body);

    if (isUazDeletedMessageUpdate(body)) {
      patch.content = "[Mensagem apagada para todos]";
      patch.media_url = null;
      patch.media_type = null;
      operation = "deleted";
    } else if (editedText) {
      patch.content = editedText;
      operation = "edited";
    } else if (nextStatus) {
      patch.status = nextStatus;
      if (nextStatus === "delivered" && !message.delivered_at) {
        patch.delivered_at = nowIso;
      }
      if (nextStatus === "read") {
        if (!message.delivered_at) patch.delivered_at = nowIso;
        if (!message.read_at) patch.read_at = nowIso;
      }
    }

    const { error: updateError } = await supabase
      .from("crm_messages")
      .update(patch)
      .eq("id", message.id);
    if (updateError) return jsonResponse({ error: updateError.message }, 500);

    await logCRMEvent({
      supabase,
      storeId: String(message.store_id || storeId),
      eventType: "crm_uaz_message_update",
      payload: {
        channel_id: channel.id,
        message_id: message.id,
        provider_message_id: providerMessageId,
        operation,
        status: nextStatus,
      },
      channelId: String(channel.id),
      conversationId: String(message.conversation_id || ""),
    });

    return jsonResponse({ success: true, handled: "messages_update", operation, status: nextStatus });
  }

  if (isUazApiEcho(body)) {
    return jsonResponse({ success: true, ignored: true, reason: "echo_from_api" }, 202);
  }

  if (!isMessageEvent(event, body)) {
    return jsonResponse({ success: true, ignored: true, reason: `event_not_handled:${event || "unknown"}` }, 202);
  }

  const fromMe = isUazFromMe(body);
  const phone = extractInboundPhone(body);
  if (!phone) {
    return jsonResponse({ success: true, ignored: true, reason: "phone_not_found" }, 202);
  }

  const media = extractUazMedia(body);
  const reply = extractUazReply(body);
  const reaction = extractUazReaction(body);
  const isReaction = Boolean(reaction.emoji || reaction.targetMessageId);
  const messageContent = extractInboundText(body) || formatReactionContent(reaction.emoji, fromMe);
  const providerMessageId = extractInboundMessageId(body) || randomProviderMessageId(fromMe ? "uaz_out" : "uaz_in");
  const payloadMessage = asRecord(data.message);
  const sentAt = parseUazTimestamp(
    data.messageTimestamp ||
      data.timestamp ||
      payloadMessage.messageTimestamp ||
      payloadMessage.timestamp ||
      body.timestamp ||
      body.messageTimestamp,
  );

  const { data: leadId, error: upsertLeadError } = await supabase.rpc("upsert_crm_lead", {
    p_store_id: storeId,
    p_phone: phone,
    p_name: resolveLeadName(body, fromMe),
    p_contact_id: resolveTalkId(body),
    p_entity_id: sanitizeText(body.instance),
    p_channel_id: channel.id,
    p_email: null,
    p_utm_source: null,
    p_utm_campaign: null,
    p_utm_medium: null,
    p_utm_content: null,
    p_utm_term: null,
    p_first_message: messageContent,
    p_intent: null,
  });

  if (upsertLeadError) return jsonResponse({ error: upsertLeadError.message }, 500);

  const resolvedLeadId = String(leadId || "").trim();
  if (!resolvedLeadId) {
    return jsonResponse({ error: "Falha ao resolver lead para o webhook UAZ." }, 500);
  }

  let conversation: Record<string, unknown> | null = null;
  {
    const { data: conversationRow, error } = await supabase
      .from("crm_conversations")
      .select("id, store_id, lead_id, channel_id")
      .eq("store_id", storeId)
      .eq("lead_id", resolvedLeadId)
      .maybeSingle();
    if (error) return jsonResponse({ error: error.message }, 500);
    conversation = (conversationRow as Record<string, unknown> | null) || null;
  }

  if (!conversation) {
    const { data: createdConversation, error } = await supabase
      .from("crm_conversations")
      .insert({
        store_id: channel.store_id,
        lead_id: resolvedLeadId,
        channel_id: channel.id,
        talk_id: resolveTalkId(body),
        status: fromMe ? "human_handling" : "open",
        ai_enabled: !fromMe,
      })
      .select("id, store_id, lead_id, channel_id")
      .single();
    if (error) return jsonResponse({ error: error.message }, 500);
    conversation = createdConversation as Record<string, unknown>;
  }

  await supabase.rpc("crm_apply_channel_to_conversation", {
    p_conversation_id: conversation.id,
    p_channel_id: channel.id,
    p_changed_by: null,
    p_reason: fromMe ? "crm_uaz_webhook_from_me" : "crm_uaz_webhook",
  });

  const insertPayload = {
    conversation_id: conversation.id,
    lead_id: resolvedLeadId,
    store_id: channel.store_id,
    channel_id: channel.id,
    direction: fromMe ? "outbound" : "inbound",
    sender_type: fromMe ? "human" : "customer",
    content: messageContent,
    media_url: media.mediaUrl,
    media_type: media.mediaType,
    external_id: providerMessageId,
    provider_message_id: providerMessageId,
    reply_to_provider_message_id: reply.targetMessageId,
    reply_preview_text: reply.previewText,
    reaction_target_provider_message_id: reaction.targetMessageId,
    reaction_emoji: reaction.emoji,
    status: "sent",
    sent_at: sentAt,
    webhook_payload: body,
    event_origin: isReaction ? "reaction" : "direct",
  };

  const { data: insertedMessage, error: insertMessageError } = await supabase
    .from("crm_messages")
    .insert(insertPayload)
    .select("id")
    .single();

  if (insertMessageError) {
    if (String(insertMessageError.code) === "23505") {
      const { data: duplicated } = await supabase
        .from("crm_messages")
        .select("id")
        .eq("channel_id", String(channel.id))
        .eq("provider_message_id", providerMessageId)
        .maybeSingle();

      await logCRMEvent({
        supabase,
        storeId,
        eventType: "crm_uaz_deduped",
        payload: {
          provider_message_id: providerMessageId,
          lead_id: resolvedLeadId,
          conversation_id: conversation.id,
        },
        channelId: String(channel.id),
        leadId: resolvedLeadId,
        conversationId: String(conversation.id),
      });

      return jsonResponse({
        success: true,
        deduped: true,
        messageId: duplicated?.id || null,
        conversationId: conversation.id,
        leadId: resolvedLeadId,
      });
    }
    return jsonResponse({ error: insertMessageError.message }, 500);
  }

  if (fromMe && !isReaction) {
    await supabase
      .from("crm_conversations")
      .update({
        status: "human_handling",
        ai_enabled: false,
        unread_count: 0,
        last_response_at: sentAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversation.id);
  }

  await logCRMEvent({
    supabase,
    storeId,
    eventType: fromMe ? "crm_uaz_outbound_message" : "crm_uaz_inbound_message",
    payload: {
      message_id: insertedMessage.id,
      provider_message_id: providerMessageId,
      lead_id: resolvedLeadId,
      conversation_id: conversation.id,
      media_url: media.mediaUrl,
      media_type: media.mediaType,
      event_origin: isReaction ? "reaction" : "direct",
      from_me: fromMe,
    },
    channelId: String(channel.id),
    leadId: resolvedLeadId,
    conversationId: String(conversation.id),
  });

  return jsonResponse({
    success: true,
    deduped: false,
    messageId: insertedMessage.id,
    conversationId: conversation.id,
    leadId: resolvedLeadId,
    direction: fromMe ? "outbound" : "inbound",
  });
});
