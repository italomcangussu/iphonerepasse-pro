// Testes puros do diff de linhas (Fase 3).
import { test } from "node:test";
import assert from "node:assert/strict";
import { textDiff, diffStat, compactDiff } from "../diff.mjs";

test("textDiff: sem mudança → só linhas de contexto", () => {
  const s = "a\nb\nc";
  assert.equal(textDiff(s, s), "  a\n  b\n  c");
  assert.deepEqual(diffStat(s, s), { added: 0, removed: 0 });
});

test("textDiff: linha trocada vira -antiga +nova", () => {
  const d = textDiff("a\nb\nc", "a\nB\nc");
  assert.ok(d.includes("- b"));
  assert.ok(d.includes("+ B"));
  assert.deepEqual(diffStat("a\nb\nc", "a\nB\nc"), { added: 1, removed: 1 });
});

test("textDiff: inserção pura", () => {
  assert.deepEqual(diffStat("a\nc", "a\nb\nc"), { added: 1, removed: 0 });
  const d = textDiff("a\nc", "a\nb\nc");
  assert.equal(d, "  a\n+ b\n  c");
});

test("textDiff: remoção pura", () => {
  assert.deepEqual(diffStat("a\nb\nc", "a\nc"), { added: 0, removed: 1 });
});

test("textDiff: normaliza CRLF", () => {
  assert.equal(diffStat("a\r\nb", "a\nb").added, 0);
});

test("compactDiff: elide blocos sem mudança com reticências", () => {
  const oldStr = Array.from({ length: 20 }, (_, i) => `l${i}`).join("\n");
  const newStr = oldStr.replace("l10", "l10x");
  const c = compactDiff(oldStr, newStr, 1);
  assert.ok(c.includes("- l10"));
  assert.ok(c.includes("+ l10x"));
  assert.ok(c.includes("…"), "elide as linhas distantes");
  assert.ok(!c.includes("  l0"), "linha distante não aparece");
});
