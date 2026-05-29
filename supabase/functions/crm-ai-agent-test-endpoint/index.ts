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
  agentConfigId?: string;
  sampleMessage?: string;
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

  const body = await parseJsonBody<Body>(req);
  if (!body) return jsonResponse({ error: "Invalid JSON body." }, 400);

  const agentConfigId = sanitizeText(body.agentConfigId);
  if (!agentConfigId) return jsonResponse({ error: "agentConfigId é obrigatório." }, 400);

  const { data: config, error: configError } = await supabase
    .from("crm_ai_agent_configs")
    .select("id, store_id, endpoint_url, name, total_invocations, total_successes, total_failures")
    .eq("id", agentConfigId)
    .maybeSingle();

  if (configError) return jsonResponse({ error: configError.message }, 500);
  if (!config) return jsonResponse({ error: "Agente não encontrado." }, 404);

  const endpointUrl = String(config.endpoint_url || "").trim();
  if (!endpointUrl || !endpointUrl.startsWith("https://")) {
    return jsonResponse({ error: "Endpoint HTTPS do agente não configurado." }, 422);
  }

  const startedAt = Date.now();
  let statusCode: number | null = null;
  let responseBody = "";
  let success = false;
  let errorMessage: string | null = null;

  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "manual_test",
        message: sanitizeText(body.sampleMessage) || "Teste do agente IA",
        agent_config_id: agentConfigId,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    statusCode = response.status;
    responseBody = (await response.text()).slice(0, 1200);
    success = response.ok;
    if (!response.ok) errorMessage = `HTTP ${response.status}`;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error || "endpoint_test_failed");
  }

  await supabase.from("crm_ai_agent_invocations").insert({
    store_id: config.store_id,
    agent_config_id: config.id,
    source: "manual_test",
    status: success ? "success" : "failure",
    routing_reason: "manual_endpoint_test",
    metadata: {
      status_code: statusCode,
      response_body: responseBody,
      error: errorMessage,
      latency_ms: Date.now() - startedAt,
    },
  });

  await supabase
    .from("crm_ai_agent_configs")
    .update({
      total_invocations: Number(config.total_invocations || 0) + 1,
      ...(success
        ? { total_successes: Number(config.total_successes || 0) + 1 }
        : { total_failures: Number(config.total_failures || 0) + 1 }),
    })
    .eq("id", config.id);

  return jsonResponse({
    success,
    statusCode,
    responseBody,
    error: errorMessage,
  }, success ? 200 : 502);
});
