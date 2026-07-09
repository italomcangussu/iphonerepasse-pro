/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};
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
  extractUazMedia,
  extractUazMessageStatus,
  extractUazPayloadData,
  extractUazReaction,
  extractUazReply,
  isUazApiEcho,
  isUazDeletedMessageUpdate,
  isUazDownloadableMedia,
  isUazFromMe,
  isUazMessageUpdateEvent,
  isUazUndecryptableMessage,
  isUazWebhookAuthMatch,
  parseUazConnectionStatus,
  parseUazDownloadedContent,
  parseUazDownloadedMedia,
  parseUazHttpError,
  parseUazProviderMessageId,
  resolveInstanceToken,
} from "../_shared/uazapi.ts";
import { dispatchAiInboundIfEligible } from "../_shared/crm_ai_inbound_dispatch.ts";
import { transcribeAudioForAi } from "../_shared/crm_ai_payload.ts";
import {
  applyAiRoutingDecision,
  resolveAiRoutingDecision,
} from "../_shared/crm_ai_routing.ts";
import {
  buildCrmPushNotificationRequest,
  compactNotificationText,
  sendCrmPushNotification,
} from "../_shared/crm_push.ts";
import { persistProviderMediaToCrmStorage } from "../_shared/crm_media_storage.ts";
import { extractAdContext } from "../_shared/crm_ad_context.ts";
import {
  buildLeadAvatarStoragePath,
  convertLeadAvatarToWebp,
} from "../_shared/uazLeadAvatar.ts";
import {
  drainUazAvatarJobs,
  enqueueUazAvatarJob,
} from "../_shared/uazAvatarJobs.ts";

// Re-exported for the existing Deno test suite that imports it from this module.
export {
  buildCrmPushNotificationRequest,
  buildLeadAvatarStoragePath,
  convertLeadAvatarToWebp,
  sendCrmPushNotification,
};

type UazWebhookBody = Record<string, unknown>;

// ─── Ad source detection (inline — no shared dep needed) ──────────────────────

type AdSource = "meta_ads" | "instagram_ads" | "click_to_whatsapp";
interface AdSourceData {
  source: AdSource;
  sourceId: string | null;
  sourceCampaignTitle: string | null;
}

const readAlias = (rec: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) if (rec[k] !== undefined) return rec[k];
  return undefined;
};

const toText = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return s || null;
};

function collectNested(
  value: unknown,
  depth = 5,
  seen = new Set<Record<string, unknown>>(),
): Record<string, unknown>[] {
  if (depth < 0) return [];
  const rec = (!value || typeof value !== "object" || Array.isArray(value))
    ? null
    : value as Record<string, unknown>;
  if (!rec || seen.has(rec)) return [];
  seen.add(rec);
  const items: Record<string, unknown>[] = [rec];
  for (const v of Object.values(rec)) {
    if (v && typeof v === "object") {
      items.push(...collectNested(v, depth - 1, seen));
    }
  }
  return items;
}

function detectAdSource(payload: UazWebhookBody): AdSourceData | null {
  const records = collectNested(payload, 7);
  for (const rec of records) {
    const ctx = (!rec.contextInfo || typeof rec.contextInfo !== "object" ||
        Array.isArray(rec.contextInfo))
      ? null
      : rec.contextInfo as Record<string, unknown>;
    if (!ctx) continue;
    const ext =
      (!ctx.externalAdReply || typeof ctx.externalAdReply !== "object" ||
          Array.isArray(ctx.externalAdReply))
        ? null
        : ctx.externalAdReply as Record<string, unknown>;
    const srcType = String(
      readAlias(ext ?? ctx, ["sourceType", "source_type"]) ?? "",
    ).trim().toLowerCase();
    const showAttr = readAlias(ext ?? ctx, [
      "showAdAttribution",
      "show_ad_attribution",
    ]);
    const isAd = srcType === "ad" || showAttr === true ||
      String(showAttr ?? "").toLowerCase() === "true";
    if (!isAd) continue;
    const srcApp = String(
      readAlias(ext ?? ctx, ["sourceApp", "source_app"]) ?? "",
    ).toLowerCase();
    const sourceId = toText(
      readAlias(ext ?? ctx, ["sourceID", "sourceId", "source_id"]),
    );
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
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }

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

const isConnectionEvent = (event: string): boolean =>
  event.includes("connection");

const isMessageEvent = (event: string, payload: UazWebhookBody): boolean => {
  if (
    event === "messages" || event === "message" || event === "message.received"
  ) return true;
  if (event.includes("message") && !isUazMessageUpdateEvent(event)) return true;

  const data = extractUazPayloadData(payload);
  return Boolean(
    data.message || data.key || data.remoteJid || data.from || data.to,
  );
};

const formatReactionContent = (
  emoji: string | null,
  fromMe: boolean,
): string | null => {
  if (!emoji) return null;
  return fromMe ? `Você reagiu com ${emoji}` : `Cliente reagiu com ${emoji}`;
};

const resolveLeadName = (
  payload: UazWebhookBody,
  fromMe: boolean,
): string | null => {
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
}): Promise<
  {
    mediaUrl: string | null;
    mediaType: string | null;
    mediaFilename: string | null;
    content: string | null;
    error: string | null;
  }
> => {
  const empty = {
    mediaUrl: null,
    mediaType: null,
    mediaFilename: null,
    content: null,
  };
  const instanceToken = resolveInstanceToken(args.channel);
  if (!instanceToken) {
    return { ...empty, error: "uaz_instance_token não configurado." };
  }

  let request: { endpoint: string; body: Record<string, unknown> };
  try {
    request = buildUazDownloadMessageRequest({
      messageId: args.messageId,
      mediaType: args.mediaType,
    });
  } catch (error) {
    return {
      ...empty,
      error: error instanceof Error
        ? error.message
        : "Payload inválido para download de mídia UAZAPI.",
    };
  }

  const endpoint = `${
    buildUazBaseUrl(args.channel.uaz_subdomain)
  }${request.endpoint}`;
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
      error: parseUazHttpError(
        "uaz_media_download_failed",
        response.status,
        responseText,
      ),
    };
  }

  return {
    ...parseUazDownloadedMedia(responseBody),
    content: parseUazDownloadedContent(responseBody),
    error: null,
  };
};

const recoverUazMediaForMessage = async (args: {
  supabase: ReturnType<typeof createServiceClient>;
  channel: Record<string, unknown>;
  storeId: string;
  conversationId: string;
  leadId: string;
  messageRowId: string;
  providerMessageId: string;
  mediaType: string | null;
  mediaFilename: string | null;
}): Promise<void> => {
  let mediaDownloadError: string | null = null;
  const downloaded = await downloadUazMedia({
    channel: args.channel,
    messageId: args.providerMessageId,
    mediaType: args.mediaType,
  });

  const patch: Record<string, unknown> = {};
  if (downloaded.content) {
    patch.content = downloaded.content;
  }

  if (downloaded.mediaUrl) {
    try {
      const persisted = await persistProviderMediaToCrmStorage({
        supabase: args.supabase,
        storeId: args.storeId,
        conversationId: args.conversationId,
        messageId: args.providerMessageId,
        mediaUrl: downloaded.mediaUrl,
        mediaType: downloaded.mediaType || args.mediaType,
        mediaFilename: downloaded.mediaFilename || args.mediaFilename,
      });
      patch.media_url = persisted.mediaUrl;
      patch.media_type = persisted.mediaType || downloaded.mediaType ||
        args.mediaType;
    } catch (error) {
      mediaDownloadError = [
        error instanceof Error ? error.message : "crm_media_persist_failed",
        "media_storage_pending",
      ].filter(Boolean).join(";");
    }
  } else {
    mediaDownloadError = downloaded.error;
  }

  if (Object.keys(patch).length > 0) {
    await args.supabase
      .from("crm_messages")
      .update(patch)
      .eq("id", args.messageRowId);
  }

  await logCRMEvent({
    supabase: args.supabase,
    storeId: args.storeId,
    eventType: "crm_uaz_media_recovered",
    payload: {
      message_id: args.messageRowId,
      provider_message_id: args.providerMessageId,
      media_url: patch.media_url || null,
      media_type: patch.media_type || args.mediaType,
      media_download_error: mediaDownloadError,
      content_recovered: Boolean(downloaded.content),
    },
    channelId: String(args.channel.id),
    leadId: args.leadId,
    conversationId: args.conversationId,
  });
};

// True when an inbound admin-console message carries a WhatsApp voice note /
// audio (no usable text). Admins may also operate the finance agent by voice.
export const isAdminAudioMessage = (mediaType: string | null): boolean => {
  const normalized = (sanitizeText(mediaType) || "").toLowerCase();
  if (!normalized) return false;
  return (
    ["ptt", "audio", "myaudio", "audiomessage", "audio_message"].includes(
      normalized,
    ) || normalized.includes("audio/")
  );
};

// Transcribes an admin voice note with Groq Whisper turbo so the finance agent
// can read it like text. Fetches the decrypted media URL from uazapi first,
// then hands it to the shared Groq transcription helper (whisper-large-v3-turbo).
// Returns "" on any failure so the caller can fall back gracefully.
const transcribeAdminAudio = async (args: {
  channel: Record<string, unknown>;
  providerMessageId: string;
  mediaType: string | null;
}): Promise<{ text: string; error: string | null }> => {
  const downloaded = await downloadUazMedia({
    channel: args.channel,
    messageId: args.providerMessageId,
    mediaType: args.mediaType,
  });
  if (!downloaded.mediaUrl) {
    return { text: "", error: downloaded.error || "media_url_unavailable" };
  }
  const result = await transcribeAudioForAi({
    mediaUrl: downloaded.mediaUrl,
    mediaType: downloaded.mediaType || args.mediaType,
  });
  return { text: sanitizeText(result.text) || "", error: result.error };
};

// Internal admin-console channels route inbound to the finance agent instead
// of the customer AI pipeline (Bia). Fire-and-forget: the agent replies via
// crm-send-message on its own.
const dispatchAdminAgentInbound = async (args: {
  storeId: string;
  channelId: string;
  conversationId: string;
  leadId: string;
  senderPhone: string;
  messageContent: string;
  providerMessageId: string;
}): Promise<void> => {
  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/crm-admin-agent`;
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify(args),
    });
  } catch (error) {
    console.warn(
      "[crm-uaz-webhook-receiver] admin agent dispatch failed:",
      error,
    );
  }
};

export const handler = async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (error: any) {
    return jsonResponse({
      error: error?.message || "Failed to initialize Supabase.",
    }, 500);
  }

  const body = await parseJsonBody<UazWebhookBody>(req);
  if (!body) return jsonResponse({ error: "Invalid JSON body." }, 400);

  const payloadProvider = sanitizeText(body.provider);
  if (payloadProvider && payloadProvider.toLowerCase() !== "uazapi") {
    return jsonResponse({
      error: "provider legado não suportado. Permitido: uazapi.",
    }, 422);
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
  const queryWebhookSecret = sanitizeText(
    url.searchParams.get("webhook_secret"),
  );

  let channel: Record<string, unknown> | null = null;

  if (channelId) {
    const { data, error } = await supabase
      .from("crm_channels")
      .select(
        "id, store_id, provider, is_active, webhook_secret, api_endpoint, uaz_subdomain, uaz_instance_name, uaz_instance_token, api_key, is_admin_console",
      )
      .eq("id", channelId)
      .maybeSingle();
    if (error) return jsonResponse({ error: error.message }, 500);
    channel = (data as Record<string, unknown> | null) || null;
  }

  if (!channel && instanceName) {
    const { data, error } = await supabase
      .from("crm_channels")
      .select(
        "id, store_id, provider, is_active, webhook_secret, api_endpoint, uaz_subdomain, uaz_instance_name, uaz_instance_token, api_key, is_admin_console",
      )
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
      .select(
        "id, store_id, provider, is_active, webhook_secret, api_endpoint, uaz_subdomain, uaz_instance_name, uaz_instance_token, api_key, is_admin_console",
      )
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
      .select(
        "id, store_id, provider, is_active, webhook_secret, api_endpoint, uaz_subdomain, uaz_instance_name, uaz_instance_token, api_key, is_admin_console",
      )
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
      .select(
        "id, store_id, provider, is_active, webhook_secret, api_endpoint, uaz_subdomain, uaz_instance_name, uaz_instance_token, api_key, is_admin_console",
      )
      .eq("store_id", storeIdFromPayload)
      .eq("provider", "uazapi")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (error) return jsonResponse({ error: error.message }, 500);
    channel = (data as Record<string, unknown> | null) || null;
  }

  if (!channel) {
    return jsonResponse({
      error:
        "Canal UAZAPI não encontrado. Informe channel_id, store_id, instanceName ou token válido.",
    }, 404);
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
  if (
    !isUazWebhookAuthMatch({
      expectedSecret,
      receivedSecret,
      instanceToken: resolveInstanceToken(channel),
      payloadToken,
    })
  ) {
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

    return jsonResponse({
      success: true,
      handled: "connection",
      status: connectionStatus,
    });
  }

  if (isUazMessageUpdateEvent(event)) {
    const providerMessageId = extractInboundMessageId(body) ||
      parseUazProviderMessageId(body);
    if (!providerMessageId) {
      return jsonResponse({
        success: true,
        ignored: true,
        reason: "provider_message_id_not_found",
      }, 202);
    }

    const { data: message, error: messageError } = await supabase
      .from("crm_messages")
      .select(
        "id, store_id, conversation_id, status, delivered_at, read_at, content",
      )
      .eq("channel_id", String(channel.id))
      .eq("provider_message_id", providerMessageId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (messageError) return jsonResponse({ error: messageError.message }, 500);
    if (!message) {
      return jsonResponse({
        success: true,
        ignored: true,
        reason: "message_not_found",
      }, 202);
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

    return jsonResponse({
      success: true,
      handled: "messages_update",
      operation,
      status: nextStatus,
    });
  }

  if (isUazApiEcho(body)) {
    return jsonResponse({
      success: true,
      ignored: true,
      reason: "echo_from_api",
    }, 202);
  }

  if (!isMessageEvent(event, body)) {
    return jsonResponse({
      success: true,
      ignored: true,
      reason: `event_not_handled:${event || "unknown"}`,
    }, 202);
  }

  const fromMe = isUazFromMe(body);
  const phone = extractInboundPhone(body);
  const groupInfo = extractUazGroupInfo(body);

  // Block WhatsApp group chats (@g.us) entirely. The CRM is 1:1 — customer
  // service and the admin finance console — and neither AI pipeline should read
  // or reply inside a group. Group inbound was landing on the admin console,
  // failing sender authorization, and looping on failed replies (uazapi 502).
  // Skip here, before any lead/conversation/message is created or any AI is
  // dispatched.
  if (groupInfo.isGroup) {
    await logCRMEvent({
      supabase,
      storeId,
      eventType: "crm_uaz_group_ignored",
      payload: {
        channel_id: channel.id,
        group_jid: groupInfo.groupJid,
        is_admin_console: Boolean(channel.is_admin_console),
        event,
        from_me: fromMe,
      },
      channelId: String(channel.id),
    });
    return jsonResponse({
      success: true,
      ignored: true,
      reason: "group_message_ignored",
    }, 202);
  }

  const leadPhone = groupInfo.isGroup && groupInfo.groupJid
    ? groupInfo.groupJid
    : phone;
  if (!leadPhone) {
    return jsonResponse({
      success: true,
      ignored: true,
      reason: "phone_not_found",
    }, 202);
  }

  const media = extractUazMedia(body);
  const reply = extractUazReply(body);
  const reaction = extractUazReaction(body);
  const isReaction = Boolean(reaction.emoji || reaction.targetMessageId);
  const isUndecryptable = isUazUndecryptableMessage(body);
  let messageContent = extractInboundText(body) ||
    formatReactionContent(reaction.emoji, fromMe);
  const providerMessageId = extractInboundMessageId(body) ||
    randomProviderMessageId(fromMe ? "uaz_out" : "uaz_in");
  const shouldRecoverMedia = isUazDownloadableMedia(media, isUndecryptable) &&
    providerMessageId &&
    !isReaction;
  const resolvedMedia = {
    mediaUrl: null,
    mediaType: media.mediaType,
    mediaFilename: media.mediaFilename,
  };
  if (!messageContent && isUndecryptable) {
    messageContent =
      "Mensagem não descriptografada pela UAZAPI. Abra o WhatsApp no celular vinculado para visualizá-la.";
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

  const { data: leadId, error: upsertLeadError } = await supabase.rpc(
    "upsert_crm_lead",
    {
      p_store_id: storeId,
      p_phone: leadPhone,
      p_name: groupInfo.isGroup
        ? groupInfo.name
        : resolveLeadName(body, fromMe),
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
    },
  );

  if (upsertLeadError) {
    return jsonResponse({ error: upsertLeadError.message }, 500);
  }

  const resolvedLeadId = String(leadId || "").trim();
  if (!resolvedLeadId) {
    return jsonResponse(
      { error: "Falha ao resolver lead para o webhook UAZ." },
      500,
    );
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

  if (!groupInfo.isGroup && talkId) {
    try {
      await enqueueUazAvatarJob({
        supabase,
        storeId,
        leadId: resolvedLeadId,
        channelId: String(channel.id),
        conversationId: String(conversation.id),
        talkId,
      });
    } catch (error) {
      console.error(
        "[crm-uaz-webhook-receiver] avatar enqueue failed:",
        error instanceof Error ? error.message : String(error),
      );
    }
    EdgeRuntime.waitUntil(drainUazAvatarJobs({ supabase, limit: 3 }).catch((error) => {
      console.error(
        "[crm-uaz-webhook-receiver] avatar drain failed:",
        error instanceof Error ? error.message : String(error),
      );
    }));
  }

  const safeStoredMediaUrl = resolvedMedia.mediaUrl;

  const insertPayload = {
    conversation_id: conversation.id,
    lead_id: resolvedLeadId,
    store_id: channel.store_id,
    channel_id: channel.id,
    direction: fromMe ? "outbound" : "inbound",
    sender_type: fromMe ? "human" : "customer",
    content: messageContent,
    media_url: safeStoredMediaUrl,
    media_type: resolvedMedia.mediaType,
    external_id: providerMessageId,
    provider_message_id: providerMessageId,
    reply_to_provider_message_id: reply.targetMessageId,
    reply_preview_text: reply.previewText,
    reaction_target_provider_message_id: reaction.targetMessageId,
    reaction_emoji: reaction.emoji,
    status: "sent",
    sent_at: sentAt,
    webhook_payload: shouldRecoverMedia
      ? { ...body, media_storage_pending: true }
      : body,
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
          media_downloaded: Boolean(
            safeStoredMediaUrl && safeStoredMediaUrl !== media.mediaUrl,
          ),
          media_download_error: null,
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

  if (shouldRecoverMedia) {
    EdgeRuntime.waitUntil(recoverUazMediaForMessage({
      supabase,
      channel,
      storeId,
      conversationId: String(conversation.id),
      leadId: resolvedLeadId,
      messageRowId: String(insertedMessage.id),
      providerMessageId,
      mediaType: resolvedMedia.mediaType,
      mediaFilename: resolvedMedia.mediaFilename,
    }).catch((error) => {
      console.error(
        "[crm-uaz-webhook-receiver] media recovery failed:",
        error instanceof Error ? error.message : String(error),
      );
    }));
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
    // Rich creative snapshot (title/body/image/source_url + parsed product hint) so the
    // AI agent can recognize the campaign image and greet about the exact device clicked.
    const adContext = extractAdContext(body);
    if (adSource || adContext) {
      await supabase
        .from("crm_leads")
        .update({
          source: adSource?.source ?? adContext?.source ?? null,
          source_campaign_id: adSource?.sourceId ?? adContext?.campaign_id ?? null,
          source_campaign_title: adSource?.sourceCampaignTitle ??
            adContext?.campaign_title ?? null,
          source_ad_context: adContext,
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
      media_url: safeStoredMediaUrl,
      media_type: resolvedMedia.mediaType,
      media_downloaded: Boolean(
        safeStoredMediaUrl && safeStoredMediaUrl !== media.mediaUrl,
      ),
      media_download_error: null,
      event_origin: isReaction ? "reaction" : "direct",
      from_me: fromMe,
    },
    channelId: String(channel.id),
    leadId: resolvedLeadId,
    conversationId: String(conversation.id),
  });

  if (!fromMe && !isReaction && channel.is_admin_console) {
    // The admin console is always AI-driven: mark the conversation ai_handling so
    // the agent's reply (crm-send-message senderType "ai_inbound") passes its
    // "human_assumed" guard, which requires status=ai_handling & ai_enabled.
    await supabase
      .from("crm_conversations")
      .update({
        status: "ai_handling",
        ai_enabled: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", String(conversation.id));

    // Admins can talk to the finance agent by voice: transcribe the audio
    // (Groq Whisper turbo) and feed the text to the agent. Persist the
    // transcript on the message row so both the CRM inbox and the agent's
    // conversation history reflect what was said.
    let adminMessageContent = messageContent || "";
    if (!adminMessageContent && isAdminAudioMessage(resolvedMedia.mediaType)) {
      const transcription = await transcribeAdminAudio({
        channel,
        providerMessageId,
        mediaType: resolvedMedia.mediaType,
      });
      if (transcription.text) {
        adminMessageContent = transcription.text;
        await supabase
          .from("crm_messages")
          .update({ content: adminMessageContent })
          .eq("id", String(insertedMessage.id));
      }
      await logCRMEvent({
        supabase,
        storeId,
        eventType: "crm_admin_agent_audio_transcribed",
        payload: {
          provider_message_id: providerMessageId,
          media_type: resolvedMedia.mediaType,
          transcribed: Boolean(transcription.text),
          chars: transcription.text.length,
          error: transcription.error,
        },
        channelId: String(channel.id),
        leadId: resolvedLeadId,
        conversationId: String(conversation.id),
      });
      if (!adminMessageContent) {
        // Graceful degradation: still reply so the admin knows the audio
        // arrived but could not be understood.
        adminMessageContent =
          "(Enviei um áudio, mas não foi possível entendê-lo. Peça para eu repetir ou escrever a mensagem.)";
      }
    }

    await dispatchAdminAgentInbound({
      storeId,
      channelId: String(channel.id),
      conversationId: String(conversation.id),
      leadId: resolvedLeadId,
      senderPhone: leadPhone,
      messageContent: adminMessageContent,
      providerMessageId,
    });
  } else if (!fromMe && !isReaction) {
    const routingDecision = await resolveAiRoutingDecision({
      supabase,
      storeId,
      channelId: String(channel.id),
      conversationId: String(conversation.id),
      leadId: resolvedLeadId,
    });

    if (routingDecision.reason !== "existing_ai_handling") {
      await applyAiRoutingDecision({
        storeId,
        supabase,
        decision: routingDecision,
        conversationId: String(conversation.id),
        leadId: resolvedLeadId,
        channelId: String(channel.id),
      });
    }

    if (routingDecision.target === "ai") {
      await dispatchAiInboundIfEligible({
        supabase,
        conversationId: String(conversation.id),
        storeId,
        channelId: String(channel.id),
        leadId: resolvedLeadId,
        messageId: String(insertedMessage.id),
        content: messageContent || "",
        mediaUrl: safeStoredMediaUrl,
        mediaType: resolvedMedia.mediaType,
        rawInbound: body,
        chatid: talkId || leadPhone,
        phone: leadPhone,
        providerMessageId,
        messageAt: sentAt,
        isFromMe: false,
        senderType: "customer",
        eventOrigin: "direct",
        replyToProviderMessageId: reply.targetMessageId,
        replyPreviewText: reply.previewText,
      });
    }
  }

  if (!fromMe && !channel.is_admin_console) {
    const displayName = groupInfo.name || resolveLeadName(body, fromMe) ||
      leadPhone;
    const messagePreview = compactNotificationText(
      messageContent,
      resolvedMedia.mediaType
        ? "Nova mídia recebida."
        : "Nova mensagem recebida.",
    );
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
        body: compactNotificationText(
          `${displayName}: ${messagePreview}`,
          "Novo lead recebido.",
        ),
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
