import * as kit from "./tool/patch-kit.mjs";

// Fase 2: make Bia 2 ESTOQUE a SUPERSET that also handles continuation, by adding
// a "MODO CONTINUIDADE" section gated on commerce_context.inventory_checked_this_turn.
// Additive + anchored: when inventory WAS checked this turn (normal stock path) the
// new section is inert, so stock behavior is unchanged (no regression). When the
// turn did NOT consult stock, it overrides CENÁRIO C and applies continuation rules.
//
// Migrado para tool/patch-kit.mjs (Fase 5): I/O único. DRY=1 lê o snapshot.

const NODE = 'Bia 2 ESTOQUE';
const ANCHOR = '# CENÁRIOS DE ESTOQUE — LEIA PRIMEIRO';
const MARKER = 'MODO CONTINUIDADE — LEIA ANTES DOS CENÁRIOS DE ESTOQUE';

const SECTION = `# ════════════════════════════════════════════════════════════════════════════
# MODO CONTINUIDADE — LEIA ANTES DOS CENÁRIOS DE ESTOQUE
# ════════════════════════════════════════════════════════════════════════════

Use commerce_context.inventory_checked_this_turn para escolher o modo:

SE inventory_checked_this_turn = false (estoque NÃO consultado neste turno):
- NÃO use o CENÁRIO C nem trate como "modelo indisponível". Ausência de inventory ≠ inventory_found=false. Nunca diga que o modelo não está no estoque sem uma consulta real (inventory_found=false vinda do estoque).
- Cores: ofereça SOMENTE as de commerce_context.allowed_colors; se vazio, NÃO enumere nenhuma cor — pergunte "tem alguma cor de preferência?".
- Continuidade: se faq_found = true, responda com a FAQ aprovada e retome o funil com no máximo uma pergunta curta. Caso contrário, avance a próxima etapa operacional (cidade, bandeira, dados faltantes).
- Cidade antes do estoque: se preferred_city ausente ou "não definida", pergunte "Você prefere retirar em Fortaleza ou Sobral?" e não confirme disponibilidade, PIX, reserva ou retirada.
- Pós-simulação: se commerce_context.simulation.done = true, retome o fechamento; se simulation.error = true ou simulação ≥ 3 com indecisão, chame especialista (transfer:true) com uma frase antes.
- Handoff com mensagem: nunca transfira em silêncio — explique em uma frase curta e use transfer:true.

SE inventory_checked_this_turn = true: siga os CENÁRIOS DE ESTOQUE (A/B/C) abaixo normalmente.

`;

const wf = await kit.loadWorkflow();
const node = wf.nodes.find((n) => n.name === NODE);
if (!node) throw new Error(`Node not found: ${NODE}`);
const sm = node.parameters.options.systemMessage;
let status;
if (process.env.REVERT === '1') {
  if (sm.includes(`${SECTION}${ANCHOR}`)) {
    node.parameters.options.systemMessage = sm.replace(`${SECTION}${ANCHOR}`, ANCHOR);
    status = 'continuity section reverted';
  } else {
    status = 'nothing to revert';
  }
} else if (sm.includes(MARKER)) {
  status = 'already present';
} else {
  const occ = sm.split(ANCHOR).length - 1;
  if (occ !== 1) throw new Error(`Anchor found ${occ}x (need 1): ${ANCHOR}`);
  node.parameters.options.systemMessage = sm.replace(ANCHOR, `${SECTION}${ANCHOR}`);
  status = 'continuity section injected';
}

if (kit.DRY) { console.log(JSON.stringify({ dry: true, node: NODE, status }, null, 2)); process.exit(0); }
kit.backup(await kit.getLive(), "bia2-continuity-mode");
const { activeAfter, finalActive } = await kit.safePut(wf, "bia2-continuity-mode");
console.log(JSON.stringify({ node: NODE, status, activeAfter, finalActive }, null, 2));
