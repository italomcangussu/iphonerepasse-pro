import * as kit from "./tool/patch-kit.mjs";

// Trade-in model must be detected from the CURRENT message only.
//
// Why (exec 405803): once last_message_content was wired in (the A1 fix), the
// "tradein" branch can fire. But `repasseDetectIphoneModel` builds its match from
// [text, lastMessageContent, summaryShort, summaryOperational, previousDesiredModel],
// so on a turn whose current text has no model (empty buffer-race message, "é esse
// aqui", a photo, etc.) it falls back to the DESIRED model carried in context and
// the trade-in branch wrote that into tradein_model — leaking the desired iPhone
// into trade-in. Fix: in the trade-in branch use a model parsed from the current
// message ONLY (empty context), so tradein_model is never populated from the
// desired-side context.

// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. NOTA: o nó "Parse Memory" não existe mais no vivo; patch
// histórico — hoje aborta em "Parse Memory not found" (preservado). DRY=1 não faz PUT.
const PARSE_MEMORY = 'Parse Memory';

const OLD = `const repasseCurrentMentionsTradein = /\\b(troca|trocar|de entrada|na entrada|aparelho de entrada|dar de entrada|dando de entrada|de troca)\\b/.test(normalizeFreeText(currentMessageRaw));
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

const NEW = `const repasseCurrentMentionsTradein = /\\b(troca|trocar|de entrada|na entrada|aparelho de entrada|dar de entrada|dando de entrada|de troca)\\b/.test(normalizeFreeText(currentMessageRaw));
const repasseIsTradeinTurn = repasseLastQuestionKind === "tradein" || repasseCurrentMentionsTradein;
// Trade-in model must come from the CURRENT message only — never from the desired
// model carried in context (lastMessageContent/previousDesiredModel), which would
// otherwise leak the desired iPhone into tradein_model on a model-less turn.
const repasseDetectedModelCurrent = repasseDetectIphoneModel(currentMessageRaw, {});
if (repasseIsTradeinTurn) {
  if (repasseDetectedModelCurrent) {
    memory.has_tradein = true;
    if (!memory.tradein_model) memory.tradein_model = repasseDetectedModelCurrent;
  }
} else {
  if (!memory.desired_model && repasseDetectedModel) memory.desired_model = repasseDetectedModel;
  if (repasseLastQuestionKind === "desired_model" && repasseDetectedModel) {
    memory.desired_model = repasseDetectedModel;
  }
}`;

const MARKER = 'repasseDetectedModelCurrent';

const workflow = await kit.loadWorkflow();

const node = workflow.nodes.find((n) => n.name === PARSE_MEMORY);
if (!node) throw new Error('Parse Memory not found');
let code = node.parameters.jsCode;
let already = false;
if (code.includes(MARKER)) {
  already = true;
} else {
  if (!code.includes(OLD)) throw new Error('Parse Memory A2 block not found (drifted?)');
  if (code.split(OLD).length - 1 !== 1) throw new Error('A2 block not unique');
  code = code.replace(OLD, NEW);
  node.parameters.jsCode = code;
}
new Function(node.parameters.jsCode); // syntax assert
if (!node.parameters.jsCode.includes('repasseDetectedModelCurrent = repasseDetectIphoneModel(currentMessageRaw, {})')) {
  throw new Error('patch marker missing after apply');
}

if (kit.DRY) {
  console.log(JSON.stringify({ dry: true, already }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "tradein-current-only");
const { activeAfter, finalActive } = await kit.safePut(workflow, "tradein-current-only");
console.log(JSON.stringify({ patched: true, already, activeAfter, finalActive }, null, 2));
