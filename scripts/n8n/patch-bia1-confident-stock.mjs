import { readFile } from 'node:fs/promises';

// Real-traffic fixes for Bia 1 (observed in live conv on 2026-06-13):
//  1. Hedge phrasing "Vi que tem opção de 256GB por aqui" -> confident "Temos em
//     estoque o de 256GB" (the precheck reflects real stock; owner wants confidence).
//  2. Re-asking the desired model the customer already gave -> extend REGRA DE OURO
//     to cover the model via conversation history (mitigates the stale-read race).

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const NODE = 'Bia 1';

const EDITS = [
  {
    find: 'Use linguagem de pré-consulta ("apareceu por aqui", "vi opções"), nunca confirme como reserva/separação.',
    replace: 'Afirme o estoque com confiança quando a pré-consulta trouxer o item: diga "Temos em estoque o de [capacidade]" ou "Temos o [modelo] em estoque". NUNCA use hedge como "apareceu por aqui", "vi opções" ou "vi que tem opção ... por aqui". Ainda assim, NÃO confirme como reserva/separação nem cite preço.',
  },
  {
    find: '{"message": "Temos iPhone 15 por aqui sim. Vi opções em 128GB e 256GB. Qual armazenamento você prefere?", "transfer": false}',
    replace: '{"message": "Temos o iPhone 15 em estoque, nas versões 128GB e 256GB. Qual armazenamento você prefere?", "transfer": false}',
  },
  {
    find: 'REGRA DE OURO: só pergunte o que o cliente ainda NÃO informou. Se ele já disse o armazenamento na primeira mensagem, não pergunte de novo.',
    replace: 'REGRA DE OURO: só pergunte o que o cliente ainda NÃO informou. Se ele já disse o armazenamento na primeira mensagem, não pergunte de novo. Isso vale também para o MODELO desejado: se o cliente já disse qual iPhone quer em QUALQUER mensagem desta conversa (mesmo que o estado esteja momentaneamente vazio), NUNCA pergunte "qual iPhone você quer comprar?" de novo — assuma o modelo informado e avance. Use o histórico da conversa, não dependa só do estado.',
  },
];

function parseEnv(t) {
  return Object.fromEntries(t.split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
}
const env = parseEnv(await readFile('.env.local', 'utf8'));
const KEY = env.N8N_API_KEY;
const ORIGIN = new URL(env.N8N_BASE_URL).origin;
const api = (p, init = {}) => fetch(new URL(p, ORIGIN), {
  ...init, headers: { 'X-N8N-API-KEY': KEY, 'content-type': 'application/json', ...(init.headers || {}) },
});

const res = await api(`/api/v1/workflows/${WORKFLOW_ID}`);
if (!res.ok) throw new Error(`GET failed: ${res.status} ${await res.text()}`);
const wf = await res.json();
const node = wf.nodes.find((n) => n.name === NODE);
if (!node) throw new Error(`Node not found: ${NODE}`);
let sm = node.parameters.options.systemMessage;
const report = [];
for (const e of EDITS) {
  if (sm.includes(e.replace)) { report.push({ status: 'already applied', snippet: e.replace.slice(0, 40) }); continue; }
  const occ = sm.split(e.find).length - 1;
  if (occ !== 1) throw new Error(`anchor ${occ}x (need 1): ${e.find.slice(0, 50)}`);
  sm = sm.replace(e.find, e.replace);
  report.push({ status: 'applied', snippet: e.replace.slice(0, 40) });
}
node.parameters.options.systemMessage = sm;

const ALLOWED = ['saveExecutionProgress', 'saveManualExecutions', 'saveDataErrorExecution',
  'saveDataSuccessExecution', 'executionTimeout', 'errorWorkflow', 'timezone', 'executionOrder'];
const settings = Object.fromEntries(Object.entries(wf.settings ?? {}).filter(([k]) => ALLOWED.includes(k)));
const body = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings };
if (wf.staticData) body.staticData = wf.staticData;
const put = await api(`/api/v1/workflows/${WORKFLOW_ID}`, { method: 'PUT', body: JSON.stringify(body) });
if (!put.ok) throw new Error(`PUT failed: ${put.status} ${await put.text()}`);
const updated = await put.json();
let active = updated.active;
if (!active) { const a = await api(`/api/v1/workflows/${WORKFLOW_ID}/activate`, { method: 'POST' }); active = a.ok; }
console.log(JSON.stringify({ node: NODE, report, active, updatedAt: updated.updatedAt }, null, 2));
