import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Patch cirurgico FAQ/FLUXO v2 (2026-06-18) — corrige 4 problemas observados no
// replay do lead VD contra o sandbox, todos nos prompts (systemMessage) das Bias:
//   (1) TABELA: nao negar a tabela; reposicionar com valor (entregamos algo melhor
//       que uma tabela = simulacao completa).                       -> Bia 1
//   (2) REPETICAO de info nao solicitada (horario/abertura da loja). -> Bia 1/2/2SE
//   (3) COR do iPhone DESEJADO nao deve ser perguntada (depende do estoque). -> Bia 1
//   (4) CAUDA REDUNDANTE "ou vai direto?"/"ou prefere tudo no cartao?". -> Bia 1/2/2SE + exemplo Bia 2 SEM ESTOQUE
// GET-fresco -> backup -> exact .replace (guards) -> PUT -> activate -> re-export.
// Idempotente via marcadores. DRY=1 previa sem escrever.

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const EXPORT_PATH = 'output/n8n/ia-repasse-pro-v2-current.json';

// --- Bloco compartilhado injetado nos 3 nos (apos a ancora comum) ----------
const SHARED_ANCHOR = 'Reafirmar a escolha trava a conversa e reduz a qualidade do atendimento.';
const SHARED_MARKER = 'NAO REPETIR INFORMACAO NAO SOLICITADA';
const SHARED_ADD = `

NAO REPETIR INFORMACAO NAO SOLICITADA (humanizacao): NUNCA repita dados que o cliente nao perguntou — horario de funcionamento, status/abertura da loja, endereco. Diga cada um no maximo uma vez e so quando for perguntado ou realmente necessario; repetir informacao nao pedida desumaniza o atendimento.
SEM CAUDA REDUNDANTE: ao perguntar sobre entrada ou troca, NUNCA acrescente caudas como "ou vai direto?", "ou e a vista?", "ou prefere tudo no cartao?". Se o cliente nao quiser dar entrada/troca, e obvio que segue sem ela — pergunte apenas "Pretende dar algum iPhone como parte do pagamento?" / "Pretende dar seu iPhone como entrada?" / "Quer dar algum valor de entrada no Pix pra eu parcelar o restante no cartao?".`;

// --- Edits especificos da Bia 1 -------------------------------------------
const B1_TABELA_OLD = 'Nunca diga que não tem tabela — investigue mostrando a lista.';
const B1_TABELA_NEW = 'Nunca diga (nem dê a entender) que não tem tabela / tabela fixa / tabela de preços — isso é PROIBIDO. Em vez de negar, conduza com valor: numa frase curta explique que aqui o atendimento é personalizado e que, com poucas informações, você entrega algo melhor que uma tabela — uma simulação completa (com parcelamento, entrada e troca) já no valor real pra ele. Em seguida mostre a LISTA CURTA e siga as etapas.';

const B1_COLOR_OLD = '- Se houver available_colors disponíveis e o cliente ainda não informou cor, ofereça no máximo 2 opções .';
const B1_COLOR_NEW = '- NÃO peça nem ofereça a cor do iPhone DESEJADO antes de simular: a cor depende do estoque e perguntar antes faz o cliente pedir uma cor que talvez não tenhamos e perder a venda. Trate cor só APÓS a simulação, ou quando o cliente perguntar. (Isto NÃO vale para o aparelho de ENTRADA/trade-in, cuja cor faz parte da avaliação.)';

const B1_CATALOG_OLD = 'desired_capacity: "E qual armazenamento?"\ndesired_color: "Tem cor de preferência?"\ntradein_model (entrada/troca): "Qual é o modelo do iPhone que você quer dar como entrada?"';
const B1_CATALOG_NEW = 'desired_capacity: "E qual armazenamento?"\ntradein_model (entrada/troca): "Qual é o modelo do iPhone que você quer dar como entrada?"';

const B1_EXAMPLE_OLD = '\n\nFalta cor do desejado:\n{"message": "Tem cor de preferência?", "transfer": false}';
const B1_EXAMPLE_NEW = '';

// --- Edit especifico da Bia 2 SEM ESTOQUE (exemplo de entrada) -------------
const B2SE_ENTRY_OLD = 'Exemplo: "Antes de simular: voce quer dar algum valor de entrada no Pix/dinheiro e parcelar o restante no cartao, ou prefere tudo no cartao?" Nao invente valor de parcela aqui; apenas faca a pergunta.';
const B2SE_ENTRY_NEW = 'Exemplo: "Antes de simular: voce quer dar algum valor de entrada no Pix/dinheiro pra eu parcelar o restante no cartao?" (NUNCA acrescente "ou prefere tudo no cartao?", "ou vai direto?" e caudas similares — se o cliente nao quiser entrada, e obvio que vai tudo no cartao.) Nao invente valor de parcela aqui; apenas faca a pergunta.';

// node -> lista de edits {label, old, new, marker?}; marker => idempotencia
const TARGETS = {
  'Bia 1': [
    { label: 'shared', anchor: SHARED_ANCHOR, old: SHARED_ANCHOR, new: SHARED_ANCHOR + SHARED_ADD, marker: SHARED_MARKER },
    { label: 'tabela', old: B1_TABELA_OLD, new: B1_TABELA_NEW, marker: 'algo melhor que uma tabela' },
    { label: 'color-rule', old: B1_COLOR_OLD, new: B1_COLOR_NEW, marker: 'NÃO peça nem ofereça a cor do iPhone DESEJADO' },
    { label: 'catalog', old: B1_CATALOG_OLD, new: B1_CATALOG_NEW, marker: null, skipIfMissing: 'desired_color: "Tem cor de preferência?"' },
    { label: 'example', old: B1_EXAMPLE_OLD, new: B1_EXAMPLE_NEW, marker: null, skipIfMissing: 'Falta cor do desejado:' },
  ],
  'Bia 2 ESTOQUE': [
    { label: 'shared', anchor: SHARED_ANCHOR, old: SHARED_ANCHOR, new: SHARED_ANCHOR + SHARED_ADD, marker: SHARED_MARKER },
  ],
  'Bia 2 SEM ESTOQUE ': [
    { label: 'shared', anchor: SHARED_ANCHOR, old: SHARED_ANCHOR, new: SHARED_ANCHOR + SHARED_ADD, marker: SHARED_MARKER },
    { label: 'entry-example', old: B2SE_ENTRY_OLD, new: B2SE_ENTRY_NEW, marker: 'NUNCA acrescente "ou prefere tudo no cartao?"' },
  ],
};

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
for (const [nodeName, edits] of Object.entries(TARGETS)) {
  const node = workflow.nodes.find((n) => n.name === nodeName);
  if (!node) throw new Error(`Node not found: ${nodeName}`);
  let sys = node.parameters?.options?.systemMessage;
  if (typeof sys !== 'string') throw new Error(`${nodeName} has no systemMessage`);
  const log = [];
  for (const e of edits) {
    if (e.marker && sys.includes(e.marker)) { log.push(`${e.label}: already`); continue; }
    if (e.skipIfMissing && !sys.includes(e.skipIfMissing)) { log.push(`${e.label}: already (target gone)`); continue; }
    sys = replaceOnce(`${nodeName}/${e.label}`, sys, e.old, e.new);
    log.push(`${e.label}: applied`);
  }
  node.parameters.options.systemMessage = sys;
  result[nodeName] = log;
}

await mkdir('output/n8n/backups', { recursive: true });
const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-bia-faq-flow-v2-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
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
