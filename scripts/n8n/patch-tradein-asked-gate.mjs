// Surgical patch — gate deterministico de PERGUNTA DE TRADE-IN (aparelho de
// entrada/troca) antes de simular, no workflow AO VIVO (Cr4fPWe0prwS6XjI).
//
// Causa-raiz (caso VD, 2026-06-20): a pergunta sobre aparelho de entrada/troca
// existia apenas como instrucao "soft" no prompt da Bia 1 (COLETA DO APARELHO
// ATUAL). O LLM a ignorou e foi para capacidade; assim que modelo+capacidade
// ficaram completos, o roteamento determinístico tratou trade-in como "resolvido"
// (tradeinEvaluationComplete retorna true quando has_tradein=false) e avancou para
// a entrada em dinheiro/simulacao — a pergunta de trade-in nunca foi feita.
//
// Fix: espelhar o mecanismo de cash_entry com um latch sticky tradein_asked e um
// gate needsTradeinQuestion que forca a Bia 1 a perguntar o aparelho atual assim
// que houver desired_model (antes de capacidade), e bloqueia simulacao/inventario
// ate o trade-in estar resolvido (perguntado OU declarado).
//
// Camadas tocadas neste patch (n8n): Code Routing Flags, Memory 2 - Reconciler,
// Code Parse Memory 2, Code in JavaScript (POST builder), Code in JavaScript2,
// Edit Fields5. As demais camadas (coluna/RPC e allowlist do edge crm-leads-api)
// vao por migration + deploy do edge function.
//
// DRY=1 lê o export local e grava /tmp/repasse-tradein-asked-dry.json sem PUT.
import fs from "node:fs";
import path from "node:path";

const WORKFLOW_ID = "Cr4fPWe0prwS6XjI";
const FALLBACK_ORIGIN = "https://iatende-n8n.ylgf5w.easypanel.host";
const DRY = process.env.DRY === "1";
const LOCAL_EXPORT = "output/n8n/ia-repasse-pro-v2-current.json";

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^["']|["']$/g, "");
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

// ---- helpers de edicao guardada ----
function exactlyOnce(haystack, needle, label) {
  const count = haystack.split(needle).length - 1;
  if (count !== 1) throw new Error(`[${label}] esperava 1 ocorrencia, achou ${count}`);
}
function replaceOnce(haystack, needle, replacement, label) {
  exactlyOnce(haystack, needle, label);
  return haystack.replace(needle, replacement);
}

function getNode(workflow, name) {
  const node = workflow.nodes.find((n) => n.name === name);
  if (!node) throw new Error(`nó não encontrado: ${name}`);
  return node;
}

function patchCodeNode(workflow, name, edits, idempotencyMarker) {
  const node = getNode(workflow, name);
  let code = node.parameters?.jsCode ?? "";
  if (idempotencyMarker && code.includes(idempotencyMarker)) {
    return { node: name, noop: true };
  }
  for (const [oldStr, newStr, label] of edits) {
    code = replaceOnce(code, oldStr, newStr, `${name}:${label}`);
  }
  // eslint-disable-next-line no-new-func
  new Function(code); // syntax-assert
  node.parameters.jsCode = code;
  return { node: name, applied: true };
}

// ===================== EDITS =====================

// ---- 1) Code Routing Flags ----
const RF_DEFS_OLD =
`const cashEntryResolved =
  cashEntryAsked === true ||
  state.cash_entry_intent != null ||
  state.cash_entry_amount != null;`;
const RF_DEFS_NEW = RF_DEFS_OLD + `

// Trade-in (aparelho de entrada/troca): a IA deve perguntar logo apos identificar
// o modelo desejado se o cliente tem um aparelho para dar de entrada/troca, ANTES
// de avancar para capacidade/estoque/simulacao. Espelha o gate de cash_entry.
// "Resolvido" quando ja perguntamos (tradein_asked, latch sticky no upsert) OU o
// cliente ja declarou ter trade-in (has_tradein) OU ja identificamos um modelo de
// entrada (tradein_model). has_tradein=false NAO basta: e o default e nao
// distingue "nunca perguntei" de "perguntei e nao tem".
const tradeinAsked = state.tradein_asked === true;
const tradeinResolved =
  tradeinAsked === true ||
  state.has_tradein === true ||
  (state.tradein_model !== null && state.tradein_model !== undefined && state.tradein_model !== '');`;

const RF_V2SIM_OLD =
`  repasseV2TradeinReadyForSimulation === true &&
  cashEntryOk === true &&
  cashEntryResolved === true &&`;
const RF_V2SIM_NEW =
`  repasseV2TradeinReadyForSimulation === true &&
  cashEntryOk === true &&
  cashEntryResolved === true &&
  tradeinResolved === true &&`;

const RF_SIMNOW_OLD =
`  tradeinOk === true &&
  cashEntryOk === true &&
  cashEntryResolved === true &&
  !!state.stock_item_id &&`;
const RF_SIMNOW_NEW =
`  tradeinOk === true &&
  cashEntryOk === true &&
  cashEntryResolved === true &&
  tradeinResolved === true &&
  !!state.stock_item_id &&`;

const RF_GATE_OLD = `const needsCashEntryQuestion = (`;
const RF_GATE_NEW =
`// Pergunta obrigatoria sobre o aparelho de entrada/troca ANTES de seguir. Dispara
// assim que o modelo desejado esta definido (antes de capacidade) — ou no fluxo
// multi-aparelho — para coletar o aparelho atual logo na abertura comercial. Nao
// reabre apos resolvido (tradein_asked latch / has_tradein / tradein_model).
const needsTradeinQuestion = (
  isIphonePurchaseFlow(state) &&
  postSimulationFlow !== true &&
  tradeinResolved !== true &&
  needsModelTier !== true &&
  (!!state.desired_model || repasseV2MultiQuoteReady === true)
);
state.must_ask_tradein = needsTradeinQuestion === true;
const needsCashEntryQuestion = (`;

const RF_BRANCH_OLD =
`  state.next_best_action = "confirmar se o modelo é normal, Pro ou Pro Max";
  state.attendance_owner_next = "ia";
} else if (needsPickupCity) {`;
const RF_BRANCH_NEW =
`  state.next_best_action = "confirmar se o modelo é normal, Pro ou Pro Max";
  state.attendance_owner_next = "ia";
} else if (needsTradeinQuestion) {
  setMainRoute("shouldUseBia1", "ask_tradein_before_sim");
  state.next_best_action = "perguntar se o cliente tem um aparelho para dar de entrada/troca (qual o aparelho atual) antes de avancar";
  state.attendance_owner_next = "ia";
  if (!state.missing_fields.includes("tradein_question")) state.missing_fields.push("tradein_question");
} else if (needsPickupCity) {`;

// ---- 4) Code in JavaScript (POST builder) ----
const POST_OLD = `          has_tradein: input.has_tradein,\n`;
const POST_NEW =
`          has_tradein: input.has_tradein,
          tradein_asked: latch(input.tradein_asked, 'tradein_asked') || input.has_tradein === true || prev?.has_tradein === true || isPresent(input.tradein_model) || isPresent(prev?.tradein_model),
`;

// ---- 5) Code in JavaScript2 (boolean coercion list) ----
const JS2_OLD = `  'faq_found', 'faq_transfer', 'cash_entry_asked', 'cash_entry_intent',`;
const JS2_NEW = `  'faq_found', 'faq_transfer', 'cash_entry_asked', 'cash_entry_intent', 'tradein_asked',`;

// ---- 3) Code Parse Memory 2 (sticky latch) ----
const PM2_OLD =
`if (__priorLeadState && __priorLeadState.cash_entry_asked === true) {
  memory.cash_entry_asked = true;
}`;
const PM2_NEW = PM2_OLD + `

// tradein_asked sticky latch (2026-06-20): espelho do cash_entry_asked. Uma vez
// que a IA perguntou sobre o aparelho de entrada/troca, mantenha asked=true para o
// gate determinístico (needsTradeinQuestion) nao reperguntar a cada turno. Tambem
// derive do "sim" do cliente: declarar trade-in (has_tradein) ou nomear um modelo
// de entrada implica que a pergunta foi feita.
if (
  (__priorLeadState && __priorLeadState.tradein_asked === true) ||
  memory.has_tradein === true ||
  (memory.tradein_model !== null && memory.tradein_model !== undefined && memory.tradein_model !== '') ||
  (__priorLeadState && __priorLeadState.has_tradein === true) ||
  (__priorLeadState && __priorLeadState.tradein_model)
) {
  memory.tradein_asked = true;
}`;

// ---- 2) Memory 2 - Reconciler (systemMessage) ----
const M2_LIST_OLD = `has_tradein, tradein_model, tradein_model_accepted,`;
const M2_LIST_NEW = `has_tradein, tradein_asked, tradein_model, tradein_model_accepted,`;

const M2_RULE_ANCHOR = `// ENTRADA EM DINHEIRO/PIX (antes de simular)\n`;
const M2_RULE_NEW =
`// PERGUNTA DE TRADE-IN (aparelho de entrada/troca)
- tradein_asked: marque true quando a ULTIMA mensagem do atendimento perguntou se o cliente tem um aparelho para dar de entrada/troca ou qual o aparelho atual dele (ex.: "qual o aparelho que voce tem hoje?", "tem algum iPhone pra dar de entrada?"). Tambem marque true se has_tradein=true ou ja houver tradein_model. Uma vez true, mantenha true; nunca volte para false.

// ENTRADA EM DINHEIRO/PIX (antes de simular)
`;

const M2_CARRY_OLD = `NUNCA omita: cash_entry_asked, cash_entry_intent, cash_entry_amount, card_brand, preferred_city.`;
const M2_CARRY_NEW = `NUNCA omita: tradein_asked, cash_entry_asked, cash_entry_intent, cash_entry_amount, card_brand, preferred_city.`;

// ===================== APPLY =====================
const workflow = DRY
  ? JSON.parse(fs.readFileSync(LOCAL_EXPORT, "utf8"))
  : await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const wasActive = workflow.active;
const report = [];

// 1) routing flags
report.push(patchCodeNode(workflow, "Code Routing Flags", [
  [RF_DEFS_OLD, RF_DEFS_NEW, "defs"],
  [RF_V2SIM_OLD, RF_V2SIM_NEW, "v2sim_gate"],
  [RF_SIMNOW_OLD, RF_SIMNOW_NEW, "simnow_gate"],
  [RF_GATE_OLD, RF_GATE_NEW, "needsTradeinQuestion"],
  [RF_BRANCH_OLD, RF_BRANCH_NEW, "branch"],
], "const tradeinResolved ="));

// 3) parse memory 2
report.push(patchCodeNode(workflow, "Code Parse Memory 2", [
  [PM2_OLD, PM2_NEW, "latch"],
], "memory.tradein_asked = true;"));

// 4) POST builder
report.push(patchCodeNode(workflow, "Code in JavaScript", [
  [POST_OLD, POST_NEW, "tradein_asked"],
], "tradein_asked: latch("));

// 5) js2 boolean coercion
report.push(patchCodeNode(workflow, "Code in JavaScript2", [
  [JS2_OLD, JS2_NEW, "bool_list"],
], "'tradein_asked',"));

// 2) memory 2 reconciler systemMessage
{
  const node = getNode(workflow, "Memory 2 - Reconciler");
  const opts = node.parameters.options ?? (node.parameters.options = {});
  let sm = opts.systemMessage ?? "";
  if (!sm.includes("tradein_asked: marque true")) {
    sm = replaceOnce(sm, M2_LIST_OLD, M2_LIST_NEW, "M2:list");
    sm = replaceOnce(sm, M2_RULE_ANCHOR, M2_RULE_NEW, "M2:rule");
    sm = replaceOnce(sm, M2_CARRY_OLD, M2_CARRY_NEW, "M2:carry");
    opts.systemMessage = sm;
    report.push({ node: "Memory 2 - Reconciler", applied: true });
  } else {
    report.push({ node: "Memory 2 - Reconciler", noop: true });
  }
}

// 6) Edit Fields5 — insere assignment tradein_asked apos has_tradein
{
  const node = getNode(workflow, "Edit Fields5");
  const arr = node.parameters?.assignments?.assignments;
  if (!Array.isArray(arr)) throw new Error("Edit Fields5 assignments não é array");
  if (arr.some((a) => a.name === "tradein_asked")) {
    report.push({ node: "Edit Fields5", noop: true });
  } else {
    const idx = arr.findIndex((a) => a.name === "has_tradein");
    if (idx < 0) throw new Error("assignment has_tradein não encontrado em Edit Fields5");
    arr.splice(idx + 1, 0, {
      id: "ctx-tradein-asked",
      name: "tradein_asked",
      value: "={{ $json.tradein_asked }}",
      type: "boolean",
    });
    report.push({ node: "Edit Fields5", applied: true });
  }
}

console.log("EDITS:", JSON.stringify(report, null, 2));

if (DRY) {
  fs.writeFileSync("/tmp/repasse-tradein-asked-dry.json", JSON.stringify(workflow, null, 2));
  console.log(JSON.stringify({ dry: true }, null, 2));
  process.exit(0);
}

const backupDir = "output/n8n/backups";
fs.mkdirSync(backupDir, { recursive: true });
const pre = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const backupPath = `${backupDir}/before-tradein-asked-gate-${Date.now()}.json`;
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
const rf = verify.nodes.find((n) => n.name === "Code Routing Flags")?.parameters?.jsCode ?? "";
console.log(JSON.stringify({
  workflowId: verify.id, wasActive, activeAfter, finalActive: verify.active,
  gateLive: rf.includes("needsTradeinQuestion"),
}, null, 2));
