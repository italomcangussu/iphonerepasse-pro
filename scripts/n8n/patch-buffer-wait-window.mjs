import * as kit from "./tool/patch-kit.mjs";

// Fix for real traffic where related messages from the same contact arrived
// 13.5s apart and were delivered to the agent as separate turns because
// "Calcular Wait Buffer" shortened medium text messages to 12s.
//
// This patch keeps a single conservative debounce window: 25s.
// Scope: one Code node only. No Redis keys, routing, agents, or credentials.
//
// Migrado para tool/patch-kit.mjs (Fase 5): I/O único. DRY=1 lê o snapshot.

const TARGET_NODE = 'Calcular Wait Buffer';

const WAIT_CODE = `// Calcula a janela de debounce do buffer antes do Wait1.
// Produção: manter 25s para consolidar mensagens relacionadas do mesmo contato.
// Evidência 2026-06-13: duas mensagens da mesma key chegaram 13,5s apartadas e
// foram entregues separadas porque a janela dinâmica caiu para 12s.
const input = $input.first().json;
return [
  {
    json: {
      ...input,
      buffer_wait_seconds: 25,
      buffer_wait_reason: 'fixed_25s_related_messages',
    },
  },
];`;

function assertPatch(workflow) {
  const node = workflow.nodes.find((item) => item.name === TARGET_NODE);
  if (!node) throw new Error(`Node not found: ${TARGET_NODE}`);
  if (node.type !== 'n8n-nodes-base.code') {
    throw new Error(`${TARGET_NODE} must be a Code node; got ${node.type}`);
  }
  if (node.parameters?.jsCode !== WAIT_CODE) {
    throw new Error(`${TARGET_NODE} jsCode was not patched exactly`);
  }
  kit.assertSyntax(WAIT_CODE, TARGET_NODE);
}

const workflow = await kit.loadWorkflow();

const node = workflow.nodes.find((item) => item.name === TARGET_NODE);
if (!node) throw new Error(`Node not found: ${TARGET_NODE}`);
const alreadyPatched = node.parameters?.jsCode === WAIT_CODE;
node.parameters = { ...(node.parameters ?? {}), jsCode: WAIT_CODE };
assertPatch(workflow);

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, alreadyPatched, node: TARGET_NODE }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "buffer-wait");
const { activeAfter, finalActive } = await kit.safePut(workflow, "buffer-wait");
console.log(JSON.stringify({
  patched: true,
  alreadyPatched,
  node: TARGET_NODE,
  activeAfter,
  finalActive,
  waitSeconds: 25,
}, null, 2));
