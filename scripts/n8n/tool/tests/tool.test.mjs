// ============================================================================
// tool.test.mjs — unit tests da lógica PURA do tool (extract/compose/snapshot/
// deploy_body/stages/fsio). Rodar: node --test scripts/n8n/tool/tests/
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isStaticPrompt,
  extractTargets,
  compose,
  structuralErrors,
  findPromptField,
} from "../extract.mjs";
import { detectDrift, buildSnapshot, sha256 } from "../snapshot.mjs";
import { buildSettings, buildPutBody, SETTINGS_REJECTED } from "../deploy_body.mjs";
import { slug, assignStages, planFiles } from "../stages.mjs";
import { withHeader, stripHeader } from "../fsio.mjs";

const CODE = "n8n-nodes-base.code";
const AGENT = "@n8n/n8n-nodes-langchain.agent";

function wf() {
  return {
    name: "demo",
    nodes: [
      { name: "A Code", type: CODE, position: [100, 0], parameters: { jsCode: "return [{json:{}}];" } },
      { name: "B Static", type: AGENT, position: [200, 0], parameters: { options: { systemMessage: "PROMPT estático" } } },
      { name: "C Expr", type: AGENT, position: [300, 0], parameters: { options: { systemMessage: "=Olá {{ $json.x }}" } } },
      { name: "D Set", type: "n8n-nodes-base.set", position: [400, 0], parameters: { foo: 1 } },
    ],
    connections: { "A Code": { main: [[{ node: "B Static", type: "main", index: 0 }]] } },
    settings: { executionOrder: "v1", timeSavedMode: "fixed", availableInMCP: false, callerPolicy: "x" },
  };
}

test("isStaticPrompt: só string que não começa com =", () => {
  assert.equal(isStaticPrompt("oi"), true);
  assert.equal(isStaticPrompt("=oi"), false);
  assert.equal(isStaticPrompt(""), false);
  assert.equal(isStaticPrompt(123), false);
});

test("extractTargets: code + prompt estático extraídos; expressão sinalizada", () => {
  const targets = extractTargets(wf());
  const byNode = Object.fromEntries(targets.map((t) => [t.node, t]));
  assert.equal(byNode["A Code"].kind, "code");
  assert.equal(byNode["B Static"].kind, "prompt");
  assert.equal(byNode["B Static"].expression, false);
  assert.equal(byNode["C Expr"].expression, true); // fica no workflow.json
  assert.equal(byNode["D Set"], undefined); // Set não é alvo
});

test("findPromptField acha options.systemMessage", () => {
  const node = { parameters: { options: { systemMessage: "x" } } };
  assert.deepEqual(findPromptField(node), { segs: ["options", "systemMessage"], value: "x" });
});

test("compose: aplica jsCode e prompt; demais nodes intactos; deep-copy", () => {
  const base = wf();
  const edits = new Map([
    ["A Code", { jsCode: "return [{json:{ok:1}}];" }],
    ["B Static", { prompt: { field: "options.systemMessage", content: "novo" } }],
  ]);
  const out = compose(base, edits);
  assert.equal(out.nodes[0].parameters.jsCode, "return [{json:{ok:1}}];");
  assert.equal(out.nodes[1].parameters.options.systemMessage, "novo");
  assert.equal(out.nodes[3].parameters.foo, 1); // Set intacto
  // base não mutada
  assert.equal(base.nodes[0].parameters.jsCode, "return [{json:{}}];");
});

test("compose: lança em node ausente", () => {
  assert.throws(() => compose(wf(), new Map([["X", { jsCode: "1" }]])), /node ausente/);
});

test("structuralErrors: detecta conexão pendente", () => {
  const w = wf();
  assert.equal(structuralErrors(w).length, 0);
  w.connections["A Code"].main[0][0].node = "Inexistente";
  assert.match(structuralErrors(w)[0], /inexistente/i);
});

test("detectDrift: só conflita em node editado E mudado no vivo", () => {
  const oldSnap = { A: sha256("v1"), B: sha256("x") };
  const fresh = { A: sha256("v2"), B: sha256("x") };
  assert.deepEqual(detectDrift(oldSnap, fresh, new Set(["A"])), ["A"]);
  assert.deepEqual(detectDrift(oldSnap, fresh, new Set(["B"])), []); // não mudou
  assert.deepEqual(detectDrift(oldSnap, fresh, new Set(["C"])), []); // node novo, sem base
});

test("buildSnapshot: hash por node", () => {
  const snap = buildSnapshot([{ node: "A", content: "x" }]);
  assert.equal(snap.A, sha256("x"));
});

test("buildSettings: remove timeSavedMode (causa 400), mantém allowlist, default executionOrder", () => {
  const s = buildSettings({ timeSavedMode: "fixed", availableInMCP: true, callerPolicy: "y" });
  assert.equal(s.timeSavedMode, undefined);
  assert.equal(SETTINGS_REJECTED.includes("timeSavedMode"), true);
  assert.equal(s.availableInMCP, true);
  assert.equal(s.callerPolicy, "y");
  assert.equal(s.executionOrder, "v1");
});

test("buildPutBody: só name/nodes/connections/settings", () => {
  const body = buildPutBody({ ...wf(), id: "X", versionId: "v", active: true, tags: [], pinData: {} });
  assert.deepEqual(Object.keys(body).sort(), ["connections", "name", "nodes", "settings"]);
  assert.equal(body.settings.timeSavedMode, undefined);
});

test("slug: normaliza acento e caixa", () => {
  assert.equal(slug("Montar Body do Simulador"), "montar-body-do-simulador");
  assert.equal(slug("Bia 2 ESTOQUE "), "bia-2-estoque");
});

test("assignStages: faixa por posição x", () => {
  const bands = [
    { id: "00", label: "a", xMin: 0, xMax: 250 },
    { id: "10", label: "b", xMin: 250, xMax: Infinity },
  ];
  const m = assignStages(wf().nodes, bands);
  assert.equal(m.get("A Code").id, "00"); // x=100
  assert.equal(m.get("C Expr").id, "10"); // x=300
});

test("planFiles: ordena por x e nomeia NN_seq_slug", () => {
  const bands = [{ id: "00", label: "a", xMin: 0, xMax: Infinity }];
  const targets = extractTargets(wf()).filter((t) => !(t.kind === "prompt" && t.expression));
  const byName = new Map(wf().nodes.map((n) => [n.name, n]));
  const planned = planFiles(targets, byName, bands);
  assert.equal(planned[0].filename, "00_01_a-code.js");
  assert.equal(planned[1].filename, "00_02_b-static.md");
});

test("withHeader/stripHeader: round-trip preserva corpo que começa com newline", () => {
  const content = "\n// começa com newline\nreturn [];\n";
  const file = withHeader("code", { node: "X", type: CODE, field: "jsCode", stage: "00 a" }, content);
  assert.equal(stripHeader(file), content);
});
