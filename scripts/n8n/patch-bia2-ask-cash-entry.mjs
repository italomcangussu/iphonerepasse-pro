// Surgical patch — "Bia 2 SEM ESTOQUE " prompt (workflow AO VIVO Cr4fPWe0prwS6XjI).
//
// Adiciona a REGRA DE ENTRADA ANTES DE SIMULAR: quando o roteamento marca
// next_best_action "perguntar se deseja simular com algum valor de entrada
// (dinheiro/pix) antes de simular" (routing_decision ask_cash_entry_before_sim),
// a Bia deve perguntar se o cliente quer dar entrada e financiar o resto no
// cartão, antes de rodar a simulação. DRY=1 não faz PUT.
import fs from "node:fs";
import path from "node:path";

const WORKFLOW_ID = "Cr4fPWe0prwS6XjI";
const N8N_BASE_URL = "https://iatende-n8n.ylgf5w.easypanel.host";
const DRY = process.env.DRY === "1";
const LOCAL_EXPORT = "output/n8n/ia-repasse-pro-v2-current.json";
const NODE_NAME = "Bia 2 SEM ESTOQUE ";

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}
function getN8nApiKey() {
  const env = readEnvFile(path.resolve(".env.local"));
  return process.env.N8N_PUBLIC_API ?? process.env.N8N_API_KEY ?? env.N8N_PUBLIC_API ?? env.N8N_API_KEY;
}
async function n8nFetch(pathname, options = {}) {
  const apiKey = getN8nApiKey();
  if (!apiKey) throw new Error("N8N_API_KEY missing");
  const r = await fetch(`${N8N_BASE_URL}${pathname}`, { ...options, headers: { "Content-Type": "application/json", "X-N8N-API-KEY": apiKey, ...(options.headers ?? {}) } });
  const text = await r.text();
  if (!r.ok) throw new Error(`n8n API ${r.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const ANCHOR = "Se o cliente mencionar cidade sem loja e pedir entrega/logistica, diga que o padrao e retirada em loja e transfira para especialista se ele precisar de uma condicao especial.";
const BLOCK = ANCHOR + "\n\nREGRA DE ENTRADA ANTES DE SIMULAR\n"
  + "Quando next_best_action pedir para perguntar sobre entrada (routing_decision \"ask_cash_entry_before_sim\"), ANTES de simular as parcelas pergunte se o cliente deseja dar algum valor de entrada (dinheiro/Pix) e financiar o restante no cartao. "
  + "Exemplo: \"Antes de simular: voce quer dar algum valor de entrada no Pix/dinheiro e parcelar o restante no cartao, ou prefere tudo no cartao?\" "
  + "Nao invente valor de parcela aqui; apenas faca a pergunta. Se o cliente ja tiver dito que quer (ou nao) dar entrada, NAO pergunte de novo e siga para a simulacao.";

const workflow = DRY ? JSON.parse(fs.readFileSync(LOCAL_EXPORT, "utf8")) : await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const wasActive = workflow.active;
if (!DRY) {
  fs.mkdirSync("output/n8n/backups", { recursive: true });
  const bp = `output/n8n/backups/before-bia2-cashentry-${Date.now()}.json`;
  fs.writeFileSync(bp, JSON.stringify(workflow, null, 2));
  console.log("backup:", bp);
}
const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`${NODE_NAME} not found`);
node.parameters.options = node.parameters.options ?? {};
let text = node.parameters.options.systemMessage;
if (typeof text !== "string") throw new Error("Bia 2 options.systemMessage not a string");

if (text.includes("REGRA DE ENTRADA ANTES DE SIMULAR")) {
  console.log("  skip [já aplicado]");
} else {
  if (text.split(ANCHOR).length - 1 !== 1) throw new Error("anchor não-único");
  text = text.replace(ANCHOR, BLOCK);
  node.parameters.options.systemMessage = text;
  console.log("  ok [regra de entrada]");
}
if (!node.parameters.options.systemMessage.includes("REGRA DE ENTRADA ANTES DE SIMULAR")) throw new Error("sanity falhou");

if (DRY) {
  console.log(JSON.stringify({ dry: true, len: node.parameters.options.systemMessage.length }, null, 2));
  process.exit(0);
}
const body = { name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings: { executionOrder: workflow.settings?.executionOrder ?? "v1" } };
await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`, { method: "PUT", body: JSON.stringify(body) });
let activeAfter = false;
try { activeAfter = (await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}/activate`, { method: "POST" }))?.active ?? false; }
catch (e) { activeAfter = `ACTIVATE_FAILED: ${e.message}`; }
const verify = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const v = verify.nodes.find((n) => n.name === NODE_NAME);
console.log(JSON.stringify({ wasActive, activeAfter, finalActive: verify.active, applied: v.parameters.options.systemMessage.includes("REGRA DE ENTRADA ANTES DE SIMULAR") }, null, 2));
