import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Bia 1 (pré-estoque): aplica as regras de FAQ/FLUXO.
//  - Preço sob demanda (remove "NUNCA cite preço nem se perguntar").
//  - Nunca perguntar cidade nesta fase (cidade só pós-simulação).
//  - Lista curta sem preço para perguntas genéricas / pedido de tabela.
//  - Autorização direta do seminovo ("posso te fazer algumas perguntas...").
//  - Banir "compra direta" + confirmar variante (13/Pro/Pro Max).
// Idempotente via APPEND_MARKER. Expression prompt fica em workflow.json → patch.

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const EXPORT_PATH = 'output/n8n/ia-repasse-pro-v2-current.json';
const NODE = 'Bia 1';
const APPEND_MARKER = '// ATUALIZACAO DE FLUXO (FAQ/FLUXO) v1';

const PRECO_OLD = `NUNCA cite preço, valor ou faixa de preço — nem se o cliente perguntar. Diga que o valor sai certinho na simulação (após a avaliação do aparelho de entrada, se houver) e siga a coleta. Afirme o estoque com confiança quando a pré-consulta trouxer o item: diga "Temos o [available_models] [available_conditions] em estoque com armazenamento de [available_capacities]" ou "Temos o [modelo] em estoque". NUNCA use hedge como "apareceu por aqui", "vi opções" ou "vi que tem opção ... por aqui". Ainda assim, NÃO confirme como reserva/separação nem cite preço.`;
const PRECO_NEW = `Não OFEREÇA preço espontaneamente na navegação. MAS se o cliente PERGUNTAR preço, RESPONDA: o valor à vista de um modelo (use available_options[].sell_price) e a diferença de valor entre dois modelos. Parcelamento, entrada e troca só na simulação da Bia 2. Afirme o estoque com confiança quando a pré-consulta trouxer o item: diga "Temos o [available_models] [available_conditions] em estoque com armazenamento de [available_capacities]" ou "Temos o [modelo] em estoque". NUNCA use hedge como "apareceu por aqui", "vi opções" ou "vi que tem opção ... por aqui". Ainda assim, NÃO confirme como reserva/separação.`;

const CITY_OLD = `Se já tiver modelo e capacidade, mas faltar cidade: {"message": "Voce prefere retirar em Fortaleza ou Sobral?", "transfer": false}`;
const CITY_NEW = `Nunca pergunte cidade de retirada nesta fase: a cidade só é perguntada após a simulação aceita.`;

const MAX2_OLD = `mencione no máximo 2 opções disponíveis em 1 frase curta e, ao final, peça permissão para avaliar o aparelho de entrada. Não junte cor, nome e bloco completo no mesmo envio.`;
const MAX2_NEW = `quando a pergunta for genérica (ex.: "quais vocês têm", "modelos Pro Max", pedido de tabela), monte uma LISTA CURTA: até 5 itens por modelo + capacidade (marque novo/seminovo quando útil), SEM cor e SEM preço, terminando com "qual desses te interessa?". Nunca diga que não tem tabela — investigue mostrando a lista. Se houver aparelho de entrada, ao final peça permissão para avaliá-lo. Não junte cor, nome e bloco completo no mesmo envio.`;

const AUTH_OLD = `Posso te mandar as perguntinhas pra calcular o valor do seu [tradein_model] como entrada?"`;
const AUTH_NEW = `Posso te fazer algumas perguntas sobre o seu iPhone?"`;

const APPEND_BLOCK = `

${APPEND_MARKER}
- NUNCA use os termos "compra direta" nem "tem aparelho de entrada?". Para saber se há troca, pergunte de forma humana: "você pretende dar um iPhone usado como parte do pagamento?".
- Se needs_model_tier_confirmation = true ou routing_decision = "ask_model_tier" (cliente disse só "13/14/15"), antes de seguir confirme a variante: "esse 13 é o normal, o Pro ou o Pro Max?".
- Diferença de preço entre dois modelos: se o cliente perguntar, calcule e informe a diferença usando available_options[].sell_price (sem detalhar parcelas).`;

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
  sys = replaceOnce(`${NODE} preço`, sys, PRECO_OLD, PRECO_NEW);
  sys = replaceOnce(`${NODE} cidade`, sys, CITY_OLD, CITY_NEW);
  sys = replaceOnce(`${NODE} lista-curta`, sys, MAX2_OLD, MAX2_NEW);
  sys = replaceOnce(`${NODE} autorização`, sys, AUTH_OLD, AUTH_NEW);
  sys = sys + APPEND_BLOCK;
  node.parameters.options.systemMessage = sys;
  result = { already: false };
}

await mkdir('output/n8n/backups', { recursive: true });
const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-bia1-price-city-list-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
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
