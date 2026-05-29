export type AutoAIEntryResult = {
  handled: boolean;
  reason: string;
  scope?: "first_contact" | "reopen" | null;
  matchedRuleId?: string | null;
};

export type AutoAIEntryArgs = {
  supabase: any;
  conversationId: string;
  storeId: string;
  channelId: string;
  leadId: string;
  eventOrigin?: string | null;
  isFromMe?: boolean;
  senderType?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function ruleMatches(args: {
  rule: Record<string, unknown>;
  channelId: string;
  lead: Record<string, unknown>;
}): boolean {
  const conditions = asRecord(args.rule.conditions);
  const channelIds = normalizeStringArray(conditions.channelIds);
  if (channelIds.length > 0 && !channelIds.includes(args.channelId)) return false;

  const requiredTagsAny = normalizeStringArray(conditions.requiredTagsAny);
  if (requiredTagsAny.length > 0) {
    const tags = normalizeStringArray(args.lead.tags);
    if (!requiredTagsAny.some((tag) => tags.includes(tag))) return false;
  }

  const funnelStages = normalizeStringArray(conditions.funnelStages);
  if (funnelStages.length > 0) {
    const funnelStage = String(args.lead.funnel_stage || "").trim();
    if (!funnelStages.includes(funnelStage)) return false;
  }

  return true;
}

export async function runAutoAIEntryForInbound(args: AutoAIEntryArgs): Promise<AutoAIEntryResult> {
  if (args.isFromMe) return { handled: false, reason: "from_me" };
  if (args.senderType && args.senderType !== "customer") return { handled: false, reason: "not_customer" };
  if (args.eventOrigin === "reaction") return { handled: false, reason: "reaction" };

  const { data: settings } = await args.supabase
    .from("crm_ai_entry_settings")
    .select("is_enabled, fallback_mode, rules")
    .eq("store_id", args.storeId)
    .maybeSingle();

  const settingsRow = asRecord(settings);
  if (settingsRow.is_enabled !== true) return { handled: false, reason: "settings_disabled" };

  const { data: conversation } = await args.supabase
    .from("crm_conversations")
    .select("status, ai_enabled")
    .eq("id", args.conversationId)
    .maybeSingle();

  const conv = asRecord(conversation);
  if (conv.status === "ai_handling" && conv.ai_enabled === true) {
    return { handled: false, reason: "already_ai_handling" };
  }

  const { data: lead } = await args.supabase
    .from("crm_leads")
    .select("id, tags, funnel_stage, is_customer")
    .eq("id", args.leadId)
    .maybeSingle();

  const leadRow = asRecord(lead);
  const rules = Array.isArray(settingsRow.rules) ? settingsRow.rules as Record<string, unknown>[] : [];
  const sortedRules = [...rules].sort((left, right) => Number(left.priority ?? 100) - Number(right.priority ?? 100));
  const matchedRule = sortedRules.find((rule) => String(rule.action || "enable_ai") === "enable_ai" && ruleMatches({
    rule,
    channelId: args.channelId,
    lead: leadRow,
  }));

  const fallbackMode = String(settingsRow.fallback_mode || "keep_current");
  const shouldForceAi = fallbackMode === "force_ai" || Boolean(matchedRule);
  if (!shouldForceAi) return { handled: false, reason: "no_matching_rule" };

  await args.supabase
    .from("crm_conversations")
    .update({
      status: "ai_handling",
      ai_enabled: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.conversationId);

  return {
    handled: true,
    reason: matchedRule ? "matched_rule" : "fallback_force_ai",
    scope: String(matchedRule?.scope || "reopen") as "first_contact" | "reopen",
    matchedRuleId: matchedRule?.id ? String(matchedRule.id) : null,
  };
}
