#!/usr/bin/env node
// ============================================================================
// n8n-live-guard-hook.mjs — adaptador PreToolUse (Bash) para o Claude Code.
//
// Gatilho AUTOMÁTICO INTELIGENTE: sempre que o Claude (ou qualquer agente que
// use este harness) for rodar um comando Bash que ANALISA ou ALTERA o workflow
// ao vivo n8n `Cr4fPWe0prwS6XjI`, este hook roda ANTES e:
//   - reconhece se houve edição manual na versão ao vivo desde o último sync;
//   - re-exporta o snapshot e ressincroniza os espelhos do projeto;
//   - injeta um aviso (additionalContext) para o modelo re-ler os arquivos
//     antes de aplicar patches — evitando regressões.
//
// É NÃO-BLOQUEANTE por design: nunca aborta o comando do usuário. Se o guard
// falhar (rede/auth), apenas avisa e segue. Comandos não relacionados ao n8n
// passam direto (no-op instantâneo).
//
// Registrado em .claude/settings.json e .codex/hooks.json como hook PreToolUse
// de matcher "Bash".
// ============================================================================

import { runGuard } from "../guard-live-workflow-sync.mjs";

// Heurística de relevância: o comando toca o workflow ao vivo?
function touchesLiveWorkflow(command) {
  if (!command || typeof command !== "string") return false;
  const c = command;
  if (c.includes("Cr4fPWe0prwS6XjI")) return true; // id do workflow ao vivo
  if (/\/api\/v1\/workflows/.test(c)) return true; // REST direto
  // scripts do projeto que leem/patcham/validam/exportam o workflow ao vivo:
  if (/scripts\/n8n\/(patch-|apply-|export-|build-|validate-|smoke-|canary-|replay-)/.test(c)) {
    // Evita auto-disparo recursivo do próprio guard.
    if (c.includes("guard-live-workflow-sync")) return false;
    return true;
  }
  return false;
}

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    if (process.stdin.isTTY) return resolve("");
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    // Salvaguarda: se nada chegar em 2s, segue vazio.
    setTimeout(() => resolve(data), 2000).unref?.();
  });
}

function emit(additionalContext) {
  if (additionalContext) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          additionalContext,
        },
      }),
    );
  }
  process.exit(0); // sempre permite o comando
}

try {
  const raw = await readStdin();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    /* stdin malformado — trata como no-op */
  }
  const command = payload?.tool_input?.command ?? "";

  if (!touchesLiveWorkflow(command)) emit(null);

  const r = await runGuard({ mode: "sync", quiet: true });

  if (!r.ok) {
    emit(`⚠️ n8n live-guard: não consegui verificar a versão ao vivo (${r.error}). Prossiga com cautela — o snapshot/espelhos podem estar defasados.`);
  }
  if (!r.needsAttention) {
    emit(null); // em sincronia: silencioso, sem poluir o contexto
  }

  const nodes = r.changedNodes.map((c) => `${c.name} (${c.kind})`).join(", ");
  const mirrors = r.mirrorsUpdated.map((m) => m.file).join(", ") || "nenhum espelho .js afetado";
  const versionLine = r.previousLive?.versionId
    ? `Versão ao vivo: ${r.previousLive.versionId} (${r.previousLive.updatedAt ?? "sem updatedAt"}) → ${r.live.versionId} (${r.live.updatedAt ?? "sem updatedAt"}).\n`
    : `Versão ao vivo: ${r.live.versionId} (${r.live.updatedAt ?? "sem updatedAt"}).\n`;
  const lead = r.manualEdit
    ? "EDIÇÃO MANUAL detectada na versão ao vivo desde o último sync"
    : "DRIFT detectado entre a versão ao vivo e o snapshot do projeto";
  const action = r.snapshotUpdated
    ? `Ação automática: snapshot RE-EXPORTADO (${"output/n8n/ia-repasse-pro-v2-current.json"}) e espelhos ressincronizados (${mirrors}).\n`
    : `Ação automática: snapshot já estava alinhado; histórico de versão atualizado em ${r.versionHistoryPath ?? "output/n8n/.live-guard/version-history.jsonl"}.\n`;
  emit(
    `🔄 n8n live-guard: ${lead}.\n` +
      versionLine +
      action +
      `Nós alterados ao vivo: ${nodes || "(metadados/conexões)"}.\n` +
      `IMPORTANTE: re-leia os arquivos espelho/snapshot afetados antes de aplicar qualquer patch — a base mudou por fora do projeto. Relatório: ${r.reportPath ?? "output/n8n/.live-guard/"}.`,
  );
} catch (e) {
  // Resiliência total: qualquer erro inesperado vira aviso não-bloqueante.
  emit(`⚠️ n8n live-guard: erro interno (${e?.message ?? e}). Comando liberado sem sync.`);
}
