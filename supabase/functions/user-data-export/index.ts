/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, createServiceClient, jsonResponse } from "../_shared/crm.ts";

/**
 * user-data-export — export all personal data for the authenticated user (LGPD art. 18 II).
 *
 * GET /user-data-export
 * Returns JSON with all user data. Frontend triggers browser download.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing authorization" }, 401);
  }

  // Verify JWT
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.57.4");
  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authErr } = await anonClient.auth.getUser();
  if (authErr || !user) return jsonResponse({ error: "Unauthorized" }, 401);

  const db = createServiceClient();

  // Helper: safe query that returns null on error instead of throwing
  const safeQuery = async <T>(
    fn: () => Promise<{ data: T | null; error: unknown }>
  ): Promise<T | null> => {
    try {
      const { data } = await fn();
      return data ?? null;
    } catch {
      return null;
    }
  };

  // Collect all user data in parallel
  const [
    profile,
    activityLogs,
    pushSubs,
    consents,
    deletionRequest,
    accessRole,
  ] = await Promise.all([
    safeQuery(() =>
      db.from("user_profiles").select("*").eq("id", user.id).maybeSingle()
    ),
    safeQuery(() =>
      db
        .from("app_user_activity_logs")
        .select("category, action, screen, metadata, occurred_at")
        .eq("user_id", user.id)
        .order("occurred_at", { ascending: false })
        .limit(1000)
    ),
    safeQuery(() =>
      db
        .from("push_subscriptions")
        .select("endpoint, platform, topics, is_active, created_at, last_seen_at")
        .eq("user_id", user.id)
    ),
    safeQuery(() =>
      db
        .from("user_consents")
        .select("consent_key, granted, policy_version, granted_at, revoked_at")
        .eq("user_id", user.id)
    ),
    safeQuery(() =>
      db
        .from("account_deletion_requests")
        .select("requested_at, scheduled_delete_at, cancelled_at")
        .eq("user_id", user.id)
        .maybeSingle()
    ),
    safeQuery(() =>
      db
        .from("user_access_roles")
        .select("app_role, display_name, created_at")
        .eq("user_id", user.id)
        .maybeSingle()
    ),
  ]);

  const exportData = {
    export_metadata: {
      generated_at: new Date().toISOString(),
      user_id: user.id,
      email: user.email,
      format_version: "1.0",
      lgpd_basis: "art. 18 II — direito de acesso",
    },
    account: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      profile: profile ?? null,
      access_role: accessRole ?? null,
    },
    consents: consents ?? [],
    push_subscriptions: pushSubs ?? [],
    activity_log: activityLogs ?? [],
    deletion_request: deletionRequest ?? null,
  };

  return new Response(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="iphonerepasse-dados-${new Date().toISOString().split("T")[0]}.json"`,
    },
  });
});
