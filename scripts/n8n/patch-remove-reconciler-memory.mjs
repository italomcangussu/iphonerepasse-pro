// Surgical patch — remove a memória de chat do "Memory 2 - Reconciler" e apaga
// o nó de memória órfão, no workflow AO VIVO (Cr4fPWe0prwS6XjI).
//
// Por quê (patch 1 da auditoria de memória):
//  - "Postgres Chat Memory3" (prefixo 'm', window 1) alimentava ai_memory do
//    "Memory 2 - Reconciler". O Reconciler é agente de SAÍDA ESTRUTURADA e dono
//    do lead_state — ele já recebe o estado anterior (`prev`) e a última mensagem
//    no prompt. A janela de chat é redundante e adiciona entrada não-determinística
//    numa peça que é fonte recorrente de corrupção de lead_state. Removemos.
//  - "Postgres Chat Memory4" (prefixo '2m', window 1) é nó MORTO: ai_memory já era
//    [[]] (desconectado; era a antiga thread do Memory 1 - Extractor). Removemos.
//
// Direção das conexões langchain: o nó de memória é a FONTE (key em connections)
// e o agente é o alvo (type ai_memory). Logo, basta remover os nós + as chaves de
// conexão homônimas. Nenhum nó referencia esses dois como ALVO.
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. NOTA: estes nós já foram removidos do vivo; patch histórico —
// hoje aborta na pré-condição "não encontrado" (preservado). DRY=1 grava
// /tmp/repasse-remove-mem-dry.json sem PUT.
import fs from "node:fs";
import * as kit from "./tool/patch-kit.mjs";

const REMOVE = ["Postgres Chat Memory3", "Postgres Chat Memory4"];
const RECONCILER = "Memory 2 - Reconciler";

const workflow = await kit.loadWorkflow();
const wasActive = workflow.active;
const nodeCountBefore = workflow.nodes.length;

// --- pré-condições ---
const mem3 = workflow.nodes.find((n) => n.name === "Postgres Chat Memory3");
const mem4 = workflow.nodes.find((n) => n.name === "Postgres Chat Memory4");
if (!mem3) throw new Error("Postgres Chat Memory3 não encontrado (workflow mudou?)");
if (!mem4) throw new Error("Postgres Chat Memory4 não encontrado (workflow mudou?)");
if (!workflow.nodes.some((n) => n.name === RECONCILER)) throw new Error(`${RECONCILER} não encontrado`);

const mem3Targets = (workflow.connections["Postgres Chat Memory3"]?.ai_memory ?? [])
  .flat().map((e) => e.node);
const mem4Targets = (workflow.connections["Postgres Chat Memory4"]?.ai_memory ?? [])
  .flat().map((e) => e.node);
if (!mem3Targets.includes(RECONCILER)) {
  throw new Error(`Esperava Memory3 → ${RECONCILER}, achei: ${JSON.stringify(mem3Targets)}`);
}
if (mem4Targets.length !== 0) {
  throw new Error(`Esperava Memory4 órfão (sem alvos), achei: ${JSON.stringify(mem4Targets)}`);
}

// --- mutação ---
// 1) remover os nós
workflow.nodes = workflow.nodes.filter((n) => !REMOVE.includes(n.name));
// 2) remover as chaves de conexão (fontes) homônimas
for (const name of REMOVE) delete workflow.connections[name];
// 3) defensivo: remover qualquer aresta que aponte para os nós removidos (não deve haver)
let strayEdges = 0;
for (const src of Object.keys(workflow.connections)) {
  const conn = workflow.connections[src];
  for (const type of Object.keys(conn)) {
    conn[type] = conn[type].map((branch) =>
      (branch || []).filter((edge) => {
        if (REMOVE.includes(edge.node)) { strayEdges++; return false; }
        return true;
      })
    );
  }
}

// --- pós-condições ---
if (workflow.nodes.length !== nodeCountBefore - 2) {
  throw new Error(`Esperava remover 2 nós (${nodeCountBefore}→${nodeCountBefore - 2}), ficou ${workflow.nodes.length}`);
}
for (const name of REMOVE) {
  if (workflow.nodes.some((n) => n.name === name)) throw new Error(`${name} ainda presente nos nós`);
  if (workflow.connections[name]) throw new Error(`${name} ainda presente em connections`);
}
// Reconciler não pode mais ter nenhuma ai_memory apontando para ele
const reconcilerStillFed = Object.values(workflow.connections).some((conn) =>
  (conn.ai_memory ?? []).flat().some((e) => e.node === RECONCILER)
);
if (reconcilerStillFed) throw new Error(`${RECONCILER} ainda recebe ai_memory de algum nó`);

if (kit.DRY) {
  fs.writeFileSync("/tmp/repasse-remove-mem-dry.json", JSON.stringify(workflow, null, 2));
  console.log(JSON.stringify({
    dry: true, wrote: "/tmp/repasse-remove-mem-dry.json",
    nodeCountBefore, nodeCountAfter: workflow.nodes.length, strayEdges,
    removed: REMOVE,
  }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "remove-reconciler-memory");
const { verify, activeAfter, finalActive } = await kit.safePut(workflow, "remove-reconciler-memory");
const stillThere = REMOVE.filter((name) => verify.nodes.some((n) => n.name === name));
const reconcilerFedAfter = Object.values(verify.connections).some((conn) =>
  (conn.ai_memory ?? []).flat().some((e) => e.node === RECONCILER)
);
console.log(JSON.stringify({
  workflowId: verify.id,
  wasActive,
  activeAfter,
  finalActive,
  nodeCountBefore,
  nodeCountAfter: verify.nodes.length,
  strayEdgesRemoved: strayEdges,
  removedNodesStillPresent: stillThere,
  reconcilerStillFedByMemory: reconcilerFedAfter,
}, null, 2));
