// Surgical patch — "Node13-Code Filtrar Resultados Estoque" (workflow AO VIVO
// Cr4fPWe0prwS6XjI).
//
// Bug observado na execução 406072: o cliente pediu iPhone 16 Pro Max mas o
// best_item escolhido foi iPhone 17 Branco (Novo, score 45) em vez do 16 Pro Max
// Titânio Preto (Seminovo, score 30). Causa: o "Code Refresh Lead State Before
// Switch2" emite os campos de desejo (desired_model/capacity/color/condition,
// preferred_city, desired_devices) na RAIZ do json; o sub-objeto ctx.memory só
// carrega stock_*. O Node13 faz `const memory = ctx.memory ?? {}` e lê
// memory.desired_model -> vazio -> modelMatch retorna "not_requested" -> nenhum
// filtro por modelo -> best_item cai no item de maior score (Novo).
//
// Fix: backfill dos campos de comércio em `memory` a partir da raiz do ctx, para
// que TODAS as leituras memory.desired_* / memory.preferred_city /
// memory.desired_devices passem a enxergar o que o cliente pediu. O fallback de
// condição já existente (conditionPool = capacityPool quando não há item na
// condição pedida) mantém o 16 Pro Max Seminovo mesmo com desired_condition=Novo.
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. DRY=1 lê o snapshot local e grava /tmp/repasse-node13-backfill-dry.json sem PUT.
import fs from "node:fs";
import * as kit from "./tool/patch-kit.mjs";

const NODE_NAME = "Node13-Code Filtrar Resultados Estoque";

const NEEDLE = `const ctx = $('Code Refresh Lead State Before Switch2').last().json;
const memory = ctx.memory ?? {};`;

const REPLACEMENT = `const ctx = $('Code Refresh Lead State Before Switch2').last().json;
// REPASSE NODE13 COMMERCE BACKFILL: o "Code Refresh Lead State Before Switch2"
// emite os campos de desejo/contexto na RAIZ; o sub-objeto ctx.memory só traz
// stock_*. Sem backfill, desired_model fica vazio -> modelMatch="not_requested"
// -> best_item ignora o modelo pedido e cai no item de maior score (Novo).
const __rawMemory = ctx.memory ?? {};
const memory = {
  ...__rawMemory,
  desired_model: __rawMemory.desired_model ?? ctx.desired_model ?? null,
  desired_capacity: __rawMemory.desired_capacity ?? ctx.desired_capacity ?? null,
  desired_color: __rawMemory.desired_color ?? ctx.desired_color ?? null,
  desired_condition: __rawMemory.desired_condition ?? ctx.desired_condition ?? null,
  desired_devices: __rawMemory.desired_devices ?? ctx.desired_devices ?? null,
  preferred_city: __rawMemory.preferred_city ?? ctx.preferred_city ?? null,
};`;

const workflow = await kit.loadWorkflow();
const wasActive = workflow.active;
const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`${NODE_NAME} not found`);
let code = node.parameters.jsCode;
if (code.includes("REPASSE NODE13 COMMERCE BACKFILL")) {
  console.log("  skip [já aplicado]");
} else {
  if (code.split(NEEDLE).length - 1 !== 1) throw new Error("needle não-único");
  code = code.replace(NEEDLE, REPLACEMENT);
  node.parameters.jsCode = code;
  console.log("  ok [commerce backfill]");
}
new Function("$input", "$", "DateTime", "$helpers", "$jmespath", node.parameters.jsCode);
for (const m of ["REPASSE NODE13 COMMERCE BACKFILL", "ctx.desired_model", "preferred_city: __rawMemory.preferred_city"]) {
  if (!node.parameters.jsCode.includes(m)) throw new Error(`sanity falhou: ${m}`);
}

if (kit.DRY) {
  fs.writeFileSync("/tmp/repasse-node13-backfill-dry.json", JSON.stringify(workflow, null, 2));
  console.log(JSON.stringify({ dry: true }, null, 2));
  process.exit(0);
}
kit.backup(await kit.getLive(), "node13-backfill");
const { verify, activeAfter, finalActive } = await kit.safePut(workflow, "node13-backfill");
const v = verify.nodes.find((n) => n.name === NODE_NAME);
console.log(JSON.stringify({ wasActive, activeAfter, finalActive, applied: v.parameters.jsCode.includes("REPASSE NODE13 COMMERCE BACKFILL") }, null, 2));
