import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Patch cirurgico: alinhar a AUTENTICACAO do no `CRM Leads POST4` (handoff humano
// -> crm-ai-inbound transfer:true) ao padrao do `CRM Leads POST2`, que usa a
// credencial httpHeaderAuth configurada no n8n ("Authorization repasse") em vez de
// montar o header Authorization manualmente via $('credenciais') (que estava com
// credentials:null -> pedia credencial e quebrava o fluxo em loop).
// Copia authentication/genericAuthType/credentials do POST2; remove sendHeaders e
// headerParameters do POST4. NAO altera o body. Idempotente. DRY=1 previa.

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const EXPORT_PATH = 'output/n8n/ia-repasse-pro-v2-current.json';
const SOURCE = 'CRM Leads POST2';
const TARGET = 'CRM Leads POST4';

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
const src = workflow.nodes.find((n) => n.name === SOURCE);
const tgt = workflow.nodes.find((n) => n.name === TARGET);
if (!src) throw new Error(`Node not found: ${SOURCE}`);
if (!tgt) throw new Error(`Node not found: ${TARGET}`);

const srcCred = src.credentials?.httpHeaderAuth;
if (!srcCred?.id) throw new Error(`${SOURCE} has no httpHeaderAuth credential to copy`);
if (src.parameters?.genericAuthType !== 'httpHeaderAuth') {
  throw new Error(`${SOURCE} genericAuthType is not httpHeaderAuth (got ${src.parameters?.genericAuthType})`);
}

const before = {
  authentication: tgt.parameters.authentication,
  genericAuthType: tgt.parameters.genericAuthType,
  sendHeaders: tgt.parameters.sendHeaders,
  headerParameters: tgt.parameters.headerParameters,
  credentials: tgt.credentials,
};

const alreadyDone = tgt.credentials?.httpHeaderAuth?.id === srcCred.id
  && tgt.parameters.authentication === 'genericCredentialType'
  && tgt.parameters.genericAuthType === 'httpHeaderAuth'
  && !tgt.parameters.sendHeaders
  && !tgt.parameters.headerParameters;

if (!alreadyDone) {
  tgt.parameters.authentication = 'genericCredentialType';
  tgt.parameters.genericAuthType = 'httpHeaderAuth';
  delete tgt.parameters.sendHeaders;
  delete tgt.parameters.headerParameters;
  tgt.credentials = { httpHeaderAuth: { id: srcCred.id, name: srcCred.name } };
}

const after = {
  authentication: tgt.parameters.authentication,
  genericAuthType: tgt.parameters.genericAuthType,
  sendHeaders: tgt.parameters.sendHeaders,
  headerParameters: tgt.parameters.headerParameters,
  credentials: tgt.credentials,
};

await mkdir('output/n8n/backups', { recursive: true });
const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-crmleadspost4-auth-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await writeFile(backupPath, `${JSON.stringify(workflow, null, 2)}\n`);

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, alreadyDone, before, after, backupPath }, null, 2));
  process.exit(0);
}

if (alreadyDone) {
  console.log(JSON.stringify({ patched: false, alreadyDone: true, after }, null, 2));
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
console.log(JSON.stringify({ patched: true, before, after, active, backupPath }, null, 2));
