import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Make `cash_entry_asked` a durable one-way latch in "Code Parse Memory 2".
//
// Bug (observed live 2026-06-19, conversation VD): the flash-lite
// "Memory 2 - Reconciler" set cash_entry_asked=true on the turn it asked about a
// cash down payment, then DROPPED it back to false on the following turns. Since
// the persistence RPC only coalesce-protects against null (not an explicit
// false), the latch was wiped. With cash_entry_asked=false the routing gate
// computes cashEntryResolved=false -> shouldSimulateNow=false, so the workflow
// REFUSED to run the simulation even though desired+trade-in+evaluation were all
// complete (it stalled with "vou verificar e já te passo a simulação").
//
// Fix: "Code Parse Memory 2" already reads the prior persisted lead_state via
// readLeadState(). Re-apply `prior OR current` for the latch right before the
// return so it can only ever flip to true, never silently un-ask. This is the
// deterministic safety net that was lost when the old "Parse Memory" node was
// removed (2026-06-14), scoped to just this sticky field.
//
// Idempotent: re-running detects the marker and no-ops. DRY=1 previews.

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const NODE_NAME = 'Code Parse Memory 2';
const MARKER = 'Sticky-latch preserve (2026-06-19)';

const ANCHOR = `} else if (!parsed.ok) {
  memory = { ...memory, parse_error: true, parse_error_reason: parsed.reason };
}

return [{`;

const REPLACEMENT = `} else if (!parsed.ok) {
  memory = { ...memory, parse_error: true, parse_error_reason: parsed.reason };
}

// ${MARKER}: cash_entry_asked is a one-way latch — once the AI has asked about a
// cash down payment, it must stay asked. The flash-lite "Memory 2 - Reconciler"
// intermittently drops it back to false on later turns, which makes
// cashEntryResolved=false and BLOCKS the simulation (see
// repasse-code-routing-flags.js). Re-apply prior OR current so it can only flip
// to true, never silently un-ask.
const __priorLeadState = readLeadState();
if (__priorLeadState && __priorLeadState.cash_entry_asked === true) {
  memory.cash_entry_asked = true;
}

return [{`;

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

const env = parseEnv(await readFile('.env.local', 'utf8'));
const key = env.N8N_API_KEY || env.N8N_PUBLIC_API;
const origin = new URL(env.N8N_BASE_URL || env.N8N_MCP_URL).origin;
if (!key) throw new Error('Missing N8N_API_KEY');

const workflow = await api(origin, key, `/api/v1/workflows/${WORKFLOW_ID}`);

const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`Node not found: ${NODE_NAME}`);
if (node.type !== 'n8n-nodes-base.code') throw new Error(`${NODE_NAME} is not a code node (got ${node.type})`);

const code = node.parameters?.jsCode;
if (typeof code !== 'string') throw new Error(`${NODE_NAME}: jsCode is not a string`);

if (code.includes(MARKER)) {
  console.log(JSON.stringify({ skipped: true, reason: 'already patched', workflowId: WORKFLOW_ID, node: NODE_NAME }, null, 2));
  process.exit(0);
}

const occurrences = code.split(ANCHOR).length - 1;
if (occurrences !== 1) {
  throw new Error(`${NODE_NAME}: expected exactly 1 anchor match, found ${occurrences} (workflow drifted? run the live guard)`);
}

const newCode = code.replace(ANCHOR, REPLACEMENT);

// Syntax assert — n8n Code node body runs as a function body.
try {
  // eslint-disable-next-line no-new-func
  new Function(newCode);
} catch (error) {
  throw new Error(`Patched jsCode failed syntax check: ${error.message}`);
}

node.parameters.jsCode = newCode;

await mkdir('output/n8n/backups', { recursive: true });
const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-cash-entry-latch-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await writeFile(backupPath, `${JSON.stringify(workflow, null, 2)}\n`);

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, backupPath, node: NODE_NAME, bytesBefore: code.length, bytesAfter: newCode.length }, null, 2));
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

console.log(JSON.stringify({
  patched: true, workflowId: WORKFLOW_ID, node: NODE_NAME,
  bytesBefore: code.length, bytesAfter: newCode.length, active, backupPath, updatedAt: updated.updatedAt,
}, null, 2));
