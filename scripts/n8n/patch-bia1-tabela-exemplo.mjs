import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Patch cirurgico (2026-06-18): refina a abordagem de TABELA na Bia 1 com um
// EXEMPLO de fala explicito pedido pelo usuario, reforcando que NUNCA se diz
// "aqui a gente nao trabalha com tabela". GET-fresco -> backup -> exact .replace
// (guards) -> PUT -> activate -> re-export. Idempotente via marcador. DRY=1 previa.

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const EXPORT_PATH = 'output/n8n/ia-repasse-pro-v2-current.json';
const NODE = 'Bia 1';

const ANCHOR = 'uma simulação completa (com parcelamento, entrada e troca) já no valor real pra ele. Em seguida mostre a LISTA CURTA e siga as etapas.';
const ADD = ' Exemplo de abordagem (adapte ao contexto; NUNCA diga "aqui a gente não trabalha com tabela" nem equivalente): "Vou fazer melhor ainda: ao invés da tabela, consigo te mandar a simulação completa da compra. Qual modelo você procura?"';
const MARKER = 'Vou fazer melhor ainda';

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
  if (!haystack.includes(oldStr)) throw new Error(`${label}: anchor not found (workflow drifted?)`);
  if (haystack.split(oldStr).length - 1 !== 1) throw new Error(`${label}: anchor not unique`);
  return haystack.replace(oldStr, newStr);
}

const env = parseEnv(await readFile('.env.local', 'utf8'));
const key = env.N8N_API_KEY || env.N8N_PUBLIC_API;
const origin = new URL(env.N8N_BASE_URL || env.N8N_MCP_URL).origin;
if (!key) throw new Error('Missing N8N_API_KEY');

const workflow = await api(origin, key, `/api/v1/workflows/${WORKFLOW_ID}`);
const node = workflow.nodes.find((n) => n.name === NODE);
if (!node) throw new Error(`Node not found: ${NODE}`);
let sys = node.parameters?.options?.systemMessage;
if (typeof sys !== 'string') throw new Error(`${NODE} has no systemMessage`);

const alreadyDone = sys.includes(MARKER);
if (!alreadyDone) {
  sys = replaceOnce(`${NODE}/tabela-exemplo`, sys, ANCHOR, ANCHOR + ADD);
  node.parameters.options.systemMessage = sys;
}

await mkdir('output/n8n/backups', { recursive: true });
const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-bia1-tabela-exemplo-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await writeFile(backupPath, `${JSON.stringify(workflow, null, 2)}\n`);

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, alreadyDone, backupPath }, null, 2));
  process.exit(0);
}

if (alreadyDone) {
  console.log(JSON.stringify({ patched: false, alreadyDone: true }, null, 2));
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
console.log(JSON.stringify({ patched: true, active, backupPath }, null, 2));
