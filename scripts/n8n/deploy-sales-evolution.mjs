// deploy-sales-evolution.mjs — aplica uma FASE da evolução comercial no workflow VIVO.
// GET vivo → transformPhase(live, PHASE) → valida (structuralErrors + new Function nos
// nós de código editados + topologia preservada) → backup → buildPutBody → PUT → activate.
//   DRY=1                       → previa (não escreve no vivo)
//   --phase A|B1|B2|B3|B4|B5|B  → fase (default A); cumulativa e idempotente
//   --rollback <arquivo.json>   → PUT do backup salvo + activate
// node via nvm; segredo lido por netio (nunca impresso).
import fs from "node:fs";
import path from "node:path";
import { getWorkflow, putWorkflow, activateWorkflow } from "./tool/netio.mjs";
import { buildPutBody } from "./tool/deploy_body.mjs";
import { structuralErrors } from "./tool/extract.mjs";
import { transformPhase } from "./transform-sales-evolution.mjs";

const DRY = process.env.DRY === "1" || process.env.DRY === "true";
const BACKUP_DIR = "output/n8n/backups";
const ts = () => new Date().toISOString().replace(/[:.]/g, "-");

function saveBackup(wf, tag) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const f = path.join(BACKUP_DIR, `sales-evolution-${tag}-${ts()}.json`);
  fs.writeFileSync(f, JSON.stringify(wf, null, 2));
  return f;
}
function assertSyntax(wf) {
  for (const name of ["Code Routing Flags", "Code Refresh Lead State Before Switch2"]) {
    const n = wf.nodes.find((x) => x.name === name);
    new Function("$input", "$", n.parameters.jsCode); // lança em erro de sintaxe
  }
}
async function rollback(file) {
  if (!fs.existsSync(file)) throw new Error(`backup não encontrado: ${file}`);
  const saved = JSON.parse(fs.readFileSync(file, "utf8"));
  if (structuralErrors(saved).length) throw new Error("backup com conexões inválidas, abortando rollback");
  console.log(`ROLLBACK ← ${file} (${saved.nodes.length} nós)`);
  if (DRY) { console.log("DRY: não fez PUT."); return; }
  await putWorkflow(buildPutBody(saved));
  await activateWorkflow();
  console.log("rollback aplicado + reativado.");
}

async function main() {
  const rb = process.argv.indexOf("--rollback");
  if (rb >= 0) return rollback(process.argv[rb + 1]);
  const pi = process.argv.indexOf("--phase");
  const PHASE = pi >= 0 ? process.argv[pi + 1] : "A";

  console.log("GET workflow vivo…");
  const live = await getWorkflow();
  console.log(`vivo: ${live.nodes.length} nós, versionId ${live.versionId} — fase ${PHASE}`);
  for (const must of ["Code Routing Flags", "Code Refresh Lead State Before Switch2", "Bia 2 ESTOQUE", "Bia 1"]) {
    if (!live.nodes.some((n) => n.name === must)) throw new Error(`base inesperada no vivo: falta ${must} (rode guard/pull?)`);
  }

  const out = transformPhase(structuredClone(live), PHASE);

  const errs = structuralErrors(out);
  if (errs.length) { console.error("structuralErrors — abortando:\n  " + errs.join("\n  ")); process.exit(1); }
  assertSyntax(out);
  if (out.nodes.length !== live.nodes.length) {
    console.error(`ERRO: contagem de nós mudou (${live.nodes.length} → ${out.nodes.length}); topologia não deve mudar.`);
    process.exit(1);
  }
  console.log("validação OK (structuralErrors=[], sintaxe OK, topologia preservada)");

  if (DRY) { console.log("\nDRY=1 → nada escrito no vivo."); return; }

  const bkp = saveBackup(live, `pre-${PHASE}`);
  console.log(`backup do vivo: ${bkp}`);
  console.log("PUT…");
  await putWorkflow(buildPutBody(out));
  console.log("activate…");
  await activateWorkflow();
  const after = await getWorkflow();
  console.log(`OK — vivo agora: ${after.nodes.length} nós, versionId ${after.versionId}, active=${after.active}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
