// Surgical patch — "Code Parse Re-simulacao Bia 2 ESTOQUE" (workflow AO VIVO
// Cr4fPWe0prwS6XjI).
//
// Bug observado na execução 406079 (caminho de RE-SIMULAÇÃO): o Montar Body
// re-simula SEM o aparelho de entrada (tradeInBaseValue:0). Causa: a "Bia 2
// ESTOQUE" é um agent node (@n8n/n8n-nodes-langchain.agent) que dropa todo o
// contexto upstream e emite só { output }. O "Code Parse Re-simulacao Bia 2
// ESTOQUE" só reanexa $('Edit Fields10') (que não carrega trade-in), então a
// saída chega ao Montar Body com has_tradein/tradein_* ausentes -> trade-in
// some da simulação.
//
// Fix: reanexar trade-in/entrada/cartão/desejo a partir do estado persistido em
// $('Code Refresh Lead State Before Switch2') (que roda no mesmo fluxo e tem
// has_tradein/tradein_model/... na raiz). O Montar Body já lê esses campos de
// inputData.* — basta reanexá-los na raiz da saída do parse.
//
// DRY=1 lê o export local e grava /tmp/repasse-resim-reattach-dry.json sem PUT.
import fs from "node:fs";
import path from "node:path";

const WORKFLOW_ID = "Cr4fPWe0prwS6XjI";
const N8N_BASE_URL = "https://iatende-n8n.ylgf5w.easypanel.host";
const DRY = process.env.DRY === "1";
const LOCAL_EXPORT = "output/n8n/ia-repasse-pro-v2-current.json";
const NODE_NAME = "Code Parse Re-simulacao Bia 2 ESTOQUE";

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

const NEEDLE = `return [
  {
    json: {
      ...sourceContext,
      ...inputData,
      router: decision,
      rerun_simulation_requested: true
    }
  }
];`;

const REPLACEMENT = `// REPASSE RESIM REATTACH TRADEIN: a "Bia 2 ESTOQUE" (agent) dropa o contexto e
// este parse só carrega Edit Fields10 (sem trade-in). Sem reanexar, o Montar
// Body re-simula SEM o aparelho de entrada. Reanexa trade-in/entrada/cartão/
// desejo a partir do estado persistido em "Code Refresh Lead State Before Switch2".
let leadCtx = {};
try { leadCtx = $('Code Refresh Lead State Before Switch2').last().json ?? {}; } catch (error) { leadCtx = {}; }
const reattach = {};
for (const k of [
  'has_tradein', 'tradein_model', 'tradein_model_accepted', 'tradein_disqualified',
  'tradein_capacity', 'tradein_color', 'tradein_battery_pct',
  'cash_entry_amount', 'card_brand',
  'desired_model', 'desired_capacity', 'desired_color', 'desired_condition'
]) {
  const v = leadCtx[k] ?? leadCtx.memory?.[k];
  if (v !== undefined && v !== null) reattach[k] = v;
}

return [
  {
    json: {
      ...sourceContext,
      ...inputData,
      ...reattach,
      router: decision,
      rerun_simulation_requested: true
    }
  }
];`;

const workflow = DRY ? JSON.parse(fs.readFileSync(LOCAL_EXPORT, "utf8")) : await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const wasActive = workflow.active;
if (!DRY) {
  fs.mkdirSync("output/n8n/backups", { recursive: true });
  const bp = `output/n8n/backups/before-resim-reattach-${Date.now()}.json`;
  fs.writeFileSync(bp, JSON.stringify(workflow, null, 2));
  console.log("backup:", bp);
}
const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`${NODE_NAME} not found`);
let code = node.parameters.jsCode;
if (code.includes("REPASSE RESIM REATTACH TRADEIN")) {
  console.log("  skip [já aplicado]");
} else {
  if (code.split(NEEDLE).length - 1 !== 1) throw new Error("needle não-único");
  code = code.replace(NEEDLE, REPLACEMENT);
  node.parameters.jsCode = code;
  console.log("  ok [reattach trade-in na re-simulação]");
}
new Function("$input", "$", "DateTime", "$helpers", "$jmespath", node.parameters.jsCode);
for (const m of ["REPASSE RESIM REATTACH TRADEIN", "Code Refresh Lead State Before Switch2", "...reattach"]) {
  if (!node.parameters.jsCode.includes(m)) throw new Error(`sanity falhou: ${m}`);
}

if (DRY) {
  fs.writeFileSync("/tmp/repasse-resim-reattach-dry.json", JSON.stringify(workflow, null, 2));
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
console.log(JSON.stringify({ wasActive, activeAfter, finalActive: verify.active, applied: v.parameters.jsCode.includes("REPASSE RESIM REATTACH TRADEIN") }, null, 2));
