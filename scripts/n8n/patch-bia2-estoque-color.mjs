import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Bia 2 ESTOQUE (P3): a "REGRA ABSOLUTA DE COR — SOMENTE ESTOQUE" já existe
// (só ofertar cores do estoque, não inventar). O gap de FLUXO é: cor não é
// necessária para simular — é sugestão pós-simulação ou sob demanda. Append
// idempotente reforçando isso, sem mexer nas regras já corretas.

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const EXPORT_PATH = 'output/n8n/ia-repasse-pro-v2-current.json';
const NODE = 'Bia 2 ESTOQUE';
const APPEND_MARKER = '// COR POS-SIMULACAO (FAQ/FLUXO) v1';

const APPEND_BLOCK = `

${APPEND_MARKER}
- Cor NÃO é necessária para simular. Não pergunte a cor antes de simular: simule com a opção disponível e trate a cor como sugestão APÓS a simulação, ou só quando o cliente perguntar.
- Reforço: nunca confirme nem invente uma cor que o cliente não disse e que não esteja em available_colors/available_options (não responda "ótimo, [cor] então" sem o cliente ter pedido essa cor e ela existir no estoque).`;

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
const node = workflow.nodes.find((n) => n.name === NODE);
if (!node) throw new Error(`Node not found: ${NODE}`);
let sys = node.parameters?.options?.systemMessage;
if (typeof sys !== 'string') throw new Error(`${NODE} has no systemMessage`);

let result;
if (sys.includes(APPEND_MARKER)) {
  result = { already: true };
} else {
  // sanity: a regra base de cor deve existir (não estamos partindo de um prompt inesperado)
  if (!sys.includes('REGRA ABSOLUTA DE COR')) throw new Error(`${NODE}: regra base de cor ausente (drift?)`);
  node.parameters.options.systemMessage = sys + APPEND_BLOCK;
  result = { already: false };
}

await mkdir('output/n8n/backups', { recursive: true });
const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-bia2-estoque-color-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
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
console.log(JSON.stringify({ patched: true, node: NODE, result, active, backupPath }, null, 2));
