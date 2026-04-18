/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  createServiceClient,
  jsonResponse,
  logCRMEvent,
  parseJsonBody,
  randomProviderMessageId,
  requireAuthenticatedRole,
  resolveProvider,
  sanitizeText,
} from "../_shared/crm.ts";
import {
  buildUazBaseUrl,
  parseUazHttpError,
  parseUazProviderMessageId,
  resolveInstanceToken,
  toUazNumber,
} from "../_shared/uazapi.ts";

type SendMessageBody = {
  conversationId?: string;
  channelId?: string;
  leadId?: string;
  provider?: string;
  content?: string;
  mediaUrl?: string;
  mediaType?: string;
};

const dispatchMessage = async (args: {
  provider: "uazapi" | "instagram_official";
  channel: Record<string, unknown>;
  lead: Record<string, unknown>;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
}) => {
  const { provider, channel, lead, content, mediaUrl, mediaType } = args;
  if (provider === "uazapi") {
    const instanceToken = resolveInstanceToken(channel);
    if (!instanceToken) {
      throw new Error("uaz_instance_token não configurado.");
    }

    const number = toUazNumber(lead.phone);
    if (!number) {
      throw new Error("Número do lead inválido para envio UAZAPI.");
    }

    const baseUrl = buildUazBaseUrl(channel.uaz_subdomain);
    const isMedia = Boolean(mediaUrl);
    const endpoint = isMedia ? `${baseUrl}/send/media` : `${baseUrl}/send/text`;

    const normalizedMediaType = String(mediaType || "").trim().toLowerCase();
    const mediaTypeByMime = normalizedMediaType.includes("video")
      ? "video"
      : normalizedMediaType.includes("audio")
      ? "audio"
      : normalizedMediaType.includes("document") || normalizedMediaType.includes("pdf")
      ? "document"
      : "image";

    const payload = isMedia
      ? {
        number,
        type: mediaTypeByMime,
        file: String(mediaUrl),
        ...(content ? { text: content } : {}),
      }
      : {
        number,
        text: String(content || ""),
      };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token: instanceToken,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let responseBody: unknown = responseText;
    try {
      responseBody = responseText ? JSON.parse(responseText) : {};
    } catch {
      responseBody = responseText;
    }

    if (!response.ok) {
      throw new Error(parseUazHttpError("uaz_send_failed", response.status, responseText));
    }

    const providerMessageId = parseUazProviderMessageId(responseBody);
    return {
      queued: false,
      provider,
      endpoint,
      status: response.status,
      result: responseBody,
      providerMessageId,
    };
  }

  const apiEndpoint = String(channel.api_endpoint || "").trim();
  const apiKey = String(channel.api_key || "").trim();
  if (!apiEndpoint) return { queued: true, provider, reason: "missing_api_endpoint" };

  const payload = {
    to: String(lead.phone || ""),
    message: content,
    media_url: mediaUrl,
    media_type: mediaType,
    provider,
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers["x-api-key"] = apiKey;
  }

  const endpoint = `${apiEndpoint.replace(/\/$/, "")}/messages`;
  const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(payload) });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`provider_dispatch_failed:${response.status}:${text.slice(0, 240)}`);
  }

  return { queued: false, provider, result: await response.text() };
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

  const body = await parseJsonBody<SendMessageBody>(req);
  if (!body) return jsonResponse({ error: "Invalid JSON body." }, 400);

  const content = sanitizeText(body.content);
  const mediaUrl = sanitizeText(body.mediaUrl);
  const mediaType = sanitizeText(body.mediaType);

  if (!content && !mediaUrl) {
    return jsonResponse({ error: "Informe content ou mediaUrl." }, 400);
  }

  const explicitProvider = body.provider ? resolveProvider(body.provider) : null;
  if (body.provider && !explicitProvider) {
    return jsonResponse({ error: "provider inválido. Permitidos: uazapi, instagram_official." }, 422);
  }

  const conversationId = sanitizeText(body.conversationId);
  const leadId = sanitizeText(body.leadId);
  const channelId = sanitizeText(body.channelId);

  let conversation: Record<string, unknown> | null = null;
  let lead: Record<string, unknown> | null = null;
  let channel: Record<string, unknown> | null = null;

  if (conversationId) {
    const { data, error } = await supabase
      .from("crm_conversations")
      .select("id, store_id, lead_id, channel_id")
      .eq("id", conversationId)
      .maybeSingle();

    if (error) return jsonResponse({ error: error.message }, 500);
    if (!data) return jsonResponse({ error: "Conversa não encontrada." }, 404);
    conversation = data as Record<string, unknown>;
  }

  const resolvedLeadId = leadId || (conversation ? String(conversation.lead_id || "") : "");
  if (!resolvedLeadId) {
    return jsonResponse({ error: "leadId ou conversationId é obrigatório." }, 400);
  }

  {
    const { data, error } = await supabase
      .from("crm_leads")
      .select("id, store_id, phone, source_channel_id")
      .eq("id", resolvedLeadId)
      .maybeSingle();

    if (error) return jsonResponse({ error: error.message }, 500);
    if (!data) return jsonResponse({ error: "Lead não encontrado." }, 404);
    lead = data as Record<string, unknown>;
  }

  const resolvedChannelId = channelId
    || (conversation ? String(conversation.channel_id || "") : "")
    || String(lead.source_channel_id || "");

  if (!resolvedChannelId) {
    return jsonResponse({ error: "channelId é obrigatório quando a conversa não possui canal." }, 400);
  }

  {
    const { data, error } = await supabase
      .from("crm_channels")
      .select("id, store_id, provider, is_active, api_endpoint, api_key, uaz_subdomain, uaz_instance_token")
      .eq("id", resolvedChannelId)
      .maybeSingle();

    if (error) return jsonResponse({ error: error.message }, 500);
    if (!data) return jsonResponse({ error: "Canal não encontrado." }, 404);
    channel = data as Record<string, unknown>;
  }

  const channelProvider = resolveProvider(channel.provider);
  if (!channelProvider) {
    return jsonResponse({ error: "Canal com provider legado não suportado. Permitidos: uazapi, instagram_official." }, 422);
  }

  if (explicitProvider && explicitProvider !== channelProvider) {
    return jsonResponse({ error: "provider informado difere do provider configurado no canal." }, 422);
  }

  if (!Boolean(channel.is_active)) {
    return jsonResponse({ error: "Canal inativo." }, 409);
  }

  if (!conversation) {
    const leadStoreId = String(lead.store_id || "");
    const { data: existingConversation, error: existingConversationError } = await supabase
      .from("crm_conversations")
      .select("id, store_id, lead_id, channel_id")
      .eq("store_id", leadStoreId)
      .eq("lead_id", resolvedLeadId)
      .maybeSingle();

    if (existingConversationError) return jsonResponse({ error: existingConversationError.message }, 500);

    if (existingConversation) {
      conversation = existingConversation as Record<string, unknown>;
    } else {
      const { data: createdConversation, error: createConversationError } = await supabase
        .from("crm_conversations")
        .insert({
          store_id: leadStoreId,
          lead_id: resolvedLeadId,
          channel_id: resolvedChannelId,
          status: "open",
          ai_enabled: true,
        })
        .select("id, store_id, lead_id, channel_id")
        .single();

      if (createConversationError) return jsonResponse({ error: createConversationError.message }, 500);
      conversation = createdConversation as Record<string, unknown>;
    }
  }

  await supabase.rpc("crm_apply_channel_to_conversation", {
    p_conversation_id: conversation.id,
    p_channel_id: resolvedChannelId,
    p_changed_by: null,
    p_reason: "crm_send_message",
  });

  const providerMessageId = randomProviderMessageId(channelProvider === "uazapi" ? "uaz" : "ig");

  const { data: insertedMessage, error: insertError } = await supabase
    .from("crm_messages")
    .insert({
      conversation_id: conversation.id,
      lead_id: resolvedLeadId,
      store_id: lead.store_id,
      channel_id: resolvedChannelId,
      direction: "outbound",
      sender_type: "human",
      content,
      media_url: mediaUrl,
      media_type: mediaType,
      provider_message_id: providerMessageId,
      status: "sent",
      sent_at: new Date().toISOString(),
      webhook_payload: {
        source: "crm-send-message",
      },
    })
    .select("id")
    .single();

  if (insertError) return jsonResponse({ error: insertError.message }, 500);

  let dispatchResult: Record<string, unknown> = { queued: true };
  try {
    dispatchResult = await dispatchMessage({
      provider: channelProvider,
      channel,
      lead,
      content,
      mediaUrl,
      mediaType,
    }) as Record<string, unknown>;
  } catch (error: any) {
    await supabase
      .from("crm_messages")
      .update({ status: "failed", error_message: error?.message || "provider_dispatch_failed" })
      .eq("id", insertedMessage.id);

    await logCRMEvent({
      supabase,
      storeId: String(lead.store_id),
      eventType: "crm_message_send_failed",
      payload: {
        message_id: insertedMessage.id,
        provider: channelProvider,
        error: error?.message || "provider_dispatch_failed",
      },
      channelId: resolvedChannelId,
      leadId: resolvedLeadId,
      conversationId: String(conversation.id),
    });

    return jsonResponse({
      success: false,
      messageId: insertedMessage.id,
      provider: channelProvider,
      error: error?.message || "provider_dispatch_failed",
    }, 502);
  }

  const resolvedProviderMessageId = sanitizeText(dispatchResult.providerMessageId) || providerMessageId;
  if (resolvedProviderMessageId !== providerMessageId) {
    await supabase
      .from("crm_messages")
      .update({ provider_message_id: resolvedProviderMessageId })
      .eq("id", insertedMessage.id);
  }

  await logCRMEvent({
    supabase,
    storeId: String(lead.store_id),
    eventType: "crm_message_sent",
    payload: {
      message_id: insertedMessage.id,
      provider: channelProvider,
      provider_message_id: resolvedProviderMessageId,
      dispatch_result: dispatchResult,
    },
    channelId: resolvedChannelId,
    leadId: resolvedLeadId,
    conversationId: String(conversation.id),
  });

  return jsonResponse({
    success: true,
    messageId: insertedMessage.id,
    provider: channelProvider,
    providerMessageId: resolvedProviderMessageId,
    conversationId: conversation.id,
    leadId: resolvedLeadId,
    dispatch: dispatchResult,
  });
});
