import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Make the R$ 250 reservation clearly DEDUCTED from the device total.
//
// Why: the closing/PIX templates said "Taxa de reserva R$ 250,00" + "só paga a
// diferença", which reads like a R$ 250 FEE on top of the already-simulated
// price. Clients think they pay simulated_total + 250. They don't: the R$ 250 is
// an advance that is abated from the total — on pickup they pay (simulated − 250).
// The agent paraphrases these templates, so beyond fixing the two examples we add
// a HARD RULE in the FECHAMENTO block so the "deducted, not extra" meaning always
// survives the rewrite.
//
// Edits Bia 2 ESTOQUE options.systemMessage (expression). Idempotent: no-ops if
// the new wording is already present; partial state throws (drift → run guard).
// DRY=1 previews.

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const NODE_NAME = 'Bia 2 ESTOQUE';
const MARKER = 'são ABATIDOS do valor do aparelho';

const EDITS = [
  // Lead line of both closing templates (appears 2×)
  {
    expect: 2,
    find: 'Sim, está no nosso estoque. Caso queira reservar, aí quando chegar na nossa loja só paga a diferença.',
    replace: 'Sim, está no nosso estoque. Pra reservar, é uma entrada de R$ 250 via Pix — e esse valor é abatido do total do aparelho, não é cobrança extra.',
  },
  // Fee line of both closing templates (appears 2×)
  {
    expect: 2,
    find: 'Taxa de reserva R$ 250,00. Pra deixar reservado para você.',
    replace: 'Quando chegar na nossa loja, você paga só o restante (o valor simulado já com os R$ 250 da reserva descontados). Pra deixar reservado para você.',
  },
  // Hard rule in the FECHAMENTO NA CIDADE DO ESTOQUE block (appears 1×)
  {
    expect: 1,
    find: '- Envie PIX de reserva + endereco da loja da cidade do estoque.',
    replace: '- Envie PIX de reserva + endereco da loja da cidade do estoque.\n- SEMPRE deixe claro que os R$ 250 da reserva são ABATIDOS do valor do aparelho (não é taxa extra): na retirada o cliente paga o valor simulado MENOS os R$ 250. Nunca dê a entender que a reserva é um custo adicional ao preço já simulado.',
  },
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
if (node.type !== '@n8n/n8n-nodes-langchain.agent') throw new Error(`${NODE_NAME} is not an agent node (got ${node.type})`);

const text = node.parameters?.options?.systemMessage;
if (typeof text !== 'string') throw new Error(`${NODE_NAME}: options.systemMessage is not a string`);

if (text.includes(MARKER)) {
  console.log(JSON.stringify({ skipped: true, reason: 'already patched (reservation deduction)', workflowId: WORKFLOW_ID, node: NODE_NAME }, null, 2));
  process.exit(0);
}

let newText = text;
for (const { find, replace, expect } of EDITS) {
  const occurrences = newText.split(find).length - 1;
  if (occurrences !== expect) {
    throw new Error(`${NODE_NAME}: expected ${expect} match(es) for ${JSON.stringify(find.slice(0, 50))}, found ${occurrences} (drift? run the live guard)`);
  }
  newText = newText.split(find).join(replace);
}

node.parameters.options.systemMessage = newText;

await mkdir('output/n8n/backups', { recursive: true });
const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-bia2-reservation-deducted-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await writeFile(backupPath, `${JSON.stringify(workflow, null, 2)}\n`);

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, backupPath, node: NODE_NAME, edits: EDITS.length, bytesBefore: text.length, bytesAfter: newText.length }, null, 2));
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
  patched: true, workflowId: WORKFLOW_ID, node: NODE_NAME, edits: EDITS.length,
  bytesBefore: text.length, bytesAfter: newText.length, active, backupPath, updatedAt: updated.updatedAt,
}, null, 2));
