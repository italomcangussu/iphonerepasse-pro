import fs from "node:fs";
import path from "node:path";
import {
  BIA1_STOCK_SAFETY_PROMPT,
  GUARDRAIL_MARKER_END,
  GUARDRAIL_MARKER_START,
  N8N_GUARDRAIL_BLOCK,
} from "./repasse-memory-guardrails.mjs";

const WORKFLOW_ID = "oWNdWPUq6kEFitsnl8OpH";
const N8N_BASE_URL = "https://iatende-n8n.ylgf5w.easypanel.host";

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
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

function replaceMarkedBlock(source, block) {
  const start = source.indexOf(GUARDRAIL_MARKER_START);
  const end = source.indexOf(GUARDRAIL_MARKER_END);
  if (start !== -1 && end !== -1 && end > start) {
    return source.slice(0, start).trimEnd() + "\n\n" + block + "\n\n" + source.slice(end + GUARDRAIL_MARKER_END.length).trimStart();
  }

  const insertionPoint = source.indexOf("const needsClientCityBeforeStock =");
  if (insertionPoint === -1) {
    throw new Error("Could not find Parse Memory insertion point");
  }
  return source.slice(0, insertionPoint).trimEnd() + "\n\n" + block + "\n\n" + source.slice(insertionPoint);
}

function ensureBiaPromptSafetyBlock(prompt) {
  if (prompt.includes("=== REGRAS DE SEGURANCA DE ESTOQUE ===")) return prompt;
  return prompt.trimEnd() + BIA1_STOCK_SAFETY_PROMPT;
}

function buildPublicApiUpdateBody(workflow) {
  return {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: {
      executionOrder: workflow.settings?.executionOrder ?? "v1",
    },
  };
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
  if (!response.ok) {
    throw new Error(`n8n API ${response.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

const workflow = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const backupPath = `/tmp/repasse-workflow-${WORKFLOW_ID}-${Date.now()}.json`;
fs.writeFileSync(backupPath, JSON.stringify(workflow, null, 2));

const parseMemory = workflow.nodes.find(node => node.name === "Parse Memory");
if (!parseMemory) throw new Error("Parse Memory node not found");
parseMemory.parameters.jsCode = replaceMarkedBlock(parseMemory.parameters.jsCode, N8N_GUARDRAIL_BLOCK);

const bia1 = workflow.nodes.find(node => node.name === "Bia 1");
if (!bia1) throw new Error("Bia 1 node not found");
bia1.parameters.text = ensureBiaPromptSafetyBlock(bia1.parameters.text);

const body = buildPublicApiUpdateBody(workflow);
const updated = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`, {
  method: "PUT",
  body: JSON.stringify(body),
});

console.log(JSON.stringify({
  workflowId: updated.id,
  name: updated.name,
  active: updated.active,
  backupPath,
  availableInMCPBeforePublicApiUpdate: workflow.settings?.availableInMCP ?? null,
  availableInMCPAfterPublicApiUpdate: updated.settings?.availableInMCP ?? null,
  parseMemoryPatched: updated.nodes.some(node => node.name === "Parse Memory" && node.parameters.jsCode.includes(GUARDRAIL_MARKER_START)),
  bia1Patched: updated.nodes.some(node => node.name === "Bia 1" && node.parameters.text.includes("=== REGRAS DE SEGURANCA DE ESTOQUE ===")),
}, null, 2));
