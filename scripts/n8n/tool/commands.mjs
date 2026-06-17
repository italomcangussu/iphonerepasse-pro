// ============================================================================
// commands.mjs — orquestra pull/status/build/deploy juntando lógica pura + I/O.
// ============================================================================

import fs from "node:fs";
import path from "node:path";
import { CONFIG, paths } from "./config.mjs";
import { getWorkflow, putWorkflow, activateWorkflow } from "./netio.mjs";
import { extractTargets, compose, structuralErrors } from "./extract.mjs";
import { planFiles } from "./stages.mjs";
import { withHeader, writeFileSafe, writeJson, readJson, readNodeBody, rmDirContents } from "./fsio.mjs";
import { buildSnapshot, detectDrift } from "./snapshot.mjs";
import { checkAllCode } from "./validate.mjs";
import { buildPutBody, buildImportBody } from "./deploy_body.mjs";
import { renderManifest } from "./manifest.mjs";

const BACKUP_DIR = "output/n8n/backups";

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
export async function pull() {
  const bands = loadBands();
  const live = await getWorkflow();
  writeFourFiles(live);
  const { planned, expressionPrompts } = decompose(live, bands);
  return {
    versionId: live.versionId ?? null,
    nodeCount: (live.nodes ?? []).length,
    extractedFiles: planned.length,
    expressionPrompts: expressionPrompts.map((p) => p.node),
  };
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
  return { ok: true, errors: [], applied: details };
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

export async function deploy({ confirm = false } = {}) {
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
  const rebuilt = compose(fresh, edits);
  const errors = [...structuralErrors(rebuilt), ...checkAllCode(rebuilt)];
  if (errors.length) return { ok: false, reason: "validation", errors };

  if (!confirm) {
    return { ok: true, dryRun: true, applied: details, freshVersionId: fresh.versionId ?? null };
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
  };
}
