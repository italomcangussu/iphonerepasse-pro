# Repasse V2 WhatsApp Scenario Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run a controlled 8-10 scenario WhatsApp audit for `ia repasse-pro v2 avancada`, using high-potential real CRM conversations as inspiration and the sandbox phone `558899990507`.

**Architecture:** Use a small Node.js harness under `scripts/n8n` to select commercial scenarios from CRM messages, reset the sandbox lead before each scenario, activate/deactivate the v2 n8n workflow during the run, dispatch controlled webhook payloads, collect CRM/n8n evidence, and write a Markdown audit report. Keep production webhook routing unchanged and avoid mutating original leads.

**Tech Stack:** Node.js 22 ESM, `@supabase/supabase-js`, n8n Public API, Supabase service-role access loaded only from local `.env.local`, existing n8n workflow builder/validator scripts, Supabase CLI guardrail scripts.

---

## File Structure

- Create: `scripts/n8n/run-repasse-scenario-audit.mjs`
  - Loads local env without printing secrets.
  - Validates the Supabase project ref from `VITE_SUPABASE_URL`.
  - Finds the sandbox lead/conversation for `558899990507`.
  - Selects 8-10 high-potential commercial scenarios from recent CRM messages.
  - Resets sandbox memory before each scenario.
  - Activates the v2 workflow only while running the live battery.
  - Dispatches each scenario to `/webhook/repasse-next`.
  - Collects n8n execution and CRM response evidence.
  - Writes a Markdown report under `output/n8n/`.
- Create: `output/n8n/repasse-v2-scenario-audit-YYYY-MM-DD.md`
  - Generated report with scenario list, responses, execution evidence, findings, and recommended prompt/flow improvements.
- Modify: no production app files during the battery.

## Task 1: Preflight Current Local And Remote State

**Files:**
- Read: `.env.local`
- Read: `output/n8n/ia-repasse-pro-next.generated.json`
- Run: existing validation and test commands

- [ ] **Step 1: Validate local Supabase identity**

Run:

```bash
python3 /Users/italomendescangussu/.codex/skills/supabase-cli-mcp-guardrails/scripts/local_supabase_env.py \
  --project-root /Volumes/DEV/projetos/iphonerepasse-pro \
  --format summary
```

Expected: `SUPABASE_PROJECT_REF=ubuusaiezpyayqgfujbe` and no secret values printed in full.

- [ ] **Step 2: Validate simulator and workflow artifacts**

Run:

```bash
npx vitest run --config vitest.supabase.config.ts supabase/functions/crm-simulator-quote/crm-simulator-quote.test.ts
deno check --node-modules-dir=auto supabase/functions/crm-simulator-quote/index.ts
node scripts/n8n/build-repasse-next-workflow.mjs
node scripts/n8n/validate-repasse-next-workflow.mjs
```

Expected: simulator tests pass, Deno check passes, generated workflow validates with webhook path `repasse-next`.

- [ ] **Step 3: Deploy local simulator changes before live scenario tests**

Run:

```bash
/Users/italomendescangussu/.codex/skills/supabase-cli-mcp-guardrails/scripts/with_local_supabase_env.sh \
  --project-root /Volumes/DEV/projetos/iphonerepasse-pro \
  -- supabase functions deploy crm-simulator-quote \
  --workdir /Volumes/DEV/projetos/iphonerepasse-pro \
  --project-ref ubuusaiezpyayqgfujbe \
  --use-api \
  --no-verify-jwt
```

Expected: deployment succeeds for `crm-simulator-quote` with JWT verification disabled.

- [ ] **Step 4: Deploy the latest v2 workflow draft**

Run:

```bash
node scripts/n8n/build-repasse-next-workflow.mjs --deploy
```

Expected: workflow `Cr4fPWe0prwS6XjI` is updated, remains inactive, and reports 135 nodes.

## Task 2: Create Scenario Audit Harness

**Files:**
- Create: `scripts/n8n/run-repasse-scenario-audit.mjs`

- [ ] **Step 1: Create the script shell with modes**

Create an executable Node.js ESM script with these CLI modes:

```bash
node scripts/n8n/run-repasse-scenario-audit.mjs --list-scenarios
node scripts/n8n/run-repasse-scenario-audit.mjs --run-live --limit 10
```

The script must exit unless `.env.local` contains `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `N8N_PUBLIC_API`, and `N8N_MCP_URL`.

- [ ] **Step 2: Implement Supabase and n8n clients**

The script must:

```js
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const n8nOrigin = new URL(env.N8N_MCP_URL).origin;
```

Use `X-N8N-API-KEY` for n8n Public API calls. Do not print token values.

- [ ] **Step 3: Implement scenario selection**

Select recent customer messages, score by commercial keywords, group by conversation, and produce 8-10 sanitized prompts. Required scenario categories:

```js
[
  'compra_modelo_definido',
  'troca_com_iphone_entrada',
  'comparacao_dois_iphones',
  'faltam_dados_tradein',
  'parcelamento_bandeira',
  'objecao_preco',
  'sem_estoque_alternativa',
  'cliente_indeciso',
]
```

The script must not update the original conversation ids used as sources.

- [ ] **Step 4: Implement sandbox reset**

Before every live scenario, update only the sandbox lead/conversation:

```js
await supabase.from('crm_leads').update({
  summary_short: null,
  summary_operational: null,
  attendance_owner: 'ia',
  conversation_status: 'em_atendimento_ia',
  updated_at: new Date().toISOString(),
}).eq('id', sandboxLead.id);

await supabase.from('crm_conversations').update({
  status: 'ai_handling',
  ai_enabled: true,
  updated_at: new Date().toISOString(),
}).eq('id', sandboxConversation.id);
```

If `summary_operational` does not exist on the remote schema, retry the lead update without that column and record this in the report.

- [ ] **Step 5: Implement live dispatch and collection**

For each scenario, dispatch one controlled inbound WhatsApp-like payload to:

```txt
POST {n8nOrigin}/webhook/repasse-next
```

Then wait for new `crm_messages` rows for the sandbox conversation and collect:

- scenario prompt;
- n8n execution id/status when available;
- AI/customer response content;
- elapsed time;
- whether simulator nodes appear in the execution summary when available.

- [ ] **Step 6: Implement safe cleanup**

After the live run, deactivate the v2 workflow if the script activated it, and restore the sandbox conversation/lead to the state captured before the run.

## Task 3: Dry-Run Scenario Selection

**Files:**
- Run: `scripts/n8n/run-repasse-scenario-audit.mjs`

- [ ] **Step 1: Run scenario listing without dispatch**

Run:

```bash
node scripts/n8n/run-repasse-scenario-audit.mjs --list-scenarios --limit 10
```

Expected: 8-10 sanitized scenarios printed with category, source conversation id, source message dates, and prompt text. No CRM updates and no WhatsApp sends.

- [ ] **Step 2: Verify category coverage**

Confirm the listed scenarios include at least:

- one comparison between two desired iPhones;
- one trade-in with missing condition data;
- one trade-in ready for simulation;
- one parcelment/card brand scenario;
- one objection/negotiation scenario.

If fewer than 8 scenarios are found, add deterministic fallback prompts inspired by common CRM cases and mark them as `fallback_generated` in the report.

## Task 4: Run Live WhatsApp Battery

**Files:**
- Run: `scripts/n8n/run-repasse-scenario-audit.mjs`
- Generate: `output/n8n/repasse-v2-scenario-audit-YYYY-MM-DD.md`

- [ ] **Step 1: Run the live battery**

Run:

```bash
node scripts/n8n/run-repasse-scenario-audit.mjs --run-live --limit 10
```

Expected: every scenario resets the sandbox memory first, dispatches one message to `repasse-next`, receives or times out waiting for an AI response, and appends evidence to the report.

- [ ] **Step 2: Verify sandbox restoration**

After the run, query the sandbox conversation/lead and confirm the script restored the initial status unless the captured initial status was already `ai_handling`.

- [ ] **Step 3: Verify production isolation**

Confirm the production workflow remains untouched and the v2 workflow is inactive after the run unless it was already active at the start.

## Task 5: Commercial Audit And Improvement List

**Files:**
- Modify: generated report only
- Do not modify n8n prompts during this task

- [ ] **Step 1: Score every scenario**

For each response, assign qualitative ratings for:

```txt
Entendimento
Perguntas certas
Simulacao
Negociacao
Alternativas
Seguranca operacional
Performance
```

- [ ] **Step 2: Classify findings**

Classify each issue as:

```txt
Critico
Alto impacto
Refino
```

- [ ] **Step 3: Produce recommended prompt/flow changes**

Write recommendations grouped by target:

- `Memory 1 - Extractor`
- `Memory 2 - Reconciler`
- `Parse Memory`
- `Bia 1`
- `Bia 2 ESTOQUE`
- `Montar Body do Simulador`
- `crm-simulator-quote`

Do not apply these recommendations until the report shows either a recurring pattern or a single critical failure with high operational risk.

## Task 6: Commit Reproducible Harness And Report

**Files:**
- Add: `scripts/n8n/run-repasse-scenario-audit.mjs`
- Add: `output/n8n/repasse-v2-scenario-audit-YYYY-MM-DD.md` only if `output/n8n` is tracked for reports; otherwise leave report untracked and mention path in final answer.

- [ ] **Step 1: Run final local checks**

Run:

```bash
node scripts/n8n/run-repasse-scenario-audit.mjs --list-scenarios --limit 8
node scripts/n8n/validate-repasse-next-workflow.mjs
```

Expected: scenario listing works and workflow validation remains green.

- [ ] **Step 2: Commit the harness**

Run:

```bash
git add scripts/n8n/run-repasse-scenario-audit.mjs
git commit -m "chore: add repasse v2 scenario audit harness"
```

Expected: commit contains the reusable harness only. Existing workflow/simulator changes remain separate unless intentionally committed in a later task.

## Self-Review

- Spec coverage: the plan covers scenario selection, sandbox reset, v2 dispatch, n8n/CRM evidence, quality audit, report generation, production isolation, and deferred prompt/flow changes.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation slots are present.
- Scope check: this is one operational subproject; prompt/flow fixes are deliberately outside this plan until the audit report identifies specific failures.
