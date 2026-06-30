// Bia 2 ESTOQUE (P3): a "REGRA ABSOLUTA DE COR — SOMENTE ESTOQUE" já existe
// (só ofertar cores do estoque, não inventar). O gap de FLUXO é: cor não é
// necessária para simular — é sugestão pós-simulação ou sob demanda. Append
// idempotente reforçando isso, sem mexer nas regras já corretas.
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. DRY=1 lê o snapshot local, não faz PUT.
import * as kit from "./tool/patch-kit.mjs";

const NODE = 'Bia 2 ESTOQUE';
const APPEND_MARKER = '// COR POS-SIMULACAO (FAQ/FLUXO) v1';

const APPEND_BLOCK = `

${APPEND_MARKER}
- Cor NÃO é necessária para simular. Não pergunte a cor antes de simular: simule com a opção disponível e trate a cor como sugestão APÓS a simulação, ou só quando o cliente perguntar.
- Reforço: nunca confirme nem invente uma cor que o cliente não disse e que não esteja em available_colors/available_options (não responda "ótimo, [cor] então" sem o cliente ter pedido essa cor e ela existir no estoque).`;

const workflow = await kit.loadWorkflow();
const node = workflow.nodes.find((n) => n.name === NODE);
if (!node) throw new Error(`Node not found: ${NODE}`);
let sys = node.parameters?.options?.systemMessage;
if (typeof sys !== 'string') throw new Error(`${NODE} has no systemMessage`);

let result;
if (sys.includes(APPEND_MARKER)) {
  result = { already: true };
} else {
  // sanity: a regra base de cor deve existir (não estamos partindo de um prompt inesperado)
  if (!sys.includes('REGRA ABSOLUTA DE COR')) throw new Error(`${NODE}: regra base de cor ausente (drift?)`);
  node.parameters.options.systemMessage = sys + APPEND_BLOCK;
  result = { already: false };
}

if (kit.DRY) {
  console.log(JSON.stringify({ dry: true, result }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "bia2-estoque-color");
const { verify, activeAfter, finalActive } = await kit.safePut(workflow, "bia2-estoque-color");
const applied = verify.nodes.find((n) => n.name === NODE)?.parameters?.options?.systemMessage?.includes(APPEND_MARKER);
console.log(JSON.stringify({ patched: true, node: NODE, result, activeAfter, finalActive, applied }, null, 2));
