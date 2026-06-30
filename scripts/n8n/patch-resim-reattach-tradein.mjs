// Surgical patch — "Code Parse Re-simulacao Bia 2 ESTOQUE" (workflow AO VIVO
// Cr4fPWe0prwS6XjI).
//
// Bug observado na execução 406079 (caminho de RE-SIMULAÇÃO): o Montar Body
// re-simula SEM o aparelho de entrada (tradeInBaseValue:0). Causa: a "Bia 2
// ESTOQUE" é um agent node (@n8n/n8n-nodes-langchain.agent) que dropa todo o
// contexto upstream e emite só { output }. O "Code Parse Re-simulacao Bia 2
// ESTOQUE" só reanexa $('Edit Fields10') (que não carrega trade-in), então a
// saída chega ao Montar Body com has_tradein/tradein_* ausentes -> trade-in
// some da simulação.
//
// Fix: reanexar trade-in/entrada/cartão/desejo a partir do estado persistido em
// $('Code Refresh Lead State Before Switch2') (que roda no mesmo fluxo e tem
// has_tradein/tradein_model/... na raiz). O Montar Body já lê esses campos de
// inputData.* — basta reanexá-los na raiz da saída do parse.
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 1). DRY=1 lê o snapshot local
// e grava /tmp/repasse-resim-reattach-dry.json sem PUT.
import * as kit from "./tool/patch-kit.mjs";

const NODE_NAME = "Code Parse Re-simulacao Bia 2 ESTOQUE";

const NEEDLE = `return [
  {
    json: {
      ...sourceContext,
      ...inputData,
      router: decision,
      rerun_simulation_requested: true
    }
  }
];`;

const REPLACEMENT = `// REPASSE RESIM REATTACH TRADEIN: a "Bia 2 ESTOQUE" (agent) dropa o contexto e
// este parse só carrega Edit Fields10 (sem trade-in). Sem reanexar, o Montar
// Body re-simula SEM o aparelho de entrada. Reanexa trade-in/entrada/cartão/
// desejo a partir do estado persistido em "Code Refresh Lead State Before Switch2".
let leadCtx = {};
try { leadCtx = $('Code Refresh Lead State Before Switch2').last().json ?? {}; } catch (error) { leadCtx = {}; }
const reattach = {};
for (const k of [
  'has_tradein', 'tradein_model', 'tradein_model_accepted', 'tradein_disqualified',
  'tradein_capacity', 'tradein_color', 'tradein_battery_pct',
  'cash_entry_amount', 'card_brand',
  'desired_model', 'desired_capacity', 'desired_color', 'desired_condition'
]) {
  const v = leadCtx[k] ?? leadCtx.memory?.[k];
  if (v !== undefined && v !== null) reattach[k] = v;
}

return [
  {
    json: {
      ...sourceContext,
      ...inputData,
      ...reattach,
      router: decision,
      rerun_simulation_requested: true
    }
  }
];`;

const workflow = await kit.loadWorkflow();
const wasActive = workflow.active;
const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`${NODE_NAME} not found`);
let code = node.parameters.jsCode;
if (code.includes("REPASSE RESIM REATTACH TRADEIN")) {
  console.log("  skip [já aplicado]");
} else {
  code = kit.replaceOnce(code, NEEDLE, REPLACEMENT, "resim-reattach");
  node.parameters.jsCode = code;
  console.log("  ok [reattach trade-in na re-simulação]");
}
kit.assertSyntax(node.parameters.jsCode, NODE_NAME);
for (const m of ["REPASSE RESIM REATTACH TRADEIN", "Code Refresh Lead State Before Switch2", "...reattach"]) {
  if (!node.parameters.jsCode.includes(m)) throw new Error(`sanity falhou: ${m}`);
}

if (kit.DRY) {
  kit.dry(workflow, "/tmp/repasse-resim-reattach-dry.json");
  console.log(JSON.stringify({ dry: true }, null, 2));
  process.exit(0);
}
kit.backup(await kit.getLive(), "resim-reattach");
const { verify, activeAfter, finalActive } = await kit.safePut(workflow, "resim-reattach");
const v = verify.nodes.find((n) => n.name === NODE_NAME);
console.log(JSON.stringify({ wasActive, activeAfter, finalActive, applied: v.parameters.jsCode.includes("REPASSE RESIM REATTACH TRADEIN") }, null, 2));
