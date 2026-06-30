// Surgical patch — corrige a PERSISTÊNCIA de cash_entry_asked no builder do POST
// ("Code in JavaScript") do workflow AO VIVO (Cr4fPWe0prwS6XjI).
//
// Causa-raiz (verificada por trace de execução):
//  Code in JavaScript2=true -> Edit Fields5=true -> Code in JavaScript (builder do
//  POST) grava cash_entry_asked=FALSE -> POST envia false -> DB fica false. A RPC
//  upsert_lead_state JÁ é latch one-way (cash_entry_asked = lead_state.X OR excluded),
//  então o problema NÃO é o DB: é que o `true` nunca chega a ser POSTado. No turno
//  do declínio o cliente respondeu (cash_entry_intent=false PRESENTE), mas o
//  latch(input.cash_entry_asked) não derivava disso e o asked não estabilizava ->
//  a IA re-pergunta a entrada a cada turno.
//
// Fix (regression-safe, alinhado à diretriz do dono): derivar cash_entry_asked
// também da PRESENÇA de intent/amount de entrada (sinais de Pix/dinheiro) — se há
// intenção/valor de entrada, a pergunta necessariamente foi feita. NUNCA referencia
// trade-in: "aparelho de entrada" é tradein_* e não toca cash_entry_asked.
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 1). DRY=1 lê o snapshot local
// e grava /tmp/repasse-cash-asked-dry.json sem PUT.
import * as kit from "./tool/patch-kit.mjs";

const NODE = "Code in JavaScript";

const OLD = "          cash_entry_asked: latch(input.cash_entry_asked, 'cash_entry_asked'),";
// Deriva de intent/amount (atual e prev). isPresent(false) === true (intent=false
// = cliente JÁ respondeu que não quer entrada -> pergunta foi feita).
const NEW = "          cash_entry_asked: latch(input.cash_entry_asked, 'cash_entry_asked') || isPresent(input.cash_entry_intent) || isPresent(prev?.cash_entry_intent) || isPresent(input.cash_entry_amount) || isPresent(prev?.cash_entry_amount),";

const workflow = await kit.loadWorkflow();
const wasActive = workflow.active;

const node = workflow.nodes.find((n) => n.name === NODE);
if (!node) throw new Error(`${NODE} não encontrado`);
const code = node.parameters?.jsCode ?? "";

if (code.includes("isPresent(input.cash_entry_intent)")) {
  console.log(JSON.stringify({ noop: true, reason: "derive já presente" }, null, 2));
  process.exit(0);
}
if (!code.includes(OLD)) throw new Error("linha cash_entry_asked antiga não encontrada (workflow mudou?)");
if ((code.split(OLD).length - 1) !== 1) throw new Error("linha antiga deveria aparecer 1x");
if (!code.includes("const isPresent =")) throw new Error("isPresent não definido no nó");
if (!code.includes("const latch =")) throw new Error("latch não definido no nó");

const next = code.replace(OLD, NEW);
kit.assertSyntax(next, NODE); // syntax-assert
node.parameters.jsCode = next;

if (kit.DRY) {
  kit.dry(workflow, "/tmp/repasse-cash-asked-dry.json");
  console.log(JSON.stringify({ dry: true, applied: true }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "cash-entry-asked-derive");
const { verify, activeAfter, finalActive } = await kit.safePut(workflow, "cash-entry-asked-derive");
const vCode = verify.nodes.find((n) => n.name === NODE)?.parameters?.jsCode ?? "";
console.log(JSON.stringify({
  workflowId: verify.id, wasActive, activeAfter, finalActive,
  deriveLive: vCode.includes("isPresent(input.cash_entry_intent)"),
}, null, 2));
