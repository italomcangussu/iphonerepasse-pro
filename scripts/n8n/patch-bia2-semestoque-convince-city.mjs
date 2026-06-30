// Bia 2 SEM ESTOQUE (P4 + D1 no prompt):
//  - Cidade só pós-simulação: a decisão ask_client_city_before_stock foi
//    removida do roteamento (vira ask_pickup_city_after_sim). Atualiza as
//    referências e proíbe perguntar cidade antes da simulação.
//  - Convencer no seminovo; oferecer especialista só para iPhone NOVO.
// Node name tem espaço no fim: 'Bia 2 SEM ESTOQUE '.
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. NOTA: o nó "Bia 2 SEM ESTOQUE " foi fundido em 2026-06-18;
// patch histórico — hoje aborta em "Node not found" (preservado). DRY=1 não faz PUT.
import * as kit from "./tool/patch-kit.mjs";

const NODE = 'Bia 2 SEM ESTOQUE ';
const APPEND_MARKER = '// CONVENCER SEMINOVO / CIDADE POS-SIM (FAQ/FLUXO) v1';

const CITY_ROUTE_OLD = `Se routing_decision = "ask_client_city_before_stock", responda apenas perguntando: "Voce prefere retirar em Fortaleza ou Sobral?"`;
const CITY_ROUTE_NEW = `Se routing_decision = "ask_pickup_city_after_sim" (só após a simulação aceita), responda perguntando: "Voce prefere retirar em Fortaleza ou Sobral?". NUNCA pergunte cidade antes da simulação aceita.`;

const CITY_ABSENT_OLD = `Se preferred_city estiver ausente ou "não definida", nao confirme disponibilidade, endereco, PIX, reserva ou retirada. Pergunte: "Voce prefere retirar em Fortaleza ou Sobral?"`;
const CITY_ABSENT_NEW = `Antes da simulação, NÃO pergunte cidade. A cidade só é necessária ao confirmar reserva/retirada, após a proposta aceita; só aí, se preferred_city estiver ausente, pergunte: "Voce prefere retirar em Fortaleza ou Sobral?". Sem cidade definida, não confirme endereco, PIX, reserva ou retirada.`;

const APPEND_BLOCK = `

${APPEND_MARKER}
- Falta de modelo/cor para iPhone NOVO indisponível: pode oferecer o especialista.
- Falta de modelo/cor em SEMINOVO: NÃO ofereça especialista por isso. Convença mostrando a alternativa mais próxima em estoque e oferecendo simular ("posso simular o parcelamento dessa opção pra você?"). Só transfira seminovo por erro de simulação ou indecisão após 3 simulações.
- CONDIÇÃO DO APARELHO DE ENTRADA: se routing_decision = "tradein_condition_human_eval" (o aparelho de entrada tem contato com líquido, arranhões ou peça trocada), NÃO simule nem prometa valor de troca. Explique com simpatia que esse aparelho precisa de uma avaliação presencial/humana para garantir o melhor valor e transfira (transfer: true). Ex.: {"message": "Pelo que você descreveu do seu aparelho, pra garantir a avaliação certinha e o melhor valor da sua entrada, vou te passar pro nosso especialista, tá?", "transfer": true}`;

const workflow = await kit.loadWorkflow();
const node = workflow.nodes.find((n) => n.name === NODE);
if (!node) throw new Error(`Node not found: ${NODE}`);
let sys = node.parameters?.options?.systemMessage;
if (typeof sys !== 'string') throw new Error(`${NODE} has no systemMessage`);

let result;
if (sys.includes(APPEND_MARKER)) {
  result = { already: true };
} else {
  sys = kit.replaceOnce(sys, CITY_ROUTE_OLD, CITY_ROUTE_NEW, `${NODE} city-route`);
  sys = kit.replaceOnce(sys, CITY_ABSENT_OLD, CITY_ABSENT_NEW, `${NODE} city-absent`);
  sys = sys + APPEND_BLOCK;
  node.parameters.options.systemMessage = sys;
  result = { already: false };
}

if (kit.DRY) {
  console.log(JSON.stringify({ dry: true, result }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "bia2-semestoque-convince-city");
const { verify, activeAfter, finalActive } = await kit.safePut(workflow, "bia2-semestoque-convince-city");
const applied = verify.nodes.find((n) => n.name === NODE)?.parameters?.options?.systemMessage?.includes(APPEND_MARKER);
console.log(JSON.stringify({ patched: true, node: NODE, result, activeAfter, finalActive, applied }, null, 2));
