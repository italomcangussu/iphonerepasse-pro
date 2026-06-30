// Surgical patch — "Edit Fields5" (Set node, workflow AO VIVO Cr4fPWe0prwS6XjI).
//
// Edit Fields5 mantém apenas os 87 campos atribuídos (sem includeOtherFields), e
// não havia atribuição para cash_entry_* -> os campos que o Memory 2 reconciler
// emite (cash_entry_asked/intent/amount) eram descartados antes do Code Routing
// Flags e do POST Lead_State. Adiciona as 3 atribuições lendo de $json (saída do
// Code in JavaScript2, que achata o memory reconciliado na raiz).
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. DRY=1 lê o snapshot local, não faz PUT.
import { randomUUID } from "node:crypto";
import * as kit from "./tool/patch-kit.mjs";

const NODE_NAME = "Edit Fields5";

const NEW_FIELDS = [
  { name: "cash_entry_asked", value: "={{ $json.cash_entry_asked }}", type: "boolean" },
  { name: "cash_entry_intent", value: "={{ $json.cash_entry_intent }}", type: "boolean" },
  { name: "cash_entry_amount", value: "={{ $json.cash_entry_amount }}", type: "number" },
];

const workflow = await kit.loadWorkflow();
const wasActive = workflow.active;
const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`${NODE_NAME} not found`);
const assigns = node.parameters?.assignments?.assignments;
if (!Array.isArray(assigns)) throw new Error("Edit Fields5 assignments not found");

let added = 0;
for (const f of NEW_FIELDS) {
  if (assigns.some((a) => a.name === f.name)) continue;
  assigns.push({ id: randomUUID(), name: f.name, value: f.value, type: f.type });
  added += 1;
}
console.log(`  ${added} campo(s) adicionado(s); total agora ${assigns.length}`);
for (const f of NEW_FIELDS) {
  if (!assigns.some((a) => a.name === f.name)) throw new Error(`sanity falhou: ${f.name}`);
}

if (kit.DRY) {
  console.log(JSON.stringify({ dry: true, total: assigns.length }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "ef5-cashentry");
const { verify, activeAfter, finalActive } = await kit.safePut(workflow, "ef5-cashentry");
const v = verify.nodes.find((n) => n.name === NODE_NAME);
const vAssigns = v.parameters.assignments.assignments;
console.log(JSON.stringify({ wasActive, activeAfter, finalActive, total: vAssigns.length, applied: NEW_FIELDS.every((f) => vAssigns.some((a) => a.name === f.name)) }, null, 2));
