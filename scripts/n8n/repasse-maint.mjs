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

import { pull, status, build, deploy, runTests, editPrompt } from "./tool/commands.mjs";

const [cmd, ...rest] = process.argv.slice(2);

/** Extrai `--flag valor` de um array de args; devolve o valor (string) ou undefined. */
function flagValue(args, name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
}

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
    case "edit-prompt": {
      const node = rest.find((a) => !a.startsWith("--"));
      const anchor = flagValue(rest, "--anchor");
      const to = flagValue(rest, "--to");
      const dry = !rest.includes("--confirm"); // dry por padrão; --confirm envia
      const r = await editPrompt({ node, anchor, to, dry });
      if (!r.ok) {
        console.error(`edit-prompt ABORTADO (${r.reason}): ${r.message ?? ""}`);
        for (const e of r.errors ?? []) console.error(`  - ${e}`);
        process.exit(1);
      }
      if (r.dry) {
        console.log(`edit-prompt (DRY) — ${r.node}.${r.field}${r.expression ? " [expressão]" : ""} (+${r.stat.added}/-${r.stat.removed}):`);
        for (const line of r.diff.split("\n")) console.log(`  ${line}`);
        console.log("Revise e rode com --confirm para enviar.");
        break;
      }
      console.log(`edit-prompt --confirm OK — ${r.node}.${r.field} (+${r.stat.added}/-${r.stat.removed}); nova versionId ${r.newVersionId}; reativado: ${r.finalActive}.`);
      break;
    }
    case "test": {
      const r = runTests();
      process.stdout.write(r.output);
      console.log(r.ok ? "test OK — rede de testes verde." : `test FALHOU (exit ${r.status}).`);
      process.exit(r.ok ? 0 : 1);
      break;
    }
    case "deploy": {
      const confirm = rest.includes("--confirm");
      const skipTests = rest.includes("--skip-tests");
      const r = await deploy({ confirm, skipTests });
      if (r.nothingToSend) {
        console.log("deploy: nada a enviar (sem edições locais).");
        break;
      }
      if (!r.ok) {
        console.error(`deploy ABORTADO (${r.reason}):`);
        if (r.reason === "tests") {
          process.stderr.write(r.testOutput ?? "");
          console.error("  Rede de testes vermelha — corrija antes de --confirm (ou use --skip-tests por sua conta e risco).");
        }
        if (r.message) console.error(`  ${r.message}`);
        for (const e of r.errors ?? []) console.error(`  - ${e}`);
        process.exit(1);
      }
      if (r.dryRun) {
        const testLine = r.testsSkipped ? "testes PULADOS (--skip-tests)" : r.testsOk ? "testes verdes" : "testes VERMELHOS — corrija antes de --confirm";
        console.log(`deploy (DRY-RUN) OK — ${r.applied.length} edição(ões) prontas sobre o vivo v${r.freshVersionId} [${testLine}]:`);
        const diffByNode = new Map((r.diffs ?? []).map((d) => [d.node, d]));
        for (const d of r.applied) {
          const dd = diffByNode.get(d.node);
          const stat = dd ? ` (+${dd.stat.added}/-${dd.stat.removed})` : "";
          console.log(`  - [${d.kind}] ${d.node}${stat}`);
          if (dd?.diff) for (const line of dd.diff.split("\n")) console.log(`      ${line}`);
        }
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
      console.log("Uso: node scripts/n8n/repasse-maint.mjs <pull|status|build|test|deploy [--confirm] [--skip-tests]|edit-prompt <node> --anchor <txt> --to <txt> [--confirm]>");
      if (cmd) {
        out({ erro: `comando desconhecido: ${cmd}` });
        process.exit(1);
      }
  }
} catch (e) {
  console.error(`ERRO: ${e.message}`);
  process.exit(1);
}
