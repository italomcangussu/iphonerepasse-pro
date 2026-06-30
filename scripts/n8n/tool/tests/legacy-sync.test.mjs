// Testes do escritor único de artefatos legados (Fase 5).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { discoverMirrors, syncLegacyArtifacts } from "../legacy-sync.mjs";

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "legacy-sync-"));
}

test("discoverMirrors: casa arquivo .js cujo conteúdo == jsCode de um Code node", () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, "mirror-a.js"), "return 1;\n");
  fs.writeFileSync(path.join(dir, "outro.js"), "return 999;\n");
  const wf = { nodes: [{ name: "Node A", type: "n8n-nodes-base.code", parameters: { jsCode: "return 1;" } }] };
  const mirrors = discoverMirrors(wf, dir);
  assert.equal(mirrors.length, 1);
  assert.equal(mirrors[0].nodeName, "Node A");
  assert.ok(mirrors[0].file.endsWith("mirror-a.js"));
});

test("discoverMirrors: colisão (2 nodes com mesmo código) → ignora (ambíguo)", () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, "m.js"), "return 1;\n");
  const wf = {
    nodes: [
      { name: "A", type: "n8n-nodes-base.code", parameters: { jsCode: "return 1;" } },
      { name: "B", type: "n8n-nodes-base.code", parameters: { jsCode: "return 1;" } },
    ],
  };
  assert.equal(discoverMirrors(wf, dir).length, 0);
});

test("syncLegacyArtifacts: escreve o snapshot e atualiza o espelho a partir do live", () => {
  const dir = tmpdir();
  const snapshotPath = path.join(dir, "snap.json");
  const scriptsDir = path.join(dir, "scripts");
  fs.mkdirSync(scriptsDir, { recursive: true });
  // estado ANTERIOR: snapshot com Node A = "return 1;" e espelho batendo
  const prior = { nodes: [{ name: "A", type: "n8n-nodes-base.code", parameters: { jsCode: "return 1;" } }] };
  fs.writeFileSync(snapshotPath, JSON.stringify(prior, null, 2) + "\n");
  fs.writeFileSync(path.join(scriptsDir, "mir.js"), "return 1;\n");
  // live: Node A mudou para "return 2;"
  const live = { name: "w", nodes: [{ name: "A", type: "n8n-nodes-base.code", parameters: { jsCode: "return 2;" } }] };
  const r = syncLegacyArtifacts(live, { snapshotPath, scriptsDir });

  assert.equal(r.snapshotUpdated, true);
  assert.equal(r.mirrorsUpdated.length, 1, "espelho descoberto pelo conteúdo ANTERIOR e atualizado");
  // snapshot agora reflete o live
  assert.equal(JSON.parse(fs.readFileSync(snapshotPath, "utf8")).nodes[0].parameters.jsCode, "return 2;");
  // espelho recebeu o código novo
  assert.equal(fs.readFileSync(path.join(scriptsDir, "mir.js"), "utf8"), "return 2;\n");
});

test("syncLegacyArtifacts: idempotente — sem mudança, não reescreve espelho", () => {
  const dir = tmpdir();
  const snapshotPath = path.join(dir, "snap.json");
  const scriptsDir = path.join(dir, "scripts");
  fs.mkdirSync(scriptsDir, { recursive: true });
  const live = { name: "w", nodes: [{ name: "A", type: "n8n-nodes-base.code", parameters: { jsCode: "return 1;" } }] };
  fs.writeFileSync(snapshotPath, JSON.stringify(live, null, 2) + "\n");
  fs.writeFileSync(path.join(scriptsDir, "mir.js"), "return 1;\n");
  const r = syncLegacyArtifacts(live, { snapshotPath, scriptsDir });
  assert.equal(r.mirrorsUpdated.length, 0, "espelho já batia → nada a atualizar");
});
