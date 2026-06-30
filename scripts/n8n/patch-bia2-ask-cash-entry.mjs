// Surgical patch — "Bia 2 SEM ESTOQUE " prompt (workflow AO VIVO Cr4fPWe0prwS6XjI).
//
// Adiciona a REGRA DE ENTRADA ANTES DE SIMULAR: quando o roteamento marca
// next_best_action "perguntar se deseja simular com algum valor de entrada
// (dinheiro/pix) antes de simular" (routing_decision ask_cash_entry_before_sim),
// a Bia deve perguntar se o cliente quer dar entrada e financiar o resto no
// cartão, antes de rodar a simulação. DRY=1 não faz PUT.
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5 — I/O único, sem o literal
// do snapshot legado). NOTA: o nó "Bia 2 SEM ESTOQUE " foi fundido em 2026-06-18;
// este patch é histórico e hoje aborta em "node not found" (preservado).
import * as kit from "./tool/patch-kit.mjs";

const NODE_NAME = "Bia 2 SEM ESTOQUE ";

const ANCHOR = "Se o cliente mencionar cidade sem loja e pedir entrega/logistica, diga que o padrao e retirada em loja e transfira para especialista se ele precisar de uma condicao especial.";
const BLOCK = ANCHOR + "\n\nREGRA DE ENTRADA ANTES DE SIMULAR\n"
  + "Quando next_best_action pedir para perguntar sobre entrada (routing_decision \"ask_cash_entry_before_sim\"), ANTES de simular as parcelas pergunte se o cliente deseja dar algum valor de entrada (dinheiro/Pix) e financiar o restante no cartao. "
  + "Exemplo: \"Antes de simular: voce quer dar algum valor de entrada no Pix/dinheiro e parcelar o restante no cartao, ou prefere tudo no cartao?\" "
  + "Nao invente valor de parcela aqui; apenas faca a pergunta. Se o cliente ja tiver dito que quer (ou nao) dar entrada, NAO pergunte de novo e siga para a simulacao.";

const workflow = await kit.loadWorkflow();
const wasActive = workflow.active;
const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`${NODE_NAME} not found`);
node.parameters.options = node.parameters.options ?? {};
let text = node.parameters.options.systemMessage;
if (typeof text !== "string") throw new Error("Bia 2 options.systemMessage not a string");

if (text.includes("REGRA DE ENTRADA ANTES DE SIMULAR")) {
  console.log("  skip [já aplicado]");
} else {
  text = kit.replaceOnce(text, ANCHOR, BLOCK, "regra de entrada");
  node.parameters.options.systemMessage = text;
  console.log("  ok [regra de entrada]");
}
if (!node.parameters.options.systemMessage.includes("REGRA DE ENTRADA ANTES DE SIMULAR")) throw new Error("sanity falhou");

if (kit.DRY) {
  console.log(JSON.stringify({ dry: true, len: node.parameters.options.systemMessage.length }, null, 2));
  process.exit(0);
}
kit.backup(await kit.getLive(), "bia2-cashentry");
const { verify, activeAfter, finalActive } = await kit.safePut(workflow, "bia2-cashentry");
const v = verify.nodes.find((n) => n.name === NODE_NAME);
console.log(JSON.stringify({ wasActive, activeAfter, finalActive, applied: v.parameters.options.systemMessage.includes("REGRA DE ENTRADA ANTES DE SIMULAR") }, null, 2));
