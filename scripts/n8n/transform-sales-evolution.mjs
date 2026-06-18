// transform-sales-evolution.mjs — edições puras/idempotentes sobre um objeto-workflow.
// Mesma função no teste (sobre workflow.json) e no deploy (sobre o vivo fresco) → zero drift.
// (A) remove card_brand como gate de simulação + a pergunta de bandeira dos prompts.
// (B) blocos aditivos de venda na Bia 2 ESTOQUE / Bia 1.
// node via nvm.

export function replaceOnce(str, find, repl) {
  const n = str.split(find).length - 1;
  if (n !== 1) throw new Error(`replaceOnce: esperado 1 match, achei ${n} para: ${JSON.stringify(find.slice(0, 60))}…`);
  return str.replace(find, repl);
}
export function insertAfter(str, anchor, block) {
  const n = str.split(anchor).length - 1;
  if (n !== 1) throw new Error(`insertAfter: âncora não única (${n}): ${JSON.stringify(anchor.slice(0, 60))}…`);
  return str.replace(anchor, anchor + "\n" + block);
}

const node = (wf, name) => {
  const x = wf.nodes.find((n) => n.name === name);
  if (!x) throw new Error(`nó ausente: ${name}`);
  return x;
};

// ── (A) gates: card_brand deixa de ser pré-requisito de simulação ──
export function removeCardBrandGates(wf) {
  const rf = node(wf, "Code Routing Flags");
  let js = rf.parameters.jsCode;
  if (js.includes("!!state.card_brand")) {
    // repasseV2CanRequestSimulation
    js = replaceOnce(js,
      "  cashEntryResolved === true &&\n  !!state.card_brand &&\n",
      "  cashEntryResolved === true &&\n");
    // shouldSimulateNow
    js = replaceOnce(js,
      "  !!state.stock_item_id &&\n  !!state.card_brand &&\n",
      "  !!state.stock_item_id &&\n");
  }
  if (js.includes("!state.card_brand")) {
    // needsCashEntryQuestion (cláusula redundante — cashEntryResolved/postSimulationFlow cobrem)
    js = replaceOnce(js,
      "  cashEntryResolved !== true &&\n  !state.card_brand &&\n",
      "  cashEntryResolved !== true &&\n");
  }
  rf.parameters.jsCode = js;

  const refresh = node(wf, "Code Refresh Lead State Before Switch2");
  let r = refresh.parameters.jsCode;
  if (r.includes("!!inputData.card_brand")) {
    r = replaceOnce(r, "  !!inputData.card_brand &&\n", "");
  }
  refresh.parameters.jsCode = r;
  return wf;
}

// ── (A) voz: remover a pergunta de bandeira de Bia 2 / Bia 1 ──
// Regra de naturalidade: ao anunciar a simulação, não repetir o que o cliente já
// escolheu nem dizer "padrão". Repetição de informação soa robótica.
export const SIM_NO_REPEAT = `NUNCA repita o modelo/capacidade já escolhidos ao anunciar a simulação. Diga apenas: "Vou simular no cartão pra você." (sem nome do aparelho, sem a palavra "padrão").`;

export const ESTAGIO2_NOVO = `# ESTÁGIO 2 — AVANÇO PARA SIMULAÇÃO (NUNCA PERGUNTE BANDEIRA)

Nunca pergunte a bandeira do cartão. A simulação usa o cartão automaticamente. Quando o cliente confirmar que a opção apresentada serve, avance direto para a simulação:

"Fechou. Vou simular no cartão pra você já ver como fica. 😊"

${SIM_NO_REPEAT}
Se você ainda não perguntou sobre entrada, faça a pergunta de entrada (Pix/dinheiro) ANTES de simular — nunca pergunte bandeira no lugar dela.
Se o cliente informar uma bandeira espontaneamente, use-a; mas nunca bloqueie ou atrase a simulação por falta desse dado. Nunca cite a bandeira nem diga "padrão" ou "visa_master" ao cliente — fale só "no cartão".`;

export function removeCardBrandPrompts(wf) {
  const b2 = node(wf, "Bia 2 ESTOQUE");
  let sm = b2.parameters.options.systemMessage;
  if (sm.includes("# ESTÁGIO 2 — BANDEIRA DO CARTÃO")) {
    sm = replaceOnce(sm,
      `# ESTÁGIO 2 — BANDEIRA DO CARTÃO

(só após cliente confirmar que a opção apresentada serve)

"Fechou. Qual a bandeira do seu cartão? Visa, Master, Elo ou Amex?"

Mapeamento: Visa/Master → "visa_master" | Elo → "elo" | Amex → "amex" | Hipercard → "hipercard".`,
      ESTAGIO2_NOVO);
    const subs = [
      ["Qual a bandeira do seu cartão pra eu simular?", "Vou simular no cartão pra você."],
      ["Qual a bandeira do seu cartão pra eu já simular o valor pra você?", "Vou simular no cartão pra você."],
      ["conduza direto para a simulação pedindo a bandeira do cartão.", "conduza direto para a simulação no cartão."],
      ["diga que vai já simular o valor certinho pra ele e peça a bandeira do cartão.", "diga que vai já simular o valor certinho pra ele no cartão."],
      ["com mais razão não cite preço nem peça bandeira:", "com mais razão não cite preço:"],
      ["Como padrao, conduza para simulacao e peca a bandeira do cartao.", "Como padrao, conduza para a simulacao no cartao (nunca pergunte bandeira)."],
      ["Se o cliente insistir no preco antes de informar bandeira ou antes da simulacao,", "Se o cliente insistir no preco antes da simulacao,"],
      ["A condicao final no cartao eu consigo te passar certinha na simulacao. Qual a bandeira do seu cartao?", "A condicao final no cartao eu consigo te passar certinha na simulacao."],
      ["(bandeira do cartão, simulação ou fechamento)", "(simulação ou fechamento)"],
      ["(cidade, capacidade, bandeira, simulação ou fechamento)", "(cidade, capacidade, simulação ou fechamento)"],
    ];
    for (const [a, b] of subs) sm = sm.split(a).join(b);
    b2.parameters.options.systemMessage = sm;
  }

  const b1 = node(wf, "Bia 1");
  let s1 = b1.parameters.options.systemMessage;
  s1 = s1.split("(cidade, capacidade, bandeira, simulação ou fechamento)").join("(cidade, capacidade, simulação ou fechamento)");
  s1 = s1.split("cor quando fizer sentido, cidade de retirada e bandeira do cartão.").join("cor quando fizer sentido e cidade de retirada.");
  b1.parameters.options.systemMessage = s1;
  return wf;
}

// ── (A) refinamento de naturalidade: "no cartão" em vez de "condição padrão" +
// não repetir modelo/capacidade ao anunciar a simulação. Migra o texto já no vivo. ──
export function refineSimVoice(wf) {
  const b2 = node(wf, "Bia 2 ESTOQUE");
  let sm = b2.parameters.options.systemMessage;
  sm = sm.split("na condição padrão do cartão").join("no cartão");
  sm = sm.split("na condicao padrao do cartao").join("no cartao");
  sm = sm.split("A simulação usa a condição padrão do cartão automaticamente.")
         .join("A simulação usa o cartão automaticamente.");
  sm = sm.split('Para o cliente, chame sempre de "condição padrão do cartão", nunca diga "visa_master".')
         .join('Nunca cite a bandeira nem diga "padrão" ou "visa_master" ao cliente — fale só "no cartão".');
  // regra anti-repetição logo após o avanço para simulação do ESTÁGIO 2
  const anchor = '"Fechou. Vou simular no cartão pra você já ver como fica. 😊"';
  if (sm.includes(anchor) && !sm.includes(SIM_NO_REPEAT)) {
    sm = sm.replace(anchor, anchor + "\n\n" + SIM_NO_REPEAT);
  }
  b2.parameters.options.systemMessage = sm;
  return wf;
}

export function transformPhase(wf, phase) {
  const order = ["A", "B1", "B2", "B3", "B4", "B5"];
  const upto = phase === "B" ? order : order.slice(0, order.indexOf(phase) + 1);
  for (const p of upto) {
    if (p === "A") { removeCardBrandGates(wf); removeCardBrandPrompts(wf); refineSimVoice(wf); }
    if (p === "B1") b1Cta(wf);
    if (p === "B2") b2Objection(wf);
    if (p === "B3") b3Recovery(wf);
    if (p === "B4") b4Recommend(wf);
    if (p === "B5") b5Microconv(wf);
  }
  return wf;
}

// ── (B1) CTA pós-simulação forte (Bia 2) ──
export const B1_CTA = `Após a simulação, NUNCA feche com pergunta fraca ("o que achou?", "quer seguir?"). Conduza com proposta de valor + próximo passo concreto. Varie entre:
{"message": "Essa proposta ficou boa porque já considera seu aparelho de entrada e deixa o restante parcelado. Quer que eu já deixe o aparelho separado pra você?", "transfer": false}
{"message": "Se quiser deixar a parcela mais leve, dá pra simular com uma entrada maior. Prefere seguir com essa condição ou ajustar a entrada?", "transfer": false}`;

export function b1Cta(wf) {
  const b2 = node(wf, "Bia 2 ESTOQUE");
  let sm = b2.parameters.options.systemMessage;
  // (1) diretiva fraca pós-simulação
  const weak = `Após a simulação: "O que achou da proposta? Quer que eu já encaminhe o fechamento? 😃"`;
  if (sm.includes(weak)) sm = replaceOnce(sm, weak, B1_CTA);
  // (2) o mesmo fechamento fraco aparecia num exemplo de EXEMPLOS POR CENÁRIO
  const weakExample = "O que achou da proposta? Quer que eu já encaminhe o fechamento? 😃";
  if (sm.includes(weakExample)) {
    sm = replaceOnce(sm, weakExample,
      "Essa condição já considera seu aparelho de entrada e fica parcelada — quer que eu já deixe o aparelho separado pra você?");
  }
  b2.parameters.options.systemMessage = sm;
  return wf;
}

// ── (B2) régua de objeção de preço (Bia 2) ──
export const B2_OBJECTION = `# RÉGUA DE OBJEÇÃO DE PREÇO (TRATE ANTES DE TRANSFERIR)

Quando o cliente achar caro ou pedir desconto, NÃO transfira na primeira objeção. Suba a régua:
1ª objeção — reforce valor + ofereça caminho:
{"message": "Entendo. A proposta já considera a máxima avaliação do seu aparelho de entrada, garantia e a confiança da nossa loja. Quer que eu deixe a parcela mais leve com uma entrada, ou posso simular em mais vezes no cartão (vai até 18x)?", "transfer": false}
2ª objeção — ofereça alternativa concreta:
{"message": "Dá pra seguir por dois caminhos: reduzir a parcela com uma entrada maior, ou eu te mostro uma opção mais em conta no mesmo padrão. Quer que eu mande outras opções?", "transfer": false}
3ª objeção ou pedido explícito de negociação humana — aí sim transfira:
{"message": "Pra tentar uma condição fora da simulação padrão, vou chamar nosso especialista da iPhone Repasse pra ver o melhor cenário com você.", "transfer": true}`;

export function b2Objection(wf) {
  const b2 = node(wf, "Bia 2 ESTOQUE");
  let sm = b2.parameters.options.systemMessage;
  if (!sm.includes("# RÉGUA DE OBJEÇÃO DE PREÇO")) {
    sm = insertAfter(sm, "# REGRAS TRANSVERSAIS", "\n" + B2_OBJECTION);
  }
  b2.parameters.options.systemMessage = sm;
  return wf;
}

// ── (B3) recuperação de cliente indeciso (Bia 2) ──
export const B3_RECOVERY = `# RECUPERAÇÃO DE CLIENTE INDECISO (CONTINUIDADE — NÃO RECOMECE O ATENDIMENTO)

Quando o cliente some e volta, ou está em cima do muro, NÃO refaça perguntas já respondidas. Reengaje a partir do que já existe:
{"message": "A opção que simulamos ainda é uma boa referência. Quer seguir nela ou prefere que eu veja uma alternativa mais em conta?", "transfer": false}
{"message": "Pra eu te ajudar sem mandar um monte de opção solta, você prefere priorizar menor parcela ou melhor custo-benefício?", "transfer": false}`;

export function b3Recovery(wf) {
  const b2 = node(wf, "Bia 2 ESTOQUE");
  let sm = b2.parameters.options.systemMessage;
  if (!sm.includes("# RECUPERAÇÃO DE CLIENTE INDECISO")) {
    sm = insertAfter(sm, "CONTINUIDADE SEM CONSULTA DE ESTOQUE", "\n" + B3_RECOVERY);
  }
  b2.parameters.options.systemMessage = sm;
  return wf;
}

// ── (B4) recomendação ativa + novo×seminovo (Bia 2) ──
export const B4_RECOMMEND = `# RECOMENDAÇÃO ATIVA (RECOMENDE, NÃO SÓ LISTE)

Com mais de uma opção disponível, recomende uma com justificativa curta em vez de listar tudo:
{"message": "Das opções disponíveis, eu iria no 256GB porque costuma ser o melhor equilíbrio entre espaço e valor. Quer que eu simule nele?", "transfer": false}
Novo vs seminovo, deixe o cliente escolher com critério:
{"message": "Se a ideia é economizar, o seminovo faz mais sentido. Se quer garantia Apple cheia, o novo é melhor. Qual caminho você prefere?", "transfer": false}`;

export function b4Recommend(wf) {
  const b2 = node(wf, "Bia 2 ESTOQUE");
  let sm = b2.parameters.options.systemMessage;
  if (!sm.includes("# RECOMENDAÇÃO ATIVA")) {
    sm = insertAfter(sm, "# CENÁRIOS DE ESTOQUE — LEIA PRIMEIRO", "\n" + B4_RECOMMEND);
  }
  b2.parameters.options.systemMessage = sm;
  return wf;
}

// ── (B5) microconversões antes de perguntas (Bia 1) ──
export const B5_MICRO = `# MICROCONVERSÃO ANTES DE PERGUNTAR

Antes de uma pergunta importante (capacidade, autorização de avaliação do trade-in, entrada), dê um motivo curto que mostre benefício pro cliente:
{"message": "Pra eu buscar a opção certa pra sua necessidade, você procura iPhone com qual armazenamento?", "transfer": false}
{"message": "Pra tentar puxar o melhor valor possível no seu iPhone de entrada, posso te fazer umas perguntas rápidas sobre ele?", "transfer": false}
{"message": "Pra deixar a simulação mais próxima da realidade, você quer colocar algum valor de entrada no Pix ou prefere ver sem entrada?", "transfer": false}`;

export function b5Microconv(wf) {
  const b1 = node(wf, "Bia 1");
  let sm = b1.parameters.options.systemMessage;
  if (!sm.includes("# MICROCONVERSÃO ANTES DE PERGUNTAR")) {
    sm = insertAfter(sm, "# COMO DECIDIR O QUE PERGUNTAR — LEIA PRIMEIRO", "\n" + B5_MICRO);
  }
  b1.parameters.options.systemMessage = sm;
  return wf;
}
