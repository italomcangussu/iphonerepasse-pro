// Surgical patch — injeta o sanitizador determinístico (repasse-humanizer) nos
// 4 Code nodes que parseiam a saída das Bias, no workflow AO VIVO:
//   - Code Parse Bia 1                       (Bia 1)
//   - Code Parse Bia 2 SEM ESTOQUE           (Bia 2 ESTOQUE, via Edit Fields3)
//   - Code Parse Bia 2 SEM ESTOQUE1          (Bia 2 SEM ESTOQUE, via Edit Fields13)
//   - Code Parse Re-simulacao Bia 2 ESTOQUE  (Bia 2 ESTOQUE, caminho rerun)
// Mesmo que o LLM desobedeça o bloco NATURALIDADE, a mensagem sai sem caguete.
// Footgun guard: PUT cirúrgico + reativação explícita + verificação final.
import fs from "node:fs";
import path from "node:path";
import { N8N_HUMANIZER_BLOCK, HUMANIZER_MARKER_START } from "./repasse-humanizer.mjs";

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
  return source.slice(0, idx) + replacement + source.slice(idx + needle.length);
}

const SANITIZE_ROUTER = `if (router && typeof router.message === "string") { router.message = repasseHumanizeMessage(router.message); }`;
const SANITIZE_DECISION = `if (decision && typeof decision.message === "string") { decision.message = repasseHumanizeMessage(decision.message); }`;

// needle → [replacement] por nó; o bloco é prefixado em todos.
const NODE_PATCHES = {
  "Code Parse Bia 1": (code) => replaceOnce(
    code,
    `  const router = JSON.parse(raw);\n  return [{ json: { ...inputData, router, delivery_mode: router.delivery_mode ?? "normal", router_parse_ok: true } }];`,
    `  const router = JSON.parse(raw);\n  ${SANITIZE_ROUTER}\n  return [{ json: { ...inputData, router, delivery_mode: router.delivery_mode ?? "normal", router_parse_ok: true } }];`,
    "Bia 1 sanitize call",
  ),
  "Code Parse Bia 2 SEM ESTOQUE": (code) => replaceOnce(
    code,
    `const router = JSON.parse(raw);`,
    `const router = JSON.parse(raw);\n  ${SANITIZE_ROUTER}`,
    "Bia 2 ESTOQUE sanitize call",
  ),
  "Code Parse Bia 2 SEM ESTOQUE1": (code) => replaceOnce(
    code,
    `const router = JSON.parse(raw);`,
    `const router = JSON.parse(raw);\n  ${SANITIZE_ROUTER}`,
    "Bia 2 SEM ESTOQUE sanitize call",
  ),
  "Code Parse Re-simulacao Bia 2 ESTOQUE": (code) => replaceOnce(
    code,
    `if (decision?.rerun_simulation !== true) {`,
    `${SANITIZE_DECISION}\n\nif (decision?.rerun_simulation !== true) {`,
    "Re-simulacao sanitize call",
  ),
};

// ---- Run ----
const workflow = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const wasActive = workflow.active;
const backupPath = `/tmp/repasse-workflow-${WORKFLOW_ID}-${Date.now()}.json`;
fs.writeFileSync(backupPath, JSON.stringify(workflow, null, 2));

for (const [name, patchCall] of Object.entries(NODE_PATCHES)) {
  const node = workflow.nodes.find((n) => n.name === name);
  if (!node) throw new Error(`${name} node not found`);
  if (node.parameters.jsCode.includes(HUMANIZER_MARKER_START)) {
    console.log(`skip (já aplicado): ${name}`);
    continue;
  }
  let code = patchCall(node.parameters.jsCode);
  code = `${N8N_HUMANIZER_BLOCK}\n\n${code}`;
  new Function(code); // sanity: precisa parsear como corpo de Code node
  node.parameters.jsCode = code;
  console.log(`patched: ${name}`);
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
const results = {};
for (const name of Object.keys(NODE_PATCHES)) {
  const code = verify.nodes.find((n) => n.name === name).parameters.jsCode;
  results[name] = code.includes(HUMANIZER_MARKER_START) && code.includes("repasseHumanizeMessage(");
}

console.log(JSON.stringify({
  workflowId: verify.id,
  wasActive,
  activeAfter,
  finalActive: verify.active,
  backupPath,
  humanizerInjected: results,
}, null, 2));
