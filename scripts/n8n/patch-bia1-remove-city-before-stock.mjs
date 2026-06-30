// Completa o D1 na Bia 1: o patch anterior trocou só UMA linha, mas restou a
// seção "REGRA DE CIDADE ANTES DO ESTOQUE" mandando perguntar a cidade ANTES do
// estoque — instrução contraditória que o LLM seguiu (exec 414198 perguntou
// "Fortaleza ou Sobral?" prematuramente). Substitui a seção pela regra pós-sim.
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. DRY=1 lê o snapshot local, não faz PUT.
import * as kit from "./tool/patch-kit.mjs";

// Bia 1 e Bia 2 ESTOQUE têm o MESMO bloco premature de cidade.
const NODES = ['Bia 1', 'Bia 2 ESTOQUE'];

const OLD = `REGRA DE CIDADE ANTES DO ESTOQUE

So pergunte se o cliente ainda nao mencionou cidade util na mensagem atual ou no estado salvo.
Se a mensagem atual ou o estado salvo indicar Fortaleza, Sobral ou regiao mapeavel para uma delas, use essa cidade operacional e nao pergunte de novo.
Se preferred_city estiver ausente ou "não definida", NAO confirme disponibilidade, endereco, PIX, reserva ou retirada.
Antes disso, pergunte em uma frase curta: "Voce prefere retirar em Fortaleza ou Sobral?"
So fale "esta disponivel", "tem em estoque", endereco de loja ou PIX depois que a cidade de retirada estiver definida.`;

const NEW = `REGRA DE CIDADE (SO APOS A SIMULACAO)

NUNCA pergunte a cidade de retirada nesta fase de coleta/consulta. O estoque e consolidado nas duas lojas (Fortaleza e Sobral): busque e simule SEM exigir cidade. So pergunte "Voce prefere retirar em Fortaleza ou Sobral?" DEPOIS que o cliente aceitar a simulacao (routing_decision = "ask_pickup_city_after_sim"). Se o cliente mencionar a cidade espontaneamente, apenas registre e siga; nao confirme disponibilidade, endereco, PIX ou reserva antes da simulacao.`;

const workflow = await kit.loadWorkflow();
const result = {};
for (const NODE of NODES) {
  const node = workflow.nodes.find((n) => n.name === NODE);
  if (!node) throw new Error(`Node not found: ${NODE}`);
  let sys = node.parameters?.options?.systemMessage;
  if (typeof sys !== 'string') throw new Error(`${NODE} has no systemMessage`);
  if (sys.includes('REGRA DE CIDADE (SO APOS A SIMULACAO)')) {
    result[NODE] = { already: true };
  } else {
    sys = kit.replaceOnce(sys, OLD, NEW, `${NODE} city-before-stock`);
    node.parameters.options.systemMessage = sys;
    result[NODE] = { already: false };
  }
}

if (kit.DRY) {
  console.log(JSON.stringify({ dry: true, result }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "bia-remove-city-before-stock");
const { activeAfter, finalActive } = await kit.safePut(workflow, "bia-remove-city-before-stock");
console.log(JSON.stringify({ patched: true, nodes: NODES, result, activeAfter, finalActive }, null, 2));
