// Surgical patch — insere o node determinístico "Code Routing Flags" entre
// `Edit Fields5` e `Switch3` no workflow AO VIVO (Cr4fPWe0prwS6XjI).
//
// Por quê (passo 1+2 do plano): a deleção manual do `Parse Memory` removeu quem
// computava as flags de roteamento; o `Switch3` lê essas flags de $json e NÃO
// tem fallbackOutput, então com tudo null o item é descartado → bot mudo
// (confirmado na exec 405819: lastNodeExecuted=Edit Fields5, nenhuma Bia/envio).
// Este node restaura a árvore de decisão determinística SEM reconciliar
// lead_state (Memory 2 é o dono). Código-fonte: repasse-code-routing-flags.js.
//
// Rewire: Edit Fields5.main[0] tinha [Switch3, update_funnel, Code in JavaScript,
// Code in JavaScript1]. Trocamos a aresta para Switch3 por "Code Routing Flags",
// e ligamos "Code Routing Flags" → Switch3. As outras 3 arestas ficam.
//
// DRY=1 lê o export local e grava /tmp/repasse-routing-node-dry.json sem PUT.
import fs from "node:fs";
import path from "node:path";

const WORKFLOW_ID = "Cr4fPWe0prwS6XjI";
const N8N_BASE_URL = "https://iatende-n8n.ylgf5w.easypanel.host";
const DRY = process.env.DRY === "1";
const LOCAL_EXPORT = "output/n8n/ia-repasse-pro-v2-current.json";
const NODE_NAME = "Code Routing Flags";
const NODE_SRC = "scripts/n8n/repasse-code-routing-flags.js";

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

// código do node (sem o $ disponível, validação de sintaxe apenas)
const jsCode = fs.readFileSync(NODE_SRC, "utf8");
new Function("$input", "$", "DateTime", "$helpers", "$jmespath", jsCode); // syntax assert

const workflow = DRY ? JSON.parse(fs.readFileSync(LOCAL_EXPORT, "utf8")) : await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const wasActive = workflow.active;

if (!DRY) {
  const backupDir = "output/n8n/backups";
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = `${backupDir}/before-routing-flags-node-${Date.now()}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(workflow, null, 2));
  console.log("backup:", backupPath);
}

const ef5 = workflow.nodes.find((n) => n.name === "Edit Fields5");
if (!ef5) throw new Error("Edit Fields5 not found");
const sw3 = workflow.nodes.find((n) => n.name === "Switch3");
if (!sw3) throw new Error("Switch3 not found");

// 1) upsert do node
let node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (node) {
  console.log("  skip [node já existe] — atualizando jsCode");
  node.parameters.jsCode = jsCode;
} else {
  node = {
    parameters: { jsCode },
    id: "routing-flags-" + Math.random().toString(36).slice(2, 10),
    name: NODE_NAME,
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [ef5.position[0] + 192, ef5.position[1] - 160],
  };
  workflow.nodes.push(node);
  console.log("  ok [node adicionado]");
}

// 2) rewire: Edit Fields5 → (Switch3 vira Code Routing Flags); manter os outros 3
const ef5conn = workflow.connections["Edit Fields5"];
if (!ef5conn?.main?.[0]) throw new Error("Edit Fields5 sem conexão main[0]");
const edges = ef5conn.main[0];
const sw3Edge = edges.find((e) => e.node === "Switch3");
if (sw3Edge) {
  sw3Edge.node = NODE_NAME; // troca destino da aresta existente
  console.log("  ok [Edit Fields5 → Code Routing Flags]");
} else if (!edges.some((e) => e.node === NODE_NAME)) {
  edges.push({ node: NODE_NAME, type: "main", index: 0 });
  console.log("  ok [Edit Fields5 + Code Routing Flags (Switch3 já não estava)]");
} else {
  console.log("  skip [Edit Fields5 já aponta para Code Routing Flags]");
}

// 3) Code Routing Flags → Switch3
workflow.connections[NODE_NAME] = { main: [[{ node: "Switch3", type: "main", index: 0 }]] };
console.log("  ok [Code Routing Flags → Switch3]");

// 4) sanidade: nenhuma aresta órfã para Switch3 saindo direto do Edit Fields5
const stillDirect = (workflow.connections["Edit Fields5"].main[0] || []).some((e) => e.node === "Switch3");
if (stillDirect) throw new Error("Edit Fields5 ainda aponta direto para Switch3 (rewire falhou)");

if (DRY) {
  fs.writeFileSync("/tmp/repasse-routing-node-dry.json", JSON.stringify(workflow, null, 2));
  console.log(JSON.stringify({ dry: true, wrote: "/tmp/repasse-routing-node-dry.json", nodeCount: workflow.nodes.length }, null, 2));
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
const vEf5 = verify.connections["Edit Fields5"].main[0].map((e) => e.node);
const vRoute = verify.connections[NODE_NAME]?.main?.[0]?.map((e) => e.node);
console.log(JSON.stringify({
  workflowId: verify.id,
  wasActive,
  activeAfter,
  finalActive: verify.active,
  nodeCount: verify.nodes.length,
  nodePresent: !!vNode,
  editFields5Targets: vEf5,
  routingFlagsTargets: vRoute,
}, null, 2));
