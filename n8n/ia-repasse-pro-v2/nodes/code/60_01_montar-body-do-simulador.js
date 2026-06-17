// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     Montar Body do Simulador
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    60 simulacao-estoque
// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.
// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====
const inputData = $input.first().json;
const decision = inputData.router ?? inputData.alana ?? {};
const memory = inputData.memory ?? inputData;
const inventory = inputData.inventory ?? {};

function toPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function compactQuoteItems(...sources) {
  const seen = new Set();
  const output = [];
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const item of source) {
      const stockItemId = item?.stock_item_id ?? item?.stockItemId ?? item?.best_item?.stock_item_id ?? item?.desiredDevice?.stockItemId;
      if (!stockItemId || seen.has(String(stockItemId))) continue;
      seen.add(String(stockItemId));
      output.push({
        slot: Number(item?.slot) || output.length + 1,
        stockItemId: String(stockItemId),
      });
      if (output.length >= 2) return output;
    }
  }
  return output;
}

let quoteItems = compactQuoteItems(
  decision.rerun_quote_items,
  decision.quote_items,
  inventory.quote_items,
  memory.quote_items,
  memory.desired_devices,
);

let stockItemId =
  decision.rerun_stock_item_id ??
  decision.stock_item_id ??
  memory.stock_item_id ??
  inputData.stock_item_id ??
  inventory.stock_item_id ??
  inventory.best_item?.stock_item_id ??
  quoteItems[0]?.stockItemId;

if (!stockItemId) {
  // Sem item de estoque valido: NAO derruba a execucao (cliente ficaria sem
  // resposta). Body sentinela faz o simulador responder 400 controlado
  // (success:false) e o Parse Simulator marca simulation_error -> a Bia
  // transfere para o especialista com mensagem.
  return [{
    json: {
      ...inputData,
      stock_item_id: null,
      simulator_body: { missingStockItem: true },
      simulation_skipped_reason: "missing_stock_item",
    },
  }];
}

// REPASSE MONTAR BODY RESOLVE STOCK ID: rerun_stock_item_id vem da LLM da Bia 2
// e pode ser SINTÉTICO/alucinado (ex.: "stk-titanio-preto-16-pro-max"),
// inexistente no estoque -> simulador 404. Valida contra inventory.available_items;
// se inválido, resolve por modelo+cor+capacidade a partir do próprio id sintético
// e da mensagem. Mesmo tratamento para os ids do multi-quote.
const __availItems = Array.isArray(inventory.available_items) ? inventory.available_items : [];
const __validIds = new Set(__availItems.map((it) => String(it?.stock_item_id)).filter(Boolean));
function __norm(s) {
  return String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function __modelKey(s) {
  const n = __norm(s);
  const m = n.match(/(\d{1,2})\s*(pro max|pro|plus|mini)?/);
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
    const capNum = String(it?.capacity ?? "").match(/\d+/);
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
}

// REPASSE MONTAR BODY TRADEIN SOURCES: o inputData.memory pode ser parcial
// (Code Refresh só traz stock_*); lê trade-in de memory, raiz e lead_state
// persistido. tradein_disqualified pode vir null -> usar !== true.
const tiLeadState = inputData.lead_state ?? {};
const tiHas = memory.has_tradein ?? inputData.has_tradein ?? tiLeadState.has_tradein;
const tiModel = memory.tradein_model ?? inputData.tradein_model ?? tiLeadState.tradein_model;
const tiAccepted = memory.tradein_model_accepted ?? inputData.tradein_model_accepted ?? tiLeadState.tradein_model_accepted;
const tiDisq = memory.tradein_disqualified ?? inputData.tradein_disqualified ?? tiLeadState.tradein_disqualified;
let tradeIn = null;
if (tiHas && tiAccepted !== false && tiDisq !== true && tiModel) {
  tradeIn = {
    model:    tiModel,
    capacity: memory.tradein_capacity ?? inputData.tradein_capacity ?? tiLeadState.tradein_capacity ?? "",
    color:    memory.tradein_color ?? inputData.tradein_color ?? tiLeadState.tradein_color ?? ""
  };
}

const entries = [];
const decisionEntries = Array.isArray(decision.rerun_simulation_entries) ? decision.rerun_simulation_entries : [];

for (const entry of decisionEntries) {
  const amount = toPositiveNumber(entry?.amount);
  if (amount) entries.push({ type: entry.type || "Pix", amount });
}

const decisionEntryAmount = toPositiveNumber(decision.rerun_simulation_entry_amount);
const cashEntryAmount = toPositiveNumber(memory.cash_entry_amount ?? inputData.cash_entry_amount ?? (inputData.lead_state ?? {}).cash_entry_amount);
const nextBestAction = decision.next_best_action ?? memory.next_best_action ?? inputData.next_best_action;

if (!entries.length && decisionEntryAmount) {
  entries.push({ type: "Pix", amount: decisionEntryAmount });
} else if (!entries.length && cashEntryAmount) {
  entries.push({ type: "Pix", amount: cashEntryAmount });
} else if (!entries.length && nextBestAction === "re-simular com PIX 250 como entrada") {
  entries.push({ type: "Pix", amount: 250 });
}

const cardBrand = decision.card_brand ?? memory.card_brand ?? inputData.card_brand ?? "visa_master";
const shouldUseMultiQuote = quoteItems.length > 1;
const currentMessageText = String(inputData.buffer?.message_buffered ?? inputData.message_buffered ?? memory.message_buffered ?? "");
function normalizeModeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const modeText = normalizeModeText([currentMessageText, decision.message, memory.summary_short, memory.summary_operational].filter(Boolean).join(" "));
const bundleSignal = /\b(comprar|levar|fechar|reservar)\b.*\b(os dois|2 aparelhos|dois aparelhos|ambos)\b|\b(um pra mim|um para mim)\b.*\b(outro|outra)\b/.test(modeText);
const comparisonSignal = /\b(ou|versus|vs|comparar|comparativo|qual compensa|quanto fica nos dois|diferenca|em cada um|para os dois)\b/.test(modeText);
const simulationMode = shouldUseMultiQuote
  ? (decision.simulation_mode ?? memory.simulation_mode ?? (bundleSignal && !comparisonSignal ? "bundle" : "comparison"))
  : "single";
const paymentRevision = decision.payment_revision ?? memory.payment_revision ?? inputData.payment_revision ?? null;

let body;
if (shouldUseMultiQuote) {
  body = {
    cardBrand,
    simulationMode,
    quotes: quoteItems.slice(0, 2).map((item, index) => ({
      slot: item.slot || index + 1,
      desiredDevice: { stockItemId: item.stockItemId },
      ...((simulationMode === "comparison" || index === 0) && tradeIn ? { tradeIn } : {}),
      ...((simulationMode === "comparison" || index === 0) && entries.length ? { entries } : {}),
    })),
  };
} else {
  body = { desiredDevice: { stockItemId }, cardBrand };
  if (tradeIn) body.tradeIn = tradeIn;
  if (entries.length) body.entries = entries;
}
if (paymentRevision) body.paymentRevision = paymentRevision;

const output = {
  ...inputData,
  stock_item_id: stockItemId,
  quote_items: quoteItems,
  simulation_mode: simulationMode,
  simulator_body: body
};

if (inputData.memory) {
  output.memory = {
    ...memory,
    stock_item_id: stockItemId,
    quote_items: quoteItems,
    simulation_mode: simulationMode,
    next_best_action: nextBestAction
  };
}

return [{ json: output }];
