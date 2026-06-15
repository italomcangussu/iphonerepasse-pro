// Surgical patch — "Code in JavaScript" (POST Lead_State payload builder, workflow
// AO VIVO Cr4fPWe0prwS6XjI). Lista de campos do state é explícita e não incluía
// cash_entry_* -> a entrada nunca chegava ao upsert. Adiciona:
//   cash_entry_asked  (latch: uma vez true, permanece)
//   cash_entry_intent (cf: carry-forward, false é valor válido)
//   cash_entry_amount (cf: carry-forward numérico)
// Usa os helpers cf/latch já existentes (fallback para prev), então persiste mesmo
// se Edit Fields5 não carregar o campo. DRY=1 não faz PUT.
import fs from "node:fs";
import path from "node:path";

const WORKFLOW_ID = "Cr4fPWe0prwS6XjI";
const N8N_BASE_URL = "https://iatende-n8n.ylgf5w.easypanel.host";
const DRY = process.env.DRY === "1";
const LOCAL_EXPORT = "output/n8n/ia-repasse-pro-v2-current.json";
const NODE_NAME = "Code in JavaScript";

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

const NEEDLE = "          card_brand: input.card_brand,\n";
const REPLACEMENT = "          card_brand: input.card_brand,\n"
  + "          cash_entry_asked: latch(input.cash_entry_asked, 'cash_entry_asked'),\n"
  + "          cash_entry_intent: cf(input.cash_entry_intent, 'cash_entry_intent'),\n"
  + "          cash_entry_amount: cf(input.cash_entry_amount, 'cash_entry_amount'),\n";

const workflow = DRY ? JSON.parse(fs.readFileSync(LOCAL_EXPORT, "utf8")) : await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const wasActive = workflow.active;
if (!DRY) {
  fs.mkdirSync("output/n8n/backups", { recursive: true });
  const bp = `output/n8n/backups/before-post-leadstate-cashentry-${Date.now()}.json`;
  fs.writeFileSync(bp, JSON.stringify(workflow, null, 2));
  console.log("backup:", bp);
}
const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`${NODE_NAME} not found`);
let code = node.parameters.jsCode;
if (code.includes("cash_entry_asked: latch(input.cash_entry_asked")) {
  console.log("  skip [já aplicado]");
} else {
  if (code.split(NEEDLE).length - 1 !== 1) throw new Error("needle card_brand não-único");
  code = code.replace(NEEDLE, REPLACEMENT);
  node.parameters.jsCode = code;
  console.log("  ok [cash_entry no POST Lead_State]");
}
new Function("$input", "$", "DateTime", "$helpers", "$jmespath", node.parameters.jsCode);
for (const m of ["cash_entry_asked: latch", "cash_entry_intent: cf", "cash_entry_amount: cf"]) {
  if (!node.parameters.jsCode.includes(m)) throw new Error(`sanity falhou: ${m}`);
}

if (DRY) {
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
console.log(JSON.stringify({ wasActive, activeAfter, finalActive: verify.active, applied: v.parameters.jsCode.includes("cash_entry_asked: latch(input.cash_entry_asked") }, null, 2));
