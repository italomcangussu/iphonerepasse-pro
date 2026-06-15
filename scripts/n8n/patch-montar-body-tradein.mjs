// Surgical patch — "Montar Body do Simulador" no workflow AO VIVO (Cr4fPWe0prwS6XjI).
//
// Bug: o trade-in some do corpo do simulador (tradeInLabel "", base 0) mesmo com
// has_tradein=true no estado. Causa: o node faz `const memory = inputData.memory
// ?? inputData;` e o inputData.memory vindo do "Code Refresh Lead State Before
// Switch2" é um objeto PARCIAL (só stock_*), sem os campos de trade-in → memory.
// has_tradein vem undefined → trade-in descartado. Além disso a condição
// `tradein_disqualified === false` derruba quando o valor é null/undefined.
//
// Fix: ler has_tradein/tradein_* de várias fontes (memory, raiz inputData e o
// lead_state persistido em inputData.lead_state) e usar `!== true` para o
// disqualified. Mesmo fallback para a entrada em dinheiro (cash_entry_amount).
//
// DRY=1 lê o export local e grava /tmp/repasse-montarbody-dry.json sem PUT.
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

const TRADEIN_NEEDLE = `let tradeIn = null;
if (memory.has_tradein &&
    memory.tradein_model_accepted !== false &&
    memory.tradein_disqualified === false &&
    memory.tradein_model) {
  tradeIn = {
    model:    memory.tradein_model,
    capacity: memory.tradein_capacity ?? "",
    color:    memory.tradein_color ?? ""
  };
}`;

const TRADEIN_REPLACEMENT = `// REPASSE MONTAR BODY TRADEIN SOURCES: o inputData.memory pode ser parcial
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
}`;

const CASH_NEEDLE = `const cashEntryAmount = toPositiveNumber(memory.cash_entry_amount ?? inputData.cash_entry_amount);`;
const CASH_REPLACEMENT = `const cashEntryAmount = toPositiveNumber(memory.cash_entry_amount ?? inputData.cash_entry_amount ?? (inputData.lead_state ?? {}).cash_entry_amount);`;

const workflow = DRY ? JSON.parse(fs.readFileSync(LOCAL_EXPORT, "utf8")) : await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const wasActive = workflow.active;
if (!DRY) {
  fs.mkdirSync("output/n8n/backups", { recursive: true });
  const bp = `output/n8n/backups/before-montarbody-tradein-${Date.now()}.json`;
  fs.writeFileSync(bp, JSON.stringify(workflow, null, 2));
  console.log("backup:", bp);
}
const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`${NODE_NAME} not found`);
let code = node.parameters.jsCode;
if (code.includes("REPASSE MONTAR BODY TRADEIN SOURCES")) {
  console.log("  skip [já aplicado]");
} else {
  if (code.split(TRADEIN_NEEDLE).length - 1 !== 1) throw new Error("needle trade-in não-único");
  code = code.replace(TRADEIN_NEEDLE, TRADEIN_REPLACEMENT);
  if (code.split(CASH_NEEDLE).length - 1 !== 1) throw new Error("needle cash não-único");
  code = code.replace(CASH_NEEDLE, CASH_REPLACEMENT);
  node.parameters.jsCode = code;
  console.log("  ok [trade-in + cash sources]");
}
new Function("$input", "$", "DateTime", "$helpers", "$jmespath", node.parameters.jsCode);
for (const m of ["REPASSE MONTAR BODY TRADEIN SOURCES", "tiDisq !== true", "tiLeadState.has_tradein"]) {
  if (!node.parameters.jsCode.includes(m)) throw new Error(`sanity falhou: ${m}`);
}

if (DRY) {
  fs.writeFileSync("/tmp/repasse-montarbody-dry.json", JSON.stringify(workflow, null, 2));
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
console.log(JSON.stringify({ wasActive, activeAfter, finalActive: verify.active, applied: v.parameters.jsCode.includes("REPASSE MONTAR BODY TRADEIN SOURCES") }, null, 2));
