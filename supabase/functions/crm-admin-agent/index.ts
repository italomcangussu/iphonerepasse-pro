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
import { runAdminAgentTurn } from "../_shared/admin_agent/runner.ts";
import { ChatMessage } from "../_shared/admin_agent/llm.ts";

// Internal finance assistant for administrators over WhatsApp.
// Invoked by crm-uaz-webhook-receiver when an inbound message lands on an
// `is_admin_console` channel. Service-role only.

interface AdminAgentBody {
  storeId?: string;
  channelId?: string;
  conversationId?: string;
  leadId?: string;
  senderPhone?: string;
  messageContent?: string;
  providerMessageId?: string;
}

const HISTORY_LIMIT = 12;

function extractBearer(req: Request): string {
  const raw = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// A service-role JWT for this project (the ref-scoped `role: service_role`
// claim) is accepted even when its raw string differs from the injected
// SUPABASE_SERVICE_ROLE_KEY (key rotation / new API-key format). Mirrors the
// proven check in crm-send-message so the receiver → admin-agent call keeps
// working across key changes.
function isServiceRoleJwtForProject(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (payload?.role !== "service_role") return false;
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").trim();
  const projectRef = supabaseUrl ? new URL(supabaseUrl).hostname.split(".")[0] : "";
  return !projectRef || payload.ref === projectRef;
}

function isServiceRoleRequest(req: Request): boolean {
  const bearer = extractBearer(req);
  if (!bearer) return false;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return (Boolean(serviceKey) && bearer === serviceKey) ||
    isServiceRoleJwtForProject(bearer);
}

async function buildHistory(
  supabase: ReturnType<typeof createServiceClient>,
  conversationId: string,
  currentProviderMessageId: string,
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("crm_messages")
    .select("direction, content, provider_message_id, created_at")
    .eq("conversation_id", conversationId)
    .not("content", "is", null)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT + 1);
  if (error || !Array.isArray(data)) return [];

  return (data as Array<Record<string, unknown>>)
    .filter((m) => String(m.provider_message_id || "") !== currentProviderMessageId)
    .filter((m) => sanitizeText(m.content))
    .slice(0, HISTORY_LIMIT)
    .reverse()
    .map((m) => ({
      role: m.direction === "outbound" ? "assistant" : "user",
      content: String(m.content),
    }));
}

async function sendReply(args: {
  conversationId: string;
  leadId: string;
  channelId: string;
  content: string;
}): Promise<void> {
  const sendUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/crm-send-message`;
  const response = await fetch(sendUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({
      conversationId: args.conversationId,
      leadId: args.leadId,
      channelId: args.channelId,
      content: args.content,
      senderType: "ai_inbound",
    }),
  });
  if (!response.ok && response.status !== 409) {
    const text = await response.text().catch(() => "");
    throw new Error(`crm-send-message failed: ${response.status} ${text.slice(0, 240)}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  if (!isServiceRoleRequest(req)) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const body = await parseJsonBody<AdminAgentBody>(req);
  if (!body) return jsonResponse({ error: "Invalid JSON body." }, 400);

  const conversationId = sanitizeText(body.conversationId);
  const leadId = sanitizeText(body.leadId);
  const channelId = sanitizeText(body.channelId);
  const senderPhone = sanitizeText(body.senderPhone);
  const messageContent = sanitizeText(body.messageContent);
  const providerMessageId = sanitizeText(body.providerMessageId) || "";

  if (!senderPhone || !messageContent) {
    return jsonResponse({ error: "senderPhone e messageContent são obrigatórios." }, 422);
  }

  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = createServiceClient();
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Failed to init Supabase." }, 500);
  }

  try {
    const history = conversationId
      ? await buildHistory(supabase, conversationId, providerMessageId)
      : [];

    const result = await runAdminAgentTurn({
      supabase: supabase as any,
      channelId,
      conversationId,
      senderPhone,
      messageContent,
      history,
      apiKey: Deno.env.get("OPEN_ROUTER_API_KEY") || "",
      model: Deno.env.get("ADMIN_AGENT_MODEL") || undefined,
    });

    // Only reply inside an existing conversation. Unauthorized senders still get
    // the terse denial so an admin who typed the wrong number understands why.
    if (result.reply && conversationId && leadId && channelId) {
      try {
        await sendReply({
          conversationId,
          leadId,
          channelId,
          content: result.reply,
        });
      } catch (sendErr) {
        await logCRMEvent({
          supabase,
          storeId: sanitizeText(body.storeId) || "",
          eventType: "crm_admin_agent_send_failed",
          payload: { error: (sendErr as Error).message, conversationId },
        }).catch(() => {});
      }
    }

    await logCRMEvent({
      supabase,
      storeId: sanitizeText(body.storeId) || "",
      eventType: "crm_admin_agent_turn",
      payload: {
        authorized: result.authorized,
        mutation: result.mutation ?? null,
        tools: result.toolTrace?.map((t) => t.name) ?? [],
        error: result.error ?? null,
        conversationId,
      },
    }).catch(() => {});

    return jsonResponse({
      success: true,
      authorized: result.authorized,
      replied: Boolean(result.reply && conversationId),
    });
  } catch (error: any) {
    await logCRMEvent({
      supabase,
      storeId: sanitizeText(body.storeId) || "",
      eventType: "crm_admin_agent_error",
      payload: { error: error?.message || String(error) },
    }).catch(() => {});
    // Always 200 so the webhook receiver does not retry-storm.
    return jsonResponse({ success: false, error: error?.message || "erro" }, 200);
  }
});
