import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { removeCardBrandGates, removeCardBrandPrompts, b1Cta, b2Objection, b3Recovery, b4Recommend, b5Microconv, transformPhase } from "../../transform-sales-evolution.mjs";
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
  assert.ok(t.includes("condição padrão do cartão"));
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
