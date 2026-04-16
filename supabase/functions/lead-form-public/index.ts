/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  createServiceClient,
  jsonResponse,
  logCRMEvent,
  parseJsonBody,
  sanitizeText,
} from "../_shared/crm.ts";

type LeadFormBody = {
  token?: string;
  name?: string;
  email?: string;
  phone?: string;
  custom_fields?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
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
    const url = new URL(req.url);
    const token = sanitizeText(url.searchParams.get("token"));
    const slug = sanitizeText(url.searchParams.get("slug"));

    if (!token && !slug) return jsonResponse({ error: "token ou slug é obrigatório." }, 400);

    let query = supabase
      .from("crm_public_registration_links")
      .select("id, store_id, lead_id, token, slug, expires_at, is_active, metadata")
      .eq("is_active", true)
      .limit(1);

    query = token ? query.eq("token", token) : query.eq("slug", slug);

    const { data: link, error: linkError } = await query.maybeSingle();
    if (linkError) return jsonResponse({ error: linkError.message }, 500);
    if (!link) return jsonResponse({ error: "link_not_found" }, 404);

    if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
      return jsonResponse({ error: "link_expired" }, 410);
    }

    const [{ data: lead }, { data: fields }] = await Promise.all([
      supabase.from("crm_leads").select("id, name, email, phone").eq("id", link.lead_id).maybeSingle(),
      supabase
        .from("crm_custom_fields")
        .select("id, key, label, field_type, options, is_required")
        .eq("store_id", link.store_id)
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
    ]);

    return jsonResponse({
      success: true,
      link,
      lead,
      fields: fields || [],
    });
  }

  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const body = await parseJsonBody<LeadFormBody>(req);
  if (!body) return jsonResponse({ error: "Invalid JSON body." }, 400);

  const token = sanitizeText(body.token);
  if (!token) return jsonResponse({ error: "token é obrigatório." }, 400);

  const { data: link, error: linkError } = await supabase
    .from("crm_public_registration_links")
    .select("id, store_id, lead_id, expires_at, is_active")
    .eq("token", token)
    .maybeSingle();

  if (linkError) return jsonResponse({ error: linkError.message }, 500);
  if (!link) return jsonResponse({ error: "link_not_found" }, 404);
  if (!link.is_active) return jsonResponse({ error: "link_inactive" }, 409);
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
    return jsonResponse({ error: "link_expired" }, 410);
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    last_interaction_at: new Date().toISOString(),
  };

  const name = sanitizeText(body.name);
  const email = sanitizeText(body.email);
  const phone = sanitizeText(body.phone);
  if (name) updates.name = name;
  if (email) updates.email = email;
  if (phone) updates.phone = phone;

  const { error: updateLeadError } = await supabase
    .from("crm_leads")
    .update(updates)
    .eq("id", link.lead_id);

  if (updateLeadError) return jsonResponse({ error: updateLeadError.message }, 500);

  const customFields = body.custom_fields && typeof body.custom_fields === "object"
    ? body.custom_fields
    : {};

  if (Object.keys(customFields).length > 0) {
    const { data: fields, error: fieldsError } = await supabase
      .from("crm_custom_fields")
      .select("id, key")
      .eq("store_id", link.store_id)
      .eq("is_active", true);

    if (fieldsError) return jsonResponse({ error: fieldsError.message }, 500);

    const fieldByKey = new Map<string, string>();
    for (const field of fields || []) {
      fieldByKey.set(String(field.key), String(field.id));
    }

    for (const [key, value] of Object.entries(customFields)) {
      const fieldId = fieldByKey.get(key);
      if (!fieldId) continue;

      const { error: setFieldError } = await supabase.rpc("set_lead_custom_field", {
        p_lead_id: link.lead_id,
        p_field_id: fieldId,
        p_value: value,
      });

      if (setFieldError) return jsonResponse({ error: setFieldError.message }, 500);
    }
  }

  await supabase
    .from("crm_public_registration_links")
    .update({
      metadata: {
        submitted_at: new Date().toISOString(),
        payload: body.metadata || {},
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", link.id);

  await logCRMEvent({
    supabase,
    storeId: String(link.store_id),
    eventType: "crm_public_lead_form_submitted",
    payload: {
      lead_id: link.lead_id,
      link_id: link.id,
      has_custom_fields: Object.keys(customFields).length > 0,
    },
    leadId: String(link.lead_id),
  });

  return jsonResponse({ success: true, leadId: link.lead_id });
});
