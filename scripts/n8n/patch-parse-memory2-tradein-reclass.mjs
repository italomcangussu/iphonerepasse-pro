import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Deterministic guard in "Code Parse Memory 2": a second iPhone given after the
// desired is already set = the ENTRY/trade-in device, NOT a desired switch.
//
// Why (lead VD; smoke 419186/419190/419195): the opener asks "qual deseja
// comprar?" + "qual o aparelho atual?". Client: "17pm" then "14pm". The flash-
// lite reconciler overwrote desired_model 17 Pro Max -> 14 Pro Max with
// has_tradein=false, so the flow never entered trade-in qualification. Two
// reconciler prompt rules + a Bia ordering rule did NOT move the weak model, and
// routing's next_best_action kept the Bia asking capacity/color of the (wrong)
// desired. So we fix it deterministically downstream, where the reconciler output
// is already plain JS (same node as the interest_type/cash-latch guards).
//
// Rule: if a desired_model was already locked (prev lead_state) and the new
// reconciled desired_model is a DIFFERENT single model, WITHOUT an explicit
// switch phrase in the current message ("na verdade quero...", "mudei de ideia",
// "prefiro o..."), and no trade-in is captured yet, restore the prior desired and
// move the new model to tradein_model (has_tradein=true, interest_type="trocar").
// The switch phrases are the escape hatch for a genuine change of desire.
//
// Edits parameters.jsCode. new Function() syntax-asserts. Idempotent (marker).
// DRY=1 previews.

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const NODE_NAME = 'Code Parse Memory 2';
const MARKER = 'tradein reclass (2026-06-19)';

const ANCHOR = '\nreturn [{\n  json: {\n    ...$json,';

const BLOCK = `
// tradein reclass (2026-06-19): a second iPhone named after the desired is already
// set is the ENTRY/trade-in device, not a desired switch. The flash-lite reconciler
// overwrites desired_model with the client's current device when they answer the
// opener's "qual o aparelho atual?" with a model (desired 17 Pro Max set -> client
// says "14pm" -> reconciler wrongly sets desired_model=14 Pro Max). Restore the
// original desired and move the new model to trade-in, unless the client explicitly
// switched what they want to buy.
function __normModel(s) { return String(s || '').toLowerCase().replace(/\\s+/g, ' ').trim(); }
const __prevDesired = (__priorLeadState && __priorLeadState.desired_model) || null;
const __newDesired = memory.desired_model || null;
let __curMsg = '';
try { __curMsg = String($('Edit Fields4').last().json?.buffer?.message_buffered || '').toLowerCase(); } catch (e) { __curMsg = ''; }
const __switchIntent = /(na verdade|mudei de ideia|muda pra|muda para|prefiro o|quero mesmo o|quero o outro|na real quero|pode ser o)/.test(__curMsg);
const __noTradeinYet = !memory.tradein_model && memory.has_tradein !== true;
const __singleDevice = !memory.desired_devices || (Array.isArray(memory.desired_devices) && memory.desired_devices.length <= 1);
if (
  __prevDesired &&
  __newDesired &&
  __normModel(__prevDesired) !== __normModel(__newDesired) &&
  !__switchIntent &&
  __noTradeinYet &&
  __singleDevice
) {
  memory.tradein_model = __newDesired;
  memory.desired_model = __prevDesired;
  memory.desired_capacity = (__priorLeadState && __priorLeadState.desired_capacity) ?? memory.desired_capacity ?? null;
  memory.has_tradein = true;
  memory.interest_type = 'trocar';
  memory.tradein_reclassified = true;
}
`;

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
const code = node.parameters?.jsCode;
if (typeof code !== 'string') throw new Error(`${NODE_NAME}: parameters.jsCode is not a string`);

if (code.includes(MARKER)) {
  console.log(JSON.stringify({ skipped: true, reason: 'already patched', node: NODE_NAME }, null, 2));
  process.exit(0);
}

const occ = code.split(ANCHOR).length - 1;
if (occ !== 1) throw new Error(`${NODE_NAME}: expected exactly 1 anchor match, found ${occ} (drift? run the live guard)`);

const newCode = code.replace(ANCHOR, `${BLOCK}${ANCHOR}`);

// Syntax assertion: new Function() only parses; $json / $(...) are valid syntax.
// eslint-disable-next-line no-new-func
new Function(newCode);

node.parameters.jsCode = newCode;

await mkdir('output/n8n/backups', { recursive: true });
const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-parse-memory2-tradein-reclass-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
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
