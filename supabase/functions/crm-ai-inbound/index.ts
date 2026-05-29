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

type AIResponse = {
  conversation_id?: string;
  lead_id?: string;
  response_text?: string;
  confidence_score?: number;
  intent?: string;
  sentiment?: "positive" | "negative" | "neutral";
  urgency?: "low" | "medium" | "high";
  lead_qualification?: {
    score?: number;
    category?: string;
    reasons?: string[];
  };
  suggested_actions?: string[];
  metadata?: Record<string, unknown>;
};

type AIAgentConfigRow = {
  id: string;
  store_id: string;
  behavior_modes?: string[];
  auto_send_response?: boolean;
  channel_ids?: string[] | null;
  total_invocations?: number | null;
  total_successes?: number | null;
  total_failures?: number | null;
  routing_priority?: number | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function matchesChannel(config: AIAgentConfigRow, payload: AIResponse): boolean {
  const configuredChannelIds = Array.isArray(config.channel_ids)
    ? config.channel_ids.map((id) => String(id)).filter(Boolean)
    : [];
  if (configuredChannelIds.length === 0) return true;

  const metadata = asRecord(payload.metadata);
  const channelId = String(metadata.channel_id || metadata.channelId || "").trim();
  return Boolean(channelId && configuredChannelIds.includes(channelId));
}

function selectAIAgentConfig(configs: AIAgentConfigRow[], payload: AIResponse): {
  config: AIAgentConfigRow | null;
  reason: string;
} {
  const candidates = configs.filter((config) => matchesChannel(config, payload));
  if (candidates.length === 0) return { config: null, reason: "no_matching_agent" };

  const sorted = [...candidates].sort((a, b) => {
    const aPriority = Number(a.routing_priority ?? 100);
    const bPriority = Number(b.routing_priority ?? 100);
    if (aPriority !== bPriority) return aPriority - bPriority;
    return String(a.id).localeCompare(String(b.id));
  });

  return { config: sorted[0], reason: "priority_first_match" };
}

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
    const payload = await parseJsonBody<AIResponse>(req);
    if (!payload) return jsonResponse({ error: "Invalid JSON body." }, 400);

    const conversationId = sanitizeText(payload.conversation_id);
    if (!conversationId) return jsonResponse({ error: "Missing required field: conversation_id" }, 400);

    const { data: conversation, error: convError } = await supabase
      .from("crm_conversations")
      .select(`
        id,
        ai_enabled,
        status,
        store_id,
        lead_id,
        channel_id,
        lead:crm_leads(id, name, phone, funnel_stage, tags)
      `)
      .eq("id", conversationId)
      .maybeSingle();

    if (convError) return jsonResponse({ error: convError.message }, 500);
    if (!conversation) return jsonResponse({ error: "Conversation not found" }, 404);

    if (!conversation.ai_enabled || conversation.status !== "ai_handling") {
      return jsonResponse({
        success: false,
        message: "AI is disabled for this conversation",
      }, 409);
    }

    const { data: aiConfigs } = await supabase
      .from("crm_ai_agent_configs")
      .select("*")
      .eq("store_id", conversation.store_id)
      .eq("is_active", true);

    const routingDecision = selectAIAgentConfig((aiConfigs || []) as AIAgentConfigRow[], payload);
    const aiConfig = routingDecision.config;
    let messageSent = false;

    if (aiConfig && payload.response_text) {
      const behaviorModes = Array.isArray(aiConfig.behavior_modes) ? aiConfig.behavior_modes : [];

      if (behaviorModes.includes("lead_qualification") && payload.lead_qualification) {
        const lead = Array.isArray(conversation.lead) ? conversation.lead[0] : conversation.lead;
        const tags = Array.isArray(lead?.tags) ? [...lead.tags] : [];
        const category = sanitizeText(payload.lead_qualification.category);
        if (category && !tags.includes(category)) tags.push(category);
        await supabase
          .from("crm_leads")
          .update({ tags, updated_at: new Date().toISOString() })
          .eq("id", conversation.lead_id);
      }

      if (
        behaviorModes.includes("sentiment_analysis") &&
        (payload.sentiment === "negative" || payload.urgency === "high")
      ) {
        await supabase
          .from("crm_conversations")
          .update({
            status: "human_handling",
            ai_enabled: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversationId);

        await supabase
          .from("crm_leads")
          .update({
            conversation_status: "transferencia_pendente",
            attendance_owner: "humano_loja",
            handoff_at: new Date().toISOString(),
            last_agent_type: "alana",
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversation.lead_id);

        await logCRMEvent({
          supabase,
          storeId: String(conversation.store_id),
          eventType: "ai_escalation",
          payload: {
            conversation_id: conversationId,
            reason: payload.sentiment === "negative" ? "negative_sentiment" : "high_urgency",
            sentiment: payload.sentiment,
            urgency: payload.urgency,
          },
          channelId: sanitizeText(conversation.channel_id),
          leadId: String(conversation.lead_id),
          conversationId,
        });
      } else if (behaviorModes.includes("auto_response") && aiConfig.auto_send_response) {
        const metadata = asRecord(payload.metadata);
        const channelId = String(metadata.channel_id || metadata.channelId || conversation.channel_id || "").trim();
        const sendUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/crm-send-message`;
        const sendResponse = await fetch(sendUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            conversationId,
            leadId: conversation.lead_id,
            channelId,
            content: payload.response_text,
            senderType: "ai_inbound",
          }),
        });

        if (sendResponse.ok) {
          messageSent = true;
        } else {
          const rawError = await sendResponse.text();
          let errorPayload: Record<string, unknown> = {};
          try {
            errorPayload = asRecord(JSON.parse(rawError));
          } catch {
            errorPayload = { raw: rawError };
          }
          const code = String(asRecord(errorPayload.error).code || errorPayload.code || "").trim();
          if (sendResponse.status !== 409 || code !== "human_assumed_during_ai_response") {
            throw new Error(`crm-send-message failed: ${sendResponse.status} ${rawError}`);
          }
        }
      } else {
        await supabase
          .from("crm_conversations")
          .update({
            metadata: {
              ai_suggested_response: payload.response_text,
              ai_confidence: payload.confidence_score ?? null,
              suggested_at: new Date().toISOString(),
            },
          })
          .eq("id", conversationId);
      }

      await supabase
        .from("crm_ai_agent_configs")
        .update({
          total_invocations: (aiConfig.total_invocations ?? 0) + 1,
          total_successes: (aiConfig.total_successes ?? 0) + 1,
        })
        .eq("id", aiConfig.id);

      await supabase
        .from("crm_ai_agent_invocations")
        .insert({
          store_id: conversation.store_id,
          agent_config_id: aiConfig.id,
          source: "inbound",
          status: "success",
          routing_reason: routingDecision.reason,
          metadata: {
            conversation_id: conversationId,
            lead_id: payload.lead_id ?? conversation.lead_id,
            message_sent: messageSent,
            intent: payload.intent ?? null,
            sentiment: payload.sentiment ?? null,
            urgency: payload.urgency ?? null,
          },
        });
    }

    return jsonResponse({
      success: true,
      message_sent: messageSent,
      actions_performed: {
        auto_response: messageSent,
        lead_qualified: Boolean(payload.lead_qualification),
        sentiment_analyzed: Boolean(payload.sentiment),
        response_suggested: Boolean(payload.response_text && !messageSent),
      },
    });
  } catch (error: unknown) {
    console.error("AI inbound error:", error);
    return jsonResponse({
      error: error instanceof Error ? error.message : String(error || "ai_inbound_error"),
    }, 500);
  }
});
