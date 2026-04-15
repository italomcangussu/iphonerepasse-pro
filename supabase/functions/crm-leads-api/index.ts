/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  createServiceClient,
  jsonResponse,
  parseJsonBody,
  requireAuthenticatedRole,
  sanitizeText,
} from "../_shared/crm.ts";

type LeadsActionBody = {
  action?: string;
  payload?: Record<string, unknown>;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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

  if (req.method === "GET") {
    const url = new URL(req.url);
    const leadId = sanitizeText(url.searchParams.get("lead_id"));

    if (leadId) {
      const { data, error } = await supabase.rpc("get_lead_full_data", {
        p_lead_id: leadId,
      });

      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ success: true, data });
    }

    const storeId = sanitizeText(url.searchParams.get("store_id"));
    if (!storeId) return jsonResponse({ error: "store_id é obrigatório." }, 400);

    const search = sanitizeText(url.searchParams.get("search"));
    const funnelStage = sanitizeText(url.searchParams.get("funnel_stage"));
    const sourceChannelId = sanitizeText(url.searchParams.get("source_channel_id"));
    const isCustomerRaw = sanitizeText(url.searchParams.get("is_customer"));
    const limit = Number(url.searchParams.get("limit") || "50");
    const offset = Number(url.searchParams.get("offset") || "0");

    const filters: Record<string, unknown> = {};
    if (search) filters.search = search;
    if (funnelStage) filters.funnel_stage = funnelStage;
    if (sourceChannelId) filters.source_channel_id = sourceChannelId;
    if (isCustomerRaw === "true" || isCustomerRaw === "false") {
      filters.is_customer = isCustomerRaw === "true";
    }

    const { data, error } = await supabase.rpc("search_leads", {
      p_store_id: storeId,
      p_filters: filters,
      p_limit: Number.isFinite(limit) ? limit : 50,
      p_offset: Number.isFinite(offset) ? offset : 0,
    });

    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ success: true, data });
  }

  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const body = await parseJsonBody<LeadsActionBody>(req);
  if (!body) return jsonResponse({ error: "Invalid JSON body." }, 400);

  const action = sanitizeText(body.action);
  const payload = (body.payload && typeof body.payload === "object" && !Array.isArray(body.payload))
    ? body.payload
    : {};

  if (!action) return jsonResponse({ error: "action é obrigatório." }, 400);

  if (action === "update_basic") {
    const leadId = sanitizeText(payload.lead_id || payload.leadId);
    if (!leadId) return jsonResponse({ error: "lead_id é obrigatório." }, 400);

    const { data, error } = await supabase.rpc("update_lead_basic_data", {
      p_lead_id: leadId,
      p_name: sanitizeText(payload.name),
      p_email: sanitizeText(payload.email),
      p_tags: payload.tags ?? null,
    });

    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ success: true, data });
  }

  if (action === "update_funnel") {
    const leadId = sanitizeText(payload.lead_id || payload.leadId);
    if (!leadId) return jsonResponse({ error: "lead_id é obrigatório." }, 400);

    const { data, error } = await supabase.rpc("update_lead_funnel", {
      p_lead_id: leadId,
      p_funnel_stage: sanitizeText(payload.funnel_stage || payload.funnelStage),
      p_intent: sanitizeText(payload.intent),
      p_reason: sanitizeText(payload.reason),
      p_funnel_id: sanitizeText(payload.funnel_id || payload.funnelId),
    });

    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ success: true, data });
  }

  if (action === "mark_customer") {
    const leadId = sanitizeText(payload.lead_id || payload.leadId);
    if (!leadId) return jsonResponse({ error: "lead_id é obrigatório." }, 400);

    const { data, error } = await supabase.rpc("mark_lead_as_customer", {
      p_lead_id: leadId,
      p_customer_id: sanitizeText(payload.customer_id || payload.customerId),
    });

    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ success: true, data });
  }

  if (action === "move_stage") {
    const leadId = sanitizeText(payload.lead_id || payload.leadId);
    const toStage = sanitizeText(payload.to_stage || payload.toStage || payload.funnel_stage);
    if (!leadId || !toStage) return jsonResponse({ error: "lead_id e to_stage são obrigatórios." }, 400);

    const { data, error } = await supabase.rpc("move_crm_lead_stage", {
      p_lead_id: leadId,
      p_to_stage: toStage,
      p_to_funnel_id: sanitizeText(payload.to_funnel_id || payload.toFunnelId),
      p_changed_by: null,
      p_notes: sanitizeText(payload.notes || payload.reason),
    });

    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ success: true, data });
  }

  if (action === "apply_channel") {
    const conversationId = sanitizeText(payload.conversation_id || payload.conversationId);
    const channelId = sanitizeText(payload.channel_id || payload.channelId);
    if (!conversationId || !channelId) {
      return jsonResponse({ error: "conversation_id e channel_id são obrigatórios." }, 400);
    }

    const { data, error } = await supabase.rpc("crm_apply_channel_to_conversation", {
      p_conversation_id: conversationId,
      p_channel_id: channelId,
      p_changed_by: null,
      p_reason: sanitizeText(payload.reason),
    });

    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ success: true, data });
  }

  if (action === "refresh_purchase_metrics") {
    const leadId = sanitizeText(payload.lead_id || payload.leadId);
    if (!leadId) return jsonResponse({ error: "lead_id é obrigatório." }, 400);

    const { error } = await supabase.rpc("crm_refresh_lead_purchase_metrics", {
      p_lead_id: leadId,
    });

    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ success: true, leadId });
  }

  return jsonResponse({ error: `Ação não suportada: ${action}` }, 400);
});
