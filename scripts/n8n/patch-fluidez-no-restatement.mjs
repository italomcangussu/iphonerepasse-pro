import * as kit from "./tool/patch-kit.mjs";

// Conversation-quality fix: agents must not restate the customer's own choice
// ("vi que você quer iPhone 13 Pro Max rosa!") when desired_model/desired_color
// are already in state — it stalls the flow. Prompt-only, no routing change.
//
// Migrado para tool/patch-kit.mjs (Fase 5): I/O único. DRY=1 lê o snapshot.

const RULE = `FLUIDEZ — NÃO REAFIRME A ESCOLHA DO CLIENTE

Quando desired_model e/ou desired_color já estão preenchidos no estado, nunca devolva frases que repetem a escolha do cliente como novidade — evite "vi que você quer...", "você escolheu...", "ótimo, você quer o [modelo] [cor]!", "então você quer...". Trate o que já foi informado como certo e avance direto para a próxima etapa (cidade, capacidade, bandeira, simulação ou fechamento) com no máximo uma pergunta curta. Reafirmar a escolha trava a conversa e reduz a qualidade do atendimento.

`;

const EDITS = {
  'Bia 2 SEM ESTOQUE ': 'DESAMBIGUACAO ENTRE IPHONE DESEJADO E IPHONE DE ENTRADA',
  'Bia 2 ESTOQUE': 'REGRA DE DADOS — MEMORY É A FONTE DE VERDADE',
  'Bia 1': 'DESAMBIGUACAO ENTRE IPHONE DESEJADO E IPHONE DE ENTRADA',
};

const wf = await kit.loadWorkflow();

const report = [];
for (const [name, anchor] of Object.entries(EDITS)) {
  const node = wf.nodes.find((n) => n.name === name);
  if (!node) throw new Error(`Node not found: ${name}`);
  const sm = node.parameters?.options?.systemMessage;
  if (typeof sm !== 'string') throw new Error(`No systemMessage on ${name}`);
  if (sm.includes('FLUIDEZ — NÃO REAFIRME A ESCOLHA DO CLIENTE')) {
    report.push({ node: name, status: 'already present' });
    continue;
  }
  const occ = sm.split(anchor).length - 1;
  if (occ !== 1) throw new Error(`Anchor for "${name}" found ${occ}x (need 1): ${anchor}`);
  node.parameters.options.systemMessage = sm.replace(anchor, RULE + anchor);
  report.push({ node: name, status: 'rule inserted' });
}

if (kit.DRY) { console.log(JSON.stringify({ dry: true, report }, null, 2)); process.exit(0); }
kit.backup(await kit.getLive(), "fluidez-no-restatement");
const { activeAfter, finalActive } = await kit.safePut(wf, "fluidez-no-restatement");
console.log(JSON.stringify({ report, activeAfter, finalActive }, null, 2));
