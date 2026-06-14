// Surgical patch — error handling do simulador no workflow AO VIVO (Cr4fPWe0prwS6XjI).
// Fixes #3/#4 do review dos nós de estoque/simulador:
//   #3 nó "Simulador" (HTTP): neverError + onError=continueRegularOutput. O edge
//      function responde 4xx/5xx em casos reais (bandeira inválida, valor negativo,
//      quotes vazios) e hoje isso MATA a execução antes do Parse Simulator — o
//      branch de erro (transferência com mensagem) era código morto e o cliente
//      ficava sem resposta.
//   #4 "Montar Body do Simulador": o throw quando falta stock_item_id vira retorno
//      gracioso com body sentinela → simulador responde 400 controlado →
//      Parse Simulator marca simulation_error → Bia transfere com mensagem.
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

// ---- #4: Montar Body — throw vira degradação graciosa ----
const THROW_OLD = `if (!stockItemId) {
  throw new Error("[Montar Body do Simulador] stock_item_id obrigatorio antes de chamar simulador. Consulte estoque e selecione um item valido antes de simular.");
}`;
const THROW_NEW = `if (!stockItemId) {
  // Sem item de estoque valido: NAO derruba a execucao (cliente ficaria sem
  // resposta). Body sentinela faz o simulador responder 400 controlado
  // (success:false) e o Parse Simulator marca simulation_error -> a Bia
  // transfere para o especialista com mensagem.
  return [{
    json: {
      ...inputData,
      stock_item_id: null,
      simulator_body: { missingStockItem: true },
      simulation_skipped_reason: "missing_stock_item",
    },
  }];
}`;

// ---- Run ----
const workflow = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const wasActive = workflow.active;
const backupPath = `/tmp/repasse-workflow-${WORKFLOW_ID}-${Date.now()}.json`;
fs.writeFileSync(backupPath, JSON.stringify(workflow, null, 2));

const montar = workflow.nodes.find((n) => n.name === "Montar Body do Simulador");
if (!montar) throw new Error("Montar Body do Simulador node not found");
if (montar.parameters.jsCode.includes("simulation_skipped_reason")) {
  console.log("  skip [Montar Body já patchado]");
} else {
  montar.parameters.jsCode = replaceOnce(montar.parameters.jsCode, THROW_OLD, THROW_NEW, "Montar Body throw → degradação graciosa");
  new Function("$input", montar.parameters.jsCode);
}

const sim = workflow.nodes.find((n) => n.name === "Simulador");
if (!sim) throw new Error("Simulador node not found");
sim.parameters.options = sim.parameters.options ?? {};
sim.parameters.options.response = { response: { neverError: true } };
sim.onError = "continueRegularOutput";
console.log("  ok [Simulador neverError + onError=continueRegularOutput]");

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
const vMontar = verify.nodes.find((n) => n.name === "Montar Body do Simulador");
const vSim = verify.nodes.find((n) => n.name === "Simulador");
console.log(JSON.stringify({
  workflowId: verify.id,
  wasActive,
  activeAfter,
  finalActive: verify.active,
  backupPath,
  montarPatched: vMontar.parameters.jsCode.includes("simulation_skipped_reason"),
  simNeverError: vSim.parameters.options?.response?.response?.neverError === true,
  simOnError: vSim.onError ?? null,
}, null, 2));
