import * as kit from "./tool/patch-kit.mjs";

// Remove the CITY mention when Bia 2 ESTOQUE PRESENTS stock (Estágio 1:
// inventory_found = true, simulation_done = false).
//
// Why: the store/city must only be asked AFTER the simulation is accepted
// (routing_decision = "ask_pickup_city_after_sim" → "Você prefere retirar em
// Fortaleza ou Sobral?"). Announcing "disponível na nossa loja de [stock_city]"
// during presentation pre-commits a city before the client picked one and
// before the simulation — exactly what the post-sim city rules forbid. So the
// Estágio-1 templates (CASO A / B1 / B2) and the JSON scenario examples
// (CENÁRIO A / B1 / B2) drop the city; they keep the availability confirmation.
//
// Scope: ONLY presentation. Untouched on purpose:
//  - the post-sim pickup-city question ("Você prefere retirar em Fortaleza ou Sobral?")
//  - the cross-city / FECHAMENTO NA CIDADE / store-address (ENDEREÇO DA LOJA) blocks
//  - "o estoque é consolidado nas duas lojas" rule
//
// Edits options.systemMessage (an expression starting with "="). Each find must
// occur exactly once. Idempotent: if none of the finds are present it no-ops;
// a partial state throws (drift → run the live guard).
// Migrado para tool/patch-kit.mjs (Fase 5): I/O único. DRY=1 lê o snapshot.

const NODE_NAME = 'Bia 2 ESTOQUE';

const EDITS = [
  // anti-repetition note — drop the [stock_city] example phrasing
  {
    find: 'Repetir "tá disponível na nossa loja de [stock_city]" a cada mensagem soa robótico.',
    replace: 'Repetir "tá disponível" a cada mensagem soa robótico.',
  },
  // CASO A directive — stop telling Bia to cite the store/city
  {
    find: 'cite só o que é novo: que está disponível e a loja/cidade (no fuzzy, também a cor real).',
    replace: 'cite só o que é novo: que está disponível (no fuzzy, também a cor real).',
  },
  // CASO A templates
  {
    find: 'Com trade-in aprovado: "Show, esse tá disponível na nossa loja de [stock_city]. Vou simular no cartão pra você."',
    replace: 'Com trade-in aprovado: "Show, esse tá disponível. Vou simular no cartão pra você."',
  },
  {
    find: 'Sem trade-in: "Show, esse tá disponível na nossa loja de [stock_city]. Vou já simular o valor pra você no cartão."',
    replace: 'Sem trade-in: "Show, esse tá disponível. Vou já simular o valor pra você no cartão."',
  },
  // CASO B1 templates
  {
    find: 'Esse é o Azul Profundo, disponível na nossa loja de [stock_city]. Vou simular no cartão pra você.',
    replace: 'Esse é o Azul Profundo, disponível. Vou simular no cartão pra você.',
  },
  {
    find: 'Esse é o Azul Profundo, disponível na nossa loja de [stock_city]. Vou já simular o valor pra você no cartão.',
    replace: 'Esse é o Azul Profundo, disponível. Vou já simular o valor pra você no cartão.',
  },
  // CASO B2 template
  {
    find: 'em [cor] novo, na nossa loja de [stock_city]. Te atende',
    replace: 'em [cor] novo. Te atende',
  },
  // CENÁRIO examples (JSON outputs)
  {
    find: 'Show, esse tá disponível na nossa loja de Sobral. Vou simular no cartão pra você.',
    replace: 'Show, esse tá disponível. Vou simular no cartão pra você.',
  },
  {
    find: 'Esse é o Azul Profundo, disponível na nossa loja de Sobral. Vou simular no cartão pra você.',
    replace: 'Esse é o Azul Profundo, disponível. Vou simular no cartão pra você.',
  },
  {
    find: 'Temos o 512GB em Branco Estelar novo, na nossa loja de Fortaleza. Te atende ou prefere ver outra cor com 1TB?',
    replace: 'Temos o 512GB em Branco Estelar novo. Te atende ou prefere ver outra cor com 1TB?',
  },
];

const workflow = await kit.loadWorkflow();

const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`Node not found: ${NODE_NAME}`);
if (node.type !== '@n8n/n8n-nodes-langchain.agent') throw new Error(`${NODE_NAME} is not an agent node (got ${node.type})`);

const text = node.parameters?.options?.systemMessage;
if (typeof text !== 'string') throw new Error(`${NODE_NAME}: options.systemMessage is not a string`);

const present = EDITS.filter((e) => text.includes(e.find));
if (present.length === 0) {
  console.log(JSON.stringify({ skipped: true, reason: 'already patched (no city in presentation)', node: NODE_NAME }, null, 2));
  process.exit(0);
}
if (present.length !== EDITS.length) {
  throw new Error(`${NODE_NAME}: partial match — ${present.length}/${EDITS.length} finds present (workflow drifted? run the live guard). Missing: ${EDITS.filter((e) => !text.includes(e.find)).map((e) => JSON.stringify(e.find.slice(0, 40))).join(', ')}`);
}

let newText = text;
for (const { find, replace } of EDITS) {
  const occurrences = newText.split(find).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${NODE_NAME}: expected exactly 1 match for ${JSON.stringify(find.slice(0, 50))}, found ${occurrences}`);
  }
  newText = newText.replace(find, replace);
}

// Safety: no [stock_city] placeholder should survive in presentation templates.
if (newText.includes('loja de [stock_city]')) {
  throw new Error(`${NODE_NAME}: "loja de [stock_city]" still present after edits — aborting`);
}

node.parameters.options.systemMessage = newText;

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, node: NODE_NAME, edits: EDITS.length, bytesBefore: text.length, bytesAfter: newText.length }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "bia2-no-city-presentation");
const { activeAfter, finalActive } = await kit.safePut(workflow, "bia2-no-city-presentation");
console.log(JSON.stringify({
  patched: true, node: NODE_NAME, edits: EDITS.length,
  bytesBefore: text.length, bytesAfter: newText.length, activeAfter, finalActive,
}, null, 2));
