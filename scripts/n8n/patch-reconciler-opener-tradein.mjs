import * as kit from "./tool/patch-kit.mjs";

// Map the OPENER's "current device" answer to a trade-in in Memory 2 Reconciler.
//
// Root cause (lead VD, exec 419160 "14pm"): the new opener asks two things at
// once ("qual deseja comprar?" + "qual o aparelho que você tem agora?"). The
// client answered with two rapid messages (17pm / 14pm). The reconciler had no
// rule mapping the "current device" answer to a trade-in, so it left
// has_tradein=false / tradein_model=null and the flow never entered trade-in
// qualification. (The existing DESAMBIGUACAO rule only covers the trade-in
// EVALUATION questionnaire, not the first mention via the opener.)
//
// Fix: two bullets at the top of the DESAMBIGUACAO section — (1) answer to the
// opener's current-device question = tradein_model + has_tradein=true +
// interest_type="troca" (never desired_model); (2) when the opener asked both
// and the client gives two models, 1st = desired, 2nd = trade-in. With
// has_tradein/tradein_model set, routing + Bia's existing qualification (which
// worked in session 1) take over.
//
// Edits Memory 2 - Reconciler options.systemMessage. Idempotent (marker).
// Migrado para tool/patch-kit.mjs (Fase 5): I/O único. DRY=1 lê o snapshot.

const NODE_NAME = 'Memory 2 - Reconciler';
const MARKER = 'ABERTURA -> APARELHO ATUAL = TRADE-IN';

const ANCHOR = '// DESAMBIGUACAO TRADE-IN vs DESEJADO (CRITICO)\n';

const BLOCK =
  '- ABERTURA -> APARELHO ATUAL = TRADE-IN: se a ULTIMA mensagem do atendimento foi a abertura/saudacao perguntando o APARELHO ATUAL do cliente (ex.: "qual o aparelho que voce tem agora?", "qual seu aparelho atual?", "tem algum iPhone pra dar de entrada?") e o cliente respondeu com um modelo de iPhone, registre esse modelo como tradein_model e has_tradein = true (intencao de troca/entrada a qualificar) e interest_type = "troca". NUNCA coloque esse modelo em desired_model.\n' +
  '- ABERTURA COM DUAS PERGUNTAS: quando a abertura perguntou "qual deseja comprar?" E "qual o aparelho atual?" e o cliente respondeu com DOIS modelos, o modelo que responde "qual deseja comprar" vai para desired_model e o que responde "aparelho atual" vai para tradein_model (has_tradein = true). Na duvida pela ordem, o 1o modelo citado e o desejado (compra) e o 2o e o de entrada (troca). Nao deixe o aparelho de entrada sobrescrever o desejado nem vice-versa.\n';

const workflow = await kit.loadWorkflow();

const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`Node not found: ${NODE_NAME}`);
if (node.type !== '@n8n/n8n-nodes-langchain.agent') throw new Error(`${NODE_NAME} is not an agent node (got ${node.type})`);

const text = node.parameters?.options?.systemMessage;
if (typeof text !== 'string') throw new Error(`${NODE_NAME}: options.systemMessage is not a string`);

if (text.includes(MARKER)) {
  console.log(JSON.stringify({ skipped: true, reason: 'already patched (opener->tradein)', node: NODE_NAME }, null, 2));
  process.exit(0);
}

const occurrences = text.split(ANCHOR).length - 1;
if (occurrences !== 1) {
  throw new Error(`${NODE_NAME}: expected exactly 1 anchor match, found ${occurrences} (drift? run the live guard)`);
}

const newText = text.replace(ANCHOR, `${ANCHOR}${BLOCK}`);
node.parameters.options.systemMessage = newText;

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, node: NODE_NAME, bytesBefore: text.length, bytesAfter: newText.length }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "reconciler-opener-tradein");
const { activeAfter, finalActive } = await kit.safePut(workflow, "reconciler-opener-tradein");
console.log(JSON.stringify({
  patched: true, node: NODE_NAME,
  bytesBefore: text.length, bytesAfter: newText.length, activeAfter, finalActive,
}, null, 2));
