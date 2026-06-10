import { readFile } from 'node:fs/promises';

const path = process.argv[2] || 'output/n8n/ia-repasse-pro-next.generated.json';
const workflow = JSON.parse(await readFile(path, 'utf8'));
const names = new Set(workflow.nodes.map((node) => node.name));

const required = [
  'Webhook',
  'credenciais',
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
  'Bia 1',
  'CRM Inventory Search',
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
  throw new Error(`Missing required advanced-flow nodes: ${missing.join(', ')}`);
}

if (workflow.active !== false) {
  throw new Error('Generated workflow must be inactive');
}

if (workflow.nodes.length < 120) {
  throw new Error(`Generated workflow is too small (${workflow.nodes.length} nodes); expected faithful clone of the advanced flow`);
}

const webhook = workflow.nodes.find((node) => node.name === 'Webhook');
if (webhook?.parameters?.path !== 'repasse-next') {
  throw new Error(`Webhook path must be repasse-next; got ${webhook?.parameters?.path}`);
}

const byName = Object.fromEntries(workflow.nodes.map((node) => [node.name, node]));
const assertions = [
  ['Atualizar Estado Buffer', 'repasse-next:'],
  ['Tentar Lock', 'repasse-next:lock:'],
  ['Postgres Chat Memory', 'repasse_v2_scenario_audit'],
  ['Postgres Chat Memory', 'scenario_id'],
  ['Postgres Chat Memory1', 'repasse_v2_scenario_audit'],
  ['Postgres Chat Memory1', 'scenario_id'],
  ['Postgres Chat Memory2', 'repasse_v2_scenario_audit'],
  ['Postgres Chat Memory2', 'scenario_id'],
  ['Postgres Chat Memory3', 'repasse_v2_scenario_audit'],
  ['Postgres Chat Memory3', 'scenario_id'],
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
  ['Split Out1', 'REPASSE ATOMIC DELIVERY'],
  ['Split Out3', 'REPASSE ATOMIC DELIVERY'],
  ['Split Out5', 'REPASSE ATOMIC DELIVERY'],
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
];

for (const [nodeName, expected] of assertions) {
  const serialized = JSON.stringify(byName[nodeName]?.parameters ?? {});
  if (!serialized.includes(expected)) {
    throw new Error(`${nodeName} missing expected patch marker: ${expected}`);
  }
}

const workflowForSecretScan = {
  ...workflow,
  nodes: workflow.nodes.map((node) => node.name === 'credenciais'
    ? { ...node, parameters: '[legacy credential literal node omitted from scan]' }
    : node),
};
const serialized = JSON.stringify(workflowForSecretScan);
if (/Bearer\s+[A-Za-z0-9._-]+/.test(serialized) || /[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(serialized)) {
  throw new Error('Generated workflow appears to contain hardcoded token material outside the legacy credenciais node');
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
  throw new Error(`Generated workflow has dangling connection targets: ${danglingTargets.join(', ')}`);
}

console.log(JSON.stringify({
  valid: true,
  name: workflow.name,
  active: workflow.active,
  nodeCount: workflow.nodes.length,
  connectionSourceCount: Object.keys(workflow.connections || {}).length,
  webhookPath: webhook.parameters.path,
  legacyCredentialLiteralNode: names.has('credenciais'),
}, null, 2));
