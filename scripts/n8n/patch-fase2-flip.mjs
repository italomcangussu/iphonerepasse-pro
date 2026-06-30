import * as kit from "./tool/patch-kit.mjs";
import { randomUUID } from 'node:crypto';

// Fase 2 flip (incremental, route 1 of 3): route the continuation branch
// (Switch3 out[2]) into the unified Bia 2 pipeline instead of "Bia 2 SEM ESTOQUE ".
//   Switch3 out[2] -> Code Normalize Continuation -> Code Commerce Context -> Bia 2 ESTOQUE
// The normalizer maps the continuation item shape (Edit Fields5) to what the ESTOQUE
// prompt reads — critically buffer.message_buffered (the customer's current message)
// and inventory=null (so commerce_context.inventory_checked_this_turn=false ->
// MODO CONTINUIDADE branch). Everything else passes through (first_name, memory,
// faq_*, media_context, last_inventory_context, store_open, local_time, after_hours).
//
// REVERT=1 restores Switch3 out[2] -> "Bia 2 SEM ESTOQUE ".  DRY=1 dumps + exits.
//
// Migrado para tool/patch-kit.mjs (Fase 5): I/O único (PUT/activate/backup).

const NORMALIZER = 'Code Normalize Continuation';
const SWITCH = 'Switch3';
const OUT_INDEX = 2;
const OLD_TARGET = 'Bia 2 SEM ESTOQUE ';
const COMMERCE = 'Code Commerce Context';

const NORMALIZER_CODE = `// Maps a continuation item (Switch3 out[2]) to the shape Bia 2 (ESTOQUE) reads.
const j = $input.first().json ?? {};
return [{
  json: {
    ...j,
    // current customer message: ESTOQUE prompt reads $json.buffer.message_buffered
    buffer: { ...(j.buffer ?? {}), message_buffered: j.message_buffered ?? j.buffer?.message_buffered ?? '' },
    // continuation = stock NOT consulted this turn -> commerce_context.inventory_checked_this_turn=false
    inventory: null,
    name: j.name ?? j.first_name ?? null,
  },
  pairedItem: { item: 0 },
}];`;

if (process.env.DRY === '1') {
  const { writeFileSync } = await import('node:fs');
  writeFileSync('/tmp/normalizer.js', NORMALIZER_CODE);
  console.log('NORMALIZER_CODE -> /tmp/normalizer.js');
  process.exit(0);
}

kit.assertSyntax(NORMALIZER_CODE, NORMALIZER);

const wf = await kit.loadWorkflow();
const report = [];
const switchConn = wf.connections[SWITCH]?.main?.[OUT_INDEX];
if (!Array.isArray(switchConn)) throw new Error(`${SWITCH} out[${OUT_INDEX}] not found`);

if (process.env.REVERT === '1') {
  for (const c of switchConn) { if (c.node === NORMALIZER) c.node = OLD_TARGET; }
  delete wf.connections[NORMALIZER];
  wf.nodes = wf.nodes.filter((n) => n.name !== NORMALIZER);
  report.push({ step: 'revert', status: `${SWITCH} out[${OUT_INDEX}] -> ${OLD_TARGET}; ${NORMALIZER} removed` });
} else {
  // 1) normalizer node (idempotent)
  let node = wf.nodes.find((n) => n.name === NORMALIZER);
  if (!node) {
    const sw = wf.nodes.find((n) => n.name === SWITCH);
    node = {
      id: randomUUID(), name: NORMALIZER, type: 'n8n-nodes-base.code', typeVersion: 2,
      position: [(sw?.position?.[0] ?? 20000) + 200, (sw?.position?.[1] ?? 29000) + 260],
      parameters: { mode: 'runOnceForAllItems', jsCode: NORMALIZER_CODE },
    };
    wf.nodes.push(node);
    report.push({ step: 'node', status: 'inserted' });
  } else { node.parameters.jsCode = NORMALIZER_CODE; report.push({ step: 'node', status: 'updated' }); }

  // 2) Switch3 out[2] -> normalizer (was OLD_TARGET)
  for (const c of switchConn) { if (c.node === OLD_TARGET) c.node = NORMALIZER; }
  // 3) normalizer -> Code Commerce Context
  wf.connections[NORMALIZER] = { main: [[{ node: COMMERCE, type: 'main', index: 0 }]] };
  report.push({ step: 'rewire', status: `${SWITCH} out[${OUT_INDEX}] -> ${NORMALIZER} -> ${COMMERCE} -> Bia 2 ESTOQUE` });
}

// structural validation
const names = new Set(wf.nodes.map((n) => n.name));
const dangling = [];
for (const k of Object.keys(wf.connections)) {
  if (!names.has(k)) dangling.push(`src:${k}`);
  for (const b of (wf.connections[k].main ?? [])) for (const c of b) if (!names.has(c.node)) dangling.push(`dst:${c.node}`);
}
if (dangling.length) throw new Error(`Dangling: ${[...new Set(dangling)].join(', ')}`);

kit.backup(await kit.getLive(), "fase2-flip");
const { activeAfter, finalActive } = await kit.safePut(wf, "fase2-flip");
console.log(JSON.stringify({ report, nodeCount: wf.nodes.length, activeAfter, finalActive }, null, 2));
