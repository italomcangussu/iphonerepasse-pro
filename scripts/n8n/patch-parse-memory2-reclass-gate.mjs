import * as kit from "./tool/patch-kit.mjs";
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
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
// Migrado para tool/patch-kit.mjs (Fase 5): I/O único. DRY=1 lê o snapshot.

const NODE_NAME = 'Code Parse Memory 2';
const MIRROR_PATH = 'scripts/n8n/repasse-code-parse-memory-2.js';
const NEW_MARKER = 'gated 2026-06-20';

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

const workflow = await kit.loadWorkflow();
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
kit.assertSyntax(newCode, NODE_NAME); // $json / $(...) are valid syntax
node.parameters.jsCode = newCode;

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, node: NODE_NAME, liveMatchesHead: true, bytesBefore: code.length, bytesAfter: newCode.length }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "parse-memory2-reclass-gate");
const { activeAfter, finalActive } = await kit.safePut(workflow, "parse-memory2-reclass-gate");
console.log(JSON.stringify({
  patched: true, node: NODE_NAME,
  bytesBefore: code.length, bytesAfter: newCode.length, activeAfter, finalActive,
}, null, 2));
