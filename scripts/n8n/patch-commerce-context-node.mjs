import * as kit from "./tool/patch-kit.mjs";
import { randomUUID } from 'node:crypto';
import { buildCommerceContextRuntime } from './repasse-commerce-context.mjs';

// Fase 2 backbone (Pilar A): a deterministic `commerce_context` available to Bia 2.
// SAFE + reversible: inserts an ADDITIVE passthrough Code node between
// "Edit Fields10" and "Bia 2 ESTOQUE" (worst case it just re-emits the same item),
// and injects an allowed_colors snapshot block into the Bia 2 ESTOQUE prompt.
// No routing flip, no node deletion (those are the harness-gated final step).
//
// Migrado para tool/patch-kit.mjs (Fase 5): I/O único. DRY=1 escreve o body em /tmp.

const NEW_NODE = 'Code Commerce Context';
const UPSTREAM = 'Edit Fields10';
const DOWNSTREAM = 'Bia 2 ESTOQUE';

const NODE_CODE = `${buildCommerceContextRuntime()}

const j = $input.first().json ?? {};
let commerce_context;
try {
  commerce_context = buildCommerceContext({
    memory: j.memory ?? {},
    inventory: j.inventory ?? null,
    last_inventory_context: j.last_inventory_context ?? (j.memory && j.memory.last_inventory_context) ?? null,
  });
} catch (e) {
  commerce_context = { error: String((e && e.message) || e), allowed_colors: [], inventory_checked_this_turn: false, stage: 'collection' };
}
return [{ json: { ...j, commerce_context }, pairedItem: { item: 0 } }];`;

const SNAPSHOT_BLOCK = `=== SNAPSHOT COMERCIAL (FONTE ÚNICA) ===
Estágio: {{ $json.commerce_context?.stage ?? "n/a" }}
Estoque consultado neste turno: {{ $json.commerce_context?.inventory_checked_this_turn ?? false }}
Cores permitidas — ofereça SOMENTE estas; se a lista estiver vazia, NÃO liste nenhuma cor: {{ JSON.stringify($json.commerce_context?.allowed_colors ?? []) }}

`;

if (process.env.DRY === '1') {
  const { writeFileSync } = await import('node:fs');
  writeFileSync('/tmp/cc_node.js', NODE_CODE);
  console.log('NODE_CODE written to /tmp/cc_node.js (len', NODE_CODE.length, ')');
  process.exit(0);
}

kit.assertSyntax(NODE_CODE, NEW_NODE);

const wf = await kit.loadWorkflow();
const report = [];

// 1) Insert the node (idempotent).
const up = wf.nodes.find((n) => n.name === UPSTREAM);
const down = wf.nodes.find((n) => n.name === DOWNSTREAM);
if (!up || !down) throw new Error('upstream/downstream node missing');
let node = wf.nodes.find((n) => n.name === NEW_NODE);
if (!node) {
  node = {
    id: randomUUID(),
    name: NEW_NODE,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [Math.round((up.position[0] + down.position[0]) / 2), up.position[1] + 120],
    parameters: { mode: 'runOnceForAllItems', jsCode: NODE_CODE },
  };
  wf.nodes.push(node);
  report.push({ step: 'node', status: 'inserted' });
} else {
  node.parameters.jsCode = NODE_CODE;
  report.push({ step: 'node', status: 'updated' });
}

// 2) Rewire connections: UPSTREAM -> NEW_NODE -> DOWNSTREAM (idempotent).
const upMain = wf.connections[UPSTREAM]?.main ?? [];
for (const branch of upMain) {
  for (const conn of branch) {
    if (conn.node === DOWNSTREAM) conn.node = NEW_NODE;
  }
}
wf.connections[NEW_NODE] = { main: [[{ node: DOWNSTREAM, type: 'main', index: 0 }]] };
report.push({ step: 'connections', status: `${UPSTREAM}->${NEW_NODE}->${DOWNSTREAM}` });

// 3) Inject snapshot block into Bia 2 ESTOQUE prompt (idempotent, additive).
const text = down.parameters.text;
if (typeof text === 'string' && !text.includes('SNAPSHOT COMERCIAL (FONTE ÚNICA)')) {
  down.parameters.text = text.startsWith('=')
    ? `=${SNAPSHOT_BLOCK}${text.slice(1)}`
    : `${SNAPSHOT_BLOCK}${text}`;
  report.push({ step: 'prompt', status: 'snapshot block injected' });
} else {
  report.push({ step: 'prompt', status: 'already present' });
}

// 4) Validate structural invariants before PUT.
const targets = new Set();
for (const k of Object.keys(wf.connections)) {
  for (const b of (wf.connections[k].main ?? [])) for (const c of b) targets.add(c.node);
}
const names = new Set(wf.nodes.map((n) => n.name));
const dangling = [...targets].filter((t) => !names.has(t));
if (dangling.length) throw new Error(`Dangling connection targets: ${dangling.join(', ')}`);

kit.backup(await kit.getLive(), "commerce-context-node");
const { activeAfter, finalActive } = await kit.safePut(wf, "commerce-context-node");
console.log(JSON.stringify({ report, nodeCount: wf.nodes.length, activeAfter, finalActive }, null, 2));
