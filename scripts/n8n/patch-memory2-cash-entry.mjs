// Surgical patch — "Memory 2 - Reconciler" prompt (workflow AO VIVO Cr4fPWe0prwS6XjI).
//
// Adiciona o campo cash_entry_asked à lista de estado e um bloco de instruções
// para o reconciler capturar a entrada em dinheiro/Pix:
//   - cash_entry_asked: a IA já perguntou sobre entrada antes de simular.
//   - cash_entry_intent / cash_entry_amount: resposta do cliente.
// Edita o texto do node AO VIVO (idempotente via marcador). DRY=1 não faz PUT.
import fs from "node:fs";
import path from "node:path";

const WORKFLOW_ID = "Cr4fPWe0prwS6XjI";
const N8N_BASE_URL = "https://iatende-n8n.ylgf5w.easypanel.host";
const DRY = process.env.DRY === "1";
const LOCAL_EXPORT = "output/n8n/ia-repasse-pro-v2-current.json";
const NODE_NAME = "Memory 2 - Reconciler";

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

const FIELD_NEEDLE = "cross_city_situation, hdi_city_needed, client_outside_ce, cash_entry_intent, cash_entry_amount, proposal_accepted";
const FIELD_REPL = "cross_city_situation, hdi_city_needed, client_outside_ce, cash_entry_asked, cash_entry_intent, cash_entry_amount, proposal_accepted";

const ANCHOR = "- Nao deixe desired_model igual ao tradein_model por confusao de origem; se a unica evidencia for o aparelho de entrada, desired_model permanece como estava (ou null).";
const BLOCK = ANCHOR + "\n\n// ENTRADA EM DINHEIRO/PIX (antes de simular)\n"
  + "- cash_entry_asked: marque true quando a ULTIMA mensagem do atendimento perguntou se o cliente deseja dar algum valor de entrada (dinheiro/Pix) antes de simular. Uma vez true, mantenha true.\n"
  + "- cash_entry_intent: true se o cliente quer dar entrada; false se recusou (ex.: \"nao\", \"so no cartao\", \"sem entrada\", \"tudo parcelado\"). null enquanto nao respondeu.\n"
  + "- cash_entry_amount: o valor da entrada em reais quando informado (apenas o numero). Se o cliente disse que quer dar entrada mas nao deu o valor, mantenha null e cash_entry_intent = true.\n"
  + "- Nao confunda a entrada (cash_entry) com a bandeira do cartao: \"dou 500 no Pix\" define cash_entry_amount=500/cash_entry_intent=true e NAO muda card_brand.";

const workflow = DRY ? JSON.parse(fs.readFileSync(LOCAL_EXPORT, "utf8")) : await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const wasActive = workflow.active;
if (!DRY) {
  fs.mkdirSync("output/n8n/backups", { recursive: true });
  const bp = `output/n8n/backups/before-m2-cashentry-${Date.now()}.json`;
  fs.writeFileSync(bp, JSON.stringify(workflow, null, 2));
  console.log("backup:", bp);
}
const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`${NODE_NAME} not found`);
node.parameters.options = node.parameters.options ?? {};
let text = node.parameters.options.systemMessage;
if (typeof text !== "string") throw new Error("Memory 2 options.systemMessage not a string");

if (text.includes("ENTRADA EM DINHEIRO/PIX (antes de simular)")) {
  console.log("  skip [já aplicado]");
} else {
  if (text.split(FIELD_NEEDLE).length - 1 !== 1) throw new Error("needle campos não-único");
  text = text.replace(FIELD_NEEDLE, FIELD_REPL);
  if (text.split(ANCHOR).length - 1 !== 1) throw new Error("anchor não-único");
  text = text.replace(ANCHOR, BLOCK);
  node.parameters.options.systemMessage = text;
  console.log("  ok [cash_entry no reconciler]");
}
for (const m of ["cash_entry_asked, cash_entry_intent", "ENTRADA EM DINHEIRO/PIX (antes de simular)"]) {
  if (!node.parameters.options.systemMessage.includes(m)) throw new Error(`sanity falhou: ${m}`);
}

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
console.log(JSON.stringify({ wasActive, activeAfter, finalActive: verify.active, applied: v.parameters.options.systemMessage.includes("ENTRADA EM DINHEIRO/PIX (antes de simular)") }, null, 2));
