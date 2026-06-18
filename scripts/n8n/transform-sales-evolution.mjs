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
// Versão anterior (deployada) — migrada para a versão forte com few-shot ❌→✅.
const SIM_NO_REPEAT_PREV = `NUNCA repita o modelo/capacidade já escolhidos ao anunciar a simulação. Diga apenas: "Vou simular no cartão pra você." (sem nome do aparelho, sem a palavra "padrão").`;
export const SIM_NO_REPEAT = `REGRA DURA DE NÃO-REPETIÇÃO (naturalidade): é PROIBIDO repetir o modelo/capacidade/cor que o cliente já escolheu — ao anunciar a simulação, ao perguntar sobre entrada e em qualquer retomada. Também é PROIBIDO dizer "padrão". Repetir o que já foi dito é comportamento inaceitável.
❌ "Fechou, iPhone 15 Pro Max 256GB. Antes de simular..."  →  ✅ "Fechou. Antes de simular..."
❌ "Vou simular o iPhone 15 Pro Max 256GB Titânio Natural no cartão pra você."  →  ✅ "Vou simular no cartão pra você."
❌ "Vou simular o parcelamento do 15 Pro Max 256GB pra você."  →  ✅ "Boa, vou simular no cartão e já te mando."`;

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
  // migra a versão anterior da regra anti-repetição para a versão forte (few-shot)
  sm = sm.split(SIM_NO_REPEAT_PREV).join(SIM_NO_REPEAT);
  // regra anti-repetição logo após o avanço para simulação do ESTÁGIO 2
  const anchor = '"Fechou. Vou simular no cartão pra você já ver como fica. 😊"';
  if (sm.includes(anchor) && !sm.includes(SIM_NO_REPEAT)) {
    sm = sm.replace(anchor, anchor + "\n\n" + SIM_NO_REPEAT);
  }
  b2.parameters.options.systemMessage = sm;
  return wf;
}

// ── (A) naturalidade na apresentação de disponibilidade: não repetir o
// modelo/capacidade já escolhidos; citar só o que é novo (disponível, loja/cidade;
// no fuzzy, a cor real). ──
export function refineAvailabilityVoice(wf) {
  const b2 = node(wf, "Bia 2 ESTOQUE");
  let sm = b2.parameters.options.systemMessage;
  const pairs = [
    // CASO A (match exato) — nada do que o cliente já escolheu é repetido
    ["Show, o iPhone 17 Pro Max 512GB Azul Profundo Novo tá disponível na nossa loja de [stock_city]. Vou simular no cartão pra você.",
     "Show, esse tá disponível na nossa loja de [stock_city]. Vou simular no cartão pra você."],
    ["Show, o iPhone 17 Pro Max 512GB Azul Profundo Novo tá disponível na nossa loja de [stock_city]. Vou já simular o valor pra você no cartão.",
     "Show, esse tá disponível na nossa loja de [stock_city]. Vou já simular o valor pra você no cartão."],
    ["Show, o iPhone 17 Pro Max 512GB Azul Profundo Novo tá disponível na nossa loja de Sobral. Vou simular no cartão pra você.",
     "Show, esse tá disponível na nossa loja de Sobral. Vou simular no cartão pra você."],
    // CASO B1 (fuzzy) — mantém a cor real (info nova), dropa capacidade/condição
    ["Esse é o Azul Profundo. 512GB Novo tá disponível na nossa loja de [stock_city]. Vou simular no cartão pra você.",
     "Esse é o Azul Profundo, disponível na nossa loja de [stock_city]. Vou simular no cartão pra você."],
    ["Esse é o Azul Profundo. 512GB Novo tá disponível na nossa loja de [stock_city]. Vou já simular o valor pra você no cartão.",
     "Esse é o Azul Profundo, disponível na nossa loja de [stock_city]. Vou já simular o valor pra você no cartão."],
    ["Esse é o Azul Profundo. 512GB Novo tá disponível na nossa loja de Sobral. Vou simular no cartão pra você.",
     "Esse é o Azul Profundo, disponível na nossa loja de Sobral. Vou simular no cartão pra você."],
  ];
  for (const [a, b] of pairs) sm = sm.split(a).join(b);
  // regra explícita no CASO A
  const anchor = "CASO A (match exato — color_status = \"exact\"):\nApresente direto, sem mencionar outras opções.";
  const rule = "\nNÃO repita o modelo/capacidade já escolhidos — cite só o que é novo: que está disponível e a loja/cidade (no fuzzy, também a cor real).";
  if (sm.includes(anchor) && !sm.includes("NÃO repita o modelo/capacidade já escolhidos — cite só o que é novo")) {
    sm = sm.replace(anchor, anchor + rule);
  }
  b2.parameters.options.systemMessage = sm;
  return wf;
}

// ── (A) entrega da simulação no MESMO turno: ao achar disponibilidade com o cliente
// pronto, a Bia 2 emite rerun_simulation:true e o loop existente (Code Parse
// Re-simulacao → Montar Body → Simulador → Parse Simulator → Bia 2) entrega o
// resultado sem o cliente precisar mandar outra mensagem. ──
export const ONE_TURN_SIM = `ENTREGA EM UM ÚNICO TURNO (OBRIGATÓRIO): quando a disponibilidade já foi encontrada (o aparelho está em estoque) e o cliente já está pronto pra simular (entrada já resolvida), NÃO pare em "vou simular". Na MESMA resposta, inclua "rerun_simulation": true para o sistema rodar o simulador e você já entregar o resultado — o cliente NÃO deve precisar mandar outra mensagem.
✅ {"message": "Boa, esse tá disponível. Vou simular no cartão e já te mostro.", "transfer": false, "rerun_simulation": true}
Quando o resultado da simulação chegar (simulation_result preenchido), apresente o valor normalmente, SEM "rerun_simulation" (senão entra em loop).`;

export function oneTurnSim(wf) {
  const b2 = node(wf, "Bia 2 ESTOQUE");
  let sm = b2.parameters.options.systemMessage;
  const anchor = "# ESTÁGIO 2 — AVANÇO PARA SIMULAÇÃO (NUNCA PERGUNTE BANDEIRA)";
  if (sm.includes(anchor) && !sm.includes("ENTREGA EM UM ÚNICO TURNO")) {
    sm = sm.replace(anchor, anchor + "\n\n" + ONE_TURN_SIM);
  }
  b2.parameters.options.systemMessage = sm;
  return wf;
}

// ── (A) o caminho de envio (Loop Over Items / SplitInBatches) é single-use por
// execução: numa mesma execução só consegue mandar UMA mensagem ao WhatsApp. Quando
// a Bia 2 emite rerun_simulation:true, a 1ª mensagem é só o gatilho do loop — o
// resultado (2ª passada, sem rerun) é o que deve ir ao cliente. Suprimimos o envio
// da mensagem-gatilho no parser de envio para que só o resultado seja enviado.
// (Conserta também a re-simulação normal, que tinha o mesmo defeito.) ──
export function suppressRerunSend(wf) {
  const n = node(wf, "Code Parse Bia 2 SEM ESTOQUE");
  let js = n.parameters.jsCode;
  if (!js.includes("rerun_simulation === true")) {
    js = replaceOnce(js,
      "  const router = JSON.parse(raw);\n",
      "  const router = JSON.parse(raw);\n" +
      "  // mensagem-gatilho do loop de re-simulação não é enviada (o envio é single-use\n" +
      "  // por execução); o resultado vem na 2ª passada da Bia 2, sem rerun_simulation.\n" +
      "  if (router && router.rerun_simulation === true) { return []; }\n");
    n.parameters.jsCode = js;
  }
  return wf;
}

// ── (A) multi-cotação (cliente pede 2 modelos): o fluxo ficava preso em
// bia1_pre_inventory porque isIphonePurchaseFlow exige interest_type (nulo quando a
// info vai para desired_devices) e a pergunta de entrada-antes-de-simular era gateada
// só por eligibleForInventory (single-device). Dois ajustes mínimos no Code Routing
// Flags, sem remover condições existentes. ──
export function fixMultiQuoteRouting(wf) {
  const rf = node(wf, "Code Routing Flags");
  let js = rf.parameters.jsCode;
  // 1) isIphonePurchaseFlow reconhece a multi-cotação (2 desired_devices válidos)
  const oldFn = `function isIphonePurchaseFlow(m) {
  return ["aparelho_iphone", "aparelho_outro"].includes(m.intent) &&
    ["comprar", "trocar"].includes(m.interest_type);
}`;
  const newFn = `function isIphonePurchaseFlow(m) {
  const deviceIntent = ["aparelho_iphone", "aparelho_outro"].includes(m.intent);
  const buyInterest = ["comprar", "trocar"].includes(m.interest_type);
  // multi-cotação: pedir 2 modelos é intenção de compra mesmo sem interest_type
  // explícito (a info do cliente foi para desired_devices, não para os campos single).
  const multiDevices = Array.isArray(m.desired_devices) &&
    m.desired_devices.filter((d) => d && (d.desired_model || d.model) && (d.desired_capacity || d.capacity)).length > 1;
  return deviceIntent && (buyInterest || multiDevices);
}`;
  if (js.includes(oldFn)) js = replaceOnce(js, oldFn, newFn);
  // 2) a pergunta de entrada-antes-de-simular também vale para a multi-cotação
  const oldGate = `  cashEntryResolved !== true &&
  eligibleForInventory === true
);`;
  const newGate = `  cashEntryResolved !== true &&
  (eligibleForInventory === true || (repasseV2MultiQuoteReady === true && repasseV2TradeinReadyForSimulation === true))
);`;
  if (js.includes(oldGate)) js = replaceOnce(js, oldGate, newGate);
  rf.parameters.jsCode = js;
  return wf;
}

export function transformPhase(wf, phase) {
  const order = ["A", "B1", "B2", "B3", "B4", "B5"];
  const upto = phase === "B" ? order : order.slice(0, order.indexOf(phase) + 1);
  for (const p of upto) {
    if (p === "A") { removeCardBrandGates(wf); removeCardBrandPrompts(wf); refineSimVoice(wf); refineAvailabilityVoice(wf); oneTurnSim(wf); suppressRerunSend(wf); fixMultiQuoteRouting(wf); }
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
