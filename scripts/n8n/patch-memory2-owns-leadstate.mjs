import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Move lead_state ownership to the Memory 2 - Reconciler agent.
//
// Why (exec 405793): Memory 2 emitted only the 6 mandatory routing fields
// (intent/context_ready/missing_fields/next_best_action/summary_short/
// summary_operational) and dropped the structured state (desired_model,
// tradein_model, has_tradein, interest_type, all tradein_* evaluation fields).
// So `Code Parse Memory 2`.memory was effectively empty of state every turn and
// the pipeline relied on Parse Memory re-deriving fields by regex — lossy for
// anything the regex doesn't cover (battery %, scratches, card brand, etc.).
//
// Change:
//   Memory 2  -> its JSON output IS the full reconciled lead_state (copy prior
//                state, overlay only what changed, never omit a field).
//   Code Parse Memory 2 -> pure extraction of the delivered fields; graceful on
//                parse failure; still passes prior lead_state + last_message_content
//                so Parse Memory's deterministic net/guardrails keep working.
//
// Scope: one agent prompt + one Code node. Parse Memory keeps its preserve()/
// guardrails as the safety net (no change to that node).

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const EXPORT_PATH = 'output/n8n/ia-repasse-pro-v2-current.json';
const CP2_CODE_FILE = 'scripts/n8n/repasse-code-parse-memory-2.js';

const MEMORY_2 = 'Memory 2 - Reconciler';
const CODE_PARSE_MEMORY_2 = 'Code Parse Memory 2';

// --- Memory 2 prompt: schema instruction ---
const M2_SCHEMA_OLD = `Retorne apenas JSON valido, sem markdown. O JSON deve conter obrigatoriamente:
{"intent":"aparelho_iphone|aparelho_outro|fora_do_escopo|garantia|suporte|pos_venda|administrativo|spam|desconhecida","context_ready":false,"missing_fields":[],"next_best_action":"acao curta","summary_short":"resumo curto","summary_operational":"resumo operacional curto"}`;
const M2_SCHEMA_NEW = `Voce e o DONO do lead_state: sua saida E o lead_state atualizado. Copie o LEAD_STATE ATUAL e sobreponha apenas o que mudou nesta rodada (memory_extraction + mensagem atual). NUNCA omita um campo que ja existe no LEAD_STATE ATUAL nem deixe de devolver o estado inteiro.

Retorne apenas JSON valido, sem markdown. O JSON deve conter obrigatoriamente estes campos de roteamento:
{"intent":"aparelho_iphone|aparelho_outro|fora_do_escopo|garantia|suporte|pos_venda|administrativo|spam|desconhecida","context_ready":false,"missing_fields":[],"next_best_action":"acao curta","summary_short":"resumo curto","summary_operational":"resumo operacional curto"}`;

// --- Memory 2 prompt: state fields must be carried, not optional ---
const M2_FIELDS_OLD = `- Voce pode incluir campos semanticos relevantes como desired_model, desired_capacity, desired_color, desired_condition, preferred_city, card_brand, interest_type, tradein_model, tradein_capacity, tradein_color, tradein_battery_pct, cash_entry_intent, cash_entry_amount, proposal_accepted, reservation_intent, pix_paid.`;
const M2_FIELDS_NEW = `- Voce DEVE incluir e preservar TODOS os campos de estado que existirem ou mudarem, devolvendo o lead_state completo: interest_type, desired_model, desired_capacity, desired_color, desired_condition, desired_devices, simulation_mode, preferred_city, card_brand, has_tradein, tradein_model, tradein_capacity, tradein_color, tradein_battery_pct, tradein_scratches, tradein_liquid_contact, tradein_side_marks, tradein_parts_swapped, tradein_has_box_cable, tradein_apple_warranty, tradein_warranty_until, cash_entry_intent, cash_entry_amount, proposal_accepted, reservation_intent, pix_paid, pix_amount. Campo ausente no LEAD_STATE ATUAL e sem evidencia nova = null; nunca omita o campo.`;

const M2_MARKER = 'Voce e o DONO do lead_state';
const CP2_MARKER = 'Code Parse Memory 2 (v2 — extraction only)';

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
    'saveExecutionProgress', 'saveManualExecutions', 'saveDataErrorExecution',
    'saveDataSuccessExecution', 'executionTimeout', 'errorWorkflow', 'timezone', 'executionOrder',
  ];
  const settings = Object.fromEntries(
    Object.entries(workflow.settings ?? {}).filter(([key]) => allowedSettings.includes(key)),
  );
  const body = { name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings };
  if (workflow.staticData) body.staticData = workflow.staticData;
  return body;
}

async function api(origin, key, path, init = {}) {
  const response = await fetch(new URL(path, origin), {
    ...init,
    headers: { 'X-N8N-API-KEY': key, 'content-type': 'application/json', ...(init.headers || {}) },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${init.method || 'GET'} ${path} failed: ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

function replaceOnce(label, haystack, oldStr, newStr) {
  if (!haystack.includes(oldStr)) throw new Error(`${label}: expected text not found (workflow drifted?)`);
  if (haystack.split(oldStr).length - 1 !== 1) throw new Error(`${label}: target not unique`);
  return haystack.replace(oldStr, newStr);
}

async function patchWorkflow(workflow) {
  const results = {};

  // Memory 2 prompt
  const m2 = workflow.nodes.find((n) => n.name === MEMORY_2);
  if (!m2) throw new Error(`Node not found: ${MEMORY_2}`);
  let sys = m2.parameters?.options?.systemMessage;
  if (typeof sys !== 'string') throw new Error(`${MEMORY_2} has no systemMessage`);
  if (sys.includes(M2_MARKER)) {
    results.memory2 = { already: true };
  } else {
    sys = replaceOnce(`${MEMORY_2} schema`, sys, M2_SCHEMA_OLD, M2_SCHEMA_NEW);
    sys = replaceOnce(`${MEMORY_2} fields`, sys, M2_FIELDS_OLD, M2_FIELDS_NEW);
    m2.parameters.options.systemMessage = sys;
    results.memory2 = { already: false };
  }
  // Validator markers must survive.
  for (const marker of ['REPASSE V2 MULTI DEVICE RECONCILIATION', 'tradein_has_box_cable', 'tradein_apple_warranty']) {
    if (!m2.parameters.options.systemMessage.includes(marker)) throw new Error(`${MEMORY_2} lost validator marker: ${marker}`);
  }

  // Code Parse Memory 2 — full replace from raw code file
  const cp2 = workflow.nodes.find((n) => n.name === CODE_PARSE_MEMORY_2);
  if (!cp2) throw new Error(`Node not found: ${CODE_PARSE_MEMORY_2}`);
  if (cp2.type !== 'n8n-nodes-base.code') throw new Error(`${CODE_PARSE_MEMORY_2} must be a Code node`);
  const newCp2 = await readFile(CP2_CODE_FILE, 'utf8');
  if (!newCp2.includes(CP2_MARKER)) throw new Error('cp2 code file missing marker');
  new Function(newCp2); // syntax assert
  if ((cp2.parameters.jsCode || '').includes(CP2_MARKER)) {
    results.codeParseMemory2 = { already: true };
  } else {
    cp2.parameters.jsCode = newCp2;
    results.codeParseMemory2 = { already: false };
  }

  return results;
}

const env = parseEnv(await readFile('.env.local', 'utf8'));
const key = env.N8N_API_KEY || env.N8N_PUBLIC_API;
const origin = new URL(env.N8N_BASE_URL || env.N8N_MCP_URL).origin;
if (!key) throw new Error('Missing N8N_API_KEY');

const workflow = await api(origin, key, `/api/v1/workflows/${WORKFLOW_ID}`);
await mkdir('output/n8n/backups', { recursive: true });
const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-memory2-owns-leadstate-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await writeFile(backupPath, `${JSON.stringify(workflow, null, 2)}\n`);

const results = await patchWorkflow(workflow);

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, backupPath, results }, null, 2));
  process.exit(0);
}

const updated = await api(origin, key, `/api/v1/workflows/${WORKFLOW_ID}`, {
  method: 'PUT', body: JSON.stringify(sanitizeForUpdate(workflow)),
});
let active = updated.active;
if (!active) {
  const activated = await api(origin, key, `/api/v1/workflows/${WORKFLOW_ID}/activate`, { method: 'POST' });
  active = Boolean(activated?.active ?? true);
}
const fresh = await api(origin, key, `/api/v1/workflows/${WORKFLOW_ID}`);
await writeFile(EXPORT_PATH, `${JSON.stringify(fresh, null, 2)}\n`);

console.log(JSON.stringify({
  patched: true, workflowId: WORKFLOW_ID, results, active, backupPath, exportPath: EXPORT_PATH, updatedAt: updated.updatedAt,
}, null, 2));
