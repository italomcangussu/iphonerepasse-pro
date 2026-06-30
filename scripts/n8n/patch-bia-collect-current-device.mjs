import * as kit from "./tool/patch-kit.mjs";

// Make the Bia collect the CURRENT DEVICE answer as its own anchored question,
// instead of skipping to capacity, so a later "14pm" maps to the trade-in.
//
// Why (lead VD / smoke 419186, 419190): the opener asks two things ("qual deseja
// comprar?" + "qual o aparelho atual?"). The client answered only the desired
// model; the Bia then asked CAPACITY and dropped the current-device question. So
// when the client said "14pm", the last bot message was the capacity question and
// the (flash-lite) reconciler read "14pm" as a desired switch — overwriting the
// desired model. Anchoring the current-device question right before the answer
// makes the reconciler's "abertura -> aparelho atual = trade-in" rule fire
// deterministically (the Bias run on xiaomi/mimo-v2.5-pro, which follows this).
//
// Adds one bullet to the opener block of Bia 1 and Bia 2 ESTOQUE (both in
// parameters.text). Idempotent (marker).
//
// Migrado para tool/patch-kit.mjs (Fase 5): I/O único. DRY=1 lê o snapshot.

const NODES = ['Bia 1', 'Bia 2 ESTOQUE'];
const MARKER = 'COLETA DO APARELHO ATUAL';

const ANCHOR = 'nunca diga "bom dia" à tarde/noite.';
const BLOCK = '\n- COLETA DO APARELHO ATUAL: depois da abertura, se o cliente já disse qual modelo deseja comprar mas AINDA NÃO informou o aparelho atual (Tradein model vazio e ele não disse que não tem aparelho), a PRÓXIMA pergunta deve ser sobre o aparelho atual ("E qual o aparelho que você tem hoje? É pra ver uma possível entrada/troca."), ANTES de perguntar capacidade ou cor. Não avance para capacidade deixando o aparelho atual em aberto. Quando o cliente responder com um modelo de iPhone aqui, é o aparelho de ENTRADA/TROCA (não troca o que ele quer comprar).';

const workflow = await kit.loadWorkflow();

const results = [];
let anyChange = false;
for (const name of NODES) {
  const node = workflow.nodes.find((n) => n.name === name);
  if (!node) throw new Error(`Node not found: ${name}`);
  const text = node.parameters?.text;
  if (typeof text !== 'string') throw new Error(`${name}: parameters.text is not a string`);
  if (text.includes(MARKER)) { results.push({ node: name, skipped: true }); continue; }
  const occ = text.split(ANCHOR).length - 1;
  if (occ !== 1) throw new Error(`${name}: expected exactly 1 anchor match, found ${occ} (drift? run the live guard)`);
  node.parameters.text = text.replace(ANCHOR, `${ANCHOR}${BLOCK}`);
  results.push({ node: name, bytesBefore: text.length, bytesAfter: node.parameters.text.length });
  anyChange = true;
}

if (!anyChange) {
  console.log(JSON.stringify({ skipped: true, reason: 'already patched (both nodes)', results }, null, 2));
  process.exit(0);
}

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, results }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "bia-collect-current-device");
const { activeAfter, finalActive } = await kit.safePut(workflow, "bia-collect-current-device");
console.log(JSON.stringify({ patched: true, results, activeAfter, finalActive }, null, 2));
