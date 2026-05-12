/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, createServiceClient, jsonResponse, parseJsonBody } from "../_shared/crm.ts";

/**
 * user-account-delete — soft-delete account (LGPD art. 18 VI).
 *
 * POST   /user-account-delete   { reason?: string }  — schedule deletion in 30 days
 * DELETE /user-account-delete                         — cancel pending deletion
 * GET    /user-account-delete                         — get deletion request status
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing authorization" }, 401);
  }

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.57.4");
  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authErr } = await anonClient.auth.getUser();
  if (authErr || !user) return jsonResponse({ error: "Unauthorized" }, 401);

  const db = createServiceClient();

  // GET — check status
  if (req.method === "GET") {
    const { data } = await db
      .from("account_deletion_requests")
      .select("requested_at, scheduled_delete_at, cancelled_at, completed_at")
      .eq("user_id", user.id)
      .maybeSingle();
    return jsonResponse({ request: data ?? null });
  }

  // DELETE — cancel deletion
  if (req.method === "DELETE") {
    const { error } = await db
      .from("account_deletion_requests")
      .update({ cancelled_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("cancelled_at", null)
      .is("completed_at", null);
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ ok: true, message: "Exclusão de conta cancelada com sucesso." });
  }

  // POST — schedule deletion
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const body = await parseJsonBody<{ reason?: string }>(req);

  // Check if already has active request
  const { data: existing } = await db
    .from("account_deletion_requests")
    .select("id, scheduled_delete_at")
    .eq("user_id", user.id)
    .is("cancelled_at", null)
    .is("completed_at", null)
    .maybeSingle();

  if (existing) {
    return jsonResponse({
      ok: true,
      already_pending: true,
      scheduled_delete_at: existing.scheduled_delete_at,
      message: "Sua conta já está agendada para exclusão.",
    });
  }

  const scheduledDeleteAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error: insertErr } = await db
    .from("account_deletion_requests")
    .insert({
      user_id: user.id,
      reason: body?.reason?.slice(0, 500) ?? null,
      scheduled_delete_at: scheduledDeleteAt,
    });

  if (insertErr) return jsonResponse({ error: insertErr.message }, 500);

  // Revoke all push subscriptions immediately
  await db
    .from("push_subscriptions")
    .update({ is_active: false })
    .eq("user_id", user.id);

  // Note: Supabase admin sign-out is not available via service client directly.
  // The frontend will handle logout after receiving ok: true.

  return jsonResponse({
    ok: true,
    scheduled_delete_at: scheduledDeleteAt,
    message: `Sua conta será excluída em 30 dias (${new Date(scheduledDeleteAt).toLocaleDateString("pt-BR")}). Você pode cancelar antes disso em Configurações > Privacidade.`,
  });
});
