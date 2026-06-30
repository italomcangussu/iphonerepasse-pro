// Patch cirurgico FAQ/FLUXO v2 (2026-06-18) — corrige 4 problemas observados no
// replay do lead VD contra o sandbox, todos nos prompts (systemMessage) das Bias:
//   (1) TABELA: nao negar a tabela; reposicionar com valor (entregamos algo melhor
//       que uma tabela = simulacao completa).                       -> Bia 1
//   (2) REPETICAO de info nao solicitada (horario/abertura da loja). -> Bia 1/2/2SE
//   (3) COR do iPhone DESEJADO nao deve ser perguntada (depende do estoque). -> Bia 1
//   (4) CAUDA REDUNDANTE "ou vai direto?"/"ou prefere tudo no cartao?". -> Bia 1/2/2SE + exemplo Bia 2 SEM ESTOQUE
// Idempotente via marcadores. DRY=1 previa sem escrever.
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. NOTA: o nó "Bia 2 SEM ESTOQUE " foi fundido em 2026-06-18;
// patch histórico — hoje aborta em "Node not found" (preservado). DRY=1 não faz PUT.
import * as kit from "./tool/patch-kit.mjs";

// --- Bloco compartilhado injetado nos 3 nos (apos a ancora comum) ----------
const SHARED_ANCHOR = 'Reafirmar a escolha trava a conversa e reduz a qualidade do atendimento.';
const SHARED_MARKER = 'NAO REPETIR INFORMACAO NAO SOLICITADA';
const SHARED_ADD = `

NAO REPETIR INFORMACAO NAO SOLICITADA (humanizacao): NUNCA repita dados que o cliente nao perguntou — horario de funcionamento, status/abertura da loja, endereco. Diga cada um no maximo uma vez e so quando for perguntado ou realmente necessario; repetir informacao nao pedida desumaniza o atendimento.
SEM CAUDA REDUNDANTE: ao perguntar sobre entrada ou troca, NUNCA acrescente caudas como "ou vai direto?", "ou e a vista?", "ou prefere tudo no cartao?". Se o cliente nao quiser dar entrada/troca, e obvio que segue sem ela — pergunte apenas "Pretende dar algum iPhone como parte do pagamento?" / "Pretende dar seu iPhone como entrada?" / "Quer dar algum valor de entrada no Pix pra eu parcelar o restante no cartao?".`;

// --- Edits especificos da Bia 1 -------------------------------------------
const B1_TABELA_OLD = 'Nunca diga que não tem tabela — investigue mostrando a lista.';
const B1_TABELA_NEW = 'Nunca diga (nem dê a entender) que não tem tabela / tabela fixa / tabela de preços — isso é PROIBIDO. Em vez de negar, conduza com valor: numa frase curta explique que aqui o atendimento é personalizado e que, com poucas informações, você entrega algo melhor que uma tabela — uma simulação completa (com parcelamento, entrada e troca) já no valor real pra ele. Em seguida mostre a LISTA CURTA e siga as etapas.';

const B1_COLOR_OLD = '- Se houver available_colors disponíveis e o cliente ainda não informou cor, ofereça no máximo 2 opções .';
const B1_COLOR_NEW = '- NÃO peça nem ofereça a cor do iPhone DESEJADO antes de simular: a cor depende do estoque e perguntar antes faz o cliente pedir uma cor que talvez não tenhamos e perder a venda. Trate cor só APÓS a simulação, ou quando o cliente perguntar. (Isto NÃO vale para o aparelho de ENTRADA/trade-in, cuja cor faz parte da avaliação.)';

const B1_CATALOG_OLD = 'desired_capacity: "E qual armazenamento?"\ndesired_color: "Tem cor de preferência?"\ntradein_model (entrada/troca): "Qual é o modelo do iPhone que você quer dar como entrada?"';
const B1_CATALOG_NEW = 'desired_capacity: "E qual armazenamento?"\ntradein_model (entrada/troca): "Qual é o modelo do iPhone que você quer dar como entrada?"';

const B1_EXAMPLE_OLD = '\n\nFalta cor do desejado:\n{"message": "Tem cor de preferência?", "transfer": false}';
const B1_EXAMPLE_NEW = '';

// --- Edit especifico da Bia 2 SEM ESTOQUE (exemplo de entrada) -------------
const B2SE_ENTRY_OLD = 'Exemplo: "Antes de simular: voce quer dar algum valor de entrada no Pix/dinheiro e parcelar o restante no cartao, ou prefere tudo no cartao?" Nao invente valor de parcela aqui; apenas faca a pergunta.';
const B2SE_ENTRY_NEW = 'Exemplo: "Antes de simular: voce quer dar algum valor de entrada no Pix/dinheiro pra eu parcelar o restante no cartao?" (NUNCA acrescente "ou prefere tudo no cartao?", "ou vai direto?" e caudas similares — se o cliente nao quiser entrada, e obvio que vai tudo no cartao.) Nao invente valor de parcela aqui; apenas faca a pergunta.';

// node -> lista de edits {label, old, new, marker?}; marker => idempotencia
const TARGETS = {
  'Bia 1': [
    { label: 'shared', anchor: SHARED_ANCHOR, old: SHARED_ANCHOR, new: SHARED_ANCHOR + SHARED_ADD, marker: SHARED_MARKER },
    { label: 'tabela', old: B1_TABELA_OLD, new: B1_TABELA_NEW, marker: 'algo melhor que uma tabela' },
    { label: 'color-rule', old: B1_COLOR_OLD, new: B1_COLOR_NEW, marker: 'NÃO peça nem ofereça a cor do iPhone DESEJADO' },
    { label: 'catalog', old: B1_CATALOG_OLD, new: B1_CATALOG_NEW, marker: null, skipIfMissing: 'desired_color: "Tem cor de preferência?"' },
    { label: 'example', old: B1_EXAMPLE_OLD, new: B1_EXAMPLE_NEW, marker: null, skipIfMissing: 'Falta cor do desejado:' },
  ],
  'Bia 2 ESTOQUE': [
    { label: 'shared', anchor: SHARED_ANCHOR, old: SHARED_ANCHOR, new: SHARED_ANCHOR + SHARED_ADD, marker: SHARED_MARKER },
  ],
  'Bia 2 SEM ESTOQUE ': [
    { label: 'shared', anchor: SHARED_ANCHOR, old: SHARED_ANCHOR, new: SHARED_ANCHOR + SHARED_ADD, marker: SHARED_MARKER },
    { label: 'entry-example', old: B2SE_ENTRY_OLD, new: B2SE_ENTRY_NEW, marker: 'NUNCA acrescente "ou prefere tudo no cartao?"' },
  ],
};

const workflow = await kit.loadWorkflow();
const result = {};
for (const [nodeName, edits] of Object.entries(TARGETS)) {
  const node = workflow.nodes.find((n) => n.name === nodeName);
  if (!node) throw new Error(`Node not found: ${nodeName}`);
  let sys = node.parameters?.options?.systemMessage;
  if (typeof sys !== 'string') throw new Error(`${nodeName} has no systemMessage`);
  const log = [];
  for (const e of edits) {
    if (e.marker && sys.includes(e.marker)) { log.push(`${e.label}: already`); continue; }
    if (e.skipIfMissing && !sys.includes(e.skipIfMissing)) { log.push(`${e.label}: already (target gone)`); continue; }
    sys = kit.replaceOnce(sys, e.old, e.new, `${nodeName}/${e.label}`);
    log.push(`${e.label}: applied`);
  }
  node.parameters.options.systemMessage = sys;
  result[nodeName] = log;
}

if (kit.DRY) {
  console.log(JSON.stringify({ dry: true, result }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "bia-faq-flow-v2");
const { activeAfter, finalActive } = await kit.safePut(workflow, "bia-faq-flow-v2");
console.log(JSON.stringify({ patched: true, result, activeAfter, finalActive }, null, 2));
