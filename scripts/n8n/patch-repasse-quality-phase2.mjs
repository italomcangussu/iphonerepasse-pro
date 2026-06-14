// Reconciled Phase-2 quality patch for the LIVE repasse workflow (Cr4fPWe0prwS6XjI).
//
// Why a fresh script: the legacy apply-* scripts are NOT composable.
//   - apply-bias-humanization.mjs depends on the MODELO EXATO block that
//     apply-bia1-stock-presence.mjs inserts (it cleans em-dashes inside it).
//   - apply-bia1-stock-presence.mjs's E1/E3a edits directly conflict with the
//     already-deployed patch-bia1-confident-stock.mjs (Phase 1, 2026-06-14).
// So this single patch produces the intended END-STATE on top of Phase 1:
//   1. Code Build Inventory Lite — desired_exact_available + only_nearby_alternatives.
//   2. Bia 1 — E2 no-stock bullet, a PRE-CLEANED MODELO EXATO INDISPONÍVEL block,
//      the humanization example cleanups (em-dash/;/carimbo) and NATURALIDADE block.
//      (E1/E3a + nearby-* edits are SKIPPED: Phase 1 already fixed the apareceu line
//      and example, and the MODELO EXATO block is authored clean from the start.)
//   3. Bia 2 ESTOQUE / Bia 2 SEM ESTOQUE — full humanization cleanups + NATURALIDADE.
// Footgun guards: needle uniqueness, scanMessageTells must be clean before PUT,
// new Function() syntax-assert on the Code node, backup, activate, verify.
// DRY=1 reads the local export and writes the patched copy to a temp file (no PUT).
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, writeFileSync } from 'node:fs';

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const DRY = process.env.DRY === '1';
const LOCAL_EXPORT = 'output/n8n/ia-repasse-pro-v2-current.json';

function parseEnv(t) {
  return Object.fromEntries(t.split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
}
const env = existsSync('.env.local') ? parseEnv(await readFile('.env.local', 'utf8')) : {};
const KEY = process.env.N8N_API_KEY ?? env.N8N_API_KEY ?? env.N8N_PUBLIC_API;
const ORIGIN = new URL(env.N8N_BASE_URL ?? env.N8N_MCP_URL ?? 'https://iatende-n8n.ylgf5w.easypanel.host').origin;
const api = (p, init = {}) => fetch(new URL(p, ORIGIN), {
  ...init, headers: { 'X-N8N-API-KEY': KEY, 'content-type': 'application/json', ...(init.headers || {}) },
});

// ---- helpers ----
function sub(source, needle, replacement, { min = 1, max = Infinity, label }) {
  const count = source.split(needle).length - 1;
  if (count < min || count > max) throw new Error(`${label}: found ${count} occurrence(s), expected ${min}..${max}`);
  return source.split(needle).join(replacement);
}
function replaceOnce(source, needle, replacement, label) {
  const idx = source.indexOf(needle);
  if (idx === -1) throw new Error(`needle not found: ${label}`);
  if (source.indexOf(needle, idx + needle.length) !== -1) throw new Error(`needle not unique: ${label}`);
  return source.slice(0, idx) + replacement + source.slice(idx + needle.length);
}
function scanMessageTells(name, prompt) {
  const msgs = [...prompt.matchAll(/"message":\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  const offenders = [];
  for (const msg of msgs) {
    if (msg.includes('—')) offenders.push(`em-dash: ${msg.slice(0, 60)}`);
    if (msg.includes(';')) offenders.push(`semicolon: ${msg.slice(0, 60)}`);
    if (/\bapareceu\b/.test(msg)) offenders.push(`apareceu: ${msg.slice(0, 60)}`);
  }
  if (offenders.length) throw new Error(`${name} ainda tem caguetes nos exemplos:\n  ${offenders.join('\n  ')}`);
  console.log(`  scan limpo [${name}]: ${msgs.length} exemplos`);
}

const NATURALIDADE_BLOCK = `NATURALIDADE — SEM CARA DE IA (REGRA DURA)

Estes sinais entregam texto de robô e são PROIBIDOS dentro de "message":
- Travessão (—) ou hífen com espaços ( - ) no meio de frase. Reescreva com vírgula, ponto ou duas frases curtas.
- Ponto e vírgula (;).
- Mais de 1 exclamação na mesma mensagem. O natural é a maioria das mensagens não ter nenhuma.
- Começar duas mensagens seguidas com a mesma palavra (Show, Perfeito, Boa, Tranquilo). Varie a abertura ou entre direto no assunto.
- Fechar toda transferência com a mesma frase pronta. Use "Qualquer coisa é só chamar!" no máximo de vez em quando. Varie ("qualquer dúvida me chama", "tô por aqui se precisar") ou apenas finalize a frase.
- Conectivos de redação: "todavia", "entretanto", "ademais", "além disso", "vale destacar".
- Mais de 1 emoji por mensagem. Nem toda mensagem precisa de emoji.
Escreva como uma atendente real escreve no WhatsApp: frases curtas, "pra", "tá", direto ao ponto.`;

const BOT_OLD = `não sou aquele tipo de bot que dá raiva — se preferir falar com um atendente é só pedir que transfiro na hora. 👍`;
const BOT_NEW = `não sou aquele tipo de bot que dá raiva. Se preferir falar com um atendente é só pedir que transfiro na hora 👍`;

// PRE-CLEANED MODELO EXATO block (em-dash removed from "message" examples; carimbo
// dropped from the passo-4 transfer; "apareceu" never used inside messages).
const MODELO_EXATO_BLOCK = `MODELO EXATO INDISPONÍVEL NA PRÉ-CONSULTA (only_nearby_alternatives = true)

Quando o modelo exato que o cliente pediu NÃO está no estoque atual, mas há um
modelo próximo (ex.: pediu iPhone 15, só há 15 Pro Max), NUNCA apresente o
modelo próximo como se fosse o que ele pediu, e NUNCA fale em reserva por conta
própria (só cite reserva se o próprio cliente pedir). Siga esta ordem:

1º. Seja transparente sobre o modelo exato e mostre agilidade, sem prometer data:
   "O iPhone 15 não está aqui no estoque agora, mas costuma chegar rápido, muitas
    vezes no mesmo dia. Quer que eu te avise assim que entrar?"

2º. Pode oferecer o próximo como alternativa, com enquadramento de valor:
   "Tenho aqui também o iPhone 15 Pro Max, se tiver interesse consigo já simular
    pra você com o seu aparelho atual como entrada."

   Você pode juntar 1º e 2º numa única mensagem curta. Nunca diga "apareceu".

3º. Se o cliente ACEITA o modelo próximo: siga o funil normal (avaliação do
   aparelho de entrada, se houver). NÃO transfira. transfer: false.

4º. Se o cliente quer ESPERAR o modelo exato: encaminhe ao especialista, sem
   prometer reserva.
   {"message": "Vou te passar pro nosso especialista pra acompanhar a chegada do seu iPhone 15 com você, beleza?", "transfer": true}

Exemplo (passo 1+2 juntos):
{"message": "O iPhone 15 não está no estoque agora, mas costuma chegar rápido, às vezes no mesmo dia. Quer que eu te avise quando entrar? Se preferir, tenho aqui o 15 Pro Max e já consigo simular com o seu aparelho como entrada.", "transfer": false}


`;

// ---- node patchers ----
function patchInventoryLite(code) {
  if (code.includes('desired_exact_available')) return code; // idempotent
  const needle =
    '      pre_inventory_found: pool.length > 0,\n' +
    '      model_match_status,\n' +
    '      available_models: modelNames.slice(0, 8),';
  const replacement =
    '      pre_inventory_found: pool.length > 0,\n' +
    '      model_match_status,\n' +
    '      desired_exact_available: model_match_status === "exact",\n' +
    '      only_nearby_alternatives: pool.length > 0 && model_match_status !== "exact" && model_match_status !== "ambiguous",\n' +
    '      available_models: modelNames.slice(0, 8),';
  return replaceOnce(code, needle, replacement, 'InventoryLite pre_inventory flags');
}

function patchBia1(s) {
  if (s.includes('NATURALIDADE — SEM CARA DE IA')) return s; // idempotent
  // E2 — point the no-stock bullet at the new block.
  s = replaceOnce(s,
    `- Se não houver estoque na pre-consulta, não prometa indisponibilidade definitiva; diga que vai verificar melhor ou chame especialista se fizer sentido.`,
    `- Se only_nearby_alternatives = true (o modelo exato não está, mas há um parecido), siga o bloco "MODELO EXATO INDISPONÍVEL" abaixo. Se não houver nada na pré-consulta, não prometa indisponibilidade definitiva; diga que vai verificar melhor ou chame especialista se fizer sentido.`,
    'E2 no-stock bullet');
  // E3b — insert the pre-cleaned block right before TRÊS TIPOS DE MENSAGEM INICIAL.
  s = replaceOnce(s, `TRÊS TIPOS DE MENSAGEM INICIAL`, MODELO_EXATO_BLOCK + `TRÊS TIPOS DE MENSAGEM INICIAL`, 'E3b insert block');
  // Humanization cleanups (needles verified present in live).
  s = sub(s, BOT_OLD, BOT_NEW, { min: 2, max: 2, label: 'bot sem travessão' });
  s = sub(s, `"E qual armazenamento — 128, 256, 512?"`, `"E qual armazenamento? 128, 256 ou 512?"`, { min: 1, max: 1, label: 'armazenamento template' });
  s = sub(s, `"E qual armazenamento — 128, 256 ou 512?"`, `"E qual armazenamento? 128, 256 ou 512?"`, { min: 1, max: 1, label: 'armazenamento exemplo' });
  s = sub(s, `Show, faltou só: [campos]. Pode me passar?`, `Boa, faltou só [campos]. Pode me passar?`, { min: 1, max: 1, label: 'faltou-só template' });
  s = sub(s, `Show, faltou só: o % de bateria e se tá na garantia Apple. Pode me passar?`, `Boa, faltou só o % de bateria e se tá na garantia Apple. Pode me passar?`, { min: 1, max: 1, label: 'faltou-só exemplo' });
  s = sub(s, `Entendido, vou te conectar com nossa equipe agora pra olhar isso com você. Qualquer coisa é só chamar!`, `Entendido, vou te conectar com nossa equipe agora pra olhar isso com você.`, { min: 2, max: 2, label: 'garantia sem carimbo' });
  // NATURALIDADE block.
  s = sub(s, `Não repita o que o cliente disse. Não use o nome do cliente em mensagens consecutivas.`,
    `Não repita o que o cliente disse. Não use o nome do cliente em mensagens consecutivas.\n\n\n${NATURALIDADE_BLOCK}`,
    { min: 1, max: 1, label: 'bloco naturalidade' });
  return s;
}

function patchBia2Estoque(s) {
  if (s.includes('NATURALIDADE — SEM CARA DE IA')) return s;
  s = sub(s, BOT_OLD, BOT_NEW, { min: 1, max: 1, label: 'bot sem travessão' });
  s = sub(s, `em frente a Americanas — quiosque`, `em frente à Americanas, no quiosque`, { min: 2, max: 2, label: 'endereço Sobral' });
  s = sub(s, `O valor já é o à vista — no cartão o que muda é conforme as parcelas.`, `O valor já é o à vista, no cartão o que muda é conforme as parcelas.`, { min: 1, max: 1, label: 'objeção' });
  s = sub(s, `certinha na simulacao; qual a bandeira do seu cartao?`, `certinha na simulacao. Qual a bandeira do seu cartao?`, { min: 1, max: 1, label: 'preço-insistência ;' });
  s = sub(s, `Em Sobral apareceu Prateado disponivel`, `Em Sobral tenho o Prateado disponivel`, { min: 1, max: 1, label: 'apareceu Prateado' });
  s = sub(s, `Esse modelo exato nao apareceu agora, mas encontrei opcoes proximas:`, `Esse modelo exato nao ta no estoque agora, mas tenho opcoes proximas:`, { min: 1, max: 1, label: 'apareceu handoff' });
  s = sub(s, `ainda hoje ou amanha; na maioria das vezes a gente consegue transferir entre lojas no mesmo dia.`, `ainda hoje ou amanha. Na maioria das vezes a gente consegue transferir entre lojas no mesmo dia.`, { min: 1, max: 1, label: 'cross-city ;' });
  s = sub(s, `Show, é o Azul Profundo.`, `Esse é o Azul Profundo.`, { min: 2, max: 4, label: 'B1 abertura' });
  s = sub(s, `"Show. Qual a bandeira do seu cartão? Pode ser Visa, Master, Elo ou Amex."`, `"Fechou. Qual a bandeira do seu cartão? Visa, Master, Elo ou Amex?"`, { min: 1, max: 1, label: 'estágio 2 abertura' });
  s = sub(s, `"Show, vou refazer a simulacao com esse valor de entrada e ja te mando."`, `"Boa, refaco a simulacao com esse valor de entrada e ja te mando."`, { min: 1, max: 1, label: 'rerun entrada' });
  s = sub(s, `"Show, simulo agora pra voce."`, `"Boa, ja simulo aqui pra voce."`, { min: 2, max: 2, label: 'rerun opção' });
  s = sub(s, `Perfeito! Pix recebido. Qual horário você quer vim?`, `Pix recebido ✅ Que horário fica bom pra você vir buscar?`, { min: 2, max: 2, label: 'pix + vim→vir' });
  s = sub(s, `Perfeito. Poderia me passar seus dados para cadastro?`, `Boa. Me passa seus dados pro cadastro?`, { min: 2, max: 2, label: 'cadastro' });
  s = sub(s, `O que você achou da proposta, vamos providenciar o fechamento? 😃`, `O que achou da proposta? Quer que eu já encaminhe o fechamento? 😃`, { min: 2, max: 2, label: 'fechamento' });
  s = sub(s, `Já chamo nossa equipe pra continuar com você. Qualquer coisa é só chamar!`, `Já chamo nossa equipe pra continuar com você 👍`, { min: 1, max: 1, label: 'humano sem carimbo' });
  s = sub(s, `Não repita o que o cliente disse. Não use o nome em mensagens consecutivas.`,
    `Não repita o que o cliente disse. Não use o nome em mensagens consecutivas.\n\n\n${NATURALIDADE_BLOCK}`,
    { min: 1, max: 1, label: 'bloco naturalidade' });
  return s;
}

function patchBia2SemEstoque(s) {
  if (s.includes('NATURALIDADE — SEM CARA DE IA')) return s;
  s = sub(s, `continua valendo; quer que eu siga com a reserva?`, `continua valendo. Quer que eu siga com a reserva?`, { min: 1, max: 1, label: 'FAQ ;' });
  s = sub(s, `O que você achou da proposta, vamos providenciar o fechamento? 😃`, `O que achou da proposta? Quer que eu já encaminhe o fechamento? 😃`, { min: 1, max: 1, label: 'fechamento' });
  s = sub(s, `Já chamo nossa equipe pra continuar com você. Qualquer coisa é só chamar!`, `Já chamo nossa equipe pra continuar com você 👍`, { min: 1, max: 1, label: 'humano sem carimbo' });
  s = sub(s, `Evite clichês como "Claro!", "Com certeza!" e "Pode deixar!".`,
    `Evite clichês como "Claro!", "Com certeza!" e "Pode deixar!".\n\n${NATURALIDADE_BLOCK}`,
    { min: 1, max: 1, label: 'bloco naturalidade' });
  return s;
}

// ---- run ----
let workflow;
if (DRY) {
  workflow = JSON.parse(await readFile(LOCAL_EXPORT, 'utf8'));
  console.log('DRY mode: patching local export, no PUT');
} else {
  const res = await api(`/api/v1/workflows/${WORKFLOW_ID}`);
  if (!res.ok) throw new Error(`GET failed: ${res.status} ${await res.text()}`);
  workflow = await res.json();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-quality-phase2-${ts}.json`;
  writeFileSync(backupPath, JSON.stringify(workflow, null, 2));
  console.log(`backup: ${backupPath}`);
}

const byName = Object.fromEntries(workflow.nodes.map((n) => [n.name, n]));

const inv = byName['Code Build Inventory Lite'];
if (!inv) throw new Error('Code Build Inventory Lite not found');
inv.parameters.jsCode = patchInventoryLite(inv.parameters.jsCode);
new Function(inv.parameters.jsCode); // syntax assert
console.log('patched: Code Build Inventory Lite');

const AGENTS = [['Bia 1', patchBia1], ['Bia 2 ESTOQUE', patchBia2Estoque], ['Bia 2 SEM ESTOQUE ', patchBia2SemEstoque]];
for (const [name, patch] of AGENTS) {
  const node = byName[name];
  if (!node) throw new Error(`${name} not found`);
  node.parameters.options.systemMessage = patch(node.parameters.options.systemMessage);
  scanMessageTells(name, node.parameters.options.systemMessage);
  console.log(`patched: ${name}`);
}

if (DRY) {
  const out = '/tmp/repasse-phase2-dry.json';
  await writeFile(out, JSON.stringify(workflow, null, 2));
  console.log(`DRY done -> ${out}`);
} else {
  const ALLOWED = ['saveExecutionProgress', 'saveManualExecutions', 'saveDataErrorExecution',
    'saveDataSuccessExecution', 'executionTimeout', 'errorWorkflow', 'timezone', 'executionOrder'];
  const settings = Object.fromEntries(Object.entries(workflow.settings ?? {}).filter(([k]) => ALLOWED.includes(k)));
  const body = { name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings };
  if (workflow.staticData) body.staticData = workflow.staticData;
  const put = await api(`/api/v1/workflows/${WORKFLOW_ID}`, { method: 'PUT', body: JSON.stringify(body) });
  if (!put.ok) throw new Error(`PUT failed: ${put.status} ${await put.text()}`);
  let active = (await put.json()).active;
  if (!active) { const a = await api(`/api/v1/workflows/${WORKFLOW_ID}/activate`, { method: 'POST' }); active = a.ok; }
  const verify = await (await api(`/api/v1/workflows/${WORKFLOW_ID}`)).json();
  console.log(JSON.stringify({
    deployed: true,
    active: verify.active,
    invFlags: verify.nodes.find((n) => n.name === 'Code Build Inventory Lite').parameters.jsCode.includes('desired_exact_available'),
    modeloExato: verify.nodes.find((n) => n.name === 'Bia 1').parameters.options.systemMessage.includes('MODELO EXATO INDISPONÍVEL'),
    naturalidade: ['Bia 1', 'Bia 2 ESTOQUE', 'Bia 2 SEM ESTOQUE '].every((n) => verify.nodes.find((x) => x.name === n).parameters.options.systemMessage.includes('NATURALIDADE — SEM CARA DE IA')),
    updatedAt: verify.updatedAt,
  }, null, 2));
}
