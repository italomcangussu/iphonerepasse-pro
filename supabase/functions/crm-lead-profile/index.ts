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

type Body = {
  leadId?: string;
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

  let leadId: string | null = null;

  if (req.method === "GET") {
    const url = new URL(req.url);
    leadId = sanitizeText(url.searchParams.get("lead_id"));
  } else if (req.method === "POST") {
    const body = await parseJsonBody<Body>(req);
    if (!body) return jsonResponse({ error: "Invalid JSON body." }, 400);
    leadId = sanitizeText(body.leadId);
  } else {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  if (!leadId) return jsonResponse({ error: "leadId é obrigatório." }, 400);

  const [{ data: profileData, error: profileError }, { data: customValues, error: customError }] = await Promise.all([
    supabase.rpc("get_lead_full_data", { p_lead_id: leadId }),
    supabase.rpc("get_lead_custom_values", { p_lead_id: leadId }),
  ]);

  if (profileError) return jsonResponse({ error: profileError.message }, 500);
  if (customError) return jsonResponse({ error: customError.message }, 500);

  return jsonResponse({
    success: true,
    leadId,
    profile: profileData,
    customValues: customValues || {},
  });
});
