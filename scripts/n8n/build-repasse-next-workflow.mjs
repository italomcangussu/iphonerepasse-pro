import { mkdir, readFile, writeFile } from 'node:fs/promises';
import crypto from 'node:crypto';

const sourcePath = 'output/n8n/ia-repasse-pro.current.json';
const outputPath = 'output/n8n/ia-repasse-pro-next.generated.json';
const targetWorkflowId = 'Cr4fPWe0prwS6XjI';
const nextWorkflowName = 'ia repasse-pro v2 avancada';
const nextWebhookPath = 'repasse-next';
const redisPrefix = 'repasse-next:';

const source = JSON.parse(await readFile(sourcePath, 'utf8'));

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }));
}

function findNode(workflow, name) {
  const node = workflow.nodes.find((item) => item.name === name);
  if (!node) throw new Error(`Node not found: ${name}`);
  return node;
}

function appendOnce(text, marker, block) {
  if (text.includes(marker)) return text;
  return `${text.trimEnd()}\n\n${block.trim()}\n`;
}

function replaceStrict(text, search, replacement, label) {
  if (!text.includes(search)) throw new Error(`Patch target not found for ${label}`);
  return text.replace(search, replacement);
}

function cloneFullWorkflow() {
  const workflow = deepClone(source);
  const idMap = new Map();

  workflow.nodes = workflow.nodes.map((node) => {
    const cloned = deepClone(node);
    const nextId = crypto.randomUUID();
    idMap.set(cloned.id, nextId);
    cloned.id = nextId;

    if (cloned.type === 'n8n-nodes-base.webhook') {
      cloned.webhookId = crypto.randomUUID();
      cloned.parameters = {
        ...cloned.parameters,
        path: nextWebhookPath,
      };
    }

    return cloned;
  });

  workflow.id = targetWorkflowId;
  workflow.name = nextWorkflowName;
  workflow.active = false;
  workflow.settings = {
    ...(workflow.settings ?? {}),
    executionOrder: workflow.settings?.executionOrder ?? 'v1',
    availableInMCP: true,
    callerPolicy: workflow.settings?.callerPolicy ?? 'workflowsFromSameOwner',
  };

  delete workflow.versionId;
  delete workflow.triggerCount;
  delete workflow.createdAt;
  delete workflow.updatedAt;
  delete workflow.shared;
  delete workflow.ownedBy;
  delete workflow.homeProject;
  delete workflow.usedCredentials;

  return workflow;
}

function patchRedisIsolation(workflow) {
  findNode(workflow, 'Redis Get Buffer').parameters.key = `={{ '${redisPrefix}' + $json.cliente.contact_id }}`;
  findNode(workflow, 'Redis Delete Buffer').parameters.key = `={{ '${redisPrefix}' + $('Code Consolidador Payload Final').item.json.cliente.talk_id }}`;
  findNode(workflow, 'Redis Get Lock').parameters.key = `={{ '${redisPrefix}lock:' + $json.talk_id }}`;
  findNode(workflow, 'Redis Delete Lock').parameters.key = `={{ '${redisPrefix}lock:' + $json.cliente.talk_id }}`;

  const atualizar = findNode(workflow, 'Atualizar Estado Buffer');
  atualizar.parameters.jsCode = replaceStrict(
    atualizar.parameters.jsCode,
    'redis_key:   merged.talk_id,',
    `redis_key:   '${redisPrefix}' + merged.talk_id,`,
    'Atualizar Estado Buffer redis key',
  );

  const tentarLock = findNode(workflow, 'Tentar Lock');
  tentarLock.parameters.jsCode = replaceStrict(
    tentarLock.parameters.jsCode,
    'lock_key: `lock:${talkId}`,',
    `lock_key: \`${redisPrefix}lock:\${talkId}\`,`,
    'Tentar Lock lock key',
  );
}

function patchMemoryPrompts(workflow) {
  const memory1 = findNode(workflow, 'Memory 1 - Extractor');
  memory1.parameters.options.systemMessage = appendOnce(
    memory1.parameters.options.systemMessage,
    'REPASSE V2 MULTI DEVICE EXTRACTION',
    `
// REPASSE V2 MULTI DEVICE EXTRACTION
- Se a mensagem pedir dois iPhones de uma vez, preencha facts.desired_devices com ate 2 itens.
- Cada item deve ter slot, desired_model, desired_capacity, desired_color e desired_condition quando observavel.
- Nao substitua desired_model/desired_capacity principal; desired_devices e complementar para simulacao conjunta.
- Se houver aparelho de entrada, mantenha os campos tradein_* existentes; nao duplique trade-in para cada item.
`,
  );

  const memory2 = findNode(workflow, 'Memory 2 - Reconciler');
  memory2.parameters.options.systemMessage = appendOnce(
    memory2.parameters.options.systemMessage,
    'REPASSE V2 MULTI DEVICE RECONCILIATION',
    `
// REPASSE V2 MULTI DEVICE RECONCILIATION
- Preserve e reconcilie desired_devices quando o cliente pedir ate dois aparelhos na mesma negociacao.
- desired_devices deve ter no maximo 2 itens, cada um com slot, desired_model, desired_capacity, desired_color e desired_condition quando existirem.
- Se so houver um aparelho, mantenha tambem os campos antigos desired_model, desired_capacity, desired_color e desired_condition.
- Nao invente segundo aparelho. Nao use desired_devices para acessorios, garantia, reparo ou assunto fora de venda/troca.
`,
  );
}

function patchInventoryMultiQuote(workflow) {
  const node = findNode(workflow, 'Node13-Code Filtrar Resultados Estoque');
  const marker = '// REPASSE V2 MULTI QUOTE INVENTORY START';
  if (node.parameters.jsCode.includes(marker)) return;

  const injection = `
${marker}
function normalizeDeviceRequest(raw, index) {
  if (!raw || typeof raw !== "object") return null;
  const model = raw.desired_model ?? raw.model ?? raw.device_model ?? "";
  const capacity = raw.desired_capacity ?? raw.capacity ?? "";
  if (!model && !capacity) return null;
  return {
    slot: Number(raw.slot) || index + 1,
    desired_model: model,
    desired_capacity: capacity,
    desired_color: raw.desired_color ?? raw.color ?? "",
    desired_condition: raw.desired_condition ?? raw.condition ?? "",
  };
}

const desiredDevices = Array.isArray(memory.desired_devices)
  ? memory.desired_devices.map(normalizeDeviceRequest).filter(Boolean).slice(0, 2)
  : [];

function scoreForDevice(item, device) {
  let score = 0;
  if (normalizeText(item.status) === "disponivel") score += 30;
  if (normalizeText(item.condition) === "novo") score += 15;
  if (device.desired_capacity && normalizeCapacity(item.capacity) === normalizeCapacity(device.desired_capacity)) score += 25;
  const color = colorMatch(item.color, device.desired_color);
  if (color.status === "exact") score += 20;
  if (color.status === "alias") score += 12;
  if (preferred_city && normalizeText(item.stores?.city).includes(preferred_city)) score += 10;
  return score;
}

function selectItemForDevice(device) {
  const modelPool = items.filter(item => modelMatch(item.model, device.desired_model).match);
  const capacityPool = device.desired_capacity
    ? modelPool.filter(item => normalizeCapacity(item.capacity) === normalizeCapacity(device.desired_capacity))
    : modelPool;
  const conditionPool = device.desired_condition
    ? (capacityPool.length ? capacityPool : modelPool).filter(item => normalizeText(item.condition) === normalizeText(device.desired_condition))
    : (capacityPool.length ? capacityPool : modelPool);
  const colorEvaluatedForDevice = (conditionPool.length ? conditionPool : capacityPool.length ? capacityPool : modelPool)
    .map(item => ({ item, color: colorMatch(item.color, device.desired_color) }));
  const colorPoolForDevice = colorEvaluatedForDevice.filter(entry => entry.color.match).map(entry => entry.item);
  const pool = colorPoolForDevice.length
    ? colorPoolForDevice
    : conditionPool.length ? conditionPool : capacityPool.length ? capacityPool : modelPool;
  const sorted = [...pool].sort((a, b) => scoreForDevice(b, device) - scoreForDevice(a, device));
  const best = sorted[0] ?? null;
  return {
    ...device,
    inventory_found: Boolean(best),
    stock_item_id: best?.id ?? null,
    best_item: best ? formatItem(best) : null,
    available_options: sorted.slice(0, 6).map(formatItem),
  };
}

const quote_items = desiredDevices.length > 1
  ? desiredDevices.map(selectItemForDevice)
  : [];
// REPASSE V2 MULTI QUOTE INVENTORY END
`;

  node.parameters.jsCode = node.parameters.jsCode.replace(
    'let color_status = "exact";',
    `${injection}\nlet color_status = "exact";`,
  );

  node.parameters.jsCode = replaceStrict(
    node.parameters.jsCode,
    'stock_item_id: best_item?.id ?? memory.stock_item_id ?? null,',
    'stock_item_id: best_item?.id ?? memory.stock_item_id ?? null,\n      quote_items,',
    'memory quote_items',
  );

  node.parameters.jsCode = replaceStrict(
    node.parameters.jsCode,
    'total_found: available_items.length,',
    'total_found: available_items.length,\n      quote_items,',
    'inventory quote_items',
  );

  node.parameters.jsCode = replaceStrict(
    node.parameters.jsCode,
    'available_colors: all_model_available_colors.slice(0, 8),',
    'available_colors: all_model_available_colors.slice(0, 8),\n      quote_items,',
    'last_inventory_context quote_items',
  );
}

function patchSimulatorNodes(workflow) {
  const montarBody = findNode(workflow, 'Montar Body do Simulador');
  montarBody.parameters.jsCode = `const inputData = $input.first().json;
const decision = inputData.router ?? inputData.alana ?? {};
const memory = inputData.memory ?? inputData;
const inventory = inputData.inventory ?? {};

function toPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function compactQuoteItems(...sources) {
  const seen = new Set();
  const output = [];
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const item of source) {
      const stockItemId = item?.stock_item_id ?? item?.stockItemId ?? item?.best_item?.stock_item_id ?? item?.desiredDevice?.stockItemId;
      if (!stockItemId || seen.has(String(stockItemId))) continue;
      seen.add(String(stockItemId));
      output.push({
        slot: Number(item?.slot) || output.length + 1,
        stockItemId: String(stockItemId),
      });
      if (output.length >= 2) return output;
    }
  }
  return output;
}

const quoteItems = compactQuoteItems(
  decision.rerun_quote_items,
  decision.quote_items,
  inventory.quote_items,
  memory.quote_items,
  memory.desired_devices,
);

const stockItemId =
  decision.rerun_stock_item_id ??
  decision.stock_item_id ??
  memory.stock_item_id ??
  inputData.stock_item_id ??
  inventory.stock_item_id ??
  inventory.best_item?.stock_item_id ??
  quoteItems[0]?.stockItemId;

if (!stockItemId) {
  throw new Error("[Montar Body do Simulador] stock_item_id obrigatorio antes de chamar simulador. Consulte estoque e selecione um item valido antes de simular.");
}

let tradeIn = null;
if (memory.has_tradein &&
    memory.tradein_model_accepted !== false &&
    memory.tradein_disqualified === false &&
    memory.tradein_model) {
  tradeIn = {
    model:    memory.tradein_model,
    capacity: memory.tradein_capacity ?? "",
    color:    memory.tradein_color ?? ""
  };
}

const entries = [];
const decisionEntries = Array.isArray(decision.rerun_simulation_entries) ? decision.rerun_simulation_entries : [];

for (const entry of decisionEntries) {
  const amount = toPositiveNumber(entry?.amount);
  if (amount) entries.push({ type: entry.type || "Pix", amount });
}

const decisionEntryAmount = toPositiveNumber(decision.rerun_simulation_entry_amount);
const cashEntryAmount = toPositiveNumber(memory.cash_entry_amount ?? inputData.cash_entry_amount);
const nextBestAction = decision.next_best_action ?? memory.next_best_action ?? inputData.next_best_action;

if (!entries.length && decisionEntryAmount) {
  entries.push({ type: "Pix", amount: decisionEntryAmount });
} else if (!entries.length && cashEntryAmount) {
  entries.push({ type: "Pix", amount: cashEntryAmount });
} else if (!entries.length && nextBestAction === "re-simular com PIX 250 como entrada") {
  entries.push({ type: "Pix", amount: 250 });
}

const cardBrand = decision.card_brand ?? memory.card_brand ?? inputData.card_brand ?? "visa_master";
const shouldUseMultiQuote = quoteItems.length > 1;

let body;
if (shouldUseMultiQuote) {
  body = {
    cardBrand,
    quotes: quoteItems.slice(0, 2).map((item, index) => ({
      slot: item.slot || index + 1,
      desiredDevice: { stockItemId: item.stockItemId },
      ...(index === 0 && tradeIn ? { tradeIn } : {}),
      ...(index === 0 && entries.length ? { entries } : {}),
    })),
  };
} else {
  body = { desiredDevice: { stockItemId }, cardBrand };
  if (tradeIn) body.tradeIn = tradeIn;
  if (entries.length) body.entries = entries;
}

const output = {
  ...inputData,
  stock_item_id: stockItemId,
  quote_items: quoteItems,
  simulator_body: body
};

if (inputData.memory) {
  output.memory = {
    ...memory,
    stock_item_id: stockItemId,
    quote_items: quoteItems,
    next_best_action: nextBestAction
  };
}

return [{ json: output }];`;

  const parseSimulator = findNode(workflow, 'Parse Simulator');
  parseSimulator.parameters.jsCode = `const ctx = $('Montar Body do Simulador').first().json;
const resp = $input.first().json;
const memory = ctx.memory ?? ctx;

if (resp.error || resp.statusCode >= 400 || resp.success === false) {
  return [{
    json: {
      ...ctx,
      simulation_result: null,
      simulation_error: true,
      memory: {
        ...memory,
        next_best_action: "transferir para especialista repasse"
      }
    }
  }];
}

const simulation_text = resp.messageText ?? resp.message ?? resp.text ?? JSON.stringify(resp);
const new_count = Number(memory.simulation_count ?? 0) + 1;
const total = resp.combinedSummary?.totalCardNetAmount ?? resp.total ?? resp.summary?.cardNetAmount ?? null;

return [{
  json: {
    ...ctx,
    simulation_result: {
      text:          simulation_text,
      count:         new_count,
      body_used:     ctx.simulator_body,
      quotes:        resp.quotes ?? null,
      combined:      resp.combinedSummary ?? null,
      partial:       resp.partial ?? false
    },
    memory: {
      ...memory,
      simulation_done:        true,
      simulation_count:       new_count,
      last_simulation_total:  total,
      last_simulation_quotes: resp.quotes ?? null
    }
  }
}];`;
}

function patchBia2Prompt(workflow) {
  const bia2 = findNode(workflow, 'Bia 2 ESTOQUE');
  bia2.parameters.text = appendOnce(
    bia2.parameters.text,
    'REPASSE V2 MULTI DEVICE CONTEXT',
    `
=== REPASSE V2 MULTI DEVICE CONTEXT ===
Aparelhos solicitados para simulacao conjunta:
{{ JSON.stringify($json.inventory?.quote_items ?? $json.memory?.quote_items ?? []) }}

Se houver simulation_result.combined ou mais de uma quote, trate como simulacao de ate dois aparelhos.
Explique cada aparelho de forma separada e objetiva, sem duplicar trade-in ou entrada.
Se apenas um dos dois aparelhos foi encontrado, explique o parcial e ofereca continuidade com especialista ou ajuste de modelo/cor.
`,
  );

  bia2.parameters.options.systemMessage = appendOnce(
    bia2.parameters.options.systemMessage,
    'REPASSE V2 MULTI SIMULATION RULES',
    `
// REPASSE V2 MULTI SIMULATION RULES
- Quando o cliente pedir dois aparelhos, mantenha a negociacao em uma resposta unica.
- Se pedir nova simulacao para dois aparelhos ja identificados, use rerun_simulation: true e, se precisar trocar itens especificos, inclua rerun_quote_items com ate 2 objetos {slot, stock_item_id}.
- Nunca desconte o mesmo trade-in duas vezes. Se o sistema retornar dois blocos, trate o aparelho de entrada como aplicado somente ao primeiro quando for o caso.
`,
  );
}

function buildWorkflow() {
  const workflow = cloneFullWorkflow();
  patchRedisIsolation(workflow);
  patchMemoryPrompts(workflow);
  patchInventoryMultiQuote(workflow);
  patchSimulatorNodes(workflow);
  patchBia2Prompt(workflow);
  return workflow;
}

function buildPublicApiUpdateBody(workflow) {
  return {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
  };
}

async function n8nFetch(origin, apiKey, pathname, options = {}) {
  const response = await fetch(new URL(pathname, origin), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': apiKey,
      ...(options.headers ?? {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`n8n API ${response.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

const workflow = buildWorkflow();

await mkdir('output/n8n', { recursive: true });
await writeFile(outputPath, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(JSON.stringify({
  generated: true,
  outputPath,
  name: workflow.name,
  active: workflow.active,
  nodeCount: workflow.nodes.length,
  webhookPath: nextWebhookPath,
}, null, 2));

if (process.argv.includes('--deploy') || process.argv.includes('--update')) {
  const env = parseEnv(await readFile('.env.local', 'utf8'));
  if (!env.N8N_PUBLIC_API || !env.N8N_MCP_URL) {
    throw new Error('Missing N8N_PUBLIC_API or N8N_MCP_URL in .env.local');
  }

  const origin = new URL(env.N8N_MCP_URL).origin;
  const before = await n8nFetch(origin, env.N8N_PUBLIC_API, `/api/v1/workflows/${targetWorkflowId}`);
  if (before.active) {
    await n8nFetch(origin, env.N8N_PUBLIC_API, `/api/v1/workflows/${targetWorkflowId}/deactivate`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  const updated = await n8nFetch(origin, env.N8N_PUBLIC_API, `/api/v1/workflows/${targetWorkflowId}`, {
    method: 'PUT',
    body: JSON.stringify(buildPublicApiUpdateBody(workflow)),
  });

  console.log(JSON.stringify({
    deployed: true,
    workflowId: updated.id,
    name: updated.name,
    active: updated.active,
    nodeCount: updated.nodes?.length ?? 0,
    wasActive: before.active,
  }, null, 2));
}
