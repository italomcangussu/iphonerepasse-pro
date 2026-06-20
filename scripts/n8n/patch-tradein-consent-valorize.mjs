// Surgical patch — evolui a mensagem de CONSENTIMENTO da avaliação de trade-in
// no workflow AO VIVO (Cr4fPWe0prwS6XjI) para uma voz que VALORIZA o aparelho do
// cliente (sensação de que o iPhone novo sai mais barato por valorizarem tanto a
// entrada), de forma humana e não forçada.
//
// Três fontes da mesma mensagem (mantidas em sincronia de voz):
//  1) "Code Parse Bia 1" .jsCode — caminho DETERMINÍSTICO (é o que dispara hoje)
//  2) "Bia 1" .options.systemMessage — exemplo few-shot (JSON) do caminho LLM
//  3) "Bia 1" .options.systemMessage — instrução PASSO 1 (template [tradein_model])
//
// Idempotente: cada alvo é pulado se a string nova já estiver aplicada.
// DRY=1 lê o export local e grava /tmp/repasse-tradein-consent-dry.json sem PUT.
import fs from "node:fs";
import path from "node:path";

const WORKFLOW_ID = "Cr4fPWe0prwS6XjI";
const FALLBACK_ORIGIN = "https://iatende-n8n.ylgf5w.easypanel.host";
const DRY = process.env.DRY === "1";
const LOCAL_EXPORT = "output/n8n/ia-repasse-pro-v2-current.json";

// --- alvos exatos: {node, field-path, old, new} ---
const TARGETS = [
  {
    node: "Code Parse Bia 1",
    get: (n) => n.parameters.jsCode,
    set: (n, v) => { n.parameters.jsCode = v; },
    isCode: true,
    old: "Pra calcular o valor do seu ${state.tradein_model} como entrada, posso te mandar as perguntas rápidas de avaliação?",
    new: "Pra avaliar seu ${state.tradein_model} e garantir o melhor valor possível de entrada, posso te mandar umas perguntas rápidas?",
  },
  {
    node: "Bia 1",
    get: (n) => n.parameters.options.systemMessage,
    set: (n, v) => { n.parameters.options.systemMessage = v; },
    old: "Show! Pra eu avaliar seu iPhone 15 Pro Max e te passar o valor de entrada, consegue me responder algumas perguntas sobre ele?",
    new: "Show! Pra avaliar seu iPhone 15 Pro Max e garantir o melhor valor possível de entrada, consegue me responder algumas perguntas rápidas sobre ele?",
  },
  {
    node: "Bia 1",
    get: (n) => n.parameters.options.systemMessage,
    set: (n, v) => { n.parameters.options.systemMessage = v; },
    old: "Show! Pra eu avaliar seu [tradein_model] e te passar o valor de entrada, consegue me responder algumas perguntas sobre ele?",
    new: "Show! Pra avaliar seu [tradein_model] e garantir o melhor valor possível de entrada, consegue me responder algumas perguntas rápidas sobre ele?",
  },
];

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

const applied = [];
const skipped = [];
for (const t of TARGETS) {
  const node = workflow.nodes.find((n) => n.name === t.node);
  if (!node) throw new Error(`${t.node} não encontrado`);
  const cur = t.get(node) ?? "";
  if (cur.includes(t.new) && !cur.includes(t.old)) { skipped.push(t.old.slice(0, 40)); continue; }
  if (!cur.includes(t.old)) throw new Error(`${t.node}: string antiga não encontrada e nova ausente — alvo divergiu`);
  if ((cur.split(t.old).length - 1) !== 1) throw new Error(`${t.node}: string antiga deveria aparecer 1x`);
  const next = cur.replace(t.old, t.new);
  if (next.includes(t.old) || !next.includes(t.new)) throw new Error(`${t.node}: replace inconsistente`);
  if (t.isCode) {
    // eslint-disable-next-line no-new-func
    new Function(next); // syntax-assert (não executa)
  }
  t.set(node, next);
  applied.push(t.old.slice(0, 40));
}

if (applied.length === 0) {
  console.log(JSON.stringify({ noop: true, skipped }, null, 2));
  process.exit(0);
}

if (DRY) {
  fs.writeFileSync("/tmp/repasse-tradein-consent-dry.json", JSON.stringify(workflow, null, 2));
  console.log(JSON.stringify({ dry: true, applied, skipped }, null, 2));
  process.exit(0);
}

const backupDir = "output/n8n/backups";
fs.mkdirSync(backupDir, { recursive: true });
const backupPath = `${backupDir}/before-tradein-consent-valorize-${Date.now()}.json`;
// backup = estado pré-edit: re-GET seria mais caro; salvamos o objeto que vamos PUTar não serve.
// Em vez disso, refazemos um GET limpo para o backup quando não-DRY.
const pre = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
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
const remaining = [];
for (const t of TARGETS) {
  const node = verify.nodes.find((n) => n.name === t.node);
  if ((t.get(node) ?? "").includes(t.old)) remaining.push(`${t.node}:${t.old.slice(0, 30)}`);
}
console.log(JSON.stringify({
  workflowId: verify.id, wasActive, activeAfter, finalActive: verify.active,
  applied, skipped, oldStringsRemaining: remaining,
}, null, 2));
