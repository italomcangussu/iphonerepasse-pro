export type AiEntryMode = "inherit" | "force_ai" | "force_human";
export type StoreFallbackMode = "force_ai" | "force_human";
export type AiRoutingTarget = "ai" | "human";

export type AiRoutingDecision = {
  target: AiRoutingTarget;
  reason: string;
  channelMode: AiEntryMode;
  storeFallbackMode: StoreFallbackMode;
  webhookUrl: string | null;
};

const normalizeChannelMode = (value: unknown): AiEntryMode => {
  const normalized = String(value || "").trim();
  if (normalized === "force_ai" || normalized === "force_human") return normalized;
  return "inherit";
};

const normalizeStoreFallbackMode = (value: unknown): StoreFallbackMode => {
  const normalized = String(value || "").trim();
  if (normalized === "force_ai") return "force_ai";
  return "force_human";
};

const normalizeWebhookUrl = (value: unknown): string | null => {
  const normalized = String(value || "").trim();
  return normalized || null;
};

const hasValidAiWebhook = (value: string | null): boolean => Boolean(value?.startsWith("https://"));

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

async function safeLog(args: {
  supabase: any;
  storeId: string;
  eventType: string;
  payload: Record<string, unknown>;
  channelId: string;
  leadId?: string | null;
  conversationId?: string | null;
}) {
  try {
    await args.supabase.from("crm_event_log").insert({
      store_id: args.storeId,
      event_type: args.eventType,
      payload: args.payload,
      is_outbound: false,
      channel_id: args.channelId,
      lead_id: args.leadId ?? null,
      conversation_id: args.conversationId ?? null,
    });
  } catch (error) {
    console.warn(`[crm_ai_routing] failed to log ${args.eventType}:`, error);
  }
}

export async function resolveAiRoutingDecision(args: {
  supabase: any;
  storeId: string;
  channelId: string;
  conversationId?: string | null;
  leadId?: string | null;
}): Promise<AiRoutingDecision> {
  const [channelResult, settingsResult] = await Promise.all([
    args.supabase
      .from("crm_channels")
      .select("ai_entry_mode, ai_resume_webhook_url")
      .eq("id", args.channelId)
      .maybeSingle(),
    args.supabase
      .from("crm_ai_entry_settings")
      .select("fallback_mode")
      .eq("store_id", args.storeId)
      .maybeSingle(),
  ]);

  const channel = asRecord(channelResult?.data);
  const settings = asRecord(settingsResult?.data);
  const channelMode = normalizeChannelMode(channel.ai_entry_mode);
  const storeFallbackMode = normalizeStoreFallbackMode(settings.fallback_mode);
  const webhookUrl = normalizeWebhookUrl(channel.ai_resume_webhook_url);
  const finalMode = channelMode === "inherit" ? storeFallbackMode : channelMode;

  if (finalMode === "force_human") {
    return {
      target: "human",
      reason: channelMode === "force_human" ? "channel_force_human" : "store_force_human",
      channelMode,
      storeFallbackMode,
      webhookUrl,
    };
  }

  if (!hasValidAiWebhook(webhookUrl)) {
    return {
      target: "human",
      reason: "ai_unavailable_invalid_webhook",
      channelMode,
      storeFallbackMode,
      webhookUrl,
    };
  }

  return {
    target: "ai",
    reason: channelMode === "force_ai" ? "channel_force_ai" : "store_force_ai",
    channelMode,
    storeFallbackMode,
    webhookUrl,
  };
}

export async function applyAiRoutingDecision(args: {
  supabase: any;
  decision: AiRoutingDecision;
  conversationId: string;
  leadId: string;
  storeId: string;
  channelId: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const aiOwned = args.decision.target === "ai";

  await args.supabase
    .from("crm_conversations")
    .update({
      status: aiOwned ? "ai_handling" : "human_handling",
      ai_enabled: aiOwned,
      updated_at: now,
    })
    .eq("id", args.conversationId);

  await args.supabase
    .from("crm_leads")
    .update({
      conversation_status: aiOwned ? "em_atendimento_ia" : "em_atendimento_humano",
      attendance_owner: aiOwned ? "ia" : "humano_loja",
      ...(aiOwned ? { handoff_at: now } : { human_started_at: now }),
      last_agent_type: aiOwned ? "alana" : "humano",
      updated_at: now,
    })
    .eq("id", args.leadId);

  const payload = {
    conversation_id: args.conversationId,
    lead_id: args.leadId,
    channel_id: args.channelId,
    target: args.decision.target,
    reason: args.decision.reason,
    channel_mode: args.decision.channelMode,
    store_fallback_mode: args.decision.storeFallbackMode,
    has_valid_ai_webhook: hasValidAiWebhook(args.decision.webhookUrl),
  };

  await safeLog({
    supabase: args.supabase,
    storeId: args.storeId,
    eventType: "crm_ai_routing_decision",
    payload,
    channelId: args.channelId,
    leadId: args.leadId,
    conversationId: args.conversationId,
  });

  if (args.decision.reason === "ai_unavailable_invalid_webhook") {
    await safeLog({
      supabase: args.supabase,
      storeId: args.storeId,
      eventType: "crm_ai_unavailable_fallback",
      payload,
      channelId: args.channelId,
      leadId: args.leadId,
      conversationId: args.conversationId,
    });
  }
}

export const __private__ = {
  hasValidAiWebhook,
  normalizeChannelMode,
  normalizeStoreFallbackMode,
};
