import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Harness do nó "Code in JavaScript2" (40_06): achata o memory reconciliado e
// normaliza para o schema do lead_state ANTES do Edit Fields5 (Set tipado).
// Regressão alvo (exec 414181): o LLM emitiu cash_entry_intent="negociacao";
// como o Edit Fields5 tem esse campo como boolean ESTRITO, o workflow inteiro
// abortava (bot mudo). A fronteira aqui deve coagir booleanos para boolean|null.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NODE_FILE = path.join(HERE, "../../../../n8n/ia-repasse-pro-v2/nodes/code/40_06_code-in-javascript2.js");
const SENTINEL = "===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====";

function loadBody() {
  const raw = fs.readFileSync(NODE_FILE, "utf8");
  const idx = raw.indexOf(SENTINEL);
  return idx === -1 ? raw : raw.slice(raw.indexOf("\n", idx) + 1);
}

function runNode(memory) {
  const body = loadBody();
  const items = [{ json: {} }];
  const $input = { all: () => items, first: () => ({ json: { memory } }) };
  const fn = new Function("$input", body);
  const ret = fn($input);
  return ret[0].json;
}

test("CIJS2: coage cash_entry_intent não-booleano ('negociacao') para null (regressão 414181)", () => {
  const out = runNode({ cash_entry_intent: "negociacao" });
  assert.equal(out.cash_entry_intent, null);
});

test("CIJS2: 'sim'/'não' viram boolean; true/false e null preservados", () => {
  const out = runNode({
    has_tradein: "sim",
    simulation_done: "não",
    tradein_disqualified: true,
    proposal_accepted: false,
    pix_paid: null,
  });
  assert.equal(out.has_tradein, true);
  assert.equal(out.simulation_done, false);
  assert.equal(out.tradein_disqualified, true);
  assert.equal(out.proposal_accepted, false);
  assert.equal(out.pix_paid, null);
});

test("CIJS2: enums continuam normalizados (interest_type/desired_condition)", () => {
  const out = runNode({ interest_type: "troca", desired_condition: "novo" });
  assert.equal(out.interest_type, "trocar");
  assert.equal(out.desired_condition, "Novo");
});

test("CIJS2: campo boolean ausente NÃO é adicionado (sem null espúrio)", () => {
  const out = runNode({ interest_type: "comprar" });
  assert.equal(Object.prototype.hasOwnProperty.call(out, "cash_entry_intent"), false);
});

test("CIJS2: campos string não-booleanos são preservados (não viram null)", () => {
  const out = runNode({ desired_model: "iPhone 15 Pro Max", preferred_city: "Sobral" });
  assert.equal(out.desired_model, "iPhone 15 Pro Max");
  assert.equal(out.preferred_city, "Sobral");
});
