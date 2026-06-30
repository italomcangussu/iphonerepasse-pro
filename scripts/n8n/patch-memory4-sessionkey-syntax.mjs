// Conserta a SINTAXE frágil do sessionKey do "Postgres Chat Memory4" (memória do
// agente Memory 1 - Extractor): `=2{{ ... return 'm'+base }}` usa um literal "2"
// colado antes do `{{` (parece typo). Reescreve para `={{ ... return '2m'+base }}`:
// MESMO valor resolvido ("2m<base>") → ZERO perda de memória; sintaxe limpa; segue
// DISTINTO do Memory3 ("m<base>", agente Memory 2) para a memória dos agentes de
// análise não se misturar. Idempotente. sessionKey é parâmetro de node → patch.
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. NOTA: o nó "Postgres Chat Memory4" não existe mais no vivo;
// patch histórico — hoje aborta em "Node not found" (preservado). DRY=1 não faz PUT.
import * as kit from "./tool/patch-kit.mjs";

const NODE = 'Postgres Chat Memory4';

const START_OLD = '=2{{ (() => {';
const START_NEW = '={{ (() => {';
const PREFIX_OLD = "const session = 'm' + String(base";
const PREFIX_NEW = "const session = '2m' + String(base";

const workflow = await kit.loadWorkflow();
const node = workflow.nodes.find((n) => n.name === NODE);
if (!node) throw new Error(`Node not found: ${NODE}`);
let sk = node.parameters?.sessionKey;
if (typeof sk !== 'string') throw new Error(`${NODE} has no sessionKey`);

let result;
if (sk.startsWith(START_NEW) && sk.includes(PREFIX_NEW)) {
  result = { already: true, resolved_example: '2m<base>' };
} else {
  sk = kit.replaceOnce(sk, START_OLD, START_NEW, `${NODE} start`);
  sk = kit.replaceOnce(sk, PREFIX_OLD, PREFIX_NEW, `${NODE} prefix`);
  node.parameters.sessionKey = sk;
  result = { already: false, resolved_example: '2m<base>' };
}

if (kit.DRY) {
  console.log(JSON.stringify({ dry: true, result, sessionKey: node.parameters.sessionKey }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "memory4-sessionkey");
const { activeAfter, finalActive } = await kit.safePut(workflow, "memory4-sessionkey");
console.log(JSON.stringify({ patched: true, node: NODE, result, activeAfter, finalActive }, null, 2));
