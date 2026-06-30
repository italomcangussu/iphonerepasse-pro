// Surgical patch — insere o node determinístico "Code Routing Flags" entre
// `Edit Fields5` e `Switch3` no workflow AO VIVO (Cr4fPWe0prwS6XjI).
//
// Por quê (passo 1+2 do plano): a deleção manual do `Parse Memory` removeu quem
// computava as flags de roteamento; o `Switch3` lê essas flags de $json e NÃO
// tem fallbackOutput, então com tudo null o item é descartado → bot mudo
// (confirmado na exec 405819: lastNodeExecuted=Edit Fields5, nenhuma Bia/envio).
// Este node restaura a árvore de decisão determinística SEM reconciliar
// lead_state (Memory 2 é o dono). Código-fonte: repasse-code-routing-flags.js.
//
// Rewire: Edit Fields5.main[0] tinha [Switch3, update_funnel, Code in JavaScript,
// Code in JavaScript1]. Trocamos a aresta para Switch3 por "Code Routing Flags",
// e ligamos "Code Routing Flags" → Switch3. As outras 3 arestas ficam.
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. DRY=1 lê o snapshot local e grava /tmp/repasse-routing-node-dry.json sem PUT.
import fs from "node:fs";
import * as kit from "./tool/patch-kit.mjs";

const NODE_NAME = "Code Routing Flags";
const NODE_SRC = "scripts/n8n/repasse-code-routing-flags.js";

// código do node (sem o $ disponível, validação de sintaxe apenas)
const jsCode = fs.readFileSync(NODE_SRC, "utf8");
new Function("$input", "$", "DateTime", "$helpers", "$jmespath", jsCode); // syntax assert

const workflow = await kit.loadWorkflow();
const wasActive = workflow.active;

const ef5 = workflow.nodes.find((n) => n.name === "Edit Fields5");
if (!ef5) throw new Error("Edit Fields5 not found");
const sw3 = workflow.nodes.find((n) => n.name === "Switch3");
if (!sw3) throw new Error("Switch3 not found");

// 1) upsert do node
let node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (node) {
  console.log("  skip [node já existe] — atualizando jsCode");
  node.parameters.jsCode = jsCode;
} else {
  node = {
    parameters: { jsCode },
    id: "routing-flags-" + Math.random().toString(36).slice(2, 10),
    name: NODE_NAME,
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [ef5.position[0] + 192, ef5.position[1] - 160],
  };
  workflow.nodes.push(node);
  console.log("  ok [node adicionado]");
}

// 2) rewire: Edit Fields5 → (Switch3 vira Code Routing Flags); manter os outros 3
const ef5conn = workflow.connections["Edit Fields5"];
if (!ef5conn?.main?.[0]) throw new Error("Edit Fields5 sem conexão main[0]");
const edges = ef5conn.main[0];
const sw3Edge = edges.find((e) => e.node === "Switch3");
if (sw3Edge) {
  sw3Edge.node = NODE_NAME; // troca destino da aresta existente
  console.log("  ok [Edit Fields5 → Code Routing Flags]");
} else if (!edges.some((e) => e.node === NODE_NAME)) {
  edges.push({ node: NODE_NAME, type: "main", index: 0 });
  console.log("  ok [Edit Fields5 + Code Routing Flags (Switch3 já não estava)]");
} else {
  console.log("  skip [Edit Fields5 já aponta para Code Routing Flags]");
}

// 3) Code Routing Flags → Switch3
workflow.connections[NODE_NAME] = { main: [[{ node: "Switch3", type: "main", index: 0 }]] };
console.log("  ok [Code Routing Flags → Switch3]");

// 4) sanidade: nenhuma aresta órfã para Switch3 saindo direto do Edit Fields5
const stillDirect = (workflow.connections["Edit Fields5"].main[0] || []).some((e) => e.node === "Switch3");
if (stillDirect) throw new Error("Edit Fields5 ainda aponta direto para Switch3 (rewire falhou)");

if (kit.DRY) {
  fs.writeFileSync("/tmp/repasse-routing-node-dry.json", JSON.stringify(workflow, null, 2));
  console.log(JSON.stringify({ dry: true, wrote: "/tmp/repasse-routing-node-dry.json", nodeCount: workflow.nodes.length }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "routing-flags-node");
const { verify, activeAfter, finalActive } = await kit.safePut(workflow, "routing-flags-node");
const vNode = verify.nodes.find((n) => n.name === NODE_NAME);
const vEf5 = verify.connections["Edit Fields5"].main[0].map((e) => e.node);
const vRoute = verify.connections[NODE_NAME]?.main?.[0]?.map((e) => e.node);
console.log(JSON.stringify({
  workflowId: verify.id,
  wasActive,
  activeAfter,
  finalActive,
  nodeCount: verify.nodes.length,
  nodePresent: !!vNode,
  editFields5Targets: vEf5,
  routingFlagsTargets: vRoute,
}, null, 2));
