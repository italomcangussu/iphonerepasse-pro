// ============================================================================
// patch-kit.mjs — lib ÚNICA de I/O para os patch scripts cirúrgicos do workflow
// vivo `Cr4fPWe0prwS6XjI`. Substitui o boilerplate que hoje é copiado em ~65
// `scripts/n8n/patch-*.mjs` (readEnvFile, n8nFetch, backup, replaceOnce, PUT,
// activate, verify). Reusa netio.mjs (rede+segredo) e deploy_body.mjs (corpo do
// PUT à prova do schema). NUNCA imprime/loga a chave.
//
// Padrão de um patch (ver docs/n8n-maintainability-recipe.md → "patches"):
//   import * as kit from "./tool/patch-kit.mjs";
//   const wf = await kit.loadWorkflow();         // GET vivo, ou snapshot local se DRY=1
//   ... node.parameters.X = kit.replaceOnce(X, ANCHOR, BLOCK, "label") ...
//   kit.assertSyntax(code);                       // só p/ Code nodes
//   if (kit.DRY) return kit.dry(wf, "/tmp/...dry.json");
//   kit.backup(await kit.getLive(), "label");     // backup do vivo fresco
//   const verify = await kit.safePut(wf, "label");
// ============================================================================

import fs from "node:fs";
import path from "node:path";
import { CONFIG, paths } from "./config.mjs";
import { getWorkflow, putWorkflow, activateWorkflow } from "./netio.mjs";
import { buildPutBody } from "./deploy_body.mjs";

/** DRY=1 → lê a árvore canônica local e não faz PUT (igual aos patches atuais). */
export const DRY = process.env.DRY === "1";

/** GET fresco do vivo (fonte de composição e de backup). */
export const getLive = () => getWorkflow();

/**
 * Lê o workflow completo local (entrada de DRY). Fonte = árvore CANÔNICA
 * `n8n/<slug>/workflow.json` (Fase 5#4): o escritor único `pullFrom` grava esse
 * arquivo como PRIMEIRA ação do `writeFourFiles`, então ele nunca fica stale. O
 * snapshot legado `output/n8n/ia-repasse-pro-v2-current.json` (byte-idêntico)
 * deixou de ser fonte dos patches — segue só como artefato de export/validate/
 * testes. Passe `file` explicitamente para ler outro workflow completo.
 */
export function loadLocal(file = paths.workflowJson) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Carrega o workflow alvo: snapshot local em DRY, senão GET vivo. */
export async function loadWorkflow() {
  return DRY ? loadLocal() : await getLive();
}

/**
 * `.replace()` de string EXATA com guard de cardinalidade. Lança se a `needle`
 * não aparece exatamente `expected` vez(es) — evita patch silenciosamente errado.
 */
export function replaceOnce(haystack, needle, replacement, label = "replace", expected = 1) {
  const count = String(haystack).split(needle).length - 1;
  if (count !== expected) {
    throw new Error(`[${label}] esperava ${expected} ocorrência(s) da âncora, achou ${count}`);
  }
  return haystack.replace(needle, replacement);
}

/** Syntax-assert de um Code node SEM executar (mesmo truque dos patches). */
export function assertSyntax(code, label = "jsCode") {
  try {
    // eslint-disable-next-line no-new-func
    new Function(code);
  } catch (e) {
    throw new Error(`[${label}] sintaxe inválida: ${e.message}`);
  }
}

/** Escreve a saída de DRY num arquivo e devolve um resumo. Não faz rede. */
export function dry(workflow, file) {
  if (file) fs.writeFileSync(file, JSON.stringify(workflow, null, 2));
  return { dry: true, file: file ?? null };
}

/** Mantém só os `keep` backups mais recentes que casam `before-<label>-*.json`. */
export function pruneBackups(label, keep = CONFIG.BACKUP_KEEP) {
  const dir = paths.backupsDir;
  if (!fs.existsSync(dir)) return [];
  const prefix = `before-${label}-`;
  const matches = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  const removed = [];
  for (const { f } of matches.slice(Math.max(0, keep))) {
    fs.rmSync(path.join(dir, f), { force: true });
    removed.push(f);
  }
  return removed;
}

let __backupSeq = 0;

/**
 * Backup do estado passado (normalmente o vivo FRESCO) em
 * output/n8n/backups/before-<label>-<ts>.json, com retenção POR rótulo.
 * O nome inclui um contador para nunca colidir em chamadas no mesmo ms.
 */
export function backup(workflow, label = "patch") {
  fs.mkdirSync(paths.backupsDir, { recursive: true });
  const stamp = `${Date.now()}-${String(__backupSeq++).padStart(3, "0")}`;
  const file = path.join(paths.backupsDir, `before-${label}-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(workflow, null, 2));
  const pruned = pruneBackups(label);
  return { file, pruned };
}

/**
 * PUT à prova do schema + reativa + GET de verificação. Retorna o workflow
 * verificado e o estado de ativação. NÃO faz backup (chame `backup()` antes).
 */
export async function safePut(workflow, _label = "patch", { activate = true } = {}) {
  await putWorkflow(buildPutBody(workflow));
  let activeAfter = false;
  if (activate) {
    try {
      activeAfter = (await activateWorkflow())?.active ?? false;
    } catch (e) {
      activeAfter = `ACTIVATE_FAILED: ${e.message}`;
    }
  }
  const verify = await getLive();
  return { verify, activeAfter, finalActive: verify.active };
}
