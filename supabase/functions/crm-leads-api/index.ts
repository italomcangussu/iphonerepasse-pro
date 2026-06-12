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

const LEAD_STATE_FIELDS = new Set([
  "interest_type",
  "desired_model",
  "desired_capacity",
  "desired_color",
  "desired_condition",
  "has_tradein",
  "tradein_model",
  "tradein_model_accepted",
  "tradein_rejected_reason",
  "tradein_capacity",
  "tradein_color",
  "tradein_scratches",
  "tradein_liquid_contact",
  "tradein_side_marks",
  "tradein_parts_swapped",
  "tradein_has_box_cable",
  "tradein_battery_pct",
  "tradein_battery_suspect",
  "tradein_apple_warranty",
  "tradein_warranty_until",
  "tradein_disqualified",
  "preferred_city",
  "stock_city",
  "cross_city_situation",
  "stock_item_id",
  "hdi_city_needed",
  "client_outside_ce",
  "card_brand",
  "simulation_done",
  "simulation_count",
  "last_simulation_total",
  "secondary_color_simulation",
  "proposal_accepted",
  "reservation_intent",
  "pix_data_sent",
  "pix_paid",
  "pix_amount",
  "pickup_datetime",
  "pickup_city",
  "cadastro_solicitado",
  "cadastro_nome_completo",
  "cadastro_data_nascimento",
  "cadastro_cpf",
  "cadastro_contato",
  "cadastro_completo",
  "commerce_state",
  "tradein_assessment",
  "quote_versions",
  "state_version",
]);

const pickLeadState = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([key]) => LEAD_STATE_FIELDS.has(key)),
  );
};

const checkN8NKey = (req: Request): boolean => {
  const expected = String(Deno.env.get("CRM_N8N_API_KEY") || "").trim();
  if (!expected) return false;
  const incoming = String(req.headers.get("x-api-key") || "").trim();
  return incoming !== "" && incoming === expected;
};

const shouldIncludeLeadState = (url: URL, isN8NRequest: boolean): boolean => {
  const includeState = sanitizeText(url.searchParams.get("include_state"));
  return includeState === "true" || (isN8NRequest && url.searchParams.get("include_state") !== "false");
};

const keepOnlyLatestSearchLeadItem = (data: unknown): unknown => {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const record = data as Record<string, unknown>;
  if (!Array.isArray(record.items)) return data;
  const latestItem = record.items.length > 0 ? record.items[0] : null;
  return {
    ...record,
    items: latestItem ? [latestItem] : [],
    limit: 1,
  };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Failed to initialize Supabase." }, 500);
  }

  const isN8NRequest = checkN8NKey(req);
  let authenticated = false;
  if (isN8NRequest) {
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
    const includeState = shouldIncludeLeadState(url, isN8NRequest);

    if (leadId) {
      const [{ data, error }, { data: customValues, error: customError }, { data: leadState, error: stateError }] = await Promise.all([
        supabase.rpc("get_lead_full_data", { p_lead_id: leadId }),
        includeCustom
          ? supabase.rpc("get_lead_custom_values", { p_lead_id: leadId })
          : Promise.resolve({ data: null, error: null }),
        includeState
          ? supabase.rpc("get_lead_state", { p_lead_id: leadId })
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (error) return jsonResponse({ error: error.message }, 500);
      if (customError) return jsonResponse({ error: customError.message }, 500);
      if (stateError) return jsonResponse({ error: stateError.message }, 500);
      return jsonResponse({ success: true, data, custom_values: customValues || {}, ...(includeState ? { lead_state: leadState || {} } : {}) });
    }

    const storeId = sanitizeText(url.searchParams.get("store_id"));
    if (!storeId) return jsonResponse({ error: "store_id é obrigatório." }, 400);

    const search = sanitizeText(url.searchParams.get("search"));
    const funnelStage = sanitizeText(url.searchParams.get("funnel_stage"));
    const salesStage = sanitizeText(url.searchParams.get("sales_stage"));
    const sourceChannelId = sanitizeText(url.searchParams.get("source_channel_id"));
    const isCustomerRaw = sanitizeText(url.searchParams.get("is_customer"));
    const includeListState = shouldIncludeLeadState(url, isN8NRequest);
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
    if (includeListState && data && typeof data === "object" && !Array.isArray(data) && Array.isArray((data as any).items)) {
      const items = (data as any).items as Array<Record<string, unknown>>;
      const leadIds = items.map((item) => sanitizeText(item.id)).filter(Boolean) as string[];
      if (leadIds.length > 0) {
        const { data: states, error: statesError } = await supabase
          .from("lead_state")
          .select("*")
          .in("lead_id", leadIds);
        if (statesError) return jsonResponse({ error: statesError.message }, 500);
        const statesByLeadId = new Map((states || []).map((state: any) => [String(state.lead_id), state]));
        (data as any).items = items.map((item) => ({
          ...item,
          lead_state: statesByLeadId.get(String(item.id)) || null,
        }));
      }
    }
    return jsonResponse({ success: true, data: isN8NRequest ? keepOnlyLatestSearchLeadItem(data) : data });
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

  if (action === "upsert_lead_state") {
    const leadId = sanitizeText(payload.lead_id || payload.leadId);
    const state = pickLeadState(payload.state || payload.lead_state || payload);
    if (!leadId) return jsonResponse({ error: "lead_id é obrigatório." }, 400);
    if (Object.keys(state).length === 0) return jsonResponse({ error: "state não possui campos válidos." }, 400);

    const { data, error } = await supabase.rpc("upsert_lead_state", {
      p_lead_id: leadId,
      p_state: state,
    });

    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ success: true, lead_state: data });
  }

  if (action === "upsert_commerce_state") {
    const leadId = sanitizeText(payload.lead_id || payload.leadId);
    const expectedVersionRaw = payload.expected_version ?? payload.expectedVersion;
    const expectedVersion = expectedVersionRaw === null || expectedVersionRaw === undefined
      ? null
      : Number(expectedVersionRaw);
    if (!leadId) return jsonResponse({ error: "lead_id é obrigatório." }, 400);
    if (expectedVersion !== null && !Number.isSafeInteger(expectedVersion)) {
      return jsonResponse({ error: "expected_version inválido." }, 400);
    }

    const { data, error } = await supabase.rpc("upsert_repasse_commerce_state", {
      p_lead_id: leadId,
      p_expected_version: expectedVersion,
      p_state: payload.commerce_state || payload.commerceState || {},
      p_tradein: payload.tradein_assessment || payload.tradeinAssessment || {},
      p_quotes: payload.quote_versions || payload.quoteVersions || [],
    });

    if (error) {
      const status = /stale commerce state version/i.test(error.message) ? 409 : 500;
      return jsonResponse({ error: error.message, code: status === 409 ? "state_version_conflict" : "commerce_state_update_failed" }, status);
    }
    return jsonResponse({ success: true, lead_state: data });
  }

  if (action === "record_ai_turn_event") {
    const leadId = sanitizeText(payload.lead_id || payload.leadId);
    const turnId = sanitizeText(payload.turn_id || payload.turnId);
    const eventAction = sanitizeText(payload.event_action || payload.eventAction || payload.next_action || payload.nextAction);
    const durationRaw = payload.duration_ms ?? payload.durationMs;
    const durationMs = durationRaw === null || durationRaw === undefined ? null : Number(durationRaw);
    if (!leadId || !turnId || !eventAction) {
      return jsonResponse({ error: "lead_id, turn_id e event_action são obrigatórios." }, 400);
    }
    if (durationMs !== null && (!Number.isSafeInteger(durationMs) || durationMs < 0)) {
      return jsonResponse({ error: "duration_ms inválido." }, 400);
    }

    const { data, error } = await supabase.rpc("record_ai_turn_event", {
      p_turn_id: turnId,
      p_lead_id: leadId,
      p_conversation_id: sanitizeText(payload.conversation_id || payload.conversationId) || null,
      p_action: eventAction,
      p_outcome: sanitizeText(payload.outcome) || null,
      p_duration_ms: durationMs,
      p_stage_timings: payload.stage_timings || payload.stageTimings || {},
      p_metadata: payload.metadata || {},
    });

    if (error) return jsonResponse({ error: error.message, code: "ai_turn_event_failed" }, 500);
    return jsonResponse({ success: true, event: data });
  }

  if (action === "update_memory") {
    const leadId = sanitizeText(payload.lead_id || payload.leadId);
    if (!leadId) return jsonResponse({ error: "lead_id é obrigatório." }, 400);

    const { data, error } = await supabase.rpc("update_lead_memory", {
      p_lead_id: leadId,
      p_summary_short: sanitizeText(payload.summary_short || payload.summaryShort),
      p_summary_operational: sanitizeText(payload.summary_operational || payload.summaryOperational),
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
