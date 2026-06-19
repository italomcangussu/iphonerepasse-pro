import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Wire the "apagar memoria" workflow (gt66GRAmvF4LlU8b) so it actually deletes a
// lead's agent chat memory when called.
//
// The workflow already has: Webhook (path "apagar") -> 3x Postgres
// "Delete table or rows" on n8n_chat_histories WHERE session_id = ?. But the
// WHERE value was never set, so it would delete nothing (or everything).
//
// The main workflow (Cr4fPWe0prwS6XjI) keys each Postgres Chat Memory by
// <prefix> + lead_id, with prefixes '', 'm', '2m' (see Postgres Chat Memory /
// Memory1 / Memory3 / Memory4 sessionKey expressions). So for one lead there are
// up to 3 distinct session_id rows. This patch assigns one prefix per delete node
// and sets the Webhook to accept POST { lead_id }.
//
// Idempotent: re-running detects the wired value and no-ops.

const WORKFLOW_ID = 'gt66GRAmvF4LlU8b';

const NODE_PREFIX = {
  'Delete table or rows': '',
  'Delete table or rows1': 'm',
  'Delete table or rows2': '2m',
};

function exprFor(prefix) {
  return prefix
    ? `={{ "${prefix}" + $json.body.lead_id }}`
    : '={{ $json.body.lead_id }}';
}

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

function patchWorkflow(workflow) {
  const results = {};

  for (const [name, prefix] of Object.entries(NODE_PREFIX)) {
    const node = workflow.nodes.find((n) => n.name === name);
    if (!node) throw new Error(`Node not found: ${name}`);
    if (node.type !== 'n8n-nodes-base.postgres') throw new Error(`${name} is not a postgres node`);
    const where = node.parameters?.where?.values;
    if (!Array.isArray(where) || where[0]?.column !== 'session_id') {
      throw new Error(`${name}: unexpected where filter (workflow drifted?)`);
    }
    const expr = exprFor(prefix);
    where[0].condition = 'equal';
    where[0].value = expr;
    results[name] = { prefix: prefix || '(none)', value: expr };
  }

  // Webhook must accept POST.
  const webhook = workflow.nodes.find((n) => n.type === 'n8n-nodes-base.webhook');
  if (!webhook) throw new Error('Webhook node not found');
  webhook.parameters.httpMethod = 'POST';
  results.webhook = { httpMethod: 'POST', path: webhook.parameters?.path };

  return results;
}

const env = parseEnv(await readFile('.env.local', 'utf8'));
const key = env.N8N_API_KEY || env.N8N_PUBLIC_API;
const origin = new URL(env.N8N_BASE_URL || env.N8N_MCP_URL).origin;
if (!key) throw new Error('Missing N8N_API_KEY');

const workflow = await api(origin, key, `/api/v1/workflows/${WORKFLOW_ID}`);
await mkdir('output/n8n/backups', { recursive: true });
const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-apagar-memoria-wire-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await writeFile(backupPath, `${JSON.stringify(workflow, null, 2)}\n`);

const results = patchWorkflow(workflow);

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

console.log(JSON.stringify({
  patched: true, workflowId: WORKFLOW_ID, results, active, backupPath, updatedAt: updated.updatedAt,
}, null, 2));
