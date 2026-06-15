// ============================================================================
// guard-live-workflow-sync.mjs — gatilho de segurança contra REGRESSÕES no
// workflow AO VIVO n8n `Cr4fPWe0prwS6XjI` ("ia repasse-pro v2 avancada").
//
// PROBLEMA QUE RESOLVE
// --------------------
// O workflow ao vivo é frágil e às vezes é editado MANUALMENTE no n8n UI. Quando
// isso acontece, dois artefatos do projeto ficam defasados (stale):
//   1. o snapshot   output/n8n/ia-repasse-pro-v2-current.json
//   2. os espelhos  scripts/n8n/repasse-code-*.js  (cópias byte-exatas do jsCode
//      de alguns nós Code)
// Os patch scripts fazem GET→`.replace()` exato→PUT e usam o snapshot no DRY=1.
// Se a versão ao vivo mudou por fora, o autor raciocina sobre código velho e/ou
// o `.replace()` falha — risco de regressão silenciosa.
//
// O QUE ESTE GUARD FAZ
// --------------------
// Antes de QUALQUER análise ou alteração do workflow ao vivo:
//   - GET da versão ao vivo (REST /api/v1/workflows/<id>);
//   - compara com o último estado sincronizado (versionId/updatedAt + assinatura
//     de conteúdo) e RECONHECE se houve edição manual desde o último sync;
//   - se houve drift: RE-EXPORTA o snapshot e RE-SINCRONIZA os arquivos espelho
//     a partir do código ao vivo, e grava um relatório do que mudou
//     (output/n8n/.live-guard/), para que não haja regressão.
//
// Mirrors são auto-descobertos: qualquer scripts/n8n/*.js cujo conteúdo bate
// byte-a-byte com o jsCode de um nó Code (no snapshot) é tratado como espelho —
// não precisa registrar manualmente ao adicionar novos.
//
// MODOS (CLI)
//   node scripts/n8n/guard-live-workflow-sync.mjs            # sync (default)
//   node scripts/n8n/guard-live-workflow-sync.mjs --check    # só detecta; exit 3 se drift
//   node scripts/n8n/guard-live-workflow-sync.mjs --json     # saída JSON
//   node scripts/n8n/guard-live-workflow-sync.mjs --quiet    # menos ruído
// Importável: `import { runGuard } from "./guard-live-workflow-sync.mjs"`.
// ============================================================================

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const WORKFLOW_ID = "Cr4fPWe0prwS6XjI";
const FALLBACK_ORIGIN = "https://iatende-n8n.ylgf5w.easypanel.host";
const SNAPSHOT_PATH = "output/n8n/ia-repasse-pro-v2-current.json";
const GUARD_DIR = "output/n8n/.live-guard";
const STATE_PATH = `${GUARD_DIR}/state.json`;
const VERSION_HISTORY_PATH = `${GUARD_DIR}/version-history.jsonl`;
const SCRIPTS_DIR = "scripts/n8n";
const FETCH_TIMEOUT_MS = 12_000;

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

function resolveN8nAccess() {
  const env = readEnvFile(path.resolve(".env.local"));
  const apiKey =
    process.env.N8N_API_KEY ?? process.env.N8N_PUBLIC_API ?? env.N8N_API_KEY ?? env.N8N_PUBLIC_API;
  const rawBase =
    process.env.N8N_BASE_URL ?? process.env.N8N_MCP_URL ?? env.N8N_BASE_URL ?? env.N8N_MCP_URL;
  let origin = FALLBACK_ORIGIN;
  if (rawBase) {
    try {
      origin = new URL(rawBase).origin;
    } catch {
      /* keep fallback */
    }
  }
  return { apiKey, origin };
}

async function n8nGet(pathname) {
  const { apiKey, origin } = resolveN8nAccess();
  if (!apiKey) throw new Error("N8N_API_KEY ausente em .env.local / env");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(`${origin}${pathname}`, {
      headers: { "X-N8N-API-KEY": apiKey, "Content-Type": "application/json" },
      signal: ctrl.signal,
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`n8n API ${r.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(timer);
  }
}

const trimEnd = (s) => String(s ?? "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\s+$/, "");
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

// Assinatura de CONTEÚDO significativo (ignora posição, ids voláteis, metadados).
// Mudança de assinatura == alteração real de comportamento (params/conexões).
function meaningfulSignature(wf) {
  const nodes = (wf.nodes ?? [])
    .map((n) => ({
      name: n.name,
      type: n.type,
      typeVersion: n.typeVersion,
      parameters: n.parameters ?? {},
      credentials: n.credentials ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const payload = {
    nodes,
    connections: wf.connections ?? {},
    executionOrder: wf.settings?.executionOrder ?? "v1",
  };
  return sha(JSON.stringify(payload));
}

// Por-nó: detecta QUAIS nós mudaram de parâmetros entre snapshot e live.
function changedNodes(prev, live) {
  const map = (wf) => new Map((wf.nodes ?? []).map((n) => [n.name, n]));
  const a = map(prev);
  const b = map(live);
  const sig = (n) => (n ? sha(JSON.stringify({ t: n.type, p: n.parameters ?? {} })) : null);
  const changed = [];
  for (const [name, node] of b) {
    if (!a.has(name)) changed.push({ name, kind: "added" });
    else if (sig(a.get(name)) !== sig(node)) changed.push({ name, kind: "modified" });
  }
  for (const [name] of a) if (!b.has(name)) changed.push({ name, kind: "removed" });
  return changed;
}

// Auto-descoberta de espelhos: arquivo scripts/n8n/*.js cujo conteúdo == jsCode
// de exatamente UM nó Code do snapshot (last-known-good). Colisões são ignoradas.
function discoverMirrors(snapshot) {
  const codeNodes = (snapshot.nodes ?? []).filter(
    (n) => n.type === "n8n-nodes-base.code" && typeof n.parameters?.jsCode === "string",
  );
  const byCode = new Map();
  for (const n of codeNodes) {
    const key = trimEnd(n.parameters.jsCode);
    if (byCode.has(key)) byCode.set(key, null); // colisão -> ambíguo
    else byCode.set(key, n.name);
  }
  const mirrors = [];
  if (!fs.existsSync(SCRIPTS_DIR)) return mirrors;
  for (const file of fs.readdirSync(SCRIPTS_DIR)) {
    if (!file.endsWith(".js")) continue;
    const full = `${SCRIPTS_DIR}/${file}`;
    const content = trimEnd(fs.readFileSync(full, "utf8"));
    const nodeName = byCode.get(content);
    if (nodeName) mirrors.push({ file: full, nodeName });
  }
  return mirrors;
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function writeState(live, signature) {
  fs.mkdirSync(GUARD_DIR, { recursive: true });
  fs.writeFileSync(
    STATE_PATH,
    `${JSON.stringify(
      {
        workflowId: WORKFLOW_ID,
        lastSyncedVersionId: live.versionId ?? null,
        lastSyncedUpdatedAt: live.updatedAt ?? null,
        signature,
        syncedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
}

export function describeVersionTransition({ previousState, live, liveSignature, snapshotSignature }) {
  const previousVersionId = previousState?.lastSyncedVersionId ?? null;
  const previousUpdatedAt = previousState?.lastSyncedUpdatedAt ?? null;
  const liveVersionId = live?.versionId ?? null;
  const liveUpdatedAt = live?.updatedAt ?? null;
  const drift = snapshotSignature !== liveSignature;
  const versionMoved =
    previousVersionId != null && liveVersionId != null && previousVersionId !== liveVersionId;
  const updatedAtMoved =
    previousUpdatedAt != null && liveUpdatedAt != null && previousUpdatedAt !== liveUpdatedAt;
  const manualEdit = Boolean(previousState && (versionMoved || updatedAtMoved));
  let reason = "in-sync";
  if (drift && manualEdit) reason = "version-moved-with-content-drift";
  else if (drift) reason = "content-drift";
  else if (manualEdit) reason = "version-moved-without-content-drift";

  return {
    drift,
    manualEdit,
    needsAttention: drift || manualEdit,
    reason,
    previousVersionId,
    previousUpdatedAt,
    liveVersionId,
    liveUpdatedAt,
  };
}

function readLastVersionHistoryRecord() {
  try {
    const lines = fs.readFileSync(VERSION_HISTORY_PATH, "utf8").trim().split(/\r?\n/).filter(Boolean);
    if (!lines.length) return null;
    return JSON.parse(lines.at(-1));
  } catch {
    return null;
  }
}

function appendVersionHistory(record) {
  fs.mkdirSync(GUARD_DIR, { recursive: true });
  const last = readLastVersionHistoryRecord();
  if (
    last?.liveVersionId === record.liveVersionId &&
    last?.liveUpdatedAt === record.liveUpdatedAt &&
    last?.signature === record.signature
  ) {
    return false;
  }
  fs.appendFileSync(VERSION_HISTORY_PATH, `${JSON.stringify(record)}\n`);
  return true;
}

function writeReport(result, prevState) {
  fs.mkdirSync(GUARD_DIR, { recursive: true });
  const reportPath = `${GUARD_DIR}/last-sync-${Date.now()}.json`;
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        syncedAt: new Date().toISOString(),
        manualEdit: result.manualEdit,
        drift: result.drift,
        reason: result.reason,
        live: result.live,
        previousState: prevState,
        snapshotUpdated: result.snapshotUpdated,
        mirrorsUpdated: result.mirrorsUpdated,
        changedNodes: result.changedNodes,
        versionTransition: result.versionTransition,
      },
      null,
      2,
    )}\n`,
  );
  return reportPath;
}

/**
 * @param {{ mode?: "sync"|"check", quiet?: boolean }} [opts]
 */
export async function runGuard(opts = {}) {
  const mode = opts.mode ?? "sync";
  const result = {
    workflowId: WORKFLOW_ID,
    ok: true,
    drift: false,
    manualEdit: false,
    snapshotUpdated: false,
    mirrorsUpdated: [],
    changedNodes: [],
    live: null,
    previousLive: null,
    reason: null,
    needsAttention: false,
    versionTransition: null,
    versionHistoryPath: VERSION_HISTORY_PATH,
    versionHistoryUpdated: false,
    state: null,
    error: null,
  };

  let live;
  try {
    live = await n8nGet(`/api/v1/workflows/${WORKFLOW_ID}`);
  } catch (e) {
    result.ok = false;
    result.error = e.message;
    return result; // rede/auth falhou — caller decide (hook nunca bloqueia)
  }

  const liveSig = meaningfulSignature(live);
  result.live = { versionId: live.versionId ?? null, updatedAt: live.updatedAt ?? null, active: live.active ?? null };

  const prevState = loadState();
  const snapshotExists = fs.existsSync(SNAPSHOT_PATH);
  const snapshot = snapshotExists ? JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8")) : { nodes: [], connections: {} };
  const snapSig = snapshotExists ? meaningfulSignature(snapshot) : null;
  const transition = describeVersionTransition({
    previousState: prevState,
    live,
    liveSignature: liveSig,
    snapshotSignature: snapSig,
  });

  // Drift = a versão ao vivo difere do snapshot local (o último export do projeto).
  result.drift = transition.drift;
  // Edição manual = versionId ao vivo mudou desde o último sync registrado pelo guard.
  result.manualEdit = transition.manualEdit;
  result.needsAttention = transition.needsAttention;
  result.reason = transition.reason;
  result.previousLive = {
    versionId: transition.previousVersionId,
    updatedAt: transition.previousUpdatedAt,
  };
  result.versionTransition = transition;

  if (result.drift) {
    result.changedNodes = changedNodes(snapshot, live);
  }

  if (!result.drift) {
    // Já em sincronia de conteúdo. Se a versão/updatedAt moveu, ainda registra
    // relatório para que hooks avisem que a base ao vivo mudou.
    if (mode === "sync") {
      result.versionHistoryUpdated = appendVersionHistory({
        recordedAt: new Date().toISOString(),
        workflowId: WORKFLOW_ID,
        event: result.manualEdit ? "version-moved-without-content-drift" : "in-sync",
        previousVersionId: transition.previousVersionId,
        previousUpdatedAt: transition.previousUpdatedAt,
        liveVersionId: transition.liveVersionId,
        liveUpdatedAt: transition.liveUpdatedAt,
        active: live.active ?? null,
        signature: liveSig,
      });
      if (result.manualEdit) result.reportPath = writeReport(result, prevState);
      writeState(live, liveSig);
    }
    result.state = "in-sync";
    return result;
  }

  if (mode === "check") {
    result.state = "drift-detected";
    return result; // sem escrita; CLI sinaliza exit 3
  }

  // mode === "sync": re-exporta snapshot + re-sincroniza espelhos a partir do AO VIVO.
  const mirrors = discoverMirrors(snapshotExists ? snapshot : live);
  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
  fs.writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(live, null, 2)}\n`);
  result.snapshotUpdated = true;

  const liveCodeByName = new Map(
    (live.nodes ?? [])
      .filter((n) => typeof n.parameters?.jsCode === "string")
      .map((n) => [n.name, n.parameters.jsCode]),
  );
  for (const m of mirrors) {
    const liveCode = liveCodeByName.get(m.nodeName);
    if (liveCode == null) continue; // nó sumiu ao vivo — relatado em changedNodes
    const before = fs.existsSync(m.file) ? fs.readFileSync(m.file, "utf8") : "";
    if (trimEnd(before) === trimEnd(liveCode)) continue; // espelho já bate
    // Preserva newline final no estilo do arquivo original.
    const out = liveCode.endsWith("\n") ? liveCode : `${liveCode}\n`;
    fs.writeFileSync(m.file, out);
    result.mirrorsUpdated.push({ file: m.file, nodeName: m.nodeName });
  }

  result.versionHistoryUpdated = appendVersionHistory({
    recordedAt: new Date().toISOString(),
    workflowId: WORKFLOW_ID,
    event: result.reason,
    previousVersionId: transition.previousVersionId,
    previousUpdatedAt: transition.previousUpdatedAt,
    liveVersionId: transition.liveVersionId,
    liveUpdatedAt: transition.liveUpdatedAt,
    active: live.active ?? null,
    signature: liveSig,
    snapshotUpdated: result.snapshotUpdated,
    mirrorsUpdated: result.mirrorsUpdated,
    changedNodes: result.changedNodes,
  });
  // Relatório de drift + novo carimbo de estado.
  result.reportPath = writeReport(result, prevState);
  writeState(live, liveSig);
  result.state = "synced";
  return result;
}

function summarize(r) {
  if (!r.ok) return `n8n live-guard: NÃO foi possível checar (${r.error}). Prosseguindo sem sync.`;
  if (!r.needsAttention) return `n8n live-guard: em sincronia com a versão ao vivo (${r.live.versionId}).`;
  if (!r.drift && r.manualEdit) {
    return `n8n live-guard: versão ao vivo mudou (${r.previousLive?.versionId ?? "?"} → ${r.live.versionId}), mas o snapshot já está alinhado. RE-LEIA os arquivos antes de patch/analisar.`;
  }
  const nodes = r.changedNodes.map((c) => `${c.name}(${c.kind})`).join(", ");
  const mirrors = r.mirrorsUpdated.map((m) => path.basename(m.file)).join(", ") || "nenhum";
  const lead = r.manualEdit ? "EDIÇÃO MANUAL detectada na versão ao vivo" : "DRIFT detectado vs snapshot";
  if (r.state === "drift-detected") {
    return `n8n live-guard: ${lead}. Nós alterados: ${nodes || "?"}. Rode o sync antes de patch/analisar.`;
  }
  return `n8n live-guard: ${lead} → snapshot re-exportado e espelhos ressincronizados (${mirrors}). Nós alterados ao vivo: ${nodes || "?"}. RE-LEIA os arquivos antes de aplicar patches.`;
}

// CLI
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const argv = process.argv.slice(2);
  const mode = argv.includes("--check") ? "check" : "sync";
  const asJson = argv.includes("--json");
  const quiet = argv.includes("--quiet");
  const r = await runGuard({ mode, quiet });
  if (asJson) {
    console.log(JSON.stringify(r, null, 2));
  } else if (!quiet || r.drift || !r.ok) {
    console.log(summarize(r));
  }
  // exit codes: 0 ok/sincronizado; 2 erro de rede/auth; 3 drift em --check.
  if (!r.ok) process.exit(2);
  if (mode === "check" && r.drift) process.exit(3);
}
