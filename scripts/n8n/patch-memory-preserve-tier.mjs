// Re-aplica (via patch cirúrgico) a regra de PRESERVAR O TIER no Memory 1
// Extractor e Memory 2 Reconciler — revertida por uma gravação concorrente na UI
// do n8n. Insere após âncora, preservando edições atuais.
// Idempotente via marcador "PRESERVE O TIER".
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. DRY=1 lê o snapshot local, não faz PUT.
import * as kit from "./tool/patch-kit.mjs";

const M1_ANCHOR = '- Nao substitua desired_model/desired_capacity principal; desired_devices e complementar para simulacao conjunta.';
const M1_ADD = `
- PRESERVE O TIER (Pro/Pro Max/Plus): quando o cliente menciona um tier que se aplica a varios modelos em duvida (ex.: "versao Pro Max" + "entre 13 e 14"), cada item de desired_devices DEVE conter o modelo COMPLETO com o tier — "iPhone 13 Pro Max" e "iPhone 14 Pro Max". NUNCA extraia so "iPhone 13"/"iPhone 14" perdendo o tier, nem so "Pro Max" perdendo a geracao.
- desired_model (singular) NUNCA pode ser apenas um tier ("Pro Max", "Pro", "Plus") sem geracao. Se houver 2+ desired_devices, desired_model = null (o modelo unico ainda nao foi decidido). Se houver um unico modelo, desired_model = modelo completo (geracao + tier quando informado).`;

const M2_ANCHOR = '- Se so houver um aparelho, mantenha tambem os campos antigos desired_model, desired_capacity, desired_color e desired_condition.';
const M2_ADD = `
- PRESERVE O TIER (Pro/Pro Max/Plus) em CADA item de desired_devices: cada desired_model deve ser o modelo COMPLETO (geracao + tier), ex.: "iPhone 13 Pro Max" e "iPhone 14 Pro Max". Se o tier veio numa mensagem anterior ("versao Pro Max") e as geracoes em outra ("entre 13 e 14"), combine os dois em cada item. NUNCA reduza para "iPhone 13"/"iPhone 14" (sem tier) nem mantenha so "Pro Max" (sem geracao).
- desired_model (singular) NUNCA pode ser apenas um tier ("Pro Max"/"Pro"/"Plus") sem geracao. Com 2+ desired_devices, desired_model = null. Com um unico modelo, desired_model = modelo completo (geracao + tier quando informado).`;

const TARGETS = [
  { node: 'Memory 1 - Extractor', anchor: M1_ANCHOR, add: M1_ADD },
  { node: 'Memory 2 - Reconciler', anchor: M2_ANCHOR, add: M2_ADD },
];

const workflow = await kit.loadWorkflow();
const result = {};
for (const t of TARGETS) {
  const node = workflow.nodes.find((n) => n.name === t.node);
  if (!node) throw new Error(`Node not found: ${t.node}`);
  let sys = node.parameters?.options?.systemMessage;
  if (typeof sys !== 'string') throw new Error(`${t.node} has no systemMessage`);
  if (sys.includes('PRESERVE O TIER')) {
    result[t.node] = { already: true };
  } else {
    sys = kit.replaceOnce(sys, t.anchor, t.anchor + t.add, `${t.node} tier`);
    node.parameters.options.systemMessage = sys;
    result[t.node] = { already: false };
  }
}

if (kit.DRY) {
  console.log(JSON.stringify({ dry: true, result }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "memory-preserve-tier");
const { activeAfter, finalActive } = await kit.safePut(workflow, "memory-preserve-tier");
console.log(JSON.stringify({ patched: true, result, activeAfter, finalActive }, null, 2));
