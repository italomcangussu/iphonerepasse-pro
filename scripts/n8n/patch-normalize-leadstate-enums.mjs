// Surgical patch — normaliza valores canônicos do lead_state no node
// "Code in JavaScript2" (flatten memory→root, roda em TODO turno antes do
// Edit Fields5) do workflow AO VIVO (Cr4fPWe0prwS6XjI).
//
// Por quê: o LLM (Memory 1/2) emite valores fora do enum canônico —
// interest_type "troca" (canônico "trocar") e desired_condition "novo"/"seminovo"
// (canônico "Novo"/"Seminovo"). Isso quebra DUAS coisas:
//   1) PERSISTÊNCIA: o CHECK da tabela lead_state (lead_state_interest_type_check,
//      lead_state_desired_condition_check) rejeita → o upsert_lead_state (plpgsql)
//      dá raise → a transação inteira falha → NADA persiste → o GET volta
//      lead_state null → o Memory 2 recebe "LEAD_STATE ATUAL: null" e esquece
//      tudo a cada turno (perde trade-in etc).
//   2) ROTEAMENTO: isIphonePurchaseFlow() do Code Routing Flags exige
//      interest_type ∈ {"comprar","trocar"}; com "troca" fica false → nunca
//      chega a estoque/simulação.
// Normalizar aqui (chokepoint determinístico após o Memory 2) conserta ambos:
// Edit Fields5 → Code Routing Flags E Edit Fields5 → Code in JavaScript (POST).
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. DRY=1 lê o snapshot local e grava /tmp/repasse-normalize-enums-dry.json sem PUT.
import fs from "node:fs";
import * as kit from "./tool/patch-kit.mjs";

const NODE_NAME = "Code in JavaScript2";

const NEEDLE = `for (const item of $input.all()) {
  // Pega tudo o que está dentro do objeto e transforma na raiz do JSON
  item.json = $input.first().json.memory;
}

return $input.all();`;

const REPLACEMENT = `// REPASSE LEAD_STATE ENUM NORMALIZE START
// Canônico: interest_type "trocar"; desired_condition "Novo"/"Seminovo".
// O LLM às vezes emite "troca"/"novo" — fora do enum → quebra o CHECK do
// upsert_lead_state (perde o estado inteiro) E o isIphonePurchaseFlow do roteamento.
function normInterestType(v) {
  if (v == null) return v;
  const s = String(v).trim().toLowerCase();
  if (s === 'troca') return 'trocar';
  if (s === 'compra') return 'comprar';
  if (s === 'venda') return 'vender';
  if (s === 'avaliacao' || s === 'avaliação') return 'avaliar';
  if (s === 'duvida' || s === 'dúvida') return 'duvida';
  return v;
}
function normCondition(v) {
  if (v == null) return v;
  const s = String(v).trim().toLowerCase();
  if (s === 'novo') return 'Novo';
  if (s === 'seminovo' || s === 'semi-novo' || s === 'semi novo') return 'Seminovo';
  return v;
}
for (const item of $input.all()) {
  // Pega tudo o que está dentro do objeto e transforma na raiz do JSON
  item.json = $input.first().json.memory;
  if (item.json && typeof item.json === 'object') {
    item.json.interest_type = normInterestType(item.json.interest_type);
    item.json.desired_condition = normCondition(item.json.desired_condition);
    if (Array.isArray(item.json.desired_devices)) {
      for (const d of item.json.desired_devices) {
        if (d && typeof d === 'object') d.desired_condition = normCondition(d.desired_condition);
      }
    }
  }
}
// REPASSE LEAD_STATE ENUM NORMALIZE END

return $input.all();`;

const workflow = await kit.loadWorkflow();
const wasActive = workflow.active;

const node = workflow.nodes.find((n) => n.name === NODE_NAME);
if (!node) throw new Error(`${NODE_NAME} not found`);

let code = node.parameters.jsCode;
if (code.includes("REPASSE LEAD_STATE ENUM NORMALIZE START")) {
  console.log("  skip [normalização já aplicada]");
} else {
  const count = code.split(NEEDLE).length - 1;
  if (count !== 1) throw new Error(`needle não-único (${count}x) em ${NODE_NAME}`);
  node.parameters.jsCode = code.replace(NEEDLE, REPLACEMENT);
  console.log("  ok [normalização aplicada]");
}

// syntax assert
new Function("$input", "$", "DateTime", "$helpers", "$jmespath", node.parameters.jsCode);

// sanidade
for (const m of ["normInterestType", "normCondition", "'trocar'", "'Novo'"]) {
  if (!node.parameters.jsCode.includes(m)) throw new Error(`sanity falhou, faltou: ${m}`);
}

if (kit.DRY) {
  fs.writeFileSync("/tmp/repasse-normalize-enums-dry.json", JSON.stringify(workflow, null, 2));
  console.log(JSON.stringify({ dry: true, wrote: "/tmp/repasse-normalize-enums-dry.json" }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "normalize-enums");
const { verify, activeAfter, finalActive } = await kit.safePut(workflow, "normalize-enums");
const vNode = verify.nodes.find((n) => n.name === NODE_NAME);
console.log(JSON.stringify({
  workflowId: verify.id,
  wasActive,
  activeAfter,
  finalActive,
  normalizePresent: vNode?.parameters?.jsCode?.includes("REPASSE LEAD_STATE ENUM NORMALIZE START") ?? false,
}, null, 2));
