import * as kit from "./tool/patch-kit.mjs";

// Deterministic guard in "Code Parse Memory 2": a second iPhone given after the
// desired is already set = the ENTRY/trade-in device, NOT a desired switch.
//
// Why (lead VD; smoke 419186/419190/419195): the opener asks "qual deseja
// comprar?" + "qual o aparelho atual?". Client: "17pm" then "14pm". The flash-
// lite reconciler overwrote desired_model 17 Pro Max -> 14 Pro Max with
// has_tradein=false, so the flow never entered trade-in qualification. Two
// reconciler prompt rules + a Bia ordering rule did NOT move the weak model, and
// routing's next_best_action kept the Bia asking capacity/color of the (wrong)
// desired. So we fix it deterministically downstream, where the reconciler output
// is already plain JS (same node as the interest_type/cash-latch guards).
//
// Rule: if a desired_model was already locked (prev lead_state) and the new
// reconciled desired_model is a DIFFERENT single model, WITHOUT an explicit
// switch phrase in the current message ("na verdade quero...", "mudei de ideia",
// "prefiro o..."), and no trade-in is captured yet, restore the prior desired and
// move the new model to tradein_model (has_tradein=true, interest_type="trocar").
// The switch phrases are the escape hatch for a genuine change of desire.
//
// Edits parameters.jsCode. Idempotent (marker).
// Migrado para tool/patch-kit.mjs (Fase 5): I/O único. DRY=1 lê o snapshot.

const NODE_NAME = 'Code Parse Memory 2';
const MARKER = 'tradein reclass (2026-06-19)';

const ANCHOR = '\nreturn [{\n  json: {\n    ...$json,';

const BLOCK = `
// tradein reclass (2026-06-19): a second iPhone named after the desired is already
// set is the ENTRY/trade-in device, not a desired switch. The flash-lite reconciler
// overwrites desired_model with the client's current device when they answer the
// opener's "qual o aparelho atual?" with a model (desired 17 Pro Max set -> client
// says "14pm" -> reconciler wrongly sets desired_model=14 Pro Max). Restore the
// original desired and move the new model to trade-in, unless the client explicitly
// switched what they want to buy.
function __normModel(s) { return String(s || '').toLowerCase().replace(/\\s+/g, ' ').trim(); }
const __prevDesired = (__priorLeadState && __priorLeadState.desired_model) || null;
const __newDesired = memory.desired_model || null;
let __curMsg = '';
try { __curMsg = String($('Edit Fields4').last().json?.buffer?.message_buffered || '').toLowerCase(); } catch (e) { __curMsg = ''; }
const __switchIntent = /(na verdade|mudei de ideia|muda pra|muda para|prefiro o|quero mesmo o|quero o outro|na real quero|pode ser o)/.test(__curMsg);
const __noTradeinYet = !memory.tradein_model && memory.has_tradein !== true;
const __singleDevice = !memory.desired_devices || (Array.isArray(memory.desired_devices) && memory.desired_devices.length <= 1);
if (
  __prevDesired &&
  __newDesired &&
  __normModel(__prevDesired) !== __normModel(__newDesired) &&
  !__switchIntent &&
  __noTradeinYet &&
  __singleDevice
) {
  memory.tradein_model = __newDesired;
  memory.desired_model = __prevDesired;
  memory.desired_capacity = (__priorLeadState && __priorLeadState.desired_capacity) ?? memory.desired_capacity ?? null;
  memory.has_tradein = true;
  memory.interest_type = 'trocar';
  memory.tradein_reclassified = true;
}
`;

const workflow = await kit.loadWorkflow();

const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`Node not found: ${NODE_NAME}`);
const code = node.parameters?.jsCode;
if (typeof code !== 'string') throw new Error(`${NODE_NAME}: parameters.jsCode is not a string`);

if (code.includes(MARKER)) {
  console.log(JSON.stringify({ skipped: true, reason: 'already patched', node: NODE_NAME }, null, 2));
  process.exit(0);
}

const occ = code.split(ANCHOR).length - 1;
if (occ !== 1) throw new Error(`${NODE_NAME}: expected exactly 1 anchor match, found ${occ} (drift? run the live guard)`);

const newCode = code.replace(ANCHOR, `${BLOCK}${ANCHOR}`);

// Syntax assertion: only parses; $json / $(...) are valid syntax.
kit.assertSyntax(newCode, NODE_NAME);

node.parameters.jsCode = newCode;

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, node: NODE_NAME, bytesBefore: code.length, bytesAfter: newCode.length }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "parse-memory2-tradein-reclass");
const { activeAfter, finalActive } = await kit.safePut(workflow, "parse-memory2-tradein-reclass");
console.log(JSON.stringify({
  patched: true, node: NODE_NAME,
  bytesBefore: code.length, bytesAfter: newCode.length, activeAfter, finalActive,
}, null, 2));
