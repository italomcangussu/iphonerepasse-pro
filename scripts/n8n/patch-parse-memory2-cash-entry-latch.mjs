import * as kit from "./tool/patch-kit.mjs";

// Make `cash_entry_asked` a durable one-way latch in "Code Parse Memory 2".
//
// Bug (observed live 2026-06-19, conversation VD): the flash-lite
// "Memory 2 - Reconciler" set cash_entry_asked=true on the turn it asked about a
// cash down payment, then DROPPED it back to false on the following turns. Since
// the persistence RPC only coalesce-protects against null (not an explicit
// false), the latch was wiped. With cash_entry_asked=false the routing gate
// computes cashEntryResolved=false -> shouldSimulateNow=false, so the workflow
// REFUSED to run the simulation even though desired+trade-in+evaluation were all
// complete (it stalled with "vou verificar e já te passo a simulação").
//
// Fix: "Code Parse Memory 2" already reads the prior persisted lead_state via
// readLeadState(). Re-apply `prior OR current` for the latch right before the
// return so it can only ever flip to true, never silently un-ask. This is the
// deterministic safety net that was lost when the old "Parse Memory" node was
// removed (2026-06-14), scoped to just this sticky field.
//
// Idempotent: re-running detects the marker and no-ops.
// Migrado para tool/patch-kit.mjs (Fase 5): I/O único. DRY=1 lê o snapshot.

const NODE_NAME = 'Code Parse Memory 2';
const MARKER = 'Sticky-latch preserve (2026-06-19)';

const ANCHOR = `} else if (!parsed.ok) {
  memory = { ...memory, parse_error: true, parse_error_reason: parsed.reason };
}

return [{`;

const REPLACEMENT = `} else if (!parsed.ok) {
  memory = { ...memory, parse_error: true, parse_error_reason: parsed.reason };
}

// ${MARKER}: cash_entry_asked is a one-way latch — once the AI has asked about a
// cash down payment, it must stay asked. The flash-lite "Memory 2 - Reconciler"
// intermittently drops it back to false on later turns, which makes
// cashEntryResolved=false and BLOCKS the simulation (see
// repasse-code-routing-flags.js). Re-apply prior OR current so it can only flip
// to true, never silently un-ask.
const __priorLeadState = readLeadState();
if (__priorLeadState && __priorLeadState.cash_entry_asked === true) {
  memory.cash_entry_asked = true;
}

return [{`;

const workflow = await kit.loadWorkflow();

const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`Node not found: ${NODE_NAME}`);
if (node.type !== 'n8n-nodes-base.code') throw new Error(`${NODE_NAME} is not a code node (got ${node.type})`);

const code = node.parameters?.jsCode;
if (typeof code !== 'string') throw new Error(`${NODE_NAME}: jsCode is not a string`);

if (code.includes(MARKER)) {
  console.log(JSON.stringify({ skipped: true, reason: 'already patched', node: NODE_NAME }, null, 2));
  process.exit(0);
}

const occurrences = code.split(ANCHOR).length - 1;
if (occurrences !== 1) {
  throw new Error(`${NODE_NAME}: expected exactly 1 anchor match, found ${occurrences} (workflow drifted? run the live guard)`);
}

const newCode = code.replace(ANCHOR, REPLACEMENT);

kit.assertSyntax(newCode, NODE_NAME);

node.parameters.jsCode = newCode;

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, node: NODE_NAME, bytesBefore: code.length, bytesAfter: newCode.length }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "cash-entry-latch");
const { activeAfter, finalActive } = await kit.safePut(workflow, "cash-entry-latch");
console.log(JSON.stringify({
  patched: true, node: NODE_NAME,
  bytesBefore: code.length, bytesAfter: newCode.length, activeAfter, finalActive,
}, null, 2));
