import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const pExecFile = promisify(execFile);

// Gate the "tradein reclass" guard in "Code Parse Memory 2" (2026-06-20).
//
// Why: the 2026-06-19 reclass fired on ANY desired_model change without a switch
// phrase, so a plain browsing turn ("tem o 17?" ... "e o 16?") fabricated a
// phantom trade-in and reverted the desired. The fix gates the reclass on the bot
// having ACTUALLY asked for the current device — via a quoted reply OR the last
// assistant message (classifyBiaQuestion === 'tradein_model'). Pure logic mirror:
// scripts/n8n/tool/parsers/blocks/reply_attribution.block.js (decideTradeinReclass),
// covered by scripts/n8n/tool/tests/reply-attribution.test.mjs.
//
// Strategy (escaping-proof): the byte-exact guard mirror
// scripts/n8n/repasse-code-parse-memory-2.js IS the source of truth and the guard
// reports the workflow in-sync. So live jsCode must equal the mirror at git HEAD;
// we assert that byte-for-byte and, if so, swap in the current (gated) mirror. Any
// mismatch => drift => abort (run `node scripts/n8n/guard-live-workflow-sync.mjs`).
//
// new Function() syntax-asserts. Idempotent (new marker). DRY=1 previews.

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const NODE_NAME = 'Code Parse Memory 2';
const MIRROR_PATH = 'scripts/n8n/repasse-code-parse-memory-2.js';
const NEW_MARKER = 'gated 2026-06-20';

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

function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      return { index: i, a: JSON.stringify(a.slice(Math.max(0, i - 30), i + 30)), b: JSON.stringify(b.slice(Math.max(0, i - 30), i + 30)) };
    }
  }
  return { index: n, a: `len ${a.length}`, b: `len ${b.length}` };
}

const oldMirror = (await pExecFile('git', ['show', `HEAD:${MIRROR_PATH}`])).stdout;
const newMirror = await readFile(MIRROR_PATH, 'utf8');

if (!newMirror.includes(NEW_MARKER)) {
  throw new Error(`Working mirror ${MIRROR_PATH} does not contain the new gate (marker "${NEW_MARKER}"). Edit the mirror first.`);
}
if (oldMirror.includes(NEW_MARKER)) {
  throw new Error(`HEAD mirror already contains "${NEW_MARKER}" — nothing to deploy from git HEAD.`);
}

const env = parseEnv(await readFile('.env.local', 'utf8'));
const key = env.N8N_API_KEY || env.N8N_PUBLIC_API;
const origin = new URL(env.N8N_BASE_URL || env.N8N_MCP_URL).origin;
if (!key) throw new Error('Missing N8N_API_KEY');

const workflow = await api(origin, key, `/api/v1/workflows/${WORKFLOW_ID}`);
const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`Node not found: ${NODE_NAME}`);
const code = node.parameters?.jsCode;
if (typeof code !== 'string') throw new Error(`${NODE_NAME}: parameters.jsCode is not a string`);

if (code.includes(NEW_MARKER)) {
  console.log(JSON.stringify({ skipped: true, reason: 'already gated', node: NODE_NAME }, null, 2));
  process.exit(0);
}

// Byte-exact safety: live MUST equal the HEAD mirror (guard reported in-sync).
if (code !== oldMirror) {
  const d = firstDiff(code, oldMirror);
  throw new Error(
    `${NODE_NAME}: live jsCode != HEAD mirror (drift). First diff @${d.index}\n  live: ${d.a}\n  head: ${d.b}\n` +
    `Run: node scripts/n8n/guard-live-workflow-sync.mjs`,
  );
}

const newCode = newMirror;
new Function(newCode); // syntax assert ($json / $(...) are valid syntax)
node.parameters.jsCode = newCode;

await mkdir('output/n8n/backups', { recursive: true });
const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-parse-memory2-reclass-gate-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await writeFile(backupPath, `${JSON.stringify(workflow, null, 2)}\n`);

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, backupPath, node: NODE_NAME, liveMatchesHead: true, bytesBefore: code.length, bytesAfter: newCode.length }, null, 2));
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

console.log(JSON.stringify({
  patched: true, workflowId: WORKFLOW_ID, node: NODE_NAME,
  bytesBefore: code.length, bytesAfter: newCode.length, active, backupPath, updatedAt: updated.updatedAt,
}, null, 2));
