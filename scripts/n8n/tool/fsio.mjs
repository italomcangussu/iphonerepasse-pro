// ============================================================================
// fsio.mjs — disco + cabeçalhos com sentinela. O header carrega node/contrato;
// strip_header remove o header ao reler, então o diff compara só o conteúdo real.
// ============================================================================

import fs from "node:fs";
import path from "node:path";

export const JS_SENTINEL = "// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====";
export const MD_SENTINEL = "<!-- ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA ===== -->";

function jsHeader(meta) {
  return [
    "// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)",
    `// node:     ${meta.node}`,
    `// type:     ${meta.type}`,
    `// field:    ${meta.field}`,
    `// stage:    ${meta.stage}`,
    "// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.",
    JS_SENTINEL,
    "",
  ].join("\n");
}

function mdHeader(meta) {
  return [
    "<!-- AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull) -->",
    `<!-- node:  ${meta.node} -->`,
    `<!-- type:  ${meta.type} -->`,
    `<!-- field: ${meta.field} -->`,
    `<!-- stage: ${meta.stage} -->`,
    MD_SENTINEL,
    "",
  ].join("\n");
}

export function withHeader(kind, meta, content) {
  const header = kind === "code" ? jsHeader(meta) : mdHeader(meta);
  const body = content.endsWith("\n") ? content : `${content}\n`;
  return header + body;
}

/**
 * Remove o header: tudo até a sentinela + APENAS o terminador da linha-sentinela.
 * Não consome newlines extras — assim um corpo que começa com `\n` é preservado
 * byte-a-byte (fidelidade do round-trip).
 */
export function stripHeader(text) {
  const sentinel = text.includes(JS_SENTINEL) ? JS_SENTINEL : text.includes(MD_SENTINEL) ? MD_SENTINEL : null;
  if (!sentinel) return text;
  const idx = text.indexOf(sentinel);
  let rest = text.slice(idx + sentinel.length);
  if (rest.startsWith("\r\n")) rest = rest.slice(2);
  else if (rest.startsWith("\n")) rest = rest.slice(1);
  return rest;
}

export function writeFileSafe(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

export function writeJson(filePath, obj) {
  writeFileSafe(filePath, `${JSON.stringify(obj, null, 2)}\n`);
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/** Lê o corpo (sem header) de um arquivo de node, ou null se ausente. */
export function readNodeBody(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return stripHeader(fs.readFileSync(filePath, "utf8")).replace(/\n+$/, "\n");
}

export function rmDirContents(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    if (entry.startsWith(".")) continue; // preserva .snapshot.json etc.
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}
