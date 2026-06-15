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
// DRY=1 lê o export local e grava /tmp/repasse-montarbody-resolve-dry.json sem PUT.
import fs from "node:fs";
import path from "node:path";

const WORKFLOW_ID = "Cr4fPWe0prwS6XjI";
const N8N_BASE_URL = "https://iatende-n8n.ylgf5w.easypanel.host";
const DRY = process.env.DRY === "1";
const LOCAL_EXPORT = "output/n8n/ia-repasse-pro-v2-current.json";
const NODE_NAME = "Montar Body do Simulador";

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}
function getN8nApiKey() {
  const env = readEnvFile(path.resolve(".env.local"));
  return process.env.N8N_PUBLIC_API ?? process.env.N8N_API_KEY ?? env.N8N_PUBLIC_API ?? env.N8N_API_KEY;
}
async function n8nFetch(pathname, options = {}) {
  const apiKey = getN8nApiKey();
  if (!apiKey) throw new Error("N8N_API_KEY missing");
  const r = await fetch(`${N8N_BASE_URL}${pathname}`, { ...options, headers: { "Content-Type": "application/json", "X-N8N-API-KEY": apiKey, ...(options.headers ?? {}) } });
  const text = await r.text();
  if (!r.ok) throw new Error(`n8n API ${r.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

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

const workflow = DRY ? JSON.parse(fs.readFileSync(LOCAL_EXPORT, "utf8")) : await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const wasActive = workflow.active;
if (!DRY) {
  fs.mkdirSync("output/n8n/backups", { recursive: true });
  const bp = `output/n8n/backups/before-montarbody-resolve-${Date.now()}.json`;
  fs.writeFileSync(bp, JSON.stringify(workflow, null, 2));
  console.log("backup:", bp);
}
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

if (DRY) {
  fs.writeFileSync("/tmp/repasse-montarbody-resolve-dry.json", JSON.stringify(workflow, null, 2));
  console.log(JSON.stringify({ dry: true }, null, 2));
  process.exit(0);
}
const body = { name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings: { executionOrder: workflow.settings?.executionOrder ?? "v1" } };
await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`, { method: "PUT", body: JSON.stringify(body) });
let activeAfter = false;
try { activeAfter = (await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}/activate`, { method: "POST" }))?.active ?? false; }
catch (e) { activeAfter = `ACTIVATE_FAILED: ${e.message}`; }
const verify = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const v = verify.nodes.find((n) => n.name === NODE_NAME);
console.log(JSON.stringify({ wasActive, activeAfter, finalActive: verify.active, applied: v.parameters.jsCode.includes("REPASSE MONTAR BODY RESOLVE STOCK ID") }, null, 2));
