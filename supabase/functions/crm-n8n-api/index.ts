/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  createServiceClient,
  jsonResponse,
  normalizePhone,
  parseJsonBody,
  requireAuthenticatedRole,
  resolveProvider,
  sanitizeText,
} from "../_shared/crm.ts";

type N8NBody = {
  action?: string;
  storeId?: string;
  payload?: Record<string, unknown>;
};

const checkN8NKey = (req: Request): boolean => {
  const expected = String(Deno.env.get("CRM_N8N_API_KEY") || "").trim();
  if (!expected) return false;
  const incoming = String(req.headers.get("x-api-key") || "").trim();
  return incoming !== "" && incoming === expected;
};

const fetchLeadById = async (supabase: ReturnType<typeof createServiceClient>, leadId: string) => {
  const { data: lead, error } = await supabase
    .from("crm_leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();

  if (error) throw error;
  return lead;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Failed to initialize Supabase." }, 500);
  }

  if (req.method === "GET") {
    return jsonResponse({
      success: true,
      service: "crm-n8n-api",
      providers: ["uazapi", "instagram_official"],
      now: new Date().toISOString(),
    });
  }

  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  let authenticated = false;
  if (checkN8NKey(req)) {
    authenticated = true;
  } else {
    try {
      await requireAuthenticatedRole(req, supabase);
      authenticated = true;
    } catch {
      authenticated = false;
    }
  }

  if (!authenticated) {
    return jsonResponse({ error: "Unauthorized. Use x-api-key ou Bearer válido." }, 401);
  }

  const body = await parseJsonBody<N8NBody>(req);
  if (!body) return jsonResponse({ error: "Invalid JSON body." }, 400);

  const action = sanitizeText(body.action);
  const storeId = sanitizeText(body.storeId);
  const payload = (body.payload && typeof body.payload === "object" && !Array.isArray(body.payload))
    ? body.payload
    : {};

  if (!action) return jsonResponse({ error: "action é obrigatório." }, 400);

  if (action === "publish_event") {
    if (!storeId) return jsonResponse({ error: "storeId é obrigatório para publish_event." }, 400);

    const eventType = sanitizeText(payload.event_type || payload.eventType) || "crm_external_event";
    const isOutbound = Boolean(payload.is_outbound ?? payload.isOutbound ?? true);
    const webhookUrl = sanitizeText(payload.webhook_url || payload.webhookUrl);
    const channelId = sanitizeText(payload.channel_id || payload.channelId);
    const leadId = sanitizeText(payload.lead_id || payload.leadId);
    const conversationId = sanitizeText(payload.conversation_id || payload.conversationId);

    const { data, error } = await supabase
      .from("crm_event_log")
      .insert({
        store_id: storeId,
        event_type: eventType,
        payload,
        is_outbound: isOutbound,
        webhook_url: webhookUrl,
        channel_id: channelId,
        lead_id: leadId,
        conversation_id: conversationId,
      })
      .select("id")
      .single();

    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ success: true, eventId: data.id });
  }

  if (action === "upsert_lead") {
    if (!storeId) return jsonResponse({ error: "storeId é obrigatório para upsert_lead." }, 400);

    const providerRaw = sanitizeText(payload.provider);
    if (providerRaw && !resolveProvider(providerRaw)) {
      return jsonResponse({ error: "provider inválido. Permitidos: uazapi, instagram_official." }, 422);
    }

    const identityType = sanitizeText(payload.identity_type || payload.identityType);
    const identityValue = sanitizeText(payload.identity_value || payload.identityValue);
    const normalizedPhone = normalizePhone(payload.phone);
    const normalizedIdentityValue = identityType === "phone" ? normalizePhone(identityValue) : identityValue;

    if (identityType && identityValue) {
      const { data: leadId, error } = await supabase.rpc("crm_upsert_lead_by_identity_rpc", {
        p_store_id: storeId,
        p_identity_type: identityType,
        p_identity_value: normalizedIdentityValue || identityValue,
        p_name: sanitizeText(payload.name),
        p_channel_id: sanitizeText(payload.channel_id || payload.channelId),
        p_phone: normalizedPhone,
        p_email: sanitizeText(payload.email),
        p_contact_id: sanitizeText(payload.contact_id || payload.contactId),
        p_entity_id: sanitizeText(payload.entity_id || payload.entityId),
        p_first_message: sanitizeText(payload.first_message || payload.firstMessage),
        p_utm_source: sanitizeText(payload.utm_source || payload.utmSource),
        p_utm_campaign: sanitizeText(payload.utm_campaign || payload.utmCampaign),
        p_utm_medium: sanitizeText(payload.utm_medium || payload.utmMedium),
        p_utm_content: sanitizeText(payload.utm_content || payload.utmContent),
        p_utm_term: sanitizeText(payload.utm_term || payload.utmTerm),
        p_intent: sanitizeText(payload.intent),
      });

      if (error) return jsonResponse({ error: error.message }, 500);
      try {
        const lead = await fetchLeadById(supabase, String(leadId));
        return jsonResponse({ success: true, leadId, lead });
      } catch (leadError: any) {
        return jsonResponse({ error: leadError?.message || "Erro ao buscar lead atualizado." }, 500);
      }
    }

    if (!normalizedPhone) return jsonResponse({ error: "phone é obrigatório quando identity não for informado." }, 400);

    const { data: leadId, error } = await supabase.rpc("upsert_crm_lead", {
      p_store_id: storeId,
      p_phone: normalizedPhone,
      p_name: sanitizeText(payload.name),
      p_contact_id: sanitizeText(payload.contact_id || payload.contactId),
      p_entity_id: sanitizeText(payload.entity_id || payload.entityId),
      p_channel_id: sanitizeText(payload.channel_id || payload.channelId),
      p_email: sanitizeText(payload.email),
      p_utm_source: sanitizeText(payload.utm_source || payload.utmSource),
      p_utm_campaign: sanitizeText(payload.utm_campaign || payload.utmCampaign),
      p_utm_medium: sanitizeText(payload.utm_medium || payload.utmMedium),
      p_utm_content: sanitizeText(payload.utm_content || payload.utmContent),
      p_utm_term: sanitizeText(payload.utm_term || payload.utmTerm),
      p_first_message: sanitizeText(payload.first_message || payload.firstMessage),
      p_intent: sanitizeText(payload.intent),
    });

    if (error) return jsonResponse({ error: error.message }, 500);
    try {
      const lead = await fetchLeadById(supabase, String(leadId));
      return jsonResponse({ success: true, leadId, lead });
    } catch (leadError: any) {
      return jsonResponse({ error: leadError?.message || "Erro ao buscar lead atualizado." }, 500);
    }
  }

  if (action === "schedule_message") {
    const leadId = sanitizeText(payload.lead_id || payload.leadId);
    const scheduledFor = sanitizeText(payload.scheduled_for || payload.scheduledFor);
    const content = sanitizeText(payload.message_content || payload.messageContent || payload.content);

    if (!leadId || !scheduledFor || !content) {
      return jsonResponse({ error: "lead_id, scheduled_for e message_content são obrigatórios." }, 400);
    }

    const { data: lead, error: leadError } = await supabase
      .from("crm_leads")
      .select("store_id")
      .eq("id", leadId)
      .maybeSingle();

    if (leadError) return jsonResponse({ error: leadError.message }, 500);
    if (!lead) return jsonResponse({ error: "Lead não encontrado." }, 404);

    const { data, error } = await supabase
      .from("crm_scheduled_messages")
      .insert({
        lead_id: leadId,
        store_id: lead.store_id,
        conversation_id: sanitizeText(payload.conversation_id || payload.conversationId),
        channel_id: sanitizeText(payload.channel_id || payload.channelId),
        message_content: content,
        media_url: sanitizeText(payload.media_url || payload.mediaUrl),
        media_type: sanitizeText(payload.media_type || payload.mediaType),
        metadata: payload,
        scheduled_for: scheduledFor,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ success: true, scheduledMessageId: data.id });
  }

  if (action === "get_statistics") {
    if (!storeId) return jsonResponse({ error: "storeId é obrigatório para get_statistics." }, 400);
    const { data, error } = await supabase.rpc("get_crm_statistics", { p_store_id: storeId });
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ success: true, data });
  }

  if (action === "prepare_broadcast") {
    const broadcastId = sanitizeText(payload.broadcast_id || payload.broadcastId);
    if (!broadcastId) return jsonResponse({ error: "broadcast_id é obrigatório." }, 400);
    const { data, error } = await supabase.rpc("prepare_broadcast_recipients", { p_broadcast_id: broadcastId });
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ success: true, recipientsPrepared: Number(data || 0) });
  }

  if (action === "broadcast_stats") {
    const broadcastId = sanitizeText(payload.broadcast_id || payload.broadcastId);
    if (!broadcastId) return jsonResponse({ error: "broadcast_id é obrigatório." }, 400);
    const { data, error } = await supabase.rpc("get_broadcast_stats", { p_broadcast_id: broadcastId });
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ success: true, data });
  }

  if (action === "cancel_broadcast") {
    const broadcastId = sanitizeText(payload.broadcast_id || payload.broadcastId);
    if (!broadcastId) return jsonResponse({ error: "broadcast_id é obrigatório." }, 400);
    const { data, error } = await supabase.rpc("cancel_broadcast", { p_broadcast_id: broadcastId });
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ success: true, data });
  }

  if (action === "sync_campaign_tags") {
    if (!storeId) return jsonResponse({ error: "storeId é obrigatório para sync_campaign_tags." }, 400);
    const mappings = payload.mappings && typeof payload.mappings === "object" && !Array.isArray(payload.mappings)
      ? payload.mappings
      : {};
    const { data, error } = await supabase.rpc("sync_crm_campaign_tag_mappings", {
      p_store_id: storeId,
      p_mappings: mappings,
    });
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ success: true, data });
  }

  if (action === "test_webhook") {
    const subscriptionId = sanitizeText(payload.subscription_id || payload.subscriptionId);
    if (!subscriptionId) return jsonResponse({ error: "subscription_id é obrigatório." }, 400);
    const { data, error } = await supabase.rpc("test_webhook_subscription", { p_subscription_id: subscriptionId });
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ success: true, data });
  }

  return jsonResponse({ error: `Ação não suportada: ${action}` }, 400);
});
