// Testes puros do patch-kit (lógica de patch sem rede). Roda em node --test.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  replaceOnce,
  assertSyntax,
  dry,
  backup,
  pruneBackups,
} from "../patch-kit.mjs";
import { buildPutBody } from "../deploy_body.mjs";
import { paths } from "../config.mjs";

test("replaceOnce: substitui quando a âncora é única", () => {
  assert.equal(replaceOnce("a B c", "B", "X", "t"), "a X c");
});

test("replaceOnce: lança se a âncora não existe (0 ocorrências)", () => {
  assert.throws(() => replaceOnce("abc", "Z", "X", "t"), /achou 0/);
});

test("replaceOnce: lança se a âncora aparece 2+ vezes", () => {
  assert.throws(() => replaceOnce("B x B", "B", "X", "t"), /achou 2/);
});

test("replaceOnce: contra o jsCode REAL de 'Code Parse Memory 2' do snapshot", () => {
  const wf = JSON.parse(fs.readFileSync(paths.liveSnapshot, "utf8"));
  const node = wf.nodes.find((n) => n.name === "Code Parse Memory 2");
  assert.ok(node, "node 'Code Parse Memory 2' presente no snapshot");
  const code = node.parameters.jsCode;
  // âncora trivialmente única: o nome do node não aparece no corpo; injetamos uma.
  const unique = "// __patch_kit_probe__";
  const seeded = `${unique}\n${code}`;
  const out = replaceOnce(seeded, unique, "// trocado", "probe");
  assert.ok(out.startsWith("// trocado\n"));
  // e o corpo real é sintaticamente válido sob new Function (contrato do assertSyntax)
  assert.doesNotThrow(() => assertSyntax(code, "Code Parse Memory 2"));
});

test("assertSyntax: aceita JS válido e rejeita inválido", () => {
  assert.doesNotThrow(() => assertSyntax("const a = 1; return a;"));
  assert.throws(() => assertSyntax("const = ;"), /sintaxe inválida/);
});

test("dry: grava o workflow e devolve resumo sem rede", () => {
  const tmp = path.join(os.tmpdir(), `pk-dry-${Date.now()}.json`);
  const r = dry({ name: "x", nodes: [] }, tmp);
  assert.deepEqual(r, { dry: true, file: tmp });
  assert.deepEqual(JSON.parse(fs.readFileSync(tmp, "utf8")), { name: "x", nodes: [] });
  fs.rmSync(tmp, { force: true });
});

test("buildPutBody (reuso): corpo só com name/nodes/connections/settings e sem timeSavedMode", () => {
  const body = buildPutBody({
    name: "w",
    nodes: [],
    connections: {},
    settings: { executionOrder: "v1", timeSavedMode: "x", saveManualExecutions: true },
  });
  assert.deepEqual(Object.keys(body).sort(), ["connections", "name", "nodes", "settings"]);
  assert.equal(body.settings.timeSavedMode, undefined);
  assert.equal(body.settings.saveManualExecutions, true);
});

test("backup + pruneBackups: retenção por rótulo mantém só os N mais recentes", () => {
  const label = `pktest-${process.pid}`;
  fs.mkdirSync(paths.backupsDir, { recursive: true });
  // cria 5 backups do mesmo rótulo
  const created = [];
  for (let i = 0; i < 5; i++) {
    const r = backup({ name: "w", i }, label);
    created.push(r.file);
  }
  // mantém só os 2 mais recentes
  const removed = pruneBackups(label, 2);
  const remaining = fs
    .readdirSync(paths.backupsDir)
    .filter((f) => f.startsWith(`before-${label}-`));
  assert.equal(remaining.length, 2, "sobram 2 backups do rótulo");
  assert.ok(removed.length >= 3, "removeu os excedentes");
  // limpeza total do rótulo de teste
  for (const f of remaining) fs.rmSync(path.join(paths.backupsDir, f), { force: true });
});
