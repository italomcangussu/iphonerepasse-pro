// ============================================================================
// legacy-sync.mjs — escritor ÚNICO dos artefatos LEGADOS derivados do vivo
// (Fase 5 — fonte canônica única). Tanto o CLI `pull` quanto o guard usam ESTA
// função, então os dois caminhos não podem mais divergir.
//
// Artefatos legados (derivados, NÃO canônicos):
//   - output/n8n/ia-repasse-pro-v2-current.json  (snapshot lido por ~34 patches
//     no modo DRY e pelo export); é uma cópia do workflow vivo.
//   - scripts/n8n/repasse-code-*.js              (espelhos byte-exatos do jsCode
//     de alguns Code nodes, usados como fonte por alguns patches).
//
// A fonte CANÔNICA é a árvore versionada n8n/<slug>/ (workflow.json + nodes/*).
// Estes artefatos existem só para compatibilidade com os patches legados; quando
// todos migrarem para o patch-kit + árvore canônica, podem ser removidos.
// ============================================================================

import fs from "node:fs";
import path from "node:path";
import { CONFIG } from "./config.mjs";

const SCRIPTS_DIR = "scripts/n8n";

const trimEnd = (s) =>
  String(s ?? "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\s+$/, "");

/**
 * Auto-descoberta de espelhos: arquivo scripts/n8n/*.js cujo conteúdo bate
 * byte-a-byte com o jsCode de exatamente UM Code node do snapshot de referência
 * (last-known-good). Colisões são ignoradas. Mesma lógica histórica do guard.
 */
export function discoverMirrors(referenceWorkflow, scriptsDir = SCRIPTS_DIR) {
  const codeNodes = (referenceWorkflow.nodes ?? []).filter(
    (n) => n.type === "n8n-nodes-base.code" && typeof n.parameters?.jsCode === "string",
  );
  const byCode = new Map();
  for (const n of codeNodes) {
    const key = trimEnd(n.parameters.jsCode);
    if (byCode.has(key)) byCode.set(key, null); // colisão → ambíguo
    else byCode.set(key, n.name);
  }
  const mirrors = [];
  if (!fs.existsSync(scriptsDir)) return mirrors;
  for (const file of fs.readdirSync(scriptsDir)) {
    if (!file.endsWith(".js")) continue;
    const full = `${scriptsDir}/${file}`;
    const content = trimEnd(fs.readFileSync(full, "utf8"));
    const nodeName = byCode.get(content);
    if (nodeName) mirrors.push({ file: full, nodeName });
  }
  return mirrors;
}

/**
 * Reescreve o snapshot legado e ressincroniza os espelhos a partir do `live`.
 * A descoberta de espelhos usa o snapshot ANTERIOR (last-known-good) para casar
 * o arquivo mesmo quando o código vivo já mudou. Retorna o que foi atualizado.
 */
export function syncLegacyArtifacts(live, opts = {}) {
  const snapshotPath = opts.snapshotPath ?? CONFIG.LIVE_SNAPSHOT;
  const scriptsDir = opts.scriptsDir ?? SCRIPTS_DIR;

  const prior = fs.existsSync(snapshotPath)
    ? JSON.parse(fs.readFileSync(snapshotPath, "utf8"))
    : null;
  const mirrors = discoverMirrors(prior ?? live, scriptsDir);

  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.writeFileSync(snapshotPath, `${JSON.stringify(live, null, 2)}\n`);

  const liveCodeByName = new Map(
    (live.nodes ?? [])
      .filter((n) => typeof n.parameters?.jsCode === "string")
      .map((n) => [n.name, n.parameters.jsCode]),
  );
  const mirrorsUpdated = [];
  for (const m of mirrors) {
    const liveCode = liveCodeByName.get(m.nodeName);
    if (liveCode == null) continue; // node sumiu ao vivo
    const before = fs.existsSync(m.file) ? fs.readFileSync(m.file, "utf8") : "";
    if (trimEnd(before) === trimEnd(liveCode)) continue; // já bate
    fs.writeFileSync(m.file, liveCode.endsWith("\n") ? liveCode : `${liveCode}\n`);
    mirrorsUpdated.push({ file: m.file, nodeName: m.nodeName });
  }
  return { snapshotPath, snapshotUpdated: true, mirrorsUpdated };
}
