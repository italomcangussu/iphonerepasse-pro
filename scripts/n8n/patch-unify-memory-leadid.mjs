// Surgical patch — unifica a FONTE do lead_id no sessionKey dos 2 memory nodes
// restantes, no workflow AO VIVO (Cr4fPWe0prwS6XjI).
//
// Por quê (patch 2 da auditoria de memória):
//  - "Postgres Chat Memory1" (Bia 1) resolvia base de
//    $('CRM Leads GET').last()…conversations[0].lead_id
//  - "Postgres Chat Memory"  (Bia 2 ESTOQUE) resolvia base de $json.lead_id
//  Fontes diferentes ⇒ se divergirem, as duas Bias escrevem em threads distintas
//  apesar do mesmo prefixo '' → quebra de continuidade silenciosa.
//
//  Canonizamos ambas em $('Load Buffer Final').item.json.lead_id — o Set node
//  cuja única função relevante é carregar lead_id (= Formatar Payload CRM2),
//  ancestral comum de Bia 1 e Bia 2, e referência já comprovada nesse contexto
//  (era a fonte dos memory nodes Memory3/4 removidos no patch 1). Prefixo,
//  fallback e sufixo :scenario_id permanecem iguais; as duas expressões ficam
//  byte-idênticas ⇒ mesma thread garantida.
//
// DRY=1 lê o export local e grava /tmp/repasse-unify-leadid-dry.json sem PUT.
import fs from "node:fs";
import path from "node:path";

const WORKFLOW_ID = "Cr4fPWe0prwS6XjI";
const FALLBACK_ORIGIN = "https://iatende-n8n.ylgf5w.easypanel.host";
const DRY = process.env.DRY === "1";
const LOCAL_EXPORT = "output/n8n/ia-repasse-pro-v2-current.json";

const BIA1_MEM = "Postgres Chat Memory1"; // → Bia 1
const BIA2_MEM = "Postgres Chat Memory";  // → Bia 2 ESTOQUE

// Expressão canônica (base unificada). Mantém prefixo '' e a mesma cadeia.
const CANONICAL_KEY = `={{ (() => {
  const meta = $('Webhook').last().json.body?.meta ?? {};
  const base = $('Load Buffer Final').item.json.lead_id;
  const session = '' + String(base || $('Webhook').last().json.body?.lead_detail?.id || $('Webhook').last().json.body?.lead_id || 'unknown');
  return meta.source === 'repasse_v2_scenario_audit' && meta.scenario_id
    ? session + ':' + String(meta.scenario_id)
    : session;
})() }}`;

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

const mem1 = workflow.nodes.find((n) => n.name === BIA1_MEM);
const mem2 = workflow.nodes.find((n) => n.name === BIA2_MEM);
if (!mem1) throw new Error(`${BIA1_MEM} não encontrado`);
if (!mem2) throw new Error(`${BIA2_MEM} não encontrado`);
if (!workflow.nodes.some((n) => n.name === "Load Buffer Final")) throw new Error("Load Buffer Final não encontrado");

// pré-condições: confirma as fontes ANTIGAS antes de trocar
const k1 = mem1.parameters?.sessionKey ?? "";
const k2 = mem2.parameters?.sessionKey ?? "";
if (!k1.includes("$('CRM Leads GET').last().json.data?.conversations?.[0]?.lead_id")) {
  throw new Error(`${BIA1_MEM}: sessionKey não tem a fonte CRM Leads GET esperada (já alterado?)`);
}
if (!k2.includes("const base = $json.lead_id;")) {
  throw new Error(`${BIA2_MEM}: sessionKey não tem a fonte $json.lead_id esperada (já alterado?)`);
}
// confirma que cada memory ainda alimenta o agente certo
const memTarget = (name) => (workflow.connections[name]?.ai_memory ?? []).flat().map((e) => e.node);
if (!memTarget(BIA1_MEM).includes("Bia 1")) throw new Error(`${BIA1_MEM} não alimenta Bia 1`);
if (!memTarget(BIA2_MEM).includes("Bia 2 ESTOQUE")) throw new Error(`${BIA2_MEM} não alimenta Bia 2 ESTOQUE`);

if (!DRY) {
  const backupDir = "output/n8n/backups";
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = `${backupDir}/before-unify-memory-leadid-${Date.now()}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(workflow, null, 2));
  console.log("backup:", backupPath);
}

// mutação
mem1.parameters.sessionKey = CANONICAL_KEY;
mem2.parameters.sessionKey = CANONICAL_KEY;

// pós-condições
if (mem1.parameters.sessionKey !== mem2.parameters.sessionKey) {
  throw new Error("sessionKeys não ficaram idênticos");
}
if (!mem1.parameters.sessionKey.includes("$('Load Buffer Final').item.json.lead_id")) {
  throw new Error("sessionKey canônico não referencia Load Buffer Final");
}

if (DRY) {
  fs.writeFileSync("/tmp/repasse-unify-leadid-dry.json", JSON.stringify(workflow, null, 2));
  console.log(JSON.stringify({ dry: true, wrote: "/tmp/repasse-unify-leadid-dry.json", identical: true }, null, 2));
  process.exit(0);
}

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
const v1 = verify.nodes.find((n) => n.name === BIA1_MEM)?.parameters?.sessionKey ?? "";
const v2 = verify.nodes.find((n) => n.name === BIA2_MEM)?.parameters?.sessionKey ?? "";
console.log(JSON.stringify({
  workflowId: verify.id,
  wasActive,
  activeAfter,
  finalActive: verify.active,
  sessionKeysIdentical: v1 === v2,
  referencesLoadBufferFinal: v1.includes("$('Load Buffer Final').item.json.lead_id"),
}, null, 2));
