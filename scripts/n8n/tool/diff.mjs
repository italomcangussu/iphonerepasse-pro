// ============================================================================
// diff.mjs — diff de linhas simples (LCS), sem dependências. Usado pelo dry-run
// do deploy para mostrar O QUE muda em cada node, não só o nome. Lógica pura.
// ============================================================================

const splitLines = (s) => String(s ?? "").replace(/\r\n/g, "\n").split("\n");

/** Matriz LCS clássica entre dois arrays de linhas. */
function lcsTable(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  return dp;
}

/**
 * textDiff(oldStr, newStr) → string estilo unified simplificado:
 *   "  linha igual" / "- removida" / "+ adicionada".
 * Determinístico; linhas iguais consecutivas são mantidas como contexto.
 */
export function textDiff(oldStr, newStr) {
  const a = splitLines(oldStr);
  const b = splitLines(newStr);
  const dp = lcsTable(a, b);
  const out = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push(`  ${a[i]}`);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push(`- ${a[i]}`);
      i++;
    } else {
      out.push(`+ ${b[j]}`);
      j++;
    }
  }
  while (i < a.length) out.push(`- ${a[i++]}`);
  while (j < b.length) out.push(`+ ${b[j++]}`);
  return out.join("\n");
}

/** Conta linhas adicionadas/removidas a partir do diff (para um resumo curto). */
export function diffStat(oldStr, newStr) {
  let added = 0;
  let removed = 0;
  for (const line of textDiff(oldStr, newStr).split("\n")) {
    if (line.startsWith("+ ")) added++;
    else if (line.startsWith("- ")) removed++;
  }
  return { added, removed };
}

/** Só as linhas que mudaram (+/-), com algumas de contexto ao redor de cada bloco. */
export function compactDiff(oldStr, newStr, context = 2) {
  const lines = textDiff(oldStr, newStr).split("\n");
  const keep = new Array(lines.length).fill(false);
  for (let k = 0; k < lines.length; k++) {
    if (lines[k].startsWith("+ ") || lines[k].startsWith("- ")) {
      for (let d = -context; d <= context; d++) {
        const idx = k + d;
        if (idx >= 0 && idx < lines.length) keep[idx] = true;
      }
    }
  }
  const out = [];
  let skipping = false;
  for (let k = 0; k < lines.length; k++) {
    if (keep[k]) {
      out.push(lines[k]);
      skipping = false;
    } else if (!skipping) {
      out.push("  …");
      skipping = true;
    }
  }
  return out.join("\n");
}
