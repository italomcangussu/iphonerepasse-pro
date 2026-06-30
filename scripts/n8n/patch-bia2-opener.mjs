import * as kit from "./tool/patch-kit.mjs";

// Add the same cold-open rule to "Bia 2 ESTOQUE".
//
// Why here too: a bare "Oi" (intent "desconhecida") routes to bia2_continuation,
// so the OPENER is produced by Bia 2 ESTOQUE — not Bia 1. That's where the
// seller-framed "Qual modelo de iPhone você tem hoje?" came from. Bia 1 already
// got the rule (patch-bia1-opener.mjs) for the device-intent path; this covers
// the cold-greeting path so the opener is consistent regardless of route.
//
// saudacao is NOT on Bia 2's immediate input ($json), so reference it from the
// always-run "data_hora" node ($('data_hora').last().json.saudacao). The Bia 2
// prompt already prints "Desired model:" / "Tradein model:" in ESTADO DO LEAD, so
// the "ask only what's missing" rule reads off that. Keeps the
// {"message","transfer"} contract.
//
// Idempotent: re-running detects the marker and no-ops.
// Migrado para tool/patch-kit.mjs (Fase 5): I/O único. DRY=1 lê o snapshot.

const NODE_NAME = 'Bia 2 ESTOQUE';
const MARKER = 'REGRA DE ABERTURA (primeiro contato)';

const ANCHOR = '=== FAQ COMERCIAL CONTROLADO ===';

const BLOCK = `=== ${MARKER} ===
- Quando for o início da conversa (não há "última mensagem enviada ao cliente", OU o cliente só mandou uma saudação/abertura como "oi", "olá", "bom dia", "boa tarde", "tudo bem?" SEM dizer o que procura), abra com a saudação correta do horário + as perguntas de compra e de aparelho atual:
  "{{ $('data_hora').last().json.saudacao }}! Tudo bem? Qual modelo de iPhone você deseja comprar? E qual o modelo do seu aparelho atual?"
- NUNCA presuma que o cliente quer VENDER. O foco é a COMPRA; o aparelho atual é só para uma possível entrada/troca.
- Pergunte SÓ o que ainda NÃO foi informado nesta conversa (veja "ESTADO DO LEAD" abaixo):
  • Se "Desired model" já estiver preenchido, NÃO pergunte qual deseja comprar.
  • Se "Tradein model" já estiver preenchido (ou o cliente já disse que não tem aparelho para dar de entrada), NÃO pergunte o aparelho atual.
  • Se ambos já estiverem preenchidos, NÃO reabra — siga o fluxo normal.
- Sempre use a saudação do horário ({{ $('data_hora').last().json.saudacao }}, America/Fortaleza); nunca diga "bom dia" à tarde/noite.

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

kit.backup(await kit.getLive(), "bia2-opener");
const { activeAfter, finalActive } = await kit.safePut(workflow, "bia2-opener");
console.log(JSON.stringify({
  patched: true, node: NODE_NAME,
  bytesBefore: text.length, bytesAfter: newText.length, activeAfter, finalActive,
}, null, 2));
