// Surgical patch — fecha os "buckets 1 e 2" de campos do lead_state que hoje caem
// para null toda rodada porque o Edit Fields5 lê tudo de `$json` (= memory do
// Memory 2 - Reconciler) e esses campos não estão no schema de saída dos agentes.
// Como `Parse Memory` (preserve() determinístico) foi removido, qualquer campo que
// o Memory 2 não emitir é perdido entre rodadas.
//
//   Bucket 1 (fatos do cliente) -> Memory 1 EXTRAI + Memory 2 PRESERVA/echo:
//     intent_secondary, sentiment_current, objection_current, desired_device_type,
//     secondary_color_simulation, pickup_datetime,
//     cadastro_solicitado, cadastro_nome_completo, cadastro_data_nascimento,
//     cadastro_cpf, cadastro_contato, cadastro_completo
//   Bucket 2 (derivados de regra) -> Memory 2 DERIVA dos insumos já no estado:
//     tradein_battery_suspect, tradein_disqualified, tradein_evaluation_pending,
//     tradein_model_accepted, tradein_rejected_reason,
//     cross_city_situation, hdi_city_needed, client_outside_ce
//
// Anti-alucinação: as regras são conservadoras (null/preserve quando faltar
// evidência; nunca inventar CPF/nome/cidade do estoque/elegibilidade).
// Buckets 3 (determinísticos: estoque/simulador/funil) e 4 (flags de roteamento)
// NÃO entram aqui — serão cabeados no Edit Fields5, não nos prompts.
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. DRY=1 lê o snapshot local e grava /tmp/repasse-bucket12-dry.json sem PUT.
import fs from "node:fs";
import * as kit from "./tool/patch-kit.mjs";

// ---------------- Memory 1 - Extractor ----------------
const M1_NEEDLE =
  "- facts pode conter campos como desired_model, desired_capacity, desired_color, desired_condition, preferred_city, card_brand, interest_type, tradein_model, tradein_capacity, tradein_color, tradein_battery_pct, cash_entry_intent, cash_entry_amount, proposal_accepted, reservation_intent, pix_paid.";

const M1_REPLACEMENT =
  "- facts pode conter campos como desired_model, desired_capacity, desired_color, desired_condition, desired_device_type, secondary_color_simulation, preferred_city, card_brand, interest_type, tradein_model, tradein_capacity, tradein_color, tradein_battery_pct, cash_entry_intent, cash_entry_amount, proposal_accepted, reservation_intent, pix_paid, pickup_datetime.\n" +
  "\n" +
  "// REPASSE V2 SINAIS E CADASTRO (EXTRACAO)\n" +
  "- intent_secondary: segunda intencao clara na MESMA mensagem (ex.: duvida de garantia junto da compra); null se nao houver.\n" +
  "- sentiment_current: tom do cliente NESTA mensagem (\"positivo\"|\"neutro\"|\"negativo\"|\"frustrado\"|\"ansioso\"); null se indefinido.\n" +
  "- objection_current: objecao explicita NESTA mensagem (\"preco\"|\"prazo\"|\"confianca\"|\"bateria\"|\"cidade\"|\"outro\"); null se nao houver.\n" +
  "- desired_device_type: \"iphone\"|\"outro\" conforme o aparelho que o cliente quer COMPRAR; nunca o aparelho de entrada.\n" +
  "- pickup_datetime: data/hora de retirada que o cliente combinar nesta mensagem (texto curto ou ISO); null caso contrario.\n" +
  "- Dados cadastrais SOMENTE quando o cliente os enviar explicitamente: cadastro_nome_completo, cadastro_data_nascimento, cadastro_cpf, cadastro_contato. Marque cadastro_solicitado=true apenas se o atendimento tiver pedido cadastro. NUNCA invente CPF, nome, data ou contato.";

// ---------------- Memory 2 - Reconciler ----------------
const M2_NEEDLE =
  "interest_type, desired_model, desired_capacity, desired_color, desired_condition, desired_devices, simulation_mode, preferred_city, card_brand, has_tradein, tradein_model, tradein_capacity, tradein_color, tradein_battery_pct, tradein_scratches, tradein_liquid_contact, tradein_side_marks, tradein_parts_swapped, tradein_has_box_cable, tradein_apple_warranty, tradein_warranty_until, cash_entry_intent, cash_entry_amount, proposal_accepted, reservation_intent, pix_paid, pix_amount.";

const M2_REPLACEMENT =
  "interest_type, intent_secondary, sentiment_current, objection_current, desired_model, desired_capacity, desired_color, desired_condition, desired_device_type, secondary_color_simulation, desired_devices, simulation_mode, preferred_city, card_brand, has_tradein, tradein_model, tradein_model_accepted, tradein_rejected_reason, tradein_capacity, tradein_color, tradein_battery_pct, tradein_battery_suspect, tradein_scratches, tradein_liquid_contact, tradein_side_marks, tradein_parts_swapped, tradein_has_box_cable, tradein_apple_warranty, tradein_warranty_until, tradein_disqualified, tradein_evaluation_pending, cross_city_situation, hdi_city_needed, client_outside_ce, cash_entry_intent, cash_entry_amount, proposal_accepted, reservation_intent, pix_paid, pix_amount, pickup_datetime, cadastro_solicitado, cadastro_nome_completo, cadastro_data_nascimento, cadastro_cpf, cadastro_contato, cadastro_completo.\n" +
  "\n" +
  "// REPASSE V2 CAMPOS DERIVADOS E CADASTRO (RECONCILIACAO)\n" +
  "- Preserve sempre os sinais e cadastro vindos do Memory 1: intent_secondary, sentiment_current, objection_current, desired_device_type, secondary_color_simulation, pickup_datetime, cadastro_solicitado, cadastro_nome_completo, cadastro_data_nascimento, cadastro_cpf, cadastro_contato. Copie do LEAD_STATE ATUAL quando nao mudarem.\n" +
  "- cadastro_completo = true somente quando cadastro_nome_completo, cadastro_data_nascimento, cadastro_cpf e cadastro_contato existirem; caso contrario false.\n" +
  "- tradein_evaluation_pending = true enquanto has_tradein=true e qualquer um de tradein_capacity, tradein_color, tradein_battery_pct, tradein_scratches, tradein_liquid_contact, tradein_side_marks, tradein_parts_swapped, tradein_has_box_cable, tradein_apple_warranty estiver null; senao false.\n" +
  "- tradein_battery_suspect = true se tradein_battery_pct parecer suspeito (ex.: 100% em aparelho usado antigo) ou houver indicio de bateria trocada; senao false.\n" +
  "- tradein_disqualified = true apenas com evidencia explicita (contato grave com liquido, tela quebrada, peca trocada incompativel); senao preserve o valor atual ou false.\n" +
  "- tradein_model_accepted / tradein_rejected_reason: defina SOMENTE quando o atendimento explicitar aceite ou recusa do aparelho de entrada; nao invente elegibilidade. null enquanto indefinido.\n" +
  "- client_outside_ce = true se preferred_city for fora do Ceara (CE); null se a cidade do cliente for desconhecida.\n" +
  "- cross_city_situation / hdi_city_needed: derive SOMENTE com a cidade do cliente e a cidade do estoque ja conhecidas no contexto; NUNCA invente a cidade do estoque. null quando faltar dado.";

// ---------------- Run ----------------
const workflow = await kit.loadWorkflow();
const wasActive = workflow.active;

const m1 = workflow.nodes.find((n) => n.name === "Memory 1 - Extractor");
if (!m1) throw new Error("Memory 1 - Extractor not found");
if (m1.parameters.options.systemMessage.includes("REPASSE V2 SINAIS E CADASTRO")) {
  console.log("  skip [Memory 1 já patchado]");
} else {
  m1.parameters.options.systemMessage = kit.replaceOnce(
    m1.parameters.options.systemMessage, M1_NEEDLE, M1_REPLACEMENT, "Memory 1 facts + sinais/cadastro");
  console.log("  ok [Memory 1 facts + sinais/cadastro]");
}

const m2 = workflow.nodes.find((n) => n.name === "Memory 2 - Reconciler");
if (!m2) throw new Error("Memory 2 - Reconciler not found");
if (m2.parameters.options.systemMessage.includes("REPASSE V2 CAMPOS DERIVADOS E CADASTRO")) {
  console.log("  skip [Memory 2 já patchado]");
} else {
  m2.parameters.options.systemMessage = kit.replaceOnce(
    m2.parameters.options.systemMessage, M2_NEEDLE, M2_REPLACEMENT, "Memory 2 preserve + derivados/cadastro");
  console.log("  ok [Memory 2 preserve + derivados/cadastro]");
}

if (kit.DRY) {
  fs.writeFileSync("/tmp/repasse-bucket12-dry.json", JSON.stringify(workflow, null, 2));
  console.log(JSON.stringify({
    dry: true,
    wrote: "/tmp/repasse-bucket12-dry.json",
    m1HasBlock: m1.parameters.options.systemMessage.includes("REPASSE V2 SINAIS E CADASTRO"),
    m2HasBlock: m2.parameters.options.systemMessage.includes("REPASSE V2 CAMPOS DERIVADOS E CADASTRO"),
  }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "bucket12");
const { verify, activeAfter, finalActive } = await kit.safePut(workflow, "bucket12");
const vm1 = verify.nodes.find((n) => n.name === "Memory 1 - Extractor");
const vm2 = verify.nodes.find((n) => n.name === "Memory 2 - Reconciler");
console.log(JSON.stringify({
  workflowId: verify.id,
  wasActive,
  activeAfter,
  finalActive,
  m1Patched: vm1.parameters.options.systemMessage.includes("REPASSE V2 SINAIS E CADASTRO"),
  m2Patched: vm2.parameters.options.systemMessage.includes("REPASSE V2 CAMPOS DERIVADOS E CADASTRO"),
}, null, 2));
