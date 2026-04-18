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
  isEchoFromApi,
} from "../_shared/uazapi.ts";

type UazWebhookBody = Record<string, unknown>;

const pickFirstText = (...values: unknown[]): string | null => {
  for (const value of values) {
    const normalized = sanitizeText(value);
    if (normalized) return normalized;
  }
  return null;
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

  if (isEchoFromApi(body)) {
    return jsonResponse({ success: true, ignored: true, reason: "echo_from_api" }, 202);
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
  const queryWebhookSecret = sanitizeText(url.searchParams.get("webhook_secret"));

  let channel: Record<string, unknown> | null = null;

  if (channelId) {
    const { data, error } = await supabase
      .from("crm_channels")
      .select("id, store_id, provider, is_active, webhook_secret")
      .eq("id", channelId)
      .maybeSingle();
    if (error) return jsonResponse({ error: error.message }, 500);
    channel = (data as Record<string, unknown> | null) || null;
  } else if (storeIdFromPayload) {
    const { data, error } = await supabase
      .from("crm_channels")
      .select("id, store_id, provider, is_active, webhook_secret")
      .eq("store_id", storeIdFromPayload)
      .eq("provider", "uazapi")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (error) return jsonResponse({ error: error.message }, 500);
    channel = (data as Record<string, unknown> | null) || null;
  }

  if (!channel) {
    return jsonResponse({ error: "Canal UAZAPI não encontrado. Informe channel_id ou store_id válido." }, 404);
  }

  if (resolveProvider(channel.provider) !== "uazapi") {
    return jsonResponse({ error: "Canal inválido para webhook UAZAPI." }, 422);
  }
  if (!Boolean(channel.is_active)) {
    return jsonResponse({ error: "Canal inativo." }, 409);
  }

  const expectedSecret = String(channel.webhook_secret || "").trim();
  if (expectedSecret) {
    const headerSecret = getHeaderSecret(req);
    const matched = headerSecret === expectedSecret || queryWebhookSecret === expectedSecret;
    if (!matched) {
      return jsonResponse({ error: "Invalid webhook secret." }, 401);
    }
  }

  const phone = extractInboundPhone(body);
  if (!phone) {
    return jsonResponse({ success: true, ignored: true, reason: "phone_not_found" }, 202);
  }

  const leadName = pickFirstText(
    body.name,
    body.pushName,
    body.contact_name,
    (body.contact && typeof body.contact === "object") ? (body.contact as Record<string, unknown>).name : null,
  );
  const messageContent = extractInboundText(body);
  const providerMessageId = extractInboundMessageId(body) || randomProviderMessageId("uaz_in");

  const { data: leadId, error: upsertLeadError } = await supabase.rpc("upsert_crm_lead", {
    p_store_id: String(channel.store_id),
    p_phone: phone,
    p_name: leadName,
    p_contact_id: null,
    p_entity_id: null,
    p_channel_id: channel.id,
  });

  if (upsertLeadError) return jsonResponse({ error: upsertLeadError.message }, 500);

  const resolvedLeadId = String(leadId || "").trim();
  if (!resolvedLeadId) {
    return jsonResponse({ error: "Falha ao resolver lead para o webhook UAZ." }, 500);
  }

  let conversation: Record<string, unknown> | null = null;
  {
    const { data, error } = await supabase
      .from("crm_conversations")
      .select("id, store_id, lead_id, channel_id")
      .eq("store_id", String(channel.store_id))
      .eq("lead_id", resolvedLeadId)
      .maybeSingle();
    if (error) return jsonResponse({ error: error.message }, 500);
    conversation = (data as Record<string, unknown> | null) || null;
  }

  if (!conversation) {
    const { data, error } = await supabase
      .from("crm_conversations")
      .insert({
        store_id: channel.store_id,
        lead_id: resolvedLeadId,
        channel_id: channel.id,
        status: "open",
        ai_enabled: true,
      })
      .select("id, store_id, lead_id, channel_id")
      .single();
    if (error) return jsonResponse({ error: error.message }, 500);
    conversation = data as Record<string, unknown>;
  }

  await supabase.rpc("crm_apply_channel_to_conversation", {
    p_conversation_id: conversation.id,
    p_channel_id: channel.id,
    p_changed_by: null,
    p_reason: "crm_uaz_webhook",
  });

  const { data: insertedMessage, error: insertMessageError } = await supabase
    .from("crm_messages")
    .insert({
      conversation_id: conversation.id,
      lead_id: resolvedLeadId,
      store_id: channel.store_id,
      channel_id: channel.id,
      direction: "inbound",
      sender_type: "customer",
      content: messageContent,
      provider_message_id: providerMessageId,
      status: "sent",
      sent_at: new Date().toISOString(),
      webhook_payload: body,
      event_origin: "direct",
    })
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
        storeId: String(channel.store_id),
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

  await logCRMEvent({
    supabase,
    storeId: String(channel.store_id),
    eventType: "crm_uaz_inbound_message",
    payload: {
      message_id: insertedMessage.id,
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
    deduped: false,
    messageId: insertedMessage.id,
    conversationId: conversation.id,
    leadId: resolvedLeadId,
  });
});
