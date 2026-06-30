// Fix the trade-in -> desired_model swap that corrupts lead_state.
//
// Root cause (see docs/superpowers/specs/2026-06-13-... and CLAUDE.md n8n section):
// The trade-in/desired disambiguation guardrail in `Parse Memory` keys off
// `repasseLastQuestionKind`, which is derived from `repasseLastMessageContent`.
// That var only read `inputData.last_message_content / .lastMessageContent /
// memory.last_message_content` — none of which exist on Parse Memory's input
// (the langchain Agent emits only {output}; `Code Parse Memory 2` re-attaches
// only {lead_state, memory}). So it was always "" -> the "tradein" branch was
// dead, and the blanket `/iphone|1[1-7]/` overwrite pushed the trade-in model
// into desired_model. That state is then persisted via CRM Leads POST Lead_State.
//
// Patch A (Parse Memory):
//   A1 — read last_message_content from the real source ($('Edit Fields').lead).
//   A2 — make the model mapping trade-in-aware (current-message wording too) and
//        drop the blanket `/iphone|1[1-7]/` desired_model overwrite.
// Patch B (Code Parse Memory 2):
//   B1 — re-attach last_message_content to the output so inputData carries it.
//
// Scope: two Code nodes only. No prompt/schema/DB changes.
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. NOTA: o nó "Parse Memory" não existe mais no vivo (removido
// em edição manual de 2026-06-14); patch histórico — hoje aborta em
// "Node not found: Parse Memory" (preservado). DRY=1 lê o snapshot local, não faz PUT.
import * as kit from "./tool/patch-kit.mjs";

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';

const PARSE_MEMORY = 'Parse Memory';
const CODE_PARSE_MEMORY_2 = 'Code Parse Memory 2';

// --- Patch A1: last_message_content source ---
const A1_OLD = `const repasseLastMessageContent = String(inputData.last_message_content ?? inputData.lastMessageContent ?? memory.last_message_content ?? "");`;
const A1_NEW = `function repasseReadLastMessageFromWorkflow() {
  try {
    if (typeof $ === "function") {
      return $("Edit Fields").last().json?.lead?.last_message_content ?? "";
    }
  } catch (e) {
    return "";
  }
  return "";
}
const repasseLastMessageContent = String(inputData.last_message_content ?? inputData.lastMessageContent ?? inputData.lead?.last_message_content ?? memory.last_message_content ?? repasseReadLastMessageFromWorkflow() ?? "");`;

// --- Patch A2: trade-in-aware model mapping ---
const A2_OLD = `if (repasseLastQuestionKind === "tradein" && repasseDetectedModel) {
  memory.has_tradein = true;
  if (!memory.tradein_model) memory.tradein_model = repasseDetectedModel;
} else {
  if (!memory.desired_model && repasseDetectedModel) memory.desired_model = repasseDetectedModel;
  if ((repasseLastQuestionKind === "desired_model" || /iphone|1[1-7]/i.test(currentMessageRaw)) && repasseDetectedModel) {
    memory.desired_model = repasseDetectedModel;
  }
}`;
const A2_NEW = `const repasseCurrentMentionsTradein = /\\b(troca|trocar|de entrada|na entrada|aparelho de entrada|dar de entrada|dando de entrada|de troca)\\b/.test(normalizeFreeText(currentMessageRaw));
const repasseIsTradeinTurn = repasseLastQuestionKind === "tradein" || repasseCurrentMentionsTradein;
if (repasseIsTradeinTurn && repasseDetectedModel) {
  memory.has_tradein = true;
  if (!memory.tradein_model) memory.tradein_model = repasseDetectedModel;
} else {
  if (!memory.desired_model && repasseDetectedModel) memory.desired_model = repasseDetectedModel;
  if (repasseLastQuestionKind === "desired_model" && repasseDetectedModel) {
    memory.desired_model = repasseDetectedModel;
  }
}`;

// --- Patch B1: re-attach last_message_content in Code Parse Memory 2 ---
const B1_OLD = `// Retorna mantendo todo o contexto anterior mais o memory parseado
return [{ json: { ...$json, lead_state: readLeadState(), memory } }];`;
const B1_NEW = `// Retorna mantendo todo o contexto anterior mais o memory parseado
function readLastMessageContent() {
  try {
    return $('Edit Fields').last().json?.lead?.last_message_content ?? null;
  } catch (e) {
    return null;
  }
}
return [{ json: { ...$json, last_message_content: readLastMessageContent(), lead_state: readLeadState(), memory } }];`;

function getNode(workflow, name) {
  const node = workflow.nodes.find((item) => item.name === name);
  if (!node) throw new Error(`Node not found: ${name}`);
  if (node.type !== 'n8n-nodes-base.code') {
    throw new Error(`${name} must be a Code node; got ${node.type}`);
  }
  if (typeof node.parameters?.jsCode !== 'string') {
    throw new Error(`${name} has no jsCode`);
  }
  return node;
}

function applyReplacement(name, code, oldStr, newStr, alreadyMarker) {
  if (code.includes(alreadyMarker)) return { code, applied: false, already: true };
  if (!code.includes(oldStr)) {
    throw new Error(`${name}: expected old block not found (workflow drifted?). Marker: ${alreadyMarker}`);
  }
  if (code.split(oldStr).length - 1 !== 1) {
    throw new Error(`${name}: old block is not unique`);
  }
  return { code: code.replace(oldStr, newStr), applied: true, already: false };
}

function patchWorkflow(workflow) {
  const results = {};

  const pm = getNode(workflow, PARSE_MEMORY);
  let pmCode = pm.parameters.jsCode;
  const a1 = applyReplacement(PARSE_MEMORY + ' A1', pmCode, A1_OLD, A1_NEW, 'repasseReadLastMessageFromWorkflow');
  pmCode = a1.code;
  const a2 = applyReplacement(PARSE_MEMORY + ' A2', pmCode, A2_OLD, A2_NEW, 'repasseIsTradeinTurn');
  pmCode = a2.code;
  pm.parameters.jsCode = pmCode;
  new Function(pmCode); // syntax assert
  results.parseMemory = { a1: a1.applied, a2: a2.applied, alreadyA1: a1.already, alreadyA2: a2.already };

  const cp2 = getNode(workflow, CODE_PARSE_MEMORY_2);
  let cp2Code = cp2.parameters.jsCode;
  const b1 = applyReplacement(CODE_PARSE_MEMORY_2 + ' B1', cp2Code, B1_OLD, B1_NEW, 'function readLastMessageContent()');
  cp2Code = b1.code;
  cp2.parameters.jsCode = cp2Code;
  new Function(cp2Code); // syntax assert
  results.codeParseMemory2 = { b1: b1.applied, alreadyB1: b1.already };

  return results;
}

function assertPatched(workflow) {
  const pm = getNode(workflow, PARSE_MEMORY).parameters.jsCode;
  if (!pm.includes('repasseReadLastMessageFromWorkflow')) throw new Error('Parse Memory A1 missing after patch');
  if (!pm.includes('repasseIsTradeinTurn')) throw new Error('Parse Memory A2 missing after patch');
  if (pm.includes('/iphone|1[1-7]/i.test(currentMessageRaw)) && repasseDetectedModel')) {
    throw new Error('Parse Memory A2 still has the blanket overwrite (regression)');
  }
  if (!pm.includes('inputData.lead?.last_message_content')) throw new Error('Parse Memory A1 nested read missing');

  const cp2 = getNode(workflow, CODE_PARSE_MEMORY_2).parameters.jsCode;
  if (!cp2.includes('last_message_content: readLastMessageContent()')) throw new Error('Code Parse Memory 2 B1 missing after patch');
}

const workflow = await kit.loadWorkflow();
const results = patchWorkflow(workflow);
assertPatched(workflow);

if (kit.DRY) {
  console.log(JSON.stringify({ dry: true, results }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "parse-memory-tradein-state");
const { activeAfter, finalActive } = await kit.safePut(workflow, "parse-memory-tradein-state");

console.log(JSON.stringify({
  patched: true, workflowId: WORKFLOW_ID, results, activeAfter, finalActive,
}, null, 2));
