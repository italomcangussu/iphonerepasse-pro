import { test } from "node:test";
import assert from "node:assert/strict";
import { loadBlock } from "../parsers/load.mjs";

const { classifyBiaQuestion, applyReplyAttribution } = loadBlock(
  "reply_attribution.block.js",
  ["classifyBiaQuestion", "applyReplyAttribution"],
);

test("classifyBiaQuestion maps the known Bia questions", () => {
  assert.equal(classifyBiaQuestion("E qual é o aparelho que você tem agora?"), "tradein_model");
  assert.equal(classifyBiaQuestion("Qual modelo de iPhone você deseja comprar?"), "desired_model");
  assert.equal(classifyBiaQuestion("Qual armazenamento você procura?"), "desired_capacity");
  assert.equal(classifyBiaQuestion("E qual a cor?"), "desired_color");
  assert.equal(classifyBiaQuestion("Você quer dar algum valor de entrada no Pix/dinheiro?"), "cash_entry");
  assert.equal(classifyBiaQuestion("texto aleatório sem padrão"), null);
  assert.equal(classifyBiaQuestion(""), null);
});

test("applyReplyAttribution: reply to current-device question routes answer to trade-in, keeps desired", () => {
  // reconciler wrongly overwrote desired with the entry model
  const memory = { desired_model: "iPhone 14 Pro Max", has_tradein: false, interest_type: "comprar" };
  const prev = { desired_model: "iPhone 17 Pro Max", desired_capacity: null };
  const out = applyReplyAttribution(
    memory,
    prev,
    { target_text: "E qual é o aparelho que você tem agora?", target_direction: "outbound" },
    "14pm",
  );
  assert.equal(out.desired_model, "iPhone 17 Pro Max");
  assert.equal(out.tradein_model, "iPhone 14 Pro Max");
  assert.equal(out.has_tradein, true);
  assert.equal(out.interest_type, "trocar");
  assert.equal(out.reply_attributed_category, "tradein_model");
});

test("applyReplyAttribution: no reply context = no change", () => {
  const memory = { desired_model: "iPhone 14 Pro Max" };
  const out = applyReplyAttribution(memory, {}, null, "14pm");
  assert.deepEqual(out, memory);
});

test("applyReplyAttribution: reply to desired question tags desired, leaves trade-in untouched", () => {
  const memory = { desired_model: "iPhone 17 Pro Max", has_tradein: false };
  const out = applyReplyAttribution(
    memory,
    {},
    { target_text: "Qual modelo de iPhone você deseja comprar?", target_direction: "outbound" },
    "17pm",
  );
  assert.equal(out.desired_model, "iPhone 17 Pro Max");
  assert.equal(out.has_tradein, false);
  assert.equal(out.reply_attributed_category, "desired_model");
});
