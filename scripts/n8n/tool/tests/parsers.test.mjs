// ============================================================================
// parsers.test.mjs — REDE DE CARACTERIZAÇÃO da lógica pura dos parsers de agente.
//
// Trava o comportamento ATUAL (antes de qualquer refactor de voz/limpeza) de:
//   - color-guard (commerce_context.block.js)  — usado por Code Commerce Context
//     + Code Parse Bia 2 SEM ESTOQUE
//   - json-repair (json_repair.block.js)        — usado por Code Parse Memory 1 e 2
//   - decisão de trade-in (bia1_tradein.block.js) — usado por Code Parse Bia 1
//
// Três garantias por bloco:
//   (1) CARACTERIZAÇÃO — saídas conhecidas das funções puras.
//   (2) FIDELIDADE — o bloco canônico bate byte-a-byte com o nó vivo.
//   (3) CONSISTÊNCIA-DE-DUPLICAÇÃO — todas as cópias inline são idênticas entre si
//       (se alguém corrigir uma cópia e esquecer as gêmeas, este teste pega).
//
// Rodar: node --test scripts/n8n/tool/tests/parsers.test.mjs
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBlock, readBlock } from "../parsers/load.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CODE = path.resolve(HERE, "../../../../n8n/ia-repasse-pro-v2/nodes/code");

const SENTINEL = "NÃO EDITE ACIMA DESTA LINHA =====";
function nodeBody(file) {
  const s = fs.readFileSync(path.join(CODE, file), "utf8");
  const i = s.indexOf(SENTINEL);
  return i === -1 ? s : s.slice(s.indexOf("\n", i) + 1);
}
function between(text, startMark, endMark, { inclusive = true } = {}) {
  const a = text.indexOf(startMark);
  const b = text.indexOf(endMark);
  assert.ok(a !== -1 && b !== -1, `marcadores ausentes: ${startMark} … ${endMark}`);
  return inclusive ? text.slice(a, b + endMark.length) : text.slice(a + startMark.length, b);
}

// ===========================================================================
// COLOR-GUARD (commerce_context.block.js)
// ===========================================================================
const cg = loadBlock("commerce_context.block.js", [
  "normalizeText", "buildAllowedColors", "deriveStage",
  "buildCommerceContext", "detectColors", "enforceAllowedColors", "COLOR_LEXICON",
]);

test("color-guard: normalizeText remove acento/pontuação e colapsa espaço", () => {
  assert.equal(cg.normalizeText("Azul  Profundo!"), "azul profundo");
  assert.equal(cg.normalizeText("Titânio Natural"), "titanio natural");
  assert.equal(cg.normalizeText(null), "");
});

test("color-guard: detectColors prefere o multiword e descarta o token contido", () => {
  assert.deepEqual(cg.detectColors("quero o azul profundo"), ["azul profundo"]);
  assert.deepEqual(cg.detectColors("tem preto?"), ["preto"]);
  assert.deepEqual(cg.detectColors("oi, tudo bem?"), []);
});

test("color-guard: enforceAllowedColors troca cor alucinada por pergunta segura", () => {
  const hit = cg.enforceAllowedColors("temos azul profundo sim", ["preto"], []);
  assert.equal(hit.triggered, true);
  assert.deepEqual(hit.violations, ["azul profundo"]);
  assert.match(hit.message, /cores que tenho dispon/i);
  assert.match(hit.message, /preto/);
});

test("color-guard: enforceAllowedColors não dispara quando a cor é permitida ou ausente", () => {
  assert.equal(cg.enforceAllowedColors("temos preto", ["preto"]).triggered, false);
  assert.equal(cg.enforceAllowedColors("bom dia", []).triggered, false);
  // cor mencionada pelo cliente (extraAllowed) nunca é violação
  assert.equal(cg.enforceAllowedColors("queria azul", [], ["azul"]).triggered, false);
});

test("color-guard: deriveStage segue a precedência closing>simulation>presentation>collection", () => {
  assert.equal(cg.deriveStage({ pix_paid: true, simulation_done: true }), "closing");
  assert.equal(cg.deriveStage({ simulation_done: true }), "simulation");
  assert.equal(cg.deriveStage({ context_ready: true, stock_item_id: "x" }), "presentation");
  assert.equal(cg.deriveStage({}), "collection");
});

test("color-guard: buildAllowedColors dedupe por forma normalizada mantendo o display original", () => {
  const out = cg.buildAllowedColors({ inventory: { available_colors: ["Preto", "preto ", "Azul"] } });
  assert.deepEqual(out, ["Preto", "Azul"]);
});

test("price-guard: stripBrowsingPrices remove R$ na navegação (collection/presentation)", () => {
  const { stripBrowsingPrices } = loadBlock("commerce_context.block.js", ["stripBrowsingPrices"]);
  const txt = "Temos o 15 Pro Max 256GB por R$ 5.190 e o 14 Pro por R$4.490.";
  assert.equal(/R\$\s?\d/.test(stripBrowsingPrices(txt, "collection")), false);
  assert.equal(/R\$\s?\d/.test(stripBrowsingPrices(txt, "presentation")), false);
});

test("price-guard: stripBrowsingPrices preserva preço em simulation/closing", () => {
  const { stripBrowsingPrices } = loadBlock("commerce_context.block.js", ["stripBrowsingPrices"]);
  const txt = "Fica em 12x de R$ 480 no cartão.";
  assert.equal(stripBrowsingPrices(txt, "simulation"), txt);
  assert.equal(stripBrowsingPrices(txt, "closing"), txt);
});

test("color-guard: cor alucinada com lista vazia ainda dispara mensagem segura (anti-Dourado)", () => {
  const hit = cg.enforceAllowedColors("Ótimo, Dourado então!", [], []);
  assert.equal(hit.triggered, true);
  assert.match(hit.message, /cor de prefer|disponibilidade de cores/i);
});

test("color-guard FIDELIDADE: bloco canônico == nó Code Commerce Context", () => {
  const canon = readBlock("commerce_context.block.js").trimEnd();
  const node = between(nodeBody("70_01_code-commerce-context.js"),
    "// === REPASSE COMMERCE CONTEXT START ===", "// === REPASSE COMMERCE CONTEXT END ===").trimEnd();
  assert.equal(node, canon);
});

test("color-guard DUPLICAÇÃO: as 2 cópias inline são byte-idênticas", () => {
  // Após a fusão Bia 2 (2026-06-18) sobrou 1 parser de continuidade; o color-guard
  // vive em Code Commerce Context + Code Parse Bia 2 SEM ESTOQUE (o gêmeo foi removido).
  const A = "// === REPASSE COMMERCE CONTEXT START ===", B = "// === REPASSE COMMERCE CONTEXT END ===";
  const copies = ["70_01_code-commerce-context.js", "80_02_code-parse-bia-2-sem-estoque.js"]
    .map((f) => between(nodeBody(f), A, B));
  assert.equal(copies[1], copies[0]);
});

// ===========================================================================
// JSON-REPAIR (json_repair.block.js) — Memory 1 / Memory 2
// ===========================================================================
const jr = loadBlock("json_repair.block.js", [
  "extractJsonString", "nextNonWhitespaceIndex", "isStructuralClosingQuote", "repairUnescapedQuotesInsideStrings",
]);

test("json-repair: extractJsonString tira cerca markdown e acha objeto solto", () => {
  assert.equal(jr.extractJsonString("```json\n{\"a\":1}\n```"), '{"a":1}');
  assert.equal(jr.extractJsonString('lixo {"a":1} fim'), '{"a":1}');
  assert.equal(jr.extractJsonString(null), null);
  assert.equal(jr.extractJsonString("sem json aqui"), null);
});

test("json-repair: repairUnescapedQuotesInsideStrings conserta aspas internas → JSON válido", () => {
  const bad = '{"msg":"ele disse "oi" pra mim"}';
  const fixed = jr.repairUnescapedQuotesInsideStrings(bad);
  const parsed = JSON.parse(fixed);
  assert.equal(parsed.msg, 'ele disse "oi" pra mim');
});

test("json-repair: aspas estruturais (antes de : , } ]) são preservadas", () => {
  const ok = '{"a":"b","c":"d"}';
  assert.equal(jr.repairUnescapedQuotesInsideStrings(ok), ok);
});

function jsonRepairSrc(file, endAnchor) {
  const body = nodeBody(file);
  return body.slice(body.indexOf("function extractJsonString"), body.indexOf(endAnchor)).trimEnd();
}

test("json-repair DUPLICAÇÃO: cópias de Memory 1 e Memory 2 são byte-idênticas (unificadas)", () => {
  // Eram cosmeticamente divergentes (regex de cerca escapado vs não); unificadas no
  // passo de consolidação. Agora travamos byte-identidade — qualquer drift futuro pega.
  assert.equal(
    jsonRepairSrc("40_03_code-parse-memory-1.js", "function safeArray"),
    jsonRepairSrc("40_05_code-parse-memory-2.js", "function parseDelivered"),
  );
});

test("json-repair FIDELIDADE: bloco canônico == funções de Memory 1 E Memory 2", () => {
  const canon = readBlock("json_repair.block.js").trimEnd();
  assert.equal(jsonRepairSrc("40_03_code-parse-memory-1.js", "function safeArray"), canon);
  assert.equal(jsonRepairSrc("40_05_code-parse-memory-2.js", "function parseDelivered"), canon);
});

// ===========================================================================
// TRADE-IN (bia1_tradein.block.js) — Code Parse Bia 1
// ===========================================================================
const ti = loadBlock("bia1_tradein.block.js", [
  "TRADE_IN_FIELDS", "TRADE_IN_QUESTIONS", "getMissingTradeInFields",
  "deriveTradeInDecision", "buildAtomicTradeInResponse", "resolveSimulationMode",
]);

test("trade-in: getMissingTradeInFields ignora warranty_until salvo se garantia Apple = true", () => {
  assert.ok(!ti.getMissingTradeInFields({}).includes("tradein_warranty_until"));
  assert.ok(ti.getMissingTradeInFields({ tradein_apple_warranty: true }).includes("tradein_warranty_until"));
});

test("trade-in: deriveTradeInDecision sem trade-in pode simular (not_started/canSimulate)", () => {
  const d = ti.deriveTradeInDecision({ has_tradein: false });
  assert.equal(d.status, "not_started");
  assert.equal(d.canSimulate, true);
  assert.equal(d.action, null);
});

test("trade-in: pede consentimento quando há modelo e campos faltando, sem questionário prévio", () => {
  const d = ti.deriveTradeInDecision({ has_tradein: true, tradein_model: "iPhone 12", last_message_content: "oi", message_buffered: "quero vender" });
  assert.equal(d.action, "ask_tradein_consent");
  assert.equal(d.canSimulate, false);
  const resp = ti.buildAtomicTradeInResponse({ tradein_model: "iPhone 12" }, d);
  assert.match(resp.message, /iPhone 12/);
  assert.equal(resp.transfer, false);
});

test("trade-in: resolveSimulationMode distingue single/bundle/comparison", () => {
  assert.equal(ti.resolveSimulationMode("qualquer coisa", 1), "single");
  assert.equal(ti.resolveSimulationMode("quero levar os dois aparelhos", 2), "bundle");
  assert.equal(ti.resolveSimulationMode("qual compensa?", 2), "comparison");
});

test("trade-in FIDELIDADE: bloco canônico == funções puras do nó Code Parse Bia 1", () => {
  const canon = readBlock("bia1_tradein.block.js").trimEnd();
  const body = nodeBody("70_02_code-parse-bia-1.js");
  const node = body.slice(body.indexOf("const TRADE_IN_FIELDS"), body.indexOf("const inputData = $input.first().json;")).trimEnd();
  assert.equal(node, canon);
});

// ===========================================================================
// NÓS-GÊMEOS — corpos byte-idênticos (só muda o nome no AUTO-HEADER). Trava a
// duplicação total: qualquer edição num gêmeo tem de ser replicada no outro.
// NOTA: a fusão Bia 2 (2026-06-18) removeu os gêmeos de continuidade — sobrou um
// único Code Parse Bia 2 SEM ESTOQUE e um único CODE MONTAR LINK REPASSE 2, então
// esses dois testes de gêmeos saíram. Split Out caiu de ×3 para ×2 (split-out5 foi).
// ===========================================================================
test("gêmeos: Split Out (×2) têm corpo idêntico", () => {
  assert.equal(nodeBody("80_04_split-out1.js"), nodeBody("80_01_split-out3.js"));
});

// ===========================================================================
// HUMANIZER — já tem fonte canônica (repasse-humanizer.mjs). Aqui só travamos a
// fidelidade do bloco inline nos 4 nós que o carregam (não pode divergir).
// ===========================================================================
test("humanizer DUPLICAÇÃO: bloco idêntico nos 3 nós e igual ao canônico", async () => {
  const A = "// REPASSE HUMANIZER START", B = "// REPASSE HUMANIZER END";
  const nodes = [
    "70_02_code-parse-bia-1.js", "70_03_code-parse-re-simulacao-bia-2-estoque.js",
    "80_02_code-parse-bia-2-sem-estoque.js",
  ].map((f) => between(nodeBody(f), A, B));
  for (const b of nodes) assert.equal(b, nodes[0]);
  const mod = await import("../../repasse-humanizer.mjs");
  const canon = Array.isArray(mod.N8N_HUMANIZER_BLOCK) ? mod.N8N_HUMANIZER_BLOCK.join("\n") : String(mod.N8N_HUMANIZER_BLOCK);
  assert.equal(nodes[0].trim(), canon.trim());
});
