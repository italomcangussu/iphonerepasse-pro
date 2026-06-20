// Structural validator for the LIVE repasse workflow (Cr4fPWe0prwS6XjI).
// Run after a surgical patch + re-export:
//   node scripts/n8n/export-repasse-workflow.mjs
//   node scripts/n8n/validate-repasse-next-workflow.mjs
// Default input is the live export. The legacy build-clone (path `repasse-next`,
// `credenciais` literal node, inactive) is NO LONGER the validation target — the
// production workflow diverged from it (path `repasse`, real credential refs, active).
import { readFile } from 'node:fs/promises';

const path = process.argv[2] || 'output/n8n/ia-repasse-pro-v2-current.json';
const workflow = JSON.parse(await readFile(path, 'utf8'));
const names = new Set(workflow.nodes.map((node) => node.name));

const required = [
  'Webhook',
  'Formatar Payload CRM2',
  'Atualizar Estado Buffer',
  'Calcular Wait Buffer',
  'Verificar vencedor',
  'Tentar Lock',
  'Redis Get Buffer',
  'Redis Set Buffer',
  'Redis Delete Buffer',
  'Redis Get Lock',
  'Redis Set Lock',
  'Redis Delete Lock',
  'Router Agent',
  'Postgres Chat Memory',
  'Postgres Chat Memory1',
  // 'Postgres Chat Memory3' (memória do Memory 2 - Reconciler) e
  // 'Postgres Chat Memory4' (órfão, antiga thread do Memory 1 - Extractor) foram
  // removidos em 2026-06-20 (patch-remove-reconciler-memory.mjs): o Reconciler é
  // agente de saída estruturada e dono do lead_state — chat memory era redundante
  // com o `prev` no prompt e adicionava entrada não-determinística.
  'Memory 1 - Extractor',
  'Memory 2 - Reconciler',
  // 'Parse Memory' was removed 2026-06-14: the deterministic safety-net node is
  // gone. Memory 2 - Reconciler now fully owns lead_state and 'Code in JavaScript2'
  // just flattens memory → root before Edit Fields5.
  'Code in JavaScript2',
  // Routing flags node (2026-06-14, patch-add-routing-flags-node.mjs): restaura a
  // computação determinística das flags de roteamento após a deleção do Parse
  // Memory. Sem ele o Switch3 (sem fallback) descarta o item → bot mudo.
  'Code Routing Flags',
  'Should Precheck Inventory',
  'Code Build Inventory Lite',
  // Funil de inventário (manual edit 2026-06-14): junta as duas pernas
  // (Should Precheck Inventory[1] sem-precheck + Code Build Inventory Lite
  // com-precheck) numa entrada única p/ Bia 1, garantindo que ela receba os
  // campos da pré-consulta independentemente do branch que rodou.
  'Code Consciliador',
  'Bia 1',
  'CRM Inventory Search',
  'CRM Inventory Precheck',
  'Node13-Code Filtrar Resultados Estoque',
  // 'Bia 2 SEM ESTOQUE ' foi fundido em 'Bia 2 ESTOQUE' na fusão de 2026-06-18.
  'Bia 2 ESTOQUE',
  'Montar Body do Simulador',
  'Simulador',
  'Parse Simulator',
  'HTTP Request',
  // 'HTTP Request1' não existe mais no fluxo atual (removido até 2026-06-20).
  'HTTP Request21',
];

const missing = required.filter((name) => !names.has(name));
if (missing.length) {
  throw new Error(`Missing required nodes: ${missing.join(', ')}`);
}

if (workflow.active !== true) {
  throw new Error('Live workflow must be active (the agent goes silent if left OFF — re-run the /activate step)');
}

if (workflow.nodes.length < 120) {
  throw new Error(`Workflow is too small (${workflow.nodes.length} nodes); expected the full advanced flow`);
}

const webhook = workflow.nodes.find((node) => node.name === 'Webhook');
if (webhook?.parameters?.path !== 'repasse') {
  throw new Error(`Webhook path must be repasse; got ${webhook?.parameters?.path}`);
}

const byName = Object.fromEntries(workflow.nodes.map((node) => [node.name, node]));
const assertions = [
  ['Postgres Chat Memory', 'repasse_v2_scenario_audit'],
  ['Postgres Chat Memory', 'scenario_id'],
  ['Postgres Chat Memory1', 'repasse_v2_scenario_audit'],
  // Postgres Chat Memory3/4 removidos 2026-06-20 (ver lista de nós acima).
  ['Memory 1 - Extractor', 'REPASSE V2 MULTI DEVICE EXTRACTION'],
  ['Memory 1 - Extractor', 'tradein_scratches'],
  ['Memory 1 - Extractor', 'tradein_liquid_contact'],
  ['Memory 1 - Extractor', 'tradein_parts_swapped'],
  ['Memory 2 - Reconciler', 'REPASSE V2 MULTI DEVICE RECONCILIATION'],
  ['Memory 2 - Reconciler', 'tradein_has_box_cable'],
  ['Memory 2 - Reconciler', 'tradein_apple_warranty'],
  // Bucket 1+2 cobertura de campos (2026-06-14, patch-memory-cover-fields-bucket12.mjs):
  // Memory 1 passa a extrair sinais + cadastro; Memory 2 preserva esses sinais e
  // deriva flags (cadastro_completo, tradein_evaluation_pending, *_city). Sem isso,
  // esses campos caem para null toda rodada (Edit Fields5 lê tudo de $json=memory).
  ['Memory 1 - Extractor', 'REPASSE V2 SINAIS E CADASTRO'],
  ['Memory 1 - Extractor', 'cadastro_cpf'],
  ['Memory 2 - Reconciler', 'REPASSE V2 CAMPOS DERIVADOS E CADASTRO'],
  ['Memory 2 - Reconciler', 'cadastro_completo'],
  ['Memory 2 - Reconciler', 'tradein_evaluation_pending'],
  ['Memory 2 - Reconciler', 'client_outside_ce'],
  // 'Parse Memory' (deterministic safety net) removed 2026-06-14. Its readiness /
  // trade-in-consent guardrails are no longer asserted here — Memory 2 - Reconciler
  // owns lead_state and 'Code in JavaScript2' only flattens memory → root.
  ['Code in JavaScript2', '$input.first().json.memory'],
  // Normalização de enums canônicos (2026-06-14, patch-normalize-leadstate-enums.mjs):
  // o LLM emite "troca"/"novo" fora do enum → quebra o CHECK do upsert_lead_state
  // (perde o estado inteiro) E o isIphonePurchaseFlow do roteamento. Normaliza no
  // chokepoint determinístico antes do Edit Fields5.
  ['Code in JavaScript2', 'REPASSE LEAD_STATE ENUM NORMALIZE START'],
  ['Code in JavaScript2', 'normInterestType'],
  ['Code in JavaScript2', "'trocar'"],
  // Routing flags node deve computar a decisão determinística.
  ['Code Routing Flags', 'setMainRoute'],
  ['Code Routing Flags', 'shouldSearchInventory'],
  ['Code Routing Flags', 'shouldUseBia1'],
  // Bateria suspeita (2026-06-14): aparelho antigo + bateria alta s/ troca → não
  // simular, transferir p/ avaliação humana.
  ['Code Routing Flags', 'tradeinBatterySuspect'],
  ['Code Routing Flags', 'batteryImplausible'],
  // Bucket 3 carry-forward (2026-06-14, patch-leadstate-carry-forward-bucket3.mjs):
  // "Code in JavaScript" (→ POST Lead_State) faz fallback p/ prev nos campos
  // determinísticos (estoque/simulador/PIX) que rodam só em branches específicos,
  // evitando que o POST de cada turno zere o valor persistido. Memory 2 NÃO os possui.
  ['Code in JavaScript', 'Bucket 3 carry-forward'],
  ['Code in JavaScript', 'const prev = readPrevLeadState()'],
  ['Code in JavaScript', "cf(input.stock_item_id, 'stock_item_id')"],
  ['Code in JavaScript', "latch(input.pix_data_sent, 'pix_data_sent')"],
  ['Code in JavaScript', "maxNum(input.simulation_count, 'simulation_count')"],
  ['Code Parse Bia 1', 'REPASSE DETERMINISTIC BIA1 RESPONSE START'],
  ['Code Parse Bia 1', 'delivery_mode'],
  ['Node13-Code Filtrar Resultados Estoque', 'REPASSE V2 MULTI QUOTE INVENTORY START'],
  ['Node13-Code Filtrar Resultados Estoque', 'REPASSE NODE13 COMMERCE BACKFILL'],
  ['Node13-Code Filtrar Resultados Estoque', 'ctx.desired_model'],
  ['Node13-Code Filtrar Resultados Estoque', 'quote_items'],
  ['Montar Body do Simulador', 'simulationMode'],
  ['Montar Body do Simulador', 'simulationMode === \\"comparison\\"'],
  ['Montar Body do Simulador', 'quotes: quoteItems.slice(0, 2)'],
  ['Montar Body do Simulador', 'body.paymentRevision'],
  ['Montar Body do Simulador', 'REPASSE MONTAR BODY TRADEIN SOURCES'],
  ['Montar Body do Simulador', 'tiDisq !== true'],
  ['Montar Body do Simulador', 'REPASSE MONTAR BODY RESOLVE STOCK ID'],
  ['Montar Body do Simulador', '__resolveStockId'],
  ['Montar Body do Simulador', 'unresolved_stock_item'],
  ['Code Parse Re-simulacao Bia 2 ESTOQUE', 'REPASSE RESIM REATTACH TRADEIN'],
  ['Code Parse Re-simulacao Bia 2 ESTOQUE', '...reattach'],
  ['Code Parse Re-simulacao Bia 2 ESTOQUE', 'leadCtx.lead_state?.[k]'],
  ['Code Routing Flags', 'needsCashEntryQuestion'],
  ['Code Routing Flags', 'ask_cash_entry_before_sim'],
  ['Code Routing Flags', 'cashEntryResolved'],
  ['Memory 2 - Reconciler', 'cash_entry_asked'],
  // REGRA DE ENTRADA migrou para 'Bia 2 ESTOQUE' na fusão de 2026-06-18.
  ['Bia 2 ESTOQUE', 'REGRA DE ENTRADA ANTES DE SIMULAR'],
  ['Code in JavaScript', 'cash_entry_asked: latch'],
  ['Edit Fields5', 'cash_entry_asked'],
  ['Edit Fields5', 'cash_entry_amount'],
  ['Parse Simulator', 'combinedSummary'],
  ['Parse Simulator', 'resp.simulationMode === \\"comparison\\"'],
  ['Bia 2 ESTOQUE', 'REPASSE V2 MULTI DEVICE CONTEXT'],
  ['Bia 2 ESTOQUE', 'NUNCA some as opcoes'],
  ['Bia 2 ESTOQUE', '1x, 12x e 18x'],
  // Pre-consulta presence/strategy patch (2026-06-12): exact-model-absent handling.
  ['Code Build Inventory Lite', 'desired_exact_available'],
  ['Code Build Inventory Lite', 'only_nearby_alternatives'],
  ['Bia 1', 'MODELO EXATO INDISPONÍVEL'],
  ['Bia 1', 'only_nearby_alternatives'],
  // Stock-node fixes (2026-06-12): battery_health no select, filtro type=iPhone,
  // ambiguidade por modelos distintos no Lite, capacidade gb/tera no Node13.
  ['CRM Inventory Search', 'battery_health'],
  ['CRM Inventory Search', 'eq.iPhone'],
  ['CRM Inventory Precheck', 'battery_health'],
  ['CRM Inventory Precheck', 'eq.iPhone'],
  ['Code Build Inventory Lite', 'familyModelKeys'],
  ['Node13-Code Filtrar Resultados Estoque', 'gigas?'],
  // Simulator error handling (2026-06-12): erro de simulação degrada para
  // simulation_error + transferência, nunca derruba a execução.
  ['Montar Body do Simulador', 'simulation_skipped_reason'],
  ['Simulador', 'neverError'],
  // Humanizer determinístico (2026-06-12): sanitiza caguetes pós-LLM nos 4 parses.
  ['Code Parse Bia 1', 'REPASSE HUMANIZER START'],
  ['Code Parse Bia 1', 'repasseHumanizeMessage(router.message)'],
  ['Code Parse Bia 2 SEM ESTOQUE', 'REPASSE HUMANIZER START'],
  ['Code Parse Bia 2 SEM ESTOQUE', 'repasseHumanizeMessage(router.message)'],
  // 'Code Parse Bia 2 SEM ESTOQUE1' foi removido na fusão de 2026-06-18.
  ['Code Parse Re-simulacao Bia 2 ESTOQUE', 'REPASSE HUMANIZER START'],
  ['Code Parse Re-simulacao Bia 2 ESTOQUE', 'repasseHumanizeMessage(decision.message)'],
  // Bia 1 confident-stock phrasing (deployed 2026-06-14, scripts/n8n/patch-bia1-confident-stock.mjs).
  // The pre-consulta presence/strategy markers above (desired_exact_available,
  // only_nearby_alternatives, MODELO EXATO INDISPONÍVEL) were deployed 2026-06-14
  // via scripts/n8n/patch-repasse-quality-phase2.mjs.
  ['Bia 1', 'Afirme o estoque com confiança'],
  // Bia 1 enriquecida com a pré-consulta (manual edit 2026-06-14): afirma
  // estoque por available_models/available_conditions/available_capacities/
  // available_colors (novo vs seminovo) em vez de capacidades fixas. O user
  // message lê attendance_owner direto do CRM Leads GET.
  ['Bia 1', 'available_capacities'],
  ['Bia 1', 'available_conditions'],
  ['Bia 1', "$('CRM Leads GET').last().json.data.items[0].attendance_owner"],
  // Reply-aware trade-in reclass gate (2026-06-20, patch-parse-memory2-reclass-gate.mjs):
  // o reclass só dispara quando a Bia perguntou o aparelho atual (reply-quote OU a
  // última mensagem do bot), evitando trade-in fantasma em turnos de navegação.
  // Lógica pura espelhada em scripts/n8n/tool/parsers/blocks/reply_attribution.block.js.
  ['Code Parse Memory 2', 'tradein reclass (2026-06-19, gated 2026-06-20)'],
  ['Code Parse Memory 2', '__askedViaReply'],
  ['Code Parse Memory 2', '__classifyBiaQuestion'],
  // Opener desired-first (2026-06-20, patch-opener-desired-first.mjs): a abertura
  // pergunta SÓ o aparelho desejado; o aparelho atual fica para a 2ª interação
  // (regra COLETA DO APARELHO ATUAL). O Reconciler desacoplou a desambiguação de
  // "abertura" para cobrir a pergunta de aparelho-atual isolada no 2º turno.
  ['Bia 1', 'a pergunta de compra (pergunte SÓ o aparelho desejado'],
  ['Bia 2 ESTOQUE', 'a pergunta de compra (pergunte SÓ o aparelho desejado'],
  ['Memory 2 - Reconciler', 'mensagem do atendimento perguntou o APARELHO ATUAL'],
];

for (const [nodeName, expected] of assertions) {
  const serialized = JSON.stringify(byName[nodeName]?.parameters ?? {});
  if (!serialized.includes(expected)) {
    throw new Error(`${nodeName} missing expected patch marker: ${expected}`);
  }
}

// Negative guards — strings that must NOT come back. We forbid the POSITIVE
// instruction to use the "apareceu por aqui" hedge (removed by confident-stock,
// 2026-06-14). The bare substring still appears inside the new "NUNCA use hedge
// como ..." directive, so guard the positive-directive phrasing specifically.
const negativeGuards = [
  ['Bia 1', 'Use linguagem de pré-consulta ("apareceu por aqui"'],
  // O throw sem stock_item_id matava a execução e deixava o cliente sem resposta.
  ['Montar Body do Simulador', 'stock_item_id obrigatorio'],
  // Opener desired-first (2026-06-20): a pergunta de aparelho atual saiu da abertura;
  // a mensagem combinada não pode voltar (regressão do desired-first).
  ['Bia 1', 'deseja comprar? E qual o modelo do seu aparelho atual?'],
  ['Bia 2 ESTOQUE', 'deseja comprar? E qual o modelo do seu aparelho atual?'],
];
for (const [nodeName, forbidden] of negativeGuards) {
  const serialized = JSON.stringify(byName[nodeName]?.parameters ?? {});
  if (serialized.includes(forbidden)) {
    throw new Error(`${nodeName} contains forbidden string (regression): ${forbidden}`);
  }
}

// Humanization guards (deployed 2026-06-14 Phase 2): the 3 Bia prompts carry the
// NATURALIDADE anti-tell block, and no "message" example may contain em-dash,
// semicolon or "apareceu" (tells that teach the model robotic style). The
// deterministic humanizer (Phase 1) is the runtime safety net on top of this.
// 'Bia 2 SEM ESTOQUE ' foi fundido em 'Bia 2 ESTOQUE' na fusão de 2026-06-18.
const BIA_AGENTS = ['Bia 1', 'Bia 2 ESTOQUE'];
for (const agentName of BIA_AGENTS) {
  const prompt = byName[agentName]?.parameters?.options?.systemMessage ?? '';
  if (!prompt.includes('NATURALIDADE — SEM CARA DE IA')) {
    throw new Error(`${agentName} missing NATURALIDADE anti-tell block`);
  }
  const exampleMessages = [...prompt.matchAll(/"message":\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  for (const msg of exampleMessages) {
    if (msg.includes('—')) throw new Error(`${agentName} example message contains em-dash: ${msg.slice(0, 60)}`);
    if (msg.includes(';')) throw new Error(`${agentName} example message contains semicolon: ${msg.slice(0, 60)}`);
    if (/\bapareceu\b/.test(msg)) throw new Error(`${agentName} example message contains "apareceu": ${msg.slice(0, 60)}`);
  }
}

const serialized = JSON.stringify(workflow);
if (/Bearer\s+[A-Za-z0-9._-]+/.test(serialized) || /[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(serialized)) {
  throw new Error('Workflow appears to contain hardcoded token material (use n8n credential refs, not literals)');
}

const connectionTargets = new Set();
for (const groups of Object.values(workflow.connections || {})) {
  for (const outputs of Object.values(groups || {})) {
    for (const output of outputs || []) {
      for (const edge of output || []) {
        connectionTargets.add(edge.node);
      }
    }
  }
}

const danglingTargets = [...connectionTargets].filter((name) => !names.has(name));
if (danglingTargets.length) {
  throw new Error(`Workflow has dangling connection targets: ${danglingTargets.join(', ')}`);
}

// Wiring do roteamento: Switch3 deve ser alimentado pelo "Code Routing Flags"
// (que computa as flags), nunca direto pelo Edit Fields5 (flags seriam null →
// Switch3 sem fallback descarta o item → bot mudo).
const ef5Targets = (workflow.connections['Edit Fields5']?.main?.[0] || []).map((edge) => edge.node);
if (ef5Targets.includes('Switch3')) {
  throw new Error('Edit Fields5 conecta direto no Switch3 (deve passar pelo Code Routing Flags)');
}
const routingTargets = (workflow.connections['Code Routing Flags']?.main?.[0] || []).map((edge) => edge.node);
if (!routingTargets.includes('Switch3')) {
  throw new Error('Code Routing Flags não alimenta o Switch3 (rewire ausente)');
}

// Funil de inventário: as duas pernas (Should Precheck Inventory[1] +
// Code Build Inventory Lite) passam pelo Code Consciliador, que alimenta a
// Bia 1. Sem esse join, a Bia 1 poderia não receber os campos da pré-consulta.
const consciliadorTargets = (workflow.connections['Code Consciliador']?.main?.[0] || []).map((edge) => edge.node);
if (!consciliadorTargets.includes('Bia 1')) {
  throw new Error('Code Consciliador não alimenta a Bia 1 (funil de inventário quebrado)');
}
const precheckFalseTargets = (workflow.connections['Should Precheck Inventory']?.main?.[1] || []).map((edge) => edge.node);
const liteTargets = (workflow.connections['Code Build Inventory Lite']?.main?.[0] || []).map((edge) => edge.node);
if (!precheckFalseTargets.includes('Code Consciliador') || !liteTargets.includes('Code Consciliador')) {
  throw new Error('Code Consciliador não recebe as duas pernas de inventário (Should Precheck Inventory[1] + Code Build Inventory Lite)');
}

console.log(JSON.stringify({
  valid: true,
  name: workflow.name,
  active: workflow.active,
  nodeCount: workflow.nodes.length,
  connectionSourceCount: Object.keys(workflow.connections || {}).length,
  webhookPath: webhook.parameters.path,
  assertionsChecked: assertions.length,
}, null, 2));
