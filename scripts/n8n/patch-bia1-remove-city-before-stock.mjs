import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Completa o D1 na Bia 1: o patch anterior trocou só UMA linha, mas restou a
// seção "REGRA DE CIDADE ANTES DO ESTOQUE" mandando perguntar a cidade ANTES do
// estoque — instrução contraditória que o LLM seguiu (exec 414198 perguntou
// "Fortaleza ou Sobral?" prematuramente). Substitui a seção pela regra pós-sim.

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const EXPORT_PATH = 'output/n8n/ia-repasse-pro-v2-current.json';
// Bia 1 e Bia 2 ESTOQUE têm o MESMO bloco premature de cidade.
const NODES = ['Bia 1', 'Bia 2 ESTOQUE'];

const OLD = `REGRA DE CIDADE ANTES DO ESTOQUE

So pergunte se o cliente ainda nao mencionou cidade util na mensagem atual ou no estado salvo.
Se a mensagem atual ou o estado salvo indicar Fortaleza, Sobral ou regiao mapeavel para uma delas, use essa cidade operacional e nao pergunte de novo.
Se preferred_city estiver ausente ou "não definida", NAO confirme disponibilidade, endereco, PIX, reserva ou retirada.
Antes disso, pergunte em uma frase curta: "Voce prefere retirar em Fortaleza ou Sobral?"
So fale "esta disponivel", "tem em estoque", endereco de loja ou PIX depois que a cidade de retirada estiver definida.`;

const NEW = `REGRA DE CIDADE (SO APOS A SIMULACAO)

NUNCA pergunte a cidade de retirada nesta fase de coleta/consulta. O estoque e consolidado nas duas lojas (Fortaleza e Sobral): busque e simule SEM exigir cidade. So pergunte "Voce prefere retirar em Fortaleza ou Sobral?" DEPOIS que o cliente aceitar a simulacao (routing_decision = "ask_pickup_city_after_sim"). Se o cliente mencionar a cidade espontaneamente, apenas registre e siga; nao confirme disponibilidade, endereco, PIX ou reserva antes da simulacao.`;

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
const result = {};
for (const NODE of NODES) {
  const node = workflow.nodes.find((n) => n.name === NODE);
  if (!node) throw new Error(`Node not found: ${NODE}`);
  let sys = node.parameters?.options?.systemMessage;
  if (typeof sys !== 'string') throw new Error(`${NODE} has no systemMessage`);
  if (sys.includes('REGRA DE CIDADE (SO APOS A SIMULACAO)')) {
    result[NODE] = { already: true };
  } else {
    sys = replaceOnce(`${NODE} city-before-stock`, sys, OLD, NEW);
    node.parameters.options.systemMessage = sys;
    result[NODE] = { already: false };
  }
}

await mkdir('output/n8n/backups', { recursive: true });
const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-bia-remove-city-before-stock-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
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
console.log(JSON.stringify({ patched: true, nodes: NODES, result, active, backupPath }, null, 2));
