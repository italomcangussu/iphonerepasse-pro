import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Conserta a SINTAXE frágil do sessionKey do "Postgres Chat Memory4" (memória do
// agente Memory 1 - Extractor): `=2{{ ... return 'm'+base }}` usa um literal "2"
// colado antes do `{{` (parece typo). Reescreve para `={{ ... return '2m'+base }}`:
// MESMO valor resolvido ("2m<base>") → ZERO perda de memória; sintaxe limpa; segue
// DISTINTO do Memory3 ("m<base>", agente Memory 2) para a memória dos agentes de
// análise não se misturar. Idempotente. sessionKey é parâmetro de node → patch.

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const EXPORT_PATH = 'output/n8n/ia-repasse-pro-v2-current.json';
const NODE = 'Postgres Chat Memory4';

const START_OLD = '=2{{ (() => {';
const START_NEW = '={{ (() => {';
const PREFIX_OLD = "const session = 'm' + String(base";
const PREFIX_NEW = "const session = '2m' + String(base";

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

const env = parseEnv(await readFile('.env.local', 'utf8'));
const key = env.N8N_API_KEY || env.N8N_PUBLIC_API;
const origin = new URL(env.N8N_BASE_URL || env.N8N_MCP_URL).origin;
if (!key) throw new Error('Missing N8N_API_KEY');

const workflow = await api(origin, key, `/api/v1/workflows/${WORKFLOW_ID}`);
const node = workflow.nodes.find((n) => n.name === NODE);
if (!node) throw new Error(`Node not found: ${NODE}`);
let sk = node.parameters?.sessionKey;
if (typeof sk !== 'string') throw new Error(`${NODE} has no sessionKey`);

let result;
if (sk.startsWith(START_NEW) && sk.includes(PREFIX_NEW)) {
  result = { already: true, resolved_example: '2m<base>' };
} else {
  sk = replaceOnce(`${NODE} start`, sk, START_OLD, START_NEW);
  sk = replaceOnce(`${NODE} prefix`, sk, PREFIX_OLD, PREFIX_NEW);
  node.parameters.sessionKey = sk;
  result = { already: false, resolved_example: '2m<base>' };
}

await mkdir('output/n8n/backups', { recursive: true });
const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-memory4-sessionkey-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await writeFile(backupPath, `${JSON.stringify(workflow, null, 2)}\n`);

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, backupPath, result, sessionKey: node.parameters.sessionKey }, null, 2));
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
console.log(JSON.stringify({ patched: true, node: NODE, result, active, backupPath }, null, 2));
