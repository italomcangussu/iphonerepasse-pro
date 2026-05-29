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

const checkN8NKey = (req: Request): boolean => {
  const expected = String(Deno.env.get("CRM_N8N_API_KEY") || "").trim();
  if (!expected) return false;
  const incoming = String(req.headers.get("x-api-key") || "").trim();
  return incoming !== "" && incoming === expected;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Failed to initialize Supabase." }, 500);
  }

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

  if (req.method === "GET") {
    const url = new URL(req.url);
    const leadId = sanitizeText(url.searchParams.get("lead_id"));
    const includeCustom = sanitizeText(url.searchParams.get("include_custom_values")) === "true";

    if (leadId) {
      const [{ data, error }, { data: customValues, error: customError }] = await Promise.all([
        supabase.rpc("get_lead_full_data", { p_lead_id: leadId }),
        includeCustom
          ? supabase.rpc("get_lead_custom_values", { p_lead_id: leadId })
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (error) return jsonResponse({ error: error.message }, 500);
      if (customError) return jsonResponse({ error: customError.message }, 500);
      return jsonResponse({ success: true, data, custom_values: customValues || {} });
    }

    const storeId = sanitizeText(url.searchParams.get("store_id"));
    if (!storeId) return jsonResponse({ error: "store_id é obrigatório." }, 400);

    const search = sanitizeText(url.searchParams.get("search"));
    const funnelStage = sanitizeText(url.searchParams.get("funnel_stage"));
    const salesStage = sanitizeText(url.searchParams.get("sales_stage"));
    const sourceChannelId = sanitizeText(url.searchParams.get("source_channel_id"));
    const isCustomerRaw = sanitizeText(url.searchParams.get("is_customer"));
    const limit = Number(url.searchParams.get("limit") || "50");
    const offset = Number(url.searchParams.get("offset") || "0");

    const filters: Record<string, unknown> = {};
    if (search) filters.search = search;
    if (funnelStage) filters.funnel_stage = funnelStage;
    if (salesStage) filters.sales_stage = salesStage;
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

  if (action === "add_note") {
    const leadId = sanitizeText(payload.lead_id || payload.leadId);
    const note = sanitizeText(payload.note || payload.content);
    if (!leadId || !note) return jsonResponse({ error: "lead_id e note são obrigatórios." }, 400);

    const { data, error } = await supabase.rpc("add_lead_note", {
      p_lead_id: leadId,
      p_note: note,
      p_created_by: null,
    });

    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ success: true, messageId: data });
  }

  if (action === "bulk_update") {
    const storeId = sanitizeText(payload.store_id || payload.storeId);
    if (!storeId) return jsonResponse({ error: "store_id é obrigatório." }, 400);

    const filters = payload.filters && typeof payload.filters === "object" && !Array.isArray(payload.filters)
      ? payload.filters
      : {};
    const patch = payload.patch && typeof payload.patch === "object" && !Array.isArray(payload.patch)
      ? payload.patch
      : {};

    const { data, error } = await supabase.rpc("bulk_update_leads", {
      p_store_id: storeId,
      p_filters: filters,
      p_patch: patch,
    });

    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ success: true, updated: Number(data || 0) });
  }

  if (action === "transfer_store") {
    const leadId = sanitizeText(payload.lead_id || payload.leadId);
    const toStoreId = sanitizeText(payload.to_store_id || payload.toStoreId);
    if (!leadId || !toStoreId) return jsonResponse({ error: "lead_id e to_store_id são obrigatórios." }, 400);

    const { data, error } = await supabase.rpc("transfer_lead_store", {
      p_lead_id: leadId,
      p_to_store_id: toStoreId,
    });

    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ success: true, data });
  }

  if (action === "set_custom_field") {
    const leadId = sanitizeText(payload.lead_id || payload.leadId);
    const fieldId = sanitizeText(payload.field_id || payload.fieldId);
    if (!leadId || !fieldId) return jsonResponse({ error: "lead_id e field_id são obrigatórios." }, 400);

    const { data, error } = await supabase.rpc("set_lead_custom_field", {
      p_lead_id: leadId,
      p_field_id: fieldId,
      p_value: payload.value ?? {},
    });

    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ success: true, data });
  }

  return jsonResponse({ error: `Ação não suportada: ${action}` }, 400);
});
