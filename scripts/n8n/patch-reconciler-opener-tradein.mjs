import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Map the OPENER's "current device" answer to a trade-in in Memory 2 Reconciler.
//
// Root cause (lead VD, exec 419160 "14pm"): the new opener asks two things at
// once ("qual deseja comprar?" + "qual o aparelho que você tem agora?"). The
// client answered with two rapid messages (17pm / 14pm). The reconciler had no
// rule mapping the "current device" answer to a trade-in, so it left
// has_tradein=false / tradein_model=null and the flow never entered trade-in
// qualification. (The existing DESAMBIGUACAO rule only covers the trade-in
// EVALUATION questionnaire, not the first mention via the opener.)
//
// Fix: two bullets at the top of the DESAMBIGUACAO section — (1) answer to the
// opener's current-device question = tradein_model + has_tradein=true +
// interest_type="troca" (never desired_model); (2) when the opener asked both
// and the client gives two models, 1st = desired, 2nd = trade-in. With
// has_tradein/tradein_model set, routing + Bia's existing qualification (which
// worked in session 1) take over.
//
// Edits Memory 2 - Reconciler options.systemMessage. Idempotent (marker). DRY=1.

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const NODE_NAME = 'Memory 2 - Reconciler';
const MARKER = 'ABERTURA -> APARELHO ATUAL = TRADE-IN';

const ANCHOR = '// DESAMBIGUACAO TRADE-IN vs DESEJADO (CRITICO)\n';

const BLOCK =
  '- ABERTURA -> APARELHO ATUAL = TRADE-IN: se a ULTIMA mensagem do atendimento foi a abertura/saudacao perguntando o APARELHO ATUAL do cliente (ex.: "qual o aparelho que voce tem agora?", "qual seu aparelho atual?", "tem algum iPhone pra dar de entrada?") e o cliente respondeu com um modelo de iPhone, registre esse modelo como tradein_model e has_tradein = true (intencao de troca/entrada a qualificar) e interest_type = "troca". NUNCA coloque esse modelo em desired_model.\n' +
  '- ABERTURA COM DUAS PERGUNTAS: quando a abertura perguntou "qual deseja comprar?" E "qual o aparelho atual?" e o cliente respondeu com DOIS modelos, o modelo que responde "qual deseja comprar" vai para desired_model e o que responde "aparelho atual" vai para tradein_model (has_tradein = true). Na duvida pela ordem, o 1o modelo citado e o desejado (compra) e o 2o e o de entrada (troca). Nao deixe o aparelho de entrada sobrescrever o desejado nem vice-versa.\n';

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
if (node.type !== '@n8n/n8n-nodes-langchain.agent') throw new Error(`${NODE_NAME} is not an agent node (got ${node.type})`);

const text = node.parameters?.options?.systemMessage;
if (typeof text !== 'string') throw new Error(`${NODE_NAME}: options.systemMessage is not a string`);

if (text.includes(MARKER)) {
  console.log(JSON.stringify({ skipped: true, reason: 'already patched (opener->tradein)', workflowId: WORKFLOW_ID, node: NODE_NAME }, null, 2));
  process.exit(0);
}

const occurrences = text.split(ANCHOR).length - 1;
if (occurrences !== 1) {
  throw new Error(`${NODE_NAME}: expected exactly 1 anchor match, found ${occurrences} (drift? run the live guard)`);
}

const newText = text.replace(ANCHOR, `${ANCHOR}${BLOCK}`);
node.parameters.options.systemMessage = newText;

await mkdir('output/n8n/backups', { recursive: true });
const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-reconciler-opener-tradein-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await writeFile(backupPath, `${JSON.stringify(workflow, null, 2)}\n`);

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, backupPath, node: NODE_NAME, bytesBefore: text.length, bytesAfter: newText.length }, null, 2));
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
  patched: true, workflowId: WORKFLOW_ID, node: NODE_NAME,
  bytesBefore: text.length, bytesAfter: newText.length, active, backupPath, updatedAt: updated.updatedAt,
}, null, 2));
