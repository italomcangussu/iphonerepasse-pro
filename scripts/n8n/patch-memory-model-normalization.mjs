import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Harden Memory 1 - Extractor and Memory 2 - Reconciler against model-generation
// corruption.
//
// Why (exec 418949): lead wrote "Quero comprar 17pm" (= iPhone 17 Pro Max) after
// an explicit topic change. Bia 1 (mimo-v2.5-pro) replied correctly about the
// "17 Pro Max", but Memory 1/Memory 2 run on the weaker
// google/gemini-2.5-flash-lite, which did NOT recognize the "17pm" shorthand and
// "corrected" the generation to a known one (iPhone 14 Pro Max), anchoring on the
// prior conversation. The wrong desired_model was reconciled and PERSISTED to
// lead_state — so next-turn inventory/simulation would use the wrong device while
// the bot talks about the right one.
//
// Change (prompt-only, additive, no topology):
//   Memory 1 (Extractor)   -> append a NORMALIZACAO DE MODELO block: PT-BR
//                             shorthand glossary, LITERAL generation rule
//                             (never substitute/downgrade), honor topic change.
//   Memory 2 (Reconciler)  -> append the same rule as a safety net (it owns
//                             lead_state, so it must not re-downgrade either).
//
// Scope: two agent system prompts. No Code node, no connection, no model change.
// Idempotent: re-running detects the marker and no-ops.

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const EXPORT_PATH = 'output/n8n/ia-repasse-pro-v2-current.json';

const MEMORY_1 = 'Memory 1 - Extractor';
const MEMORY_2 = 'Memory 2 - Reconciler';

const MARKER = 'NORMALIZACAO DE MODELO (APELIDOS';

// --- Anchors: each prompt's current last line (must be unique) ---
const M1_ANCHOR = '- Se o cliente esta respondendo o questionario de avaliacao do trade-in, defina interest_type = "troca".';
const M2_ANCHOR = '- Se a ULTIMA mensagem do cliente for uma correcao com asterisco (ex.: "De*", "* iPhone 14", "15 pro max*"), trate como correcao da mensagem anterior dele: sobreponha o campo correspondente, NAO crie campo novo nem mude a intencao. Correcao puramente ortografica (ex.: "De*" corrigindo "d") nao altera nenhum campo de produto.';

const M1_BLOCK = `

// NORMALIZACAO DE MODELO (APELIDOS E GERACAO LITERAL) - CRITICO
- APELIDOS PT-BR: expanda EXATAMENTE o que o cliente escreveu, sem trocar a geracao. "pm"/"promax"/"pro max" = "Pro Max"; "pro" = "Pro"; "plus" = "Plus"; "mini" = "mini". Ex.: "17pm"/"17 pm" = "iPhone 17 Pro Max"; "15 pro" = "iPhone 15 Pro"; "14plus" = "iPhone 14 Plus"; "13" = "iPhone 13"; "xr" = "iPhone XR"; "se" = "iPhone SE".
- GERACAO LITERAL: extraia o numero/geracao EXATAMENTE como o cliente digitou. NUNCA troque, rebaixe ou "corrija" a geracao (cliente disse 17 -> jamais extraia 14/15/16). A linha atual de iPhone inclui as geracoes mais novas (ate iPhone 17). Se a geracao parecer nova demais, confie no cliente: nao existe geracao "implausivel".
- TROCA DE ASSUNTO: se o cliente sinalizar novo assunto ("e outro assunto", "deixa pra la", "na verdade quero...") e citar um novo modelo, o NOVO desired_model SUBSTITUI qualquer modelo antigo do contexto/historico. NUNCA herde desired_model de turnos anteriores quando o cliente acabou de pedir outro aparelho.`;

const M2_BLOCK = `

// NORMALIZACAO DE MODELO (APELIDOS E GERACAO LITERAL) - CRITICO
- Preserve a geracao/tier EXATAMENTE como o Memory 1 extraiu ou como o cliente escreveu. NUNCA troque ou rebaixe a geracao de desired_model (jamais transforme "iPhone 17 Pro Max" em "iPhone 14 Pro Max"). A linha atual inclui as geracoes mais novas (ate iPhone 17); nao "corrija" geracao que parece nova.
- Apelidos: "pm"/"promax" = "Pro Max"; "pro" = "Pro"; "plus" = "Plus". Ex.: "17pm" = "iPhone 17 Pro Max".
- Se o cliente trocou de assunto e pediu um novo modelo, desired_model recebe o NOVO modelo (substitui o antigo do LEAD_STATE ATUAL); nao mantenha o desejo anterior por inercia.`;

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      let value = line.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      return [line.slice(0, index).trim(), value];
    }));
}

function sanitizeForUpdate(workflow) {
  const allowedSettings = [
    'saveExecutionProgress', 'saveManualExecutions', 'saveDataErrorExecution',
    'saveDataSuccessExecution', 'executionTimeout', 'errorWorkflow', 'timezone', 'executionOrder',
  ];
  const settings = Object.fromEntries(
    Object.entries(workflow.settings ?? {}).filter(([key]) => allowedSettings.includes(key)),
  );
  const body = { name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings };
  if (workflow.staticData) body.staticData = workflow.staticData;
  return body;
}

async function api(origin, key, path, init = {}) {
  const response = await fetch(new URL(path, origin), {
    ...init,
    headers: { 'X-N8N-API-KEY': key, 'content-type': 'application/json', ...(init.headers || {}) },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${init.method || 'GET'} ${path} failed: ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

function appendAfterAnchor(label, sys, anchor, block) {
  if (typeof sys !== 'string') throw new Error(`${label} has no systemMessage`);
  if (sys.includes(MARKER)) return { sys, already: true };
  if (!sys.includes(anchor)) throw new Error(`${label}: anchor not found (workflow drifted?)`);
  if (sys.split(anchor).length - 1 !== 1) throw new Error(`${label}: anchor not unique`);
  return { sys: sys.replace(anchor, anchor + block), already: false };
}

function patchWorkflow(workflow) {
  const results = {};

  const m1 = workflow.nodes.find((n) => n.name === MEMORY_1);
  if (!m1) throw new Error(`Node not found: ${MEMORY_1}`);
  const r1 = appendAfterAnchor(`${MEMORY_1} prompt`, m1.parameters?.options?.systemMessage, M1_ANCHOR, M1_BLOCK);
  m1.parameters.options.systemMessage = r1.sys;
  results.memory1 = { already: r1.already };

  const m2 = workflow.nodes.find((n) => n.name === MEMORY_2);
  if (!m2) throw new Error(`Node not found: ${MEMORY_2}`);
  const r2 = appendAfterAnchor(`${MEMORY_2} prompt`, m2.parameters?.options?.systemMessage, M2_ANCHOR, M2_BLOCK);
  m2.parameters.options.systemMessage = r2.sys;
  results.memory2 = { already: r2.already };

  // Validator markers must survive on both prompts.
  for (const [node, marker] of [
    [m1, 'REPASSE V2 MULTI DEVICE EXTRACTION'],
    [m1, 'DESAMBIGUACAO TRADE-IN vs DESEJADO'],
    [m2, 'REPASSE V2 MULTI DEVICE RECONCILIATION'],
    [m2, 'CARRY-FORWARD OBRIGATORIO'],
    [m1, MARKER],
    [m2, MARKER],
  ]) {
    if (!node.parameters.options.systemMessage.includes(marker)) {
      throw new Error(`${node.name} lost/missing marker: ${marker}`);
    }
  }

  return results;
}

const env = parseEnv(await readFile('.env.local', 'utf8'));
const key = env.N8N_API_KEY || env.N8N_PUBLIC_API;
const origin = new URL(env.N8N_BASE_URL || env.N8N_MCP_URL).origin;
if (!key) throw new Error('Missing N8N_API_KEY');

const workflow = await api(origin, key, `/api/v1/workflows/${WORKFLOW_ID}`);
const nodeCountBefore = workflow.nodes.length;
await mkdir('output/n8n/backups', { recursive: true });
const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-memory-model-normalization-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await writeFile(backupPath, `${JSON.stringify(workflow, null, 2)}\n`);

const results = patchWorkflow(workflow);
if (workflow.nodes.length !== nodeCountBefore) throw new Error('node count changed');

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, backupPath, nodeCount: nodeCountBefore, results }, null, 2));
  process.exit(0);
}

const updated = await api(origin, key, `/api/v1/workflows/${WORKFLOW_ID}`, {
  method: 'PUT', body: JSON.stringify(sanitizeForUpdate(workflow)),
});
let active = updated.active;
if (!active) {
  const activated = await api(origin, key, `/api/v1/workflows/${WORKFLOW_ID}/activate`, { method: 'POST' });
  active = Boolean(activated?.active ?? true);
}
const fresh = await api(origin, key, `/api/v1/workflows/${WORKFLOW_ID}`);
await writeFile(EXPORT_PATH, `${JSON.stringify(fresh, null, 2)}\n`);

console.log(JSON.stringify({
  patched: true, workflowId: WORKFLOW_ID, results, active, backupPath, exportPath: EXPORT_PATH, updatedAt: updated.updatedAt,
}, null, 2));
