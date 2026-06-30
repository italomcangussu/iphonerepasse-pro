// Patch cirurgico (2026-06-18): refina a abordagem de TABELA na Bia 1 com um
// EXEMPLO de fala explicito pedido pelo usuario, reforcando que NUNCA se diz
// "aqui a gente nao trabalha com tabela". Idempotente via marcador. DRY=1 previa.
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. DRY=1 lê o snapshot local, não faz PUT.
import * as kit from "./tool/patch-kit.mjs";

const NODE = 'Bia 1';

const ANCHOR = 'uma simulação completa (com parcelamento, entrada e troca) já no valor real pra ele. Em seguida mostre a LISTA CURTA e siga as etapas.';
const ADD = ' Exemplo de abordagem (adapte ao contexto; NUNCA diga "aqui a gente não trabalha com tabela" nem equivalente): "Vou fazer melhor ainda: ao invés da tabela, consigo te mandar a simulação completa da compra. Qual modelo você procura?"';
const MARKER = 'Vou fazer melhor ainda';

const workflow = await kit.loadWorkflow();
const node = workflow.nodes.find((n) => n.name === NODE);
if (!node) throw new Error(`Node not found: ${NODE}`);
let sys = node.parameters?.options?.systemMessage;
if (typeof sys !== 'string') throw new Error(`${NODE} has no systemMessage`);

const alreadyDone = sys.includes(MARKER);
if (!alreadyDone) {
  sys = kit.replaceOnce(sys, ANCHOR, ANCHOR + ADD, `${NODE}/tabela-exemplo`);
  node.parameters.options.systemMessage = sys;
}

if (kit.DRY) {
  console.log(JSON.stringify({ dry: true, alreadyDone }, null, 2));
  process.exit(0);
}

if (alreadyDone) {
  console.log(JSON.stringify({ patched: false, alreadyDone: true }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "bia1-tabela-exemplo");
const { activeAfter, finalActive } = await kit.safePut(workflow, "bia1-tabela-exemplo");
console.log(JSON.stringify({ patched: true, activeAfter, finalActive }, null, 2));
