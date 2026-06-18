import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformWorkflow, computeDeadSet, SURVIVOR, RETIRING, PROMPT_MARKER, TEXT_MARKER } from "../../transform-bia2-merge.mjs";
import { structuralErrors } from "../extract.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WF_PATH = path.join(HERE, "../../../../n8n/ia-repasse-pro-v2/workflow.json");

function loadWf() {
  return JSON.parse(fs.readFileSync(WF_PATH, "utf8"));
}
// O workflow vivo já pode estar FUNDIDO (após o deploy de 2026-06-18). Os
// invariantes valem nos dois estados: pré-fusão usamos o transform; pós-fusão
// validamos o próprio workflow.json. Assim o teste é guarda de regressão perene.
const isMerged = (wf) => !wf.nodes.some((n) => n.name === RETIRING);
function merged(wf) {
  return isMerged(wf) ? wf : transformWorkflow(wf).wf;
}
const surv = (wf) => wf.nodes.find((n) => n.name === SURVIVOR);

const DEAD17 = [
  RETIRING, "OpenRouter Chat Model4", "Postgres Chat Memory2",
  "Edit Fields13", "Code Parse Bia 2 SEM ESTOQUE1", "CODE MONTAR LINK REPASSE ",
  "Split Out5", "Edit Fields11", "Edit Fields12", "Split Out4",
  "Loop Over Items2", "HTTP Request1", "Wait3", "If", "CRM Leads POST",
  "No Operation, do nothing1", "No Operation, do nothing5",
];

// ───────────────────────── Prompt unificado ─────────────────────────
test("prompt: sobrevivente tem os 4 blocos exclusivos da continuidade + preâmbulo", () => {
  const sm = surv(merged(loadWf())).parameters.options.systemMessage;
  assert.ok(sm.includes(PROMPT_MARKER), "marcador de modo-por-contexto");
  assert.ok(sm.includes("REGRA DE ENTRADA ANTES DE SIMULAR"), "entrada-antes-de-simular");
  assert.ok(sm.includes("CONTINUIDADE SEM CONSULTA DE ESTOQUE"), "continuidade-sem-consulta");
  assert.ok(sm.includes("CONVENCER SEMINOVO"), "convencer-seminovo");
  assert.ok(sm.includes("tradein_condition_human_eval"), "condição do aparelho de entrada");
});

test("prompt: base da ESTOQUE preservada + sem duplicar NATURALIDADE", () => {
  const sm = surv(merged(loadWf())).parameters.options.systemMessage;
  assert.ok(sm.includes("CENÁRIOS DE ESTOQUE — LEIA PRIMEIRO"), "cenários A/B/C");
  assert.ok(sm.includes("ESTÁGIO 4 — RESERVA E DADOS PIX"), "estágio reserva/PIX");
  assert.equal(sm.split("NATURALIDADE — SEM CARA DE IA (REGRA DURA)").length - 1, 1, "naturalidade 1x");
});

// ───────────────────────── Contexto / text ─────────────────────────
test("text: mensagem atual defensiva + routing_decision + simulação preservada", () => {
  const t = surv(merged(loadWf())).parameters.text;
  assert.ok(!t.includes("{{ $json.buffer.message_buffered }}"), "leitura não-defensiva removida");
  assert.ok(t.includes("$json.message_buffered ?? $json.buffer?.message_buffered"), "leitura defensiva");
  assert.ok(t.includes(TEXT_MARKER) && t.includes("Routing decision:") && t.includes("last_inventory_context"), "contexto de continuidade");
  assert.ok(t.includes('$json.simulation_result ? "Resultado: " + $json.simulation_result.text'), "apresenta simulação");
  assert.ok(t.includes("$json.memory?.desired_model ?? $json.desired_model"), "fallback de raiz no lead");
});

// ───────────────────────── Topologia ─────────────────────────
test("topologia: 3 entradas apontam para o sobrevivente; aposentado ausente", () => {
  const wf = merged(loadWf());
  const dest = (src, g) => (wf.connections[src]?.main?.[g] ?? []).map((l) => l.node);
  assert.ok(dest("Switch1", 0).includes(SURVIVOR), "Switch1[0] → sobrevivente");
  assert.ok(dest("Switch3", 2).includes(SURVIVOR), "Switch3[2] → sobrevivente");
  assert.ok(dest("Parse Simulator", 0).includes(SURVIVOR), "Parse Simulator[0] → sobrevivente");
  assert.ok(!JSON.stringify(wf.connections).includes(`"${RETIRING}"`), "nenhuma conexão p/ aposentado");
});

test("topologia: 17 nós mortos ausentes + integridade (structuralErrors=[])", () => {
  const wf = merged(loadWf());
  const names = new Set(wf.nodes.map((n) => n.name));
  for (const d of DEAD17) assert.ok(!names.has(d), `nó morto presente: ${d}`);
  assert.deepEqual(structuralErrors(wf), [], "sem conexões para nós inexistentes");
});

test("topologia: NÃO mata Bia 1 (If4/POST4), estoque, nem sticky notes", () => {
  const names = new Set(merged(loadWf()).nodes.map((n) => n.name));
  for (const keep of [
    SURVIVOR, "Bia 1", "If4", "CRM Leads POST4", "Loop Over Items1",
    "If2", "CRM Leads POST2", "Webhook", "Postgres Chat Memory",
    "OpenRouter Chat Model3", "Router Agent", "Módulo 08 - Bia 2 sem estoque e montagem",
  ]) {
    assert.ok(names.has(keep), `sumiu indevidamente: ${keep}`);
  }
});

// ───────────── delta-reach: só faz sentido sobre base pré-fusão ─────────────
test("delta-reach: conjunto morto = 17 (quando a base ainda é pré-fusão)", () => {
  const wf = loadWf();
  if (isMerged(wf)) {
    assert.equal(computeDeadSet(wf).size, 0, "pós-fusão: nada mais a remover (idempotente)");
    return;
  }
  const dead = computeDeadSet(wf);
  assert.equal(dead.size, 17);
  for (const d of DEAD17) assert.ok(dead.has(d), `deve estar morto: ${d}`);
});

// ───────────────────────── Idempotência ─────────────────────────
test("idempotente: transformar de novo é no-op", () => {
  const once = merged(loadWf());
  const twice = transformWorkflow(once).wf;
  assert.deepEqual(twice, once, "segunda passada não muda nada");
});
