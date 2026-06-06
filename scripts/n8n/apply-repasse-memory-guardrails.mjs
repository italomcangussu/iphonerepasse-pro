import fs from "node:fs";
import path from "node:path";
import {
  BIA1_STOCK_SAFETY_PROMPT,
  GUARDRAIL_MARKER_END,
  GUARDRAIL_MARKER_START,
  N8N_GUARDRAIL_BLOCK,
} from "./repasse-memory-guardrails.mjs";
import {
  N8N_REPLY_CONTEXT_BLOCK,
  REPLY_CONTEXT_MARKER_END,
  REPLY_CONTEXT_MARKER_START,
} from "./repasse-reply-context.mjs";

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

function replaceOrInsertBlock(source, markerStart, markerEnd, insertionNeedle, block, nodeName) {
  const start = source.indexOf(markerStart);
  const end = source.indexOf(markerEnd);
  if (start !== -1 && end !== -1 && end > start) {
    return source.slice(0, start).trimEnd() + "\n\n" + block + "\n\n" + source.slice(end + markerEnd.length).trimStart();
  }

  const insertionPoint = source.indexOf(insertionNeedle);
  if (insertionPoint === -1) {
    throw new Error(`Could not find ${nodeName} insertion point: ${insertionNeedle}`);
  }
  return source.slice(0, insertionPoint).trimEnd() + "\n\n" + block + "\n\n" + source.slice(insertionPoint);
}

function ensureBiaPromptSafetyBlock(prompt) {
  if (prompt.includes("=== REGRAS DE SEGURANCA DE ESTOQUE ===")) return prompt;
  return prompt.trimEnd() + BIA1_STOCK_SAFETY_PROMPT;
}

function ensureSetAssignment(node, assignment) {
  const assignments = node.parameters?.assignments?.assignments;
  if (!Array.isArray(assignments)) {
    throw new Error(`${node.name} assignments not found`);
  }

  const existing = assignments.find(item => item.name === assignment.name);
  if (existing) {
    existing.value = assignment.value;
    existing.type = assignment.type;
    return;
  }

  assignments.push(assignment);
}

function patchFormatarPayloadCrm2(node) {
  ensureSetAssignment(node, {
    id: "repasse-reply-context",
    name: "reply_context",
    value: "={{ $('Webhook').item.json.body.reply_context ?? null }}",
    type: "object",
  });
}

function patchBufferDataLead(node) {
  const assignments = node.parameters?.assignments?.assignments;
  if (!Array.isArray(assignments)) {
    throw new Error("Buffer + Data Lead assignments not found");
  }

  const bufferAssignment = assignments.find(item => item.name === "buffer");
  if (!bufferAssignment || typeof bufferAssignment.value !== "string") {
    throw new Error("Buffer + Data Lead buffer assignment not found");
  }

  const replyLine = '\n      "reply_context": $("Formatar Payload CRM2").item.json.reply_context';
  if (bufferAssignment.value.includes('"reply_context"')) return;

  bufferAssignment.value = bufferAssignment.value.replace(
    '"type": $("Formatar Payload CRM2").item.json.type',
    '"type": $("Formatar Payload CRM2").item.json.type,' + replyLine,
  );
}

function patchAtualizarEstadoBuffer(source) {
  let patched = replaceOrInsertBlock(
    source,
    REPLY_CONTEXT_MARKER_START,
    REPLY_CONTEXT_MARKER_END,
    "function normalizeMessage(msg) {",
    N8N_REPLY_CONTEXT_BLOCK,
    "Atualizar Estado Buffer",
  );

  patched = patched.replace(
    /sender_name:\s*String\(msg\?\.sender_name \?\? ''\),\n\s*};/,
    "sender_name: String(msg?.sender_name ?? ''),\n    reply_context: repasseNormalizeReplyContext(msg?.reply_context),\n  };",
  );

  return patched;
}

function patchCodeConsolidadorPayloadFinal(source) {
  let patched = replaceOrInsertBlock(
    source,
    REPLY_CONTEXT_MARKER_START,
    REPLY_CONTEXT_MARKER_END,
    "// Consolida a mensagem buffered:",
    N8N_REPLY_CONTEXT_BLOCK,
    "Code Consolidador Payload Final",
  );

  patched = patched.replace(
    /\/\/ Consolida a mensagem buffered: todas as mensagens concatenadas em ordem[\s\S]*?var messageBuffered = messageTexts\.join\("\\n"\);/,
    "// Consolida a mensagem buffered: todas as mensagens concatenadas em ordem, preservando contexto de reply\nvar messageTexts = [];\nfor (var j = 0; j < messages.length; j++) {\n  var rendered = repasseRenderMessageForAgents(messages[j]);\n  if (!isEmpty(rendered)) {\n    messageTexts.push(String(rendered).trim());\n  }\n}\nvar messageBuffered = messageTexts.join(\"\\n\");",
  );

  return patched;
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

const atualizarEstadoBuffer = workflow.nodes.find(node => node.name === "Atualizar Estado Buffer");
if (!atualizarEstadoBuffer) throw new Error("Atualizar Estado Buffer node not found");
atualizarEstadoBuffer.parameters.jsCode = patchAtualizarEstadoBuffer(atualizarEstadoBuffer.parameters.jsCode);

const consolidador = workflow.nodes.find(node => node.name === "Code Consolidador Payload Final");
if (!consolidador) throw new Error("Code Consolidador Payload Final node not found");
consolidador.parameters.jsCode = patchCodeConsolidadorPayloadFinal(consolidador.parameters.jsCode);

const formatarPayloadCrm2 = workflow.nodes.find(node => node.name === "Formatar Payload CRM2");
if (!formatarPayloadCrm2) throw new Error("Formatar Payload CRM2 node not found");
patchFormatarPayloadCrm2(formatarPayloadCrm2);

const bufferDataLead = workflow.nodes.find(node => node.name === "Buffer + Data Lead");
if (!bufferDataLead) throw new Error("Buffer + Data Lead node not found");
patchBufferDataLead(bufferDataLead);

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
  atualizarEstadoBufferReplyPatched: updated.nodes.some(node => node.name === "Atualizar Estado Buffer" && node.parameters.jsCode.includes(REPLY_CONTEXT_MARKER_START)),
  consolidadorReplyPatched: updated.nodes.some(node => node.name === "Code Consolidador Payload Final" && node.parameters.jsCode.includes(REPLY_CONTEXT_MARKER_START)),
  formatarPayloadReplyPatched: updated.nodes.some(node => node.name === "Formatar Payload CRM2" && node.parameters.assignments?.assignments?.some(item => item.name === "reply_context")),
  bufferDataLeadReplyPatched: updated.nodes.some(node => node.name === "Buffer + Data Lead" && node.parameters.assignments?.assignments?.some(item => item.name === "buffer" && String(item.value).includes('"reply_context"'))),
}, null, 2));
