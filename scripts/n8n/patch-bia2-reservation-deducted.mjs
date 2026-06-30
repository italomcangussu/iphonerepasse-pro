import * as kit from "./tool/patch-kit.mjs";

// Make the R$ 250 reservation clearly DEDUCTED from the device total.
//
// Why: the closing/PIX templates said "Taxa de reserva R$ 250,00" + "só paga a
// diferença", which reads like a R$ 250 FEE on top of the already-simulated
// price. Clients think they pay simulated_total + 250. They don't: the R$ 250 is
// an advance that is abated from the total — on pickup they pay (simulated − 250).
// The agent paraphrases these templates, so beyond fixing the two examples we add
// a HARD RULE in the FECHAMENTO block so the "deducted, not extra" meaning always
// survives the rewrite.
//
// Edits Bia 2 ESTOQUE options.systemMessage (expression). Idempotent: no-ops if
// the new wording is already present; partial state throws (drift → run guard).
// Migrado para tool/patch-kit.mjs (Fase 5): I/O único. DRY=1 lê o snapshot.

const NODE_NAME = 'Bia 2 ESTOQUE';
const MARKER = 'são ABATIDOS do valor do aparelho';

const EDITS = [
  // Lead line of both closing templates (appears 2×)
  {
    expect: 2,
    find: 'Sim, está no nosso estoque. Caso queira reservar, aí quando chegar na nossa loja só paga a diferença.',
    replace: 'Sim, está no nosso estoque. Pra reservar, é uma entrada de R$ 250 via Pix — e esse valor é abatido do total do aparelho, não é cobrança extra.',
  },
  // Fee line of both closing templates (appears 2×)
  {
    expect: 2,
    find: 'Taxa de reserva R$ 250,00. Pra deixar reservado para você.',
    replace: 'Quando chegar na nossa loja, você paga só o restante (o valor simulado já com os R$ 250 da reserva descontados). Pra deixar reservado para você.',
  },
  // Hard rule in the FECHAMENTO NA CIDADE DO ESTOQUE block (appears 1×)
  {
    expect: 1,
    find: '- Envie PIX de reserva + endereco da loja da cidade do estoque.',
    replace: '- Envie PIX de reserva + endereco da loja da cidade do estoque.\n- SEMPRE deixe claro que os R$ 250 da reserva são ABATIDOS do valor do aparelho (não é taxa extra): na retirada o cliente paga o valor simulado MENOS os R$ 250. Nunca dê a entender que a reserva é um custo adicional ao preço já simulado.',
  },
];

const workflow = await kit.loadWorkflow();

const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`Node not found: ${NODE_NAME}`);
if (node.type !== '@n8n/n8n-nodes-langchain.agent') throw new Error(`${NODE_NAME} is not an agent node (got ${node.type})`);

const text = node.parameters?.options?.systemMessage;
if (typeof text !== 'string') throw new Error(`${NODE_NAME}: options.systemMessage is not a string`);

if (text.includes(MARKER)) {
  console.log(JSON.stringify({ skipped: true, reason: 'already patched (reservation deduction)', node: NODE_NAME }, null, 2));
  process.exit(0);
}

let newText = text;
for (const { find, replace, expect } of EDITS) {
  const occurrences = newText.split(find).length - 1;
  if (occurrences !== expect) {
    throw new Error(`${NODE_NAME}: expected ${expect} match(es) for ${JSON.stringify(find.slice(0, 50))}, found ${occurrences} (drift? run the live guard)`);
  }
  newText = newText.split(find).join(replace);
}

node.parameters.options.systemMessage = newText;

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, node: NODE_NAME, edits: EDITS.length, bytesBefore: text.length, bytesAfter: newText.length }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "bia2-reservation-deducted");
const { activeAfter, finalActive } = await kit.safePut(workflow, "bia2-reservation-deducted");
console.log(JSON.stringify({
  patched: true, node: NODE_NAME, edits: EDITS.length,
  bytesBefore: text.length, bytesAfter: newText.length, activeAfter, finalActive,
}, null, 2));
