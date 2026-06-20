import { test } from "node:test";
import assert from "node:assert/strict";
import { loadBlock } from "../parsers/load.mjs";

const { classifyBiaQuestion, decideTradeinReclass } = loadBlock(
  "reply_attribution.block.js",
  ["classifyBiaQuestion", "decideTradeinReclass"],
);

test("classifyBiaQuestion maps the known Bia questions", () => {
  assert.equal(classifyBiaQuestion("E qual é o aparelho que você tem agora?"), "tradein_model");
  assert.equal(classifyBiaQuestion("Tem algum iPhone pra dar de entrada?"), "tradein_model");
  assert.equal(classifyBiaQuestion("Qual seu aparelho atual?"), "tradein_model");
  assert.equal(classifyBiaQuestion("Qual modelo de iPhone você deseja comprar?"), "desired_model");
  assert.equal(classifyBiaQuestion("Qual armazenamento você procura?"), "desired_capacity");
  assert.equal(classifyBiaQuestion("E qual a cor?"), "desired_color");
  assert.equal(classifyBiaQuestion("Você quer dar algum valor de entrada no Pix/dinheiro?"), "cash_entry");
  assert.equal(classifyBiaQuestion("texto aleatório sem padrão"), null);
  assert.equal(classifyBiaQuestion(""), null);
});

test("classifyBiaQuestion: combined opener (deseja comprar? + aparelho atual?) classifies as trade-in", () => {
  // The opener asks both at once; trade-in must win so the gate recognizes it.
  assert.equal(
    classifyBiaQuestion("Qual modelo você deseja comprar? E qual o aparelho atual que você tem?"),
    "tradein_model",
  );
});

// --- decideTradeinReclass: the legitimate fix must keep working ---------------

test("reclass fires when the bot asked the current-device question via REPLY quote", () => {
  // reconciler wrongly overwrote desired with the entry model
  const memory = { desired_model: "iPhone 14 Pro Max", has_tradein: false, interest_type: "comprar" };
  const prev = { desired_model: "iPhone 17 Pro Max", desired_capacity: 256 };
  const patch = decideTradeinReclass({
    memory,
    prevLeadState: prev,
    currentMessage: "14pm",
    lastBotMessage: "algo sobre disponibilidade",
    replyContext: { target_text: "E qual é o aparelho que você tem agora?", target_direction: "outbound" },
  });
  assert.ok(patch, "expected a reclass patch");
  assert.equal(patch.desired_model, "iPhone 17 Pro Max");
  assert.equal(patch.tradein_model, "iPhone 14 Pro Max");
  assert.equal(patch.desired_capacity, 256);
  assert.equal(patch.has_tradein, true);
  assert.equal(patch.interest_type, "trocar");
  assert.equal(patch.tradein_reclassified, true);
});

test("reclass fires when the LAST bot message asked the current-device question (no quote)", () => {
  const memory = { desired_model: "iPhone 14 Pro Max", has_tradein: false };
  const prev = { desired_model: "iPhone 17 Pro Max" };
  const patch = decideTradeinReclass({
    memory,
    prevLeadState: prev,
    currentMessage: "14pm",
    lastBotMessage: "Qual modelo deseja comprar? E qual o aparelho atual que você tem hoje?",
    replyContext: null,
  });
  assert.ok(patch);
  assert.equal(patch.tradein_model, "iPhone 14 Pro Max");
  assert.equal(patch.desired_model, "iPhone 17 Pro Max");
});

// --- THE GATE: browsing / unrelated turns must NOT fabricate a trade-in -------

test("NO reclass when the bot did not ask for the current device (browsing two models)", () => {
  // Client browses: asked 17, bot quoted price, now asks about 16 — NOT a trade-in.
  const memory = { desired_model: "iPhone 16", has_tradein: false };
  const prev = { desired_model: "iPhone 17 Pro Max" };
  const patch = decideTradeinReclass({
    memory,
    prevLeadState: prev,
    currentMessage: "e o 16?",
    lastBotMessage: "O 17 Pro Max está disponível por R$ 6.500 à vista.",
    replyContext: null,
  });
  assert.equal(patch, null);
});

test("NO reclass when last bot message only asked the DESIRED question", () => {
  const memory = { desired_model: "iPhone 16", has_tradein: false };
  const prev = { desired_model: "iPhone 17 Pro Max" };
  const patch = decideTradeinReclass({
    memory,
    prevLeadState: prev,
    currentMessage: "o 16",
    lastBotMessage: "Qual modelo de iPhone você deseja comprar?",
    replyContext: null,
  });
  assert.equal(patch, null);
});

test("NO reclass when the client explicitly switches desire (escape hatch)", () => {
  const memory = { desired_model: "iPhone 16", has_tradein: false };
  const prev = { desired_model: "iPhone 17 Pro Max" };
  const patch = decideTradeinReclass({
    memory,
    prevLeadState: prev,
    currentMessage: "na verdade quero o 16",
    lastBotMessage: "E qual o aparelho atual que você tem?",
    replyContext: null,
  });
  assert.equal(patch, null);
});

test("NO reclass when a trade-in is already captured", () => {
  const memory = { desired_model: "iPhone 16", has_tradein: true, tradein_model: "iPhone 13" };
  const prev = { desired_model: "iPhone 17 Pro Max" };
  const patch = decideTradeinReclass({
    memory,
    prevLeadState: prev,
    currentMessage: "14pm",
    lastBotMessage: "E qual o aparelho atual que você tem?",
    replyContext: null,
  });
  assert.equal(patch, null);
});

test("NO reclass when there is no prior desired or it is unchanged", () => {
  assert.equal(
    decideTradeinReclass({
      memory: { desired_model: "iPhone 16" },
      prevLeadState: {},
      lastBotMessage: "E qual o aparelho atual que você tem?",
    }),
    null,
  );
  assert.equal(
    decideTradeinReclass({
      memory: { desired_model: "iPhone 17 Pro Max" },
      prevLeadState: { desired_model: "iPhone 17 Pro Max" },
      lastBotMessage: "E qual o aparelho atual que você tem?",
    }),
    null,
  );
});

test("NO reclass when the reply quote was to an inbound (client's own) message", () => {
  const memory = { desired_model: "iPhone 14 Pro Max", has_tradein: false };
  const prev = { desired_model: "iPhone 17 Pro Max" };
  const patch = decideTradeinReclass({
    memory,
    prevLeadState: prev,
    currentMessage: "14pm",
    lastBotMessage: "qualquer coisa",
    replyContext: { target_text: "E qual o aparelho atual?", target_direction: "inbound" },
  });
  assert.equal(patch, null);
});
