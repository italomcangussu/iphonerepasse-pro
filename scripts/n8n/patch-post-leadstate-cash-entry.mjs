// Surgical patch — "Code in JavaScript" (POST Lead_State payload builder, workflow
// AO VIVO Cr4fPWe0prwS6XjI). Lista de campos do state é explícita e não incluía
// cash_entry_* -> a entrada nunca chegava ao upsert. Adiciona:
//   cash_entry_asked  (latch: uma vez true, permanece)
//   cash_entry_intent (cf: carry-forward, false é valor válido)
//   cash_entry_amount (cf: carry-forward numérico)
// Usa os helpers cf/latch já existentes (fallback para prev), então persiste mesmo
// se Edit Fields5 não carregar o campo.
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. DRY=1 lê o snapshot local, não faz PUT.
import * as kit from "./tool/patch-kit.mjs";

const NODE_NAME = "Code in JavaScript";

const NEEDLE = "          card_brand: input.card_brand,\n";
const REPLACEMENT = "          card_brand: input.card_brand,\n"
  + "          cash_entry_asked: latch(input.cash_entry_asked, 'cash_entry_asked'),\n"
  + "          cash_entry_intent: cf(input.cash_entry_intent, 'cash_entry_intent'),\n"
  + "          cash_entry_amount: cf(input.cash_entry_amount, 'cash_entry_amount'),\n";

const workflow = await kit.loadWorkflow();
const wasActive = workflow.active;
const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`${NODE_NAME} not found`);
let code = node.parameters.jsCode;
if (code.includes("cash_entry_asked: latch(input.cash_entry_asked")) {
  console.log("  skip [já aplicado]");
} else {
  if (code.split(NEEDLE).length - 1 !== 1) throw new Error("needle card_brand não-único");
  code = code.replace(NEEDLE, REPLACEMENT);
  node.parameters.jsCode = code;
  console.log("  ok [cash_entry no POST Lead_State]");
}
new Function("$input", "$", "DateTime", "$helpers", "$jmespath", node.parameters.jsCode);
for (const m of ["cash_entry_asked: latch", "cash_entry_intent: cf", "cash_entry_amount: cf"]) {
  if (!node.parameters.jsCode.includes(m)) throw new Error(`sanity falhou: ${m}`);
}

if (kit.DRY) {
  console.log(JSON.stringify({ dry: true }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "post-leadstate-cashentry");
const { verify, activeAfter, finalActive } = await kit.safePut(workflow, "post-leadstate-cashentry");
const v = verify.nodes.find((n) => n.name === NODE_NAME);
console.log(JSON.stringify({ wasActive, activeAfter, finalActive, applied: v.parameters.jsCode.includes("cash_entry_asked: latch(input.cash_entry_asked") }, null, 2));
