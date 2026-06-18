import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { removeCardBrandGates, removeCardBrandPrompts, refineSimVoice, refineAvailabilityVoice, oneTurnSim, ONE_TURN_SIM, suppressRerunSend, fixMultiQuoteRouting, SIM_NO_REPEAT, b1Cta, b2Objection, b3Recovery, b4Recommend, b5Microconv, transformPhase } from "../../transform-sales-evolution.mjs";
import { structuralErrors } from "../extract.mjs";
import { baseState } from "./routing-flags.test.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WF = path.join(HERE, "../../../../n8n/ia-repasse-pro-v2/workflow.json");
const loadWf = () => JSON.parse(fs.readFileSync(WF, "utf8"));

// Executa o jsCode do "Code Routing Flags" JÁ transformado, com $input mockado.
function runFlags(wf, state) {
  const js = wf.nodes.find((n) => n.name === "Code Routing Flags").parameters.jsCode;
  const fn = new Function("$input", "$", js);
  const $input = { first: () => ({ json: structuredClone(state) }) };
  return fn($input, undefined)[0].json;
}
// state-aware: o vivo já pode estar transformado (pós-deploy) → re-aplicar é no-op.
const isGatesApplied = (wf) =>
  !wf.nodes.find((n) => n.name === "Code Routing Flags").parameters.jsCode.includes("!!state.card_brand");
function gated(wf) { return isGatesApplied(wf) ? wf : removeCardBrandGates(wf); }

// ───────────────────────── (A) gates ─────────────────────────
test("gate A: lead pronto SEM card_brand simula (shouldSimulateNow=true)", () => {
  const wf = gated(loadWf());
  const out = runFlags(wf, baseState({
    stock_item_id: "abc-123",
    cash_entry_asked: true,   // entrada resolvida (sem intenção)
    card_brand: null,
  }));
  assert.equal(out.shouldSimulateNow, true);
});

test("gate A: entrada NÃO resolvida ainda dispara a pergunta de entrada (sem card_brand)", () => {
  const wf = gated(loadWf());
  const out = runFlags(wf, baseState({
    cash_entry_asked: false, cash_entry_intent: null, cash_entry_amount: null,
    card_brand: null,
  }));
  assert.equal(out.routing_decision, "ask_cash_entry_before_sim");
});

test("gate A: card_brand definido NÃO pula a pergunta de entrada não resolvida", () => {
  const wf = gated(loadWf());
  const out = runFlags(wf, baseState({
    card_brand: "visa",
    cash_entry_asked: false, cash_entry_intent: null, cash_entry_amount: null,
  }));
  assert.equal(out.routing_decision, "ask_cash_entry_before_sim");
});

test("gate A: idempotente (re-transformar não muda o jsCode)", () => {
  const once = gated(loadWf());
  const before = once.nodes.find((n) => n.name === "Code Routing Flags").parameters.jsCode;
  removeCardBrandGates(once);
  const after = once.nodes.find((n) => n.name === "Code Routing Flags").parameters.jsCode;
  assert.equal(after, before);
});

// ───────────────────────── (A) voz ─────────────────────────
const sm = (wf, name) => wf.nodes.find((n) => n.name === name).parameters.options.systemMessage;
const isPromptsApplied = (wf) => !sm(wf, "Bia 2 ESTOQUE").includes("# ESTÁGIO 2 — BANDEIRA DO CARTÃO");
function prompted(wf) { return isPromptsApplied(wf) ? wf : removeCardBrandPrompts(wf); }

// Menções a "bandeira" podem permanecer SÓ em instruções negativas ("nunca pergunte
// bandeira", "se o cliente informar bandeira espontaneamente"). O proibido é a IA
// PEDIR a bandeira ao cliente.
const ASK_BANDEIRA = /qual a bandeira|pe[çc]a a bandeira|pedindo a bandeira|peca a bandeira/i;

test("prompt A: Bia 2 nunca PEDE bandeira e ganha o ESTÁGIO 2 sem pergunta de bandeira", () => {
  const t = sm(prompted(loadWf()), "Bia 2 ESTOQUE");
  assert.ok(!ASK_BANDEIRA.test(t), "não deve haver pedido de bandeira ao cliente");
  assert.ok(t.includes("AVANÇO PARA SIMULAÇÃO (NUNCA PERGUNTE BANDEIRA)"));
});

test("prompt A: Bia 1 não pede bandeira", () => {
  assert.ok(!/bandeira/i.test(sm(prompted(loadWf()), "Bia 1")));
});

test("prompt A: invariantes preservados (contrato + NATURALIDADE 1x + estágios)", () => {
  const t = sm(prompted(loadWf()), "Bia 2 ESTOQUE");
  assert.equal(t.split("NATURALIDADE — SEM CARA DE IA (REGRA DURA)").length - 1, 1);
  assert.ok(t.includes("ESTÁGIO 3 — SIMULAÇÃO + FECHAMENTO"));
  assert.ok(t.includes("ESTÁGIO 4 — RESERVA E DADOS PIX"));
  assert.ok(t.includes("FORMATO DE SAÍDA"));
});

test("prompt A: estrutura do workflow íntegra após transform", () => {
  const wf = prompted(gated(loadWf()));
  assert.deepEqual(structuralErrors(wf), []);
});

// ───────────────── (A) refinamento de naturalidade: "no cartão" + anti-repetição ─────────────────
const isRefined = (wf) =>
  !sm(wf, "Bia 2 ESTOQUE").includes("condição padrão do cartão") &&
  sm(wf, "Bia 2 ESTOQUE").includes(SIM_NO_REPEAT);
function refined(wf) { return isRefined(wf) ? wf : refineSimVoice(prompted(wf)); }

test("refino: Bia 2 não diz 'condição padrão' e simula 'no cartão'", () => {
  const t = sm(refined(loadWf()), "Bia 2 ESTOQUE");
  assert.ok(!/condi[çc][ãa]o padr[ãa]o do cart[ãa]o/i.test(t), "sem 'condição padrão do cartão'");
  assert.ok(t.includes("Vou simular no cartão pra você"));
});

test("refino: regra anti-repetição (few-shot ❌→✅) presente, sem texto antigo", () => {
  const t = sm(refined(loadWf()), "Bia 2 ESTOQUE");
  assert.ok(t.includes(SIM_NO_REPEAT));
  assert.ok(t.includes("REGRA DURA DE NÃO-REPETIÇÃO"));
  assert.ok(t.includes("✅ \"Vou simular no cartão pra você.\""));
  // não deve sobrar a versão fraca anterior
  assert.ok(!t.includes('Diga apenas: "Vou simular no cartão pra você." (sem nome do aparelho'), "versão antiga migrada");
  // e não pode duplicar a regra
  assert.equal(t.split("REGRA DURA DE NÃO-REPETIÇÃO").length - 1, 1, "regra única (sem duplicação)");
});

test("refino: idempotente", () => {
  const once = refined(loadWf());
  const before = sm(once, "Bia 2 ESTOQUE");
  refineSimVoice(once);
  assert.equal(sm(once, "Bia 2 ESTOQUE"), before);
});

// ───────────── (A) refino da apresentação de disponibilidade ─────────────
const isAvailRefined = (wf) => !sm(wf, "Bia 2 ESTOQUE").includes("tá disponível na nossa loja de [stock_city]. Vou simular no cartão pra você");
function availRefined(wf) {
  // o template CASO A é a marca: depois do refino vira "Show, esse tá disponível…"
  return sm(wf, "Bia 2 ESTOQUE").includes("Show, esse tá disponível na nossa loja de [stock_city]")
    ? wf : refineAvailabilityVoice(refined(wf));
}

test("disp: CASO A não repete modelo/capacidade (só 'esse tá disponível')", () => {
  const t = sm(availRefined(loadWf()), "Bia 2 ESTOQUE");
  assert.ok(t.includes("Show, esse tá disponível na nossa loja de [stock_city]. Vou simular no cartão pra você."));
  assert.ok(!t.includes("Show, o iPhone 17 Pro Max 512GB Azul Profundo Novo tá disponível"), "não repete modelo/capacidade no CASO A");
});

test("disp: CASO B1 mantém a cor real, dropa capacidade/condição", () => {
  const t = sm(availRefined(loadWf()), "Bia 2 ESTOQUE");
  assert.ok(t.includes("Esse é o Azul Profundo, disponível na nossa loja de [stock_city]."));
  assert.ok(!t.includes("Esse é o Azul Profundo. 512GB Novo tá disponível"), "não repete capacidade/condição no fuzzy");
});

// ───────────── (A) entrega da simulação no mesmo turno (loop rerun) ─────────────
const isOneTurn = (wf) => sm(wf, "Bia 2 ESTOQUE").includes("ENTREGA EM UM ÚNICO TURNO");
function withOneTurn(wf) { return isOneTurn(wf) ? wf : oneTurnSim(refined(wf)); }

test("1-turno: regra de rerun_simulation na apresentação de disponibilidade", () => {
  const t = sm(withOneTurn(loadWf()), "Bia 2 ESTOQUE");
  assert.ok(t.includes(ONE_TURN_SIM));
  assert.ok(t.includes('"rerun_simulation": true'));
  assert.ok(t.includes("simulation_result preenchido"), "regra de término do loop");
});

test("1-turno: regra única + idempotente", () => {
  const wf = withOneTurn(loadWf());
  assert.equal(sm(wf, "Bia 2 ESTOQUE").split("ENTREGA EM UM ÚNICO TURNO").length - 1, 1);
  const before = sm(wf, "Bia 2 ESTOQUE");
  oneTurnSim(wf);
  assert.equal(sm(wf, "Bia 2 ESTOQUE"), before);
});

// ───────────── (A) multi-cotação: cliente pede dois modelos ─────────────
const jsOfRF = (wf) => wf.nodes.find((n) => n.name === "Code Routing Flags").parameters.jsCode;
const isMultiFix = (wf) => jsOfRF(wf).includes("multi-cotação: pedir 2 modelos");
function multiFixed(wf) { return isMultiFix(wf) ? wf : fixMultiQuoteRouting(gated(wf)); }
function multiState(overrides = {}) {
  return baseState({
    intent: "aparelho_iphone",
    interest_type: null,        // cliente deu 2 modelos → info foi p/ desired_devices
    desired_model: null, desired_capacity: null, desired_condition: null,
    has_tradein: false,
    desired_devices: [
      { slot: 1, desired_model: "iPhone 15 Pro Max", desired_capacity: "256GB" },
      { slot: 2, desired_model: "iPhone 15", desired_capacity: "128GB" },
    ],
    ...overrides,
  });
}

test("multi: dois modelos com entrada NÃO resolvida → pergunta de entrada (não trava na Bia 1)", () => {
  const out = runFlags(multiFixed(loadWf()), multiState({ cash_entry_asked: false, cash_entry_intent: null, cash_entry_amount: null }));
  assert.equal(out.routing_decision, "ask_cash_entry_before_sim");
  assert.notEqual(out.routing_decision, "bia1_pre_inventory");
});

test("multi: dois modelos com entrada resolvida → rota multi-cotação (simula os dois)", () => {
  const out = runFlags(multiFixed(loadWf()), multiState({ cash_entry_asked: true }));
  assert.equal(out.routing_decision, "v2_multi_quote_inventory_or_simulator");
  assert.equal(out.shouldSearchInventory, true);
  assert.equal(out.simulation_mode, "comparison");
});

test("multi: single-device NÃO é afetado (regressão) — segue pedindo entrada normalmente", () => {
  const out = runFlags(multiFixed(loadWf()), baseState({ cash_entry_asked: false }));
  assert.equal(out.routing_decision, "ask_cash_entry_before_sim");
});

test("multi: fix idempotente", () => {
  const wf = multiFixed(loadWf());
  const before = jsOfRF(wf);
  fixMultiQuoteRouting(wf);
  assert.equal(jsOfRF(wf), before);
});

// ───── (A) supressão do envio da mensagem-gatilho do loop de re-simulação ─────
const jsOf = (wf, name) => wf.nodes.find((n) => n.name === name).parameters.jsCode;
const stripHeader = (js) => { const i = js.indexOf("NÃO EDITE ACIMA DESTA LINHA"); return i === -1 ? js : js.slice(js.indexOf("\n", i) + 1); };
function runSendParser(wf, output) {
  const body = stripHeader(jsOf(wf, "Code Parse Bia 2 SEM ESTOQUE"));
  const $ = () => ({ first: () => ({ json: {} }), last: () => ({ json: {} }) });
  const $json = { output };
  return new Function("$", "$json", body)($, $json);
}
const isSuppress = (wf) => jsOf(wf, "Code Parse Bia 2 SEM ESTOQUE").includes("rerun_simulation === true");
function withSuppress(wf) { return isSuppress(wf) ? wf : suppressRerunSend(wf); }

test("envio: mensagem-gatilho (rerun_simulation:true) NÃO é enviada (parser retorna [])", () => {
  const wf = withSuppress(loadWf());
  const out = runSendParser(wf, JSON.stringify({ message: "Vou simular e já te mostro.", transfer: false, rerun_simulation: true }));
  assert.deepEqual(out, []);
});

test("envio: mensagem normal (sem rerun) é enviada (parser retorna 1 item)", () => {
  const wf = withSuppress(loadWf());
  const out = runSendParser(wf, JSON.stringify({ message: "Olha como ficou: R$ 5.190.", transfer: false }));
  assert.equal(out.length, 1);
  assert.equal(out[0].json.router.message.includes("5.190"), true);
});

test("envio: guard idempotente", () => {
  const wf = withSuppress(loadWf());
  const before = jsOf(wf, "Code Parse Bia 2 SEM ESTOQUE");
  suppressRerunSend(wf);
  assert.equal(jsOf(wf, "Code Parse Bia 2 SEM ESTOQUE"), before);
});

test("disp: regra explícita no CASO A + idempotente", () => {
  const wf = availRefined(loadWf());
  const t = sm(wf, "Bia 2 ESTOQUE");
  assert.ok(t.includes("NÃO repita o modelo/capacidade já escolhidos — cite só o que é novo"));
  const before = sm(wf, "Bia 2 ESTOQUE");
  refineAvailabilityVoice(wf);
  assert.equal(sm(wf, "Bia 2 ESTOQUE"), before);
});

// ───────────────────────── (B) blocos aditivos de venda ─────────────────────────
const isB1 = (wf) => !sm(wf, "Bia 2 ESTOQUE").includes("O que achou da proposta? Quer que eu já encaminhe");
function withB1(wf) { return isB1(wf) ? wf : b1Cta(prompted(wf)); }
const isB2 = (wf) => sm(wf, "Bia 2 ESTOQUE").includes("# RÉGUA DE OBJEÇÃO DE PREÇO");
function withB2(wf) { return isB2(wf) ? wf : b2Objection(prompted(wf)); }
const isB3 = (wf) => sm(wf, "Bia 2 ESTOQUE").includes("# RECUPERAÇÃO DE CLIENTE INDECISO");
function withB3(wf) { return isB3(wf) ? wf : b3Recovery(prompted(wf)); }
const isB4 = (wf) => sm(wf, "Bia 2 ESTOQUE").includes("# RECOMENDAÇÃO ATIVA");
function withB4(wf) { return isB4(wf) ? wf : b4Recommend(prompted(wf)); }
const isB5 = (wf) => sm(wf, "Bia 1").includes("# MICROCONVERSÃO ANTES DE PERGUNTAR");
function withB5(wf) { return isB5(wf) ? wf : b5Microconv(prompted(wf)); }

test("B1: CTA forte substitui a pergunta fraca, sem quebrar contrato", () => {
  const t = sm(withB1(loadWf()), "Bia 2 ESTOQUE");
  assert.ok(!t.includes("O que achou da proposta?"));
  assert.ok(t.includes("Quer que eu já deixe o aparelho separado"));
  assert.ok(t.includes('"transfer": false'));
});

test("B2: régua de objeção presente com 3 níveis (transfer só no 3º)", () => {
  const t = sm(withB2(loadWf()), "Bia 2 ESTOQUE");
  assert.ok(t.includes("# RÉGUA DE OBJEÇÃO DE PREÇO"));
  assert.ok(t.includes("1ª objeção") && t.includes("2ª objeção") && t.includes("3ª objeção"));
  assert.ok(t.includes("vou chamar nosso especialista da iPhone Repasse pra ver o melhor cenário"));
});

test("B3: bloco de recuperação de indeciso presente", () => {
  const t = sm(withB3(loadWf()), "Bia 2 ESTOQUE");
  assert.ok(t.includes("# RECUPERAÇÃO DE CLIENTE INDECISO"));
  assert.ok(t.includes("ainda é uma boa referência"));
});

test("B4: bloco de recomendação ativa presente", () => {
  const t = sm(withB4(loadWf()), "Bia 2 ESTOQUE");
  assert.ok(t.includes("# RECOMENDAÇÃO ATIVA"));
  assert.ok(t.includes("eu iria no 256GB"));
  assert.ok(t.includes("garantia Apple cheia"));
});

test("B5: microconversão na Bia 1 presente, sem reintroduzir pedido de bandeira", () => {
  const t = sm(withB5(loadWf()), "Bia 1");
  assert.ok(t.includes("# MICROCONVERSÃO ANTES DE PERGUNTAR"));
  assert.ok(t.includes("qual armazenamento"));
  assert.ok(!/qual a bandeira/i.test(t));
});

test("B: estrutura íntegra + idempotência com todos os blocos (A+B1..B5)", () => {
  const wf = transformPhase(loadWf(), "B");
  assert.deepEqual(structuralErrors(wf), []);
  assert.ok(isB1(wf) && isB2(wf) && isB3(wf) && isB4(wf) && isB5(wf));
  const before = JSON.stringify(wf);
  transformPhase(wf, "B"); // segunda passada = no-op
  assert.equal(JSON.stringify(wf), before);
});
