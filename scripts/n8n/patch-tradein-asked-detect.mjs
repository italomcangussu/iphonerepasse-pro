// Surgical patch — torna o latch tradein_asked DETERMINISTICO no Code Parse
// Memory 2 do workflow AO VIVO (Cr4fPWe0prwS6XjI).
//
// Problema (smoke 2026-06-21): ao RECUSAR a troca ("nao, sem troca"), has_tradein
// fica false e nao ha tradein_model — igual ao default — entao nenhum sinal
// "presente" deriva tradein_asked=true, e o flash-lite (Memory 2) nao setou. O
// gate reperguntava a cada turno. Diferente do cash_entry, recusar trade-in nao
// deixa um intent=false como marca.
//
// Fix: (1) ampliar __classifyBiaQuestion para reconhecer as frases reais que a Bia
// usa para perguntar o aparelho de entrada/troca ("dar algum iPhone como parte do
// pagamento", "de entrada", "na troca", ...); (2) quando a ULTIMA mensagem do bot
// foi essa pergunta (__askedViaReply || __askedViaLastMsg), marcar
// memory.tradein_asked = true — a pergunta foi feita, independente da resposta.
//
// DRY=1 lê o export local e grava /tmp/repasse-tradein-detect-dry.json sem PUT.
import fs from "node:fs";
import path from "node:path";

const WORKFLOW_ID = "Cr4fPWe0prwS6XjI";
const FALLBACK_ORIGIN = "https://iatende-n8n.ylgf5w.easypanel.host";
const DRY = process.env.DRY === "1";
const LOCAL_EXPORT = "output/n8n/ia-repasse-pro-v2-current.json";
const NODE = "Code Parse Memory 2";

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
const fileEnv = readEnvFile(path.resolve(".env.local"));
const getN8nApiKey = () => process.env.N8N_API_KEY ?? fileEnv.N8N_API_KEY;
const getBaseUrl = () => (process.env.N8N_BASE_URL ?? fileEnv.N8N_BASE_URL ?? FALLBACK_ORIGIN).replace(/\/+$/, "");

async function n8nFetch(pathname, options = {}) {
  const apiKey = getN8nApiKey();
  if (!apiKey) throw new Error("N8N_API_KEY missing");
  const r = await fetch(`${getBaseUrl()}${pathname}`, {
    ...options,
    headers: { "Content-Type": "application/json", "X-N8N-API-KEY": apiKey, ...(options.headers ?? {}) },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`n8n API ${r.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function replaceOnce(haystack, needle, replacement, label) {
  const count = haystack.split(needle).length - 1;
  if (count !== 1) throw new Error(`[${label}] esperava 1 ocorrencia, achou ${count}`);
  return haystack.replace(needle, replacement);
}

const REGEX_OLD = `  if (/aparelho que voce tem|aparelho atual|que voce tem (agora|hoje)|seu aparelho|aparelho de entrada|dar como entrada|dar de entrada|dar de entr|pra dar de entrada/.test(t)) return 'tradein_model';`;
const REGEX_NEW = `  if (/aparelho que voce tem|aparelho atual|que voce tem (agora|hoje)|seu aparelho|aparelho de entrada|dar como entrada|dar de entrada|dar de entr|pra dar de entrada|de entrada|parte do pagamento|dar (algum|um|seu) (iphone|aparelho|celular)|na troca|de troca|pra troca|para troca|dar na troca/.test(t)) return 'tradein_model';`;

const SETTER_ANCHOR = `const __askedViaLastMsg = __classifyBiaQuestion(__lastBotMsg) === 'tradein_model';`;
const SETTER_NEW = SETTER_ANCHOR + `
// tradein_asked deterministico (2026-06-21): se a ULTIMA mensagem do bot perguntou
// o aparelho atual/de entrada/troca, a pergunta FOI feita — marque asked=true mesmo
// que o cliente recuse (has_tradein=false, sem model), pois a recusa nao deixa
// sinal "presente" como o cash_entry_intent=false.
if (__askedViaReply || __askedViaLastMsg) {
  memory.tradein_asked = true;
}`;

const workflow = DRY
  ? JSON.parse(fs.readFileSync(LOCAL_EXPORT, "utf8"))
  : await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const wasActive = workflow.active;
const node = workflow.nodes.find((n) => n.name === NODE);
if (!node) throw new Error(`${NODE} não encontrado`);
let code = node.parameters.jsCode;

if (code.includes("parte do pagamento") && code.includes("if (__askedViaReply || __askedViaLastMsg) {")) {
  console.log(JSON.stringify({ noop: true }, null, 2));
  process.exit(0);
}
code = replaceOnce(code, REGEX_OLD, REGEX_NEW, "regex");
code = replaceOnce(code, SETTER_ANCHOR, SETTER_NEW, "setter");
// eslint-disable-next-line no-new-func
new Function(code);
node.parameters.jsCode = code;

if (DRY) {
  fs.writeFileSync("/tmp/repasse-tradein-detect-dry.json", JSON.stringify(workflow, null, 2));
  console.log(JSON.stringify({ dry: true, applied: true }, null, 2));
  process.exit(0);
}

const backupDir = "output/n8n/backups";
fs.mkdirSync(backupDir, { recursive: true });
const pre = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
fs.writeFileSync(`${backupDir}/before-tradein-asked-detect-${Date.now()}.json`, JSON.stringify(pre, null, 2));

const settings = { executionOrder: workflow.settings?.executionOrder ?? "v1" };
await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`, {
  method: "PUT",
  body: JSON.stringify({ name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings }),
});
let activeAfter = false;
try { activeAfter = (await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}/activate`, { method: "POST" }))?.active ?? false; }
catch (err) { activeAfter = `ACTIVATE_FAILED: ${err.message}`; }
const verify = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const vCode = verify.nodes.find((n) => n.name === NODE)?.parameters?.jsCode ?? "";
console.log(JSON.stringify({
  wasActive, activeAfter, finalActive: verify.active,
  detectLive: vCode.includes("if (__askedViaReply || __askedViaLastMsg) {") && vCode.includes("parte do pagamento"),
}, null, 2));
