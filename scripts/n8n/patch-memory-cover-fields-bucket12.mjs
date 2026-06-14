// Surgical patch — fecha os "buckets 1 e 2" de campos do lead_state que hoje caem
// para null toda rodada porque o Edit Fields5 lê tudo de `$json` (= memory do
// Memory 2 - Reconciler) e esses campos não estão no schema de saída dos agentes.
// Como `Parse Memory` (preserve() determinístico) foi removido, qualquer campo que
// o Memory 2 não emitir é perdido entre rodadas.
//
//   Bucket 1 (fatos do cliente) -> Memory 1 EXTRAI + Memory 2 PRESERVA/echo:
//     intent_secondary, sentiment_current, objection_current, desired_device_type,
//     secondary_color_simulation, pickup_datetime,
//     cadastro_solicitado, cadastro_nome_completo, cadastro_data_nascimento,
//     cadastro_cpf, cadastro_contato, cadastro_completo
//   Bucket 2 (derivados de regra) -> Memory 2 DERIVA dos insumos já no estado:
//     tradein_battery_suspect, tradein_disqualified, tradein_evaluation_pending,
//     tradein_model_accepted, tradein_rejected_reason,
//     cross_city_situation, hdi_city_needed, client_outside_ce
//
// Anti-alucinação: as regras são conservadoras (null/preserve quando faltar
// evidência; nunca inventar CPF/nome/cidade do estoque/elegibilidade).
// Buckets 3 (determinísticos: estoque/simulador/funil) e 4 (flags de roteamento)
// NÃO entram aqui — serão cabeados no Edit Fields5, não nos prompts.
//
// DRY=1 lê o export local e grava /tmp/repasse-bucket12-dry.json sem PUT.
import fs from "node:fs";
import path from "node:path";

const WORKFLOW_ID = "Cr4fPWe0prwS6XjI";
const N8N_BASE_URL = "https://iatende-n8n.ylgf5w.easypanel.host";
const DRY = process.env.DRY === "1";
const LOCAL_EXPORT = "output/n8n/ia-repasse-pro-v2-current.json";

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

function getN8nApiKey() {
  const env = readEnvFile(path.resolve(".env.local"));
  return process.env.N8N_PUBLIC_API ?? process.env.N8N_API_KEY ?? env.N8N_PUBLIC_API ?? env.N8N_API_KEY;
}

async function n8nFetch(pathname, options = {}) {
  const apiKey = getN8nApiKey();
  if (!apiKey) throw new Error("N8N_API_KEY missing from environment or .env.local");
  const response = await fetch(`${N8N_BASE_URL}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-N8N-API-KEY": apiKey,
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`n8n API ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function replaceOnce(source, needle, replacement, label) {
  const idx = source.indexOf(needle);
  if (idx === -1) throw new Error(`needle not found: ${label}`);
  if (source.indexOf(needle, idx + needle.length) !== -1) throw new Error(`needle not unique: ${label}`);
  console.log(`  ok [${label}]`);
  return source.slice(0, idx) + replacement + source.slice(idx + needle.length);
}

// ---------------- Memory 1 - Extractor ----------------
const M1_NEEDLE =
  "- facts pode conter campos como desired_model, desired_capacity, desired_color, desired_condition, preferred_city, card_brand, interest_type, tradein_model, tradein_capacity, tradein_color, tradein_battery_pct, cash_entry_intent, cash_entry_amount, proposal_accepted, reservation_intent, pix_paid.";

const M1_REPLACEMENT =
  "- facts pode conter campos como desired_model, desired_capacity, desired_color, desired_condition, desired_device_type, secondary_color_simulation, preferred_city, card_brand, interest_type, tradein_model, tradein_capacity, tradein_color, tradein_battery_pct, cash_entry_intent, cash_entry_amount, proposal_accepted, reservation_intent, pix_paid, pickup_datetime.\n" +
  "\n" +
  "// REPASSE V2 SINAIS E CADASTRO (EXTRACAO)\n" +
  "- intent_secondary: segunda intencao clara na MESMA mensagem (ex.: duvida de garantia junto da compra); null se nao houver.\n" +
  "- sentiment_current: tom do cliente NESTA mensagem (\"positivo\"|\"neutro\"|\"negativo\"|\"frustrado\"|\"ansioso\"); null se indefinido.\n" +
  "- objection_current: objecao explicita NESTA mensagem (\"preco\"|\"prazo\"|\"confianca\"|\"bateria\"|\"cidade\"|\"outro\"); null se nao houver.\n" +
  "- desired_device_type: \"iphone\"|\"outro\" conforme o aparelho que o cliente quer COMPRAR; nunca o aparelho de entrada.\n" +
  "- pickup_datetime: data/hora de retirada que o cliente combinar nesta mensagem (texto curto ou ISO); null caso contrario.\n" +
  "- Dados cadastrais SOMENTE quando o cliente os enviar explicitamente: cadastro_nome_completo, cadastro_data_nascimento, cadastro_cpf, cadastro_contato. Marque cadastro_solicitado=true apenas se o atendimento tiver pedido cadastro. NUNCA invente CPF, nome, data ou contato.";

// ---------------- Memory 2 - Reconciler ----------------
const M2_NEEDLE =
  "interest_type, desired_model, desired_capacity, desired_color, desired_condition, desired_devices, simulation_mode, preferred_city, card_brand, has_tradein, tradein_model, tradein_capacity, tradein_color, tradein_battery_pct, tradein_scratches, tradein_liquid_contact, tradein_side_marks, tradein_parts_swapped, tradein_has_box_cable, tradein_apple_warranty, tradein_warranty_until, cash_entry_intent, cash_entry_amount, proposal_accepted, reservation_intent, pix_paid, pix_amount.";

const M2_REPLACEMENT =
  "interest_type, intent_secondary, sentiment_current, objection_current, desired_model, desired_capacity, desired_color, desired_condition, desired_device_type, secondary_color_simulation, desired_devices, simulation_mode, preferred_city, card_brand, has_tradein, tradein_model, tradein_model_accepted, tradein_rejected_reason, tradein_capacity, tradein_color, tradein_battery_pct, tradein_battery_suspect, tradein_scratches, tradein_liquid_contact, tradein_side_marks, tradein_parts_swapped, tradein_has_box_cable, tradein_apple_warranty, tradein_warranty_until, tradein_disqualified, tradein_evaluation_pending, cross_city_situation, hdi_city_needed, client_outside_ce, cash_entry_intent, cash_entry_amount, proposal_accepted, reservation_intent, pix_paid, pix_amount, pickup_datetime, cadastro_solicitado, cadastro_nome_completo, cadastro_data_nascimento, cadastro_cpf, cadastro_contato, cadastro_completo.\n" +
  "\n" +
  "// REPASSE V2 CAMPOS DERIVADOS E CADASTRO (RECONCILIACAO)\n" +
  "- Preserve sempre os sinais e cadastro vindos do Memory 1: intent_secondary, sentiment_current, objection_current, desired_device_type, secondary_color_simulation, pickup_datetime, cadastro_solicitado, cadastro_nome_completo, cadastro_data_nascimento, cadastro_cpf, cadastro_contato. Copie do LEAD_STATE ATUAL quando nao mudarem.\n" +
  "- cadastro_completo = true somente quando cadastro_nome_completo, cadastro_data_nascimento, cadastro_cpf e cadastro_contato existirem; caso contrario false.\n" +
  "- tradein_evaluation_pending = true enquanto has_tradein=true e qualquer um de tradein_capacity, tradein_color, tradein_battery_pct, tradein_scratches, tradein_liquid_contact, tradein_side_marks, tradein_parts_swapped, tradein_has_box_cable, tradein_apple_warranty estiver null; senao false.\n" +
  "- tradein_battery_suspect = true se tradein_battery_pct parecer suspeito (ex.: 100% em aparelho usado antigo) ou houver indicio de bateria trocada; senao false.\n" +
  "- tradein_disqualified = true apenas com evidencia explicita (contato grave com liquido, tela quebrada, peca trocada incompativel); senao preserve o valor atual ou false.\n" +
  "- tradein_model_accepted / tradein_rejected_reason: defina SOMENTE quando o atendimento explicitar aceite ou recusa do aparelho de entrada; nao invente elegibilidade. null enquanto indefinido.\n" +
  "- client_outside_ce = true se preferred_city for fora do Ceara (CE); null se a cidade do cliente for desconhecida.\n" +
  "- cross_city_situation / hdi_city_needed: derive SOMENTE com a cidade do cliente e a cidade do estoque ja conhecidas no contexto; NUNCA invente a cidade do estoque. null quando faltar dado.";

// ---------------- Run ----------------
const workflow = DRY
  ? JSON.parse(fs.readFileSync(LOCAL_EXPORT, "utf8"))
  : await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const wasActive = workflow.active;

if (!DRY) {
  const backupDir = "output/n8n/backups";
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = `${backupDir}/before-bucket12-${Date.now()}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(workflow, null, 2));
  console.log("backup:", backupPath);
}

const m1 = workflow.nodes.find((n) => n.name === "Memory 1 - Extractor");
if (!m1) throw new Error("Memory 1 - Extractor not found");
if (m1.parameters.options.systemMessage.includes("REPASSE V2 SINAIS E CADASTRO")) {
  console.log("  skip [Memory 1 já patchado]");
} else {
  m1.parameters.options.systemMessage = replaceOnce(
    m1.parameters.options.systemMessage, M1_NEEDLE, M1_REPLACEMENT, "Memory 1 facts + sinais/cadastro");
}

const m2 = workflow.nodes.find((n) => n.name === "Memory 2 - Reconciler");
if (!m2) throw new Error("Memory 2 - Reconciler not found");
if (m2.parameters.options.systemMessage.includes("REPASSE V2 CAMPOS DERIVADOS E CADASTRO")) {
  console.log("  skip [Memory 2 já patchado]");
} else {
  m2.parameters.options.systemMessage = replaceOnce(
    m2.parameters.options.systemMessage, M2_NEEDLE, M2_REPLACEMENT, "Memory 2 preserve + derivados/cadastro");
}

if (DRY) {
  fs.writeFileSync("/tmp/repasse-bucket12-dry.json", JSON.stringify(workflow, null, 2));
  console.log(JSON.stringify({
    dry: true,
    wrote: "/tmp/repasse-bucket12-dry.json",
    m1HasBlock: m1.parameters.options.systemMessage.includes("REPASSE V2 SINAIS E CADASTRO"),
    m2HasBlock: m2.parameters.options.systemMessage.includes("REPASSE V2 CAMPOS DERIVADOS E CADASTRO"),
  }, null, 2));
  process.exit(0);
}

const body = {
  name: workflow.name,
  nodes: workflow.nodes,
  connections: workflow.connections,
  settings: { executionOrder: workflow.settings?.executionOrder ?? "v1" },
};

await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`, { method: "PUT", body: JSON.stringify(body) });

let activeAfter = false;
try {
  const activated = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}/activate`, { method: "POST" });
  activeAfter = activated?.active ?? false;
} catch (err) {
  activeAfter = `ACTIVATE_FAILED: ${err.message}`;
}

const verify = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const vm1 = verify.nodes.find((n) => n.name === "Memory 1 - Extractor");
const vm2 = verify.nodes.find((n) => n.name === "Memory 2 - Reconciler");
console.log(JSON.stringify({
  workflowId: verify.id,
  wasActive,
  activeAfter,
  finalActive: verify.active,
  m1Patched: vm1.parameters.options.systemMessage.includes("REPASSE V2 SINAIS E CADASTRO"),
  m2Patched: vm2.parameters.options.systemMessage.includes("REPASSE V2 CAMPOS DERIVADOS E CADASTRO"),
}, null, 2));
