// Surgical patch — remove a memória de chat do "Memory 2 - Reconciler" e apaga
// o nó de memória órfão, no workflow AO VIVO (Cr4fPWe0prwS6XjI).
//
// Por quê (patch 1 da auditoria de memória):
//  - "Postgres Chat Memory3" (prefixo 'm', window 1) alimentava ai_memory do
//    "Memory 2 - Reconciler". O Reconciler é agente de SAÍDA ESTRUTURADA e dono
//    do lead_state — ele já recebe o estado anterior (`prev`) e a última mensagem
//    no prompt. A janela de chat é redundante e adiciona entrada não-determinística
//    numa peça que é fonte recorrente de corrupção de lead_state. Removemos.
//  - "Postgres Chat Memory4" (prefixo '2m', window 1) é nó MORTO: ai_memory já era
//    [[]] (desconectado; era a antiga thread do Memory 1 - Extractor). Removemos.
//
// Direção das conexões langchain: o nó de memória é a FONTE (key em connections)
// e o agente é o alvo (type ai_memory). Logo, basta remover os nós + as chaves de
// conexão homônimas. Nenhum nó referencia esses dois como ALVO.
//
// DRY=1 lê o export local e grava /tmp/repasse-remove-mem-dry.json sem PUT.
import fs from "node:fs";
import path from "node:path";

const WORKFLOW_ID = "Cr4fPWe0prwS6XjI";
const FALLBACK_ORIGIN = "https://iatende-n8n.ylgf5w.easypanel.host";
const DRY = process.env.DRY === "1";
const LOCAL_EXPORT = "output/n8n/ia-repasse-pro-v2-current.json";

const REMOVE = ["Postgres Chat Memory3", "Postgres Chat Memory4"];
const RECONCILER = "Memory 2 - Reconciler";

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
function getN8nApiKey() {
  return process.env.N8N_API_KEY ?? process.env.N8N_PUBLIC_API ?? fileEnv.N8N_API_KEY ?? fileEnv.N8N_PUBLIC_API;
}
function getBaseUrl() {
  return (process.env.N8N_BASE_URL ?? fileEnv.N8N_BASE_URL ?? FALLBACK_ORIGIN).replace(/\/+$/, "");
}

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
const nodeCountBefore = workflow.nodes.length;

// --- pré-condições ---
const mem3 = workflow.nodes.find((n) => n.name === "Postgres Chat Memory3");
const mem4 = workflow.nodes.find((n) => n.name === "Postgres Chat Memory4");
if (!mem3) throw new Error("Postgres Chat Memory3 não encontrado (workflow mudou?)");
if (!mem4) throw new Error("Postgres Chat Memory4 não encontrado (workflow mudou?)");
if (!workflow.nodes.some((n) => n.name === RECONCILER)) throw new Error(`${RECONCILER} não encontrado`);

const mem3Targets = (workflow.connections["Postgres Chat Memory3"]?.ai_memory ?? [])
  .flat().map((e) => e.node);
const mem4Targets = (workflow.connections["Postgres Chat Memory4"]?.ai_memory ?? [])
  .flat().map((e) => e.node);
if (!mem3Targets.includes(RECONCILER)) {
  throw new Error(`Esperava Memory3 → ${RECONCILER}, achei: ${JSON.stringify(mem3Targets)}`);
}
if (mem4Targets.length !== 0) {
  throw new Error(`Esperava Memory4 órfão (sem alvos), achei: ${JSON.stringify(mem4Targets)}`);
}

if (!DRY) {
  const backupDir = "output/n8n/backups";
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = `${backupDir}/before-remove-reconciler-memory-${Date.now()}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(workflow, null, 2));
  console.log("backup:", backupPath);
}

// --- mutação ---
// 1) remover os nós
workflow.nodes = workflow.nodes.filter((n) => !REMOVE.includes(n.name));
// 2) remover as chaves de conexão (fontes) homônimas
for (const name of REMOVE) delete workflow.connections[name];
// 3) defensivo: remover qualquer aresta que aponte para os nós removidos (não deve haver)
let strayEdges = 0;
for (const src of Object.keys(workflow.connections)) {
  const conn = workflow.connections[src];
  for (const type of Object.keys(conn)) {
    conn[type] = conn[type].map((branch) =>
      (branch || []).filter((edge) => {
        if (REMOVE.includes(edge.node)) { strayEdges++; return false; }
        return true;
      })
    );
  }
}

// --- pós-condições ---
if (workflow.nodes.length !== nodeCountBefore - 2) {
  throw new Error(`Esperava remover 2 nós (${nodeCountBefore}→${nodeCountBefore - 2}), ficou ${workflow.nodes.length}`);
}
for (const name of REMOVE) {
  if (workflow.nodes.some((n) => n.name === name)) throw new Error(`${name} ainda presente nos nós`);
  if (workflow.connections[name]) throw new Error(`${name} ainda presente em connections`);
}
// Reconciler não pode mais ter nenhuma ai_memory apontando para ele
const reconcilerStillFed = Object.values(workflow.connections).some((conn) =>
  (conn.ai_memory ?? []).flat().some((e) => e.node === RECONCILER)
);
if (reconcilerStillFed) throw new Error(`${RECONCILER} ainda recebe ai_memory de algum nó`);

if (DRY) {
  fs.writeFileSync("/tmp/repasse-remove-mem-dry.json", JSON.stringify(workflow, null, 2));
  console.log(JSON.stringify({
    dry: true, wrote: "/tmp/repasse-remove-mem-dry.json",
    nodeCountBefore, nodeCountAfter: workflow.nodes.length, strayEdges,
    removed: REMOVE,
  }, null, 2));
  process.exit(0);
}

// settings: o PUT da API pública só aceita executionOrder ("must NOT have
// additional properties" nos demais, inclusive timeSavedMode) — igual aos demais
// patch scripts do projeto.
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
const stillThere = REMOVE.filter((name) => verify.nodes.some((n) => n.name === name));
const reconcilerFedAfter = Object.values(verify.connections).some((conn) =>
  (conn.ai_memory ?? []).flat().some((e) => e.node === RECONCILER)
);
console.log(JSON.stringify({
  workflowId: verify.id,
  wasActive,
  activeAfter,
  finalActive: verify.active,
  nodeCountBefore,
  nodeCountAfter: verify.nodes.length,
  strayEdgesRemoved: strayEdges,
  removedNodesStillPresent: stillThere,
  reconcilerStillFedByMemory: reconcilerFedAfter,
}, null, 2));
