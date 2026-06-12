// Deterministic scenario test for the "modelo exato indisponível" patch.
// Runs the REAL jsCode of the live "Code Build Inventory Lite" node against
// synthetic inventory states and asserts the new pre_inventory signals.
import { readFile } from 'node:fs/promises';

const EXPORT_PATH = 'output/n8n/ia-repasse-pro-v2-current.json';
const wf = JSON.parse(await readFile(EXPORT_PATH, 'utf8'));
const node = wf.nodes.find((n) => n.name === 'Code Build Inventory Lite');
if (!node) throw new Error('Code Build Inventory Lite node not found in export');

// n8n Code node body runs with $ and $input in scope and uses top-level return.
const runNode = new Function('$', '$input', node.parameters.jsCode);

function runScenario({ memory, stock }) {
  const $ = (name) => {
    if (name === 'Should Precheck Inventory') {
      return { first: () => ({ json: memory }) };
    }
    throw new Error(`Unexpected $('${name}') call`);
  };
  const $input = { all: () => stock.map((json) => ({ json })) };
  const out = runNode($, $input);
  return out[0].json.pre_inventory;
}

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log('  ok -', msg);
}

const item = (over = {}) => ({
  model: 'iPhone 15 Pro Max',
  capacity: '256GB',
  color: 'Titânio Natural',
  condition: 'novo',
  sell_price: 7999,
  stores: { city: 'Fortaleza' },
  ...over,
});

let failures = 0;
function scenario(title, fn) {
  console.log(`\n# ${title}`);
  try { fn(); } catch (err) { failures += 1; console.log('  FAIL -', err.message); }
}

// --- Caso 1: pediu iPhone 15 (base), estoque só tem 15 Pro Max (proximidade) ---
scenario('pediu 15, só há 15 Pro Max → only_nearby_alternatives', () => {
  const pi = runScenario({
    memory: { desired_model: 'iPhone 15' },
    stock: [item()],
  });
  assert(pi.model_match_status === 'family_only', `model_match_status family_only (got ${pi.model_match_status})`);
  assert(pi.desired_exact_available === false, 'desired_exact_available = false');
  assert(pi.only_nearby_alternatives === true, 'only_nearby_alternatives = true');
  assert(pi.available_models.includes('iPhone 15 Pro Max'), 'oferece o 15 Pro Max como alternativa');
});

// --- Caso 2 (controle): pediu 15 e há 15 base em estoque → exato disponível ---
scenario('pediu 15, há 15 base em estoque → exato disponível (sem nearby)', () => {
  const pi = runScenario({
    memory: { desired_model: 'iPhone 15' },
    stock: [item({ model: 'iPhone 15' }), item()],
  });
  assert(pi.model_match_status === 'exact', `model_match_status exact (got ${pi.model_match_status})`);
  assert(pi.desired_exact_available === true, 'desired_exact_available = true');
  assert(pi.only_nearby_alternatives === false, 'only_nearby_alternatives = false');
});

// --- Caso 3 (controle): ambíguo NÃO entra no fluxo nearby (mantém clarificação) ---
scenario('pediu 15, há 15 Plus e 15 Pro (ambíguo) → não dispara nearby', () => {
  const pi = runScenario({
    memory: { desired_model: 'iPhone 15' },
    stock: [item({ model: 'iPhone 15 Plus' }), item({ model: 'iPhone 15 Pro' })],
  });
  assert(pi.model_match_status === 'ambiguous', `model_match_status ambiguous (got ${pi.model_match_status})`);
  assert(pi.only_nearby_alternatives === false, 'only_nearby_alternatives = false (segue clarificação, não nearby)');
});

// --- Caso 4 (controle): nada da família 15 → not_found, sem nearby ---
scenario('pediu 15, estoque só tem 13 → not_found', () => {
  const pi = runScenario({
    memory: { desired_model: 'iPhone 15' },
    stock: [item({ model: 'iPhone 13' })],
  });
  assert(pi.model_match_status === 'not_found', `model_match_status not_found (got ${pi.model_match_status})`);
  assert(pi.pre_inventory_found === false, 'pre_inventory_found = false');
  assert(pi.only_nearby_alternatives === false, 'only_nearby_alternatives = false (pool vazio)');
});

console.log(failures ? `\n${failures} scenario(s) FAILED` : '\nall stock-presence scenarios passed');
if (failures) process.exit(1);
