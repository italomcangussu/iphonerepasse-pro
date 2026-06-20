// Surgical patch — restaura o BACK-FILL determinístico (carry-forward) no
// "Code Parse Memory 2" do workflow AO VIVO (Cr4fPWe0prwS6XjI).
//
// Por quê (raiz do stall + re-ask de entrada + avaliação sumindo):
//  Desde 2026-06-14 o "Memory 2 - Reconciler" (flash-lite, LLM) é dono do
//  lead_state e o nó "Parse Memory" (que tinha o preserve() determinístico) foi
//  DELETADO. Resultado: quando o reconciler DROPA um campo sticky (retorna null
//  ou omite) num turno, o turno ENXERGA estado vazio — ex.: desired_model=null ->
//  context_ready=false -> Bia 1 trava com "vou verificar e já volto". O DB até
//  preserva via coalesce na RPC, mas a DECISÃO do turno usa o `memory` do turno.
//
//  Fix: para uma whitelist de campos carry-forward, se o reconciler dropou
//  (null/undefined) mas o `prev` (lead_state persistido) tem valor, mantém o
//  prev. NUNCA bloqueia mudança real (uma troca é um SET para valor novo, não
//  um null) e espelha o coalesce-preserve da RPC, alinhando turno e DB.
//
//  Roda DEPOIS dos preserves cirúrgicos existentes (cash_entry_asked latch,
//  interest_type normalize, trade-in reclass) para não interferir neles —
//  cash_entry_asked fica de fora (já tem latch próprio prior-OR-current).
//
// DRY=1 lê o export local e grava /tmp/repasse-carryforward-dry.json sem PUT.
import fs from "node:fs";
import path from "node:path";

const WORKFLOW_ID = "Cr4fPWe0prwS6XjI";
const FALLBACK_ORIGIN = "https://iatende-n8n.ylgf5w.easypanel.host";
const DRY = process.env.DRY === "1";
const LOCAL_EXPORT = "output/n8n/ia-repasse-pro-v2-current.json";
const NODE = "Code Parse Memory 2";

const ANCHOR = `return [{
  json: {
    ...$json,
    last_message_content: readLastMessageContent(),
    lead_state: readLeadState(),
    memory,`;

const BACKFILL = `// Carry-forward determinístico (2026-06-20): o flash-lite "Memory 2 - Reconciler"
// intermitentemente DROPA campos sticky (null/omitido) num turno, fazendo o turno
// enxergar estado vazio (ex.: desired_model null -> context_ready false -> Bia 1
// trava com "vou verificar e já volto"). O preserve() determinístico foi removido
// junto com o "Parse Memory" (2026-06-14). Restaurado aqui: se o reconciler dropou
// (null/undefined) mas o prev tem valor, mantém o prev. Nunca bloqueia troca real
// (troca é SET para valor novo, não null) e espelha o coalesce-preserve da RPC.
// cash_entry_asked fica de fora (tem latch próprio prior-OR-current acima).
const __CARRY_FORWARD = [
  'desired_model', 'desired_capacity', 'desired_color', 'desired_condition',
  'has_tradein', 'tradein_model', 'tradein_capacity', 'tradein_color',
  'tradein_battery_pct', 'tradein_battery_suspect', 'tradein_scratches',
  'tradein_liquid_contact', 'tradein_side_marks', 'tradein_parts_swapped',
  'tradein_has_box_cable', 'tradein_apple_warranty', 'tradein_warranty_until',
  'tradein_disqualified', 'tradein_model_accepted', 'tradein_rejected_reason',
  'cash_entry_intent', 'cash_entry_amount',
  'simulation_done', 'simulation_count', 'last_simulation_total',
  'secondary_color_simulation',
  'preferred_city', 'stock_city', 'stock_item_id',
  'proposal_accepted', 'reservation_intent', 'pix_data_sent', 'pix_paid', 'pix_amount',
  'pickup_datetime', 'pickup_city',
  'cadastro_solicitado', 'cadastro_nome_completo', 'cadastro_data_nascimento',
  'cadastro_cpf', 'cadastro_contato', 'cadastro_completo',
];
if (__priorLeadState && typeof __priorLeadState === 'object') {
  for (const __k of __CARRY_FORWARD) {
    const __cur = memory[__k];
    if (__cur === null || __cur === undefined) {
      const __prevVal = __priorLeadState[__k];
      if (__prevVal !== null && __prevVal !== undefined) memory[__k] = __prevVal;
    }
  }
}

`;

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

// --- pré-condições / idempotência ---
if (code.includes("__CARRY_FORWARD")) {
  console.log(JSON.stringify({ noop: true, reason: "carry-forward já presente" }, null, 2));
  process.exit(0);
}
if (!code.includes(ANCHOR)) throw new Error("anchor do return não encontrado (workflow mudou?)");
if ((code.split(ANCHOR).length - 1) !== 1) throw new Error("anchor deveria aparecer 1x");
if (!code.includes("const __priorLeadState = readLeadState();")) {
  throw new Error("__priorLeadState não definido no nó — back-fill não teria a fonte prev");
}

const next = code.replace(ANCHOR, BACKFILL + ANCHOR);
// eslint-disable-next-line no-new-func
new Function(next); // syntax-assert (não executa)

// --- pós-condições ---
if (!next.includes("__CARRY_FORWARD")) throw new Error("back-fill não aplicado");
if ((next.split("return [{").length - 1) !== 1) throw new Error("return duplicado após edit");
node.parameters.jsCode = next;

if (DRY) {
  fs.writeFileSync("/tmp/repasse-carryforward-dry.json", JSON.stringify(workflow, null, 2));
  console.log(JSON.stringify({ dry: true, bytesAdded: next.length - code.length }, null, 2));
  process.exit(0);
}

const backupDir = "output/n8n/backups";
fs.mkdirSync(backupDir, { recursive: true });
const pre = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const backupPath = `${backupDir}/before-parse-memory2-carryforward-${Date.now()}.json`;
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
  carryForwardLive: vCode.includes("__CARRY_FORWARD"),
}, null, 2));
