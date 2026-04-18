/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  createServiceClient,
  jsonResponse,
  logCRMEvent,
  parseJsonBody,
  requireAuthenticatedRole,
  resolveProvider,
  sanitizeText,
} from "../_shared/crm.ts";
import {
  buildUazBaseUrl,
  buildUazMessageActionRequest,
  parseUazHttpError,
  resolveInstanceToken,
  toUazNumber,
} from "../_shared/uazapi.ts";

type ActionBody = {
  action?: string;
  channelId?: string;
  conversationId?: string;
  messageId?: string;
  payload?: Record<string, unknown>;
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

  const body = await parseJsonBody<ActionBody>(req);
  if (!body) return jsonResponse({ error: "Invalid JSON body." }, 400);

  const action = sanitizeText(body.action);
  const conversationId = sanitizeText(body.conversationId);
  if (!action) return jsonResponse({ error: "action é obrigatório." }, 400);

  const payload = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
    ? body.payload
    : {};

  let resolvedChannelId = sanitizeText(body.channelId);
  let resolvedStoreId: string | null = null;
  let resolvedLeadId: string | null = null;
  let fallbackNumber: string | null = toUazNumber(payload.number);

  if ((!resolvedChannelId || !fallbackNumber) && conversationId) {
    const { data: conversation, error: conversationError } = await supabase
      .from("crm_conversations")
      .select("id, channel_id, store_id, lead_id")
      .eq("id", conversationId)
      .maybeSingle();

    if (conversationError) return jsonResponse({ error: conversationError.message }, 500);
    if (!conversation) return jsonResponse({ error: "Conversa não encontrada." }, 404);

    resolvedChannelId = resolvedChannelId || sanitizeText(conversation.channel_id);
    resolvedStoreId = sanitizeText(conversation.store_id);
    resolvedLeadId = sanitizeText(conversation.lead_id);

    if (!fallbackNumber && resolvedLeadId) {
      const { data: lead, error: leadError } = await supabase
        .from("crm_leads")
        .select("phone")
        .eq("id", resolvedLeadId)
        .maybeSingle();
      if (leadError) return jsonResponse({ error: leadError.message }, 500);
      fallbackNumber = toUazNumber(lead?.phone);
    }
  }

  if (!resolvedChannelId) {
    return jsonResponse({ error: "channelId ou conversationId é obrigatório." }, 400);
  }

  const { data: channel, error: channelError } = await supabase
    .from("crm_channels")
    .select(
      "id, store_id, provider, is_active, uaz_subdomain, uaz_instance_token, api_key",
    )
    .eq("id", resolvedChannelId)
    .maybeSingle();

  if (channelError) return jsonResponse({ error: channelError.message }, 500);
  if (!channel) return jsonResponse({ error: "Canal não encontrado." }, 404);

  if (resolveProvider(channel.provider) !== "uazapi") {
    return jsonResponse({ error: "Ação disponível apenas para canal UAZAPI." }, 422);
  }
  if (!Boolean(channel.is_active)) {
    return jsonResponse({ error: "Canal inativo." }, 409);
  }

  const instanceToken = resolveInstanceToken(channel as Record<string, unknown>);
  if (!instanceToken) {
    return jsonResponse({ error: "uaz_instance_token não configurado no canal." }, 422);
  }

  let actionRequest: { endpoint: string; body: Record<string, unknown> };
  try {
    actionRequest = buildUazMessageActionRequest({
      action,
      messageId: sanitizeText(body.messageId),
      payload,
      fallbackNumber,
    });
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Payload inválido para ação UAZAPI." }, 422);
  }

  const endpoint = `${buildUazBaseUrl((channel as Record<string, unknown>).uaz_subdomain)}${actionRequest.endpoint}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      token: instanceToken,
    },
    body: JSON.stringify(actionRequest.body),
  });

  const responseText = await response.text();
  let responseBody: unknown = responseText;
  try {
    responseBody = responseText ? JSON.parse(responseText) : {};
  } catch {
    responseBody = responseText;
  }

  if (!response.ok) {
    return jsonResponse({ error: parseUazHttpError("uaz_action_failed", response.status, responseText) }, 502);
  }

  resolvedStoreId = resolvedStoreId || sanitizeText(channel.store_id);
  if (resolvedStoreId) {
    await logCRMEvent({
      supabase,
      storeId: resolvedStoreId,
      eventType: "crm_uaz_message_action",
      payload: {
        action,
        channel_id: resolvedChannelId,
        conversation_id: conversationId,
        message_id: sanitizeText(body.messageId),
        endpoint: actionRequest.endpoint,
        request_payload: actionRequest.body,
        response_status: response.status,
      },
      channelId: resolvedChannelId,
      leadId: resolvedLeadId,
      conversationId,
    });
  }

  return jsonResponse({
    success: true,
    action,
    channelId: resolvedChannelId,
    conversationId,
    dispatch: {
      queued: false,
      status: response.status,
      endpoint: actionRequest.endpoint,
      response: responseBody,
    },
  });
});
