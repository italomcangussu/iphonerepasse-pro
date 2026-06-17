#!/usr/bin/env node
// ============================================================================
// repasse-maint.mjs — CLI de manutenibilidade do workflow n8n vivo
// `Cr4fPWe0prwS6XjI` ("ia repasse-pro v2 avancada").
//
// Princípio: o workflow VIVO é a fonte canônica. Nunca edite o JSON inteiro na
// mão; edite por NODE; sempre `pull` antes e re-sincronize depois.
//
//   node scripts/n8n/repasse-maint.mjs pull             # GET vivo → workflow.json + nodes/ + manifest + snapshot
//   node scripts/n8n/repasse-maint.mjs status           # nodes com edição local pendente
//   node scripts/n8n/repasse-maint.mjs build            # remonta workflow.json (valida estrutura + JS)
//   node scripts/n8n/repasse-maint.mjs deploy           # DRY-RUN: re-puxa, checa drift, valida, mostra diff
//   node scripts/n8n/repasse-maint.mjs deploy --confirm # PUT + reativa + re-sync
//
// Ver docs/n8n-maintainability-recipe.md e n8n/ia-repasse-pro-v2/manifest.md.
// ============================================================================

import { pull, status, build, deploy } from "./tool/commands.mjs";

const [cmd, ...rest] = process.argv.slice(2);

function out(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

try {
  switch (cmd) {
    case "pull": {
      const r = await pull();
      console.log(`pull OK — versionId ${r.versionId}, ${r.nodeCount} nodes, ${r.extractedFiles} arquivos extraídos.`);
      if (r.expressionPrompts.length) {
        console.log(`Prompts-expressão (editar no workflow.json, NÃO viram arquivo): ${r.expressionPrompts.join(", ")}`);
      }
      break;
    }
    case "status": {
      const details = status();
      if (!details.length) {
        console.log("status: nada pendente (arquivos batem com workflow.json).");
      } else {
        console.log(`status: ${details.length} node(s) com edição local pendente:`);
        for (const d of details) console.log(`  - [${d.kind}] ${d.node}  (${d.file})`);
      }
      break;
    }
    case "build": {
      const r = build();
      if (!r.ok) {
        console.error("build FALHOU:");
        for (const e of r.errors) console.error(`  - ${e}`);
        process.exit(1);
      }
      console.log(`build OK — ${r.applied.length} edição(ões) aplicada(s) ao workflow.json local.`);
      break;
    }
    case "deploy": {
      const confirm = rest.includes("--confirm");
      const r = await deploy({ confirm });
      if (r.nothingToSend) {
        console.log("deploy: nada a enviar (sem edições locais).");
        break;
      }
      if (!r.ok) {
        console.error(`deploy ABORTADO (${r.reason}):`);
        if (r.message) console.error(`  ${r.message}`);
        for (const e of r.errors ?? []) console.error(`  - ${e}`);
        process.exit(1);
      }
      if (r.dryRun) {
        console.log(`deploy (DRY-RUN) OK — ${r.applied.length} edição(ões) prontas sobre o vivo v${r.freshVersionId}:`);
        for (const d of r.applied) console.log(`  - [${d.kind}] ${d.node}`);
        console.log("Revise e rode novamente com --confirm para enviar.");
        break;
      }
      console.log(`deploy --confirm OK — nova versionId ${r.newVersionId}.`);
      console.log(`  backup: ${r.backup}`);
      console.log(`  reativado: ${r.activated}`);
      for (const d of r.applied) console.log(`  - [${d.kind}] ${d.node}`);
      break;
    }
    default:
      console.log("Uso: node scripts/n8n/repasse-maint.mjs <pull|status|build|deploy [--confirm]>");
      if (cmd) {
        out({ erro: `comando desconhecido: ${cmd}` });
        process.exit(1);
      }
  }
} catch (e) {
  console.error(`ERRO: ${e.message}`);
  process.exit(1);
}
