// Surgical patch — "Memory 2 - Reconciler" prompt (workflow AO VIVO Cr4fPWe0prwS6XjI).
//
// Adiciona o campo cash_entry_asked à lista de estado e um bloco de instruções
// para o reconciler capturar a entrada em dinheiro/Pix:
//   - cash_entry_asked: a IA já perguntou sobre entrada antes de simular.
//   - cash_entry_intent / cash_entry_amount: resposta do cliente.
// Edita o texto do node AO VIVO (idempotente via marcador). DRY=1 não faz PUT.
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. DRY=1 lê o snapshot local, não faz PUT.
import * as kit from "./tool/patch-kit.mjs";

const NODE_NAME = "Memory 2 - Reconciler";

const FIELD_NEEDLE = "cross_city_situation, hdi_city_needed, client_outside_ce, cash_entry_intent, cash_entry_amount, proposal_accepted";
const FIELD_REPL = "cross_city_situation, hdi_city_needed, client_outside_ce, cash_entry_asked, cash_entry_intent, cash_entry_amount, proposal_accepted";

const ANCHOR = "- Nao deixe desired_model igual ao tradein_model por confusao de origem; se a unica evidencia for o aparelho de entrada, desired_model permanece como estava (ou null).";
const BLOCK = ANCHOR + "\n\n// ENTRADA EM DINHEIRO/PIX (antes de simular)\n"
  + "- cash_entry_asked: marque true quando a ULTIMA mensagem do atendimento perguntou se o cliente deseja dar algum valor de entrada (dinheiro/Pix) antes de simular. Uma vez true, mantenha true.\n"
  + "- cash_entry_intent: true se o cliente quer dar entrada; false se recusou (ex.: \"nao\", \"so no cartao\", \"sem entrada\", \"tudo parcelado\"). null enquanto nao respondeu.\n"
  + "- cash_entry_amount: o valor da entrada em reais quando informado (apenas o numero). Se o cliente disse que quer dar entrada mas nao deu o valor, mantenha null e cash_entry_intent = true.\n"
  + "- Nao confunda a entrada (cash_entry) com a bandeira do cartao: \"dou 500 no Pix\" define cash_entry_amount=500/cash_entry_intent=true e NAO muda card_brand.";

const workflow = await kit.loadWorkflow();
const wasActive = workflow.active;
const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`${NODE_NAME} not found`);
node.parameters.options = node.parameters.options ?? {};
let text = node.parameters.options.systemMessage;
if (typeof text !== "string") throw new Error("Memory 2 options.systemMessage not a string");

if (text.includes("ENTRADA EM DINHEIRO/PIX (antes de simular)")) {
  console.log("  skip [já aplicado]");
} else {
  text = kit.replaceOnce(text, FIELD_NEEDLE, FIELD_REPL, "needle campos");
  text = kit.replaceOnce(text, ANCHOR, BLOCK, "anchor");
  node.parameters.options.systemMessage = text;
  console.log("  ok [cash_entry no reconciler]");
}
for (const m of ["cash_entry_asked, cash_entry_intent", "ENTRADA EM DINHEIRO/PIX (antes de simular)"]) {
  if (!node.parameters.options.systemMessage.includes(m)) throw new Error(`sanity falhou: ${m}`);
}

if (kit.DRY) {
  console.log(JSON.stringify({ dry: true, len: node.parameters.options.systemMessage.length }, null, 2));
  process.exit(0);
}
kit.backup(await kit.getLive(), "m2-cashentry");
const { verify, activeAfter, finalActive } = await kit.safePut(workflow, "m2-cashentry");
const v = verify.nodes.find((n) => n.name === NODE_NAME);
console.log(JSON.stringify({ wasActive, activeAfter, finalActive, applied: v.parameters.options.systemMessage.includes("ENTRADA EM DINHEIRO/PIX (antes de simular)") }, null, 2));
