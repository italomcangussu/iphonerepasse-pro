import * as kit from "./tool/patch-kit.mjs";
import { buildCommerceContextRuntime } from './repasse-commerce-context.mjs';

// Fase 1 (parcial): trava determinística de cor nos dois Code Parse que extraem a
// `message` dos agentes Bia 2. Nomes são enganosos:
//   - "Code Parse Bia 2 SEM ESTOQUE"  -> parseia a saída da Bia 2 ESTOQUE (Edit Fields3)
//   - "Code Parse Bia 2 SEM ESTOQUE1" -> parseia a saída da Bia 2 SEM ESTOQUE (Edit Fields13)
// A trava roda DEPOIS do parse, sobre router.message, preservando o item 1:1
// (sem rewiring de conexões, sem nós novos). allowed_colors vem só de fontes do
// turno atual (try/catch ignora nós não executados neste run).
//
// Migrado para tool/patch-kit.mjs (Fase 5): I/O único. DRY=1 escreve o body em /tmp.

const TARGET_NODES = ['Code Parse Bia 2 SEM ESTOQUE', 'Code Parse Bia 2 SEM ESTOQUE1'];

const GUARD_BODY = `${buildCommerceContextRuntime()}

function gatherAllowedColors() {
  const candidates = ['Node13-Code Filtrar Resultados Estoque', 'Edit Fields3', 'Edit Fields13', 'Edit Fields10', 'Edit Fields5', 'Parse Memory'];
  let inventory = {};
  let last = {};
  for (const name of candidates) {
    try {
      const j = $(name).last().json ?? {};
      const inv = j.inventory ?? (j.available_colors ? j : null);
      if (!inventory.available_colors && inv) inventory = inv;
      const lic = j.last_inventory_context ?? (j.memory && j.memory.last_inventory_context);
      if (!last.available_colors && lic) last = lic;
    } catch (e) { /* node not executed this turn */ }
  }
  try {
    const cur = $json ?? {};
    if (!inventory.available_colors && cur.inventory) inventory = cur.inventory;
    const lic = cur.last_inventory_context ?? (cur.memory && cur.memory.last_inventory_context);
    if (!last.available_colors && lic) last = lic;
  } catch (e) {}
  return buildAllowedColors({ inventory, last_inventory_context: last });
}

// Colors the customer themselves mentioned this turn (echoes are never hallucinations).
function gatherCustomerColors() {
  const candidates = ['Edit Fields4', 'Edit Fields5', 'Edit Fields13', 'Edit Fields10', 'Parse Memory'];
  let msg = '';
  const stateColors = [];
  const collect = (j) => {
    if (!j) return;
    const m = j.message_buffered ?? (j.buffer && j.buffer.message_buffered) ?? (j.memory && j.memory.message_buffered);
    if (!msg && typeof m === 'string') msg = m;
    const mem = j.memory ?? j;
    for (const f of ['desired_color', 'tradein_color', 'secondary_color_simulation']) {
      const v = mem[f];
      if (typeof v === 'string' && v.trim()) stateColors.push(v);
    }
  };
  for (const name of candidates) { try { collect($(name).last().json); } catch (e) {} }
  try { collect($json); } catch (e) {}
  return [...detectColors(msg), ...stateColors];
}

let raw = $json.output;
raw = String(raw || '').trim();
raw = raw.replace(/^\\\`\\\`\\\`json\\s*/i, '').replace(/^\\\`\\\`\\\`\\s*/i, '').replace(/\\\`\\\`\\\`$/i, '').trim();

const allowedColors = gatherAllowedColors();
const customerColors = gatherCustomerColors();

try {
  const router = JSON.parse(raw);
  let color_guard = null;
  if (router && typeof router.message === 'string') {
    const guard = enforceAllowedColors(router.message, allowedColors, customerColors);
    if (guard.triggered) {
      router.message = guard.message;
      color_guard = { triggered: true, violations: guard.violations, mentioned: guard.mentioned };
    }
  }
  return [{ json: { ...$json, router, router_parse_ok: true, color_guard, allowed_colors: allowedColors } }];
} catch (error) {
  return [{ json: { ...$json, router_parse_ok: false, router_parse_error: String(error.message || error), router_raw: raw } }];
}`;

if (process.env.DRY === '1') {
  const { writeFileSync } = await import('node:fs');
  writeFileSync('/tmp/guard_body.js', GUARD_BODY);
  console.log('GUARD_BODY written to /tmp/guard_body.js (len', GUARD_BODY.length, ')');
  process.exit(0);
}

kit.assertSyntax(GUARD_BODY, 'color-guard');

const wf = await kit.loadWorkflow();

const report = [];
for (const name of TARGET_NODES) {
  const node = wf.nodes.find((n) => n.name === name);
  if (!node) throw new Error(`Node not found: ${name}`);
  if (node.type !== 'n8n-nodes-base.code') throw new Error(`${name} is not a Code node`);
  const had = node.parameters.jsCode.includes('REPASSE COMMERCE CONTEXT START');
  node.parameters.jsCode = GUARD_BODY;
  report.push({ node: name, status: had ? 'guard updated' : 'guard applied' });
}

kit.backup(await kit.getLive(), "color-guard");
const { activeAfter, finalActive } = await kit.safePut(wf, "color-guard");
console.log(JSON.stringify({ report, activeAfter, finalActive }, null, 2));
