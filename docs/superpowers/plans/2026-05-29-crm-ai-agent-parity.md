# CRM AI Agent Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add near-parity CRM AI agent handling to `iphonerepasse-pro`, using the same n8n/webhook pattern as `warrantyguard-hdi`.

**Architecture:** Implement the feature in vertical layers: database contract first, then shared edge helpers, edge functions, webhook dispatch, frontend configuration, frontend conversation ownership UI, and verification/deploy. Existing CRM behavior remains the default path; AI-specific behavior is gated by `ai_enabled`, `status='ai_handling'`, and channel `ai_resume_webhook_url`.

**Tech Stack:** Supabase Postgres migrations, Supabase Edge Functions on Deno, React/Vite/TypeScript, Vitest, Tailwind utility classes, Supabase CLI guarded by local `.env.local`/`.env`.

---

### Task 1: Database Contract

**Files:**
- Create: `supabase/migrations/20260529130000_crm_ai_agent_parity.sql`
- Test: `tests/crm-ai-agent-parity-migration.test.ts`

- [ ] **Step 1: Write migration contract test**

Create `tests/crm-ai-agent-parity-migration.test.ts` with assertions that the migration contains:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const sql = readFileSync('supabase/migrations/20260529130000_crm_ai_agent_parity.sql', 'utf8');

describe('CRM AI agent parity migration', () => {
  it('adds channel webhook, AI config, invocation, and ownership contracts', () => {
    expect(sql).toContain('ai_resume_webhook_url');
    expect(sql).toContain('create table if not exists public.crm_ai_entry_settings');
    expect(sql).toContain('create table if not exists public.crm_ai_agent_invocations');
    expect(sql).toContain('conversation_status');
    expect(sql).toContain('attendance_owner');
    expect(sql).toContain('human_started_at');
    expect(sql).toContain('ai_inbound');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/crm-ai-agent-parity-migration.test.ts`

Expected: fail because the migration file does not exist.

- [ ] **Step 3: Add migration**

Create `supabase/migrations/20260529130000_crm_ai_agent_parity.sql` with idempotent DDL:

```sql
begin;

alter table public.crm_channels
  add column if not exists ai_resume_webhook_url text;

alter table public.crm_leads
  add column if not exists conversation_status text,
  add column if not exists attendance_owner text,
  add column if not exists handoff_at timestamptz,
  add column if not exists human_started_at timestamptz,
  add column if not exists last_agent_type text;

update public.crm_leads
set
  attendance_owner = coalesce(nullif(btrim(attendance_owner), ''), 'ia'),
  conversation_status = coalesce(nullif(btrim(conversation_status), ''), 'em_atendimento_ia'),
  last_agent_type = coalesce(nullif(btrim(last_agent_type), ''), 'evento')
where attendance_owner is null
   or btrim(attendance_owner) = ''
   or conversation_status is null
   or btrim(conversation_status) = ''
   or last_agent_type is null
   or btrim(last_agent_type) = '';

alter table public.crm_leads drop constraint if exists chk_crm_leads_conversation_status;
alter table public.crm_leads add constraint chk_crm_leads_conversation_status check (
  conversation_status is null or conversation_status in (
    'em_atendimento_ia',
    'em_atendimento_humano',
    'transferencia_pendente',
    'encerrado'
  )
);

alter table public.crm_leads drop constraint if exists chk_crm_leads_attendance_owner;
alter table public.crm_leads add constraint chk_crm_leads_attendance_owner check (
  attendance_owner is null or attendance_owner in ('ia', 'humano_loja', 'tecnico_especialista')
);

alter table public.crm_leads drop constraint if exists chk_crm_leads_last_agent_type;
alter table public.crm_leads add constraint chk_crm_leads_last_agent_type check (
  last_agent_type is null or last_agent_type in ('classifier', 'alana', 'evento', 'humano')
);

alter table public.crm_messages drop constraint if exists crm_messages_sender_type_check;
alter table public.crm_messages add constraint crm_messages_sender_type_check check (
  sender_type in ('customer', 'human', 'ai', 'ai_inbound', 'system')
);

create table if not exists public.crm_ai_entry_settings (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores(id) on delete cascade,
  is_enabled boolean not null default false,
  fallback_mode text not null default 'keep_current',
  reopen_hours integer not null default 24,
  business_hours jsonb not null default '{}'::jsonb,
  special_business_hours jsonb not null default '{}'::jsonb,
  rules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id),
  constraint crm_ai_entry_settings_fallback_mode_check check (fallback_mode in ('keep_current', 'force_human', 'force_ai')),
  constraint crm_ai_entry_settings_reopen_hours_check check (reopen_hours between 1 and 720)
);

alter table public.crm_ai_agent_configs
  add column if not exists endpoint_url text,
  add column if not exists behavior_modes text[] not null default '{}'::text[],
  add column if not exists auto_send_response boolean not null default false,
  add column if not exists require_human_approval boolean not null default true,
  add column if not exists trigger_conditions jsonb not null default '{}'::jsonb,
  add column if not exists channel_ids uuid[] not null default '{}'::uuid[],
  add column if not exists total_invocations integer not null default 0,
  add column if not exists total_successes integer not null default 0,
  add column if not exists total_failures integer not null default 0,
  add column if not exists routing_mode text not null default 'priority',
  add column if not exists routing_priority integer not null default 100,
  add column if not exists traffic_weight integer not null default 100;

create table if not exists public.crm_ai_agent_invocations (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores(id) on delete cascade,
  agent_config_id uuid references public.crm_ai_agent_configs(id) on delete set null,
  routing_rule_id uuid,
  source text not null default 'inbound',
  status text not null default 'success',
  routing_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint crm_ai_agent_invocations_source_check check (source in ('manual_test', 'inbound', 'manual_handoff')),
  constraint crm_ai_agent_invocations_status_check check (status in ('success', 'failure'))
);

create index if not exists idx_crm_channels_ai_resume_webhook
  on public.crm_channels (store_id)
  where ai_resume_webhook_url is not null and btrim(ai_resume_webhook_url) <> '';

create index if not exists idx_crm_ai_entry_settings_store_id
  on public.crm_ai_entry_settings(store_id);

create index if not exists idx_crm_ai_agent_invocations_agent_created
  on public.crm_ai_agent_invocations(agent_config_id, created_at desc);

create index if not exists idx_crm_ai_agent_invocations_store_created
  on public.crm_ai_agent_invocations(store_id, created_at desc);

alter table public.crm_ai_entry_settings enable row level security;
alter table public.crm_ai_agent_invocations enable row level security;

drop policy if exists crm_ai_entry_settings_store_scope on public.crm_ai_entry_settings;
create policy crm_ai_entry_settings_store_scope on public.crm_ai_entry_settings
  for all to authenticated
  using (public.crm_can_access_store(store_id))
  with check (public.crm_can_access_store(store_id));

drop policy if exists crm_ai_agent_invocations_store_read on public.crm_ai_agent_invocations;
create policy crm_ai_agent_invocations_store_read on public.crm_ai_agent_invocations
  for select to authenticated
  using (public.crm_can_access_store(store_id));

drop policy if exists crm_ai_agent_invocations_store_insert on public.crm_ai_agent_invocations;
create policy crm_ai_agent_invocations_store_insert on public.crm_ai_agent_invocations
  for insert to authenticated
  with check (public.crm_can_access_store(store_id));

grant all on public.crm_ai_entry_settings to authenticated;
grant select, insert on public.crm_ai_agent_invocations to authenticated;

create or replace function public.crm_sync_lead_attendance_from_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_owner text;
  v_last_agent text;
begin
  v_status := case
    when new.status = 'ai_handling' then 'em_atendimento_ia'
    when new.status = 'human_handling' then 'em_atendimento_humano'
    when new.status = 'closed' then 'encerrado'
    else null
  end;

  v_owner := case
    when new.status = 'ai_handling' then 'ia'
    when new.status = 'human_handling' then 'humano_loja'
    else null
  end;

  v_last_agent := case
    when new.status = 'ai_handling' then 'alana'
    when new.status = 'human_handling' then 'humano'
    else null
  end;

  update public.crm_leads l
  set
    conversation_status = coalesce(v_status, l.conversation_status),
    attendance_owner = coalesce(v_owner, l.attendance_owner),
    handoff_at = case
      when new.status = 'human_handling' and old.status = 'ai_handling' then coalesce(l.handoff_at, now())
      when new.status = 'ai_handling' then now()
      else l.handoff_at
    end,
    human_started_at = case
      when new.status = 'human_handling' then coalesce(l.human_started_at, now())
      else l.human_started_at
    end,
    last_agent_type = coalesce(v_last_agent, l.last_agent_type),
    updated_at = now()
  where l.id = new.lead_id;

  return new;
end;
$$;

drop trigger if exists trg_crm_sync_lead_attendance_from_conversation on public.crm_conversations;
create trigger trg_crm_sync_lead_attendance_from_conversation
after insert or update of status, ai_enabled on public.crm_conversations
for each row execute function public.crm_sync_lead_attendance_from_conversation();

commit;
```

- [ ] **Step 4: Run migration contract test**

Run: `npm test -- tests/crm-ai-agent-parity-migration.test.ts`

Expected: pass.

### Task 2: Shared AI Edge Helpers

**Files:**
- Create: `supabase/functions/_shared/crm_ai_inbound_dispatch.ts`
- Create: `supabase/functions/_shared/crm_ai_entry_engine.ts`
- Test: `supabase/functions/_shared/crm_ai_inbound_dispatch.test.ts`

- [ ] **Step 1: Write helper tests**

Create a small Deno test that verifies invalid URLs are skipped and eligible dispatch logs success.

- [ ] **Step 2: Implement helpers**

Port the reference helper shape with these exported functions:

```ts
export async function dispatchAiInboundIfEligible(args: AiInboundDispatchArgs): Promise<void>
export async function runAutoAIEntryForInbound(args: AutoAIEntryArgs): Promise<AutoAIEntryResult>
```

Keep dispatch non-blocking and log to `crm_event_log`.

- [ ] **Step 3: Run helper tests**

Run: `deno test --allow-env --allow-net supabase/functions/_shared/crm_ai_inbound_dispatch.test.ts`

Expected: pass.

### Task 3: AI Edge Functions

**Files:**
- Create: `supabase/functions/crm-ai-inbound/index.ts`
- Create: `supabase/functions/crm-ai-agent-test-endpoint/index.ts`
- Modify: `supabase/functions/crm-send-message/index.ts`
- Modify: `supabase/functions/crm-conversation-handoff/index.ts`
- Test: `supabase/functions/crm-ai-inbound/index.contract.test.ts`
- Test: `supabase/functions/crm-send-message/index.contract.test.ts`

- [ ] **Step 1: Add contract tests**

Tests should assert:

```ts
expect(source).toContain("sender_type");
expect(source).toContain("ai_inbound");
expect(source).toContain("human_assumed_during_ai_response");
expect(source).toContain("crm_ai_agent_invocations");
expect(source).toContain("target");
expect(source).toContain("ai_resume_webhook_url");
```

- [ ] **Step 2: Add `crm-ai-inbound`**

Implement callback handling:

- validate `conversation_id`;
- load conversation with lead;
- reject/skip if `ai_enabled=false`;
- select active config by channel and priority;
- call `crm-send-message` with service role and `sender_type='ai_inbound'`;
- escalate high urgency/negative sentiment to human pending state;
- insert invocation log.

- [ ] **Step 3: Add `crm-ai-agent-test-endpoint`**

Implement authenticated POST that loads an agent config, sends a sample payload to `endpoint_url`, records invocation, and returns status/body preview.

- [ ] **Step 4: Update `crm-send-message`**

Add optional body field:

```ts
senderType?: "human" | "ai" | "ai_inbound";
```

Use `human` by default. For `ai_inbound`, require service-role-style execution, confirm the conversation is still `ai_handling` and `ai_enabled=true`, and store sender type as `ai_inbound`.

- [ ] **Step 5: Update `crm-conversation-handoff`**

Support both old body shape and:

```ts
{ "conversation_id": "...", "target": "ai", "reason": "manual_handoff_to_ai" }
```

For `target='ai'`, validate channel webhook, gather last messages, update conversation to AI, POST manual handoff payload to webhook, and log `crm_manual_handoff_to_ai`.

- [ ] **Step 6: Run edge function contract tests**

Run:

```bash
deno test --allow-env --allow-net supabase/functions/crm-ai-inbound/index.contract.test.ts supabase/functions/crm-send-message/index.contract.test.ts
```

Expected: pass.

### Task 4: Provider Webhook AI Dispatch

**Files:**
- Modify: `supabase/functions/crm-uaz-webhook-receiver/index.ts`
- Modify: `supabase/functions/crm-instagram-webhook-receiver/index.ts`
- Test: `supabase/functions/crm-uaz-webhook-receiver/crm-uaz-webhook-receiver.deno.ts`

- [ ] **Step 1: Add imports**

Import:

```ts
import { dispatchAiInboundIfEligible } from "../_shared/crm_ai_inbound_dispatch.ts";
import { runAutoAIEntryForInbound } from "../_shared/crm_ai_entry_engine.ts";
```

- [ ] **Step 2: Call dispatcher after inbound message insert**

For non-`fromMe` and non-reaction messages, call `runAutoAIEntryForInbound` then `dispatchAiInboundIfEligible` with message/conversation/channel/lead details.

- [ ] **Step 3: Run existing webhook tests**

Run:

```bash
deno test --allow-env --allow-net supabase/functions/crm-uaz-webhook-receiver/crm-uaz-webhook-receiver.deno.ts
```

Expected: pass.

### Task 5: Frontend Channel And AI Configurator

**Files:**
- Modify: `types.ts`
- Modify: `pages/CRMChannels.tsx`
- Create: `pages/crm/AISettingsPage.tsx`
- Modify: `App.tsx`
- Modify: `components/crm/CRMStandaloneApp.tsx`
- Modify: `components/crm/crmPageMeta.ts`
- Modify: `components/crm/pageAccess.ts`
- Test: `pages/CRMChannels.test.tsx`

- [ ] **Step 1: Extend types**

Add `aiResumeWebhookUrl?: string | null` to `CRMChannel`.

- [ ] **Step 2: Add channel form field**

Map `ai_resume_webhook_url` in `mapChannel`, `channelToForm`, `DEFAULT_FORM`, and save payload. Add modal input labeled `Webhook de retomada da IA`.

- [ ] **Step 3: Add AI settings page**

Create a focused admin page that lists configs, edits endpoint/prompt/auto-send/channel links, runs test endpoint, and shows recent invocations.

- [ ] **Step 4: Wire routes/navigation metadata**

Add `/crm/ai-settings` in the main app and standalone CRM app, and add page metadata.

- [ ] **Step 5: Run frontend tests**

Run: `npm test -- pages/CRMChannels.test.tsx`

Expected: pass.

### Task 6: Frontend Conversation Ownership UI

**Files:**
- Modify: `pages/crm/ConversationsPage.tsx`
- Modify: `components/crm/MessageBubble.tsx`
- Test: `components/crm/MessageBubble.test.tsx`
- Test: `pages/crm/ConversationsPage.ai-handoff.test.tsx`

- [ ] **Step 1: Extend conversation row query**

Select lead fields `conversation_status`, `attendance_owner`, `human_started_at`, `last_agent_type` and channel `ai_resume_webhook_url`.

- [ ] **Step 2: Sort transfer-pending conversations first**

Use `crm_leads.conversation_status === 'transferencia_pendente'` as priority. Apply red pulsing row class and badge.

- [ ] **Step 3: Add header ownership controls**

Add buttons:

- `Assumir atendimento da IA`
- `Transferir para IA`
- `Configurar webhook IA`

Implement assume via conversation update and transfer via `crm-conversation-handoff`.

- [ ] **Step 4: Block composer when AI owns the conversation**

When `selectedConversation.status === 'ai_handling' || selectedConversation.ai_enabled === true`, show a blocked state unless the status is open but no AI webhook exists. The send handlers must also guard and show a toast.

- [ ] **Step 5: Preserve AI bubble styling**

Ensure `sender_type` containing `ai` renders the existing AI label and warm/orange visual tone.

- [ ] **Step 6: Run UI tests**

Run:

```bash
npm test -- components/crm/MessageBubble.test.tsx pages/crm/ConversationsPage.ai-handoff.test.tsx
```

Expected: pass.

### Task 7: Verification And Remote Supabase Apply

**Files:**
- No code files unless verification reveals a defect.

- [ ] **Step 1: Run local verification**

Run:

```bash
npm test -- tests/crm-ai-agent-parity-migration.test.ts pages/CRMChannels.test.tsx components/crm/MessageBubble.test.tsx
npm run build
```

Expected: pass.

- [ ] **Step 2: Supabase guardrail preflight**

Run:

```bash
python3 "/Users/italomendescangussu/.codex/skills/supabase-cli-mcp-guardrails/scripts/local_supabase_env.py" --project-root "$(git rev-parse --show-toplevel)" --format summary
```

Expected: local project ref matches `supabase/config.toml`.

- [ ] **Step 3: Apply migrations**

Run:

```bash
"/Users/italomendescangussu/.codex/skills/supabase-cli-mcp-guardrails/scripts/with_local_supabase_env.sh" --project-root "$(git rev-parse --show-toplevel)" -- supabase db push
```

Expected: pending migration applies to the validated project.

- [ ] **Step 4: Deploy edge functions**

Deploy:

```bash
"/Users/italomendescangussu/.codex/skills/supabase-cli-mcp-guardrails/scripts/with_local_supabase_env.sh" --project-root "$(git rev-parse --show-toplevel)" -- bash -lc 'supabase functions deploy crm-ai-inbound --project-ref "$SUPABASE_PROJECT_REF"'
"/Users/italomendescangussu/.codex/skills/supabase-cli-mcp-guardrails/scripts/with_local_supabase_env.sh" --project-root "$(git rev-parse --show-toplevel)" -- bash -lc 'supabase functions deploy crm-ai-agent-test-endpoint --project-ref "$SUPABASE_PROJECT_REF"'
"/Users/italomendescangussu/.codex/skills/supabase-cli-mcp-guardrails/scripts/with_local_supabase_env.sh" --project-root "$(git rev-parse --show-toplevel)" -- bash -lc 'supabase functions deploy crm-send-message --project-ref "$SUPABASE_PROJECT_REF"'
"/Users/italomendescangussu/.codex/skills/supabase-cli-mcp-guardrails/scripts/with_local_supabase_env.sh" --project-root "$(git rev-parse --show-toplevel)" -- bash -lc 'supabase functions deploy crm-conversation-handoff --project-ref "$SUPABASE_PROJECT_REF"'
"/Users/italomendescangussu/.codex/skills/supabase-cli-mcp-guardrails/scripts/with_local_supabase_env.sh" --project-root "$(git rev-parse --show-toplevel)" -- bash -lc 'supabase functions deploy crm-uaz-webhook-receiver --project-ref "$SUPABASE_PROJECT_REF"'
"/Users/italomendescangussu/.codex/skills/supabase-cli-mcp-guardrails/scripts/with_local_supabase_env.sh" --project-root "$(git rev-parse --show-toplevel)" -- bash -lc 'supabase functions deploy crm-instagram-webhook-receiver --project-ref "$SUPABASE_PROJECT_REF"'
```

Expected: all deploys finish against the validated project.

- [ ] **Step 5: Final status**

Run:

```bash
git status --short
```

Expected: only intentional implementation changes remain.
