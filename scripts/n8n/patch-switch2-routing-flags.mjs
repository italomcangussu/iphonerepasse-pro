// Surgical patch — restaura o caminho de busca/simulação após o Switch3 no
// workflow AO VIVO (Cr4fPWe0prwS6XjI). Dois defeitos pós-deleção do Parse Memory:
//
// 1) "Code Refresh Lead State Before Switch2" espalha `...inputData`
//    ($('Edit Fields5'), que é ANTES do Code Routing Flags) e nunca define
//    shouldSearchInventory → o Switch2 out[1] (`$json.shouldSearchInventory ===
//    true`) nunca casa → a busca de estoque não roda → bot mudo no turno de
//    consulta. Fix: ler as flags do $('Code Routing Flags') e re-anexar
//    shouldSearchInventory + context_ready (e honrar shouldSimulateNow do CRF).
//
// 2) O Switch2 out[0] (simular) referencia $('Parse Memory') — node DELETADO —
//    o que dispara erro de expressão nos turnos de simulação. Fix: remover as
//    cláusulas `$('Parse Memory')...` (as variantes em $json/memory bastam).
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. DRY=1 lê o snapshot local e grava /tmp/repasse-switch2-dry.json sem PUT.
import fs from "node:fs";
import * as kit from "./tool/patch-kit.mjs";

function patchCodeRefresh(node) {
  let code = node.parameters.jsCode;
  if (code.includes("REPASSE SWITCH2 ROUTING FLAGS")) return "skip [já aplicado]";
  // 1) injeta a leitura das flags do Code Routing Flags
  const n1 = "const crmResponse = $input.first().json ?? {};";
  if (code.split(n1).length - 1 !== 1) throw new Error("Code Refresh: needle crmResponse não-único");
  code = code.replace(n1, n1 + "\n// REPASSE SWITCH2 ROUTING FLAGS: o Code Routing Flags (após Edit Fields5)\n// é o dono das flags transitórias; o spread de inputData não as traz.\nconst routingFlags = $('Code Routing Flags').last().json ?? {};");
  // 2) context_ready do CRF entra no recompute local de shouldSimulateNow
  const n2 = "  inputData.context_ready === true &&";
  if (code.split(n2).length - 1 !== 1) throw new Error("Code Refresh: needle context_ready não-único");
  code = code.replace(n2, "  (routingFlags.context_ready === true || inputData.context_ready === true) &&");
  // 3) honra shouldSimulateNow do CRF
  const n3 = "const shouldSimulateNow = inputData.shouldSimulateNow === true || inputData.memory?.shouldSimulateNow === true || (";
  if (code.split(n3).length - 1 !== 1) throw new Error("Code Refresh: needle shouldSimulateNow não-único");
  code = code.replace(n3, "const shouldSimulateNow = routingFlags.shouldSimulateNow === true || inputData.shouldSimulateNow === true || inputData.memory?.shouldSimulateNow === true || (");
  // 4) expõe shouldSearchInventory + context_ready no output (Switch2 lê de $json)
  const n4 = "    shouldSimulateNow,\n    memory: {";
  if (code.split(n4).length - 1 !== 1) throw new Error("Code Refresh: needle return/memory não-único");
  code = code.replace(n4, "    shouldSimulateNow,\n    shouldSearchInventory: routingFlags.shouldSearchInventory === true,\n    context_ready: (routingFlags.context_ready === true || inputData.context_ready === true),\n    next_best_action: routingFlags.next_best_action ?? inputData.next_best_action ?? nextBestAction,\n    memory: {");
  new Function("$input", "$", "DateTime", "$helpers", "$jmespath", code);
  node.parameters.jsCode = code;
  return "ok";
}

function patchSwitch2(node) {
  const vals = node.parameters?.rules?.values ?? [];
  let touched = 0;
  for (const v of vals) {
    for (const cond of v.conditions?.conditions ?? []) {
      if (typeof cond.leftValue === "string" && cond.leftValue.includes("$('Parse Memory')")) {
        const before = cond.leftValue;
        cond.leftValue = before.replace(/\s*\|\|\s*\$\('Parse Memory'\)\.last\(\)\.json\.[A-Za-z_]+ === [^|})]+/g, "");
        if (cond.leftValue.includes("$('Parse Memory')")) throw new Error("Switch2: ainda há ref a Parse Memory após replace");
        touched += 1;
      }
    }
  }
  return touched ? `ok [${touched} condição(ões)]` : "skip [sem Parse Memory]";
}

const workflow = await kit.loadWorkflow();
const wasActive = workflow.active;

const cr = workflow.nodes.find((n) => n.name === "Code Refresh Lead State Before Switch2");
if (!cr) throw new Error("Code Refresh Lead State Before Switch2 not found");
const sw2 = workflow.nodes.find((n) => n.name === "Switch2");
if (!sw2) throw new Error("Switch2 not found");

console.log("Code Refresh:", patchCodeRefresh(cr));
console.log("Switch2:", patchSwitch2(sw2));

if (kit.DRY) {
  fs.writeFileSync("/tmp/repasse-switch2-dry.json", JSON.stringify(workflow, null, 2));
  console.log(JSON.stringify({ dry: true, wrote: "/tmp/repasse-switch2-dry.json" }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "switch2-routing");
const { verify, activeAfter, finalActive } = await kit.safePut(workflow, "switch2-routing");
const vcr = verify.nodes.find((n) => n.name === "Code Refresh Lead State Before Switch2");
const vsw2 = verify.nodes.find((n) => n.name === "Switch2");
console.log(JSON.stringify({
  workflowId: verify.id, wasActive, activeAfter, finalActive,
  codeRefreshHasFlags: vcr?.parameters?.jsCode?.includes("REPASSE SWITCH2 ROUTING FLAGS") ?? false,
  switch2HasParseMemory: JSON.stringify(vsw2?.parameters ?? {}).includes("Parse Memory"),
}, null, 2));
