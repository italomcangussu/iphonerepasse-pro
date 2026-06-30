// Surgical patch — torna o latch tradein_asked DETERMINISTICO no Code Parse
// Memory 2 do workflow AO VIVO (Cr4fPWe0prwS6XjI).
//
// Problema (smoke 2026-06-21): ao RECUSAR a troca ("nao, sem troca"), has_tradein
// fica false e nao ha tradein_model — igual ao default — entao nenhum sinal
// "presente" deriva tradein_asked=true, e o flash-lite (Memory 2) nao setou. O
// gate reperguntava a cada turno. Diferente do cash_entry, recusar trade-in nao
// deixa um intent=false como marca.
//
// Fix: (1) ampliar __classifyBiaQuestion para reconhecer as frases reais que a Bia
// usa para perguntar o aparelho de entrada/troca ("dar algum iPhone como parte do
// pagamento", "de entrada", "na troca", ...); (2) quando a ULTIMA mensagem do bot
// foi essa pergunta (__askedViaReply || __askedViaLastMsg), marcar
// memory.tradein_asked = true — a pergunta foi feita, independente da resposta.
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 1). DRY=1 lê o snapshot local
// e grava /tmp/repasse-tradein-detect-dry.json sem PUT.
import * as kit from "./tool/patch-kit.mjs";

const NODE = "Code Parse Memory 2";

const REGEX_OLD = `  if (/aparelho que voce tem|aparelho atual|que voce tem (agora|hoje)|seu aparelho|aparelho de entrada|dar como entrada|dar de entrada|dar de entr|pra dar de entrada/.test(t)) return 'tradein_model';`;
const REGEX_NEW = `  if (/aparelho que voce tem|aparelho atual|que voce tem (agora|hoje)|seu aparelho|aparelho de entrada|dar como entrada|dar de entrada|dar de entr|pra dar de entrada|de entrada|parte do pagamento|dar (algum|um|seu) (iphone|aparelho|celular)|na troca|de troca|pra troca|para troca|dar na troca/.test(t)) return 'tradein_model';`;

const SETTER_ANCHOR = `const __askedViaLastMsg = __classifyBiaQuestion(__lastBotMsg) === 'tradein_model';`;
const SETTER_NEW = SETTER_ANCHOR + `
// tradein_asked deterministico (2026-06-21): se a ULTIMA mensagem do bot perguntou
// o aparelho atual/de entrada/troca, a pergunta FOI feita — marque asked=true mesmo
// que o cliente recuse (has_tradein=false, sem model), pois a recusa nao deixa
// sinal "presente" como o cash_entry_intent=false.
if (__askedViaReply || __askedViaLastMsg) {
  memory.tradein_asked = true;
}`;

const workflow = await kit.loadWorkflow();
const wasActive = workflow.active;
const node = workflow.nodes.find((n) => n.name === NODE);
if (!node) throw new Error(`${NODE} não encontrado`);
let code = node.parameters.jsCode;

if (code.includes("parte do pagamento") && code.includes("if (__askedViaReply || __askedViaLastMsg) {")) {
  console.log(JSON.stringify({ noop: true }, null, 2));
  process.exit(0);
}
code = kit.replaceOnce(code, REGEX_OLD, REGEX_NEW, "regex");
code = kit.replaceOnce(code, SETTER_ANCHOR, SETTER_NEW, "setter");
kit.assertSyntax(code, NODE);
node.parameters.jsCode = code;

if (kit.DRY) {
  console.log(JSON.stringify({ ...kit.dry(workflow, "/tmp/repasse-tradein-detect-dry.json"), applied: true }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "tradein-asked-detect");
const { verify, activeAfter, finalActive } = await kit.safePut(workflow, "tradein-asked-detect");
const vCode = verify.nodes.find((n) => n.name === NODE)?.parameters?.jsCode ?? "";
console.log(JSON.stringify({
  wasActive, activeAfter, finalActive,
  detectLive: vCode.includes("if (__askedViaReply || __askedViaLastMsg) {") && vCode.includes("parte do pagamento"),
}, null, 2));
