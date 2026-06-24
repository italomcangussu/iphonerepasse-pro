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
  buildUazSendMessageRequest,
  parseUazHttpError,
  parseUazProviderMessageId,
  resolveInstanceToken,
} from "../_shared/uazapi.ts";

type SendMessageBody = {
  conversationId?: string;
  channelId?: string;
  leadId?: string;
  provider?: string;
  content?: string;
  mediaUrl?: string;
  mediaType?: string;
  mediaFilename?: string;
  voiceNote?: boolean;
  replyToProviderMessageId?: string;
  replyPreviewText?: string;
  senderType?: "human" | "ai" | "ai_inbound";
};

const extractBearerToken = (req: Request): string => {
  const authorization = String(req.headers.get("authorization") || "").trim();
  if (!authorization.toLowerCase().startsWith("bearer ")) return "";
  return authorization.slice(7).trim();
};

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const payload = token.split(".")[1];
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const isServiceRoleJwtForProject = (token: string): boolean => {
  const payload = decodeJwtPayload(token);
  if (payload?.role !== "service_role") return false;

  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").trim();
  const projectRef = supabaseUrl
    ? new URL(supabaseUrl).hostname.split(".")[0]
    : "";
  return !projectRef || payload.ref === projectRef;
};

const resolveSenderDisplayName = async (
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<string | null> => {
  const { data: accessRole } = await supabase
    .from("user_access_roles")
    .select("display_name, email")
    .eq("user_id", userId)
    .maybeSingle();

  const displayName = sanitizeText(accessRole?.display_name);
  if (displayName) return displayName;

  const emailPrefix = sanitizeText(
    String(accessRole?.email || "").split("@")[0],
  );
  if (emailPrefix) return emailPrefix;

  const { data: seller } = await supabase
    .from("sellers")
    .select("name, email")
    .eq("auth_user_id", userId)
    .maybeSingle();

  return sanitizeText(seller?.name) ||
    sanitizeText(String(seller?.email || "").split("@")[0]);
};

const dispatchMessage = async (args: {
  provider: "uazapi" | "instagram_official";
  channel: Record<string, unknown>;
  lead: Record<string, unknown>;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  mediaFilename: string | null;
  voiceNote: boolean;
  replyToProviderMessageId: string | null;
}) => {
  const {
    provider,
    channel,
    lead,
    content,
    mediaUrl,
    mediaType,
    mediaFilename,
    voiceNote,
    replyToProviderMessageId,
  } = args;
  if (provider === "uazapi") {
    const instanceToken = resolveInstanceToken(channel);
    if (!instanceToken) {
      throw new Error("uaz_instance_token não configurado.");
    }

    const baseUrl = buildUazBaseUrl(channel.uaz_subdomain);
    const request = buildUazSendMessageRequest({
      number: String(lead.phone || ""),
      content,
      mediaUrl,
      mediaType,
      mediaFilename,
      voiceNote,
      replyToProviderMessageId,
    });
    const endpoint = `${baseUrl}${request.endpoint}`;

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
      throw new Error(
        parseUazHttpError("uaz_send_failed", response.status, responseText),
      );
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
  if (!apiEndpoint) {
    return { queued: true, provider, reason: "missing_api_endpoint" };
  }

  const payload = {
    to: String(lead.phone || ""),
    message: content,
    media_url: mediaUrl,
    media_type: mediaType,
    provider,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers["x-api-key"] = apiKey;
  }

  const endpoint = `${apiEndpoint.replace(/\/$/, "")}/messages`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `provider_dispatch_failed:${response.status}:${text.slice(0, 240)}`,
    );
  }

  return { queued: false, provider, result: await response.text() };
};

Deno.serve(async (req: Request) => {
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

  const body = await parseJsonBody<SendMessageBody>(req);
  if (!body) return jsonResponse({ error: "Invalid JSON body." }, 400);

  const requestedSenderType = body.senderType || "human";
  if (!["human", "ai", "ai_inbound"].includes(requestedSenderType)) {
    return jsonResponse({ error: "senderType inválido." }, 422);
  }

  const bearerToken = extractBearerToken(req);
  const isServiceRoleRequest = Boolean(
    requestedSenderType === "ai_inbound" &&
      bearerToken &&
      (bearerToken === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
        isServiceRoleJwtForProject(bearerToken)),
  );

  let auth: { userId: string; role: "admin" | "seller" };
  if (isServiceRoleRequest) {
    auth = { userId: "00000000-0000-0000-0000-000000000000", role: "admin" };
  } else {
    try {
      auth = await requireAuthenticatedRole(req, supabase);
    } catch (error: any) {
      return jsonResponse({ error: error?.message || "Unauthorized." }, 401);
    }
  }

  const content = sanitizeText(body.content);
  const mediaUrl = sanitizeText(body.mediaUrl);
  const mediaType = sanitizeText(body.mediaType);
  const mediaFilename = sanitizeText(body.mediaFilename);
  const voiceNote = body.voiceNote === true;
  const replyToProviderMessageId = sanitizeText(body.replyToProviderMessageId);
  const replyPreviewText = sanitizeText(body.replyPreviewText);

  if (!content && !mediaUrl) {
    return jsonResponse({ error: "Informe content ou mediaUrl." }, 400);
  }

  const explicitProvider = body.provider
    ? resolveProvider(body.provider)
    : null;
  if (body.provider && !explicitProvider) {
    return jsonResponse({
      error: "provider inválido. Permitidos: uazapi, instagram_official.",
    }, 422);
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
      .select("id, store_id, lead_id, channel_id, status, ai_enabled")
      .eq("id", conversationId)
      .maybeSingle();

    if (error) return jsonResponse({ error: error.message }, 500);
    if (!data) return jsonResponse({ error: "Conversa não encontrada." }, 404);
    conversation = data as Record<string, unknown>;
  }

  const resolvedLeadId = leadId ||
    (conversation ? String(conversation.lead_id || "") : "");
  if (!resolvedLeadId) {
    return jsonResponse(
      { error: "leadId ou conversationId é obrigatório." },
      400,
    );
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

  const resolvedChannelId = channelId ||
    (conversation ? String(conversation.channel_id || "") : "") ||
    String(lead.source_channel_id || "");

  if (!resolvedChannelId) {
    return jsonResponse({
      error: "channelId é obrigatório quando a conversa não possui canal.",
    }, 400);
  }

  {
    const { data, error } = await supabase
      .from("crm_channels")
      .select(
        "id, store_id, provider, is_active, api_endpoint, api_key, uaz_subdomain, uaz_instance_token",
      )
      .eq("id", resolvedChannelId)
      .maybeSingle();

    if (error) return jsonResponse({ error: error.message }, 500);
    if (!data) return jsonResponse({ error: "Canal não encontrado." }, 404);
    channel = data as Record<string, unknown>;
  }

  const channelProvider = resolveProvider(channel.provider);
  if (!channelProvider) {
    return jsonResponse({
      error:
        "Canal com provider legado não suportado. Permitidos: uazapi, instagram_official.",
    }, 422);
  }

  if (explicitProvider && explicitProvider !== channelProvider) {
    return jsonResponse({
      error: "provider informado difere do provider configurado no canal.",
    }, 422);
  }

  if (!Boolean(channel.is_active)) {
    return jsonResponse({ error: "Canal inativo." }, 409);
  }

  if (!conversation) {
    const leadStoreId = String(lead.store_id || "");
    const { data: existingConversation, error: existingConversationError } =
      await supabase
        .from("crm_conversations")
        .select("id, store_id, lead_id, channel_id")
        .eq("store_id", leadStoreId)
        .eq("lead_id", resolvedLeadId)
        .maybeSingle();

    if (existingConversationError) {
      return jsonResponse({ error: existingConversationError.message }, 500);
    }

    if (existingConversation) {
      conversation = existingConversation as Record<string, unknown>;
    } else {
      const { data: createdConversation, error: createConversationError } =
        await supabase
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

      if (createConversationError) {
        return jsonResponse({ error: createConversationError.message }, 500);
      }
      conversation = createdConversation as Record<string, unknown>;
    }
  }

  if (requestedSenderType === "ai_inbound") {
    if (!conversationId) {
      return jsonResponse({
        error: {
          code: "ai_inbound_requires_conversation",
          message: "AI inbound requires conversationId.",
        },
      }, 400);
    }
    if (!isServiceRoleRequest) {
      return jsonResponse(
        { error: "AI inbound sender requires service role." },
        401,
      );
    }
    const { data: guardedConversation, error: guardError } = await supabase
      .from("crm_conversations")
      .select("id")
      .eq("id", conversation.id)
      .eq("status", "ai_handling")
      .eq("ai_enabled", true)
      .maybeSingle();
    if (guardError) return jsonResponse({ error: guardError.message }, 500);
    if (!guardedConversation) {
      return jsonResponse({
        error: {
          code: "human_assumed_during_ai_response",
          message: "Atendimento humano assumiu antes da resposta da IA.",
        },
      }, 409);
    }
  }

  await supabase.rpc("crm_apply_channel_to_conversation", {
    p_conversation_id: conversation.id,
    p_channel_id: resolvedChannelId,
    p_changed_by: null,
    p_reason: "crm_send_message",
  });

  const providerMessageId = randomProviderMessageId(
    channelProvider === "uazapi" ? "uaz" : "ig",
  );
  const senderDisplayName = requestedSenderType === "ai_inbound"
    ? "IA Core Engine"
    : await resolveSenderDisplayName(supabase, auth.userId);

  const { data: insertedMessage, error: insertError } = await supabase
    .from("crm_messages")
    .insert({
      conversation_id: conversation.id,
      lead_id: resolvedLeadId,
      store_id: lead.store_id,
      channel_id: resolvedChannelId,
      direction: "outbound",
      sender_type: requestedSenderType,
      content,
      media_url: mediaUrl,
      media_type: mediaType,
      provider_message_id: providerMessageId,
      sender_user_id: requestedSenderType === "ai_inbound" ? null : auth.userId,
      sender_display_name: senderDisplayName,
      reply_to_provider_message_id: replyToProviderMessageId,
      reply_preview_text: replyPreviewText,
      status: "sent",
      sent_at: new Date().toISOString(),
      webhook_payload: {
        source: "crm-send-message",
        sent_by_user_id: requestedSenderType === "ai_inbound"
          ? null
          : auth.userId,
        sender_type: requestedSenderType,
        ...(senderDisplayName
          ? { sent_by_display_name: senderDisplayName }
          : {}),
        ...(mediaFilename ? { media_filename: mediaFilename } : {}),
        ...(voiceNote ? { voice_note: true } : {}),
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
      mediaFilename,
      voiceNote,
      replyToProviderMessageId,
    }) as Record<string, unknown>;
  } catch (error: any) {
    await supabase
      .from("crm_messages")
      .update({
        status: "failed",
        error_message: error?.message || "provider_dispatch_failed",
      })
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

  const resolvedProviderMessageId =
    sanitizeText(dispatchResult.providerMessageId) || providerMessageId;
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
