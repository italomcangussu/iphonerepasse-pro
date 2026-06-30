// Bia 1 (pré-estoque): aplica as regras de FAQ/FLUXO.
//  - Preço sob demanda (remove "NUNCA cite preço nem se perguntar").
//  - Nunca perguntar cidade nesta fase (cidade só pós-simulação).
//  - Lista curta sem preço para perguntas genéricas / pedido de tabela.
//  - Autorização direta do seminovo ("posso te fazer algumas perguntas...").
//  - Banir "compra direta" + confirmar variante (13/Pro/Pro Max).
// Idempotente via APPEND_MARKER. Expression prompt fica em workflow.json → patch.
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. DRY=1 lê o snapshot local, não faz PUT.
import * as kit from "./tool/patch-kit.mjs";

const NODE = 'Bia 1';
const APPEND_MARKER = '// ATUALIZACAO DE FLUXO (FAQ/FLUXO) v1';

const PRECO_OLD = `NUNCA cite preço, valor ou faixa de preço — nem se o cliente perguntar. Diga que o valor sai certinho na simulação (após a avaliação do aparelho de entrada, se houver) e siga a coleta. Afirme o estoque com confiança quando a pré-consulta trouxer o item: diga "Temos o [available_models] [available_conditions] em estoque com armazenamento de [available_capacities]" ou "Temos o [modelo] em estoque". NUNCA use hedge como "apareceu por aqui", "vi opções" ou "vi que tem opção ... por aqui". Ainda assim, NÃO confirme como reserva/separação nem cite preço.`;
const PRECO_NEW = `Não OFEREÇA preço espontaneamente na navegação. MAS se o cliente PERGUNTAR preço, RESPONDA: o valor à vista de um modelo (use available_options[].sell_price) e a diferença de valor entre dois modelos. Parcelamento, entrada e troca só na simulação da Bia 2. Afirme o estoque com confiança quando a pré-consulta trouxer o item: diga "Temos o [available_models] [available_conditions] em estoque com armazenamento de [available_capacities]" ou "Temos o [modelo] em estoque". NUNCA use hedge como "apareceu por aqui", "vi opções" ou "vi que tem opção ... por aqui". Ainda assim, NÃO confirme como reserva/separação.`;

const CITY_OLD = `Se já tiver modelo e capacidade, mas faltar cidade: {"message": "Voce prefere retirar em Fortaleza ou Sobral?", "transfer": false}`;
const CITY_NEW = `Nunca pergunte cidade de retirada nesta fase: a cidade só é perguntada após a simulação aceita.`;

const MAX2_OLD = `mencione no máximo 2 opções disponíveis em 1 frase curta e, ao final, peça permissão para avaliar o aparelho de entrada. Não junte cor, nome e bloco completo no mesmo envio.`;
const MAX2_NEW = `quando a pergunta for genérica (ex.: "quais vocês têm", "modelos Pro Max", pedido de tabela), monte uma LISTA CURTA: até 5 itens por modelo + capacidade (marque novo/seminovo quando útil), SEM cor e SEM preço, terminando com "qual desses te interessa?". Nunca diga que não tem tabela — investigue mostrando a lista. Se houver aparelho de entrada, ao final peça permissão para avaliá-lo. Não junte cor, nome e bloco completo no mesmo envio.`;

const AUTH_OLD = `Posso te mandar as perguntinhas pra calcular o valor do seu [tradein_model] como entrada?"`;
const AUTH_NEW = `Posso te fazer algumas perguntas sobre o seu iPhone?"`;

const APPEND_BLOCK = `

${APPEND_MARKER}
- NUNCA use os termos "compra direta" nem "tem aparelho de entrada?". Para saber se há troca, pergunte de forma humana: "você pretende dar um iPhone usado como parte do pagamento?".
- Se needs_model_tier_confirmation = true ou routing_decision = "ask_model_tier" (cliente disse só "13/14/15"), antes de seguir confirme a variante: "esse 13 é o normal, o Pro ou o Pro Max?".
- Diferença de preço entre dois modelos: se o cliente perguntar, calcule e informe a diferença usando available_options[].sell_price (sem detalhar parcelas).`;

const workflow = await kit.loadWorkflow();
const node = workflow.nodes.find((n) => n.name === NODE);
if (!node) throw new Error(`Node not found: ${NODE}`);
let sys = node.parameters?.options?.systemMessage;
if (typeof sys !== 'string') throw new Error(`${NODE} has no systemMessage`);

let result;
if (sys.includes(APPEND_MARKER)) {
  result = { already: true };
} else {
  sys = kit.replaceOnce(sys, PRECO_OLD, PRECO_NEW, `${NODE} preço`);
  sys = kit.replaceOnce(sys, CITY_OLD, CITY_NEW, `${NODE} cidade`);
  sys = kit.replaceOnce(sys, MAX2_OLD, MAX2_NEW, `${NODE} lista-curta`);
  sys = kit.replaceOnce(sys, AUTH_OLD, AUTH_NEW, `${NODE} autorização`);
  sys = sys + APPEND_BLOCK;
  node.parameters.options.systemMessage = sys;
  result = { already: false };
}

if (kit.DRY) {
  console.log(JSON.stringify({ dry: true, result }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "bia1-price-city-list");
const { verify, activeAfter, finalActive } = await kit.safePut(workflow, "bia1-price-city-list");
const applied = verify.nodes.find((n) => n.name === NODE)?.parameters?.options?.systemMessage?.includes(APPEND_MARKER);
console.log(JSON.stringify({ patched: true, node: NODE, result, activeAfter, finalActive, applied }, null, 2));
