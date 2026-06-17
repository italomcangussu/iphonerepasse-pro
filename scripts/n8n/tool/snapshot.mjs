// ============================================================================
// snapshot.mjs — hash do conteúdo de cada alvo + detecção de drift. Lógica pura.
// ============================================================================

import crypto from "node:crypto";

const trimEnd = (s) =>
  String(s ?? "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\s+$/, "");

export const sha256 = (s) => crypto.createHash("sha256").update(trimEnd(s)).digest("hex");

/** Constrói { node → sha } a partir dos targets extraídos. */
export function buildSnapshot(targets) {
  const map = {};
  for (const t of targets) map[t.node] = sha256(t.content);
  return map;
}

/**
 * detectDrift(old, fresh, editedNames): nodes que VOCÊ editou local E que mudaram
 * no vivo desde o último pull. Se houver, o deploy deve RECUSAR (anti-sobrescrita).
 * @param {Record<string,string>} oldSnap  snapshot do último pull
 * @param {Record<string,string>} freshSnap snapshot do GET fresco do vivo
 * @param {Set<string>} editedNames nodes com edição local pendente
 */
export function detectDrift(oldSnap, freshSnap, editedNames) {
  const conflicts = [];
  for (const name of editedNames) {
    const before = oldSnap?.[name];
    const after = freshSnap?.[name];
    if (before !== undefined && after !== undefined && before !== after) {
      conflicts.push(name);
    }
  }
  return conflicts;
}
