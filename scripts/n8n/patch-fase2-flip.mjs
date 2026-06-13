import { readFile } from 'node:fs/promises';
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

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
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

function parseEnv(t) {
  return Object.fromEntries(t.split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
}
const env = parseEnv(await readFile('.env.local', 'utf8'));
const KEY = env.N8N_API_KEY;
const ORIGIN = new URL(env.N8N_BASE_URL).origin;
const api = (p, init = {}) => fetch(new URL(p, ORIGIN), {
  ...init, headers: { 'X-N8N-API-KEY': KEY, 'content-type': 'application/json', ...(init.headers || {}) },
});

const res = await api(`/api/v1/workflows/${WORKFLOW_ID}`);
if (!res.ok) throw new Error(`GET failed: ${res.status} ${await res.text()}`);
const wf = await res.json();
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

const ALLOWED = ['saveExecutionProgress', 'saveManualExecutions', 'saveDataErrorExecution',
  'saveDataSuccessExecution', 'executionTimeout', 'errorWorkflow', 'timezone', 'executionOrder'];
const settings = Object.fromEntries(Object.entries(wf.settings ?? {}).filter(([k]) => ALLOWED.includes(k)));
const body = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings };
if (wf.staticData) body.staticData = wf.staticData;
const put = await api(`/api/v1/workflows/${WORKFLOW_ID}`, { method: 'PUT', body: JSON.stringify(body) });
if (!put.ok) throw new Error(`PUT failed: ${put.status} ${await put.text()}`);
const updated = await put.json();
let active = updated.active;
if (!active) { const a = await api(`/api/v1/workflows/${WORKFLOW_ID}/activate`, { method: 'POST' }); active = a.ok; }
console.log(JSON.stringify({ report, nodeCount: wf.nodes.length, active, updatedAt: updated.updatedAt }, null, 2));
