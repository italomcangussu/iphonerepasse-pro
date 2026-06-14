import { mkdir, readFile, writeFile } from 'node:fs/promises';

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

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const EXPORT_PATH = 'output/n8n/ia-repasse-pro-v2-current.json';
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

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); let v = l.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); return [l.slice(0, i).trim(), v]; }));
}
function sanitizeForUpdate(workflow) {
  const allowed = ['saveExecutionProgress', 'saveManualExecutions', 'saveDataErrorExecution', 'saveDataSuccessExecution', 'executionTimeout', 'errorWorkflow', 'timezone', 'executionOrder'];
  const settings = Object.fromEntries(Object.entries(workflow.settings ?? {}).filter(([k]) => allowed.includes(k)));
  const body = { name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings };
  if (workflow.staticData) body.staticData = workflow.staticData;
  return body;
}
async function api(origin, key, path, init = {}) {
  const r = await fetch(new URL(path, origin), { ...init, headers: { 'X-N8N-API-KEY': key, 'content-type': 'application/json', ...(init.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${init.method || 'GET'} ${path} failed: ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
}

const env = parseEnv(await readFile('.env.local', 'utf8'));
const key = env.N8N_API_KEY;
const origin = new URL(env.N8N_BASE_URL).origin;

const workflow = await api(origin, key, `/api/v1/workflows/${WORKFLOW_ID}`);
await mkdir('output/n8n/backups', { recursive: true });
const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-tradein-current-only-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await writeFile(backupPath, `${JSON.stringify(workflow, null, 2)}\n`);

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

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, already, backupPath }, null, 2));
  process.exit(0);
}

const updated = await api(origin, key, `/api/v1/workflows/${WORKFLOW_ID}`, { method: 'PUT', body: JSON.stringify(sanitizeForUpdate(workflow)) });
let active = updated.active;
if (!active) { const a = await api(origin, key, `/api/v1/workflows/${WORKFLOW_ID}/activate`, { method: 'POST' }); active = Boolean(a?.active ?? true); }
const fresh = await api(origin, key, `/api/v1/workflows/${WORKFLOW_ID}`);
await writeFile(EXPORT_PATH, `${JSON.stringify(fresh, null, 2)}\n`);
console.log(JSON.stringify({ patched: true, already, active, backupPath, exportPath: EXPORT_PATH, updatedAt: updated.updatedAt }, null, 2));
