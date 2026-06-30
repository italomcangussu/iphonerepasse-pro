// Surgical patch — Bucket 3 (carry-forward determinístico) no node "Code in
// JavaScript" (→ "CRM Leads POST Lead_State") do workflow AO VIVO (Cr4fPWe0prwS6XjI).
//
// Por quê: os campos determinísticos de estoque/simulador/PIX só são computados
// nos turnos em que os nodes de inventário/simulador/PIX rodam (branch específico
// do Switch3). Nos demais turnos chegam null no Edit Fields5 e este node, que roda
// em TODO turno, gravava null → zerava o valor persistido (dado atrasado/perdido).
// Memory 2 NÃO pode ser dono desses campos (alucinaria estoque/simulação). A
// solução limpa é fallback para o estado anterior (prev) só quando o valor fresco
// vier ausente. Booleans monotônicos (simulation_done, pix_data_sent) viram latch;
// simulation_count é monotônico (Math.max).
//
// Fonte do prev: $('Code Parse Memory 2').last().json.lead_state (já é o lead_state
// persistido anterior, extraído lá); fallback para $('CRM Leads GET').
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. DRY=1 lê o snapshot local e grava /tmp/repasse-bucket3-dry.json sem PUT.
import fs from "node:fs";
import * as kit from "./tool/patch-kit.mjs";

const NODE_NAME = "Code in JavaScript";

// Bloco inserido logo após o cabeçalho (header) do node.
const CARRY_BLOCK = `const input = $('Edit Fields5').first().json;
const leadId = $('Edit Fields').first().json.lead.id;

// Bucket 3 carry-forward (2026-06-14): campos determinísticos (estoque/simulador/PIX)
// só são computados nos turnos em que os nodes de inventário/simulador/PIX rodam.
// Nos demais turnos chegam null no Edit Fields5 e, sem isto, este POST zerava o
// valor persistido. Aqui fazemos fallback para o estado anterior (prev) só quando
// o valor fresco vier ausente. NÃO são donos de agente (alucinariam) — Memory 2
// continua dono dos demais campos.
function readPrevLeadState() {
  try {
    const ls = $('Code Parse Memory 2').last().json?.lead_state;
    if (ls && typeof ls === 'object' && !Array.isArray(ls)) return ls;
  } catch (e) {}
  try {
    const crm = $('CRM Leads GET').last().json;
    return crm?.lead_state ?? crm?.data?.lead_state ?? crm?.data?.items?.[0]?.lead_state ?? {};
  } catch (e) {}
  return {};
}
const prev = readPrevLeadState();
const isPresent = (v) => v !== null && v !== undefined && v !== '';
const cf = (cur, key) => (isPresent(cur) ? cur : (prev?.[key] ?? null));
const latch = (cur, key) => (cur === true || prev?.[key] === true);
const maxNum = (cur, key) => Math.max(Number(cur ?? 0) || 0, Number(prev?.[key] ?? 0) || 0);`;

// [needle, replacement] — needles únicos (verificado: 1 ocorrência cada).
const REPLACEMENTS = [
  [
    `const input = $('Edit Fields5').first().json;
const leadId = $('Edit Fields').first().json.lead.id;`,
    CARRY_BLOCK,
  ],
  [`          stock_city: input.stock_city,`, `          stock_city: cf(input.stock_city, 'stock_city'),`],
  [`          stock_item_id: input.stock_item_id,`, `          stock_item_id: cf(input.stock_item_id, 'stock_item_id'),`],
  [`          simulation_done: input.simulation_done,`, `          simulation_done: latch(input.simulation_done, 'simulation_done'),`],
  [`          simulation_count: input.simulation_count,`, `          simulation_count: maxNum(input.simulation_count, 'simulation_count'),`],
  [`          last_simulation_total: input.last_simulation_total,`, `          last_simulation_total: cf(input.last_simulation_total, 'last_simulation_total'),`],
  [`          secondary_color_simulation: input.secondary_color_simulation,`, `          secondary_color_simulation: cf(input.secondary_color_simulation, 'secondary_color_simulation'),`],
  [`          pix_data_sent: input.pix_data_sent,`, `          pix_data_sent: latch(input.pix_data_sent, 'pix_data_sent'),`],
];

const workflow = await kit.loadWorkflow();
const wasActive = workflow.active;

const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`${NODE_NAME} not found`);

let code = node.parameters.jsCode;
const already = code.includes("Bucket 3 carry-forward");
if (already) {
  console.log("  skip [carry-forward já aplicado]");
} else {
  for (const [needle, replacement] of REPLACEMENTS) {
    const count = code.split(needle).length - 1;
    if (count !== 1) throw new Error(`needle não-único (${count}x): ${needle.slice(0, 60)}…`);
    code = code.replace(needle, replacement);
  }
  node.parameters.jsCode = code;
  console.log("  ok [carry-forward aplicado em 8 pontos]");
}

// syntax assert
new Function("$input", "$", "DateTime", "$helpers", "$jmespath", node.parameters.jsCode);

// sanidade: os 7 campos agora usam helpers e o prev foi definido
const must = ["const prev = readPrevLeadState()", "cf(input.stock_city, 'stock_city')", "latch(input.pix_data_sent, 'pix_data_sent')", "maxNum(input.simulation_count, 'simulation_count')"];
for (const m of must) if (!node.parameters.jsCode.includes(m)) throw new Error(`sanity falhou, faltou: ${m}`);

if (kit.DRY) {
  fs.writeFileSync("/tmp/repasse-bucket3-dry.json", JSON.stringify(workflow, null, 2));
  console.log(JSON.stringify({ dry: true, wrote: "/tmp/repasse-bucket3-dry.json", already }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "bucket3-carry-forward");
const { verify, activeAfter, finalActive } = await kit.safePut(workflow, "bucket3-carry-forward");
const vNode = verify.nodes.find((n) => n.name === NODE_NAME);
console.log(JSON.stringify({
  workflowId: verify.id,
  wasActive,
  activeAfter,
  finalActive,
  carryForwardPresent: vNode?.parameters?.jsCode?.includes("Bucket 3 carry-forward") ?? false,
}, null, 2));
