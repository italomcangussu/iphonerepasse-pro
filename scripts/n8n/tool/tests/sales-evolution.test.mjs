import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { removeCardBrandGates } from "../../transform-sales-evolution.mjs";
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
