import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const parseBearerToken = (authHeader: string | null) => {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return atob(`${normalized}${padding}`);
};

const getUserIdFromJwt = (jwt: string | null) => {
  if (!jwt) return null;
  const parts = jwt.split(".");
  if (parts.length < 2) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as { sub?: unknown };
    return typeof payload.sub === "string" && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
};

const resolveUserIdFromAccessToken = async (
  adminClient: ReturnType<typeof createClient>,
  accessToken: string | null,
) => {
  const fromJwt = getUserIdFromJwt(accessToken);
  if (fromJwt) return fromJwt;
  if (!accessToken) return null;

  const { data, error } = await adminClient.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user.id;
};

const normalizeCpf = (value: string | null | undefined) => (value || "").replace(/\D/g, "");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "Missing function secrets." });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const bearerToken = parseBearerToken(req.headers.get("Authorization"));
  const userId = await resolveUserIdFromAccessToken(adminClient, bearerToken);
  if (!userId) return json(401, { error: "Invalid auth token." });

  const { data: profile, error: profileError } = await adminClient
    .from("user_profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) return json(500, { error: profileError.message });
  if (!profile || !["admin", "seller"].includes(profile.role)) {
    return json(403, { error: "Acesso negado." });
  }

  let body: { saleId?: string };
  try {
    body = (await req.json()) as { saleId?: string };
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  const saleId = (body.saleId || "").trim();
  if (!saleId) return json(400, { error: "saleId é obrigatório." });

  const { data: sale, error: saleError } = await adminClient
    .from("sales")
    .select("id, customer:customers(cpf)")
    .eq("id", saleId)
    .maybeSingle();

  if (saleError) return json(500, { error: saleError.message });
  if (!sale) return json(404, { error: "Venda não encontrada." });

  const saleCustomer = Array.isArray((sale as { customer?: unknown }).customer)
    ? (sale as { customer?: Array<{ cpf?: string | null }> }).customer?.[0]
    : (sale as { customer?: { cpf?: string | null } }).customer;
  const cpfDigits = normalizeCpf(saleCustomer?.cpf);

  if (!cpfDigits) {
    return json(422, { error: "Cliente da venda sem CPF cadastrado." });
  }
  if (cpfDigits.length !== 11) {
    return json(422, { error: "Cliente da venda sem CPF válido (11 dígitos)." });
  }

  const appBaseUrl = (Deno.env.get("APP_PUBLIC_URL") || "https://app.iphonerepasse.com.br").replace(/\/$/, "");
  const publicUrl = `${appBaseUrl}/#/warranties/${cpfDigits}`;

  return json(200, {
    publicUrl,
    cpf: cpfDigits,
  });
});
