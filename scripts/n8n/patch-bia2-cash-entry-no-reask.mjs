import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Stop Bia 2 ESTOQUE from RE-ASKING about cash entry once it's resolved.
//
// Root cause (exec 419178, lead VD): the deterministic routing was correct —
// cash_entry_asked=true, cash_entry_intent=false, routing_decision=
// "inventory_or_simulator" (NOT "ask_cash_entry_before_sim"), next_best_action=
// "perguntar_cor_ou_condicao_iphone". But Bia 2's prompt never RENDERS the
// cash-entry state: the only "cash_entry" token in it is the literal route name
// inside REGRA DE ENTRADA. So the LLM had no signal the entry was already asked +
// answered and re-asked it on its own ("Vou simular no cartão pra você. Quer dar
// algum valor de entrada no Pix pra parcelar o restante?").
//
// Fix: inject the live state into the prompt via $('Code Routing Flags') (always
// runs before Bia 2 and carries cash_entry_asked/intent/amount) + a hard guard
// forbidding any re-ask once asked=true OR intent is set (incl. false = "no").
// Reference style: systemMessage is an expression and cross-node $('Name') refs
// resolve on this node (the opener uses the same pattern in parameters.text).
//
// Idempotent (marker). DRY=1 previews.

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const NODE_NAME = 'Bia 2 ESTOQUE';
const MARKER = 'GUARDA ANTI-REPETIÇÃO DE ENTRADA';

const ANCHOR = 'Se o cliente ja tiver dito que quer (ou nao) dar entrada, NAO pergunte de novo e siga para a simulacao.';

const BLOCK = "\n" +
  "GUARDA ANTI-REPETIÇÃO DE ENTRADA (estado atual desta conversa): cash_entry_asked={{ $('Code Routing Flags').last().json.cash_entry_asked }} | cash_entry_intent={{ $('Code Routing Flags').last().json.cash_entry_intent }} | cash_entry_amount={{ $('Code Routing Flags').last().json.cash_entry_amount }}. " +
  "Se cash_entry_asked for true, OU cash_entry_intent já estiver definido (true OU false — \"false\" = o cliente JÁ disse que NÃO quer entrada), então é PROIBIDO perguntar sobre entrada de novo: NÃO escreva \"quer dar entrada\", \"valor de entrada\", \"entrada no Pix/dinheiro\" nem qualquer variação. Trate a entrada como resolvida e vá direto para a próxima etapa indicada por next_best_action (perguntar cor/condição se faltar, senão simular). Perguntar entrada duas vezes irrita o cliente.";

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
  console.log(JSON.stringify({ skipped: true, reason: 'already patched (cash-entry no-reask guard)', workflowId: WORKFLOW_ID, node: NODE_NAME }, null, 2));
  process.exit(0);
}

const occurrences = text.split(ANCHOR).length - 1;
if (occurrences !== 1) {
  throw new Error(`${NODE_NAME}: expected exactly 1 anchor match, found ${occurrences} (drift? run the live guard)`);
}

const newText = text.replace(ANCHOR, `${ANCHOR}${BLOCK}`);
node.parameters.options.systemMessage = newText;

await mkdir('output/n8n/backups', { recursive: true });
const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-bia2-cash-entry-no-reask-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
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
