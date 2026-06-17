// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     Node13-Code Filtrar Resultados Estoque
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    60 simulacao-estoque
// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.
// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ FILTRAR ESTOQUE (v3.0)                                                  ║
// ║ - Match estrutural de modelo para evitar 16 = 16 Pro/Pro Max            ║
// ║ - Status explicitos de match para orientar Bia2                         ║
// ║ - Fuzzy match de cor por aliases brasileiros                            ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const ctx = $('Code Refresh Lead State Before Switch2').last().json;
// REPASSE NODE13 COMMERCE BACKFILL: o "Code Refresh Lead State Before Switch2"
// emite os campos de desejo/contexto na RAIZ; o sub-objeto ctx.memory só traz
// stock_*. Sem backfill, desired_model fica vazio -> modelMatch="not_requested"
// -> best_item ignora o modelo pedido e cai no item de maior score (Novo).
const __rawMemory = ctx.memory ?? {};
const memory = {
  ...__rawMemory,
  desired_model: __rawMemory.desired_model ?? ctx.desired_model ?? null,
  desired_capacity: __rawMemory.desired_capacity ?? ctx.desired_capacity ?? null,
  desired_color: __rawMemory.desired_color ?? ctx.desired_color ?? null,
  desired_condition: __rawMemory.desired_condition ?? ctx.desired_condition ?? null,
  desired_devices: __rawMemory.desired_devices ?? ctx.desired_devices ?? null,
  preferred_city: __rawMemory.preferred_city ?? ctx.preferred_city ?? null,
};

let items = [];
const httpItems = $input.all();
if (httpItems.length > 1) {
  items = httpItems.map(i => i.json);
} else if (httpItems.length === 1) {
  const firstJson = httpItems[0].json;
  items = Array.isArray(firstJson) ? firstJson : [firstJson];
}

const desired_model = memory.desired_model ?? "";
const desired_capacity = normalizeCapacity(memory.desired_capacity);
const desired_color = memory.desired_color ?? "";
const desired_condition = normalizeText(memory.desired_condition);
const preferred_city = normalizeText(memory.preferred_city);

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCapacity(raw) {
  // "128", "128GB", "128 gb" -> "128"; "1TB"/"1 tera" -> "1024"
  return normalizeText(raw)
    .replace(/\s/g, "")
    .replace(/^(\d+)(gb|gigas?|g)$/, "$1")
    .replace(/^1(tb|terabytes?|teras?|t)$/, "1024");
}

function parseIphoneModel(raw) {
  const normalized = normalizeText(raw);
  const generation = (normalized.match(/\b(\d{1,2})\b/) ?? [])[1] ?? null;
  let tier = "base";
  if (/\bpro\s*max\b/.test(normalized)) tier = "pro_max";
  else if (/\bpro\b/.test(normalized)) tier = "pro";
  else if (/\bplus\b/.test(normalized)) tier = "plus";
  else if (/\bse\b/.test(normalized)) tier = "se";
  return { normalized, generation, tier, hasTier: tier !== "base" };
}

function modelMatch(itemModel, desiredModel) {
  const item = parseIphoneModel(itemModel);
  const desired = parseIphoneModel(desiredModel);
  if (!desired.normalized) return { match: true, status: "not_requested" };
  if (!desired.generation) {
    return normalizeText(itemModel).includes(desired.normalized)
      ? { match: true, status: "family_only" }
      : { match: false, status: "not_found" };
  }
  if (item.generation !== desired.generation) return { match: false, status: "not_found" };
  if (desired.hasTier) {
    return item.tier === desired.tier
      ? { match: true, status: "exact" }
      : { match: false, status: "not_found" };
  }
  return item.tier === "base"
    ? { match: true, status: "exact" }
    : { match: true, status: "ambiguous" };
}

const COLOR_ALIASES = {
  "azul": ["azul", "azul profundo", "azul titanio", "azul claro", "ultramarino", "mist blue"],
  "preto": ["preto", "preto titanio", "preto meia noite", "preto espacial", "cinza espacial"],
  "branco": ["branco", "branco titanio", "branco estelar", "branco polar"],
  "cinza": ["cinza", "cinza espacial", "cinza titanio", "titanio natural", "natural"],
  "natural": ["titanio natural", "natural", "cinza"],
  "dourado": ["titanio deserto", "deserto", "dourado", "gold", "ouro"],
  "gold": ["titanio deserto", "deserto", "dourado", "gold", "ouro"],
  "deserto": ["titanio deserto", "deserto", "dourado"],
  "roxo": ["roxo", "roxo profundo", "lilas", "lavanda"],
  "lilas": ["lilas", "roxo", "lavanda"],
  "rosa": ["rosa", "rosa claro"],
  "verde": ["verde", "verde acinzentado", "verde alpino", "verde floresta"],
  "vermelho": ["vermelho", "product red", "red"],
  "red": ["vermelho", "product red", "red"],
  "titanio": ["titanio natural", "titanio preto", "titanio branco", "titanio deserto", "titanio"],
};

function colorMatch(itemColor, desiredColor) {
  if (!desiredColor) return { match: true, status: "not_requested" };
  const item = normalizeText(itemColor);
  const desired = normalizeText(desiredColor);
  if (item === desired) return { match: true, status: "exact" };
  if (item.includes(desired) || desired.includes(item)) return { match: true, status: "alias" };
  const targets = COLOR_ALIASES[desired] ?? [];
  if (targets.some(target => item.includes(normalizeText(target)) || normalizeText(target).includes(item))) {
    return { match: true, status: "alias" };
  }
  return { match: false, status: "not_found" };
}

function formatBatteryHealth(item) {
  if (normalizeText(item.condition) !== "seminovo") return null;
  if (item.battery_health == null) return null;
  return item.battery_health;
}

function formatItem(item) {
  const batteryHealth = formatBatteryHealth(item);
  return {
    stock_item_id: item.id,
    model: item.model,
    capacity: item.capacity,
    color: item.color,
    condition: item.condition,
    status: item.status,
    sell_price: item.sell_price,
    battery_health: batteryHealth,
    battery_health_label: batteryHealth !== null ? String(batteryHealth) + "%" : null,
    city: item.stores?.city ?? null,
    store_name: item.stores?.name ?? null,
  };
}

const modelEvaluated = items.map(item => ({ item, model: modelMatch(item.model, desired_model) }));
const byModel = modelEvaluated.filter(entry => entry.model.match).map(entry => entry.item);
const modelStatuses = modelEvaluated.filter(entry => entry.model.match).map(entry => entry.model.status);
let model_match_status = "not_found";
if (modelStatuses.includes("exact")) model_match_status = "exact";
else if (modelStatuses.includes("ambiguous")) model_match_status = "ambiguous";
else if (modelStatuses.includes("family_only")) model_match_status = "family_only";
else if (modelStatuses.includes("not_requested")) model_match_status = "not_requested";

const byModelAndCapacity = desired_capacity
  ? byModel.filter(item => normalizeCapacity(item.capacity) === desired_capacity)
  : byModel;
const capacity_match_status = !desired_capacity ? "not_requested" : (byModelAndCapacity.length > 0 ? "exact" : "fallback");
const capacityPool = byModelAndCapacity.length > 0 ? byModelAndCapacity : byModel;

const byCondition = desired_condition
  ? capacityPool.filter(item => normalizeText(item.condition) === desired_condition)
  : capacityPool;
const condition_match_status = !desired_condition ? "not_requested" : (byCondition.length > 0 ? "exact" : "fallback");
const conditionPool = byCondition.length > 0 ? byCondition : capacityPool;

const colorEvaluated = conditionPool.map(item => ({ item, color: colorMatch(item.color, desired_color) }));
const byColor = colorEvaluated.filter(entry => entry.color.match).map(entry => entry.item);
const colorStatuses = colorEvaluated.filter(entry => entry.color.match).map(entry => entry.color.status);
let color_match_status = "not_found";
if (!desired_color) color_match_status = "not_requested";
else if (colorStatuses.includes("exact")) color_match_status = "exact";
else if (colorStatuses.includes("alias")) color_match_status = "alias";

const colorPool = byColor.length > 0 ? byColor : conditionPool;

const cityItems = preferred_city
  ? colorPool.filter(item => normalizeText(item.stores?.city).includes(preferred_city))
  : colorPool;
const otherCityItems = preferred_city
  ? colorPool.filter(item => !normalizeText(item.stores?.city).includes(preferred_city))
  : [];

let inventory_found = false;
let cross_city = false;
let stock_city = null;
let available_items = [];

if (cityItems.length > 0) {
  inventory_found = true;
  stock_city = cityItems[0].stores?.city ?? null;
  available_items = cityItems;
} else if (otherCityItems.length > 0) {
  inventory_found = true;
  cross_city = true;
  stock_city = otherCityItems[0].stores?.city ?? null;
  available_items = otherCityItems;
}

const statusOrder = { "Disponível": 0, "Reservado": 1 };
const conditionOrder = { "Novo": 0, "Seminovo": 1 };

function optionScore(item) {
  let score = 0;
  if (normalizeText(item.status) === "disponivel") score += 30;
  if (normalizeText(item.condition) === "novo") score += 15;
  if (desired_capacity && normalizeCapacity(item.capacity) === desired_capacity) score += 25;
  const color = colorMatch(item.color, desired_color);
  if (color.status === "exact") score += 20;
  if (color.status === "alias") score += 12;
  if (preferred_city && normalizeText(item.stores?.city).includes(preferred_city)) score += 10;
  return score;
}

available_items.sort((a, b) =>
  optionScore(b) - optionScore(a) ||
  (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2) ||
  (conditionOrder[a.condition] ?? 2) - (conditionOrder[b.condition] ?? 2)
);

const best_item = available_items[0] ?? null;

const alternativesPool = preferred_city
  ? (byModel.filter(item => normalizeText(item.stores?.city).includes(preferred_city)).length > 0
      ? byModel.filter(item => normalizeText(item.stores?.city).includes(preferred_city))
      : byModel)
  : byModel;

const available_options = [];
const seen = new Set();
alternativesPool
  .sort((a, b) => optionScore(b) - optionScore(a))
  .forEach(item => {
    const key = [normalizeText(item.color), normalizeCapacity(item.capacity), normalizeText(item.condition)].join("__");
    if (seen.has(key)) return;
    seen.add(key);
    available_options.push({
      color: item.color,
      capacity: item.capacity,
      condition: item.condition,
      sell_price: item.sell_price,
      status: item.status,
      city: item.stores?.city ?? null,
      score: optionScore(item),
    });
  });

const available_colors = [...new Set(alternativesPool.map(item => item.color).filter(Boolean))];
const all_model_available_colors = [...new Set(byModel.map(item => item.color).filter(Boolean))];
const all_model_available_options = [];
const allModelSeen = new Set();
byModel
  .sort((a, b) => optionScore(b) - optionScore(a))
  .forEach(item => {
    const key = [normalizeText(item.color), normalizeCapacity(item.capacity), normalizeText(item.condition), normalizeText(item.stores?.city)].join("__");
    if (allModelSeen.has(key)) return;
    allModelSeen.add(key);
    all_model_available_options.push({
      model: item.model ?? null,
      capacity: item.capacity ?? null,
      color: item.color ?? null,
      condition: item.condition ?? null,
      city: item.stores?.city ?? null,
      sell_price: item.sell_price ?? null,
    });
  });
// #6: cores na MESMA capacidade pedida (mesmo modelo + mesmo armazenamento, so a cor muda) — ate 4
const reqCapNorm = normalizeCapacity(memory.desired_capacity) || (best_item ? normalizeCapacity(best_item.capacity) : null);
const available_colors_same_capacity = [...new Set(
  alternativesPool
    .filter(item => reqCapNorm && normalizeCapacity(item.capacity) === reqCapNorm)
    .map(item => item.color)
    .filter(Boolean)
)];
const inventory_block = available_items.map(formatItem);
const best_item_formatted = best_item ? formatItem(best_item) : null;


// REPASSE V2 MULTI QUOTE INVENTORY START
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

let color_status = "exact";
if (color_match_status === "not_found") color_status = "not_found";
else if (color_match_status === "alias") color_status = "fuzzy_match";
else if (color_match_status === "not_requested") color_status = "not_requested";

return [{
  json: {
    ...ctx,
    stock_city,
    cross_city_situation: cross_city,
    stock_item_id: best_item?.id ?? ctx.stock_item_id ?? memory.stock_item_id ?? null,
    memory: {
      ...memory,
      stock_city,
      cross_city_situation: cross_city,
      stock_item_id: best_item?.id ?? memory.stock_item_id ?? null,
      quote_items,
    },
    inventory_checked: true,
    inventory: {
      inventory_checked: true,
      inventory_found,
      cross_city_situation: cross_city,
      stock_city,
      stock_item_id: best_item?.id ?? null,
      best_item: best_item_formatted,
      available_items: inventory_block,
      model_match_status,
      capacity_match_status,
      color_match_status,
      condition_match_status,
      color_status,
      color_searched: memory.desired_color ?? null,
      color_found: best_item?.color ?? null,
      available_colors,
      available_colors_same_capacity,
      available_options,
      total_found: available_items.length,
      quote_items,
    },
    last_inventory_context: {
      checked_at: new Date().toISOString(),
      source: "inventory_search",
      query: {
        desired_model: memory.desired_model ?? null,
        desired_capacity: memory.desired_capacity ?? null,
        desired_color: memory.desired_color ?? null,
        desired_condition: memory.desired_condition ?? null,
        preferred_city: memory.preferred_city ?? null,
      },
      inventory_found,
      stock_city,
      cross_city_situation: cross_city,
      best_item: best_item_formatted,
      available_items: inventory_block.slice(0, 6),
      available_options: all_model_available_options.slice(0, 6),
      available_colors: all_model_available_colors.slice(0, 8),
      quote_items,
      note: "precheck nao confirma reserva; inventory_search e fonte forte para venda",
    },
  },
}];
