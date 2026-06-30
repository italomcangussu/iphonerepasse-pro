// ============================================================================
// config.mjs — CONFIG da instância-alvo (ver docs/n8n-maintainability-recipe.md).
//
// Adaptado ao repo iPhoneRepasse Pro:
//  - linguagem JS/.mjs (não Python) para casar com o toolchain existente
//    (guard-live-workflow-sync.mjs, export-repasse-workflow.mjs, patches);
//  - stage por POSIÇÃO (sem renomear nodes no canvas vivo) — ver stages.json.
// ============================================================================

import path from "node:path";

export const CONFIG = {
  WORKFLOW_ID: "Cr4fPWe0prwS6XjI", // "ia repasse-pro v2 avancada"
  API_HEADER: "X-N8N-API-KEY",
  ENV_FILE: ".env.local",
  // Duas chaves — só a chave de API da conta serve para a REST API (PUT/GET).
  ENV_KEYS: ["N8N_API_KEY", "N8N_PUBLIC_API"], // ordem de fallback
  BASE_URL_KEYS: ["N8N_BASE_URL", "N8N_MCP_URL"],
  FALLBACK_ORIGIN: "https://iatende-n8n.ylgf5w.easypanel.host",
  BASE_DIR: "n8n/ia-repasse-pro-v2",
  FETCH_TIMEOUT_MS: 15_000,
  // Snapshot do guard usado como entrada de DRY pelos patch scripts.
  LIVE_SNAPSHOT: "output/n8n/ia-repasse-pro-v2-current.json",
  BACKUPS_DIR: "output/n8n/backups",
  // Retenção: nº de backups a manter POR rótulo de patch (env BACKUP_KEEP sobrepõe).
  BACKUP_KEEP: Number(process.env.BACKUP_KEEP ?? 20),
};

export const paths = {
  base: CONFIG.BASE_DIR,
  workflowJson: path.join(CONFIG.BASE_DIR, "workflow.json"),
  importJson: path.join(CONFIG.BASE_DIR, "workflow.import.json"),
  contextJson: path.join(CONFIG.BASE_DIR, "workflow-context.json"),
  manifest: path.join(CONFIG.BASE_DIR, "manifest.md"),
  stagesConfig: path.join(CONFIG.BASE_DIR, "stages.json"),
  nodes: path.join(CONFIG.BASE_DIR, "nodes"),
  codeDir: path.join(CONFIG.BASE_DIR, "nodes", "code"),
  promptsDir: path.join(CONFIG.BASE_DIR, "nodes", "prompts"),
  snapshot: path.join(CONFIG.BASE_DIR, "nodes", ".snapshot.json"),
  backupsDir: CONFIG.BACKUPS_DIR,
  liveSnapshot: CONFIG.LIVE_SNAPSHOT,
};
