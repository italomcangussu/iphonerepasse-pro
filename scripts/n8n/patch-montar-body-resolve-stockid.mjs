// Surgical patch — "Montar Body do Simulador" (workflow AO VIVO Cr4fPWe0prwS6XjI).
//
// Bug observado na execução 406053 (caminho de RE-SIMULAÇÃO, source =
// "Code Parse Re-simulacao Bia 2 ESTOQUE"): a Bia 2 emitiu
//   router.rerun_stock_item_id = "stk-titanio-preto-16-pro-max"
// um id SINTÉTICO/alucinado (slug, não UUID) que NÃO existe no estoque. O node
// confiava cegamente nesse id -> simulator_body.desiredDevice.stockItemId =
// "stk-titanio-preto-16-pro-max" -> o simulador não acha o item (404). O item
// REAL está em inventory.available_items: stk-a67c533d-... (iPhone 16 Pro Max
// Titânio Preto 256GB Seminovo).
//
// Fix: validar o stockItemId resolvido contra inventory.available_items; se for
// inválido, resolver deterministicamente por modelo+cor+capacidade (o próprio
// slug já codifica "titanio-preto-16-pro-max", reforçado pela mensagem do
// router). Mesmo tratamento para os ids do multi-quote. Se não der pra resolver
// com confiança, cai no caminho gracioso missingStockItem (transfere) em vez de
// chamar o simulador com um id que vai falhar de qualquer jeito.
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. DRY=1 lê o snapshot local e grava /tmp/repasse-montarbody-resolve-dry.json sem PUT.
import fs from "node:fs";
import * as kit from "./tool/patch-kit.mjs";

const NODE_NAME = "Montar Body do Simulador";

// --- edição 1: quoteItems precisa ser reatribuível ---
const QUOTE_NEEDLE = "const quoteItems = compactQuoteItems(";
const QUOTE_REPLACEMENT = "let quoteItems = compactQuoteItems(";

// --- edição 2: stockItemId precisa ser reatribuível ---
const STOCKID_NEEDLE = "const stockItemId =\n  decision.rerun_stock_item_id ??";
const STOCKID_REPLACEMENT = "let stockItemId =\n  decision.rerun_stock_item_id ??";

// --- edição 3: inserir o resolver logo após o guard de stockItemId ausente ---
const GUARD_NEEDLE = `  return [{
    json: {
      ...inputData,
      stock_item_id: null,
      simulator_body: { missingStockItem: true },
      simulation_skipped_reason: "missing_stock_item",
    },
  }];
}`;

const RESOLVER_BLOCK = `

// REPASSE MONTAR BODY RESOLVE STOCK ID: rerun_stock_item_id vem da LLM da Bia 2
// e pode ser SINTÉTICO/alucinado (ex.: "stk-titanio-preto-16-pro-max"),
// inexistente no estoque -> simulador 404. Valida contra inventory.available_items;
// se inválido, resolve por modelo+cor+capacidade a partir do próprio id sintético
// e da mensagem. Mesmo tratamento para os ids do multi-quote.
const __availItems = Array.isArray(inventory.available_items) ? inventory.available_items : [];
const __validIds = new Set(__availItems.map((it) => String(it?.stock_item_id)).filter(Boolean));
function __norm(s) {
  return String(s ?? "").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function __modelKey(s) {
  const n = __norm(s);
  const m = n.match(/(\\d{1,2})\\s*(pro max|pro|plus|mini)?/);
  return m ? (m[1] + " " + (m[2] || "")).trim() : null;
}
function __resolveStockId(requestedId) {
  if (requestedId && __validIds.has(String(requestedId))) return String(requestedId);
  if (!__availItems.length) return requestedId ?? null;
  const hint = __norm([requestedId, decision.message, decision.rerun_stock_item_label, memory.desired_model, memory.desired_color, memory.desired_capacity, memory.last_quote_label].filter(Boolean).join(" "));
  const wantModel = __modelKey([requestedId, memory.desired_model, decision.message].filter(Boolean).join(" "));
  let best = null, bestScore = -1;
  for (const it of __availItems) {
    const im = __modelKey(it?.model);
    let score = 0;
    if (wantModel && im && im === wantModel) score += 100;
    else if (wantModel && im && im !== wantModel) continue;
    const colorTokens = __norm(it?.color).split(" ").filter(Boolean);
    if (colorTokens.length && colorTokens.every((t) => hint.includes(t))) score += 20;
    const capNum = String(it?.capacity ?? "").match(/\\d+/);
    if (capNum && hint.includes(capNum[0])) score += 10;
    if (String(it?.status ?? "").toLowerCase().startsWith("dispon")) score += 1;
    if (score > bestScore) { bestScore = score; best = it; }
  }
  if (best && bestScore >= 100) return String(best.stock_item_id);
  return null; // id pedido inválido e sem match confiável
}

// Valida/resolve o item único.
if (stockItemId && __availItems.length && !__validIds.has(String(stockItemId))) {
  const __resolved = __resolveStockId(stockItemId);
  if (__resolved && __validIds.has(String(__resolved))) {
    stockItemId = __resolved;
  } else {
    return [{
      json: {
        ...inputData,
        stock_item_id: null,
        simulator_body: { missingStockItem: true },
        simulation_skipped_reason: "unresolved_stock_item",
      },
    }];
  }
}

// Valida/resolve os ids do multi-quote (mesma alucinação possível).
if (__availItems.length && quoteItems.length) {
  quoteItems = quoteItems
    .map((q) => {
      if (__validIds.has(String(q.stockItemId))) return q;
      const r = __resolveStockId(q.stockItemId);
      return r ? { ...q, stockItemId: String(r) } : null;
    })
    .filter(Boolean);
}`;

const workflow = await kit.loadWorkflow();
const wasActive = workflow.active;
const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`${NODE_NAME} not found`);
let code = node.parameters.jsCode;

if (code.includes("REPASSE MONTAR BODY RESOLVE STOCK ID")) {
  console.log("  skip [já aplicado]");
} else {
  for (const [label, needle, repl] of [
    ["quoteItems let", QUOTE_NEEDLE, QUOTE_REPLACEMENT],
    ["stockItemId let", STOCKID_NEEDLE, STOCKID_REPLACEMENT],
  ]) {
    if (code.split(needle).length - 1 !== 1) throw new Error(`needle não-único: ${label}`);
    code = code.replace(needle, repl);
  }
  if (code.split(GUARD_NEEDLE).length - 1 !== 1) throw new Error("needle guard não-único");
  code = code.replace(GUARD_NEEDLE, GUARD_NEEDLE + RESOLVER_BLOCK);
  node.parameters.jsCode = code;
  console.log("  ok [resolver de stock id]");
}

new Function("$input", "$", "DateTime", "$helpers", "$jmespath", node.parameters.jsCode);
for (const m of ["REPASSE MONTAR BODY RESOLVE STOCK ID", "__resolveStockId", "let stockItemId =", "let quoteItems = compactQuoteItems("]) {
  if (!node.parameters.jsCode.includes(m)) throw new Error(`sanity falhou: ${m}`);
}

if (kit.DRY) {
  fs.writeFileSync("/tmp/repasse-montarbody-resolve-dry.json", JSON.stringify(workflow, null, 2));
  console.log(JSON.stringify({ dry: true }, null, 2));
  process.exit(0);
}
kit.backup(await kit.getLive(), "montarbody-resolve");
const { verify, activeAfter, finalActive } = await kit.safePut(workflow, "montarbody-resolve");
const v = verify.nodes.find((n) => n.name === NODE_NAME);
console.log(JSON.stringify({ wasActive, activeAfter, finalActive, applied: v.parameters.jsCode.includes("REPASSE MONTAR BODY RESOLVE STOCK ID") }, null, 2));
