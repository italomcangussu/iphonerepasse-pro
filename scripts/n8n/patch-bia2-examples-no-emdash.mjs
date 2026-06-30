import * as kit from "./tool/patch-kit.mjs";

// Remove em-dash from the 3 example "message" strings in Bia 2 ESTOQUE (2026-06-20).
//
// Why: the anti-tell humanization guard (validate-repasse-next-workflow.mjs) forbids
// em-dash inside example "message" strings — they teach the model robotic style. The
// 2026-06-18 commercial evolution introduced 3 reservation/proposal examples with "—".
// The runtime humanizer (repasseHumanizeMessage) already strips em-dash from real
// replies, so this only cleans the prompt examples (no customer-facing change).
//
// Targeted (NOT global): section headers like "NATURALIDADE — SEM CARA DE IA" MUST
// keep their em-dash (the guard asserts that header). Both replacement substrings are
// unique to the message examples.
//
// Idempotent. Migrado para tool/patch-kit.mjs (Fase 5): I/O único. DRY=1 lê o snapshot.

const NODE_NAME = 'Bia 2 ESTOQUE';

const EDITS = [
  { old: 'Pix — e esse valor', new: 'Pix, e esse valor', expect: 2 },
  { old: 'parcelada — quer que', new: 'parcelada. Quer que', expect: 1 },
];

const workflow = await kit.loadWorkflow();
const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`Node not found: ${NODE_NAME}`);
let sm = node.parameters?.options?.systemMessage;
if (typeof sm !== 'string') throw new Error(`${NODE_NAME}: options.systemMessage is not a string`);

const results = [];
let changed = false;
for (const edit of EDITS) {
  const occOld = sm.split(edit.old).length - 1;
  if (occOld === 0 && sm.includes(edit.new)) { results.push({ edit: edit.old, status: 'already-applied' }); continue; }
  if (occOld !== edit.expect) {
    throw new Error(`${NODE_NAME}: expected ${edit.expect} match(es) for "${edit.old}", found ${occOld} (drift? run the live guard)`);
  }
  sm = sm.split(edit.old).join(edit.new);
  changed = true;
  results.push({ edit: edit.old, status: 'patched', replaced: occOld });
}

if (!changed) {
  console.log(JSON.stringify({ skipped: true, reason: 'all edits already applied', results }, null, 2));
  process.exit(0);
}

// Safety: no em-dash may remain inside example "message" strings (the guard's rule).
const remaining = [...sm.matchAll(/"message":\s*"((?:[^"\\]|\\.)*)"/g)]
  .map((m) => m[1]).filter((msg) => msg.includes('—'));
if (remaining.length) throw new Error(`em-dash still present in ${remaining.length} example message(s) after edits`);

node.parameters.options.systemMessage = sm;

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, node: NODE_NAME, results }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "bia2-examples-no-emdash");
const { activeAfter, finalActive } = await kit.safePut(workflow, "bia2-examples-no-emdash");
console.log(JSON.stringify({ patched: true, node: NODE_NAME, results, activeAfter, finalActive }, null, 2));
