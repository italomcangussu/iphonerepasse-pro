# N8N Repasse Pro Next AI Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new inactive n8n workflow for Repasse Pro AI that preserves the working Redis buffer/lock behavior and uses a backward-compatible multi-device simulator contract for up to two iPhones.

**Architecture:** First extend `crm-simulator-quote` so it can process either the legacy single quote payload or a new `quotes[]` payload in one request. Then create a new inactive n8n workflow by cloning only the stable input/buffer pieces from `ia repasse-pro` and replacing the scattered AI/memory/simulation graph with a smaller deterministic commerce pipeline.

**Tech Stack:** Supabase Edge Functions on Deno, Vitest source-contract tests, n8n Public API, n8n MCP validation/documentation tools, Redis, Supabase REST/Edge Function HTTP calls.

---

## File Structure

- Modify: `supabase/functions/crm-simulator-quote/index.ts`
  - Extract single-quote calculation into reusable helpers.
  - Add `quotes[]` parsing, validation, partial result handling, and combined message output.
  - Preserve the legacy response shape when the request has no `quotes` field.
- Modify: `supabase/functions/crm-simulator-quote/crm-simulator-quote.test.ts`
  - Keep existing source-contract checks.
  - Add checks for the new multi-quote contract.
- Create: `scripts/n8n/export-repasse-workflow.mjs`
  - Reads `.env.local`, uses `N8N_PUBLIC_API` with `X-N8N-API-KEY`, exports the current workflow JSON to a local ignored artifact.
- Create: `scripts/n8n/build-repasse-next-workflow.mjs`
  - Builds a new workflow JSON from the exported current workflow, preserves buffer nodes, and creates/replaces the new inactive workflow.
- Create: `scripts/n8n/validate-repasse-next-workflow.mjs`
  - Performs local structural checks on the generated workflow JSON before API creation.
- Create: `docs/superpowers/plans/2026-06-09-n8n-repasse-pro-next-ai-flow.md`
  - This implementation plan.

## Task 1: Lock Simulator Multi-Quote Contract Tests

**Files:**
- Modify: `supabase/functions/crm-simulator-quote/crm-simulator-quote.test.ts`

- [ ] **Step 1: Add source-contract tests for multi-quote behavior**

Append these tests inside the existing `describe('crm-simulator-quote Edge Function contract', () => { ... })` block:

```ts
  it('accepts a backward-compatible multi-quote payload', () => {
    expect(source).toContain('const rawQuotes = Array.isArray(body.quotes) ? body.quotes : null');
    expect(source).toContain('if (rawQuotes && rawQuotes.length > 2)');
    expect(source).toContain('code: "too_many_quotes"');
    expect(source).toContain('processQuote({');
  });

  it('preserves the legacy single quote response shape', () => {
    expect(source).toContain('if (!rawQuotes)');
    expect(source).toContain('return jsonResponse({ success: true, summary, installments, messageText });');
  });

  it('returns partial multi-quote results when at least one slot succeeds', () => {
    expect(source).toContain('const successfulQuotes = quoteResults.filter((quote) => quote.success)');
    expect(source).toContain('partial: successfulQuotes.length !== quoteResults.length');
    expect(source).toContain('combinedSummary');
  });
```

- [ ] **Step 2: Run the targeted test and verify it fails**

Run:

```bash
npx vitest run --config vitest.supabase.config.ts supabase/functions/crm-simulator-quote/crm-simulator-quote.test.ts
```

Expected: FAIL because the new strings are not present yet.

- [ ] **Step 3: Commit failing contract tests**

```bash
git add supabase/functions/crm-simulator-quote/crm-simulator-quote.test.ts
git commit -m "test: lock crm simulator multi quote contract"
```

## Task 2: Refactor Simulator Into Reusable Quote Helpers

**Files:**
- Modify: `supabase/functions/crm-simulator-quote/index.ts`

- [ ] **Step 1: Introduce helper types after `type CardBrand`**

Add:

```ts
type QuoteInput = Record<string, any> & {
  slot?: number;
};

type QuoteSuccess = {
  slot: number;
  success: true;
  summary: Record<string, any>;
  installments: Array<Record<string, number>>;
  messageText: string;
};

type QuoteFailure = {
  slot: number;
  success: false;
  code: string;
  error: string;
  status: number;
};

type QuoteResult = QuoteSuccess | QuoteFailure;

const quoteFailure = (slot: number, code: string, error: string, status = 400): QuoteFailure => ({
  slot,
  success: false,
  code,
  error,
  status,
});
```

- [ ] **Step 2: Add a stock lookup helper before `buildMessage`**

Add:

```ts
const loadStockItem = async (supabase: any, stockItemId: string) => {
  const { data: stockItem, error: stockError } = await supabase
    .from("stock_items")
    .select("id, model, capacity, color, sell_price, status")
    .eq("id", stockItemId)
    .maybeSingle();

  if (stockError) return { error: quoteFailure(0, "stock_lookup_failed", stockError.message, 500), stockItem: null };
  if (!stockItem) return { error: quoteFailure(0, "stock_not_found", "Aparelho de estoque não encontrado.", 404), stockItem: null };
  if (!STOCK_ALLOWED_STATUSES.has(String(stockItem.status))) {
    return { error: quoteFailure(0, "stock_unavailable", "Aparelho de estoque fora de Disponível ou Reservado.", 400), stockItem: null };
  }

  return { error: null, stockItem };
};
```

- [ ] **Step 3: Extract the legacy calculation into `processQuote`**

Move the existing single-quote body parsing and calculation code into a helper before `Deno.serve`:

```ts
const processQuote = async ({
  supabase,
  quote,
  slot,
  cardBrand,
  valueRows,
  adjustmentRows,
  cardSettings,
}: {
  supabase: any;
  quote: QuoteInput;
  slot: number;
  cardBrand: CardBrand;
  valueRows: Array<Record<string, any>>;
  adjustmentRows: Array<Record<string, any>>;
  cardSettings: Record<string, unknown> | null;
}): Promise<QuoteResult> => {
  const desiredDeviceInput = quote.desiredDevice || quote.desired_device || {};
  const stockItemId = sanitizeText(desiredDeviceInput.stockItemId || desiredDeviceInput.stock_item_id);
  const manualDesired = desiredDeviceInput.manual || {};
  let desiredDeviceLabel = sanitizeText(manualDesired.description || desiredDeviceInput.description) || "";
  let desiredDevicePrice = parseAmount(manualDesired.price || desiredDeviceInput.price);

  if (stockItemId) {
    const { error, stockItem } = await loadStockItem(supabase, stockItemId);
    if (error) return { ...error, slot };
    desiredDeviceLabel = [stockItem.model, stockItem.capacity, stockItem.color].filter(Boolean).join(" ");
    desiredDevicePrice = parseAmount(stockItem.sell_price);
  }

  if (!desiredDeviceLabel || desiredDevicePrice <= 0) {
    return quoteFailure(slot, "desired_device_invalid", "Informe aparelho desejado e preço válido.");
  }

  const tradeIn = quote.tradeIn || quote.trade_in || {};
  const tradeInModel = sanitizeText(tradeIn.model) || "";
  const tradeInCapacity = sanitizeText(tradeIn.capacity) || "";
  const tradeInColor = sanitizeText(tradeIn.color) || "";
  const manualReceivedValue = tradeIn.manualReceivedValue ?? tradeIn.manual_received_value;
  const hasManualReceivedValue = manualReceivedValue !== null
    && manualReceivedValue !== undefined
    && String(manualReceivedValue).trim() !== ""
    && Number.isFinite(Number(manualReceivedValue));
  const selectedAdjustmentIds = new Set(Array.isArray(tradeIn.selectedAdjustmentIds) ? tradeIn.selectedAdjustmentIds.map(String) : []);
  const hasTradeIn = Boolean(tradeInModel || tradeInCapacity || tradeInColor || selectedAdjustmentIds.size > 0 || hasManualReceivedValue);

  if (hasTradeIn && (!tradeInModel || !tradeInCapacity)) {
    return quoteFailure(slot, "trade_in_invalid", "Informe modelo e armazenamento do trade-in.");
  }

  const baseRule = hasTradeIn
    ? (valueRows || []).find((rule: any) => normalize(rule.model) === normalize(tradeInModel) && normalize(rule.capacity) === normalize(tradeInCapacity))
    : null;
  if (hasTradeIn && !baseRule) {
    return quoteFailure(slot, "trade_in_value_not_found", "Não existe valor padrão ativo para este trade-in.");
  }

  const applicableAdjustments = hasTradeIn
    ? (adjustmentRows || []).filter((rule: any) => {
      if (rule.model && normalize(rule.model) !== normalize(tradeInModel)) return false;
      if (rule.capacity && normalize(rule.capacity) !== normalize(tradeInCapacity)) return false;
      return true;
    })
    : [];
  const appliedAdjustments = applicableAdjustments.filter((rule: any) => selectedAdjustmentIds.has(String(rule.id)));
  if ([...selectedAdjustmentIds].some((id) => !applicableAdjustments.some((rule: any) => String(rule.id) === id))) {
    return quoteFailure(slot, "adjustment_invalid", "Um ou mais ajustes selecionados não são compatíveis.");
  }

  const entries = Array.isArray(quote.entries) ? quote.entries.map((entry: any) => ({
    type: sanitizeText(entry.type) || "Entrada",
    amount: roundMoney(parseAmount(entry.amount)),
  })) : [];
  if (entries.some((entry: any) => entry.amount < 0)) {
    return quoteFailure(slot, "entry_invalid", "Entradas não podem ter valor negativo.");
  }

  const tradeInBaseValue = roundMoney(parseAmount(baseRule?.base_value));
  const tradeInAdjustmentsTotal = roundMoney(appliedAdjustments.reduce((sum: number, rule: any) => sum + parseAmount(rule.amount_delta), 0));
  const suggestedTradeInValue = Math.max(0, roundMoney(tradeInBaseValue + tradeInAdjustmentsTotal));
  const tradeInReceivedValue = hasTradeIn && hasManualReceivedValue
    ? roundMoney(Math.max(0, Number(manualReceivedValue)))
    : hasTradeIn ? suggestedTradeInValue : 0;
  const entriesTotal = roundMoney(entries.reduce((sum: number, entry: any) => sum + entry.amount, 0));
  const cardNetAmount = roundMoney(desiredDevicePrice - tradeInReceivedValue - entriesTotal);

  if (cardNetAmount < 0) {
    return quoteFailure(slot, "entries_exceed_balance", "Entradas e trade-in excedem o valor do aparelho.");
  }

  const rates = getRates(cardSettings, cardBrand);
  const installments = rates.map((rate, index) => calculateCardCharge(cardNetAmount, rate, index + 1));
  const summary = {
    slot,
    desiredDeviceLabel,
    desiredDevicePrice,
    tradeInLabel: [tradeInModel, tradeInCapacity, tradeInColor].filter(Boolean).join(" "),
    tradeInBaseValue,
    tradeInAdjustmentsTotal,
    tradeInReceivedValue,
    entriesTotal,
    cardNetAmount,
    reservationHintAmount: RESERVATION_HINT_AMOUNT,
    cardBrand,
    cardBrandLabel: cardLabel(cardBrand),
    appliedAdjustments,
    entries,
  };
  const messageText = buildMessage(summary, installments);

  return { slot, success: true, summary, installments, messageText };
};
```

- [ ] **Step 4: Run formatter/type check for obvious syntax errors**

Run:

```bash
deno check --node-modules-dir=auto supabase/functions/crm-simulator-quote/index.ts
```

Expected: PASS. If it fails on the old inline duplicate calculation still present, continue Task 3 and re-run.

## Task 3: Add Multi-Quote Request Handling

**Files:**
- Modify: `supabase/functions/crm-simulator-quote/index.ts`

- [ ] **Step 1: Replace inline quote calculation inside `Deno.serve`**

After loading `body` and validating `cardBrand`, keep the existing shared data loading block:

```ts
  const [{ data: valueRows, error: valueError }, { data: adjustmentRows, error: adjustmentError }, { data: cardSettings, error: cardError }] = await Promise.all([
    supabase.from("simulator_trade_in_values").select("*").eq("is_active", true),
    supabase.from("simulator_trade_in_adjustments").select("*").eq("is_active", true),
    supabase.from("card_fee_settings").select("*").eq("id", "default").maybeSingle(),
  ]);
  if (valueError) return jsonResponse({ success: false, code: "value_rules_failed", error: valueError.message }, 500);
  if (adjustmentError) return jsonResponse({ success: false, code: "adjustment_rules_failed", error: adjustmentError.message }, 500);
  if (cardError) return jsonResponse({ success: false, code: "card_settings_failed", error: cardError.message }, 500);
```

Then replace the old single-quote calculation with:

```ts
  const rawQuotes = Array.isArray(body.quotes) ? body.quotes : null;

  if (rawQuotes && rawQuotes.length > 2) {
    return jsonResponse({ success: false, code: "too_many_quotes", error: "Simule no máximo dois aparelhos por vez." }, 400);
  }

  if (!rawQuotes) {
    const result = await processQuote({
      supabase,
      quote: body,
      slot: 1,
      cardBrand,
      valueRows: valueRows || [],
      adjustmentRows: adjustmentRows || [],
      cardSettings: cardSettings as Record<string, unknown> | null,
    });

    if (!result.success) {
      return jsonResponse({ success: false, code: result.code, error: result.error }, result.status);
    }

    const { summary, installments, messageText } = result;
    return jsonResponse({ success: true, summary, installments, messageText });
  }

  if (rawQuotes.length === 0) {
    return jsonResponse({ success: false, code: "quotes_empty", error: "Informe pelo menos um aparelho para simular." }, 400);
  }

  const quoteResults = await Promise.all(rawQuotes.map((quote: QuoteInput, index: number) => processQuote({
    supabase,
    quote,
    slot: Number(quote?.slot) || index + 1,
    cardBrand,
    valueRows: valueRows || [],
    adjustmentRows: adjustmentRows || [],
    cardSettings: cardSettings as Record<string, unknown> | null,
  })));

  const successfulQuotes = quoteResults.filter((quote) => quote.success);
  if (successfulQuotes.length === 0) {
    const firstFailure = quoteResults.find((quote) => !quote.success) as QuoteFailure | undefined;
    return jsonResponse({
      success: false,
      code: firstFailure?.code || "quote_failed",
      error: firstFailure?.error || "Nenhuma simulação pôde ser calculada.",
      quotes: quoteResults,
    }, firstFailure?.status || 400);
  }

  const combinedSummary = {
    quoteCount: successfulQuotes.length,
    requestedQuoteCount: rawQuotes.length,
    cardBrand,
    cardBrandLabel: cardLabel(cardBrand),
    partial: successfulQuotes.length !== quoteResults.length,
    totalCardNetAmount: roundMoney(successfulQuotes.reduce((sum, quote) => sum + Number(quote.summary.cardNetAmount || 0), 0)),
  };
  const messageText = successfulQuotes.map((quote, index) => [
    successfulQuotes.length > 1 ? `*Opção ${index + 1}*` : "",
    quote.messageText,
  ].filter(Boolean).join("\n")).join("\n\n====================\n\n");

  return jsonResponse({
    success: true,
    partial: successfulQuotes.length !== quoteResults.length,
    quotes: quoteResults,
    combinedSummary,
    messageText,
  });
```

- [ ] **Step 2: Run targeted tests**

Run:

```bash
npx vitest run --config vitest.supabase.config.ts supabase/functions/crm-simulator-quote/crm-simulator-quote.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run Deno check**

Run:

```bash
deno check --node-modules-dir=auto supabase/functions/crm-simulator-quote/index.ts
```

Expected: PASS.

- [ ] **Step 4: Commit simulator implementation**

```bash
git add supabase/functions/crm-simulator-quote/index.ts supabase/functions/crm-simulator-quote/crm-simulator-quote.test.ts
git commit -m "feat: support multi device crm simulator quotes"
```

## Task 4: Add n8n Export Script

**Files:**
- Create: `scripts/n8n/export-repasse-workflow.mjs`
- Create directory if missing: `scripts/n8n`

- [ ] **Step 1: Create the export script**

```js
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const envPath = '.env.local';
const sourceWorkflowId = 'oWNdWPUq6kEFitsnl8OpH';
const outputPath = 'output/n8n/ia-repasse-pro.current.json';

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }));
}

if (!existsSync(envPath)) {
  throw new Error(`${envPath} not found`);
}

const env = parseEnv(await readFile(envPath, 'utf8'));
if (!env.N8N_PUBLIC_API || !env.N8N_MCP_URL) {
  throw new Error('Missing N8N_PUBLIC_API or N8N_MCP_URL in .env.local');
}

const origin = new URL(env.N8N_MCP_URL).origin;
const response = await fetch(new URL(`/api/v1/workflows/${sourceWorkflowId}`, origin), {
  headers: { 'X-N8N-API-KEY': env.N8N_PUBLIC_API },
});

if (!response.ok) {
  throw new Error(`n8n export failed: ${response.status} ${await response.text()}`);
}

const workflow = await response.json();
await mkdir('output/n8n', { recursive: true });
await writeFile(outputPath, `${JSON.stringify(workflow, null, 2)}\n`);

console.log(JSON.stringify({
  exported: true,
  workflowId: workflow.id,
  name: workflow.name,
  nodeCount: Array.isArray(workflow.nodes) ? workflow.nodes.length : 0,
  outputPath,
}, null, 2));
```

- [ ] **Step 2: Run export**

Run:

```bash
node scripts/n8n/export-repasse-workflow.mjs
```

Expected: JSON output with `"exported": true` and `nodeCount` near 135.

- [ ] **Step 3: Commit export script only**

```bash
git add scripts/n8n/export-repasse-workflow.mjs
git commit -m "chore: add repasse n8n export script"
```

Do not commit `output/n8n/ia-repasse-pro.current.json`.

## Task 5: Build New Inactive Workflow JSON

**Files:**
- Create: `scripts/n8n/build-repasse-next-workflow.mjs`
- Create: `scripts/n8n/validate-repasse-next-workflow.mjs`

- [ ] **Step 1: Create the structural validator**

```js
import { readFile } from 'node:fs/promises';

const path = process.argv[2] || 'output/n8n/ia-repasse-pro-next.generated.json';
const workflow = JSON.parse(await readFile(path, 'utf8'));
const names = new Set(workflow.nodes.map((node) => node.name));

const required = [
  'Webhook Next',
  'Normalize Payload Next',
  'Atualizar Estado Buffer Next',
  'Calcular Wait Buffer Next',
  'Verificar vencedor Next',
  'Tentar Lock Next',
  'Code Consolidador Payload Final Next',
  'Load CRM Context Next',
  'Commerce State Extractor Next',
  'Decision Engine Next',
  'Inventory Search Next',
  'Build Multi Quote Request Next',
  'CRM Simulator Quote Next',
  'Response Composer Next',
  'Persist Lead State Next',
  'Send WhatsApp Next',
];

const missing = required.filter((name) => !names.has(name));
if (missing.length) {
  throw new Error(`Missing required nodes: ${missing.join(', ')}`);
}

if (workflow.active !== false) {
  throw new Error('Generated workflow must be inactive');
}

const serialized = JSON.stringify(workflow);
if (/Bearer\s+[A-Za-z0-9._-]+/.test(serialized) || /[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(serialized)) {
  throw new Error('Generated workflow appears to contain hardcoded token material');
}

console.log(JSON.stringify({
  valid: true,
  name: workflow.name,
  active: workflow.active,
  nodeCount: workflow.nodes.length,
}, null, 2));
```

- [ ] **Step 2: Create the workflow builder skeleton**

The builder should read `output/n8n/ia-repasse-pro.current.json`, copy the stable buffer node parameter blocks by name, and produce `output/n8n/ia-repasse-pro-next.generated.json`.

Use this initial file:

```js
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import crypto from 'node:crypto';

const sourcePath = 'output/n8n/ia-repasse-pro.current.json';
const outputPath = 'output/n8n/ia-repasse-pro-next.generated.json';

const source = JSON.parse(await readFile(sourcePath, 'utf8'));

const cloneNode = (name, nextName, position) => {
  const node = source.nodes.find((item) => item.name === name);
  if (!node) throw new Error(`Source node not found: ${name}`);
  return {
    ...JSON.parse(JSON.stringify(node)),
    id: crypto.randomUUID(),
    name: nextName,
    position,
  };
};

const codeNode = (name, jsCode, position) => ({
  parameters: { jsCode },
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position,
  id: crypto.randomUUID(),
  name,
});

const setNode = (name, assignments, position) => ({
  parameters: {
    assignments: { assignments },
    options: {},
  },
  type: 'n8n-nodes-base.set',
  typeVersion: 3.4,
  position,
  id: crypto.randomUUID(),
  name,
});

const httpNode = (name, parameters, position) => ({
  parameters,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.3,
  position,
  id: crypto.randomUUID(),
  name,
});

const nodes = [
  cloneNode('Webhook', 'Webhook Next', [0, 0]),
  setNode('Normalize Payload Next', [
    { id: crypto.randomUUID(), name: 'lead_id', value: "={{ $json.body.lead_detail.id }}", type: 'string' },
    { id: crypto.randomUUID(), name: 'store_id', value: "={{ $json.body.store_id }}", type: 'string' },
    { id: crypto.randomUUID(), name: 'message_text', value: "={{ $json.body.body?.message?.text ?? $json.body.body?.message?.content ?? '' }}", type: 'string' },
  ], [260, 0]),
  cloneNode('Atualizar Estado Buffer', 'Atualizar Estado Buffer Next', [520, 0]),
  cloneNode('Calcular Wait Buffer', 'Calcular Wait Buffer Next', [780, 0]),
  cloneNode('Verificar vencedor', 'Verificar vencedor Next', [1040, 0]),
  cloneNode('Tentar Lock', 'Tentar Lock Next', [1300, 0]),
  cloneNode('Code Consolidador Payload Final', 'Code Consolidador Payload Final Next', [1560, 0]),
  httpNode('Load CRM Context Next', {
    url: "={{ $env.SUPABASE_FUNCTIONS_URL + '/crm-leads-api?store_id=' + $json.store_id + '&search=' + $json.lead_id + '&limit=10&offset=0' }}",
    sendHeaders: true,
    headerParameters: { parameters: [
      { name: 'x-api-key', value: '={{ $env.CRM_N8N_API_KEY }}' },
    ] },
    options: {},
  }, [1820, 0]),
  codeNode('Commerce State Extractor Next', `const input = $input.first().json;\nreturn [{ json: { ...input, desired_devices: [], trade_ins: [], missing_fields: ['desired_model'], summary_short_next: input.lead?.summary_short ?? null } }];`, [2080, 0]),
  codeNode('Decision Engine Next', `const input = $input.first().json;\nreturn [{ json: { ...input, action: input.missing_fields?.length ? 'ask_missing_field' : 'search_inventory' } }];`, [2340, 0]),
  httpNode('Inventory Search Next', {
    url: "={{ $env.SUPABASE_URL + '/rest/v1/stock_items' }}",
    sendHeaders: true,
    headerParameters: { parameters: [
      { name: 'apikey', value: '={{ $env.SUPABASE_SERVICE_ROLE_KEY }}' },
      { name: 'Authorization', value: '={{ \"Bearer \" + $env.SUPABASE_SERVICE_ROLE_KEY }}' },
    ] },
    options: {},
  }, [2600, 0]),
  codeNode('Build Multi Quote Request Next', `const input = $input.first().json;\nreturn [{ json: { ...input, simulator_body: { quotes: [], cardBrand: input.card_brand ?? 'visa_master' } } }];`, [2860, 0]),
  httpNode('CRM Simulator Quote Next', {
    method: 'POST',
    url: "={{ $env.SUPABASE_FUNCTIONS_URL + '/crm-simulator-quote' }}",
    sendHeaders: true,
    headerParameters: { parameters: [
      { name: 'x-api-key', value: '={{ $env.CRM_N8N_API_KEY }}' },
    ] },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: '={{ JSON.stringify($json.simulator_body) }}',
    options: {},
  }, [3120, 0]),
  codeNode('Response Composer Next', `const input = $input.first().json;\nconst text = input.messageText || 'Me passa o modelo e armazenamento do iPhone que voce procura?';\nreturn [{ json: { ...input, messages: [text], transfer: false } }];`, [3380, 0]),
  httpNode('Persist Lead State Next', {
    method: 'POST',
    url: "={{ $env.SUPABASE_FUNCTIONS_URL + '/crm-leads-api' }}",
    sendHeaders: true,
    headerParameters: { parameters: [
      { name: 'x-api-key', value: '={{ $env.CRM_N8N_API_KEY }}' },
    ] },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: '={{ JSON.stringify({ action: \"upsert_lead_state\", payload: { lead_id: $json.lead_id, store_id: $json.store_id, state: { summary_short: $json.summary_short_next } } }) }}',
    options: {},
  }, [3640, 0]),
  httpNode('Send WhatsApp Next', {
    method: 'POST',
    url: "={{ $env.SUPABASE_FUNCTIONS_URL + '/crm-send-message' }}",
    sendHeaders: true,
    headerParameters: { parameters: [
      { name: 'Authorization', value: '={{ $json.Authorization }}' },
      { name: 'apikey', value: '={{ $json.apikey }}' },
    ] },
    sendBody: true,
    bodyParameters: { parameters: [
      { name: 'conversationId', value: '={{ $json.body?.meta?.conversation_id }}' },
      { name: 'content', value: '={{ $json.messages[0] }}' },
      { name: 'senderType', value: 'ai_inbound' },
    ] },
    options: {},
  }, [3900, 0]),
];

const connections = {
  'Webhook Next': { main: [[{ node: 'Normalize Payload Next', type: 'main', index: 0 }]] },
  'Normalize Payload Next': { main: [[{ node: 'Atualizar Estado Buffer Next', type: 'main', index: 0 }]] },
  'Atualizar Estado Buffer Next': { main: [[{ node: 'Calcular Wait Buffer Next', type: 'main', index: 0 }]] },
  'Calcular Wait Buffer Next': { main: [[{ node: 'Verificar vencedor Next', type: 'main', index: 0 }]] },
  'Verificar vencedor Next': { main: [[{ node: 'Tentar Lock Next', type: 'main', index: 0 }]] },
  'Tentar Lock Next': { main: [[{ node: 'Code Consolidador Payload Final Next', type: 'main', index: 0 }]] },
  'Code Consolidador Payload Final Next': { main: [[{ node: 'Load CRM Context Next', type: 'main', index: 0 }]] },
  'Load CRM Context Next': { main: [[{ node: 'Commerce State Extractor Next', type: 'main', index: 0 }]] },
  'Commerce State Extractor Next': { main: [[{ node: 'Decision Engine Next', type: 'main', index: 0 }]] },
  'Decision Engine Next': { main: [[{ node: 'Inventory Search Next', type: 'main', index: 0 }]] },
  'Inventory Search Next': { main: [[{ node: 'Build Multi Quote Request Next', type: 'main', index: 0 }]] },
  'Build Multi Quote Request Next': { main: [[{ node: 'CRM Simulator Quote Next', type: 'main', index: 0 }]] },
  'CRM Simulator Quote Next': { main: [[{ node: 'Response Composer Next', type: 'main', index: 0 }]] },
  'Response Composer Next': { main: [[{ node: 'Persist Lead State Next', type: 'main', index: 0 }]] },
  'Persist Lead State Next': { main: [[{ node: 'Send WhatsApp Next', type: 'main', index: 0 }]] },
};

const workflow = {
  name: 'ia repasse-pro next',
  active: false,
  nodes,
  connections,
  settings: {
    executionOrder: 'v1',
    availableInMCP: true,
    callerPolicy: 'workflowsFromSameOwner',
  },
};

await mkdir('output/n8n', { recursive: true });
await writeFile(outputPath, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(JSON.stringify({ generated: true, outputPath, nodeCount: nodes.length }, null, 2));
```

- [ ] **Step 3: Generate and validate**

Run:

```bash
node scripts/n8n/export-repasse-workflow.mjs
node scripts/n8n/build-repasse-next-workflow.mjs
node scripts/n8n/validate-repasse-next-workflow.mjs
```

Expected: validator prints `"valid": true`.

- [ ] **Step 4: Commit builder and validator scripts**

```bash
git add scripts/n8n/build-repasse-next-workflow.mjs scripts/n8n/validate-repasse-next-workflow.mjs
git commit -m "chore: scaffold repasse next n8n workflow builder"
```

## Task 6: Create the Inactive n8n Workflow

**Files:**
- Modify: `scripts/n8n/build-repasse-next-workflow.mjs`

- [ ] **Step 1: Add `--create` support to the builder**

At the end of `scripts/n8n/build-repasse-next-workflow.mjs`, after writing the JSON, add:

```js
if (process.argv.includes('--create')) {
  const envText = await readFile('.env.local', 'utf8');
  const env = Object.fromEntries(envText.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }));

  const origin = new URL(env.N8N_MCP_URL).origin;
  const response = await fetch(new URL('/api/v1/workflows', origin), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': env.N8N_PUBLIC_API,
    },
    body: JSON.stringify(workflow),
  });

  if (!response.ok) {
    throw new Error(`n8n create failed: ${response.status} ${await response.text()}`);
  }

  const created = await response.json();
  console.log(JSON.stringify({
    created: true,
    workflowId: created.id,
    name: created.name,
    active: created.active,
  }, null, 2));
}
```

- [ ] **Step 2: Run local validation before creating remotely**

Run:

```bash
node scripts/n8n/build-repasse-next-workflow.mjs
node scripts/n8n/validate-repasse-next-workflow.mjs
```

Expected: validator prints `"active": false`.

- [ ] **Step 3: Create remote inactive workflow**

Run:

```bash
node scripts/n8n/build-repasse-next-workflow.mjs --create
```

Expected: output includes `"created": true`, name `ia repasse-pro next`, and `"active": false`.

- [ ] **Step 4: Verify remote workflow list**

Run a sanitized check:

```bash
node - <<'NODE'
const fs = require('fs');
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')&&l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]));
(async () => {
  const origin = new URL(env.N8N_MCP_URL).origin;
  const res = await fetch(new URL('/api/v1/workflows?limit=50', origin), { headers: { 'X-N8N-API-KEY': env.N8N_PUBLIC_API } });
  const data = await res.json();
  console.log(JSON.stringify((data.data || []).filter(w => w.name.includes('repasse-pro')).map(w => ({ id: w.id, name: w.name, active: w.active })), null, 2));
})();
NODE
```

Expected: both `ia repasse-pro` active and `ia repasse-pro next` inactive are listed.

- [ ] **Step 5: Commit create support**

```bash
git add scripts/n8n/build-repasse-next-workflow.mjs
git commit -m "chore: create inactive repasse next n8n workflow"
```

## Task 7: Verification and Handoff

**Files:**
- No code changes unless verification exposes a defect.

- [ ] **Step 1: Run simulator contract tests**

```bash
npx vitest run --config vitest.supabase.config.ts supabase/functions/crm-simulator-quote/crm-simulator-quote.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run Edge Function check**

```bash
deno check --node-modules-dir=auto supabase/functions/crm-simulator-quote/index.ts
```

Expected: PASS.

- [ ] **Step 3: Run n8n workflow generation checks**

```bash
node scripts/n8n/export-repasse-workflow.mjs
node scripts/n8n/build-repasse-next-workflow.mjs
node scripts/n8n/validate-repasse-next-workflow.mjs
```

Expected: all commands exit 0.

- [ ] **Step 4: Confirm no secrets were committed**

```bash
git diff --cached --check
git grep -n "Bearer eyJ\\|N8N_PUBLIC_API=\\|CRM_N8N_API_KEY=" -- ':!package-lock.json' ':!deno.lock'
```

Expected: no committed token values. If `git grep` finds only safe references to env variable names, document that in the final response.

- [ ] **Step 5: Final status summary**

Summarize:

- simulator multi-quote contract status;
- workflow creation status and remote workflow id;
- whether the workflow is inactive;
- exact tests run;
- remaining production switch steps.
