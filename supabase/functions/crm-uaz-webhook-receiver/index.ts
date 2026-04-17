/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  createServiceClient,
  ensureWebhookSecret,
  jsonResponse,
  logCRMEvent,
  normalizePhone,
  parseJsonBody,
  randomProviderMessageId,
  resolveProvider,
  sanitizeText,
} from "../_shared/crm.ts";

type UazWebhookBody = Record<string, unknown>;

const pickFirstText = (...values: unknown[]): string | null => {
  for (const value of values) {
    const normalized = sanitizeText(value);
    if (normalized) return normalized;
  }
  return null;
};

const extractPhone = (payload: UazWebhookBody): string | null => {
  const nestedData = (payload.data && typeof payload.data === "object") ? (payload.data as Record<string, unknown>) : {};
  const nestedContact = (payload.contact && typeof payload.contact === "object") ? (payload.contact as Record<string, unknown>) : {};

  return normalizePhone(
    pickFirstText(
      payload.phone,
      payload.from,
      payload.remoteJid,
      nestedData.phone,
      nestedData.from,
      nestedData.remoteJid,
      nestedContact.phone,
      nestedContact.number,
    ),
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

  const channelProvider = resolveProvider(channel.provider);
  if (channelProvider !== "uazapi") {
    return jsonResponse({ error: "Canal inválido para webhook UAZAPI." }, 422);
  }

  if (!Boolean(channel.is_active)) {
    return jsonResponse({ error: "Canal inativo." }, 409);
  }

  try {
    ensureWebhookSecret(String(channel.webhook_secret || ""), req);
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Invalid webhook secret." }, 401);
  }

  const phone = extractPhone(body);
  if (!phone) {
    return jsonResponse({ error: "Não foi possível identificar o telefone do lead no payload." }, 400);
  }

  const leadName = pickFirstText(body.name, body.pushName, body.contact_name);
  const messageContent = pickFirstText(body.message, body.text, (body.data as Record<string, unknown> | undefined)?.text);
  const providerMessageId = pickFirstText(body.message_id, body.id, (body.data as Record<string, unknown> | undefined)?.id)
    || randomProviderMessageId("uaz_in");

  const { data: leadId, error: upsertLeadError } = await supabase.rpc("upsert_crm_lead", {
    p_store_id: String(channel.store_id),
    p_phone: phone,
    p_name: leadName,
    p_contact_id: null,
    p_entity_id: null,
    p_channel_id: channel.id,
  });

  if (upsertLeadError) {
    return jsonResponse({ error: upsertLeadError.message }, 500);
  }

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

  const insertPayload = {
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
