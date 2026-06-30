// Surgical patch — corrige o reattach de trade-in no caminho de RE-SIMULAÇÃO
// disparado pela escolha de variante/cor, no workflow AO VIVO (Cr4fPWe0prwS6XjI).
//
// Bug (exposto pelo novo fluxo "apresentar variantes → cliente escolhe cor"):
//  "Code Parse Re-simulacao Bia 2 ESTOQUE" reanexa trade-in lendo de
//  $('Code Refresh Lead State Before Switch2'), MAS esse nó pertence ao branch da
//  1ª simulação (Switch3) e NÃO roda quando o agente dispara um rerun_simulation
//  pela escolha de cor. Resultado: leadCtx={}, reattach vazio, e o Montar Body
//  re-simula SEM a troca (mostra o preço cheio em vez de abater o aparelho de
//  entrada). "CRM Leads GET" roda em TODO turno e carrega o lead_state persistido.
//
//  Fix: adiciona CRM Leads GET (lead_state) como fonte de fallback do reattach.
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. DRY=1 lê o snapshot local e grava /tmp/repasse-resim-reattach-dry.json sem PUT.
import fs from "node:fs";
import * as kit from "./tool/patch-kit.mjs";

const NODE = "Code Parse Re-simulacao Bia 2 ESTOQUE";

const OLD = `let leadCtx = {};
try { leadCtx = $('Code Refresh Lead State Before Switch2').last().json ?? {}; } catch (error) { leadCtx = {}; }
const reattach = {};
for (const k of [
  'has_tradein', 'tradein_model', 'tradein_model_accepted', 'tradein_disqualified',
  'tradein_capacity', 'tradein_color', 'tradein_battery_pct',
  'cash_entry_amount', 'card_brand',
  'desired_model', 'desired_capacity', 'desired_color', 'desired_condition'
]) {
  const v = leadCtx[k] ?? leadCtx.memory?.[k] ?? leadCtx.lead_state?.[k];
  if (v !== undefined && v !== null) reattach[k] = v;
}`;

const NEW = `let leadCtx = {};
try { leadCtx = $('Code Refresh Lead State Before Switch2').last().json ?? {}; } catch (error) { leadCtx = {}; }
// REPASSE RESIM REATTACH FALLBACK (2026-06-20): no re-sim disparado pela escolha
// de variante/cor, "Code Refresh Lead State Before Switch2" NÃO roda (é do branch
// da 1a simulação via Switch3), então leadCtx fica vazio e a troca some. "CRM Leads
// GET" roda em TODO turno e carrega o lead_state persistido — usar como fonte
// adicional do reattach.
let leadStateFallback = {};
try {
  const crm = $('CRM Leads GET').last().json ?? {};
  leadStateFallback = crm.lead_state ?? crm.data?.lead_state ?? crm.data?.items?.[0]?.lead_state ?? crm.data?.conversations?.[0]?.lead_state ?? {};
} catch (error) { leadStateFallback = {}; }
const reattach = {};
for (const k of [
  'has_tradein', 'tradein_model', 'tradein_model_accepted', 'tradein_disqualified',
  'tradein_capacity', 'tradein_color', 'tradein_battery_pct',
  'cash_entry_amount', 'card_brand',
  'desired_model', 'desired_capacity', 'desired_color', 'desired_condition'
]) {
  const v = leadCtx[k] ?? leadCtx.memory?.[k] ?? leadCtx.lead_state?.[k] ?? leadStateFallback[k];
  if (v !== undefined && v !== null) reattach[k] = v;
}`;

const workflow = await kit.loadWorkflow();
const wasActive = workflow.active;

const node = workflow.nodes.find((n) => n.name === NODE);
if (!node) throw new Error(`${NODE} não encontrado`);
const code = node.parameters?.jsCode ?? "";

if (code.includes("leadStateFallback")) {
  console.log(JSON.stringify({ noop: true, reason: "fallback já presente" }, null, 2));
  process.exit(0);
}
if (!code.includes(OLD)) throw new Error("bloco reattach antigo não encontrado (workflow mudou?)");
if ((code.split(OLD).length - 1) !== 1) throw new Error("bloco antigo deveria aparecer 1x");

const next = code.replace(OLD, NEW);
// eslint-disable-next-line no-new-func
new Function(next); // syntax-assert
if (!next.includes("leadStateFallback") || next.includes(OLD)) throw new Error("replace inconsistente");
node.parameters.jsCode = next;

if (kit.DRY) {
  fs.writeFileSync("/tmp/repasse-resim-reattach-dry.json", JSON.stringify(workflow, null, 2));
  console.log(JSON.stringify({ dry: true, bytesAdded: next.length - code.length }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "resim-reattach-from-crmget");
const { verify, activeAfter, finalActive } = await kit.safePut(workflow, "resim-reattach-from-crmget");
const vCode = verify.nodes.find((n) => n.name === NODE)?.parameters?.jsCode ?? "";
console.log(JSON.stringify({
  workflowId: verify.id, wasActive, activeAfter, finalActive,
  fallbackLive: vCode.includes("leadStateFallback"),
}, null, 2));
