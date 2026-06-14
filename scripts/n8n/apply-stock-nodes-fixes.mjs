// Surgical patch — correções dos nós de estoque no workflow AO VIVO (Cr4fPWe0prwS6XjI):
//   #1 battery_health no select dos 2 nós HTTP de estoque (Node13 formata o campo,
//      mas ele nunca vinha na resposta → Bia 2 nunca informava saúde de bateria);
//   #2 filtro type=eq.iPhone nos 2 nós HTTP (iPad/Watch/Acessório contaminavam o
//      match de modelo — "iPad Pro 11" parseia como geração 11 tier pro);
//   #5 Inventory Lite: ambiguidade passa a contar MODELOS DISTINTOS na família,
//      não unidades (2 unidades do mesmo 15 Pro Max devem disparar o fluxo nearby);
//   #7 Node13: normalizeCapacity remove sufixo gb/tera ("128" == "128GB", "1 tera" == "1TB").
// Footgun guard: PUT cirúrgico + reativação explícita + verificação final.
import fs from "node:fs";
import path from "node:path";

const WORKFLOW_ID = "Cr4fPWe0prwS6XjI";
const N8N_BASE_URL = "https://iatende-n8n.ylgf5w.easypanel.host";

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

function getN8nApiKey() {
  return process.env.N8N_PUBLIC_API ?? readEnvFile(path.resolve(".env.local")).N8N_PUBLIC_API;
}

async function n8nFetch(pathname, options = {}) {
  const apiKey = getN8nApiKey();
  if (!apiKey) throw new Error("N8N_PUBLIC_API missing from environment or .env.local");
  const response = await fetch(`${N8N_BASE_URL}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-N8N-API-KEY": apiKey,
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`n8n API ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function replaceOnce(source, needle, replacement, label) {
  const idx = source.indexOf(needle);
  if (idx === -1) throw new Error(`needle not found: ${label}`);
  if (source.indexOf(needle, idx + needle.length) !== -1) throw new Error(`needle not unique: ${label}`);
  console.log(`  ok [${label}]`);
  return source.slice(0, idx) + replacement + source.slice(idx + needle.length);
}

// ---- #1 + #2: nós HTTP de estoque ----
const OLD_SELECT = "id,type,model,capacity,color,condition,status,sell_price,store_id,stores(id,name,city)";
const NEW_SELECT = "id,type,model,capacity,color,condition,status,sell_price,battery_health,store_id,stores(id,name,city)";
const HTTP_NODES = ["CRM Inventory Search", "CRM Inventory Precheck"];

function patchHttpNode(node) {
  const params = node.parameters.queryParameters.parameters;
  const select = params.find((p) => p.name === "select");
  if (!select) throw new Error(`${node.name}: select param not found`);
  if (select.value === OLD_SELECT) {
    select.value = NEW_SELECT;
    console.log(`  ok [${node.name} select + battery_health]`);
  } else if (select.value === NEW_SELECT) {
    console.log(`  skip [${node.name} select já patchado]`);
  } else {
    throw new Error(`${node.name}: select inesperado: ${select.value}`);
  }
  if (params.some((p) => p.name === "type")) {
    console.log(`  skip [${node.name} type filter já existe]`);
  } else {
    params.push({ name: "type", value: "eq.iPhone" });
    console.log(`  ok [${node.name} + type=eq.iPhone]`);
  }
}

// ---- #5: Inventory Lite — ambiguidade por modelos distintos ----
const LITE_OLD = `let model_match_status = "not_found";
if (exact.length > 0) model_match_status = "exact";
else if (byFamily.length > 1) model_match_status = "ambiguous";
else if (byFamily.length === 1) model_match_status = "family_only";`;
const LITE_NEW = `// Ambiguidade = modelos DISTINTOS na familia; 2+ unidades do mesmo modelo
// nao sao ambiguidade (devem disparar o fluxo de alternativa proxima).
const familyModelKeys = new Set(byFamily.map(item => {
  const parsed = parseIphoneModel(item.model);
  return parsed.generation + ":" + parsed.tier;
}));
let model_match_status = "not_found";
if (exact.length > 0) model_match_status = "exact";
else if (familyModelKeys.size > 1) model_match_status = "ambiguous";
else if (byFamily.length > 0) model_match_status = "family_only";`;

// ---- #7: Node13 — capacidade "128" == "128GB", "1 tera" == "1TB" ----
const CAP_OLD = `function normalizeCapacity(raw) {
  return normalizeText(raw).replace(/\\s/g, "");
}`;
const CAP_NEW = `function normalizeCapacity(raw) {
  // "128", "128GB", "128 gb" -> "128"; "1TB"/"1 tera" -> "1024"
  return normalizeText(raw)
    .replace(/\\s/g, "")
    .replace(/^(\\d+)(gb|gigas?|g)$/, "$1")
    .replace(/^1(tb|terabytes?|teras?|t)$/, "1024");
}`;

// ---- Run ----
const workflow = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const wasActive = workflow.active;
const backupPath = `/tmp/repasse-workflow-${WORKFLOW_ID}-${Date.now()}.json`;
fs.writeFileSync(backupPath, JSON.stringify(workflow, null, 2));

for (const name of HTTP_NODES) {
  const node = workflow.nodes.find((n) => n.name === name);
  if (!node) throw new Error(`${name} node not found`);
  patchHttpNode(node);
}

const lite = workflow.nodes.find((n) => n.name === "Code Build Inventory Lite");
if (!lite) throw new Error("Code Build Inventory Lite node not found");
if (lite.parameters.jsCode.includes("familyModelKeys")) {
  console.log("  skip [Lite ambiguidade já patchada]");
} else {
  lite.parameters.jsCode = replaceOnce(lite.parameters.jsCode, LITE_OLD, LITE_NEW, "Lite ambiguidade por modelos distintos");
  new Function("$", "$input", lite.parameters.jsCode);
}

const node13 = workflow.nodes.find((n) => n.name === "Node13-Code Filtrar Resultados Estoque");
if (!node13) throw new Error("Node13-Code Filtrar Resultados Estoque node not found");
if (node13.parameters.jsCode.includes("gigas?")) {
  console.log("  skip [Node13 capacidade já patchada]");
} else {
  node13.parameters.jsCode = replaceOnce(node13.parameters.jsCode, CAP_OLD, CAP_NEW, "Node13 normalizeCapacity gb/tera");
  new Function("$", "$input", node13.parameters.jsCode);
}

const body = {
  name: workflow.name,
  nodes: workflow.nodes,
  connections: workflow.connections,
  settings: { executionOrder: workflow.settings?.executionOrder ?? "v1" },
};

await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`, { method: "PUT", body: JSON.stringify(body) });

let activeAfter = false;
try {
  const activated = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}/activate`, { method: "POST" });
  activeAfter = activated?.active ?? false;
} catch (err) {
  activeAfter = `ACTIVATE_FAILED: ${err.message}`;
}

const verify = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const verifyParams = (name) => JSON.stringify(verify.nodes.find((n) => n.name === name)?.parameters ?? {});
console.log(JSON.stringify({
  workflowId: verify.id,
  wasActive,
  activeAfter,
  finalActive: verify.active,
  backupPath,
  searchPatched: verifyParams("CRM Inventory Search").includes("battery_health") && verifyParams("CRM Inventory Search").includes("eq.iPhone"),
  precheckPatched: verifyParams("CRM Inventory Precheck").includes("battery_health") && verifyParams("CRM Inventory Precheck").includes("eq.iPhone"),
  litePatched: verifyParams("Code Build Inventory Lite").includes("familyModelKeys"),
  node13Patched: verifyParams("Node13-Code Filtrar Resultados Estoque").includes("gigas?"),
}, null, 2));
