import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NODE_FILE = path.join(HERE, "../../../../n8n/ia-repasse-pro-v2/nodes/code/50_01_code-routing-flags.js");

const SENTINEL = "===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====";

function loadBody() {
  const raw = fs.readFileSync(NODE_FILE, "utf8");
  const idx = raw.indexOf(SENTINEL);
  return idx === -1 ? raw : raw.slice(raw.indexOf("\n", idx) + 1);
}

// Executa o node com um $input mockado. O node usa `$('...')` só dentro de
// readCurrentMessageFromWorkflow, protegido por try/catch + `typeof $ === "function"`;
// passando $ = undefined ele retorna "".
export function runRoutingFlags(state) {
  const body = loadBody();
  const fn = new Function("$input", "$", body);
  const $input = { first: () => ({ json: structuredClone(state) }) };
  const out = fn($input, undefined);
  return out[0].json;
}

// Estado base "pronto para simular" (compra de iPhone, trade-in OK), sobreposto por overrides.
export function baseState(overrides = {}) {
  return {
    intent: "aparelho_iphone",
    interest_type: "comprar",
    desired_model: "iPhone 15 Pro Max",
    desired_capacity: "256GB",
    desired_condition: "Seminovo",
    has_tradein: false,
    cash_entry_asked: false,
    cash_entry_intent: null,
    cash_entry_amount: null,
    card_brand: null,
    preferred_city: null,
    simulation_done: false,
    simulation_count: 0,
    ...overrides,
  };
}

test("baseline: estado de compra simples produz uma rota principal definida", () => {
  const out = runRoutingFlags(baseState());
  const routes = [
    out.shouldSearchInventory, out.shouldUseBia1, out.shouldUseBia2NoStock,
    out.shouldUseBia2Continuation, out.shouldStopAsSpam,
  ];
  assert.equal(routes.filter(Boolean).length >= 1, true, "deve haver ao menos uma rota ativa");
  assert.equal(typeof out.routing_decision, "string");
});
