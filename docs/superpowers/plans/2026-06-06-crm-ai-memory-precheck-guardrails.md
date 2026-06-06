# CRM AI Memory Precheck Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic post-Memory guardrails to the `ia repasse-pro` n8n workflow so Bia answers are parsed into structured fields and stock is checked before any availability claim.

**Architecture:** Keep the live n8n topology intact and patch the existing `Parse Memory` code node plus the `Bia 1` agent prompt. Store the guardrail and patcher in repo scripts so the remote workflow change is reproducible through the n8n public API.

**Tech Stack:** n8n Public API, Node.js 22 ESM scripts, plain JavaScript fixture tests, existing `.env.local` `N8N_PUBLIC_API`.

---

### Task 1: Create Local Guardrail Module

**Files:**
- Create: `scripts/n8n/repasse-memory-guardrails.mjs`

- [ ] **Step 1: Add pure guardrail helpers and the n8n injection block**

Create `scripts/n8n/repasse-memory-guardrails.mjs` with:

```js
export const GUARDRAIL_MARKER_START = "// === REPASSE MEMORY GUARDRAILS START ===";
export const GUARDRAIL_MARKER_END = "// === REPASSE MEMORY GUARDRAILS END ===";

export function normalizeFreeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectLastQuestionKind(lastMessageContent) {
  const text = normalizeFreeText(lastMessageContent);
  if (!text) return null;
  if (/\b(modelo|qual iphone|e o 17|pro ou pro max)\b/.test(text)) return "desired_model";
  if (/\b(armazenamento|capacidade|gb|128|256|512|1tb|1 tb)\b/.test(text)) return "desired_capacity";
  if (/\b(cor|cores|preto|branco|natural|azul|rosa|verde|titani[o|o])\b/.test(text)) return "desired_color";
  if (/\b(cidade|retirada|qual loja|fortaleza|sobral)\b/.test(text)) return "preferred_city";
  if (/\b(bateria|arranho|arranhoes|lateral|liquido|peca|caixa|cabo|garantia apple)\b/.test(text)) return "tradein";
  if (/\b(nome completo|cpf|nascimento|cadastro|contato)\b/.test(text)) return "cadastro";
  if (/\b(entrada|pix|cartao|cartao|bandeira|visa|master|simulacao|simular)\b/.test(text)) return "payment";
  if (/\b(reserva|retirar|horario|dia|data)\b/.test(text)) return "reservation";
  return null;
}

export function detectIphoneModel(text, context = {}) {
  const normalized = normalizeFreeText([
    text,
    context.lastMessageContent,
    context.summaryShort,
    context.summaryOperational,
    context.previousDesiredModel,
  ].filter(Boolean).join(" "));

  const direct = normalizeFreeText(text);
  const hasIphoneContext = /\b(iphone|17|16|15|14|13|12|11)\b/.test(normalized);

  const generationMatch = normalized.match(/\b(?:iphone\s*)?(1[1-7])\s*(pro\s*max|promax|pro|max|plus)?\b/);
  if (generationMatch) {
    const generation = generationMatch[1];
    const variant = normalizeFreeText(generationMatch[2] ?? "");
    if (variant === "pro max" || variant === "promax") return `iPhone ${generation} Pro Max`;
    if (variant === "pro") return `iPhone ${generation} Pro`;
    if (variant === "plus") return `iPhone ${generation} Plus`;
    if (variant === "max" && /pro\s*max/.test(normalized)) return `iPhone ${generation} Pro Max`;
    return `iPhone ${generation}`;
  }

  if (/\bpro\s*max\b/.test(direct) && context.previousDesiredModel) {
    const generation = String(context.previousDesiredModel).match(/\b(1[1-7])\b/)?.[1];
    return generation ? `iPhone ${generation} Pro Max` : null;
  }

  if (/\bpro\b/.test(direct) && hasIphoneContext) {
    const generation = String(context.previousDesiredModel ?? context.lastMessageContent ?? "").match(/\b(1[1-7])\b/)?.[1];
    return generation ? `iPhone ${generation} Pro` : null;
  }

  return null;
}

export function detectCapacity(text) {
  const normalized = normalizeFreeText(text);
  if (/\b(1tb|1 tb|1000gb|1000 gb)\b/.test(normalized)) return "1TB";
  const match = normalized.match(/\b(128|256|512)\s*(gb)?\b/);
  return match ? `${match[1]}GB` : null;
}

export function detectCapacityConstraint(text) {
  const normalized = normalizeFreeText(text);
  if (/\b(maior|acima|mais)\b.*\b256\b|\b256\b.*\b(maior|acima|mais)\b/.test(normalized)) {
    return "greater_than_256GB";
  }
  return null;
}

export function detectColor(text) {
  const normalized = normalizeFreeText(text);
  const colors = [
    ["preto", /\b(preto|black|titani[o|o]\s*preto)\b/],
    ["branco", /\b(branco|white)\b/],
    ["natural", /\b(natural|titani[o|o]\s*natural)\b/],
    ["azul", /\b(azul|blue)\b/],
    ["rosa", /\b(rosa|pink)\b/],
    ["verde", /\b(verde|green)\b/],
    ["dourado", /\b(dourado|gold)\b/],
  ];
  return colors.find(([, regex]) => regex.test(normalized))?.[0] ?? null;
}

export function detectOperationalCity(text) {
  const normalized = normalizeFreeText(text);
  if (/\b(sobral|massape|forquilha|tiangua|coreau|meruoca)\b/.test(normalized)) return "Sobral";
  if (/\b(fortaleza|fortal|eusebio|aquiraz|maracanau|caucaia|pacatuba)\b/.test(normalized)) return "Fortaleza";
  return null;
}

export function hasNonPurchaseSignal(text) {
  const normalized = normalizeFreeText(text);
  return /\b(vender|vendo|venda|avaliar|avaliacao|quanto vale|repasse|conserto|reparo|garantia|defeito|comprovante|pix pago|suporte)\b/.test(normalized);
}

export function applyRepasseMemoryGuardrails(input) {
  const memory = { ...(input.memory ?? input) };
  const currentMessage = input.message_buffered ?? input.currentMessage ?? "";
  const lastMessageContent = input.last_message_content ?? input.lastMessageContent ?? "";
  const summaryShort = memory.summary_short ?? input.summary_short ?? "";
  const summaryOperational = memory.summary_operational ?? input.summary_operational ?? "";
  const lastQuestionKind = detectLastQuestionKind(lastMessageContent);

  const model = detectIphoneModel(currentMessage, {
    lastMessageContent,
    summaryShort,
    summaryOperational,
    previousDesiredModel: memory.desired_model,
  });
  const capacity = detectCapacity(currentMessage);
  const capacityConstraint = detectCapacityConstraint(currentMessage);
  const color = detectColor(currentMessage);
  const city = detectOperationalCity(currentMessage);

  if (!memory.desired_model && model) memory.desired_model = model;
  if ((lastQuestionKind === "desired_model" || /iphone|1[1-7]/i.test(currentMessage)) && model) {
    memory.desired_model = model;
  }
  if (!memory.desired_capacity && capacity) memory.desired_capacity = capacity;
  if (lastQuestionKind === "desired_capacity" && capacity) memory.desired_capacity = capacity;
  if (capacityConstraint) memory.capacity_constraint = capacityConstraint;
  if (!memory.desired_color && color) memory.desired_color = color;
  if (lastQuestionKind === "desired_color" && color) memory.desired_color = color;
  if (!memory.preferred_city && city) memory.preferred_city = city;
  if (lastQuestionKind === "preferred_city" && city) memory.preferred_city = city;

  const purchaseSideModel = Boolean(memory.desired_model) && !hasNonPurchaseSignal(currentMessage);
  if (purchaseSideModel) {
    memory.desired_device_type = "iphone";
    memory.intent = ["aparelho_iphone", "aparelho_outro"].includes(memory.intent) ? memory.intent : "aparelho_iphone";
    if (!memory.interest_type) memory.interest_type = "comprar";
    if (["comprar", "trocar"].includes(memory.interest_type)) {
      memory.shouldPrecheckInventory = true;
      memory.shouldUseBia1 = true;
      memory.shouldSearchInventory = false;
      memory.shouldUseBia2NoStock = false;
      memory.shouldUseBia2Continuation = false;
      memory.routing_decision = "precheck_inventory_before_bia1";
    }
  }

  return memory;
}

export const N8N_GUARDRAIL_BLOCK = `${GUARDRAIL_MARKER_START}
function repasseDetectLastQuestionKind(lastMessageContent) {
  const text = normalizeFreeText(lastMessageContent);
  if (!text) return null;
  if (/\\b(modelo|qual iphone|e o 17|pro ou pro max)\\b/.test(text)) return "desired_model";
  if (/\\b(armazenamento|capacidade|gb|128|256|512|1tb|1 tb)\\b/.test(text)) return "desired_capacity";
  if (/\\b(cor|cores|preto|branco|natural|azul|rosa|verde|titanio)\\b/.test(text)) return "desired_color";
  if (/\\b(cidade|retirada|qual loja|fortaleza|sobral)\\b/.test(text)) return "preferred_city";
  if (/\\b(bateria|arranho|arranhoes|lateral|liquido|peca|caixa|cabo|garantia apple)\\b/.test(text)) return "tradein";
  if (/\\b(nome completo|cpf|nascimento|cadastro|contato)\\b/.test(text)) return "cadastro";
  if (/\\b(entrada|pix|cartao|bandeira|visa|master|simulacao|simular)\\b/.test(text)) return "payment";
  if (/\\b(reserva|retirar|horario|dia|data)\\b/.test(text)) return "reservation";
  return null;
}

function repasseDetectIphoneModel(text, context) {
  const joined = [text, context.lastMessageContent, context.summaryShort, context.summaryOperational, context.previousDesiredModel].filter(Boolean).join(" ");
  const normalized = normalizeFreeText(joined);
  const direct = normalizeFreeText(text);
  const hasIphoneContext = /\\b(iphone|17|16|15|14|13|12|11)\\b/.test(normalized);
  const generationMatch = normalized.match(/\\b(?:iphone\\s*)?(1[1-7])\\s*(pro\\s*max|promax|pro|max|plus)?\\b/);
  if (generationMatch) {
    const generation = generationMatch[1];
    const variant = normalizeFreeText(generationMatch[2] ?? "");
    if (variant === "pro max" || variant === "promax") return "iPhone " + generation + " Pro Max";
    if (variant === "pro") return "iPhone " + generation + " Pro";
    if (variant === "plus") return "iPhone " + generation + " Plus";
    if (variant === "max" && /pro\\s*max/.test(normalized)) return "iPhone " + generation + " Pro Max";
    return "iPhone " + generation;
  }
  if (/\\bpro\\s*max\\b/.test(direct) && context.previousDesiredModel) {
    const generation = String(context.previousDesiredModel).match(/\\b(1[1-7])\\b/)?.[1];
    return generation ? "iPhone " + generation + " Pro Max" : null;
  }
  if (/\\bpro\\b/.test(direct) && hasIphoneContext) {
    const generation = String(context.previousDesiredModel ?? context.lastMessageContent ?? "").match(/\\b(1[1-7])\\b/)?.[1];
    return generation ? "iPhone " + generation + " Pro" : null;
  }
  return null;
}

function repasseDetectCapacity(text) {
  const normalized = normalizeFreeText(text);
  if (/\\b(1tb|1 tb|1000gb|1000 gb)\\b/.test(normalized)) return "1TB";
  const match = normalized.match(/\\b(128|256|512)\\s*(gb)?\\b/);
  return match ? match[1] + "GB" : null;
}

function repasseDetectCapacityConstraint(text) {
  const normalized = normalizeFreeText(text);
  return /\\b(maior|acima|mais)\\b.*\\b256\\b|\\b256\\b.*\\b(maior|acima|mais)\\b/.test(normalized)
    ? "greater_than_256GB"
    : null;
}

function repasseDetectColor(text) {
  const normalized = normalizeFreeText(text);
  if (/\\b(preto|black|titanio preto)\\b/.test(normalized)) return "preto";
  if (/\\b(branco|white)\\b/.test(normalized)) return "branco";
  if (/\\b(natural|titanio natural)\\b/.test(normalized)) return "natural";
  if (/\\b(azul|blue)\\b/.test(normalized)) return "azul";
  if (/\\b(rosa|pink)\\b/.test(normalized)) return "rosa";
  if (/\\b(verde|green)\\b/.test(normalized)) return "verde";
  if (/\\b(dourado|gold)\\b/.test(normalized)) return "dourado";
  return null;
}

function repasseHasNonPurchaseSignal(text) {
  const normalized = normalizeFreeText(text);
  return /\\b(vender|vendo|venda|avaliar|avaliacao|quanto vale|repasse|conserto|reparo|garantia|defeito|comprovante|pix pago|suporte)\\b/.test(normalized);
}

const repasseLastMessageContent = String(inputData.last_message_content ?? inputData.lastMessageContent ?? memory.last_message_content ?? "");
const repasseSummaryShort = String(memory.summary_short ?? inputData.summary_short ?? "");
const repasseSummaryOperational = String(memory.summary_operational ?? inputData.summary_operational ?? "");
const repasseLastQuestionKind = repasseDetectLastQuestionKind(repasseLastMessageContent);
const repasseDetectedModel = repasseDetectIphoneModel(currentMessageRaw, {
  lastMessageContent: repasseLastMessageContent,
  summaryShort: repasseSummaryShort,
  summaryOperational: repasseSummaryOperational,
  previousDesiredModel: memory.desired_model,
});
const repasseDetectedCapacity = repasseDetectCapacity(currentMessageRaw);
const repasseDetectedCapacityConstraint = repasseDetectCapacityConstraint(currentMessageRaw);
const repasseDetectedColor = repasseDetectColor(currentMessageRaw);

if (!memory.desired_model && repasseDetectedModel) memory.desired_model = repasseDetectedModel;
if ((repasseLastQuestionKind === "desired_model" || /iphone|1[1-7]/i.test(currentMessageRaw)) && repasseDetectedModel) {
  memory.desired_model = repasseDetectedModel;
}
if (!memory.desired_capacity && repasseDetectedCapacity) memory.desired_capacity = repasseDetectedCapacity;
if (repasseLastQuestionKind === "desired_capacity" && repasseDetectedCapacity) memory.desired_capacity = repasseDetectedCapacity;
if (repasseDetectedCapacityConstraint) memory.capacity_constraint = repasseDetectedCapacityConstraint;
if (!memory.desired_color && repasseDetectedColor) memory.desired_color = repasseDetectedColor;
if (repasseLastQuestionKind === "desired_color" && repasseDetectedColor) memory.desired_color = repasseDetectedColor;

const repassePurchaseSideModel = Boolean(memory.desired_model) && !repasseHasNonPurchaseSignal(currentMessageRaw);
if (repassePurchaseSideModel) {
  memory.desired_device_type = "iphone";
  memory.intent = ["aparelho_iphone", "aparelho_outro"].includes(memory.intent) ? memory.intent : "aparelho_iphone";
  if (!memory.interest_type) memory.interest_type = "comprar";
}
${GUARDRAIL_MARKER_END}`;

export const BIA1_STOCK_SAFETY_PROMPT = `\n\n=== REGRAS DE SEGURANCA DE ESTOQUE ===\n- Nunca afirme que temos modelo, capacidade, cor, preco, condicao ou cidade de estoque sem pre_inventory ou last_inventory_context.\n- Nunca liste capacidades fixas como 128, 256 ou 512GB se essas opcoes nao vieram de pre_inventory.available_capacities ou last_inventory_context.\n- Se faltar armazenamento e nao houver opcoes de estoque, pergunte de forma neutra: \"Qual armazenamento voce procura para o {{ $json.desired_model ?? 'iPhone' }}?\"\n- Se houver pre_inventory.available_capacities, mencione somente essas capacidades.\n- Pre-consulta nao e reserva e nao confirma separacao. Use como contexto para nortear a proxima pergunta.\n`;
```

- [ ] **Step 2: Commit**

Run:

```bash
git add scripts/n8n/repasse-memory-guardrails.mjs
git commit -m "feat: add repasse memory guardrail helpers"
```

Expected: commit succeeds with one new script.

### Task 2: Add Fixture Tests

**Files:**
- Create: `scripts/n8n/test-repasse-memory-guardrails.mjs`

- [ ] **Step 1: Add executable fixture tests**

Create `scripts/n8n/test-repasse-memory-guardrails.mjs` with:

```js
import assert from "node:assert/strict";
import { applyRepasseMemoryGuardrails } from "./repasse-memory-guardrails.mjs";

const cases = [
  {
    name: "model answer after Bia model question triggers precheck",
    input: {
      memory: { intent: "aparelho_iphone", interest_type: null, desired_model: null },
      last_message_content: "Faltou só me dizer: é o 17, o Pro ou o Pro Max?",
      message_buffered: "17 pro",
    },
    expected: {
      desired_model: "iPhone 17 Pro",
      interest_type: "comprar",
      shouldPrecheckInventory: true,
      routing_decision: "precheck_inventory_before_bia1",
    },
  },
  {
    name: "availability question captures model and capacity",
    input: {
      memory: { intent: "aparelho_iphone", interest_type: null },
      last_message_content: "Qual armazenamento voce procura para o iPhone 17 Pro?",
      message_buffered: "tem 17 pro 512?",
    },
    expected: {
      desired_model: "iPhone 17 Pro",
      desired_capacity: "512GB",
      shouldPrecheckInventory: true,
    },
  },
  {
    name: "greater than 256 preserves capacity constraint",
    input: {
      memory: { intent: "aparelho_iphone", desired_model: "iPhone 17 Pro" },
      last_message_content: "Qual armazenamento voce procura para o iPhone 17 Pro?",
      message_buffered: "tem maior que 256?",
    },
    expected: {
      desired_model: "iPhone 17 Pro",
      capacity_constraint: "greater_than_256GB",
      shouldPrecheckInventory: true,
    },
  },
  {
    name: "city answer captures preferred city",
    input: {
      memory: { intent: "aparelho_iphone", desired_model: "iPhone 17 Pro", interest_type: "comprar" },
      last_message_content: "Qual cidade fica melhor para retirada?",
      message_buffered: "fortaleza",
    },
    expected: {
      preferred_city: "Fortaleza",
      shouldPrecheckInventory: true,
    },
  },
  {
    name: "sell intent does not force purchase precheck",
    input: {
      memory: { intent: "aparelho_iphone", interest_type: "vender" },
      last_message_content: "Como posso ajudar?",
      message_buffered: "quero vender meu 17 pro",
    },
    expected: {
      shouldPrecheckInventory: undefined,
      interest_type: "vender",
    },
  },
];

for (const testCase of cases) {
  const actual = applyRepasseMemoryGuardrails(testCase.input);
  for (const [key, expectedValue] of Object.entries(testCase.expected)) {
    assert.equal(actual[key], expectedValue, `${testCase.name}: ${key}`);
  }
}

console.log(`repasse-memory-guardrails: ${cases.length} cases passed`);
```

- [ ] **Step 2: Run tests**

Run:

```bash
node scripts/n8n/test-repasse-memory-guardrails.mjs
```

Expected:

```text
repasse-memory-guardrails: 5 cases passed
```

- [ ] **Step 3: Commit**

Run:

```bash
git add scripts/n8n/test-repasse-memory-guardrails.mjs
git commit -m "test: cover repasse memory guardrails"
```

Expected: commit succeeds with one new test script.

### Task 3: Add n8n API Patch Script

**Files:**
- Create: `scripts/n8n/apply-repasse-memory-guardrails.mjs`
- Modify remote workflow: `ia repasse-pro` (`oWNdWPUq6kEFitsnl8OpH`)

- [ ] **Step 1: Add patch script**

Create `scripts/n8n/apply-repasse-memory-guardrails.mjs` with:

```js
import fs from "node:fs";
import path from "node:path";
import {
  BIA1_STOCK_SAFETY_PROMPT,
  GUARDRAIL_MARKER_END,
  GUARDRAIL_MARKER_START,
  N8N_GUARDRAIL_BLOCK,
} from "./repasse-memory-guardrails.mjs";

const WORKFLOW_ID = "oWNdWPUq6kEFitsnl8OpH";
const N8N_BASE_URL = "https://iatende-n8n.ylgf5w.easypanel.host";

function readEnvFile(filePath) {
  const env = {};
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

function replaceMarkedBlock(source, block) {
  const start = source.indexOf(GUARDRAIL_MARKER_START);
  const end = source.indexOf(GUARDRAIL_MARKER_END);
  if (start !== -1 && end !== -1 && end > start) {
    return source.slice(0, start).trimEnd() + "\n\n" + block + "\n\n" + source.slice(end + GUARDRAIL_MARKER_END.length).trimStart();
  }
  const insertionPoint = source.indexOf("const needsClientCityBeforeStock =");
  if (insertionPoint === -1) {
    throw new Error("Could not find Parse Memory insertion point");
  }
  return source.slice(0, insertionPoint).trimEnd() + "\n\n" + block + "\n\n" + source.slice(insertionPoint);
}

function ensureBiaPromptSafetyBlock(prompt) {
  if (prompt.includes("=== REGRAS DE SEGURANCA DE ESTOQUE ===")) return prompt;
  return prompt.trimEnd() + BIA1_STOCK_SAFETY_PROMPT;
}

function stripReadOnlyWorkflowFields(workflow) {
  const {
    createdAt,
    updatedAt,
    id,
    versionId,
    triggerCount,
    shared,
    ownedBy,
    homeProject,
    usedCredentials,
    ...body
  } = workflow;
  return body;
}

async function n8nFetch(pathname, options = {}) {
  const env = readEnvFile(path.resolve(".env.local"));
  const apiKey = env.N8N_PUBLIC_API;
  if (!apiKey) throw new Error("N8N_PUBLIC_API missing from .env.local");

  const response = await fetch(`${N8N_BASE_URL}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-N8N-API-KEY": apiKey,
      ...(options.headers ?? {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`n8n API ${response.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

const workflow = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const backupPath = `/tmp/repasse-workflow-${WORKFLOW_ID}-${Date.now()}.json`;
fs.writeFileSync(backupPath, JSON.stringify(workflow, null, 2));

const parseMemory = workflow.nodes.find(node => node.name === "Parse Memory");
if (!parseMemory) throw new Error("Parse Memory node not found");
parseMemory.parameters.jsCode = replaceMarkedBlock(parseMemory.parameters.jsCode, N8N_GUARDRAIL_BLOCK);

const bia1 = workflow.nodes.find(node => node.name === "Bia 1");
if (!bia1) throw new Error("Bia 1 node not found");
bia1.parameters.text = ensureBiaPromptSafetyBlock(bia1.parameters.text);

const body = stripReadOnlyWorkflowFields(workflow);
const updated = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`, {
  method: "PUT",
  body: JSON.stringify(body),
});

console.log(JSON.stringify({
  workflowId: updated.id,
  name: updated.name,
  active: updated.active,
  backupPath,
  parseMemoryPatched: updated.nodes.some(node => node.name === "Parse Memory" && node.parameters.jsCode.includes(GUARDRAIL_MARKER_START)),
  bia1Patched: updated.nodes.some(node => node.name === "Bia 1" && node.parameters.text.includes("=== REGRAS DE SEGURANCA DE ESTOQUE ===")),
}, null, 2));
```

- [ ] **Step 2: Run patch script**

Run:

```bash
node scripts/n8n/apply-repasse-memory-guardrails.mjs
```

Expected:

```json
{
  "workflowId": "oWNdWPUq6kEFitsnl8OpH",
  "name": "ia repasse-pro",
  "active": true,
  "backupPath": "/tmp/repasse-workflow-oWNdWPUq6kEFitsnl8OpH-<timestamp>.json",
  "parseMemoryPatched": true,
  "bia1Patched": true
}
```

- [ ] **Step 3: Commit script**

Run:

```bash
git add scripts/n8n/apply-repasse-memory-guardrails.mjs
git commit -m "chore: add n8n repasse workflow patcher"
```

Expected: commit succeeds with one new script.

### Task 4: Verify Remote Workflow

**Files:**
- No local file changes.
- Verify remote workflow: `ia repasse-pro` (`oWNdWPUq6kEFitsnl8OpH`)

- [ ] **Step 1: Re-fetch workflow through MCP**

Use `mcp__n8n.get_workflow_details` for workflow `oWNdWPUq6kEFitsnl8OpH`.

Expected:

- Workflow remains active.
- Trigger remains `POST /webhook/repasse`.
- `Parse Memory` contains `REPASSE MEMORY GUARDRAILS START`.
- `Bia 1` prompt contains `REGRAS DE SEGURANCA DE ESTOQUE`.

- [ ] **Step 2: Re-fetch workflow through public API**

Run:

```bash
set -a
source .env.local
set +a
curl -fsS -H "X-N8N-API-KEY: $N8N_PUBLIC_API" \
  "https://iatende-n8n.ylgf5w.easypanel.host/api/v1/workflows/oWNdWPUq6kEFitsnl8OpH" \
  -o /tmp/repasse_workflow_after_guardrails.json
jq '{
  active,
  parseMemoryPatched: (.nodes[] | select(.name=="Parse Memory") | .parameters.jsCode | contains("REPASSE MEMORY GUARDRAILS START")),
  bia1Patched: (.nodes[] | select(.name=="Bia 1") | .parameters.text | contains("REGRAS DE SEGURANCA DE ESTOQUE"))
}' /tmp/repasse_workflow_after_guardrails.json
```

Expected:

```json
{
  "active": true,
  "parseMemoryPatched": true,
  "bia1Patched": true
}
```

- [ ] **Step 3: Final git status**

Run:

```bash
git status --short
```

Expected: no uncommitted local changes.
