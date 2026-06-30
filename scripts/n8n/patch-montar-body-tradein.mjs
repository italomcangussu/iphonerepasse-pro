// Surgical patch — "Montar Body do Simulador" no workflow AO VIVO (Cr4fPWe0prwS6XjI).
//
// Bug: o trade-in some do corpo do simulador (tradeInLabel "", base 0) mesmo com
// has_tradein=true no estado. Causa: o node faz `const memory = inputData.memory
// ?? inputData;` e o inputData.memory vindo do "Code Refresh Lead State Before
// Switch2" é um objeto PARCIAL (só stock_*), sem os campos de trade-in → memory.
// has_tradein vem undefined → trade-in descartado. Além disso a condição
// `tradein_disqualified === false` derruba quando o valor é null/undefined.
//
// Fix: ler has_tradein/tradein_* de várias fontes (memory, raiz inputData e o
// lead_state persistido em inputData.lead_state) e usar `!== true` para o
// disqualified. Mesmo fallback para a entrada em dinheiro (cash_entry_amount).
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. DRY=1 lê o snapshot local e grava /tmp/repasse-montarbody-dry.json sem PUT.
import fs from "node:fs";
import * as kit from "./tool/patch-kit.mjs";

const NODE_NAME = "Montar Body do Simulador";

const TRADEIN_NEEDLE = `let tradeIn = null;
if (memory.has_tradein &&
    memory.tradein_model_accepted !== false &&
    memory.tradein_disqualified === false &&
    memory.tradein_model) {
  tradeIn = {
    model:    memory.tradein_model,
    capacity: memory.tradein_capacity ?? "",
    color:    memory.tradein_color ?? ""
  };
}`;

const TRADEIN_REPLACEMENT = `// REPASSE MONTAR BODY TRADEIN SOURCES: o inputData.memory pode ser parcial
// (Code Refresh só traz stock_*); lê trade-in de memory, raiz e lead_state
// persistido. tradein_disqualified pode vir null -> usar !== true.
const tiLeadState = inputData.lead_state ?? {};
const tiHas = memory.has_tradein ?? inputData.has_tradein ?? tiLeadState.has_tradein;
const tiModel = memory.tradein_model ?? inputData.tradein_model ?? tiLeadState.tradein_model;
const tiAccepted = memory.tradein_model_accepted ?? inputData.tradein_model_accepted ?? tiLeadState.tradein_model_accepted;
const tiDisq = memory.tradein_disqualified ?? inputData.tradein_disqualified ?? tiLeadState.tradein_disqualified;
let tradeIn = null;
if (tiHas && tiAccepted !== false && tiDisq !== true && tiModel) {
  tradeIn = {
    model:    tiModel,
    capacity: memory.tradein_capacity ?? inputData.tradein_capacity ?? tiLeadState.tradein_capacity ?? "",
    color:    memory.tradein_color ?? inputData.tradein_color ?? tiLeadState.tradein_color ?? ""
  };
}`;

const CASH_NEEDLE = `const cashEntryAmount = toPositiveNumber(memory.cash_entry_amount ?? inputData.cash_entry_amount);`;
const CASH_REPLACEMENT = `const cashEntryAmount = toPositiveNumber(memory.cash_entry_amount ?? inputData.cash_entry_amount ?? (inputData.lead_state ?? {}).cash_entry_amount);`;

const workflow = await kit.loadWorkflow();
const wasActive = workflow.active;
const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`${NODE_NAME} not found`);
let code = node.parameters.jsCode;
if (code.includes("REPASSE MONTAR BODY TRADEIN SOURCES")) {
  console.log("  skip [já aplicado]");
} else {
  if (code.split(TRADEIN_NEEDLE).length - 1 !== 1) throw new Error("needle trade-in não-único");
  code = code.replace(TRADEIN_NEEDLE, TRADEIN_REPLACEMENT);
  if (code.split(CASH_NEEDLE).length - 1 !== 1) throw new Error("needle cash não-único");
  code = code.replace(CASH_NEEDLE, CASH_REPLACEMENT);
  node.parameters.jsCode = code;
  console.log("  ok [trade-in + cash sources]");
}
new Function("$input", "$", "DateTime", "$helpers", "$jmespath", node.parameters.jsCode);
for (const m of ["REPASSE MONTAR BODY TRADEIN SOURCES", "tiDisq !== true", "tiLeadState.has_tradein"]) {
  if (!node.parameters.jsCode.includes(m)) throw new Error(`sanity falhou: ${m}`);
}

if (kit.DRY) {
  fs.writeFileSync("/tmp/repasse-montarbody-dry.json", JSON.stringify(workflow, null, 2));
  console.log(JSON.stringify({ dry: true }, null, 2));
  process.exit(0);
}
kit.backup(await kit.getLive(), "montarbody-tradein");
const { verify, activeAfter, finalActive } = await kit.safePut(workflow, "montarbody-tradein");
const v = verify.nodes.find((n) => n.name === NODE_NAME);
console.log(JSON.stringify({ wasActive, activeAfter, finalActive, applied: v.parameters.jsCode.includes("REPASSE MONTAR BODY TRADEIN SOURCES") }, null, 2));
