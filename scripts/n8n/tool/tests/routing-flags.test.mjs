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

// --- D2: cor nunca é exigida para simular ---
test("D2: cor ausente NUNCA entra em missing_fields (mesmo sem desired_condition)", () => {
  const out = runRoutingFlags(baseState({ desired_color: null, desired_condition: null }));
  assert.equal(out.missing_fields.includes("desired_color"), false);
});

// --- D3: não reperguntar entrada já informada (caso VD: "Queria dar 500") ---
test("D3: valor de entrada informado (amount sem intent) não dispara pergunta de entrada", () => {
  const out = runRoutingFlags(baseState({
    preferred_city: "Sobral",
    cash_entry_amount: 500,   // cliente disse "Queria dar 500"
    cash_entry_intent: null,  // mas o reconciler não setou o intent
    cash_entry_asked: false,
  }));
  assert.notEqual(out.routing_decision, "ask_cash_entry_before_sim");
});

test("D3: com card_brand definido, nunca repergunta entrada", () => {
  const out = runRoutingFlags(baseState({
    preferred_city: "Sobral",
    card_brand: "visa",
    cash_entry_intent: null,
    cash_entry_amount: null,
    cash_entry_asked: false,
  }));
  assert.notEqual(out.routing_decision, "ask_cash_entry_before_sim");
});

// --- D1: cidade só após a simulação aceita ---
test("D1: busca de estoque NÃO exige cidade (sem preferred_city, nada de pergunta de cidade pré-estoque)", () => {
  const out = runRoutingFlags(baseState({ preferred_city: null }));
  assert.notEqual(out.routing_decision, "ask_client_city_before_stock");
  assert.equal(out.missing_fields.includes("preferred_city"), false);
});

test("D1: cidade é pedida só após simulação aceita e sem cidade definida", () => {
  const out = runRoutingFlags(baseState({
    preferred_city: null,
    simulation_done: true,
    simulation_count: 1,
    last_simulation_total: 5190,
    proposal_accepted: true,
  }));
  assert.equal(out.needsPickupCity, true);
  assert.equal(out.routing_decision, "ask_pickup_city_after_sim");
});

// --- D5: confirmar variante do modelo (13 -> 13/Pro/Pro Max) ---
test("D5: modelo base sem tier marca confirmação e bloqueia avanço", () => {
  const out = runRoutingFlags(baseState({ desired_model: "iPhone 13", desired_capacity: "128GB" }));
  assert.equal(out.needs_model_tier_confirmation, true);
  assert.equal(out.missing_fields.includes("model_tier"), true);
  assert.equal(out.context_ready, false);
});

test("D5: modelo com tier explícito NÃO pede confirmação", () => {
  const out = runRoutingFlags(baseState({ desired_model: "iPhone 13 Pro Max", desired_capacity: "128GB" }));
  assert.equal(out.needs_model_tier_confirmation, false);
});
