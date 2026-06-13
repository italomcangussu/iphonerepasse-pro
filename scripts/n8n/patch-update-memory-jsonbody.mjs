import { readFile } from 'node:fs/promises';

// Surgical patch: make the two CRM POST nodes that inline free-text build their
// JSON body via JSON.stringify so quotes/newlines in summaries are escaped.
// Root cause of execution #405587 error "JSON parameter needs to be valid JSON":
// summary_operational contained literal double quotes (modelo "iPhone 12" ...).

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
}

const env = parseEnv(await readFile('.env.local', 'utf8'));
const KEY = env.N8N_API_KEY;
const ORIGIN = new URL(env.N8N_BASE_URL).origin;
if (!KEY) throw new Error('Missing N8N_API_KEY');

const PATCHES = {
  'CRM Leads POST Update Memory':
    "={{ JSON.stringify({ action: 'update_memory', payload: { lead_id: $('Edit Fields').item.json.lead.id, summary_short: $json.summary_short, summary_operational: $json.summary_operational } }) }}",
  'CRM Leads POST update_funnel':
    "={{ JSON.stringify({ action: 'update_funnel', payload: { lead_id: $('Edit Fields').item.json.lead.id, funnel_stage: $('Edit Fields').item.json.lead.funnel_stage, intent: $json.intent, reason: $json.next_best_action } }) }}",
};

const api = (path, init = {}) => fetch(new URL(path, ORIGIN), {
  ...init,
  headers: { 'X-N8N-API-KEY': KEY, 'content-type': 'application/json', ...(init.headers || {}) },
});

const res = await api(`/api/v1/workflows/${WORKFLOW_ID}`);
if (!res.ok) throw new Error(`GET failed: ${res.status} ${await res.text()}`);
const wf = await res.json();

const applied = [];
for (const node of wf.nodes) {
  if (PATCHES[node.name]) {
    const before = node.parameters.jsonBody;
    node.parameters.jsonBody = PATCHES[node.name];
    applied.push({ node: node.name, changed: before !== PATCHES[node.name] });
  }
}
if (applied.length !== Object.keys(PATCHES).length) {
  throw new Error(`Expected ${Object.keys(PATCHES).length} nodes, patched ${applied.length}`);
}

// Public API update accepts only a whitelisted subset of settings keys.
const ALLOWED_SETTINGS = ['saveExecutionProgress', 'saveManualExecutions', 'saveDataErrorExecution',
  'saveDataSuccessExecution', 'executionTimeout', 'errorWorkflow', 'timezone', 'executionOrder'];
const settings = Object.fromEntries(
  Object.entries(wf.settings ?? {}).filter(([k]) => ALLOWED_SETTINGS.includes(k)));

const body = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings };
if (wf.staticData) body.staticData = wf.staticData;

const put = await api(`/api/v1/workflows/${WORKFLOW_ID}`, { method: 'PUT', body: JSON.stringify(body) });
if (!put.ok) throw new Error(`PUT failed: ${put.status} ${await put.text()}`);
const updated = await put.json();

// Ensure it stays active.
let reactivated = updated.active;
if (!updated.active) {
  const act = await api(`/api/v1/workflows/${WORKFLOW_ID}/activate`, { method: 'POST' });
  reactivated = act.ok;
  if (!act.ok) console.error(`activate failed: ${act.status} ${await act.text()}`);
}

console.log(JSON.stringify({ patched: applied, active: reactivated, updatedAt: updated.updatedAt }, null, 2));
