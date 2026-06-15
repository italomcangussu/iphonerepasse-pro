// Surgical patch — "Edit Fields5" (Set node, workflow AO VIVO Cr4fPWe0prwS6XjI).
//
// Edit Fields5 mantém apenas os 87 campos atribuídos (sem includeOtherFields), e
// não havia atribuição para cash_entry_* -> os campos que o Memory 2 reconciler
// emite (cash_entry_asked/intent/amount) eram descartados antes do Code Routing
// Flags e do POST Lead_State. Adiciona as 3 atribuições lendo de $json (saída do
// Code in JavaScript2, que achata o memory reconciliado na raiz). DRY=1 não faz PUT.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const WORKFLOW_ID = "Cr4fPWe0prwS6XjI";
const N8N_BASE_URL = "https://iatende-n8n.ylgf5w.easypanel.host";
const DRY = process.env.DRY === "1";
const LOCAL_EXPORT = "output/n8n/ia-repasse-pro-v2-current.json";
const NODE_NAME = "Edit Fields5";

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

const NEW_FIELDS = [
  { name: "cash_entry_asked", value: "={{ $json.cash_entry_asked }}", type: "boolean" },
  { name: "cash_entry_intent", value: "={{ $json.cash_entry_intent }}", type: "boolean" },
  { name: "cash_entry_amount", value: "={{ $json.cash_entry_amount }}", type: "number" },
];

const workflow = DRY ? JSON.parse(fs.readFileSync(LOCAL_EXPORT, "utf8")) : await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const wasActive = workflow.active;
if (!DRY) {
  fs.mkdirSync("output/n8n/backups", { recursive: true });
  const bp = `output/n8n/backups/before-ef5-cashentry-${Date.now()}.json`;
  fs.writeFileSync(bp, JSON.stringify(workflow, null, 2));
  console.log("backup:", bp);
}
const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`${NODE_NAME} not found`);
const assigns = node.parameters?.assignments?.assignments;
if (!Array.isArray(assigns)) throw new Error("Edit Fields5 assignments not found");

let added = 0;
for (const f of NEW_FIELDS) {
  if (assigns.some((a) => a.name === f.name)) continue;
  assigns.push({ id: randomUUID(), name: f.name, value: f.value, type: f.type });
  added += 1;
}
console.log(`  ${added} campo(s) adicionado(s); total agora ${assigns.length}`);
for (const f of NEW_FIELDS) {
  if (!assigns.some((a) => a.name === f.name)) throw new Error(`sanity falhou: ${f.name}`);
}

if (DRY) {
  console.log(JSON.stringify({ dry: true, total: assigns.length }, null, 2));
  process.exit(0);
}
const body = { name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings: { executionOrder: workflow.settings?.executionOrder ?? "v1" } };
await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`, { method: "PUT", body: JSON.stringify(body) });
let activeAfter = false;
try { activeAfter = (await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}/activate`, { method: "POST" }))?.active ?? false; }
catch (e) { activeAfter = `ACTIVATE_FAILED: ${e.message}`; }
const verify = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const v = verify.nodes.find((n) => n.name === NODE_NAME);
const vAssigns = v.parameters.assignments.assignments;
console.log(JSON.stringify({ wasActive, activeAfter, finalActive: verify.active, total: vAssigns.length, applied: NEW_FIELDS.every((f) => vAssigns.some((a) => a.name === f.name)) }, null, 2));
