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

// Após remover card_brand como gate (2026-06-18), a entrada é considerada resolvida
// por cash_entry_asked / cash_entry_intent / cash_entry_amount — NUNCA por card_brand.
test("D3: entrada resolvida (asked) não dispara pergunta — independe de card_brand", () => {
  const out = runRoutingFlags(baseState({
    preferred_city: "Sobral",
    card_brand: null,
    cash_entry_asked: true,
    cash_entry_intent: null,
    cash_entry_amount: null,
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

// --- Condições do trade-in que impedem cotação automática (líquido/arranhões/peça) ---
function tradeinReadyState(overrides = {}) {
  return baseState({
    interest_type: "trocar", preferred_city: "Sobral",
    card_brand: "visa", cash_entry_intent: true, cash_entry_amount: 500,
    has_tradein: true, tradein_model: "iPhone 13 Pro Max", tradein_model_accepted: null, tradein_disqualified: null,
    tradein_capacity: "128GB", tradein_color: "Preto",
    tradein_scratches: false, tradein_liquid_contact: false, tradein_side_marks: false,
    tradein_parts_swapped: false, tradein_has_box_cable: true,
    tradein_battery_pct: 80, tradein_apple_warranty: false,
    ...overrides,
  });
}

test("COND: aparelho limpo (sem líquido/arranhões/peça) segue para estoque/simulação", () => {
  const out = runRoutingFlags(tradeinReadyState());
  assert.equal(out.tradein_condition_blocks ?? false, false);
  assert.notEqual(out.routing_decision, "tradein_condition_human_eval");
});

for (const field of ["tradein_liquid_contact", "tradein_scratches", "tradein_parts_swapped"]) {
  test(`COND: ${field}=true bloqueia simulação e manda p/ avaliação humana`, () => {
    const out = runRoutingFlags(tradeinReadyState({ [field]: true }));
    assert.equal(out.tradein_condition_blocks, true);
    assert.equal(out.routing_decision, "tradein_condition_human_eval");
    assert.equal(out.attendance_owner_next, "humano_loja");
    assert.equal(out.shouldSimulateNow, false);
  });
}

test("COND: caixa/cabo ausente NÃO bloqueia simulação (não altera valor)", () => {
  const out = runRoutingFlags(tradeinReadyState({ tradein_has_box_cable: false }));
  assert.equal(out.tradein_condition_blocks ?? false, false);
  assert.notEqual(out.routing_decision, "tradein_condition_human_eval");
});

// --- D6: cor/condição NÃO podem gatear o avanço (bug "simulação caiu na Bia 1") ---
// Reproduz o estado REAL ao vivo: compra com trade-in já avaliado e limpo, mas a IA
// (corretamente) não perguntou cor nem condição do DESEJADO -> desired_color e
// desired_condition ficam null. Antes do fix isso travava eligibleForInventory e a
// conversa ficava presa em bia1_pre_inventory, prometendo simulação que nunca vinha.
test("D6: trade-in limpo SEM cor/condição do desejado NÃO fica preso na Bia 1 (pede entrada antes de simular)", () => {
  const out = runRoutingFlags(tradeinReadyState({
    desired_color: null, desired_condition: null,
    preferred_city: null, card_brand: null,
    cash_entry_intent: null, cash_entry_amount: null, cash_entry_asked: false,
  }));
  assert.notEqual(out.routing_decision, "bia1_pre_inventory");
  assert.equal(out.shouldUseBia1, false);
  assert.equal(out.routing_decision, "ask_cash_entry_before_sim");
});

test("D6: com entrada resolvida + bandeira, SEM cor/condição, avança para estoque/simulação", () => {
  const out = runRoutingFlags(tradeinReadyState({
    desired_color: null, desired_condition: null,
    preferred_city: null, card_brand: "visa",
    cash_entry_intent: false, cash_entry_amount: null, cash_entry_asked: true,
  }));
  assert.equal(out.shouldUseBia1, false);
  assert.equal(out.shouldSearchInventory, true);
  assert.equal(out.routing_decision, "inventory_or_simulator");
});
