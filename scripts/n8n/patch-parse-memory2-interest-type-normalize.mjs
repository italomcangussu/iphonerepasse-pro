import * as kit from "./tool/patch-kit.mjs";

// Normalize `interest_type` deterministically in "Code Parse Memory 2".
//
// Bug (observed live 2026-06-19, conversation VD): the reconciler prompt
// ("Memory 2 - Reconciler") never DEFINES interest_type — it only injects the
// Router "Intent: <intent_primary>" line. The flash-lite model then copies the
// intent enum (e.g. "aparelho_iphone") into interest_type, whose only valid
// values are comprar/trocar/vender/avaliar. A bad value poisons
// isIphonePurchaseFlow -> context_ready=false / eligibleForInventory=false in
// repasse-code-routing-flags.js, so the flow never reaches inventory/simulation,
// falls to Bia 1 and escalates to a human (the VD conversation got stuck in
// human_handling exactly this way).
//
// Fix: this node already reads the prior persisted lead_state (__priorLeadState).
// If the reconciler emitted an out-of-vocabulary interest_type, coerce it
// deterministically: prefer a valid prior value, else infer from the rest of the
// state (trade-in -> trocar, desired model -> comprar, only a trade-in model ->
// vender). When nothing can be inferred, leave it null (null does NOT poison the
// purchase-flow gate; a wrong enum does). Mirrors the cash_entry latch guard.
//
// Idempotent: re-running detects the marker and no-ops.
// Migrado para tool/patch-kit.mjs (Fase 5): I/O único. DRY=1 lê o snapshot.

const NODE_NAME = 'Code Parse Memory 2';
const MARKER = 'interest_type normalize (2026-06-19)';

const ANCHOR = `const __priorLeadState = readLeadState();
if (__priorLeadState && __priorLeadState.cash_entry_asked === true) {
  memory.cash_entry_asked = true;
}

return [{`;

const REPLACEMENT = `const __priorLeadState = readLeadState();
if (__priorLeadState && __priorLeadState.cash_entry_asked === true) {
  memory.cash_entry_asked = true;
}

// ${MARKER}: the reconciler prompt never defines interest_type, so flash-lite
// sometimes copies the Router intent enum (e.g. "aparelho_iphone") into it. Valid
// values are comprar/trocar/vender/avaliar; a bad one poisons isIphonePurchaseFlow
// -> context_ready/eligibleForInventory and blocks the whole sales/simulation flow
// (see repasse-code-routing-flags.js). Coerce any out-of-vocabulary value.
const __validInterest = new Set(['comprar', 'trocar', 'vender', 'avaliar']);
if (!__validInterest.has(memory.interest_type)) {
  const __prev = __priorLeadState || {};
  if (__validInterest.has(__prev.interest_type)) {
    memory.interest_type = __prev.interest_type;
  } else if (memory.has_tradein === true || __prev.has_tradein === true) {
    memory.interest_type = 'trocar';
  } else if (memory.desired_model || __prev.desired_model) {
    memory.interest_type = 'comprar';
  } else if (memory.tradein_model || __prev.tradein_model) {
    memory.interest_type = 'vender';
  } else {
    memory.interest_type = null;
  }
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
  throw new Error(`${NODE_NAME}: expected exactly 1 anchor match, found ${occurrences} (workflow drifted? run the live guard — the cash_entry latch patch must already be applied)`);
}

const newCode = code.replace(ANCHOR, REPLACEMENT);

kit.assertSyntax(newCode, NODE_NAME);

node.parameters.jsCode = newCode;

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, node: NODE_NAME, bytesBefore: code.length, bytesAfter: newCode.length }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "interest-type-normalize");
const { activeAfter, finalActive } = await kit.safePut(workflow, "interest-type-normalize");
console.log(JSON.stringify({
  patched: true, node: NODE_NAME,
  bytesBefore: code.length, bytesAfter: newCode.length, activeAfter, finalActive,
}, null, 2));
