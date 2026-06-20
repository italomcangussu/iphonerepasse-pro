// Surgical patch — "apresentar variantes reais do estoque antes de simular"
// no workflow AO VIVO (Cr4fPWe0prwS6XjI). Duas partes:
//
//  PARTE 1 (dados) — "Node13-Code Filtrar Resultados Estoque": inclui
//    battery_health + battery_health_label em cada item de `available_options`
//    (hoje só best_item/available_items carregam bateria via formatItem). Assim o
//    agente consegue diferenciar variantes seminovas pela saúde de bateria.
//
//  PARTE 2 (prompt) — "Bia 2 ESTOQUE": nova regra. Quando for simular e o cliente
//    ainda não fixou a variante, NÃO perguntar "tem cor de preferência?" no aberto;
//    apresentar as variantes REAIS do estoque (armazenamento se não escolhido, cor,
//    e % de bateria só p/ Seminovo) e perguntar qual simular. 1 variante = simula direto.
//
// Idempotente (pula alvo já aplicado). DRY=1 lê o export local, sem PUT.
import fs from "node:fs";
import path from "node:path";

const WORKFLOW_ID = "Cr4fPWe0prwS6XjI";
const FALLBACK_ORIGIN = "https://iatende-n8n.ylgf5w.easypanel.host";
const DRY = process.env.DRY === "1";
const LOCAL_EXPORT = "output/n8n/ia-repasse-pro-v2-current.json";

// ---- PARTE 1 ----
const NODE13 = "Node13-Code Filtrar Resultados Estoque";
const P1_OLD = `    if (seen.has(key)) return;
    seen.add(key);
    available_options.push({
      color: item.color,
      capacity: item.capacity,
      condition: item.condition,
      sell_price: item.sell_price,
      status: item.status,
      city: item.stores?.city ?? null,
      score: optionScore(item),
    });`;
const P1_NEW = `    if (seen.has(key)) return;
    seen.add(key);
    const optBattery = formatBatteryHealth(item);
    available_options.push({
      color: item.color,
      capacity: item.capacity,
      condition: item.condition,
      sell_price: item.sell_price,
      status: item.status,
      battery_health: optBattery,
      battery_health_label: optBattery !== null ? String(optBattery) + "%" : null,
      city: item.stores?.city ?? null,
      score: optionScore(item),
    });`;
const P1_MARK = "battery_health: optBattery,"; // marcador de idempotência

// ---- PARTE 2 ----
const BIA2 = "Bia 2 ESTOQUE";
const P2_OLD = "campos de estoque.\n\n\nSEM POLÍTICA DE COR / SEM DESCONTO À VISTA";
const P2_RULE = `APRESENTAR VARIANTES REAIS ANTES DE SIMULAR

Quando estiver pronto pra simular e o cliente ainda não fixou a variante, NUNCA pergunte "tem cor de preferência?" no aberto. Apresente as variantes REAIS do estoque (de available_options/available_items) e pergunte qual ele quer que eu simule, diferenciando por: armazenamento (só se o cliente ainda NÃO escolheu), cor, e % de bateria (battery_health_label, apenas Seminovo). Se só houver 1 variante, simule direto sem perguntar. Só liste o que existe nesses campos — nunca invente cor, armazenamento ou bateria.`;
const P2_NEW = `campos de estoque.\n\n\n${P2_RULE}\n\n\nSEM POLÍTICA DE COR / SEM DESCONTO À VISTA`;
const P2_MARK = "APRESENTAR VARIANTES REAIS ANTES DE SIMULAR"; // marcador de idempotência

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

const node13 = workflow.nodes.find((n) => n.name === NODE13);
const bia2 = workflow.nodes.find((n) => n.name === BIA2);
if (!node13) throw new Error(`${NODE13} não encontrado`);
if (!bia2) throw new Error(`${BIA2} não encontrado`);

const applied = [];
const skipped = [];

// PARTE 1
const code = node13.parameters.jsCode ?? "";
if (code.includes(P1_MARK)) {
  skipped.push("parte1");
} else {
  if (!code.includes(P1_OLD)) throw new Error("PARTE 1: bloco available_options.push antigo não encontrado (workflow mudou?)");
  if ((code.split(P1_OLD).length - 1) !== 1) throw new Error("PARTE 1: bloco antigo deveria aparecer 1x");
  if (!code.includes("function formatBatteryHealth")) throw new Error("PARTE 1: formatBatteryHealth ausente — não posso referenciar");
  const next = code.replace(P1_OLD, P1_NEW);
  // eslint-disable-next-line no-new-func
  new Function(next); // syntax-assert
  node13.parameters.jsCode = next;
  applied.push("parte1");
}

// PARTE 2
const sm = bia2.parameters.options.systemMessage ?? "";
if (sm.includes(P2_MARK)) {
  skipped.push("parte2");
} else {
  if (!sm.includes(P2_OLD)) throw new Error("PARTE 2: anchor 'campos de estoque … SEM POLÍTICA DE COR' não encontrado");
  if ((sm.split(P2_OLD).length - 1) !== 1) throw new Error("PARTE 2: anchor deveria aparecer 1x");
  bia2.parameters.options.systemMessage = sm.replace(P2_OLD, P2_NEW);
  applied.push("parte2");
}

if (applied.length === 0) {
  console.log(JSON.stringify({ noop: true, skipped }, null, 2));
  process.exit(0);
}

if (DRY) {
  fs.writeFileSync("/tmp/repasse-present-variants-dry.json", JSON.stringify(workflow, null, 2));
  console.log(JSON.stringify({ dry: true, applied, skipped }, null, 2));
  process.exit(0);
}

const backupDir = "output/n8n/backups";
fs.mkdirSync(backupDir, { recursive: true });
const pre = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const backupPath = `${backupDir}/before-present-stock-variants-${Date.now()}.json`;
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
const vCode = verify.nodes.find((n) => n.name === NODE13)?.parameters?.jsCode ?? "";
const vSm = verify.nodes.find((n) => n.name === BIA2)?.parameters?.options?.systemMessage ?? "";
console.log(JSON.stringify({
  workflowId: verify.id, wasActive, activeAfter, finalActive: verify.active,
  applied, skipped,
  part1Live: vCode.includes(P1_MARK),
  part2Live: vSm.includes(P2_MARK),
}, null, 2));
