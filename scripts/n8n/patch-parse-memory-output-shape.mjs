import * as kit from "./tool/patch-kit.mjs";

// Keep Parse Memory output canonical.
//
// Root cause: Parse Memory returned `{ ...ctxClean, ...memory, memory }`.
// ctxClean still contained stale CRM payload such as `lead_state`, so later
// nodes could see old state beside the freshly reconciled memory fields.
//
// Scope: one Code node only. Preserve the nested `memory` object for downstream
// compatibility, but do not pass through prior lead_state/output/message blobs.
//
// NOTA: o nó "Parse Memory" foi removido do vivo (2026-06-14); patch histórico —
// hoje aborta em "Node not found: Parse Memory" (preservado).
// Migrado para tool/patch-kit.mjs (Fase 5): I/O único. DRY=1 lê o snapshot.

const TARGET_NODE = 'Parse Memory';

const OLD_RETURN = `const { output: _o, text: _t, message: _m, memory: _oldMemory, ...ctxClean } = inputData;

return [{
  json: {
    ...ctxClean,
    ...memory,
    memory,
  },
}];`;

const NEW_RETURN = `const canonicalMemory = clonePlain(memory);

return [{
  json: {
    ...canonicalMemory,
    memory: canonicalMemory,
  },
}];`;

function patchWorkflow(workflow) {
  const node = workflow.nodes.find((item) => item.name === TARGET_NODE);
  if (!node) throw new Error(`Node not found: ${TARGET_NODE}`);
  if (node.type !== 'n8n-nodes-base.code') {
    throw new Error(`${TARGET_NODE} must be a Code node; got ${node.type}`);
  }

  const jsCode = node.parameters?.jsCode;
  if (typeof jsCode !== 'string') {
    throw new Error(`${TARGET_NODE} has no jsCode`);
  }

  const alreadyPatched = jsCode.includes('const canonicalMemory = clonePlain(memory);');
  if (alreadyPatched) return { alreadyPatched, node };

  if (!jsCode.includes(OLD_RETURN)) {
    throw new Error(`${TARGET_NODE} return block did not match expected old shape`);
  }

  node.parameters.jsCode = jsCode.replace(OLD_RETURN, NEW_RETURN);
  return { alreadyPatched, node };
}

function assertPatch(workflow) {
  const node = workflow.nodes.find((item) => item.name === TARGET_NODE);
  const jsCode = node?.parameters?.jsCode ?? '';

  if (!jsCode.includes(NEW_RETURN)) {
    throw new Error(`${TARGET_NODE} missing canonical output return`);
  }
  if (jsCode.includes('...ctxClean')) {
    throw new Error(`${TARGET_NODE} still passes ctxClean through`);
  }
  if (jsCode.includes('const { output: _o, text: _t, message: _m, memory: _oldMemory')) {
    throw new Error(`${TARGET_NODE} still destructures stale passthrough context`);
  }

  kit.assertSyntax(jsCode, TARGET_NODE);
}

const workflow = await kit.loadWorkflow();

const { alreadyPatched } = patchWorkflow(workflow);
assertPatch(workflow);

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, alreadyPatched, node: TARGET_NODE }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "parse-memory-output-shape");
const { activeAfter, finalActive } = await kit.safePut(workflow, "parse-memory-output-shape");
console.log(JSON.stringify({
  patched: true,
  alreadyPatched,
  node: TARGET_NODE,
  activeAfter,
  finalActive,
}, null, 2));
