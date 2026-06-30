import * as kit from "./tool/patch-kit.mjs";

// Stronger guard: a SECOND iPhone mentioned during collection = trade-in, and
// must NOT overwrite an already-set desired_model.
//
// Why (lead VD / smoke exec 419186): the opener asks two things, but the Bia
// abandons the current-device question after getting the desired model (it asks
// capacity next). So when the client later says "14pm", the last bot message is
// the capacity question — my opener-keyed rule can't fire — and the reconciler's
// "novo modelo substitui o desejado" rule overwrote desired (17pm -> 14pm).
//
// This rule is independent of the last bot message: if desired_model is already
// set and the client names a DIFFERENT iPhone during collection (before
// closing/simulating) WITHOUT explicitly switching what they want to buy, treat
// it as the trade-in (tradein_model + has_tradein=true + interest_type="troca")
// and keep desired_model. Also amends the "novo modelo substitui" rule with the
// same exception so the two don't contradict.
//
// Edits Memory 2 - Reconciler options.systemMessage. Idempotent (marker).
// Migrado para tool/patch-kit.mjs (Fase 5): I/O único. DRY=1 lê o snapshot.

const NODE_NAME = 'Memory 2 - Reconciler';
const MARKER = 'SEGUNDO MODELO DURANTE A COLETA = TRADE-IN';

// Insert a strong bullet right after the two opener bullets.
const ANCHOR_INSERT = 'Nao deixe o aparelho de entrada sobrescrever o desejado nem vice-versa.\n';
const BLOCK =
  '- SEGUNDO MODELO DURANTE A COLETA = TRADE-IN (NUNCA sobrescreva o desejado): se desired_model JA esta definido no LEAD_STATE ATUAL e o cliente menciona um SEGUNDO iPhone diferente durante a coleta (antes de fechar/simular) SEM dizer explicitamente que quer COMPRAR o outro (ex.: "na verdade quero o X", "mudei de ideia", "prefiro o X"), trate esse segundo modelo como tradein_model + has_tradein = true + interest_type = "troca". MANTENHA desired_model como esta; NAO o substitua. Isso vale mesmo que a ultima pergunta do bot tenha sido sobre capacidade/cor do desejado: um modelo de GERACAO/tier diferente do desejado, dito de passagem, e o aparelho de ENTRADA, nao uma troca de desejo.\n';

// Amend the conflicting "novo modelo substitui o desejado" rule with the exception.
const FIND_SUBST = 'Se o cliente trocou de assunto e pediu um novo modelo, desired_model recebe o NOVO modelo (substitui o antigo do LEAD_STATE ATUAL); nao mantenha o desejo anterior por inercia.';
const REPL_SUBST = 'Se o cliente trocou de assunto e pediu um novo modelo, desired_model recebe o NOVO modelo (substitui o antigo do LEAD_STATE ATUAL); nao mantenha o desejo anterior por inercia. EXCECAO: so substitua quando o cliente deixar claro que quer COMPRAR o outro modelo; se o segundo modelo for o aparelho ATUAL/de entrada dele, ele vai para tradein_model (has_tradein=true), nao para desired_model (ver regra SEGUNDO MODELO DURANTE A COLETA).';

const workflow = await kit.loadWorkflow();

const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`Node not found: ${NODE_NAME}`);

const text = node.parameters?.options?.systemMessage;
if (typeof text !== 'string') throw new Error(`${NODE_NAME}: options.systemMessage is not a string`);

if (text.includes(MARKER)) {
  console.log(JSON.stringify({ skipped: true, reason: 'already patched (second-model tradein)', node: NODE_NAME }, null, 2));
  process.exit(0);
}

for (const [label, find] of [['insert-anchor', ANCHOR_INSERT], ['subst-rule', FIND_SUBST]]) {
  const n = text.split(find).length - 1;
  if (n !== 1) throw new Error(`${NODE_NAME}: expected exactly 1 match for ${label}, found ${n} (drift? run the live guard)`);
}

let newText = text.replace(ANCHOR_INSERT, `${ANCHOR_INSERT}${BLOCK}`);
newText = newText.replace(FIND_SUBST, REPL_SUBST);
node.parameters.options.systemMessage = newText;

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, node: NODE_NAME, bytesBefore: text.length, bytesAfter: newText.length }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "reconciler-second-model-tradein");
const { activeAfter, finalActive } = await kit.safePut(workflow, "reconciler-second-model-tradein");
console.log(JSON.stringify({
  patched: true, node: NODE_NAME,
  bytesBefore: text.length, bytesAfter: newText.length, activeAfter, finalActive,
}, null, 2));
