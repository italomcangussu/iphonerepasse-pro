// Surgical patch — restaura o BACK-FILL determinístico (carry-forward) no
// "Code Parse Memory 2" do workflow AO VIVO (Cr4fPWe0prwS6XjI).
//
// Por quê (raiz do stall + re-ask de entrada + avaliação sumindo):
//  Desde 2026-06-14 o "Memory 2 - Reconciler" (flash-lite, LLM) é dono do
//  lead_state e o nó "Parse Memory" (que tinha o preserve() determinístico) foi
//  DELETADO. Resultado: quando o reconciler DROPA um campo sticky (retorna null
//  ou omite) num turno, o turno ENXERGA estado vazio — ex.: desired_model=null ->
//  context_ready=false -> Bia 1 trava com "vou verificar e já volto". O DB até
//  preserva via coalesce na RPC, mas a DECISÃO do turno usa o `memory` do turno.
//
//  Fix: para uma whitelist de campos carry-forward, se o reconciler dropou
//  (null/undefined) mas o `prev` (lead_state persistido) tem valor, mantém o
//  prev. NUNCA bloqueia mudança real (uma troca é um SET para valor novo, não
//  um null) e espelha o coalesce-preserve da RPC, alinhando turno e DB.
//
//  Roda DEPOIS dos preserves cirúrgicos existentes (cash_entry_asked latch,
//  interest_type normalize, trade-in reclass) para não interferir neles —
//  cash_entry_asked fica de fora (já tem latch próprio prior-OR-current).
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 1). DRY=1 lê o snapshot local
// e grava /tmp/repasse-carryforward-dry.json sem PUT.
import * as kit from "./tool/patch-kit.mjs";

const NODE = "Code Parse Memory 2";

const ANCHOR = `return [{
  json: {
    ...$json,
    last_message_content: readLastMessageContent(),
    lead_state: readLeadState(),
    memory,`;

const BACKFILL = `// Carry-forward determinístico (2026-06-20): o flash-lite "Memory 2 - Reconciler"
// intermitentemente DROPA campos sticky (null/omitido) num turno, fazendo o turno
// enxergar estado vazio (ex.: desired_model null -> context_ready false -> Bia 1
// trava com "vou verificar e já volto"). O preserve() determinístico foi removido
// junto com o "Parse Memory" (2026-06-14). Restaurado aqui: se o reconciler dropou
// (null/undefined) mas o prev tem valor, mantém o prev. Nunca bloqueia troca real
// (troca é SET para valor novo, não null) e espelha o coalesce-preserve da RPC.
// cash_entry_asked fica de fora (tem latch próprio prior-OR-current acima).
const __CARRY_FORWARD = [
  'desired_model', 'desired_capacity', 'desired_color', 'desired_condition',
  'has_tradein', 'tradein_model', 'tradein_capacity', 'tradein_color',
  'tradein_battery_pct', 'tradein_battery_suspect', 'tradein_scratches',
  'tradein_liquid_contact', 'tradein_side_marks', 'tradein_parts_swapped',
  'tradein_has_box_cable', 'tradein_apple_warranty', 'tradein_warranty_until',
  'tradein_disqualified', 'tradein_model_accepted', 'tradein_rejected_reason',
  'cash_entry_intent', 'cash_entry_amount',
  'simulation_done', 'simulation_count', 'last_simulation_total',
  'secondary_color_simulation',
  'preferred_city', 'stock_city', 'stock_item_id',
  'proposal_accepted', 'reservation_intent', 'pix_data_sent', 'pix_paid', 'pix_amount',
  'pickup_datetime', 'pickup_city',
  'cadastro_solicitado', 'cadastro_nome_completo', 'cadastro_data_nascimento',
  'cadastro_cpf', 'cadastro_contato', 'cadastro_completo',
];
if (__priorLeadState && typeof __priorLeadState === 'object') {
  for (const __k of __CARRY_FORWARD) {
    const __cur = memory[__k];
    if (__cur === null || __cur === undefined) {
      const __prevVal = __priorLeadState[__k];
      if (__prevVal !== null && __prevVal !== undefined) memory[__k] = __prevVal;
    }
  }
}

`;

const workflow = await kit.loadWorkflow();
const wasActive = workflow.active;

const node = workflow.nodes.find((n) => n.name === NODE);
if (!node) throw new Error(`${NODE} não encontrado`);
const code = node.parameters?.jsCode ?? "";

// --- pré-condições / idempotência ---
if (code.includes("__CARRY_FORWARD")) {
  console.log(JSON.stringify({ noop: true, reason: "carry-forward já presente" }, null, 2));
  process.exit(0);
}
if (!code.includes(ANCHOR)) throw new Error("anchor do return não encontrado (workflow mudou?)");
if ((code.split(ANCHOR).length - 1) !== 1) throw new Error("anchor deveria aparecer 1x");
if (!code.includes("const __priorLeadState = readLeadState();")) {
  throw new Error("__priorLeadState não definido no nó — back-fill não teria a fonte prev");
}

const next = code.replace(ANCHOR, BACKFILL + ANCHOR);
kit.assertSyntax(next, NODE); // syntax-assert (não executa)

// --- pós-condições ---
if (!next.includes("__CARRY_FORWARD")) throw new Error("back-fill não aplicado");
if ((next.split("return [{").length - 1) !== 1) throw new Error("return duplicado após edit");
node.parameters.jsCode = next;

if (kit.DRY) {
  kit.dry(workflow, "/tmp/repasse-carryforward-dry.json");
  console.log(JSON.stringify({ dry: true, bytesAdded: next.length - code.length }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "parse-memory2-carryforward");
const { verify, activeAfter, finalActive } = await kit.safePut(workflow, "parse-memory2-carryforward");
const vCode = verify.nodes.find((n) => n.name === NODE)?.parameters?.jsCode ?? "";
console.log(JSON.stringify({
  workflowId: verify.id, wasActive, activeAfter, finalActive,
  carryForwardLive: vCode.includes("__CARRY_FORWARD"),
}, null, 2));
