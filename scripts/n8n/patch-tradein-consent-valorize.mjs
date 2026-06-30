// Surgical patch — evolui a mensagem de CONSENTIMENTO da avaliação de trade-in
// no workflow AO VIVO (Cr4fPWe0prwS6XjI) para uma voz que VALORIZA o aparelho do
// cliente (sensação de que o iPhone novo sai mais barato por valorizarem tanto a
// entrada), de forma humana e não forçada.
//
// Três fontes da mesma mensagem (mantidas em sincronia de voz):
//  1) "Code Parse Bia 1" .jsCode — caminho DETERMINÍSTICO (é o que dispara hoje)
//  2) "Bia 1" .options.systemMessage — exemplo few-shot (JSON) do caminho LLM
//  3) "Bia 1" .options.systemMessage — instrução PASSO 1 (template [tradein_model])
//
// Idempotente: cada alvo é pulado se a string nova já estiver aplicada.
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. DRY=1 lê o snapshot local e grava /tmp/repasse-tradein-consent-dry.json sem PUT.
import fs from "node:fs";
import * as kit from "./tool/patch-kit.mjs";

// --- alvos exatos: {node, field-path, old, new} ---
const TARGETS = [
  {
    node: "Code Parse Bia 1",
    get: (n) => n.parameters.jsCode,
    set: (n, v) => { n.parameters.jsCode = v; },
    isCode: true,
    old: "Pra calcular o valor do seu ${state.tradein_model} como entrada, posso te mandar as perguntas rápidas de avaliação?",
    new: "Pra avaliar seu ${state.tradein_model} e garantir o melhor valor possível de entrada, posso te mandar umas perguntas rápidas?",
  },
  {
    node: "Bia 1",
    get: (n) => n.parameters.options.systemMessage,
    set: (n, v) => { n.parameters.options.systemMessage = v; },
    old: "Show! Pra eu avaliar seu iPhone 15 Pro Max e te passar o valor de entrada, consegue me responder algumas perguntas sobre ele?",
    new: "Show! Pra avaliar seu iPhone 15 Pro Max e garantir o melhor valor possível de entrada, consegue me responder algumas perguntas rápidas sobre ele?",
  },
  {
    node: "Bia 1",
    get: (n) => n.parameters.options.systemMessage,
    set: (n, v) => { n.parameters.options.systemMessage = v; },
    old: "Show! Pra eu avaliar seu [tradein_model] e te passar o valor de entrada, consegue me responder algumas perguntas sobre ele?",
    new: "Show! Pra avaliar seu [tradein_model] e garantir o melhor valor possível de entrada, consegue me responder algumas perguntas rápidas sobre ele?",
  },
];

const workflow = await kit.loadWorkflow();
const wasActive = workflow.active;

const applied = [];
const skipped = [];
for (const t of TARGETS) {
  const node = workflow.nodes.find((n) => n.name === t.node);
  if (!node) throw new Error(`${t.node} não encontrado`);
  const cur = t.get(node) ?? "";
  if (cur.includes(t.new) && !cur.includes(t.old)) { skipped.push(t.old.slice(0, 40)); continue; }
  if (!cur.includes(t.old)) throw new Error(`${t.node}: string antiga não encontrada e nova ausente — alvo divergiu`);
  if ((cur.split(t.old).length - 1) !== 1) throw new Error(`${t.node}: string antiga deveria aparecer 1x`);
  const next = cur.replace(t.old, t.new);
  if (next.includes(t.old) || !next.includes(t.new)) throw new Error(`${t.node}: replace inconsistente`);
  if (t.isCode) {
    // eslint-disable-next-line no-new-func
    new Function(next); // syntax-assert (não executa)
  }
  t.set(node, next);
  applied.push(t.old.slice(0, 40));
}

if (applied.length === 0) {
  console.log(JSON.stringify({ noop: true, skipped }, null, 2));
  process.exit(0);
}

if (kit.DRY) {
  fs.writeFileSync("/tmp/repasse-tradein-consent-dry.json", JSON.stringify(workflow, null, 2));
  console.log(JSON.stringify({ dry: true, applied, skipped }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "tradein-consent-valorize");
const { verify, activeAfter, finalActive } = await kit.safePut(workflow, "tradein-consent-valorize");
const remaining = [];
for (const t of TARGETS) {
  const node = verify.nodes.find((n) => n.name === t.node);
  if ((t.get(node) ?? "").includes(t.old)) remaining.push(`${t.node}:${t.old.slice(0, 30)}`);
}
console.log(JSON.stringify({
  workflowId: verify.id, wasActive, activeAfter, finalActive,
  applied, skipped, oldStringsRemaining: remaining,
}, null, 2));
