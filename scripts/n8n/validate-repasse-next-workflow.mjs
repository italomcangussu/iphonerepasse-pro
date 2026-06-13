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
  'Postgres Chat Memory2',
  'Postgres Chat Memory3',
  'Memory 1 - Extractor',
  'Memory 2 - Reconciler',
  'Parse Memory',
  'Should Precheck Inventory',
  'Code Build Inventory Lite',
  'Bia 1',
  'CRM Inventory Search',
  'CRM Inventory Precheck',
  'Node13-Code Filtrar Resultados Estoque',
  'Bia 2 ESTOQUE',
  'Bia 2 SEM ESTOQUE ',
  'Montar Body do Simulador',
  'Simulador',
  'Parse Simulator',
  'HTTP Request',
  'HTTP Request1',
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
  ['Postgres Chat Memory2', 'repasse_v2_scenario_audit'],
  ['Postgres Chat Memory3', 'repasse_v2_scenario_audit'],
  ['Memory 1 - Extractor', 'REPASSE V2 MULTI DEVICE EXTRACTION'],
  ['Memory 1 - Extractor', 'tradein_scratches'],
  ['Memory 1 - Extractor', 'tradein_liquid_contact'],
  ['Memory 1 - Extractor', 'tradein_parts_swapped'],
  ['Memory 2 - Reconciler', 'REPASSE V2 MULTI DEVICE RECONCILIATION'],
  ['Memory 2 - Reconciler', 'tradein_has_box_cable'],
  ['Memory 2 - Reconciler', 'tradein_apple_warranty'],
  ['Parse Memory', 'REPASSE V2 MULTI QUOTE READINESS START'],
  ['Parse Memory', 'memory.simulation_mode'],
  ['Parse Memory', 'tradeinOk === true'],
  ['Parse Memory', 'REPASSE DETERMINISTIC CORE START'],
  ['Parse Memory', 'memory.can_simulate_tradein'],
  ['Parse Memory', 'ask_tradein_consent'],
  ['Code Parse Bia 1', 'REPASSE DETERMINISTIC BIA1 RESPONSE START'],
  ['Code Parse Bia 1', 'delivery_mode'],
  ['Node13-Code Filtrar Resultados Estoque', 'REPASSE V2 MULTI QUOTE INVENTORY START'],
  ['Node13-Code Filtrar Resultados Estoque', 'quote_items'],
  ['Montar Body do Simulador', 'simulationMode'],
  ['Montar Body do Simulador', 'simulationMode === \\"comparison\\"'],
  ['Montar Body do Simulador', 'quotes: quoteItems.slice(0, 2)'],
  ['Montar Body do Simulador', 'body.paymentRevision'],
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
  ['Code Parse Bia 2 SEM ESTOQUE1', 'REPASSE HUMANIZER START'],
  ['Code Parse Bia 2 SEM ESTOQUE1', 'repasseHumanizeMessage(router.message)'],
  ['Code Parse Re-simulacao Bia 2 ESTOQUE', 'REPASSE HUMANIZER START'],
  ['Code Parse Re-simulacao Bia 2 ESTOQUE', 'repasseHumanizeMessage(decision.message)'],
];

for (const [nodeName, expected] of assertions) {
  const serialized = JSON.stringify(byName[nodeName]?.parameters ?? {});
  if (!serialized.includes(expected)) {
    throw new Error(`${nodeName} missing expected patch marker: ${expected}`);
  }
}

// Negative guards — strings that must NOT come back.
const negativeGuards = [
  ['Bia 1', 'apareceu por aqui'],
  // O throw sem stock_item_id matava a execução e deixava o cliente sem resposta.
  ['Montar Body do Simulador', 'stock_item_id obrigatorio'],
];
for (const [nodeName, forbidden] of negativeGuards) {
  const serialized = JSON.stringify(byName[nodeName]?.parameters ?? {});
  if (serialized.includes(forbidden)) {
    throw new Error(`${nodeName} contains forbidden string (regression): ${forbidden}`);
  }
}

// Humanization guards (2026-06-12): the three Bia prompts must carry the
// anti-AI-tell block, and no "message" example may contain em-dash, semicolon
// or "apareceu" (tells that teach the model robotic style).
const BIA_AGENTS = ['Bia 1', 'Bia 2 ESTOQUE', 'Bia 2 SEM ESTOQUE '];
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

console.log(JSON.stringify({
  valid: true,
  name: workflow.name,
  active: workflow.active,
  nodeCount: workflow.nodes.length,
  connectionSourceCount: Object.keys(workflow.connections || {}).length,
  webhookPath: webhook.parameters.path,
  assertionsChecked: assertions.length,
}, null, 2));
