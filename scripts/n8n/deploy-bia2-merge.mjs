// ============================================================================
// deploy-bia2-merge.mjs — aplica a fusão Bia 2 no workflow VIVO (patch cirúrgico).
//
// Por que não `repasse-maint deploy`: o compose() só faz splice de código/prompt-
// estático sobre o vivo fresco — NÃO carrega mudança de topologia (deletar nós /
// repontar conexões) nem prompt-por-expressão. Esta fusão é estrutural, então
// transformamos o vivo fresco e damos PUT do workflow inteiro.
//
// Fluxo: GET vivo → transformWorkflow → VALIDA (structuralErrors + sanity) →
//        backup → buildPutBody → PUT → activate.
//   DRY=1                       → previa (não escreve nada no vivo)
//   --rollback <arquivo.json>   → PUT do backup salvo + activate (sem transform)
//
// node via nvm; segredo lido por netio (nunca impresso).
// ============================================================================

import fs from "node:fs";
import path from "node:path";
import { getWorkflow, putWorkflow, activateWorkflow } from "./tool/netio.mjs";
import { buildPutBody } from "./tool/deploy_body.mjs";
import { structuralErrors } from "./tool/extract.mjs";
import { transformWorkflow } from "./transform-bia2-merge.mjs";

const DRY = process.env.DRY === "1" || process.env.DRY === "true";
const BACKUP_DIR = "output/n8n/backups";

function ts() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function saveBackup(workflow, tag) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `bia2-merge-${tag}-${ts()}.json`);
  fs.writeFileSync(file, JSON.stringify(workflow, null, 2));
  return file;
}

async function rollback(file) {
  if (!fs.existsSync(file)) throw new Error(`backup não encontrado: ${file}`);
  const saved = JSON.parse(fs.readFileSync(file, "utf8"));
  const errs = structuralErrors(saved);
  if (errs.length) throw new Error(`backup com conexões inválidas, abortando rollback:\n${errs.join("\n")}`);
  console.log(`ROLLBACK ← ${file} (${saved.nodes.length} nós)`);
  if (DRY) { console.log("DRY: não fez PUT."); return; }
  await putWorkflow(buildPutBody(saved));
  await activateWorkflow();
  console.log("rollback aplicado + reativado.");
}

async function main() {
  const rbIdx = process.argv.indexOf("--rollback");
  if (rbIdx >= 0) return rollback(process.argv[rbIdx + 1]);

  console.log("GET workflow vivo…");
  const live = await getWorkflow();
  console.log(`vivo: ${live.nodes.length} nós, versionId ${live.versionId}`);

  // sanity pré-transform: os nós-chave existem (senão a base não é a esperada)
  const liveNames = new Set(live.nodes.map((n) => n.name));
  for (const must of ["Bia 2 ESTOQUE", "Bia 2 SEM ESTOQUE ", "Switch1", "Switch3", "Parse Simulator"]) {
    if (!liveNames.has(must)) throw new Error(`base inesperada no vivo: nó ausente ${JSON.stringify(must)} (rode guard/pull?)`);
  }

  const { wf: out, dead } = transformWorkflow(live);

  // VALIDAÇÃO (n8n-validation-expert: nunca PUT/ativar com erro)
  const errs = structuralErrors(out);
  if (errs.length) {
    console.error("ERRO de integridade de conexões — abortando:\n  " + errs.join("\n  "));
    process.exit(1);
  }
  const removed = live.nodes.length - out.nodes.length;
  if (removed !== dead.length) {
    console.error(`ERRO: removidos ${removed} != dead ${dead.length} — abortando.`);
    process.exit(1);
  }
  if (!out.nodes.some((n) => n.name === "Bia 2 ESTOQUE")) {
    console.error("ERRO: sobrevivente sumiu — abortando.");
    process.exit(1);
  }

  // diff resumido
  console.log(`\n== DIFF ==`);
  console.log(`nós: ${live.nodes.length} → ${out.nodes.length} (removidos ${dead.length})`);
  dead.forEach((d) => console.log("  - " + JSON.stringify(d)));
  const surv = out.nodes.find((n) => n.name === "Bia 2 ESTOQUE");
  console.log(`systemMessage do sobrevivente: ${surv.parameters.options.systemMessage.length} chars`);
  console.log(`structuralErrors: [] ✔`);

  if (DRY) {
    console.log("\nDRY=1 → nada escrito no vivo.");
    return;
  }

  const bkp = saveBackup(live, "pre");
  console.log(`\nbackup do vivo: ${bkp}`);
  console.log("PUT…");
  await putWorkflow(buildPutBody(out));
  console.log("activate…");
  await activateWorkflow();
  const after = await getWorkflow();
  console.log(`OK — vivo agora: ${after.nodes.length} nós, versionId ${after.versionId}, active=${after.active}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
