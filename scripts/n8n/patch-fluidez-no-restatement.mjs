import { readFile } from 'node:fs/promises';

// Conversation-quality fix: agents must not restate the customer's own choice
// ("vi que você quer iPhone 13 Pro Max rosa!") when desired_model/desired_color
// are already in state — it stalls the flow. Prompt-only, no routing change.

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';

const RULE = `FLUIDEZ — NÃO REAFIRME A ESCOLHA DO CLIENTE

Quando desired_model e/ou desired_color já estão preenchidos no estado, nunca devolva frases que repetem a escolha do cliente como novidade — evite "vi que você quer...", "você escolheu...", "ótimo, você quer o [modelo] [cor]!", "então você quer...". Trate o que já foi informado como certo e avance direto para a próxima etapa (cidade, capacidade, bandeira, simulação ou fechamento) com no máximo uma pergunta curta. Reafirmar a escolha trava a conversa e reduz a qualidade do atendimento.

`;

const EDITS = {
  'Bia 2 SEM ESTOQUE ': 'DESAMBIGUACAO ENTRE IPHONE DESEJADO E IPHONE DE ENTRADA',
  'Bia 2 ESTOQUE': 'REGRA DE DADOS — MEMORY É A FONTE DE VERDADE',
  'Bia 1': 'DESAMBIGUACAO ENTRE IPHONE DESEJADO E IPHONE DE ENTRADA',
};

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
const api = (p, init = {}) => fetch(new URL(p, ORIGIN), {
  ...init, headers: { 'X-N8N-API-KEY': KEY, 'content-type': 'application/json', ...(init.headers || {}) },
});

const res = await api(`/api/v1/workflows/${WORKFLOW_ID}`);
if (!res.ok) throw new Error(`GET failed: ${res.status} ${await res.text()}`);
const wf = await res.json();

const report = [];
for (const [name, anchor] of Object.entries(EDITS)) {
  const node = wf.nodes.find((n) => n.name === name);
  if (!node) throw new Error(`Node not found: ${name}`);
  const sm = node.parameters?.options?.systemMessage;
  if (typeof sm !== 'string') throw new Error(`No systemMessage on ${name}`);
  if (sm.includes('FLUIDEZ — NÃO REAFIRME A ESCOLHA DO CLIENTE')) {
    report.push({ node: name, status: 'already present' });
    continue;
  }
  const occ = sm.split(anchor).length - 1;
  if (occ !== 1) throw new Error(`Anchor for "${name}" found ${occ}x (need 1): ${anchor}`);
  node.parameters.options.systemMessage = sm.replace(anchor, RULE + anchor);
  report.push({ node: name, status: 'rule inserted' });
}

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
console.log(JSON.stringify({ report, active, updatedAt: updated.updatedAt }, null, 2));
