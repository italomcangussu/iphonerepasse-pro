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
const surv = (wf) => wf.nodes.find((n) => n.name === SURVIVOR);

// ───────────────────────── Prompt (Task 4) ─────────────────────────
test("prompt: sobrevivente recebe os 4 blocos exclusivos da continuidade + preâmbulo", () => {
  const { wf } = transformWorkflow(loadWf());
  const sm = surv(wf).parameters.options.systemMessage;
  assert.ok(sm.includes(PROMPT_MARKER), "marcador de modo-por-contexto presente");
  assert.ok(sm.includes("REGRA DE ENTRADA ANTES DE SIMULAR"), "bloco entrada-antes-de-simular");
  assert.ok(sm.includes("CONTINUIDADE SEM CONSULTA DE ESTOQUE"), "bloco continuidade-sem-consulta");
  assert.ok(sm.includes("CONVENCER SEMINOVO"), "bloco convencer-seminovo");
  assert.ok(sm.includes('tradein_condition_human_eval'), "tratamento de condição do aparelho de entrada");
});

test("prompt: base da ESTOQUE preservada (funil completo)", () => {
  const { wf } = transformWorkflow(loadWf());
  const sm = surv(wf).parameters.options.systemMessage;
  assert.ok(sm.includes("CENÁRIOS DE ESTOQUE — LEIA PRIMEIRO"), "cenários A/B/C");
  assert.ok(sm.includes("ESTÁGIO 4 — RESERVA E DADOS PIX"), "estágio de reserva/PIX");
});

test("prompt: blocos compartilhados não duplicam (NATURALIDADE aparece 1x)", () => {
  const { wf } = transformWorkflow(loadWf());
  const sm = surv(wf).parameters.options.systemMessage;
  const n = sm.split("NATURALIDADE — SEM CARA DE IA (REGRA DURA)").length - 1;
  assert.equal(n, 1, "bloco de naturalidade não foi duplicado");
});

// ───────────────────────── Contexto / text (Task 4) ─────────────────────────
test("text: mensagem atual fica defensiva (não lança se buffer ausente)", () => {
  const { wf } = transformWorkflow(loadWf());
  const t = surv(wf).parameters.text;
  assert.ok(!t.includes("{{ $json.buffer.message_buffered }}"), "leitura não-defensiva removida");
  assert.ok(t.includes('$json.message_buffered ?? $json.buffer?.message_buffered'), "leitura defensiva presente");
});

test("text: expõe routing_decision + last_inventory_context (regras enxertadas dependem)", () => {
  const { wf } = transformWorkflow(loadWf());
  const t = surv(wf).parameters.text;
  assert.ok(t.includes(TEXT_MARKER), "bloco de contexto de continuidade");
  assert.ok(t.includes("Routing decision:"), "routing_decision exposto");
  assert.ok(t.includes("last_inventory_context"), "last_inventory_context exposto");
});

test("text: pós-sim continua apresentando a simulação (sem regressão)", () => {
  const { wf } = transformWorkflow(loadWf());
  const t = surv(wf).parameters.text;
  assert.ok(t.includes('$json.simulation_result ? "Resultado: " + $json.simulation_result.text'), "apresenta simulation_result");
});

test("text: estado do lead ganha fallback de raiz (?? $json.X)", () => {
  const { wf } = transformWorkflow(loadWf());
  const t = surv(wf).parameters.text;
  assert.ok(t.includes("$json.memory?.desired_model ?? $json.desired_model"), "desired_model com fallback de raiz");
  assert.ok(t.includes("$json.memory?.card_brand ?? $json.card_brand"), "card_brand com fallback de raiz");
});

// ───────────────────────── Topologia (Task 5) ─────────────────────────
test("topologia: conjunto morto = 17 nós continuidade-exclusivos (delta-reach)", () => {
  const wf = loadWf();
  const dead = computeDeadSet(wf);
  assert.equal(dead.size, 17, `esperado 17 mortos, veio ${dead.size}`);
  for (const d of [
    RETIRING, "OpenRouter Chat Model4", "Postgres Chat Memory2",
    "Edit Fields13", "Code Parse Bia 2 SEM ESTOQUE1", "CODE MONTAR LINK REPASSE ",
    "Split Out5", "Edit Fields11", "Edit Fields12", "Split Out4",
    "Loop Over Items2", "HTTP Request1", "Wait3", "If", "CRM Leads POST",
    "No Operation, do nothing1", "No Operation, do nothing5",
  ]) {
    assert.ok(dead.has(d), `deve estar morto: ${JSON.stringify(d)}`);
  }
});

test("topologia: NÃO mata Bia 1 (If4/POST4), pipeline da estoque, nem sticky notes", () => {
  const dead = computeDeadSet(loadWf());
  for (const keep of [
    SURVIVOR, "Bia 1", "If4", "CRM Leads POST4", "Loop Over Items1",
    "If2", "CRM Leads POST2", "Loop Over Items", "Webhook",
    "Postgres Chat Memory", "OpenRouter Chat Model3", "Router Agent",
    "Módulo 08 - Bia 2 sem estoque e montagem", "Delete table or rows",
  ]) {
    assert.ok(!dead.has(keep), `NÃO pode matar: ${JSON.stringify(keep)}`);
  }
});

test("topologia: 3 entradas repontadas para o sobrevivente", () => {
  const { wf } = transformWorkflow(loadWf());
  const dest = (src, g) => (wf.connections[src]?.main?.[g] ?? []).map((l) => l.node);
  assert.ok(dest("Switch1", 0).includes(SURVIVOR), "Switch1[0] → sobrevivente");
  assert.ok(dest("Switch3", 2).includes(SURVIVOR), "Switch3[2] → sobrevivente");
  assert.ok(dest("Parse Simulator", 0).includes(SURVIVOR), "Parse Simulator[0] → sobrevivente");
  // e nenhum aponta mais para o aposentado
  const blob = JSON.stringify(wf.connections);
  assert.ok(!blob.includes(`"${RETIRING}"`), "nenhuma conexão referencia o nó aposentado");
});

test("topologia: nós mortos removidos e integridade de conexões (structuralErrors=[])", () => {
  const { wf, dead } = transformWorkflow(loadWf());
  const names = new Set(wf.nodes.map((n) => n.name));
  for (const d of dead) assert.ok(!names.has(d), `nó morto ainda presente: ${d}`);
  assert.deepEqual(structuralErrors(wf), [], "sem conexões para nós inexistentes");
});

// ───────────────────────── Idempotência ─────────────────────────
test("idempotente: transformar duas vezes dá o mesmo resultado", () => {
  const once = transformWorkflow(loadWf()).wf;
  const twice = transformWorkflow(once).wf;
  assert.deepEqual(twice, once, "segunda passada é no-op");
});
