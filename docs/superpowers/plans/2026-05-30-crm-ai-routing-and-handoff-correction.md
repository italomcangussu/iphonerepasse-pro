# CRM AI Routing And Handoff Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct CRM AI routing so inbound leads resolve to a clear human or AI owner, channel webhooks are the operational endpoint, and summaries are only written through the N8N lead/state contract.

**Architecture:** Add an explicit channel routing override and a focused shared routing helper used by inbound webhooks. Keep the channel webhook as the live AI endpoint, remove confusing agent endpoint/approval UI, and make manual handoff send session context without writing lead summaries. Use a migration for schema and conservative data cleanup.

**Tech Stack:** Supabase Postgres migrations, Supabase Edge Functions in Deno/TypeScript, React/Vite, Vitest, Deno tests, Supabase CLI guarded by local `.env.local`.

---

### Task 1: Migration For Routing, Summary Cleanup, And Lead Memory Upsert

**Files:**
- Create: `supabase/migrations/20260530120000_crm_ai_routing_correction.sql`
- Test: `tests/crm-ai-routing-correction-migration.test.ts`

- [ ] **Step 1: Write the migration contract test**

Create `tests/crm-ai-routing-correction-migration.test.ts` with assertions that the migration includes:

```ts
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(process.cwd(), "supabase/migrations/20260530120000_crm_ai_routing_correction.sql");
const sql = fs.readFileSync(migrationPath, "utf8");

describe("CRM AI routing correction migration", () => {
  it("adds channel AI entry mode and constrains values", () => {
    expect(sql).toContain("add column if not exists ai_entry_mode text not null default 'inherit'");
    expect(sql).toContain("chk_crm_channels_ai_entry_mode");
    expect(sql).toContain("'inherit', 'force_ai', 'force_human'");
  });

  it("cleans AI ownership and generic summaries conservatively", () => {
    expect(sql).toContain("crm_ai_unavailable_fallback");
    expect(sql).toContain("summary_short = null");
    expect(sql).toContain("summary_operational = null");
    expect(sql).toContain("conversation_status = 'em_atendimento_humano'");
  });

  it("allows crm-leads-api to update official lead memory", () => {
    expect(sql).toContain("create or replace function public.update_lead_memory");
    expect(sql).toContain("p_summary_short");
    expect(sql).toContain("p_summary_operational");
  });
});
```

- [ ] **Step 2: Run the migration contract test and verify it fails**

Run: `npm run test:run -- tests/crm-ai-routing-correction-migration.test.ts`

Expected: FAIL because the migration file does not exist yet.

- [ ] **Step 3: Create the migration**

Create `supabase/migrations/20260530120000_crm_ai_routing_correction.sql` with:

```sql
begin;

alter table public.crm_channels
  add column if not exists ai_entry_mode text not null default 'inherit';

alter table public.crm_channels drop constraint if exists chk_crm_channels_ai_entry_mode;
alter table public.crm_channels add constraint chk_crm_channels_ai_entry_mode check (
  ai_entry_mode in ('inherit', 'force_ai', 'force_human')
);

insert into public.crm_ai_entry_settings (store_id, is_enabled, fallback_mode, reopen_hours, business_hours, special_business_hours)
select s.id, true, 'force_human', 24, '{}'::jsonb, '{}'::jsonb
from public.stores s
on conflict (store_id) do update
set
  is_enabled = true,
  fallback_mode = case
    when public.crm_ai_entry_settings.fallback_mode in ('force_ai', 'force_human') then public.crm_ai_entry_settings.fallback_mode
    else 'force_human'
  end,
  updated_at = now();

create or replace function public.update_lead_memory(
  p_lead_id text,
  p_summary_short text default null,
  p_summary_operational text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.crm_leads%rowtype;
begin
  if p_lead_id is null or btrim(p_lead_id) = '' then
    raise exception 'lead_id is required';
  end if;

  update public.crm_leads
  set
    summary_short = case when nullif(btrim(coalesce(p_summary_short, '')), '') is not null then btrim(p_summary_short) else summary_short end,
    summary_operational = case when nullif(btrim(coalesce(p_summary_operational, '')), '') is not null then btrim(p_summary_operational) else summary_operational end,
    updated_at = now()
  where id = p_lead_id
  returning * into v_lead;

  if v_lead.id is null then
    raise exception 'Lead not found: %', p_lead_id;
  end if;

  return jsonb_build_object(
    'lead_id', v_lead.id,
    'summary_short', v_lead.summary_short,
    'summary_operational', v_lead.summary_operational
  );
end;
$$;

revoke all on function public.update_lead_memory(text, text, text) from public, anon, authenticated;
grant execute on function public.update_lead_memory(text, text, text) to authenticated;

with invalid_ai as (
  select c.id, c.store_id, c.lead_id, c.channel_id
  from public.crm_conversations c
  left join public.crm_channels ch on ch.id = c.channel_id
  where c.status = 'ai_handling'
    and (
      ch.id is null
      or ch.ai_resume_webhook_url is null
      or btrim(ch.ai_resume_webhook_url) = ''
      or lower(btrim(ch.ai_resume_webhook_url)) not like 'https://%'
    )
),
logged as (
  insert into public.crm_event_log (
    store_id,
    event_type,
    payload,
    is_outbound,
    channel_id,
    lead_id,
    conversation_id
  )
  select
    invalid_ai.store_id,
    'crm_ai_unavailable_fallback',
    jsonb_build_object(
      'reason', 'migration_invalid_ai_webhook',
      'conversation_id', invalid_ai.id,
      'channel_id', invalid_ai.channel_id
    ),
    false,
    invalid_ai.channel_id,
    invalid_ai.lead_id,
    invalid_ai.id
  from invalid_ai
  returning conversation_id
)
update public.crm_conversations c
set status = 'human_handling',
    ai_enabled = false,
    updated_at = now()
where c.id in (select id from invalid_ai);

update public.crm_leads l
set
  conversation_status = 'em_atendimento_humano',
  attendance_owner = 'humano_loja',
  last_agent_type = case when l.last_agent_type = 'alana' then 'evento' else l.last_agent_type end,
  updated_at = now()
from public.crm_conversations c
where c.lead_id = l.id
  and c.status <> 'ai_handling'
  and (
    l.conversation_status = 'em_atendimento_ia'
    or l.attendance_owner = 'ia'
  );

update public.crm_leads
set
  summary_short = null,
  updated_at = now()
where summary_short is not null
  and summary_short ~* '^[^|]+\\s*\\|\\s*\\+?[0-9][0-9\\s().-]*\\s*\\|\\s*etapa:\\s*';

update public.crm_leads
set
  summary_operational = null,
  updated_at = now()
where summary_operational is not null
  and summary_operational ~* '^lead:\\s*.+\\s*\\|\\s*etapa:\\s*';

commit;
```

- [ ] **Step 4: Run the migration contract test and smoke migration test**

Run:

```bash
npm run test:run -- tests/crm-ai-routing-correction-migration.test.ts
npm run smoke:migrations
```

Expected: PASS for both commands.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260530120000_crm_ai_routing_correction.sql tests/crm-ai-routing-correction-migration.test.ts
git commit -m "feat: add crm ai routing migration"
```

### Task 2: Shared AI Routing Helper

**Files:**
- Create: `supabase/functions/_shared/crm_ai_routing.ts`
- Test: `supabase/functions/_shared/crm_ai_routing.test.ts`

- [ ] **Step 1: Write Deno tests for routing decisions**

Create `supabase/functions/_shared/crm_ai_routing.test.ts` covering:

```ts
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { resolveAiRoutingDecision } from "./crm_ai_routing.ts";

Deno.test("channel force_human overrides store force_ai", async () => {
  const decision = await resolveAiRoutingDecision({
    supabase: fakeSupabase({ channelMode: "force_human", fallbackMode: "force_ai", webhook: "https://ai.example/hook" }),
    storeId: "store-1",
    channelId: "channel-1",
    conversationId: "conv-1",
    leadId: "lead-1",
  });
  assertEquals(decision.target, "human");
  assertEquals(decision.reason, "channel_force_human");
});

Deno.test("channel inherit uses store force_ai with valid webhook", async () => {
  const decision = await resolveAiRoutingDecision({
    supabase: fakeSupabase({ channelMode: "inherit", fallbackMode: "force_ai", webhook: "https://ai.example/hook" }),
    storeId: "store-1",
    channelId: "channel-1",
    conversationId: "conv-1",
    leadId: "lead-1",
  });
  assertEquals(decision.target, "ai");
  assertEquals(decision.webhookUrl, "https://ai.example/hook");
});

Deno.test("AI without HTTPS webhook falls back to human", async () => {
  const decision = await resolveAiRoutingDecision({
    supabase: fakeSupabase({ channelMode: "force_ai", fallbackMode: "force_human", webhook: "http://bad.example/hook" }),
    storeId: "store-1",
    channelId: "channel-1",
    conversationId: "conv-1",
    leadId: "lead-1",
  });
  assertEquals(decision.target, "human");
  assertEquals(decision.reason, "ai_unavailable_invalid_webhook");
});
```

Include a local `fakeSupabase` helper in the test that returns rows for `crm_channels`, `crm_ai_entry_settings`, and captures inserts into `crm_event_log`.

- [ ] **Step 2: Run tests and verify failure**

Run: `deno test --allow-env supabase/functions/_shared/crm_ai_routing.test.ts`

Expected: FAIL because `crm_ai_routing.ts` does not exist.

- [ ] **Step 3: Implement routing helper**

Create `supabase/functions/_shared/crm_ai_routing.ts` exporting:

```ts
export type AiRoutingTarget = "ai" | "human";

export type AiRoutingDecision = {
  target: AiRoutingTarget;
  reason: string;
  channelMode: "inherit" | "force_ai" | "force_human";
  storeFallbackMode: "force_ai" | "force_human";
  webhookUrl: string | null;
};

export async function resolveAiRoutingDecision(args: {
  supabase: any;
  storeId: string;
  channelId: string;
  conversationId?: string | null;
  leadId?: string | null;
}): Promise<AiRoutingDecision>;

export async function applyAiRoutingDecision(args: {
  supabase: any;
  decision: AiRoutingDecision;
  conversationId: string;
  leadId: string;
  storeId: string;
  channelId: string;
}): Promise<void>;
```

Implementation details:

- Fetch `crm_channels.ai_entry_mode, ai_resume_webhook_url`.
- Fetch `crm_ai_entry_settings.fallback_mode`.
- Normalize unsupported/empty fallback to `force_human`.
- Return `human` for `force_human`.
- Return `ai` only when final mode is `force_ai` and webhook starts with `https://`.
- Return `human` with reason `ai_unavailable_invalid_webhook` when final mode is AI but webhook is unavailable.
- `applyAiRoutingDecision` updates `crm_conversations`, updates `crm_leads`, logs `crm_ai_routing_decision`, and logs `crm_ai_unavailable_fallback` when applicable.

- [ ] **Step 4: Run Deno routing tests**

Run: `deno test --allow-env supabase/functions/_shared/crm_ai_routing.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/crm_ai_routing.ts supabase/functions/_shared/crm_ai_routing.test.ts
git commit -m "feat: add crm ai routing helper"
```

### Task 3: Apply Routing In UAZ Inbound And AI Dispatch

**Files:**
- Modify: `supabase/functions/crm-uaz-webhook-receiver/index.ts`
- Modify: `supabase/functions/_shared/crm_ai_inbound_dispatch.ts`
- Test: `supabase/functions/_shared/crm_ai_inbound_dispatch.test.ts`

- [ ] **Step 1: Add/adjust tests**

Extend dispatch tests to assert skipped invalid webhook logs `crm_ai_unavailable_fallback` when the routing helper has already selected AI but webhook is invalid, and keep the existing valid webhook dispatch test.

- [ ] **Step 2: Update UAZ inbound webhook**

Replace the current `runAutoAIEntryForInbound` call with:

```ts
const decision = await resolveAiRoutingDecision({
  supabase,
  storeId,
  channelId: String(channel.id),
  conversationId: String(conversation.id),
  leadId: resolvedLeadId,
});
await applyAiRoutingDecision({
  supabase,
  decision,
  conversationId: String(conversation.id),
  leadId: resolvedLeadId,
  storeId,
  channelId: String(channel.id),
});
if (decision.target === "ai") {
  await dispatchAiInboundIfEligible(...);
}
```

Keep `fromMe` behavior as human-owned.

- [ ] **Step 3: Run Deno tests**

Run:

```bash
deno test --allow-env --allow-net supabase/functions/_shared/crm_ai_routing.test.ts supabase/functions/_shared/crm_ai_inbound_dispatch.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/crm-uaz-webhook-receiver/index.ts supabase/functions/_shared/crm_ai_inbound_dispatch.ts supabase/functions/_shared/crm_ai_inbound_dispatch.test.ts
git commit -m "feat: route crm inbound ownership"
```

### Task 4: Correct Manual Handoff And AI Inbound Summary Behavior

**Files:**
- Modify: `supabase/functions/crm-conversation-handoff/index.ts`
- Modify: `supabase/functions/crm-ai-inbound/index.ts`
- Modify: `supabase/functions/crm-leads-api/index.ts`
- Test: `supabase/functions/crm-ai-inbound/index.contract.test.ts`
- Test: `supabase/functions/crm-send-message/index.contract.test.ts`
- Test: `supabase/functions/crm-leads-api/crm-leads-enrichment-schema.test.ts`

- [ ] **Step 1: Update tests/contracts**

Assertions:

- `crm-ai-inbound` source contains `legacy_summary_fields_ignored` and does not call `.update(summaryPatch)` for `summary_short`.
- `crm-conversation-handoff` source no longer writes `summary_short` or `summary_operational` to `crm_leads`.
- `crm-leads-api` allows action `update_memory` and calls RPC `update_lead_memory`.

- [ ] **Step 2: Update `crm-ai-inbound`**

Remove the lead summary update block. If payload contains either summary field, log `crm_ai_inbound_legacy_summary_ignored` with `conversation_id` and booleans for which fields were present.

- [ ] **Step 3: Update `crm-conversation-handoff`**

For target AI:

- collect inbound customer messages from session start/current day;
- build joined text from content or media placeholders;
- include structured `conversation_context`;
- do not update lead summaries;
- update lead/conversation to AI after webhook validation and before/around dispatch as current flow requires.

- [ ] **Step 4: Update `crm-leads-api`**

Add action `update_memory`:

```ts
if (action === "update_memory") {
  const leadId = sanitizeText(payload.lead_id || payload.leadId);
  if (!leadId) return jsonResponse({ error: "lead_id é obrigatório." }, 400);
  const { data, error } = await supabase.rpc("update_lead_memory", {
    p_lead_id: leadId,
    p_summary_short: sanitizeText(payload.summary_short || payload.summaryShort),
    p_summary_operational: sanitizeText(payload.summary_operational || payload.summaryOperational),
  });
  if (error) return jsonResponse({ error: error.message }, 500);
  return jsonResponse({ success: true, data });
}
```

- [ ] **Step 5: Run function contract tests**

Run:

```bash
npm run test:run -- supabase/functions/crm-ai-inbound/index.contract.test.ts supabase/functions/crm-send-message/index.contract.test.ts supabase/functions/crm-leads-api/crm-leads-enrichment-schema.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/crm-conversation-handoff/index.ts supabase/functions/crm-ai-inbound/index.ts supabase/functions/crm-leads-api/index.ts supabase/functions/crm-ai-inbound/index.contract.test.ts supabase/functions/crm-send-message/index.contract.test.ts supabase/functions/crm-leads-api/crm-leads-enrichment-schema.test.ts
git commit -m "feat: correct crm ai handoff memory flow"
```

### Task 5: Update Channel And Agent Settings UI

**Files:**
- Modify: `types.ts`
- Modify: `pages/CRMChannels.tsx`
- Modify: `pages/CRMChannels.test.tsx`
- Modify: `pages/crm/AISettingsPage.tsx`
- Test: `pages/CRMChannels.test.tsx`

- [ ] **Step 1: Add frontend tests**

Extend `pages/CRMChannels.test.tsx` to verify:

- store default routing control is rendered;
- channel routing mode is saved in `ai_entry_mode`;
- AI webhook readiness appears.

- [ ] **Step 2: Update types and channel mapping**

Add `aiEntryMode?: 'inherit' | 'force_ai' | 'force_human'` to `CRMChannel`, map `raw.ai_entry_mode`, and save `ai_entry_mode` in channel payload.

- [ ] **Step 3: Add store default control**

Load `crm_ai_entry_settings` for `selectedStoreId`, display a compact control at the top of `CRMChannels`, and save `fallback_mode` as `force_ai` or `force_human`.

- [ ] **Step 4: Add channel routing control**

In channel modal add a select:

- `inherit`: Herdar padrão da loja
- `force_ai`: IA
- `force_human`: Humano

Show readiness text based on selected effective mode and webhook HTTPS validity.

- [ ] **Step 5: Remove confusing AI Settings controls**

From `pages/crm/AISettingsPage.tsx`, remove:

- endpoint field;
- endpoint test button;
- human approval checkbox;
- saving `endpoint_url`;
- saving `require_human_approval`.

- [ ] **Step 6: Run UI tests**

Run:

```bash
npm run test:run -- pages/CRMChannels.test.tsx pages/crm/ConversationsPage.ai-handoff.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add types.ts pages/CRMChannels.tsx pages/CRMChannels.test.tsx pages/crm/AISettingsPage.tsx
git commit -m "feat: add crm channel ai routing controls"
```

### Task 6: Full Verification And Supabase Deployment

**Files:**
- Read: `.env.local`
- Read: `supabase/config.toml`
- Use: `/Users/italomendescangussu/.codex/skills/supabase-cli-mcp-guardrails/scripts/local_supabase_env.py`
- Use: `/Users/italomendescangussu/.codex/skills/supabase-cli-mcp-guardrails/scripts/with_local_supabase_env.sh`

- [ ] **Step 1: Run local verification**

Run:

```bash
npm run test:run -- tests/crm-ai-routing-correction-migration.test.ts pages/CRMChannels.test.tsx supabase/functions/crm-ai-inbound/index.contract.test.ts supabase/functions/crm-send-message/index.contract.test.ts supabase/functions/crm-leads-api/crm-leads-enrichment-schema.test.ts
npm run typecheck
npm run smoke:migrations
```

Expected: PASS.

- [ ] **Step 2: Validate Supabase local identity**

Run:

```bash
ROOT="$(git rev-parse --show-toplevel)"
python3 "/Users/italomendescangussu/.codex/skills/supabase-cli-mcp-guardrails/scripts/local_supabase_env.py" --project-root "$ROOT" --format summary
```

Expected: summary resolves `.env.local`, masks secrets, and project ref matches `supabase/config.toml`.

- [ ] **Step 3: Apply migrations with guarded environment**

Run:

```bash
ROOT="$(git rev-parse --show-toplevel)"
"/Users/italomendescangussu/.codex/skills/supabase-cli-mcp-guardrails/scripts/with_local_supabase_env.sh" --project-root "$ROOT" -- supabase db push
```

Expected: migration applies to the validated project.

- [ ] **Step 4: Deploy changed Edge Functions**

Run:

```bash
ROOT="$(git rev-parse --show-toplevel)"
"/Users/italomendescangussu/.codex/skills/supabase-cli-mcp-guardrails/scripts/with_local_supabase_env.sh" --project-root "$ROOT" -- supabase functions deploy crm-uaz-webhook-receiver crm-conversation-handoff crm-ai-inbound crm-leads-api
```

Expected: all four functions deploy successfully.

- [ ] **Step 5: Commit final verification/deploy note if files changed**

If only deployment occurred and no files changed, no commit is needed. If verification required file edits:

```bash
git status --short
git add <changed-files>
git commit -m "chore: verify crm ai routing deployment"
```
