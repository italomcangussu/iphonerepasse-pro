// Surgical patch — Bia 1 "modelo exato indisponível" + remoção do "apareceu aqui".
// Patches 2 nodes on the LIVE workflow (Cr4fPWe0prwS6XjI):
//   1. Code Build Inventory Lite — add desired_exact_available + only_nearby_alternatives flags.
//   2. Bia 1 (systemMessage) — drop "apareceu por aqui" guidance, add MODELO EXATO INDISPONÍVEL flow.
// Footgun guard: surgical PUT only (no build script), then re-activate and verify active=true.
import fs from "node:fs";
import path from "node:path";

const WORKFLOW_ID = "Cr4fPWe0prwS6XjI";
const N8N_BASE_URL = "https://iatende-n8n.ylgf5w.easypanel.host";

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
  return process.env.N8N_PUBLIC_API ?? readEnvFile(path.resolve(".env.local")).N8N_PUBLIC_API;
}

async function n8nFetch(pathname, options = {}) {
  const apiKey = getN8nApiKey();
  if (!apiKey) throw new Error("N8N_PUBLIC_API missing from environment or .env.local");
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
  if (idx === -1) throw new Error(`Patch needle not found: ${label}`);
  if (source.indexOf(needle, idx + needle.length) !== -1) {
    throw new Error(`Patch needle not unique: ${label}`);
  }
  return source.slice(0, idx) + replacement + source.slice(idx + needle.length);
}

// ---- Patch 1: Code Build Inventory Lite ----
function patchInventoryLite(code) {
  if (code.includes("desired_exact_available")) return code; // idempotent
  const needle =
    "      pre_inventory_found: pool.length > 0,\n" +
    "      model_match_status,\n" +
    "      available_models: modelNames.slice(0, 8),";
  const replacement =
    "      pre_inventory_found: pool.length > 0,\n" +
    "      model_match_status,\n" +
    "      desired_exact_available: model_match_status === \"exact\",\n" +
    "      only_nearby_alternatives: pool.length > 0 && model_match_status !== \"exact\" && model_match_status !== \"ambiguous\",\n" +
    "      available_models: modelNames.slice(0, 8),";
  return replaceOnce(code, needle, replacement, "InventoryLite pre_inventory flags");
}

// ---- Patch 2: Bia 1 systemMessage ----
const MODELO_EXATO_BLOCK = `MODELO EXATO INDISPONÍVEL NA PRÉ-CONSULTA (only_nearby_alternatives = true)

Quando o modelo exato que o cliente pediu NÃO está no estoque atual, mas há um
modelo próximo (ex.: pediu iPhone 15, só há 15 Pro Max), NUNCA apresente o
modelo próximo como se fosse o que ele pediu, e NUNCA fale em reserva por conta
própria (só cite reserva se o próprio cliente pedir). Siga esta ordem:

1º — Seja transparente sobre o modelo exato e mostre agilidade, sem prometer data:
   "O iPhone 15 não está aqui no estoque agora, mas costuma chegar rápido, muitas
    vezes no mesmo dia. Quer que eu te avise assim que entrar?"

2º — Pode oferecer o próximo como alternativa, com enquadramento de valor:
   "Tenho aqui também o iPhone 15 Pro Max — se tiver interesse, consigo já simular
    pra você com o seu aparelho atual como entrada."

   Você pode juntar 1º e 2º numa única mensagem curta. Nunca diga "apareceu".

3º — Se o cliente ACEITA o modelo próximo: siga o funil normal (avaliação do
   aparelho de entrada, se houver) — NÃO transfira. transfer: false.

4º — Se o cliente quer ESPERAR o modelo exato: encaminhe ao especialista, sem
   prometer reserva.
   {"message": "Perfeito! Vou te passar pro nosso especialista pra acompanhar a chegada do seu iPhone 15 com você. Qualquer coisa é só chamar!", "transfer": true}

Exemplo (passo 1+2 juntos):
{"message": "O iPhone 15 não está no estoque agora, mas costuma chegar rápido, às vezes no mesmo dia — quer que eu te avise quando entrar? Se preferir, tenho aqui o 15 Pro Max e já consigo simular com o seu aparelho como entrada.", "transfer": false}


`;

function patchBia1(sys) {
  if (sys.includes("MODELO EXATO INDISPONÍVEL")) return sys; // idempotent
  let out = sys;

  // E1 — remove the "apareceu por aqui" guidance.
  out = replaceOnce(
    out,
    `Use linguagem de pré-consulta ("apareceu por aqui", "vi opções"), nunca confirme como reserva/separação.`,
    `Fale de forma natural e consultiva ("temos", "tenho aqui", "consigo verificar"); nunca use "apareceu"; nunca confirme como reserva/separação.`,
    "E1 apareceu-guidance",
  );

  // E2 — point the no-stock bullet at the new block.
  out = replaceOnce(
    out,
    `- Se não houver estoque na pre-consulta, não prometa indisponibilidade definitiva; diga que vai verificar melhor ou chame especialista se fizer sentido.`,
    `- Se only_nearby_alternatives = true (o modelo exato não está, mas há um parecido), siga o bloco "MODELO EXATO INDISPONÍVEL" abaixo. Se não houver nada na pré-consulta, não prometa indisponibilidade definitiva; diga que vai verificar melhor ou chame especialista se fizer sentido.`,
    "E2 no-stock bullet",
  );

  // E3a — fix the PRE-CONSULTA example wording.
  out = replaceOnce(
    out,
    `{"message": "Temos iPhone 15 por aqui sim. Vi opções em 128GB e 256GB. Qual armazenamento você prefere?", "transfer": false}`,
    `{"message": "Temos iPhone 15 sim. Tenho em 128GB e 256GB. Qual armazenamento você prefere?", "transfer": false}`,
    "E3a example wording",
  );

  // E3b — insert the new block right before TRÊS TIPOS DE MENSAGEM INICIAL.
  out = replaceOnce(
    out,
    `TRÊS TIPOS DE MENSAGEM INICIAL`,
    MODELO_EXATO_BLOCK + `TRÊS TIPOS DE MENSAGEM INICIAL`,
    "E3b insert block",
  );

  return out;
}

// ---- Run ----
const workflow = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const wasActive = workflow.active;
const backupPath = `/tmp/repasse-workflow-${WORKFLOW_ID}-${Date.now()}.json`;
fs.writeFileSync(backupPath, JSON.stringify(workflow, null, 2));

const inv = workflow.nodes.find(n => n.name === "Code Build Inventory Lite");
if (!inv) throw new Error("Code Build Inventory Lite node not found");
inv.parameters.jsCode = patchInventoryLite(inv.parameters.jsCode);

const bia1 = workflow.nodes.find(n => n.name === "Bia 1");
if (!bia1) throw new Error("Bia 1 node not found");
bia1.parameters.options.systemMessage = patchBia1(bia1.parameters.options.systemMessage);

const body = {
  name: workflow.name,
  nodes: workflow.nodes,
  connections: workflow.connections,
  settings: { executionOrder: workflow.settings?.executionOrder ?? "v1" },
};

await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`, { method: "PUT", body: JSON.stringify(body) });

// Re-activate (footgun: PUT can leave the workflow OFF).
let activeAfter = false;
try {
  const activated = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}/activate`, { method: "POST" });
  activeAfter = activated?.active ?? false;
} catch (err) {
  activeAfter = `ACTIVATE_FAILED: ${err.message}`;
}

const verify = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const vInv = verify.nodes.find(n => n.name === "Code Build Inventory Lite").parameters.jsCode;
const vBia1 = verify.nodes.find(n => n.name === "Bia 1").parameters.options.systemMessage;

console.log(JSON.stringify({
  workflowId: verify.id,
  name: verify.name,
  wasActive,
  activeAfter,
  finalActive: verify.active,
  backupPath,
  invFlagsPatched: vInv.includes("desired_exact_available") && vInv.includes("only_nearby_alternatives"),
  bia1BlockPatched: vBia1.includes("MODELO EXATO INDISPONÍVEL"),
  bia1ApareceuRemoved: !vBia1.includes(`"apareceu por aqui"`),
}, null, 2));
