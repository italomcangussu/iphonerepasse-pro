// Defesa em profundidade (regressão exec 414181): liga "Ignore Type Conversion
// Errors" no Set "Edit Fields5". Mesmo com a coerção em Code in JavaScript2, se
// um valor inesperado escapar para um campo tipado, o Set passa a degradar (não
// converte) em vez de lançar NodeOperationError e DERRUBAR o workflow (bot mudo).
// Idempotente. Set node → não é extraído por repasse-maint → patch cirúrgico.
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. DRY=1 lê o snapshot local, não faz PUT.
import * as kit from "./tool/patch-kit.mjs";

const NODE = 'Edit Fields5';

const workflow = await kit.loadWorkflow();
const node = workflow.nodes.find((n) => n.name === NODE);
if (!node) throw new Error(`Node not found: ${NODE}`);
if (node.type !== 'n8n-nodes-base.set') throw new Error(`${NODE} is not a Set node (${node.type})`);
node.parameters = node.parameters || {};
node.parameters.options = node.parameters.options || {};

let result;
if (node.parameters.options.ignoreConversionErrors === true) {
  result = { already: true };
} else {
  node.parameters.options.ignoreConversionErrors = true;
  result = { already: false };
}

if (kit.DRY) {
  console.log(JSON.stringify({ dry: true, result, options: node.parameters.options }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "editfields5-ignore-conversion");
const { activeAfter, finalActive } = await kit.safePut(workflow, "editfields5-ignore-conversion");
console.log(JSON.stringify({ patched: true, node: NODE, result, activeAfter, finalActive }, null, 2));
