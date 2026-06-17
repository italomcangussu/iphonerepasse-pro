// ============================================================================
// manifest.mjs — renderiza o manifest.md: receita de edição + tabela node→arquivo
// por stage + lista de conexões. É o mapa que um agente novo lê primeiro.
// ============================================================================

const CHECKLIST = `## Checklist por alteração

- [ ] \`pull\` antes de editar (sem drift).
- [ ] Editei por NODE (\`nodes/code/*.js\` ou \`nodes/prompts/*.md\`); prompt-expressão via \`systemMessage\` no \`workflow.json\`.
- [ ] Testes de invariantes verdes + teste do node editado verde (\`node --test scripts/n8n/tool/tests/\`).
- [ ] \`deploy\` (dry-run) revisado no diff.
- [ ] PUT: settings só com allowlist, \`timeSavedMode\` removido, credential refs intactas.
- [ ] \`deploy --confirm\` + reativação + re-sync (versionId novo).
- [ ] Commit com rodapé de co-autoria.`;

export function renderManifest({ workflow, planned, bands, expressionPrompts }) {
  const lines = [];
  lines.push("# Manifesto — ia repasse-pro v2 avancada (workflow vivo `Cr4fPWe0prwS6XjI`)");
  lines.push("");
  lines.push("> Gerado por `scripts/n8n/repasse-maint.mjs pull`. NÃO edite à mão — re-gerado a cada pull.");
  lines.push("> **Fonte canônica é o workflow VIVO.** Sempre `pull` antes de editar; `deploy` compõe sobre o vivo fresco.");
  lines.push("");
  lines.push("## Como editar");
  lines.push("");
  lines.push("1. `node scripts/n8n/repasse-maint.mjs pull` — sincroniza e decompõe.");
  lines.push("2. Edite **um** arquivo em `nodes/code/` (JS) ou `nodes/prompts/` (prompt estático). Edite só o corpo abaixo da sentinela.");
  lines.push("3. Prompt montado por **expressão** (`=…`) NÃO vira arquivo — edite `parameters.options.systemMessage` no `workflow.json` por âncora. Ver lista abaixo.");
  lines.push("4. `node scripts/n8n/repasse-maint.mjs status` — confira o que mudou.");
  lines.push("5. `node --test scripts/n8n/tool/tests/` — invariantes + nodes verdes.");
  lines.push("6. `node scripts/n8n/repasse-maint.mjs deploy` (dry-run) → revise o diff.");
  lines.push("7. `node scripts/n8n/repasse-maint.mjs deploy --confirm` → PUT + reativa + re-sync.");
  lines.push("");
  lines.push(CHECKLIST);
  lines.push("");

  // Prompts-expressão (vivem no workflow.json)
  if (expressionPrompts.length) {
    lines.push("## Prompts montados por expressão (editar no `workflow.json`, NÃO viram arquivo)");
    lines.push("");
    lines.push("| node | campo |");
    lines.push("| --- | --- |");
    for (const p of expressionPrompts) lines.push(`| ${p.node} | ${p.field} |`);
    lines.push("");
  }

  // Tabela node→arquivo por stage
  lines.push("## Nodes extraídos por stage");
  lines.push("");
  const byStage = new Map();
  for (const t of planned) {
    const key = `${t.stage.id} ${t.stage.label}`;
    if (!byStage.has(key)) byStage.set(key, []);
    byStage.get(key).push(t);
  }
  const stageKeys = [...byStage.keys()].sort();
  for (const key of stageKeys) {
    lines.push(`### ${key}`);
    lines.push("");
    lines.push("| arquivo | node | tipo |");
    lines.push("| --- | --- | --- |");
    for (const t of byStage.get(key)) {
      const dir = t.kind === "code" ? "code" : "prompts";
      lines.push(`| \`nodes/${dir}/${t.filename}\` | ${t.node} | ${t.kind} |`);
    }
    lines.push("");
  }

  // Faixas de stage (config)
  lines.push("## Faixas de stage (de `stages.json`, por posição x do canvas)");
  lines.push("");
  lines.push("| stage | faixa x | rótulo |");
  lines.push("| --- | --- | --- |");
  for (const b of [...bands].sort((a, b2) => a.xMin - b2.xMin)) {
    const xmax = b.xMax === Infinity || b.xMax >= 1e9 ? "∞" : b.xMax;
    lines.push(`| ${b.id} | ${b.xMin}–${xmax} | ${b.label} |`);
  }
  lines.push("");

  // Conexões
  lines.push("## Conexões (origem → destinos)");
  lines.push("");
  const conns = workflow.connections ?? {};
  for (const source of Object.keys(conns).sort()) {
    const targets = new Set();
    for (const groups of Object.values(conns[source] ?? {})) {
      for (const group of groups ?? []) for (const link of group ?? []) if (link) targets.add(link.node);
    }
    lines.push(`- **${source}** → ${[...targets].join(", ") || "(nenhum)"}`);
  }
  lines.push("");
  return lines.join("\n");
}
