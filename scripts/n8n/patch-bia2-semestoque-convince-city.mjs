import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Bia 2 SEM ESTOQUE (P4 + D1 no prompt):
//  - Cidade só pós-simulação: a decisão ask_client_city_before_stock foi
//    removida do roteamento (vira ask_pickup_city_after_sim). Atualiza as
//    referências e proíbe perguntar cidade antes da simulação.
//  - Convencer no seminovo; oferecer especialista só para iPhone NOVO.
// Node name tem espaço no fim: 'Bia 2 SEM ESTOQUE '.

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const EXPORT_PATH = 'output/n8n/ia-repasse-pro-v2-current.json';
const NODE = 'Bia 2 SEM ESTOQUE ';
const APPEND_MARKER = '// CONVENCER SEMINOVO / CIDADE POS-SIM (FAQ/FLUXO) v1';

const CITY_ROUTE_OLD = `Se routing_decision = "ask_client_city_before_stock", responda apenas perguntando: "Voce prefere retirar em Fortaleza ou Sobral?"`;
const CITY_ROUTE_NEW = `Se routing_decision = "ask_pickup_city_after_sim" (só após a simulação aceita), responda perguntando: "Voce prefere retirar em Fortaleza ou Sobral?". NUNCA pergunte cidade antes da simulação aceita.`;

const CITY_ABSENT_OLD = `Se preferred_city estiver ausente ou "não definida", nao confirme disponibilidade, endereco, PIX, reserva ou retirada. Pergunte: "Voce prefere retirar em Fortaleza ou Sobral?"`;
const CITY_ABSENT_NEW = `Antes da simulação, NÃO pergunte cidade. A cidade só é necessária ao confirmar reserva/retirada, após a proposta aceita; só aí, se preferred_city estiver ausente, pergunte: "Voce prefere retirar em Fortaleza ou Sobral?". Sem cidade definida, não confirme endereco, PIX, reserva ou retirada.`;

const APPEND_BLOCK = `

${APPEND_MARKER}
- Falta de modelo/cor para iPhone NOVO indisponível: pode oferecer o especialista.
- Falta de modelo/cor em SEMINOVO: NÃO ofereça especialista por isso. Convença mostrando a alternativa mais próxima em estoque e oferecendo simular ("posso simular o parcelamento dessa opção pra você?"). Só transfira seminovo por erro de simulação ou indecisão após 3 simulações.
- CONDIÇÃO DO APARELHO DE ENTRADA: se routing_decision = "tradein_condition_human_eval" (o aparelho de entrada tem contato com líquido, arranhões ou peça trocada), NÃO simule nem prometa valor de troca. Explique com simpatia que esse aparelho precisa de uma avaliação presencial/humana para garantir o melhor valor e transfira (transfer: true). Ex.: {"message": "Pelo que você descreveu do seu aparelho, pra garantir a avaliação certinha e o melhor valor da sua entrada, vou te passar pro nosso especialista, tá?", "transfer": true}`;

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
let sys = node.parameters?.options?.systemMessage;
if (typeof sys !== 'string') throw new Error(`${NODE} has no systemMessage`);

let result;
if (sys.includes(APPEND_MARKER)) {
  result = { already: true };
} else {
  sys = replaceOnce(`${NODE} city-route`, sys, CITY_ROUTE_OLD, CITY_ROUTE_NEW);
  sys = replaceOnce(`${NODE} city-absent`, sys, CITY_ABSENT_OLD, CITY_ABSENT_NEW);
  sys = sys + APPEND_BLOCK;
  node.parameters.options.systemMessage = sys;
  result = { already: false };
}

await mkdir('output/n8n/backups', { recursive: true });
const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-bia2-semestoque-convince-city-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
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
