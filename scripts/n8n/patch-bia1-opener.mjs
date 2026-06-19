import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Add an explicit cold-open rule to the "Bia 1" agent prompt.
//
// Problem (observed live 2026-06-19): for a cold "Oi" the agent improvised
// "Qual modelo de iPhone você tem hoje?" — a SELLER-framed question — when the
// client actually wanted to buy. The prompt had the greeting (saudacao,
// time-based, America/Fortaleza) and the desired/tradein state available but no
// opener directive, so the LLM guessed.
//
// Fix: insert a "REGRA DE ABERTURA" section. On first contact / bare greeting,
// open with the correct time-of-day greeting + ask which model to BUY and the
// current device — but only the parts not already provided in the first message.
// Never assume the client is selling. Keeps the {"message","transfer"} contract.
//
// Idempotent: re-running detects the marker and no-ops. DRY=1 previews.

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const NODE_NAME = 'Bia 1';
const MARKER = 'REGRA DE ABERTURA (primeiro contato)';

const ANCHOR = '=== FAQ COMERCIAL CONTROLADO ===';

const BLOCK = `=== ${MARKER} ===
- Quando for o início da conversa (não há "última mensagem enviada ao cliente", OU o cliente só mandou uma saudação/abertura como "oi", "olá", "bom dia", "boa tarde", "tudo bem?" SEM dizer o que procura), abra com a saudação correta do horário + as perguntas de compra e de aparelho atual:
  "{{ $json.saudacao }}! Tudo bem? Qual modelo de iPhone você deseja comprar? E qual o modelo do seu aparelho atual?"
- NUNCA presuma que o cliente quer VENDER. O foco é a COMPRA; o aparelho atual é só para uma possível entrada/troca.
- Pergunte SÓ o que ainda NÃO foi informado nesta conversa:
  • Se "Desired model" já tem valor, NÃO pergunte qual deseja comprar.
  • Se "Tradein model" já tem valor (ou o cliente já disse que não tem aparelho para dar de entrada), NÃO pergunte o aparelho atual.
  • Se ambos já estão preenchidos, NÃO reabra — siga a AÇÃO PRIORITÁRIA.
- Sempre use a saudação do horário ({{ $json.saudacao }}, America/Fortaleza); nunca diga "bom dia" à tarde/noite.

`;

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

const text = node.parameters?.text;
if (typeof text !== 'string') throw new Error(`${NODE_NAME}: parameters.text is not a string`);

if (text.includes(MARKER)) {
  console.log(JSON.stringify({ skipped: true, reason: 'already patched', workflowId: WORKFLOW_ID, node: NODE_NAME }, null, 2));
  process.exit(0);
}

const occurrences = text.split(ANCHOR).length - 1;
if (occurrences !== 1) {
  throw new Error(`${NODE_NAME}: expected exactly 1 anchor match for "${ANCHOR}", found ${occurrences} (workflow drifted? run the live guard)`);
}

const newText = text.replace(ANCHOR, `${BLOCK}${ANCHOR}`);
node.parameters.text = newText;

await mkdir('output/n8n/backups', { recursive: true });
const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-bia1-opener-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
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
