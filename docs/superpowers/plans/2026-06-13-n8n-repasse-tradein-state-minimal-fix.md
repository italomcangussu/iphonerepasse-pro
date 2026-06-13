# n8n Repasse Trade-In State Minimal Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Patch workflow `ia repasse-pro v2 avancada` so trade-in answers populate `tradein_*` while preserving the desired purchase model.

**Architecture:** This is a minimal n8n workflow patch. Modify only two Code nodes: `Code Parse Memory 2` for prior state reading and `Parse Memory` for trade-in context classification/model mapping. Validate with execution `405671` evidence before applying and inspect the workflow after applying.

**Tech Stack:** n8n API/plugin, JavaScript Code nodes, zsh, `curl`, `jq`, Node.js for local JSON transformation.

---

## File Structure

- Modify remote n8n workflow `Cr4fPWe0prwS6XjI`.
- Do not modify app source files.
- Temporary local files may be written under `/tmp/repasse-tradein-state-fix/`:
  - `workflow-before.json`: fetched workflow before patch.
  - `workflow-after.json`: patched workflow candidate.
  - `workflow-update-payload.json`: sanitized n8n API update payload.
  - `workflow-diff.txt`: readable diff for review.
  - `backup-before-update.json`: local rollback copy if direct API fallback is needed.

## Task 1: Prepare Workflow Patch Candidate

**Files:**
- Remote workflow node: `Code Parse Memory 2`
- Remote workflow node: `Parse Memory`
- Temporary: `/tmp/repasse-tradein-state-fix/workflow-before.json`
- Temporary: `/tmp/repasse-tradein-state-fix/workflow-after.json`

- [ ] **Step 1: Fetch the current workflow**

Run:

```bash
mkdir -p /tmp/repasse-tradein-state-fix
set -a
source .env.local
set +a
curl -fsS \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "${N8N_BASE_URL%/}/api/v1/workflows/Cr4fPWe0prwS6XjI" \
  > /tmp/repasse-tradein-state-fix/workflow-before.json
cp /tmp/repasse-tradein-state-fix/workflow-before.json /tmp/repasse-tradein-state-fix/backup-before-update.json
jq -r '.name + " nodes=" + ((.nodes | length) | tostring)' /tmp/repasse-tradein-state-fix/workflow-before.json
```

Expected output includes:

```text
ia repasse-pro v2 avancada nodes=140
```

- [ ] **Step 2: Patch the two Code nodes locally**

Run this Node.js transformation:

```bash
node <<'NODE'
const fs = require('fs');

const beforePath = '/tmp/repasse-tradein-state-fix/workflow-before.json';
const afterPath = '/tmp/repasse-tradein-state-fix/workflow-after.json';
const workflow = JSON.parse(fs.readFileSync(beforePath, 'utf8'));

function nodeByName(name) {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  if (!node) throw new Error(`Node not found: ${name}`);
  if (!node.parameters || typeof node.parameters.jsCode !== 'string') {
    throw new Error(`Node has no jsCode: ${name}`);
  }
  return node;
}

const parseMemory2 = nodeByName('Code Parse Memory 2');
parseMemory2.parameters.jsCode = parseMemory2.parameters.jsCode.replace(
`function readLeadState() {
  if ($json.lead_state && typeof $json.lead_state === 'object') {
    return $json.lead_state;
  }

  try {
    const crm = $('CRM Leads GET').last().json;
    return crm.lead_state ?? crm.data?.lead_state ?? {};
  } catch (e) {
    return {};
  }
}`,
`function firstNonEmptyPlainObject(...values) {
  return values.find(value =>
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  ) ?? {};
}

function readLeadState() {
  return firstNonEmptyPlainObject(
    $json.lead_state,
    $json.lead?.lead_state,
    (() => {
      try {
        const crm = $('CRM Leads GET').last().json;
        return firstNonEmptyPlainObject(
          crm.lead_state,
          crm.data?.lead_state,
          crm.data?.items?.[0]?.lead_state
        );
      } catch (e) {
        return {};
      }
    })()
  );
}`
);

if (!parseMemory2.parameters.jsCode.includes('crm.data?.items?.[0]?.lead_state')) {
  throw new Error('Code Parse Memory 2 patch did not apply');
}

const parseMemory = nodeByName('Parse Memory');
parseMemory.parameters.jsCode = parseMemory.parameters.jsCode.replace(
`function readLeadStateFromCrm() {
  try {
    if (typeof $ === "function") {
      const crm = $("CRM Leads GET").last().json;
      return crm.lead_state ?? crm.data?.lead_state ?? {};
    }
  } catch (e) {
    return {};
  }
  return {};
}

const prev = clonePlain(inputData?.lead_state ?? inputData?.data?.lead_state ?? readLeadStateFromCrm());`,
`function firstNonEmptyPlainObject(...values) {
  return values.find(value =>
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  ) ?? {};
}

function readLeadStateFromCrm() {
  try {
    if (typeof $ === "function") {
      const crm = $("CRM Leads GET").last().json;
      return firstNonEmptyPlainObject(
        crm.lead_state,
        crm.data?.lead_state,
        crm.data?.items?.[0]?.lead_state
      );
    }
  } catch (e) {
    return {};
  }
  return {};
}

const prev = clonePlain(firstNonEmptyPlainObject(
  inputData?.lead_state,
  inputData?.lead?.lead_state,
  inputData?.data?.lead_state,
  inputData?.data?.items?.[0]?.lead_state,
  readLeadStateFromCrm()
));`
);

parseMemory.parameters.jsCode = parseMemory.parameters.jsCode.replace(
`function repasseDetectLastQuestionKind(lastMessageContent) {
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
}`,
`function repasseDetectLastQuestionKind(lastMessageContent) {
  const text = normalizeFreeText(lastMessageContent);
  if (!text) return null;
  if (/\\b(troca|trocar|aparelho atual|seu aparelho|iphone que voce vai trocar|modelo do iphone que voce vai trocar)\\b/.test(text)) return "tradein";
  if (/\\b(dar|daria|deixar|usar|oferecer|oferecera)\\b.*\\b(entrada|troca)\\b/.test(text)) return "tradein";
  if (/\\b(entrada|troca)\\b.*\\b(aparelho|iphone|celular)\\b/.test(text)) return "tradein";
  if (/\\b(modelo|qual iphone|e o 17|pro ou pro max)\\b/.test(text)) return "desired_model";
  if (/\\b(armazenamento|capacidade|gb|128|256|512|1tb|1 tb)\\b/.test(text)) return "desired_capacity";
  if (/\\b(cor|cores|preto|branco|natural|azul|rosa|verde|titanio)\\b/.test(text)) return "desired_color";
  if (/\\b(cidade|retirada|qual loja|fortaleza|sobral)\\b/.test(text)) return "preferred_city";
  if (/\\b(bateria|arranho|arranhoes|lateral|liquido|peca|caixa|cabo|garantia apple)\\b/.test(text)) return "tradein";
  if (/\\b(nome completo|cpf|nascimento|cadastro|contato)\\b/.test(text)) return "cadastro";
  if (/\\b(entrada|pix|cartao|bandeira|visa|master|simulacao|simular)\\b/.test(text)) return "payment";
  if (/\\b(reserva|retirar|horario|dia|data)\\b/.test(text)) return "reservation";
  return null;
}`
);

parseMemory.parameters.jsCode = parseMemory.parameters.jsCode.replace(
`if (!memory.desired_model && repasseDetectedModel) memory.desired_model = repasseDetectedModel;
if ((repasseLastQuestionKind === "desired_model" || /iphone|1[1-7]/i.test(currentMessageRaw)) && repasseDetectedModel) {
  memory.desired_model = repasseDetectedModel;
}`,
`if (repasseLastQuestionKind === "tradein" && repasseDetectedModel) {
  memory.has_tradein = true;
  if (!memory.tradein_model) memory.tradein_model = repasseDetectedModel;
} else {
  if (!memory.desired_model && repasseDetectedModel) memory.desired_model = repasseDetectedModel;
  if ((repasseLastQuestionKind === "desired_model" || /iphone|1[1-7]/i.test(currentMessageRaw)) && repasseDetectedModel) {
    memory.desired_model = repasseDetectedModel;
  }
}`
);

if (!parseMemory.parameters.jsCode.includes('repasseLastQuestionKind === "tradein" && repasseDetectedModel')) {
  throw new Error('Parse Memory trade-in mapping patch did not apply');
}

fs.writeFileSync(afterPath, JSON.stringify(workflow, null, 2));
console.log('workflow-after.json written');
NODE
```

Expected output:

```text
workflow-after.json written
```

## Task 2: Review Diff And Apply

**Files:**
- Temporary: `/tmp/repasse-tradein-state-fix/workflow-diff.txt`
- Temporary: `/tmp/repasse-tradein-state-fix/workflow-update-payload.json`
- Remote workflow: `Cr4fPWe0prwS6XjI`

- [ ] **Step 1: Generate focused diff**

Run:

```bash
diff -u \
  <(jq '.nodes[] | select(.name=="Code Parse Memory 2" or .name=="Parse Memory") | {name, jsCode: .parameters.jsCode}' /tmp/repasse-tradein-state-fix/workflow-before.json) \
  <(jq '.nodes[] | select(.name=="Code Parse Memory 2" or .name=="Parse Memory") | {name, jsCode: .parameters.jsCode}' /tmp/repasse-tradein-state-fix/workflow-after.json) \
  | tee /tmp/repasse-tradein-state-fix/workflow-diff.txt
```

Expected: diff only touches `readLeadState()`, `repasseDetectLastQuestionKind()`, and the detected model assignment block.

- [ ] **Step 2: Create sanitized API payload**

Run:

```bash
jq '{name, nodes, connections, settings: (.settings | del(.timeSavedMode)), staticData}' \
  /tmp/repasse-tradein-state-fix/workflow-after.json \
  > /tmp/repasse-tradein-state-fix/workflow-update-payload.json
jq '{keys: keys, settings}' /tmp/repasse-tradein-state-fix/workflow-update-payload.json
```

Expected keys and settings:

```json
{
  "keys": [
    "connections",
    "name",
    "nodes",
    "settings",
    "staticData"
  ],
  "settings": {
    "executionOrder": "v1",
    "availableInMCP": false,
    "callerPolicy": "workflowsFromSameOwner"
  }
}
```

The GET response can include `settings.timeSavedMode`; remove it because the public API schema rejects it on update.

- [ ] **Step 3: Apply workflow update**

Prefer the n8n plugin full workflow update if the caller can pass the JSON object directly. If not practical due payload size, use the n8n API with the local backup already created in Task 1.

Run API fallback:

```bash
set -a
source .env.local
set +a
curl -fsS -X PUT \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/repasse-tradein-state-fix/workflow-update-payload.json \
  "${N8N_BASE_URL%/}/api/v1/workflows/Cr4fPWe0prwS6XjI" \
  | jq '{id, name, active, nodeCount: (.nodes | length), updatedAt}'
```

Expected output:

```json
{
  "id": "Cr4fPWe0prwS6XjI",
  "name": "ia repasse-pro v2 avancada",
  "active": true,
  "nodeCount": 140
}
```

## Task 3: Verify Patch

**Files:**
- Remote workflow: `Cr4fPWe0prwS6XjI`

- [ ] **Step 1: Fetch updated workflow and confirm patched code**

Run:

```bash
set -a
source .env.local
set +a
curl -fsS \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "${N8N_BASE_URL%/}/api/v1/workflows/Cr4fPWe0prwS6XjI" \
  | jq -r '.nodes[] | select(.name=="Code Parse Memory 2" or .name=="Parse Memory") | .parameters.jsCode' \
  | rg 'data\\?\\.items\\?\\.\\[0\\]\\?\\.lead_state|repasseLastQuestionKind === "tradein"'
```

Expected output includes both:

```text
crm.data?.items?.[0]?.lead_state
if (repasseLastQuestionKind === "tradein" && repasseDetectedModel) {
```

- [ ] **Step 2: Verify regression logic locally**

Run:

```bash
node <<'NODE'
function normalizeFreeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function repasseDetectLastQuestionKind(lastMessageContent) {
  const text = normalizeFreeText(lastMessageContent);
  if (!text) return null;
  if (/\b(troca|trocar|aparelho atual|seu aparelho|iphone que voce vai trocar|modelo do iphone que voce vai trocar)\b/.test(text)) return "tradein";
  if (/\b(dar|daria|deixar|usar|oferecer|oferecera)\b.*\b(entrada|troca)\b/.test(text)) return "tradein";
  if (/\b(entrada|troca)\b.*\b(aparelho|iphone|celular)\b/.test(text)) return "tradein";
  if (/\b(modelo|qual iphone|e o 17|pro ou pro max)\b/.test(text)) return "desired_model";
  return null;
}
function repasseDetectIphoneModel(text) {
  const normalized = normalizeFreeText(text);
  const generationMatch = normalized.match(/\b(?:iphone\s*)?(1[1-7])\s*(pro\s*max|promax|pro|max|plus)?\b/);
  if (!generationMatch) return null;
  const generation = generationMatch[1];
  const variant = normalizeFreeText(generationMatch[2] ?? "");
  if (variant === "pro max" || variant === "promax") return "iPhone " + generation + " Pro Max";
  if (variant === "pro") return "iPhone " + generation + " Pro";
  if (variant === "plus") return "iPhone " + generation + " Plus";
  return "iPhone " + generation;
}

const memory = {
  interest_type: "comprar",
  desired_model: "iPhone 16 Pro Max",
  has_tradein: false,
  tradein_model: null,
};
const lastQuestion = "Boa tarde, Ítalo! Você quer o 16 Pro Max e dar o seu como entrada — qual modelo do iPhone que você vai trocar?";
const currentMessage = "Vou dar um iPhone 14 na troca\nEle ta muito novo";
const kind = repasseDetectLastQuestionKind(lastQuestion);
const model = repasseDetectIphoneModel(currentMessage);
if (kind === "tradein" && model) {
  memory.has_tradein = true;
  if (!memory.tradein_model) memory.tradein_model = model;
}
console.log(JSON.stringify({ kind, model, memory }, null, 2));
if (memory.desired_model !== "iPhone 16 Pro Max") process.exit(1);
if (memory.has_tradein !== true) process.exit(1);
if (memory.tradein_model !== "iPhone 14") process.exit(1);
NODE
```

Expected output includes:

```json
"kind": "tradein"
"desired_model": "iPhone 16 Pro Max"
"has_tradein": true
"tradein_model": "iPhone 14"
```

## Task 4: Commit Plan Artifact

**Files:**
- Create: `docs/superpowers/plans/2026-06-13-n8n-repasse-tradein-state-minimal-fix.md`

- [ ] **Step 1: Commit the plan only**

Run:

```bash
git add docs/superpowers/plans/2026-06-13-n8n-repasse-tradein-state-minimal-fix.md
git commit -m "docs: plan minimal n8n trade-in state fix" -- docs/superpowers/plans/2026-06-13-n8n-repasse-tradein-state-minimal-fix.md
```

Expected: one commit containing only this plan file.
