import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Re-aplica (via patch cirúrgico) a regra de PRESERVAR O TIER no Memory 1
// Extractor e Memory 2 Reconciler — revertida por uma gravação concorrente na UI
// do n8n. Patch GET-fresco → insere após âncora → PUT, preservando edições atuais.
// Idempotente via marcador "PRESERVE O TIER".

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const EXPORT_PATH = 'output/n8n/ia-repasse-pro-v2-current.json';

const M1_ANCHOR = '- Nao substitua desired_model/desired_capacity principal; desired_devices e complementar para simulacao conjunta.';
const M1_ADD = `
- PRESERVE O TIER (Pro/Pro Max/Plus): quando o cliente menciona um tier que se aplica a varios modelos em duvida (ex.: "versao Pro Max" + "entre 13 e 14"), cada item de desired_devices DEVE conter o modelo COMPLETO com o tier — "iPhone 13 Pro Max" e "iPhone 14 Pro Max". NUNCA extraia so "iPhone 13"/"iPhone 14" perdendo o tier, nem so "Pro Max" perdendo a geracao.
- desired_model (singular) NUNCA pode ser apenas um tier ("Pro Max", "Pro", "Plus") sem geracao. Se houver 2+ desired_devices, desired_model = null (o modelo unico ainda nao foi decidido). Se houver um unico modelo, desired_model = modelo completo (geracao + tier quando informado).`;

const M2_ANCHOR = '- Se so houver um aparelho, mantenha tambem os campos antigos desired_model, desired_capacity, desired_color e desired_condition.';
const M2_ADD = `
- PRESERVE O TIER (Pro/Pro Max/Plus) em CADA item de desired_devices: cada desired_model deve ser o modelo COMPLETO (geracao + tier), ex.: "iPhone 13 Pro Max" e "iPhone 14 Pro Max". Se o tier veio numa mensagem anterior ("versao Pro Max") e as geracoes em outra ("entre 13 e 14"), combine os dois em cada item. NUNCA reduza para "iPhone 13"/"iPhone 14" (sem tier) nem mantenha so "Pro Max" (sem geracao).
- desired_model (singular) NUNCA pode ser apenas um tier ("Pro Max"/"Pro"/"Plus") sem geracao. Com 2+ desired_devices, desired_model = null. Com um unico modelo, desired_model = modelo completo (geracao + tier quando informado).`;

const TARGETS = [
  { node: 'Memory 1 - Extractor', anchor: M1_ANCHOR, add: M1_ADD },
  { node: 'Memory 2 - Reconciler', anchor: M2_ANCHOR, add: M2_ADD },
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
const result = {};
for (const t of TARGETS) {
  const node = workflow.nodes.find((n) => n.name === t.node);
  if (!node) throw new Error(`Node not found: ${t.node}`);
  let sys = node.parameters?.options?.systemMessage;
  if (typeof sys !== 'string') throw new Error(`${t.node} has no systemMessage`);
  if (sys.includes('PRESERVE O TIER')) {
    result[t.node] = { already: true };
  } else {
    sys = replaceOnce(`${t.node} tier`, sys, t.anchor, t.anchor + t.add);
    node.parameters.options.systemMessage = sys;
    result[t.node] = { already: false };
  }
}

await mkdir('output/n8n/backups', { recursive: true });
const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-memory-preserve-tier-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await writeFile(backupPath, `${JSON.stringify(workflow, null, 2)}\n`);

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, backupPath, result }, null, 2));
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
console.log(JSON.stringify({ patched: true, result, active, backupPath }, null, 2));
