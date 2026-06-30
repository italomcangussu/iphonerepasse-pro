// ============================================================================
// commands.mjs — orquestra pull/status/build/deploy juntando lógica pura + I/O.
// ============================================================================

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { CONFIG, paths } from "./config.mjs";
import { getWorkflow, putWorkflow, activateWorkflow } from "./netio.mjs";
import { extractTargets, compose, structuralErrors, findPromptField } from "./extract.mjs";
import { replaceOnce, backup as kitBackup, safePut } from "./patch-kit.mjs";
import { planFiles } from "./stages.mjs";
import { withHeader, writeFileSafe, writeJson, readJson, readNodeBody, rmDirContents } from "./fsio.mjs";
import { buildSnapshot, detectDrift } from "./snapshot.mjs";
import { checkAllCode, scanSecrets } from "./validate.mjs";
import { buildPutBody, buildImportBody } from "./deploy_body.mjs";
import { renderManifest } from "./manifest.mjs";
import { compactDiff, diffStat } from "./diff.mjs";
import { syncLegacyArtifacts } from "./legacy-sync.mjs";

const BACKUP_DIR = "output/n8n/backups";
const TESTS_DIR = path.join("scripts", "n8n", "tool", "tests");

// ---------------------------------------------------------------------------
// runTests — roda a rede de testes do toolchain (node --test) SEM depender de
// npm/PATH (usa o mesmo binário node). É o gate do deploy: vermelho → aborta.
// ---------------------------------------------------------------------------
export function runTests() {
  // Descobre os arquivos de teste (node v24 não auto-descobre por diretório).
  const files = fs.existsSync(TESTS_DIR)
    ? fs.readdirSync(TESTS_DIR).filter((f) => f.endsWith(".test.mjs")).sort().map((f) => path.join(TESTS_DIR, f))
    : [];
  if (!files.length) return { ok: true, status: 0, output: "(sem arquivos de teste)\n", files };
  const r = spawnSync(process.execPath, ["--test", ...files], {
    encoding: "utf8",
    stdio: "pipe",
  });
  const output = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  return { ok: r.status === 0, status: r.status, output, files };
}

function loadBands() {
  const cfg = readJson(paths.stagesConfig);
  return cfg.stages.map((b) => ({ ...b, xMax: b.xMax == null ? Infinity : b.xMax }));
}

function nodesByName(workflow) {
  return new Map((workflow.nodes ?? []).map((n) => [n.name, n]));
}

/** Plano determinístico de arquivos para os alvos NÃO-expressão. */
function planForWorkflow(workflow, bands) {
  const targets = extractTargets(workflow);
  const fileTargets = targets.filter((t) => !(t.kind === "prompt" && t.expression));
  const expressionPrompts = targets.filter((t) => t.kind === "prompt" && t.expression);
  const planned = planFiles(fileTargets, nodesByName(workflow), bands);
  return { targets, planned, expressionPrompts };
}

function filePathFor(t) {
  return t.kind === "code" ? path.join(paths.codeDir, t.filename) : path.join(paths.promptsDir, t.filename);
}

function writeFourFiles(live) {
  writeJson(paths.workflowJson, live);
  writeJson(paths.importJson, buildImportBody(live));
  const typeCounts = {};
  for (const n of live.nodes ?? []) typeCounts[n.type] = (typeCounts[n.type] ?? 0) + 1;
  const connCount = Object.values(live.connections ?? {}).reduce((s, outs) => {
    let c = 0;
    for (const groups of Object.values(outs ?? {})) for (const g of groups ?? []) c += (g ?? []).length;
    return s + c;
  }, 0);
  writeJson(paths.contextJson, {
    workflowId: live.id ?? CONFIG.WORKFLOW_ID,
    name: live.name,
    versionId: live.versionId ?? null,
    updatedAt: live.updatedAt ?? null,
    active: live.active ?? null,
    nodeCount: (live.nodes ?? []).length,
    connectionCount: connCount,
    typeCounts,
    syncedAt: new Date().toISOString(),
  });
}

function decompose(live, bands) {
  const { planned, expressionPrompts } = planForWorkflow(live, bands);
  rmDirContents(paths.codeDir);
  rmDirContents(paths.promptsDir);
  for (const t of planned) {
    const meta = { node: t.node, type: t.type, field: t.field, stage: `${t.stage.id} ${t.stage.label}` };
    writeFileSafe(filePathFor(t), withHeader(t.kind, meta, t.content));
  }
  const snap = buildSnapshot(planned);
  writeJson(paths.snapshot, snap);
  const manifest = renderManifest({ workflow: live, planned, bands, expressionPrompts });
  writeFileSafe(paths.manifest, `${manifest}\n`);
  return { planned, expressionPrompts };
}

// ---------------------------------------------------------------------------
// pull
// ---------------------------------------------------------------------------
/**
 * pullFrom(live) — escreve TODOS os artefatos a partir de um `live` já obtido:
 * árvore canônica (workflow.json + nodes + .snapshot) E os artefatos legados
 * (snapshot do guard + espelhos). É o escritor ÚNICO compartilhado pelo CLI
 * `pull` e pelo guard (Fase 5), então as duas representações não divergem.
 */
export function pullFrom(live) {
  const bands = loadBands();
  writeFourFiles(live);
  const { planned, expressionPrompts } = decompose(live, bands);
  const legacy = syncLegacyArtifacts(live);
  return {
    versionId: live.versionId ?? null,
    nodeCount: (live.nodes ?? []).length,
    extractedFiles: planned.length,
    expressionPrompts: expressionPrompts.map((p) => p.node),
    legacy,
  };
}

export async function pull() {
  const live = await getWorkflow();
  return pullFrom(live);
}

// ---------------------------------------------------------------------------
// status — nodes com edição local pendente (corpo do arquivo ≠ workflow.json local)
// ---------------------------------------------------------------------------
export function computeEdits() {
  const bands = loadBands();
  const localWf = readJson(paths.workflowJson);
  const { planned } = planForWorkflow(localWf, bands);
  const baseByNode = new Map(extractTargets(localWf).map((t) => [t.node, t]));
  const edits = new Map();
  const details = [];
  for (const t of planned) {
    const body = readNodeBody(filePathFor(t));
    if (body == null) continue;
    const base = baseByNode.get(t.node);
    if (!base) continue;
    const norm = (s) => String(s).replace(/\r\n/g, "\n").replace(/\s+$/, "");
    if (norm(body) === norm(base.content)) continue;
    details.push({ node: t.node, kind: t.kind, file: filePathFor(t) });
    const edit = edits.get(t.node) ?? {};
    if (t.kind === "code") edit.jsCode = body;
    else edit.prompt = { field: t.field, content: body };
    edits.set(t.node, edit);
  }
  return { edits, details, localWf };
}

export function status() {
  const { details } = computeEdits();
  return details;
}

// ---------------------------------------------------------------------------
// build — remonta workflow.json a partir das partes (valida estrutura + JS)
// ---------------------------------------------------------------------------
export function build() {
  const { edits, details, localWf } = computeEdits();
  const rebuilt = compose(localWf, edits);
  const structErrors = structuralErrors(rebuilt);
  const jsErrors = checkAllCode(rebuilt);
  const errors = [...structErrors, ...jsErrors];
  if (errors.length) return { ok: false, errors, applied: details };
  writeJson(paths.workflowJson, rebuilt);
  return { ok: true, errors: [], applied: details, secrets: scanSecrets(rebuilt) };
}

// ---------------------------------------------------------------------------
// deploy — dry-run por padrão; --confirm faz o PUT + reativa + re-sync
// ---------------------------------------------------------------------------
function backupLive(live) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `repasse-maint-${Date.now()}-v${live.versionId ?? "x"}.json`);
  writeJson(file, live);
  return file;
}

export async function deploy({ confirm = false, skipTests = false } = {}) {
  const bands = loadBands();
  const { edits, details } = computeEdits();
  if (!details.length) {
    return { ok: true, nothingToSend: true, applied: [] };
  }
  // GET fresco do vivo — base de composição e de drift.
  const fresh = await getWorkflow();
  const oldSnap = fs.existsSync(paths.snapshot) ? readJson(paths.snapshot) : {};
  const freshSnap = buildSnapshot(planForWorkflow(fresh, bands).planned);
  const editedNames = new Set(edits.keys());
  const conflicts = detectDrift(oldSnap, freshSnap, editedNames);
  if (conflicts.length) {
    return {
      ok: false,
      reason: "drift",
      conflicts,
      message: `Drift: ${conflicts.join(", ")} mudou no vivo desde o último pull. Rode 'pull' e reaplique suas edições.`,
    };
  }
  // Gate de testes (Fase 2): roda a rede de testes ANTES de tocar o vivo. Em
  // --confirm, vermelho ABORTA. No dry-run, só sinaliza (nada é enviado).
  let tests = null;
  if (!skipTests) {
    tests = runTests();
    if (!tests.ok && confirm) {
      return { ok: false, reason: "tests", testStatus: tests.status, testOutput: tests.output };
    }
  }
  const rebuilt = compose(fresh, edits);
  const errors = [...structuralErrors(rebuilt), ...checkAllCode(rebuilt)];
  if (errors.length) return { ok: false, reason: "validation", errors };
  const secrets = scanSecrets(rebuilt); // aviso (não bloqueia) — Fase menor

  // Diff textual por node editado (vivo fresco → corpo novo) — Fase 3.
  const freshByNode = new Map(extractTargets(fresh).map((t) => [t.node, t.content]));
  const diffs = [];
  for (const [name, edit] of edits) {
    const before = freshByNode.get(name) ?? "";
    const after = edit.jsCode != null ? edit.jsCode : edit.prompt?.content ?? "";
    diffs.push({ node: name, stat: diffStat(before, after), diff: compactDiff(before, after) });
  }

  if (!confirm) {
    return {
      ok: true,
      dryRun: true,
      applied: details,
      freshVersionId: fresh.versionId ?? null,
      testsOk: tests ? tests.ok : null,
      testsSkipped: skipTests,
      diffs,
      secrets,
    };
  }

  const backup = backupLive(fresh);
  await putWorkflow(buildPutBody(rebuilt));
  let activated = false;
  try {
    await activateWorkflow();
    activated = true;
  } catch (e) {
    activated = `falhou: ${e.message}`;
  }
  // Re-sync: GET de novo e re-grava os 4 arquivos + decompõe.
  const after = await getWorkflow();
  writeFourFiles(after);
  decompose(after, bands);
  return {
    ok: true,
    deployed: true,
    applied: details,
    backup,
    activated,
    newVersionId: after.versionId ?? null,
    secrets,
  };
}

// ---------------------------------------------------------------------------
// edit-prompt (Fase 4) — edita um prompt-EXPRESSÃO (`=…`, vive no workflow.json,
// NÃO vira arquivo) por ÂNCORA única, sem precisar de um patch script bespoke.
// Reusa o deploy seguro do patch-kit (GET fresco → backup → PUT → activate) e
// re-sincroniza a árvore com `pull`. dry → preview com diff, sem rede de escrita.
// ---------------------------------------------------------------------------
function setBySegs(obj, segs, value) {
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const s = segs[i];
    if (cur[s] == null || typeof cur[s] !== "object") cur[s] = {};
    cur = cur[s];
  }
  cur[segs[segs.length - 1]] = value;
}

/**
 * Lógica PURA do edit-prompt (sem rede): localiza o campo de prompt do node,
 * aplica replaceOnce por âncora e devolve before/after + diff. NÃO muta `live`
 * a menos que `mutate:true` (aí escreve o `after` de volta no node, in place).
 */
export function computePromptEdit(live, { node: nodeName, anchor, to, mutate = false }) {
  if (!nodeName || anchor == null || to == null) {
    return { ok: false, reason: "args", message: "uso: edit-prompt <node> --anchor <txt> --to <txt> [--confirm]" };
  }
  const node = (live.nodes ?? []).find((n) => n.name === nodeName);
  if (!node) return { ok: false, reason: "node", message: `node não encontrado: ${nodeName}` };
  const found = findPromptField(node);
  if (!found || typeof found.value !== "string") {
    return { ok: false, reason: "field", message: `node ${nodeName} não tem campo de prompt editável` };
  }
  const before = found.value;
  let after;
  try {
    after = replaceOnce(before, anchor, to, "edit-prompt");
  } catch (e) {
    return { ok: false, reason: "anchor", message: e.message };
  }
  const field = found.segs.join(".");
  if (mutate) setBySegs(node.parameters, found.segs, after);
  return {
    ok: true,
    node: nodeName,
    field,
    expression: before.startsWith("="),
    before,
    after,
    stat: diffStat(before, after),
    diff: compactDiff(before, after),
  };
}

export async function editPrompt({ node: nodeName, anchor, to, dry = false }) {
  const live = await getWorkflow();
  const r = computePromptEdit(live, { node: nodeName, anchor, to, mutate: !dry });
  if (!r.ok) return r;

  if (dry) {
    return { ok: true, dry: true, node: r.node, field: r.field, expression: r.expression, stat: r.stat, diff: r.diff };
  }

  const errors = structuralErrors(live);
  if (errors.length) return { ok: false, reason: "validation", errors };

  kitBackup(live, `edit-prompt-${nodeName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`);
  const { activeAfter, finalActive } = await safePut(live, "edit-prompt");
  // Re-sync da árvore versionada com o vivo já editado.
  const bands = loadBands();
  const fresh = await getWorkflow();
  writeFourFiles(fresh);
  decompose(fresh, bands);
  return {
    ok: true,
    deployed: true,
    node: r.node,
    field: r.field,
    stat: r.stat,
    activeAfter,
    finalActive,
    newVersionId: fresh.versionId ?? null,
  };
}
