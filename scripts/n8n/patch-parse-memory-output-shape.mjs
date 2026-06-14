import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Keep Parse Memory output canonical.
//
// Root cause: Parse Memory returned `{ ...ctxClean, ...memory, memory }`.
// ctxClean still contained stale CRM payload such as `lead_state`, so later
// nodes could see old state beside the freshly reconciled memory fields.
//
// Scope: one Code node only. Preserve the nested `memory` object for downstream
// compatibility, but do not pass through prior lead_state/output/message blobs.

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const TARGET_NODE = 'Parse Memory';

const OLD_RETURN = `const { output: _o, text: _t, message: _m, memory: _oldMemory, ...ctxClean } = inputData;

return [{
  json: {
    ...ctxClean,
    ...memory,
    memory,
  },
}];`;

const NEW_RETURN = `const canonicalMemory = clonePlain(memory);

return [{
  json: {
    ...canonicalMemory,
    memory: canonicalMemory,
  },
}];`;

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

function patchWorkflow(workflow) {
  const node = workflow.nodes.find((item) => item.name === TARGET_NODE);
  if (!node) throw new Error(`Node not found: ${TARGET_NODE}`);
  if (node.type !== 'n8n-nodes-base.code') {
    throw new Error(`${TARGET_NODE} must be a Code node; got ${node.type}`);
  }

  const jsCode = node.parameters?.jsCode;
  if (typeof jsCode !== 'string') {
    throw new Error(`${TARGET_NODE} has no jsCode`);
  }

  const alreadyPatched = jsCode.includes('const canonicalMemory = clonePlain(memory);');
  if (alreadyPatched) return { alreadyPatched, node };

  if (!jsCode.includes(OLD_RETURN)) {
    throw new Error(`${TARGET_NODE} return block did not match expected old shape`);
  }

  node.parameters.jsCode = jsCode.replace(OLD_RETURN, NEW_RETURN);
  return { alreadyPatched, node };
}

function assertPatch(workflow) {
  const node = workflow.nodes.find((item) => item.name === TARGET_NODE);
  const jsCode = node?.parameters?.jsCode ?? '';

  if (!jsCode.includes(NEW_RETURN)) {
    throw new Error(`${TARGET_NODE} missing canonical output return`);
  }
  if (jsCode.includes('...ctxClean')) {
    throw new Error(`${TARGET_NODE} still passes ctxClean through`);
  }
  if (jsCode.includes('const { output: _o, text: _t, message: _m, memory: _oldMemory')) {
    throw new Error(`${TARGET_NODE} still destructures stale passthrough context`);
  }

  new Function(jsCode);
}

const env = parseEnv(await readFile('.env.local', 'utf8'));
const key = env.N8N_API_KEY || env.N8N_PUBLIC_API;
const origin = new URL(env.N8N_BASE_URL || env.N8N_MCP_URL).origin;
if (!key) throw new Error('Missing N8N_API_KEY or N8N_PUBLIC_API');

const workflow = await api(origin, key, `/api/v1/workflows/${WORKFLOW_ID}`);
await mkdir('output/n8n/backups', { recursive: true });
const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-parse-memory-output-shape-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await writeFile(backupPath, `${JSON.stringify(workflow, null, 2)}\n`);

const { alreadyPatched } = patchWorkflow(workflow);
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
}, null, 2));
