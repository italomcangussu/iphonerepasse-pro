// Surgical patch — "Node13-Code Filtrar Resultados Estoque" (workflow AO VIVO
// Cr4fPWe0prwS6XjI).
//
// Bug observado na execução 406072: o cliente pediu iPhone 16 Pro Max mas o
// best_item escolhido foi iPhone 17 Branco (Novo, score 45) em vez do 16 Pro Max
// Titânio Preto (Seminovo, score 30). Causa: o "Code Refresh Lead State Before
// Switch2" emite os campos de desejo (desired_model/capacity/color/condition,
// preferred_city, desired_devices) na RAIZ do json; o sub-objeto ctx.memory só
// carrega stock_*. O Node13 faz `const memory = ctx.memory ?? {}` e lê
// memory.desired_model -> vazio -> modelMatch retorna "not_requested" -> nenhum
// filtro por modelo -> best_item cai no item de maior score (Novo).
//
// Fix: backfill dos campos de comércio em `memory` a partir da raiz do ctx, para
// que TODAS as leituras memory.desired_* / memory.preferred_city /
// memory.desired_devices passem a enxergar o que o cliente pediu. O fallback de
// condição já existente (conditionPool = capacityPool quando não há item na
// condição pedida) mantém o 16 Pro Max Seminovo mesmo com desired_condition=Novo.
//
// DRY=1 lê o export local e grava /tmp/repasse-node13-backfill-dry.json sem PUT.
import fs from "node:fs";
import path from "node:path";

const WORKFLOW_ID = "Cr4fPWe0prwS6XjI";
const N8N_BASE_URL = "https://iatende-n8n.ylgf5w.easypanel.host";
const DRY = process.env.DRY === "1";
const LOCAL_EXPORT = "output/n8n/ia-repasse-pro-v2-current.json";
const NODE_NAME = "Node13-Code Filtrar Resultados Estoque";

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

const NEEDLE = `const ctx = $('Code Refresh Lead State Before Switch2').last().json;
const memory = ctx.memory ?? {};`;

const REPLACEMENT = `const ctx = $('Code Refresh Lead State Before Switch2').last().json;
// REPASSE NODE13 COMMERCE BACKFILL: o "Code Refresh Lead State Before Switch2"
// emite os campos de desejo/contexto na RAIZ; o sub-objeto ctx.memory só traz
// stock_*. Sem backfill, desired_model fica vazio -> modelMatch="not_requested"
// -> best_item ignora o modelo pedido e cai no item de maior score (Novo).
const __rawMemory = ctx.memory ?? {};
const memory = {
  ...__rawMemory,
  desired_model: __rawMemory.desired_model ?? ctx.desired_model ?? null,
  desired_capacity: __rawMemory.desired_capacity ?? ctx.desired_capacity ?? null,
  desired_color: __rawMemory.desired_color ?? ctx.desired_color ?? null,
  desired_condition: __rawMemory.desired_condition ?? ctx.desired_condition ?? null,
  desired_devices: __rawMemory.desired_devices ?? ctx.desired_devices ?? null,
  preferred_city: __rawMemory.preferred_city ?? ctx.preferred_city ?? null,
};`;

const workflow = DRY ? JSON.parse(fs.readFileSync(LOCAL_EXPORT, "utf8")) : await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const wasActive = workflow.active;
if (!DRY) {
  fs.mkdirSync("output/n8n/backups", { recursive: true });
  const bp = `output/n8n/backups/before-node13-backfill-${Date.now()}.json`;
  fs.writeFileSync(bp, JSON.stringify(workflow, null, 2));
  console.log("backup:", bp);
}
const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`${NODE_NAME} not found`);
let code = node.parameters.jsCode;
if (code.includes("REPASSE NODE13 COMMERCE BACKFILL")) {
  console.log("  skip [já aplicado]");
} else {
  if (code.split(NEEDLE).length - 1 !== 1) throw new Error("needle não-único");
  code = code.replace(NEEDLE, REPLACEMENT);
  node.parameters.jsCode = code;
  console.log("  ok [commerce backfill]");
}
new Function("$input", "$", "DateTime", "$helpers", "$jmespath", node.parameters.jsCode);
for (const m of ["REPASSE NODE13 COMMERCE BACKFILL", "ctx.desired_model", "preferred_city: __rawMemory.preferred_city"]) {
  if (!node.parameters.jsCode.includes(m)) throw new Error(`sanity falhou: ${m}`);
}

if (DRY) {
  fs.writeFileSync("/tmp/repasse-node13-backfill-dry.json", JSON.stringify(workflow, null, 2));
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
console.log(JSON.stringify({ wasActive, activeAfter, finalActive: verify.active, applied: v.parameters.jsCode.includes("REPASSE NODE13 COMMERCE BACKFILL") }, null, 2));
