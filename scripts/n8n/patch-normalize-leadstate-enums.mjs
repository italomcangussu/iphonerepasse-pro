// Surgical patch — normaliza valores canônicos do lead_state no node
// "Code in JavaScript2" (flatten memory→root, roda em TODO turno antes do
// Edit Fields5) do workflow AO VIVO (Cr4fPWe0prwS6XjI).
//
// Por quê: o LLM (Memory 1/2) emite valores fora do enum canônico —
// interest_type "troca" (canônico "trocar") e desired_condition "novo"/"seminovo"
// (canônico "Novo"/"Seminovo"). Isso quebra DUAS coisas:
//   1) PERSISTÊNCIA: o CHECK da tabela lead_state (lead_state_interest_type_check,
//      lead_state_desired_condition_check) rejeita → o upsert_lead_state (plpgsql)
//      dá raise → a transação inteira falha → NADA persiste → o GET volta
//      lead_state null → o Memory 2 recebe "LEAD_STATE ATUAL: null" e esquece
//      tudo a cada turno (perde trade-in etc).
//   2) ROTEAMENTO: isIphonePurchaseFlow() do Code Routing Flags exige
//      interest_type ∈ {"comprar","trocar"}; com "troca" fica false → nunca
//      chega a estoque/simulação.
// Normalizar aqui (chokepoint determinístico após o Memory 2) conserta ambos:
// Edit Fields5 → Code Routing Flags E Edit Fields5 → Code in JavaScript (POST).
//
// DRY=1 lê o export local e grava /tmp/repasse-normalize-enums-dry.json sem PUT.
import fs from "node:fs";
import path from "node:path";

const WORKFLOW_ID = "Cr4fPWe0prwS6XjI";
const N8N_BASE_URL = "https://iatende-n8n.ylgf5w.easypanel.host";
const DRY = process.env.DRY === "1";
const LOCAL_EXPORT = "output/n8n/ia-repasse-pro-v2-current.json";
const NODE_NAME = "Code in JavaScript2";

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
  const env = readEnvFile(path.resolve(".env.local"));
  return process.env.N8N_PUBLIC_API ?? process.env.N8N_API_KEY ?? env.N8N_PUBLIC_API ?? env.N8N_API_KEY;
}

async function n8nFetch(pathname, options = {}) {
  const apiKey = getN8nApiKey();
  if (!apiKey) throw new Error("N8N_API_KEY missing from environment or .env.local");
  const response = await fetch(`${N8N_BASE_URL}${pathname}`, {
    ...options,
    headers: { "Content-Type": "application/json", "X-N8N-API-KEY": apiKey, ...(options.headers ?? {}) },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`n8n API ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const NEEDLE = `for (const item of $input.all()) {
  // Pega tudo o que está dentro do objeto e transforma na raiz do JSON
  item.json = $input.first().json.memory;
}

return $input.all();`;

const REPLACEMENT = `// REPASSE LEAD_STATE ENUM NORMALIZE START
// Canônico: interest_type "trocar"; desired_condition "Novo"/"Seminovo".
// O LLM às vezes emite "troca"/"novo" — fora do enum → quebra o CHECK do
// upsert_lead_state (perde o estado inteiro) E o isIphonePurchaseFlow do roteamento.
function normInterestType(v) {
  if (v == null) return v;
  const s = String(v).trim().toLowerCase();
  if (s === 'troca') return 'trocar';
  if (s === 'compra') return 'comprar';
  if (s === 'venda') return 'vender';
  if (s === 'avaliacao' || s === 'avaliação') return 'avaliar';
  if (s === 'duvida' || s === 'dúvida') return 'duvida';
  return v;
}
function normCondition(v) {
  if (v == null) return v;
  const s = String(v).trim().toLowerCase();
  if (s === 'novo') return 'Novo';
  if (s === 'seminovo' || s === 'semi-novo' || s === 'semi novo') return 'Seminovo';
  return v;
}
for (const item of $input.all()) {
  // Pega tudo o que está dentro do objeto e transforma na raiz do JSON
  item.json = $input.first().json.memory;
  if (item.json && typeof item.json === 'object') {
    item.json.interest_type = normInterestType(item.json.interest_type);
    item.json.desired_condition = normCondition(item.json.desired_condition);
    if (Array.isArray(item.json.desired_devices)) {
      for (const d of item.json.desired_devices) {
        if (d && typeof d === 'object') d.desired_condition = normCondition(d.desired_condition);
      }
    }
  }
}
// REPASSE LEAD_STATE ENUM NORMALIZE END

return $input.all();`;

const workflow = DRY ? JSON.parse(fs.readFileSync(LOCAL_EXPORT, "utf8")) : await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const wasActive = workflow.active;

if (!DRY) {
  const backupDir = "output/n8n/backups";
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = `${backupDir}/before-normalize-enums-${Date.now()}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(workflow, null, 2));
  console.log("backup:", backupPath);
}

const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`${NODE_NAME} not found`);

let code = node.parameters.jsCode;
if (code.includes("REPASSE LEAD_STATE ENUM NORMALIZE START")) {
  console.log("  skip [normalização já aplicada]");
} else {
  const count = code.split(NEEDLE).length - 1;
  if (count !== 1) throw new Error(`needle não-único (${count}x) em ${NODE_NAME}`);
  node.parameters.jsCode = code.replace(NEEDLE, REPLACEMENT);
  console.log("  ok [normalização aplicada]");
}

// syntax assert
new Function("$input", "$", "DateTime", "$helpers", "$jmespath", node.parameters.jsCode);

// sanidade
for (const m of ["normInterestType", "normCondition", "'trocar'", "'Novo'"]) {
  if (!node.parameters.jsCode.includes(m)) throw new Error(`sanity falhou, faltou: ${m}`);
}

if (DRY) {
  fs.writeFileSync("/tmp/repasse-normalize-enums-dry.json", JSON.stringify(workflow, null, 2));
  console.log(JSON.stringify({ dry: true, wrote: "/tmp/repasse-normalize-enums-dry.json" }, null, 2));
  process.exit(0);
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
const vNode = verify.nodes.find((n) => n.name === NODE_NAME);
console.log(JSON.stringify({
  workflowId: verify.id,
  wasActive,
  activeAfter,
  finalActive: verify.active,
  normalizePresent: vNode?.parameters?.jsCode?.includes("REPASSE LEAD_STATE ENUM NORMALIZE START") ?? false,
}, null, 2));
