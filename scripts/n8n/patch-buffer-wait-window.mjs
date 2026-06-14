import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Fix for real traffic where related messages from the same contact arrived
// 13.5s apart and were delivered to the agent as separate turns because
// "Calcular Wait Buffer" shortened medium text messages to 12s.
//
// This patch keeps a single conservative debounce window: 25s.
// Scope: one Code node only. No Redis keys, routing, agents, or credentials.

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const TARGET_NODE = 'Calcular Wait Buffer';

const WAIT_CODE = `// Calcula a janela de debounce do buffer antes do Wait1.
// Produção: manter 25s para consolidar mensagens relacionadas do mesmo contato.
// Evidência 2026-06-13: duas mensagens da mesma key chegaram 13,5s apartadas e
// foram entregues separadas porque a janela dinâmica caiu para 12s.
const input = $input.first().json;
return [
  {
    json: {
      ...input,
      buffer_wait_seconds: 25,
      buffer_wait_reason: 'fixed_25s_related_messages',
    },
  },
];`;

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

function assertPatch(workflow) {
  const node = workflow.nodes.find((item) => item.name === TARGET_NODE);
  if (!node) throw new Error(`Node not found: ${TARGET_NODE}`);
  if (node.type !== 'n8n-nodes-base.code') {
    throw new Error(`${TARGET_NODE} must be a Code node; got ${node.type}`);
  }
  if (node.parameters?.jsCode !== WAIT_CODE) {
    throw new Error(`${TARGET_NODE} jsCode was not patched exactly`);
  }
  new Function(WAIT_CODE);
}

const env = parseEnv(await readFile('.env.local', 'utf8'));
const key = env.N8N_API_KEY || env.N8N_PUBLIC_API;
const origin = new URL(env.N8N_BASE_URL || env.N8N_MCP_URL).origin;
if (!key) throw new Error('Missing N8N_API_KEY or N8N_PUBLIC_API');

const workflow = await api(origin, key, `/api/v1/workflows/${WORKFLOW_ID}`);
await mkdir('output/n8n/backups', { recursive: true });
const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-buffer-wait-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await writeFile(backupPath, `${JSON.stringify(workflow, null, 2)}\n`);

const node = workflow.nodes.find((item) => item.name === TARGET_NODE);
if (!node) throw new Error(`Node not found: ${TARGET_NODE}`);
const alreadyPatched = node.parameters?.jsCode === WAIT_CODE;
node.parameters = { ...(node.parameters ?? {}), jsCode: WAIT_CODE };
assertPatch(workflow);

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, alreadyPatched, backupPath, node: TARGET_NODE }, null, 2));
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

console.log(JSON.stringify({
  patched: true,
  alreadyPatched,
  workflowId: WORKFLOW_ID,
  node: TARGET_NODE,
  active,
  backupPath,
  updatedAt: updated.updatedAt,
  waitSeconds: 25,
}, null, 2));
