// Surgical patch — corrige a PERSISTÊNCIA de cash_entry_asked no builder do POST
// ("Code in JavaScript") do workflow AO VIVO (Cr4fPWe0prwS6XjI).
//
// Causa-raiz (verificada por trace de execução):
//  Code in JavaScript2=true -> Edit Fields5=true -> Code in JavaScript (builder do
//  POST) grava cash_entry_asked=FALSE -> POST envia false -> DB fica false. A RPC
//  upsert_lead_state JÁ é latch one-way (cash_entry_asked = lead_state.X OR excluded),
//  então o problema NÃO é o DB: é que o `true` nunca chega a ser POSTado. No turno
//  do declínio o cliente respondeu (cash_entry_intent=false PRESENTE), mas o
//  latch(input.cash_entry_asked) não derivava disso e o asked não estabilizava ->
//  a IA re-pergunta a entrada a cada turno.
//
// Fix (regression-safe, alinhado à diretriz do dono): derivar cash_entry_asked
// também da PRESENÇA de intent/amount de entrada (sinais de Pix/dinheiro) — se há
// intenção/valor de entrada, a pergunta necessariamente foi feita. NUNCA referencia
// trade-in: "aparelho de entrada" é tradein_* e não toca cash_entry_asked.
//
// DRY=1 lê o export local e grava /tmp/repasse-cash-asked-dry.json sem PUT.
import fs from "node:fs";
import path from "node:path";

const WORKFLOW_ID = "Cr4fPWe0prwS6XjI";
const FALLBACK_ORIGIN = "https://iatende-n8n.ylgf5w.easypanel.host";
const DRY = process.env.DRY === "1";
const LOCAL_EXPORT = "output/n8n/ia-repasse-pro-v2-current.json";
const NODE = "Code in JavaScript";

const OLD = "          cash_entry_asked: latch(input.cash_entry_asked, 'cash_entry_asked'),";
// Deriva de intent/amount (atual e prev). isPresent(false) === true (intent=false
// = cliente JÁ respondeu que não quer entrada -> pergunta foi feita).
const NEW = "          cash_entry_asked: latch(input.cash_entry_asked, 'cash_entry_asked') || isPresent(input.cash_entry_intent) || isPresent(prev?.cash_entry_intent) || isPresent(input.cash_entry_amount) || isPresent(prev?.cash_entry_amount),";

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
const fileEnv = readEnvFile(path.resolve(".env.local"));
const getN8nApiKey = () => process.env.N8N_API_KEY ?? process.env.N8N_PUBLIC_API ?? fileEnv.N8N_API_KEY ?? fileEnv.N8N_PUBLIC_API;
const getBaseUrl = () => (process.env.N8N_BASE_URL ?? fileEnv.N8N_BASE_URL ?? FALLBACK_ORIGIN).replace(/\/+$/, "");

async function n8nFetch(pathname, options = {}) {
  const apiKey = getN8nApiKey();
  if (!apiKey) throw new Error("N8N_API_KEY missing from environment or .env.local");
  const response = await fetch(`${getBaseUrl()}${pathname}`, {
    ...options,
    headers: { "Content-Type": "application/json", "X-N8N-API-KEY": apiKey, ...(options.headers ?? {}) },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`n8n API ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const workflow = DRY
  ? JSON.parse(fs.readFileSync(LOCAL_EXPORT, "utf8"))
  : await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const wasActive = workflow.active;

const node = workflow.nodes.find((n) => n.name === NODE);
if (!node) throw new Error(`${NODE} não encontrado`);
const code = node.parameters?.jsCode ?? "";

if (code.includes("isPresent(input.cash_entry_intent)")) {
  console.log(JSON.stringify({ noop: true, reason: "derive já presente" }, null, 2));
  process.exit(0);
}
if (!code.includes(OLD)) throw new Error("linha cash_entry_asked antiga não encontrada (workflow mudou?)");
if ((code.split(OLD).length - 1) !== 1) throw new Error("linha antiga deveria aparecer 1x");
if (!code.includes("const isPresent =")) throw new Error("isPresent não definido no nó");
if (!code.includes("const latch =")) throw new Error("latch não definido no nó");

const next = code.replace(OLD, NEW);
// eslint-disable-next-line no-new-func
new Function(next); // syntax-assert
node.parameters.jsCode = next;

if (DRY) {
  fs.writeFileSync("/tmp/repasse-cash-asked-dry.json", JSON.stringify(workflow, null, 2));
  console.log(JSON.stringify({ dry: true, applied: true }, null, 2));
  process.exit(0);
}

const backupDir = "output/n8n/backups";
fs.mkdirSync(backupDir, { recursive: true });
const pre = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const backupPath = `${backupDir}/before-cash-entry-asked-derive-${Date.now()}.json`;
fs.writeFileSync(backupPath, JSON.stringify(pre, null, 2));
console.log("backup:", backupPath);

const settings = { executionOrder: workflow.settings?.executionOrder ?? "v1" };
const body = { name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings };
await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`, { method: "PUT", body: JSON.stringify(body) });

let activeAfter = false;
try {
  const activated = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}/activate`, { method: "POST" });
  activeAfter = activated?.active ?? false;
} catch (err) {
  activeAfter = `ACTIVATE_FAILED: ${err.message}`;
}

const verify = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const vCode = verify.nodes.find((n) => n.name === NODE)?.parameters?.jsCode ?? "";
console.log(JSON.stringify({
  workflowId: verify.id, wasActive, activeAfter, finalActive: verify.active,
  deriveLive: vCode.includes("isPresent(input.cash_entry_intent)"),
}, null, 2));
