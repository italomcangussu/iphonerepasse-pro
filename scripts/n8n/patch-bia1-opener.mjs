import * as kit from "./tool/patch-kit.mjs";

// Add an explicit cold-open rule to the "Bia 1" agent prompt.
//
// Problem (observed live 2026-06-19): for a cold "Oi" the agent improvised
// "Qual modelo de iPhone você tem hoje?" — a SELLER-framed question — when the
// client actually wanted to buy. The prompt had the greeting (saudacao,
// time-based, America/Fortaleza) and the desired/tradein state available but no
// opener directive, so the LLM guessed.
//
// Fix: insert a "REGRA DE ABERTURA" section. On first contact / bare greeting,
// open with the correct time-of-day greeting + ask which model to BUY and the
// current device — but only the parts not already provided in the first message.
// Never assume the client is selling. Keeps the {"message","transfer"} contract.
//
// Idempotent: re-running detects the marker and no-ops.
// Migrado para tool/patch-kit.mjs (Fase 5): I/O único. DRY=1 lê o snapshot.

const NODE_NAME = 'Bia 1';
const MARKER = 'REGRA DE ABERTURA (primeiro contato)';

const ANCHOR = '=== FAQ COMERCIAL CONTROLADO ===';

const BLOCK = `=== ${MARKER} ===
- Quando for o início da conversa (não há "última mensagem enviada ao cliente", OU o cliente só mandou uma saudação/abertura como "oi", "olá", "bom dia", "boa tarde", "tudo bem?" SEM dizer o que procura), abra com a saudação correta do horário + as perguntas de compra e de aparelho atual:
  "{{ $json.saudacao }}! Tudo bem? Qual modelo de iPhone você deseja comprar? E qual o modelo do seu aparelho atual?"
- NUNCA presuma que o cliente quer VENDER. O foco é a COMPRA; o aparelho atual é só para uma possível entrada/troca.
- Pergunte SÓ o que ainda NÃO foi informado nesta conversa:
  • Se "Desired model" já tem valor, NÃO pergunte qual deseja comprar.
  • Se "Tradein model" já tem valor (ou o cliente já disse que não tem aparelho para dar de entrada), NÃO pergunte o aparelho atual.
  • Se ambos já estão preenchidos, NÃO reabra — siga a AÇÃO PRIORITÁRIA.
- Sempre use a saudação do horário ({{ $json.saudacao }}, America/Fortaleza); nunca diga "bom dia" à tarde/noite.

`;

const workflow = await kit.loadWorkflow();

const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`Node not found: ${NODE_NAME}`);
if (node.type !== '@n8n/n8n-nodes-langchain.agent') throw new Error(`${NODE_NAME} is not an agent node (got ${node.type})`);

const text = node.parameters?.text;
if (typeof text !== 'string') throw new Error(`${NODE_NAME}: parameters.text is not a string`);

if (text.includes(MARKER)) {
  console.log(JSON.stringify({ skipped: true, reason: 'already patched', node: NODE_NAME }, null, 2));
  process.exit(0);
}

const occurrences = text.split(ANCHOR).length - 1;
if (occurrences !== 1) {
  throw new Error(`${NODE_NAME}: expected exactly 1 anchor match for "${ANCHOR}", found ${occurrences} (workflow drifted? run the live guard)`);
}

const newText = text.replace(ANCHOR, `${BLOCK}${ANCHOR}`);
node.parameters.text = newText;

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, node: NODE_NAME, bytesBefore: text.length, bytesAfter: newText.length }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "bia1-opener");
const { activeAfter, finalActive } = await kit.safePut(workflow, "bia1-opener");
console.log(JSON.stringify({
  patched: true, node: NODE_NAME,
  bytesBefore: text.length, bytesAfter: newText.length, activeAfter, finalActive,
}, null, 2));
