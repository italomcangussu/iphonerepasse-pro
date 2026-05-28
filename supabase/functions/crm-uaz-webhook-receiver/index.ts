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
  buildUazBaseUrl,
  buildUazDownloadMessageRequest,
  extractInboundMessageId,
  extractInboundPhone,
  extractInboundText,
  extractUazChatId,
  extractUazEditedText,
  extractUazEvent,
  extractUazGroupInfo,
  extractUazInstanceName,
  extractUazLeadAvatarUrl,
  extractUazMedia,
  extractUazMessageStatus,
  extractUazPayloadData,
  extractUazReaction,
  extractUazReply,
  isUazApiEcho,
  isUazDeletedMessageUpdate,
  isUazFromMe,
  isUazMessageUpdateEvent,
  isUazUndecryptableMessage,
  parseUazDownloadedContent,
  isUazWebhookAuthMatch,
  parseUazConnectionStatus,
  parseUazDownloadedMedia,
  parseUazHttpError,
  parseUazProviderMessageId,
  resolveInstanceToken,
} from "../_shared/uazapi.ts";

type UazWebhookBody = Record<string, unknown>;

// ─── Ad source detection (inline — no shared dep needed) ──────────────────────

type AdSource = "meta_ads" | "instagram_ads" | "click_to_whatsapp";
interface AdSourceData { source: AdSource; sourceId: string | null; sourceCampaignTitle: string | null }

const readAlias = (rec: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) if (rec[k] !== undefined) return rec[k];
  return undefined;
};

const toText = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s || null; };

function collectNested(value: unknown, depth = 5, seen = new Set<Record<string, unknown>>()): Record<string, unknown>[] {
  if (depth < 0) return [];
  const rec = (!value || typeof value !== "object" || Array.isArray(value)) ? null : value as Record<string, unknown>;
  if (!rec || seen.has(rec)) return [];
  seen.add(rec);
  const items: Record<string, unknown>[] = [rec];
  for (const v of Object.values(rec)) { if (v && typeof v === "object") items.push(...collectNested(v, depth - 1, seen)); }
  return items;
}

function detectAdSource(payload: UazWebhookBody): AdSourceData | null {
  const records = collectNested(payload, 7);
  for (const rec of records) {
    const ctx = (!rec.contextInfo || typeof rec.contextInfo !== "object" || Array.isArray(rec.contextInfo)) ? null : rec.contextInfo as Record<string, unknown>;
    if (!ctx) continue;
    const ext = (!ctx.externalAdReply || typeof ctx.externalAdReply !== "object" || Array.isArray(ctx.externalAdReply)) ? null : ctx.externalAdReply as Record<string, unknown>;
    const srcType = String(readAlias(ext ?? ctx, ["sourceType", "source_type"]) ?? "").trim().toLowerCase();
    const showAttr = readAlias(ext ?? ctx, ["showAdAttribution", "show_ad_attribution"]);
    const isAd = srcType === "ad" || showAttr === true || String(showAttr ?? "").toLowerCase() === "true";
    if (!isAd) continue;
    const srcApp = String(readAlias(ext ?? ctx, ["sourceApp", "source_app"]) ?? "").toLowerCase();
    const sourceId = toText(readAlias(ext ?? ctx, ["sourceID", "sourceId", "source_id"]));
    const title = toText(readAlias(ext ?? {}, ["title"]));
    let source: AdSource = "instagram_ads";
    if (srcApp.includes("face") || srcApp.includes("fb")) source = "meta_ads";
    else if (srcApp.includes("ctwa")) source = "click_to_whatsapp";
    return { source, sourceId, sourceCampaignTitle: title };
  }
  return null;
}

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

const getCrmNotificationBaseUrl = (): string => {
  const explicitUrl = String(Deno.env.get("CRM_BASE_URL") || "").trim();
  if (explicitUrl) return explicitUrl.replace(/\/$/, "");

  const hostname = String(Deno.env.get("CRM_HOSTNAME") || "crm.iphonerepasse.com.br").trim();
  return `https://${hostname || "crm.iphonerepasse.com.br"}`;
};

const compactNotificationText = (value: string | null, fallback: string): string => {
  const normalized = sanitizeText(value) || fallback;
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
};

const buildCrmNotificationUrl = (conversationId: string, leadId: string): string => {
  const baseUrl = getCrmNotificationBaseUrl();
  const target = conversationId
    ? `/conversations/${encodeURIComponent(conversationId)}`
    : leadId
      ? `/leads/${encodeURIComponent(leadId)}`
      : "/";
  return `${baseUrl}${target}`;
};

export const buildCrmPushNotificationRequest = (args: {
  topic: "crm_inbox" | "new_lead";
  title: string;
  body: string;
  conversationId: string;
  leadId: string;
}): { endpoint: string; init: RequestInit; payload: { topic: "crm_inbox" | "new_lead"; notification: Record<string, unknown> } } | null => {
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const serviceRoleKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
  if (!supabaseUrl || !serviceRoleKey) return null;

  const payload = {
    topic: args.topic,
    notification: {
      title: compactNotificationText(args.title, args.topic === "new_lead" ? "Novo lead no CRM" : "Nova mensagem CRM"),
      body: compactNotificationText(args.body, args.topic === "new_lead" ? "Novo lead recebido." : "Nova mensagem recebida."),
      url: buildCrmNotificationUrl(args.conversationId, args.leadId),
      icon: "/brand/crm/icon-192.png",
      badge: "/brand/crm/icon-192.png",
      tag: `crm-${args.topic}-${args.conversationId || args.leadId || "inbox"}`,
      requireInteraction: args.topic === "new_lead",
    },
  };

  return {
    endpoint: `${supabaseUrl}/functions/v1/push-send`,
    payload,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(payload),
    },
  };
};

export const sendCrmPushNotification = async (args: {
  topic: "crm_inbox" | "new_lead";
  title: string;
  body: string;
  conversationId: string;
  leadId: string;
}) => {
  try {
    const request = buildCrmPushNotificationRequest(args);
    if (!request) return;

    const response = await fetch(request.endpoint, request.init);

    if (!response.ok) {
      const responseText = await response.text();
      console.warn("[crm-push] push-send failed", response.status, responseText.slice(0, 240));
    }
  } catch (error) {
    console.warn("[crm-push] delivery failed", error);
  }
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
  return extractUazChatId(payload);
};

const downloadUazMedia = async (args: {
  channel: Record<string, unknown>;
  messageId: string;
  mediaType: string | null;
}): Promise<{ mediaUrl: string | null; mediaType: string | null; mediaFilename: string | null; content: string | null; error: string | null }> => {
  const empty = { mediaUrl: null, mediaType: null, mediaFilename: null, content: null };
  const instanceToken = resolveInstanceToken(args.channel);
  if (!instanceToken) return { ...empty, error: "uaz_instance_token não configurado." };

  let request: { endpoint: string; body: Record<string, unknown> };
  try {
    request = buildUazDownloadMessageRequest({ messageId: args.messageId, mediaType: args.mediaType });
  } catch (error) {
    return {
      ...empty,
      error: error instanceof Error ? error.message : "Payload inválido para download de mídia UAZAPI.",
    };
  }

  const endpoint = `${buildUazBaseUrl(args.channel.uaz_subdomain)}${request.endpoint}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      token: instanceToken,
    },
    body: JSON.stringify(request.body),
  });

  const responseText = await response.text();
  let responseBody: unknown = responseText;
  try {
    responseBody = responseText ? JSON.parse(responseText) : {};
  } catch {
    responseBody = responseText;
  }

  if (!response.ok) {
    return {
      ...empty,
      error: parseUazHttpError("uaz_media_download_failed", response.status, responseText),
    };
  }

  return { ...parseUazDownloadedMedia(responseBody), content: parseUazDownloadedContent(responseBody), error: null };
};

export const handler = async (req: Request) => {
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
      .select("id, store_id, provider, is_active, webhook_secret, uaz_subdomain, uaz_instance_token, api_key")
      .eq("id", channelId)
      .maybeSingle();
    if (error) return jsonResponse({ error: error.message }, 500);
    channel = (data as Record<string, unknown> | null) || null;
  }

  if (!channel && instanceName) {
    const { data, error } = await supabase
      .from("crm_channels")
      .select("id, store_id, provider, is_active, webhook_secret, uaz_subdomain, uaz_instance_token, api_key")
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
      .select("id, store_id, provider, is_active, webhook_secret, uaz_subdomain, uaz_instance_token, api_key")
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
      .select("id, store_id, provider, is_active, webhook_secret, uaz_subdomain, uaz_instance_token, api_key")
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
      .select("id, store_id, provider, is_active, webhook_secret, uaz_subdomain, uaz_instance_token, api_key")
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
  const groupInfo = extractUazGroupInfo(body);
  const leadPhone = groupInfo.isGroup && groupInfo.groupJid ? groupInfo.groupJid : phone;
  if (!leadPhone) {
    return jsonResponse({ success: true, ignored: true, reason: "phone_not_found" }, 202);
  }

  const media = extractUazMedia(body);
  const reply = extractUazReply(body);
  const reaction = extractUazReaction(body);
  const isReaction = Boolean(reaction.emoji || reaction.targetMessageId);
  const isUndecryptable = isUazUndecryptableMessage(body);
  let messageContent = extractInboundText(body) || formatReactionContent(reaction.emoji, fromMe);
  const providerMessageId = extractInboundMessageId(body) || randomProviderMessageId(fromMe ? "uaz_out" : "uaz_in");
  let resolvedMedia = media;
  let mediaDownloadError: string | null = null;
  if ((media.mediaUrl || isUndecryptable) && providerMessageId && !isReaction) {
    const downloaded = await downloadUazMedia({ channel, messageId: providerMessageId, mediaType: media.mediaType });
    if (downloaded.content) {
      messageContent = downloaded.content;
    }
    if (downloaded.mediaUrl) {
      resolvedMedia = {
        mediaUrl: downloaded.mediaUrl,
        mediaType: downloaded.mediaType || media.mediaType,
        mediaFilename: downloaded.mediaFilename || media.mediaFilename,
      };
    } else {
      mediaDownloadError = downloaded.error;
    }
  }
  if (!messageContent && isUndecryptable && !resolvedMedia.mediaUrl) {
    messageContent = "Mensagem não descriptografada pela UAZAPI. Abra o WhatsApp no celular vinculado para visualizá-la.";
  }
  const talkId = resolveTalkId(body);
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
    p_phone: leadPhone,
    p_name: groupInfo.isGroup ? groupInfo.name : resolveLeadName(body, fromMe),
    p_contact_id: talkId,
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

  const leadAvatarUrl = groupInfo.isGroup ? null : extractUazLeadAvatarUrl(body);
  if (leadAvatarUrl) {
    const { data: leadAvatarRow } = await supabase
      .from("crm_leads")
      .select("avatar_url")
      .eq("id", resolvedLeadId)
      .maybeSingle();
    const currentAvatarUrl = sanitizeText((leadAvatarRow as Record<string, unknown> | null)?.avatar_url);
    if (currentAvatarUrl !== leadAvatarUrl) {
      await supabase
        .from("crm_leads")
        .update({ avatar_url: leadAvatarUrl, updated_at: new Date().toISOString() })
        .eq("id", resolvedLeadId);
    }
  }

  let conversation: Record<string, unknown> | null = null;
  let createdConversationForInbound = false;

  if (talkId) {
    const { data: conversationRow, error } = await supabase
      .from("crm_conversations")
      .select("id, store_id, lead_id, channel_id, talk_id")
      .eq("store_id", storeId)
      .eq("channel_id", String(channel.id))
      .eq("talk_id", talkId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return jsonResponse({ error: error.message }, 500);
    conversation = (conversationRow as Record<string, unknown> | null) || null;
  }

  if (!conversation) {
    const { data: conversationRow, error } = await supabase
      .from("crm_conversations")
      .select("id, store_id, lead_id, channel_id, talk_id")
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
        talk_id: talkId,
        is_group: groupInfo.isGroup,
        group_name: groupInfo.name,
        group_avatar_url: groupInfo.avatarUrl,
        status: fromMe ? "human_handling" : "open",
        ai_enabled: !fromMe,
      })
      .select("id, store_id, lead_id, channel_id, talk_id")
      .single();
    if (error) return jsonResponse({ error: error.message }, 500);
    conversation = createdConversation as Record<string, unknown>;
    createdConversationForInbound = !fromMe;
  } else if (talkId && !sanitizeText(conversation.talk_id)) {
    await supabase
      .from("crm_conversations")
      .update({ talk_id: talkId })
      .eq("id", conversation.id);
  }

  if (groupInfo.isGroup) {
    await supabase
      .from("crm_conversations")
      .update({
        is_group: true,
        group_name: groupInfo.name,
        group_avatar_url: groupInfo.avatarUrl,
      })
      .eq("id", conversation.id);
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
    media_url: resolvedMedia.mediaUrl,
    media_type: resolvedMedia.mediaType,
    external_id: providerMessageId,
    provider_message_id: providerMessageId,
    reply_to_provider_message_id: reply.targetMessageId,
    reply_preview_text: reply.previewText,
    reaction_target_provider_message_id: reaction.targetMessageId,
    reaction_emoji: reaction.emoji,
    status: "sent",
    sent_at: sentAt,
    webhook_payload: mediaDownloadError ? { ...body, media_download_error: mediaDownloadError } : body,
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
          media_downloaded: Boolean(resolvedMedia.mediaUrl && resolvedMedia.mediaUrl !== media.mediaUrl),
          media_download_error: mediaDownloadError,
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

  // Detect paid-traffic origin from externalAdReply — persist on lead (first inbound only)
  if (!fromMe && !isReaction) {
    const adSource = detectAdSource(body);
    if (adSource) {
      await supabase
        .from("crm_leads")
        .update({
          source: adSource.source,
          source_campaign_id: adSource.sourceId,
          source_campaign_title: adSource.sourceCampaignTitle,
        })
        .eq("id", resolvedLeadId)
        .is("source", null); // only set on first detection
    }
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
      media_url: resolvedMedia.mediaUrl,
      media_type: resolvedMedia.mediaType,
      media_downloaded: Boolean(resolvedMedia.mediaUrl && resolvedMedia.mediaUrl !== media.mediaUrl),
      media_download_error: mediaDownloadError,
      event_origin: isReaction ? "reaction" : "direct",
      from_me: fromMe,
    },
    channelId: String(channel.id),
    leadId: resolvedLeadId,
    conversationId: String(conversation.id),
  });

  if (!fromMe) {
    const displayName = groupInfo.name || resolveLeadName(body, fromMe) || leadPhone;
    const messagePreview = compactNotificationText(messageContent, resolvedMedia.mediaType ? "Nova mídia recebida." : "Nova mensagem recebida.");
    await sendCrmPushNotification({
      topic: "crm_inbox",
      title: "Nova mensagem CRM",
      body: `${displayName}: ${messagePreview}`,
      conversationId: String(conversation.id),
      leadId: resolvedLeadId,
    });

    if (createdConversationForInbound) {
      await sendCrmPushNotification({
        topic: "new_lead",
        title: "Novo lead no CRM",
        body: compactNotificationText(`${displayName}: ${messagePreview}`, "Novo lead recebido."),
        conversationId: String(conversation.id),
        leadId: resolvedLeadId,
      });
    }
  }

  return jsonResponse({
    success: true,
    deduped: false,
    messageId: insertedMessage.id,
    conversationId: conversation.id,
    leadId: resolvedLeadId,
    direction: fromMe ? "outbound" : "inbound",
  });
};

if (import.meta.main) {
  Deno.serve(handler);
}
