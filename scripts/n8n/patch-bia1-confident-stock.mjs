import * as kit from "./tool/patch-kit.mjs";

// Real-traffic fixes for Bia 1 (observed in live conv on 2026-06-13):
//  1. Hedge phrasing "Vi que tem opção de 256GB por aqui" -> confident "Temos em
//     estoque o de 256GB" (the precheck reflects real stock; owner wants confidence).
//  2. Re-asking the desired model the customer already gave -> extend REGRA DE OURO
//     to cover the model via conversation history (mitigates the stale-read race).
//
// Migrado para tool/patch-kit.mjs (Fase 5): I/O único. DRY=1 lê o snapshot e não
// faz PUT (o script antigo ignorava DRY e sempre enviava — corrigido aqui).

const NODE = 'Bia 1';

const EDITS = [
  {
    find: 'Use linguagem de pré-consulta ("apareceu por aqui", "vi opções"), nunca confirme como reserva/separação.',
    replace: 'Afirme o estoque com confiança quando a pré-consulta trouxer o item: diga "Temos em estoque o de [capacidade]" ou "Temos o [modelo] em estoque". NUNCA use hedge como "apareceu por aqui", "vi opções" ou "vi que tem opção ... por aqui". Ainda assim, NÃO confirme como reserva/separação nem cite preço.',
  },
  {
    find: '{"message": "Temos iPhone 15 por aqui sim. Vi opções em 128GB e 256GB. Qual armazenamento você prefere?", "transfer": false}',
    replace: '{"message": "Temos o iPhone 15 em estoque, nas versões 128GB e 256GB. Qual armazenamento você prefere?", "transfer": false}',
  },
  {
    find: 'REGRA DE OURO: só pergunte o que o cliente ainda NÃO informou. Se ele já disse o armazenamento na primeira mensagem, não pergunte de novo.',
    replace: 'REGRA DE OURO: só pergunte o que o cliente ainda NÃO informou. Se ele já disse o armazenamento na primeira mensagem, não pergunte de novo. Isso vale também para o MODELO desejado: se o cliente já disse qual iPhone quer em QUALQUER mensagem desta conversa (mesmo que o estado esteja momentaneamente vazio), NUNCA pergunte "qual iPhone você quer comprar?" de novo — assuma o modelo informado e avance. Use o histórico da conversa, não dependa só do estado.',
  },
];

const wf = await kit.loadWorkflow();
const node = wf.nodes.find((n) => n.name === NODE);
if (!node) throw new Error(`Node not found: ${NODE}`);
let sm = node.parameters.options.systemMessage;
const report = [];
for (const e of EDITS) {
  if (sm.includes(e.replace)) { report.push({ status: 'already applied', snippet: e.replace.slice(0, 40) }); continue; }
  const occ = sm.split(e.find).length - 1;
  if (occ !== 1) throw new Error(`anchor ${occ}x (need 1): ${e.find.slice(0, 50)}`);
  sm = sm.replace(e.find, e.replace);
  report.push({ status: 'applied', snippet: e.replace.slice(0, 40) });
}
node.parameters.options.systemMessage = sm;

if (kit.DRY) { console.log(JSON.stringify({ dry: true, node: NODE, report }, null, 2)); process.exit(0); }
kit.backup(await kit.getLive(), "bia1-confident-stock");
const { activeAfter, finalActive } = await kit.safePut(wf, "bia1-confident-stock");
console.log(JSON.stringify({ node: NODE, report, activeAfter, finalActive }, null, 2));
