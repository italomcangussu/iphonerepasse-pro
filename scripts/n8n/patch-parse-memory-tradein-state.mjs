import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Fix the trade-in -> desired_model swap that corrupts lead_state.
//
// Root cause (see docs/superpowers/specs/2026-06-13-... and CLAUDE.md n8n section):
// The trade-in/desired disambiguation guardrail in `Parse Memory` keys off
// `repasseLastQuestionKind`, which is derived from `repasseLastMessageContent`.
// That var only read `inputData.last_message_content / .lastMessageContent /
// memory.last_message_content` — none of which exist on Parse Memory's input
// (the langchain Agent emits only {output}; `Code Parse Memory 2` re-attaches
// only {lead_state, memory}). So it was always "" -> the "tradein" branch was
// dead, and the blanket `/iphone|1[1-7]/` overwrite pushed the trade-in model
// into desired_model. That state is then persisted via CRM Leads POST Lead_State.
//
// Patch A (Parse Memory):
//   A1 — read last_message_content from the real source ($('Edit Fields').lead).
//   A2 — make the model mapping trade-in-aware (current-message wording too) and
//        drop the blanket `/iphone|1[1-7]/` desired_model overwrite.
// Patch B (Code Parse Memory 2):
//   B1 — re-attach last_message_content to the output so inputData carries it.
//
// Scope: two Code nodes only. No prompt/schema/DB changes.

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const EXPORT_PATH = 'output/n8n/ia-repasse-pro-v2-current.json';

const PARSE_MEMORY = 'Parse Memory';
const CODE_PARSE_MEMORY_2 = 'Code Parse Memory 2';

// --- Patch A1: last_message_content source ---
const A1_OLD = `const repasseLastMessageContent = String(inputData.last_message_content ?? inputData.lastMessageContent ?? memory.last_message_content ?? "");`;
const A1_NEW = `function repasseReadLastMessageFromWorkflow() {
  try {
    if (typeof $ === "function") {
      return $("Edit Fields").last().json?.lead?.last_message_content ?? "";
    }
  } catch (e) {
    return "";
  }
  return "";
}
const repasseLastMessageContent = String(inputData.last_message_content ?? inputData.lastMessageContent ?? inputData.lead?.last_message_content ?? memory.last_message_content ?? repasseReadLastMessageFromWorkflow() ?? "");`;

// --- Patch A2: trade-in-aware model mapping ---
const A2_OLD = `if (repasseLastQuestionKind === "tradein" && repasseDetectedModel) {
  memory.has_tradein = true;
  if (!memory.tradein_model) memory.tradein_model = repasseDetectedModel;
} else {
  if (!memory.desired_model && repasseDetectedModel) memory.desired_model = repasseDetectedModel;
  if ((repasseLastQuestionKind === "desired_model" || /iphone|1[1-7]/i.test(currentMessageRaw)) && repasseDetectedModel) {
    memory.desired_model = repasseDetectedModel;
  }
}`;
const A2_NEW = `const repasseCurrentMentionsTradein = /\\b(troca|trocar|de entrada|na entrada|aparelho de entrada|dar de entrada|dando de entrada|de troca)\\b/.test(normalizeFreeText(currentMessageRaw));
const repasseIsTradeinTurn = repasseLastQuestionKind === "tradein" || repasseCurrentMentionsTradein;
if (repasseIsTradeinTurn && repasseDetectedModel) {
  memory.has_tradein = true;
  if (!memory.tradein_model) memory.tradein_model = repasseDetectedModel;
} else {
  if (!memory.desired_model && repasseDetectedModel) memory.desired_model = repasseDetectedModel;
  if (repasseLastQuestionKind === "desired_model" && repasseDetectedModel) {
    memory.desired_model = repasseDetectedModel;
  }
}`;

// --- Patch B1: re-attach last_message_content in Code Parse Memory 2 ---
const B1_OLD = `// Retorna mantendo todo o contexto anterior mais o memory parseado
return [{ json: { ...$json, lead_state: readLeadState(), memory } }];`;
const B1_NEW = `// Retorna mantendo todo o contexto anterior mais o memory parseado
function readLastMessageContent() {
  try {
    return $('Edit Fields').last().json?.lead?.last_message_content ?? null;
  } catch (e) {
    return null;
  }
}
return [{ json: { ...$json, last_message_content: readLastMessageContent(), lead_state: readLeadState(), memory } }];`;

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      let value = line.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      return [line.slice(0, index).trim(), value];
    }));
}

function sanitizeForUpdate(workflow) {
  const allowedSettings = [
    'saveExecutionProgress',
    'saveManualExecutions',
    'saveDataErrorExecution',
    'saveDataSuccessExecution',
    'executionTimeout',
    'errorWorkflow',
    'timezone',
    'executionOrder',
  ];
  const settings = Object.fromEntries(
    Object.entries(workflow.settings ?? {}).filter(([key]) => allowedSettings.includes(key)),
  );
  const body = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings,
  };
  if (workflow.staticData) body.staticData = workflow.staticData;
  return body;
}

async function api(origin, key, path, init = {}) {
  const response = await fetch(new URL(path, origin), {
    ...init,
    headers: {
      'X-N8N-API-KEY': key,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${init.method || 'GET'} ${path} failed: ${response.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

function getNode(workflow, name) {
  const node = workflow.nodes.find((item) => item.name === name);
  if (!node) throw new Error(`Node not found: ${name}`);
  if (node.type !== 'n8n-nodes-base.code') {
    throw new Error(`${name} must be a Code node; got ${node.type}`);
  }
  if (typeof node.parameters?.jsCode !== 'string') {
    throw new Error(`${name} has no jsCode`);
  }
  return node;
}

function applyReplacement(name, code, oldStr, newStr, alreadyMarker) {
  if (code.includes(alreadyMarker)) return { code, applied: false, already: true };
  if (!code.includes(oldStr)) {
    throw new Error(`${name}: expected old block not found (workflow drifted?). Marker: ${alreadyMarker}`);
  }
  if (code.split(oldStr).length - 1 !== 1) {
    throw new Error(`${name}: old block is not unique`);
  }
  return { code: code.replace(oldStr, newStr), applied: true, already: false };
}

function patchWorkflow(workflow) {
  const results = {};

  const pm = getNode(workflow, PARSE_MEMORY);
  let pmCode = pm.parameters.jsCode;
  const a1 = applyReplacement(PARSE_MEMORY + ' A1', pmCode, A1_OLD, A1_NEW, 'repasseReadLastMessageFromWorkflow');
  pmCode = a1.code;
  const a2 = applyReplacement(PARSE_MEMORY + ' A2', pmCode, A2_OLD, A2_NEW, 'repasseIsTradeinTurn');
  pmCode = a2.code;
  pm.parameters.jsCode = pmCode;
  new Function(pmCode); // syntax assert
  results.parseMemory = { a1: a1.applied, a2: a2.applied, alreadyA1: a1.already, alreadyA2: a2.already };

  const cp2 = getNode(workflow, CODE_PARSE_MEMORY_2);
  let cp2Code = cp2.parameters.jsCode;
  const b1 = applyReplacement(CODE_PARSE_MEMORY_2 + ' B1', cp2Code, B1_OLD, B1_NEW, 'function readLastMessageContent()');
  cp2Code = b1.code;
  cp2.parameters.jsCode = cp2Code;
  new Function(cp2Code); // syntax assert
  results.codeParseMemory2 = { b1: b1.applied, alreadyB1: b1.already };

  return results;
}

function assertPatched(workflow) {
  const pm = getNode(workflow, PARSE_MEMORY).parameters.jsCode;
  if (!pm.includes('repasseReadLastMessageFromWorkflow')) throw new Error('Parse Memory A1 missing after patch');
  if (!pm.includes('repasseIsTradeinTurn')) throw new Error('Parse Memory A2 missing after patch');
  if (pm.includes('/iphone|1[1-7]/i.test(currentMessageRaw)) && repasseDetectedModel')) {
    throw new Error('Parse Memory A2 still has the blanket overwrite (regression)');
  }
  if (!pm.includes('inputData.lead?.last_message_content')) throw new Error('Parse Memory A1 nested read missing');

  const cp2 = getNode(workflow, CODE_PARSE_MEMORY_2).parameters.jsCode;
  if (!cp2.includes('last_message_content: readLastMessageContent()')) throw new Error('Code Parse Memory 2 B1 missing after patch');
}

const env = parseEnv(await readFile('.env.local', 'utf8'));
const key = env.N8N_API_KEY || env.N8N_PUBLIC_API;
const origin = new URL(env.N8N_BASE_URL || env.N8N_MCP_URL).origin;
if (!key) throw new Error('Missing N8N_API_KEY or N8N_PUBLIC_API');

const workflow = await api(origin, key, `/api/v1/workflows/${WORKFLOW_ID}`);
await mkdir('output/n8n/backups', { recursive: true });
const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-tradein-state-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await writeFile(backupPath, `${JSON.stringify(workflow, null, 2)}\n`);

const results = patchWorkflow(workflow);
assertPatched(workflow);

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, backupPath, results }, null, 2));
  process.exit(0);
}

const updated = await api(origin, key, `/api/v1/workflows/${WORKFLOW_ID}`, {
  method: 'PUT',
  body: JSON.stringify(sanitizeForUpdate(workflow)),
});

let active = updated.active;
if (!active) {
  const activated = await api(origin, key, `/api/v1/workflows/${WORKFLOW_ID}/activate`, { method: 'POST' });
  active = Boolean(activated?.active ?? true);
}

// Re-export the live state so the structural validator runs against fresh truth.
const fresh = await api(origin, key, `/api/v1/workflows/${WORKFLOW_ID}`);
await writeFile(EXPORT_PATH, `${JSON.stringify(fresh, null, 2)}\n`);

console.log(JSON.stringify({
  patched: true,
  workflowId: WORKFLOW_ID,
  results,
  active,
  backupPath,
  exportPath: EXPORT_PATH,
  updatedAt: updated.updatedAt,
}, null, 2));
