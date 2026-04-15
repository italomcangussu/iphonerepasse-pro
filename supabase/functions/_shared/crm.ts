/// <reference lib="deno.ns" />
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export type CRMProvider = "uazapi" | "instagram_official";

export const CRM_ALLOWED_PROVIDERS: CRMProvider[] = ["uazapi", "instagram_official"];

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-crm-signature, x-webhook-secret",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

export const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

export const parseJsonBody = async <T = Record<string, unknown>>(req: Request): Promise<T | null> => {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
};

export const normalizePhone = (value: unknown): string | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `+${withCountry}`;
};

export const sanitizeText = (value: unknown): string | null => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};

export const resolveProvider = (value: unknown): CRMProvider | null => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "uazapi") return "uazapi";
  if (normalized === "instagram_official") return "instagram_official";
  return null;
};

export const requireProvider = (value: unknown): CRMProvider => {
  const provider = resolveProvider(value);
  if (!provider) {
    throw new Error("provider inválido. Permitidos: uazapi, instagram_official");
  }
  return provider;
};

export const createServiceClient = (): SupabaseClient => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

const extractBearerToken = (authHeader: string | null): string | null => {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

export const requireAuthenticatedRole = async (
  req: Request,
  supabase: SupabaseClient,
): Promise<{ userId: string; role: "admin" | "seller" }> => {
  const token = extractBearerToken(req.headers.get("Authorization"));
  if (!token) {
    throw new Error("Missing bearer token.");
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user?.id) {
    throw new Error("Invalid auth token.");
  }

  const userId = userData.user.id;
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  const role = String(profile?.role || "").trim();
  if (role !== "admin" && role !== "seller") {
    throw new Error("Access denied.");
  }

  return { userId, role };
};

export const randomProviderMessageId = (prefix = "msg") => `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;

export const maybeJson = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

export const getHeaderSecret = (req: Request): string | null => {
  const headerValue = req.headers.get("x-webhook-secret") || req.headers.get("x-crm-signature");
  const normalized = String(headerValue ?? "").trim();
  return normalized || null;
};

export const ensureWebhookSecret = (expectedSecret: string | null, req: Request): void => {
  const expected = String(expectedSecret ?? "").trim();
  if (!expected) return;
  const received = getHeaderSecret(req);
  if (!received || received !== expected) {
    throw new Error("Invalid webhook secret.");
  }
};

export const logCRMEvent = async (args: {
  supabase: SupabaseClient;
  storeId: string;
  eventType: string;
  payload?: Record<string, unknown>;
  isOutbound?: boolean;
  channelId?: string | null;
  leadId?: string | null;
  conversationId?: string | null;
}) => {
  const { supabase, storeId, eventType, payload = {}, isOutbound = false, channelId = null, leadId = null, conversationId = null } = args;
  await supabase.from("crm_event_log").insert({
    store_id: storeId,
    event_type: eventType,
    payload,
    is_outbound: isOutbound,
    channel_id: channelId,
    lead_id: leadId,
    conversation_id: conversationId,
  });
};

export const coerceUuid = (value: unknown): string | null => {
  const candidate = String(value ?? "").trim();
  if (!candidate) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate)) {
    return candidate;
  }
  return null;
};

export const coerceStoreId = (value: unknown): string | null => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};
