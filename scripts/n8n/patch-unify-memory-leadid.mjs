// Surgical patch — unifica a FONTE do lead_id no sessionKey dos 2 memory nodes
// restantes, no workflow AO VIVO (Cr4fPWe0prwS6XjI).
//
// Por quê (patch 2 da auditoria de memória):
//  - "Postgres Chat Memory1" (Bia 1) resolvia base de
//    $('CRM Leads GET').last()…conversations[0].lead_id
//  - "Postgres Chat Memory"  (Bia 2 ESTOQUE) resolvia base de $json.lead_id
//  Fontes diferentes ⇒ se divergirem, as duas Bias escrevem em threads distintas
//  apesar do mesmo prefixo '' → quebra de continuidade silenciosa.
//
//  Canonizamos ambas em $('Load Buffer Final').item.json.lead_id — o Set node
//  cuja única função relevante é carregar lead_id (= Formatar Payload CRM2),
//  ancestral comum de Bia 1 e Bia 2, e referência já comprovada nesse contexto
//  (era a fonte dos memory nodes Memory3/4 removidos no patch 1). Prefixo,
//  fallback e sufixo :scenario_id permanecem iguais; as duas expressões ficam
//  byte-idênticas ⇒ mesma thread garantida.
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. DRY=1 lê o snapshot local e grava /tmp/repasse-unify-leadid-dry.json sem PUT.
import fs from "node:fs";
import * as kit from "./tool/patch-kit.mjs";

const BIA1_MEM = "Postgres Chat Memory1"; // → Bia 1
const BIA2_MEM = "Postgres Chat Memory";  // → Bia 2 ESTOQUE

// Expressão canônica (base unificada). Mantém prefixo '' e a mesma cadeia.
const CANONICAL_KEY = `={{ (() => {
  const meta = $('Webhook').last().json.body?.meta ?? {};
  const base = $('Load Buffer Final').item.json.lead_id;
  const session = '' + String(base || $('Webhook').last().json.body?.lead_detail?.id || $('Webhook').last().json.body?.lead_id || 'unknown');
  return meta.source === 'repasse_v2_scenario_audit' && meta.scenario_id
    ? session + ':' + String(meta.scenario_id)
    : session;
})() }}`;

const workflow = await kit.loadWorkflow();
const wasActive = workflow.active;

const mem1 = workflow.nodes.find((n) => n.name === BIA1_MEM);
const mem2 = workflow.nodes.find((n) => n.name === BIA2_MEM);
if (!mem1) throw new Error(`${BIA1_MEM} não encontrado`);
if (!mem2) throw new Error(`${BIA2_MEM} não encontrado`);
if (!workflow.nodes.some((n) => n.name === "Load Buffer Final")) throw new Error("Load Buffer Final não encontrado");

// pré-condições: confirma as fontes ANTIGAS antes de trocar
const k1 = mem1.parameters?.sessionKey ?? "";
const k2 = mem2.parameters?.sessionKey ?? "";
if (!k1.includes("$('CRM Leads GET').last().json.data?.conversations?.[0]?.lead_id")) {
  throw new Error(`${BIA1_MEM}: sessionKey não tem a fonte CRM Leads GET esperada (já alterado?)`);
}
if (!k2.includes("const base = $json.lead_id;")) {
  throw new Error(`${BIA2_MEM}: sessionKey não tem a fonte $json.lead_id esperada (já alterado?)`);
}
// confirma que cada memory ainda alimenta o agente certo
const memTarget = (name) => (workflow.connections[name]?.ai_memory ?? []).flat().map((e) => e.node);
if (!memTarget(BIA1_MEM).includes("Bia 1")) throw new Error(`${BIA1_MEM} não alimenta Bia 1`);
if (!memTarget(BIA2_MEM).includes("Bia 2 ESTOQUE")) throw new Error(`${BIA2_MEM} não alimenta Bia 2 ESTOQUE`);

// mutação
mem1.parameters.sessionKey = CANONICAL_KEY;
mem2.parameters.sessionKey = CANONICAL_KEY;

// pós-condições
if (mem1.parameters.sessionKey !== mem2.parameters.sessionKey) {
  throw new Error("sessionKeys não ficaram idênticos");
}
if (!mem1.parameters.sessionKey.includes("$('Load Buffer Final').item.json.lead_id")) {
  throw new Error("sessionKey canônico não referencia Load Buffer Final");
}

if (kit.DRY) {
  fs.writeFileSync("/tmp/repasse-unify-leadid-dry.json", JSON.stringify(workflow, null, 2));
  console.log(JSON.stringify({ dry: true, wrote: "/tmp/repasse-unify-leadid-dry.json", identical: true }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "unify-memory-leadid");
const { verify, activeAfter, finalActive } = await kit.safePut(workflow, "unify-memory-leadid");
const v1 = verify.nodes.find((n) => n.name === BIA1_MEM)?.parameters?.sessionKey ?? "";
const v2 = verify.nodes.find((n) => n.name === BIA2_MEM)?.parameters?.sessionKey ?? "";
console.log(JSON.stringify({
  workflowId: verify.id,
  wasActive,
  activeAfter,
  finalActive,
  sessionKeysIdentical: v1 === v2,
  referencesLoadBufferFinal: v1.includes("$('Load Buffer Final').item.json.lead_id"),
}, null, 2));
