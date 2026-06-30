// Move lead_state ownership to the Memory 2 - Reconciler agent.
//
// Why (exec 405793): Memory 2 emitted only the 6 mandatory routing fields
// (intent/context_ready/missing_fields/next_best_action/summary_short/
// summary_operational) and dropped the structured state (desired_model,
// tradein_model, has_tradein, interest_type, all tradein_* evaluation fields).
// So `Code Parse Memory 2`.memory was effectively empty of state every turn and
// the pipeline relied on Parse Memory re-deriving fields by regex — lossy for
// anything the regex doesn't cover (battery %, scratches, card brand, etc.).
//
// Change:
//   Memory 2  -> its JSON output IS the full reconciled lead_state (copy prior
//                state, overlay only what changed, never omit a field).
//   Code Parse Memory 2 -> pure extraction of the delivered fields; graceful on
//                parse failure; still passes prior lead_state + last_message_content
//                so Parse Memory's deterministic net/guardrails keep working.
//
// Scope: one agent prompt + one Code node.
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. DRY=1 lê o snapshot local, não faz PUT.
import { readFile } from 'node:fs/promises';
import * as kit from "./tool/patch-kit.mjs";

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const CP2_CODE_FILE = 'scripts/n8n/repasse-code-parse-memory-2.js';

const MEMORY_2 = 'Memory 2 - Reconciler';
const CODE_PARSE_MEMORY_2 = 'Code Parse Memory 2';

// --- Memory 2 prompt: schema instruction ---
const M2_SCHEMA_OLD = `Retorne apenas JSON valido, sem markdown. O JSON deve conter obrigatoriamente:
{"intent":"aparelho_iphone|aparelho_outro|fora_do_escopo|garantia|suporte|pos_venda|administrativo|spam|desconhecida","context_ready":false,"missing_fields":[],"next_best_action":"acao curta","summary_short":"resumo curto","summary_operational":"resumo operacional curto"}`;
const M2_SCHEMA_NEW = `Voce e o DONO do lead_state: sua saida E o lead_state atualizado. Copie o LEAD_STATE ATUAL e sobreponha apenas o que mudou nesta rodada (memory_extraction + mensagem atual). NUNCA omita um campo que ja existe no LEAD_STATE ATUAL nem deixe de devolver o estado inteiro.

Retorne apenas JSON valido, sem markdown. O JSON deve conter obrigatoriamente estes campos de roteamento:
{"intent":"aparelho_iphone|aparelho_outro|fora_do_escopo|garantia|suporte|pos_venda|administrativo|spam|desconhecida","context_ready":false,"missing_fields":[],"next_best_action":"acao curta","summary_short":"resumo curto","summary_operational":"resumo operacional curto"}`;

// --- Memory 2 prompt: state fields must be carried, not optional ---
const M2_FIELDS_OLD = `- Voce pode incluir campos semanticos relevantes como desired_model, desired_capacity, desired_color, desired_condition, preferred_city, card_brand, interest_type, tradein_model, tradein_capacity, tradein_color, tradein_battery_pct, cash_entry_intent, cash_entry_amount, proposal_accepted, reservation_intent, pix_paid.`;
const M2_FIELDS_NEW = `- Voce DEVE incluir e preservar TODOS os campos de estado que existirem ou mudarem, devolvendo o lead_state completo: interest_type, desired_model, desired_capacity, desired_color, desired_condition, desired_devices, simulation_mode, preferred_city, card_brand, has_tradein, tradein_model, tradein_capacity, tradein_color, tradein_battery_pct, tradein_scratches, tradein_liquid_contact, tradein_side_marks, tradein_parts_swapped, tradein_has_box_cable, tradein_apple_warranty, tradein_warranty_until, cash_entry_intent, cash_entry_amount, proposal_accepted, reservation_intent, pix_paid, pix_amount. Campo ausente no LEAD_STATE ATUAL e sem evidencia nova = null; nunca omita o campo.`;

const M2_MARKER = 'Voce e o DONO do lead_state';
const CP2_MARKER = 'Code Parse Memory 2 (v2 — extraction only)';

async function patchWorkflow(workflow) {
  const results = {};

  // Memory 2 prompt
  const m2 = workflow.nodes.find((n) => n.name === MEMORY_2);
  if (!m2) throw new Error(`Node not found: ${MEMORY_2}`);
  let sys = m2.parameters?.options?.systemMessage;
  if (typeof sys !== 'string') throw new Error(`${MEMORY_2} has no systemMessage`);
  if (sys.includes(M2_MARKER)) {
    results.memory2 = { already: true };
  } else {
    sys = kit.replaceOnce(sys, M2_SCHEMA_OLD, M2_SCHEMA_NEW, `${MEMORY_2} schema`);
    sys = kit.replaceOnce(sys, M2_FIELDS_OLD, M2_FIELDS_NEW, `${MEMORY_2} fields`);
    m2.parameters.options.systemMessage = sys;
    results.memory2 = { already: false };
  }
  // Validator markers must survive.
  for (const marker of ['REPASSE V2 MULTI DEVICE RECONCILIATION', 'tradein_has_box_cable', 'tradein_apple_warranty']) {
    if (!m2.parameters.options.systemMessage.includes(marker)) throw new Error(`${MEMORY_2} lost validator marker: ${marker}`);
  }

  // Code Parse Memory 2 — full replace from raw code file
  const cp2 = workflow.nodes.find((n) => n.name === CODE_PARSE_MEMORY_2);
  if (!cp2) throw new Error(`Node not found: ${CODE_PARSE_MEMORY_2}`);
  if (cp2.type !== 'n8n-nodes-base.code') throw new Error(`${CODE_PARSE_MEMORY_2} must be a Code node`);
  const newCp2 = await readFile(CP2_CODE_FILE, 'utf8');
  if (!newCp2.includes(CP2_MARKER)) throw new Error('cp2 code file missing marker');
  kit.assertSyntax(newCp2, CODE_PARSE_MEMORY_2); // syntax assert
  if ((cp2.parameters.jsCode || '').includes(CP2_MARKER)) {
    results.codeParseMemory2 = { already: true };
  } else {
    cp2.parameters.jsCode = newCp2;
    results.codeParseMemory2 = { already: false };
  }

  return results;
}

const workflow = await kit.loadWorkflow();
const results = await patchWorkflow(workflow);

if (kit.DRY) {
  console.log(JSON.stringify({ dry: true, results }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "memory2-owns-leadstate");
const { activeAfter, finalActive } = await kit.safePut(workflow, "memory2-owns-leadstate");

console.log(JSON.stringify({
  patched: true, workflowId: WORKFLOW_ID, results, activeAfter, finalActive,
}, null, 2));
