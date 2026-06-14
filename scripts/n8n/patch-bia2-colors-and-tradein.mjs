import { readFile } from 'node:fs/promises';

// Surgical patch for the issues found in execution #405587:
//  A) Bia 2 hallucinated iPhone 15 colors (even non-existent ones) with no stock
//     data. Add a hard rule: colors are ONLY ever sourced from real inventory.
//  B) Memory Extractor/Reconciler mis-mapped trade-in answers into desired_*.
//     Reinforce trade-in vs desired-device disambiguation.
//  C) Pass the `memory` object through Edit Fields5 so Bia 2's $json.memory?.*
//     reads resolve (richer fields than the flat passthrough).

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
}

const env = parseEnv(await readFile('.env.local', 'utf8'));
const KEY = env.N8N_API_KEY;
const ORIGIN = new URL(env.N8N_BASE_URL).origin;
if (!KEY) throw new Error('Missing N8N_API_KEY');

const api = (path, init = {}) => fetch(new URL(path, ORIGIN), {
  ...init,
  headers: { 'X-N8N-API-KEY': KEY, 'content-type': 'application/json', ...(init.headers || {}) },
});

// ---- Insertion blocks --------------------------------------------------------

const COLOR_RULE_CONTINUIDADE = `REGRA DE CORES — NUNCA INVENTE COR

Você nunca cita, lista ou oferece nomes de cor a partir do seu próprio conhecimento. Cor só pode vir de dados reais de estoque.
- Só ofereça cores que vierem de inventory.available_colors, inventory.available_colors_same_capacity, inventory.available_options ou de last_inventory_context (opções já apresentadas neste lead).
- Se não houver estoque consultado neste turno (inventory ausente) e nenhuma cor salva em last_inventory_context, NÃO liste nomes de cor. Avance com outra pergunta operacional (capacidade, condição, cidade) ou confirme o modelo desejado, sem enumerar cores.
- Nunca enumere cores de um modelo a partir da sua memória (ex.: não diga "Meia-noite, Rosa, Azul-celeste"): essas cores podem nem existir para o modelo ou não estar no estoque.
- Quando precisar saber a cor desejada e não houver estoque, pergunte de forma aberta: "Tem alguma cor de preferência?" — sem oferecer uma lista de cores.

`;

const COLOR_RULE_ESTOQUE = `REGRA ABSOLUTA DE COR — SOMENTE ESTOQUE

Toda cor citada ou oferecida deve vir exclusivamente dos campos de estoque (inventory.best_item, available_colors, available_colors_same_capacity, available_options). Nunca enumere cores a partir do seu conhecimento do modelo; uma cor que não está nesses campos não existe para esta conversa. Se o cliente pedir uma cor que não está no estoque, diga que nessa cor não há agora e ofereça apenas as cores realmente disponíveis nos campos de estoque.


`;

const TRADEIN_RULE_EXTRACTOR = `

// DESAMBIGUACAO TRADE-IN vs DESEJADO (CRITICO)
- Quando a ultima mensagem enviada ao cliente perguntou sobre o aparelho ATUAL dele (ex.: "seu iPhone X", "seu aparelho", e armazenamento/cor/bateria/arranhoes/contato com liquido/marcas/caixa e cabo/garantia do aparelho de entrada), as respostas do cliente descrevem o aparelho de ENTRADA: preencha tradein_model, tradein_capacity, tradein_color, tradein_scratches, tradein_liquid_contact, tradein_side_marks, tradein_parts_swapped, tradein_has_box_cable, tradein_battery_pct e tradein_apple_warranty, e marque has_tradein = true. NUNCA jogue esses dados em desired_model/desired_capacity/desired_color.
- desired_* descreve apenas o iPhone que o cliente quer COMPRAR. So preencha desired_* quando o cliente falar do aparelho que quer adquirir, nao do que esta dando como entrada.
- Se o cliente esta respondendo o questionario de avaliacao do trade-in, defina interest_type = "troca".`;

const TRADEIN_RULE_RECONCILER = `

// DESAMBIGUACAO TRADE-IN vs DESEJADO (CRITICO)
- Se a ultima pergunta enviada foi sobre o aparelho atual do cliente (armazenamento/cor/bateria/arranhoes/liquido/marcas/caixa e cabo/garantia do aparelho de entrada), as respostas pertencem ao trade-in: mantenha/atualize tradein_* e has_tradein = true, e nunca mova esses valores para desired_*.
- Preserve desired_* apenas para o iPhone que o cliente quer comprar. Se o cliente esta no questionario de avaliacao do trade-in, interest_type = "troca".
- Nao deixe desired_model igual ao tradein_model por confusao de origem; se a unica evidencia for o aparelho de entrada, desired_model permanece como estava (ou null).`;

// ---- Anchor-based system-message edits --------------------------------------

const SYSTEM_EDITS = {
  'Bia 2 SEM ESTOQUE ': {
    anchor: 'FAQ COMERCIAL CONTROLADO — PRIORIDADE MAXIMA',
    apply: (text, anchor) => text.replace(anchor, COLOR_RULE_CONTINUIDADE + anchor),
  },
  'Bia 2 ESTOQUE': {
    anchor: 'SEM POLÍTICA DE COR / SEM DESCONTO À VISTA',
    apply: (text, anchor) => text.replace(anchor, COLOR_RULE_ESTOQUE + anchor),
  },
  'Memory 1 - Extractor': {
    anchor: 'devem preencher os booleanos de estado como false quando forem resposta direta à última pergunta sobre avaliação.',
    apply: (text, anchor) => text.replace(anchor, anchor + TRADEIN_RULE_EXTRACTOR),
  },
  'Memory 2 - Reconciler': {
    anchor: 'Nunca marque avaliação completa se algum desses campos estiver null. O Parse Memory decide a próxima pergunta.',
    apply: (text, anchor) => text.replace(anchor, anchor + TRADEIN_RULE_RECONCILER),
  },
};

// ---- Fetch, mutate, validate -------------------------------------------------

const res = await api(`/api/v1/workflows/${WORKFLOW_ID}`);
if (!res.ok) throw new Error(`GET failed: ${res.status} ${await res.text()}`);
const wf = await res.json();

const report = [];

for (const [nodeName, edit] of Object.entries(SYSTEM_EDITS)) {
  const node = wf.nodes.find((n) => n.name === nodeName);
  if (!node) throw new Error(`Node not found: ${nodeName}`);
  const sm = node.parameters?.options?.systemMessage;
  if (typeof sm !== 'string') throw new Error(`No systemMessage on: ${nodeName}`);
  const occurrences = sm.split(edit.anchor).length - 1;
  if (occurrences !== 1) throw new Error(`Anchor for "${nodeName}" found ${occurrences}x (need exactly 1): ${edit.anchor}`);
  const next = edit.apply(sm, edit.anchor);
  if (next === sm) throw new Error(`No change applied for ${nodeName}`);
  node.parameters.options.systemMessage = next;
  report.push({ node: nodeName, systemMessage: 'updated' });
}

// Edit Fields5 — add `memory` object passthrough (idempotent).
const ef5 = wf.nodes.find((n) => n.name === 'Edit Fields5');
if (!ef5) throw new Error('Edit Fields5 not found');
const list = ef5.parameters.assignments.assignments;
if (!list.some((a) => a.name === 'memory')) {
  list.push({ id: 'ctx-memory-passthrough', name: 'memory', value: '={{ $json.memory }}', type: 'object' });
  report.push({ node: 'Edit Fields5', assignment: 'memory added' });
} else {
  report.push({ node: 'Edit Fields5', assignment: 'memory already present' });
}

// ---- PUT + reactivate --------------------------------------------------------

const ALLOWED_SETTINGS = ['saveExecutionProgress', 'saveManualExecutions', 'saveDataErrorExecution',
  'saveDataSuccessExecution', 'executionTimeout', 'errorWorkflow', 'timezone', 'executionOrder'];
const settings = Object.fromEntries(
  Object.entries(wf.settings ?? {}).filter(([k]) => ALLOWED_SETTINGS.includes(k)));
const body = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings };
if (wf.staticData) body.staticData = wf.staticData;

const put = await api(`/api/v1/workflows/${WORKFLOW_ID}`, { method: 'PUT', body: JSON.stringify(body) });
if (!put.ok) throw new Error(`PUT failed: ${put.status} ${await put.text()}`);
const updated = await put.json();

let active = updated.active;
if (!active) {
  const act = await api(`/api/v1/workflows/${WORKFLOW_ID}/activate`, { method: 'POST' });
  active = act.ok;
  if (!act.ok) console.error(`activate failed: ${act.status} ${await act.text()}`);
}

console.log(JSON.stringify({ report, active, updatedAt: updated.updatedAt }, null, 2));
