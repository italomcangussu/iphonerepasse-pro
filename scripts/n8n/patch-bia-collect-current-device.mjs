import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Make the Bia collect the CURRENT DEVICE answer as its own anchored question,
// instead of skipping to capacity, so a later "14pm" maps to the trade-in.
//
// Why (lead VD / smoke 419186, 419190): the opener asks two things ("qual deseja
// comprar?" + "qual o aparelho atual?"). The client answered only the desired
// model; the Bia then asked CAPACITY and dropped the current-device question. So
// when the client said "14pm", the last bot message was the capacity question and
// the (flash-lite) reconciler read "14pm" as a desired switch — overwriting the
// desired model. Anchoring the current-device question right before the answer
// makes the reconciler's "abertura -> aparelho atual = trade-in" rule fire
// deterministically (the Bias run on xiaomi/mimo-v2.5-pro, which follows this).
//
// Adds one bullet to the opener block of Bia 1 and Bia 2 ESTOQUE (both in
// parameters.text). Idempotent (marker). DRY=1 previews.

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const NODES = ['Bia 1', 'Bia 2 ESTOQUE'];
const MARKER = 'COLETA DO APARELHO ATUAL';

const ANCHOR = 'nunca diga "bom dia" à tarde/noite.';
const BLOCK = '\n- COLETA DO APARELHO ATUAL: depois da abertura, se o cliente já disse qual modelo deseja comprar mas AINDA NÃO informou o aparelho atual (Tradein model vazio e ele não disse que não tem aparelho), a PRÓXIMA pergunta deve ser sobre o aparelho atual ("E qual o aparelho que você tem hoje? É pra ver uma possível entrada/troca."), ANTES de perguntar capacidade ou cor. Não avance para capacidade deixando o aparelho atual em aberto. Quando o cliente responder com um modelo de iPhone aqui, é o aparelho de ENTRADA/TROCA (não troca o que ele quer comprar).';

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

const results = [];
let anyChange = false;
for (const name of NODES) {
  const node = workflow.nodes.find((n) => n.name === name);
  if (!node) throw new Error(`Node not found: ${name}`);
  const text = node.parameters?.text;
  if (typeof text !== 'string') throw new Error(`${name}: parameters.text is not a string`);
  if (text.includes(MARKER)) { results.push({ node: name, skipped: true }); continue; }
  const occ = text.split(ANCHOR).length - 1;
  if (occ !== 1) throw new Error(`${name}: expected exactly 1 anchor match, found ${occ} (drift? run the live guard)`);
  node.parameters.text = text.replace(ANCHOR, `${ANCHOR}${BLOCK}`);
  results.push({ node: name, bytesBefore: text.length, bytesAfter: node.parameters.text.length });
  anyChange = true;
}

if (!anyChange) {
  console.log(JSON.stringify({ skipped: true, reason: 'already patched (both nodes)', results }, null, 2));
  process.exit(0);
}

await mkdir('output/n8n/backups', { recursive: true });
const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-bia-collect-current-device-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await writeFile(backupPath, `${JSON.stringify(workflow, null, 2)}\n`);

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

console.log(JSON.stringify({ patched: true, workflowId: WORKFLOW_ID, results, active, backupPath, updatedAt: updated.updatedAt }, null, 2));
