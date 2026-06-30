// Testes puros do computePromptEdit (Fase 4) — sem rede.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { computePromptEdit } from "../commands.mjs";
import { paths } from "../config.mjs";

function fakeWorkflow(systemMessage) {
  return {
    nodes: [
      { name: "Agente X", type: "@n8n/n8n-nodes-langchain.agent", parameters: { options: { systemMessage } } },
    ],
  };
}

test("computePromptEdit: substitui por âncora única e reporta diff", () => {
  const wf = fakeWorkflow("=Você é a Bia. REGRA ANTIGA aqui. Fim.");
  const r = computePromptEdit(wf, { node: "Agente X", anchor: "REGRA ANTIGA", to: "REGRA NOVA" });
  assert.equal(r.ok, true);
  assert.equal(r.field, "options.systemMessage");
  assert.equal(r.expression, true);
  assert.ok(r.after.includes("REGRA NOVA"));
  assert.ok(!r.after.includes("REGRA ANTIGA"));
  assert.deepEqual(r.stat, { added: 1, removed: 1 });
});

test("computePromptEdit: mutate=false NÃO altera o workflow", () => {
  const wf = fakeWorkflow("=texto ALVO");
  computePromptEdit(wf, { node: "Agente X", anchor: "ALVO", to: "NOVO" });
  assert.equal(wf.nodes[0].parameters.options.systemMessage, "=texto ALVO");
});

test("computePromptEdit: mutate=true escreve o after de volta no node", () => {
  const wf = fakeWorkflow("=texto ALVO");
  const r = computePromptEdit(wf, { node: "Agente X", anchor: "ALVO", to: "NOVO", mutate: true });
  assert.equal(r.ok, true);
  assert.equal(wf.nodes[0].parameters.options.systemMessage, "=texto NOVO");
});

test("computePromptEdit: âncora ausente → reason anchor", () => {
  const wf = fakeWorkflow("=abc");
  const r = computePromptEdit(wf, { node: "Agente X", anchor: "ZZZ", to: "x" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "anchor");
});

test("computePromptEdit: âncora duplicada → reason anchor (não aplica)", () => {
  const wf = fakeWorkflow("=A x A");
  const r = computePromptEdit(wf, { node: "Agente X", anchor: "A", to: "B" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "anchor");
});

test("computePromptEdit: node inexistente → reason node", () => {
  const wf = fakeWorkflow("=abc");
  const r = computePromptEdit(wf, { node: "Inexistente", anchor: "a", to: "b" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "node");
});

test("computePromptEdit: args faltando → reason args", () => {
  const wf = fakeWorkflow("=abc");
  assert.equal(computePromptEdit(wf, { node: "Agente X" }).reason, "args");
});

test("computePromptEdit: contra um prompt-expressão REAL do snapshot (idempotência de âncora)", () => {
  const wf = JSON.parse(fs.readFileSync(paths.liveSnapshot, "utf8"));
  // acha um node de agente com systemMessage por expressão (=...)
  const agent = wf.nodes.find(
    (n) => n.type === "@n8n/n8n-nodes-langchain.agent" && typeof n.parameters?.options?.systemMessage === "string" && n.parameters.options.systemMessage.startsWith("="),
  );
  assert.ok(agent, "há ao menos um prompt-expressão no snapshot");
  // escolhe um trecho que apareça exatamente 1x para servir de âncora segura
  const sm = agent.parameters.options.systemMessage;
  const probe = sm.slice(10, 40); // trecho arbitrário porém presente
  if ((sm.split(probe).length - 1) === 1) {
    const r = computePromptEdit(wf, { node: agent.name, anchor: probe, to: probe + " /*x*/" });
    assert.equal(r.ok, true);
    assert.equal(r.expression, true);
  }
});
