// Surgical patch — Node13 referencia $('Parse Memory') (node DELETADO) em
// `const ctx = $('Parse Memory').last().json;`, causando
// "Referenced node doesn't exist" e abortando o caminho de estoque após a busca.
// Node13 só usa ctx.memory e ctx.stock_item_id — ambos presentes no output do
// "Code Refresh Lead State Before Switch2" (upstream imediato na branch de
// estoque). Troca a fonte.
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 1). DRY=1 lê o snapshot local
// e grava /tmp/repasse-node13-dry.json sem PUT.
import * as kit from "./tool/patch-kit.mjs";

const NODE_NAME = "Node13-Code Filtrar Resultados Estoque";
const NEEDLE = "const ctx = $('Parse Memory').last().json;";
const REPLACEMENT = "const ctx = $('Code Refresh Lead State Before Switch2').last().json;";

const workflow = await kit.loadWorkflow();
const wasActive = workflow.active;
const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`${NODE_NAME} not found`);
let code = node.parameters.jsCode;
if (code.includes(REPLACEMENT)) {
  console.log("  skip [já aplicado]");
} else {
  code = kit.replaceOnce(code, NEEDLE, REPLACEMENT, "ctx-source");
  node.parameters.jsCode = code;
  console.log("  ok [ctx source trocado]");
}
kit.assertSyntax(node.parameters.jsCode, NODE_NAME);
if (JSON.stringify(node.parameters).includes("Parse Memory")) throw new Error("ainda há ref a Parse Memory em Node13");

if (kit.DRY) {
  kit.dry(workflow, "/tmp/repasse-node13-dry.json");
  console.log(JSON.stringify({ dry: true }, null, 2));
  process.exit(0);
}
kit.backup(await kit.getLive(), "node13-ctx");
const { verify, activeAfter, finalActive } = await kit.safePut(workflow, "node13-ctx");
const v = verify.nodes.find((n) => n.name === NODE_NAME);
console.log(JSON.stringify({ wasActive, activeAfter, finalActive, fixed: v.parameters.jsCode.includes(REPLACEMENT), stillHasParseMemory: v.parameters.jsCode.includes("Parse Memory") }, null, 2));
