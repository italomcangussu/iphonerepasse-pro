import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Remove em-dash from the 3 example "message" strings in Bia 2 ESTOQUE (2026-06-20).
//
// Why: the anti-tell humanization guard (validate-repasse-next-workflow.mjs) forbids
// em-dash inside example "message" strings — they teach the model robotic style. The
// 2026-06-18 commercial evolution introduced 3 reservation/proposal examples with "—".
// The runtime humanizer (repasseHumanizeMessage) already strips em-dash from real
// replies, so this only cleans the prompt examples (no customer-facing change).
//
// Targeted (NOT global): section headers like "NATURALIDADE — SEM CARA DE IA" MUST
// keep their em-dash (the guard asserts that header). Both replacement substrings are
// unique to the message examples.
//
// Idempotent. DRY=1 previews.

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const NODE_NAME = 'Bia 2 ESTOQUE';

const EDITS = [
  { old: 'Pix — e esse valor', new: 'Pix, e esse valor', expect: 2 },
  { old: 'parcelada — quer que', new: 'parcelada. Quer que', expect: 1 },
];

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
let sm = node.parameters?.options?.systemMessage;
if (typeof sm !== 'string') throw new Error(`${NODE_NAME}: options.systemMessage is not a string`);

const results = [];
let changed = false;
for (const edit of EDITS) {
  const occOld = sm.split(edit.old).length - 1;
  if (occOld === 0 && sm.includes(edit.new)) { results.push({ edit: edit.old, status: 'already-applied' }); continue; }
  if (occOld !== edit.expect) {
    throw new Error(`${NODE_NAME}: expected ${edit.expect} match(es) for "${edit.old}", found ${occOld} (drift? run the live guard)`);
  }
  sm = sm.split(edit.old).join(edit.new);
  changed = true;
  results.push({ edit: edit.old, status: 'patched', replaced: occOld });
}

if (!changed) {
  console.log(JSON.stringify({ skipped: true, reason: 'all edits already applied', results }, null, 2));
  process.exit(0);
}

// Safety: no em-dash may remain inside example "message" strings (the guard's rule).
const remaining = [...sm.matchAll(/"message":\s*"((?:[^"\\]|\\.)*)"/g)]
  .map((m) => m[1]).filter((msg) => msg.includes('—'));
if (remaining.length) throw new Error(`em-dash still present in ${remaining.length} example message(s) after edits`);

node.parameters.options.systemMessage = sm;

await mkdir('output/n8n/backups', { recursive: true });
const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-bia2-examples-no-emdash-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await writeFile(backupPath, `${JSON.stringify(workflow, null, 2)}\n`);

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, backupPath, node: NODE_NAME, results }, null, 2));
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

console.log(JSON.stringify({ patched: true, workflowId: WORKFLOW_ID, node: NODE_NAME, results, active, backupPath, updatedAt: updated.updatedAt }, null, 2));
