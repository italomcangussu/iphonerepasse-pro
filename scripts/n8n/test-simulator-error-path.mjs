// Deterministic test for the simulator error path (fixes #3/#4 do review):
// roda o jsCode REAL dos nós "Montar Body do Simulador" e "Parse Simulator"
// do export ao vivo e garante que erro de simulação NUNCA derruba a execução
// (cliente sem resposta) — sempre degrada para simulation_error + transferência.
import { readFile } from 'node:fs/promises';

const EXPORT_PATH = 'output/n8n/ia-repasse-pro-v2-current.json';
const wf = JSON.parse(await readFile(EXPORT_PATH, 'utf8'));
const byName = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log('  ok -', msg);
}

let failures = 0;
function scenario(title, fn) {
  console.log(`\n# ${title}`);
  try { fn(); } catch (err) { failures += 1; console.log('  FAIL -', err.message); }
}

// --- Montar Body sem stock_item_id: não pode lançar erro ---
const montar = byName['Montar Body do Simulador'];
const runMontar = new Function('$input', montar.parameters.jsCode);
const montarInput = (json) => ({ first: () => ({ json }) });

scenario('Montar Body sem stock_item_id → degrada sem throw', () => {
  const out = runMontar(montarInput({
    memory: { desired_model: 'iPhone 15' },
    inventory: { inventory_found: false },
  }))[0].json;
  assert(out.simulation_skipped_reason === 'missing_stock_item', 'flag missing_stock_item presente');
  assert(out.simulator_body && typeof out.simulator_body === 'object', 'simulator_body sentinela (request 400 controlado, não crash)');
  assert(!out.simulator_body.desiredDevice, 'body sentinela não simula nada');
});

scenario('Montar Body COM stock_item_id → body normal (regressão)', () => {
  const out = runMontar(montarInput({
    memory: { stock_item_id: 'abc-123', card_brand: 'visa_master' },
    inventory: {},
  }))[0].json;
  assert(out.simulator_body?.desiredDevice?.stockItemId === 'abc-123', 'desiredDevice.stockItemId preservado');
  assert(out.simulation_skipped_reason === undefined, 'sem flag de skip no caminho feliz');
});

// --- Parse Simulator com resposta de erro do edge function (neverError) ---
const parseSim = byName['Parse Simulator'];

scenario('Parse Simulator com {success:false} → simulation_error + transferência', () => {
  const ctx = { memory: { simulation_count: 0 }, simulator_body: {} };
  const $ = (name) => {
    if (name === 'Montar Body do Simulador') return { first: () => ({ json: ctx }) };
    throw new Error(`Unexpected $('${name}')`);
  };
  const $input = { first: () => ({ json: { success: false, code: 'quotes_empty', error: 'Informe pelo menos um aparelho para simular.' } }) };
  const out = new Function('$', '$input', parseSim.parameters.jsCode)($, $input)[0].json;
  assert(out.simulation_error === true, 'simulation_error = true');
  assert(out.memory.next_best_action === 'transferir para especialista repasse', 'next_best_action transfere pro especialista');
});

// --- Configuração do nó Simulador: erro HTTP não pode matar a execução ---
scenario('nó Simulador configurado para nunca derrubar a execução', () => {
  const sim = byName['Simulador'];
  assert(sim.parameters.options?.response?.response?.neverError === true, 'options.response.neverError = true (4xx/5xx retornam body)');
  assert(sim.onError === 'continueRegularOutput', 'onError = continueRegularOutput (falha de rede vira item de erro)');
});

console.log(failures ? `\n${failures} scenario(s) FAILED` : '\nall simulator-error-path scenarios passed');
if (failures) process.exit(1);
