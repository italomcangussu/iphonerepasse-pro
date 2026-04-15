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
  const channelId = sanitizeText(body.channelId);
  const conversationId = sanitizeText(body.conversationId);

  if (!action) return jsonResponse({ error: "action é obrigatório." }, 400);

  let resolvedChannelId = channelId;
  let resolvedStoreId: string | null = null;
  let resolvedLeadId: string | null = null;

  if (!resolvedChannelId && conversationId) {
    const { data: conversation, error: conversationError } = await supabase
      .from("crm_conversations")
      .select("id, channel_id, store_id, lead_id")
      .eq("id", conversationId)
      .maybeSingle();

    if (conversationError) return jsonResponse({ error: conversationError.message }, 500);
    if (!conversation) return jsonResponse({ error: "Conversa não encontrada." }, 404);

    resolvedChannelId = sanitizeText(conversation.channel_id);
    resolvedStoreId = sanitizeText(conversation.store_id);
    resolvedLeadId = sanitizeText(conversation.lead_id);
  }

  if (!resolvedChannelId) {
    return jsonResponse({ error: "channelId ou conversationId é obrigatório." }, 400);
  }

  const { data: channel, error: channelError } = await supabase
    .from("crm_channels")
    .select("id, store_id, provider, is_active, api_endpoint, api_key")
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

  resolvedStoreId = resolvedStoreId || sanitizeText(channel.store_id);

  const apiEndpoint = sanitizeText(channel.api_endpoint);
  const apiKey = sanitizeText(channel.api_key);

  let dispatch: Record<string, unknown> = { queued: true };

  if (apiEndpoint) {
    const endpoint = `${apiEndpoint.replace(/\/$/, "")}/messages/action`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
      headers["x-api-key"] = apiKey;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        action,
        conversation_id: conversationId,
        message_id: body.messageId,
        payload: body.payload || {},
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return jsonResponse({ error: `uaz_action_failed:${response.status}:${text.slice(0, 240)}` }, 502);
    }

    dispatch = {
      queued: false,
      status: response.status,
      response: await response.text(),
    };
  }

  if (resolvedStoreId) {
    await logCRMEvent({
      supabase,
      storeId: resolvedStoreId,
      eventType: "crm_uaz_message_action",
      payload: {
        action,
        channel_id: resolvedChannelId,
        conversation_id: conversationId,
        message_id: body.messageId || null,
        dispatch,
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
    dispatch,
  });
});
