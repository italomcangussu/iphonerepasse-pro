// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     Code Build Inventory Lite
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    60 simulacao-estoque
// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.
// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====
// INVENTORY LITE — pre-consulta antes da Bia1.
// Usa estoque apenas para orientar a proxima pergunta. Nao confirma reserva e nao simula.
const ctx = $('Should Precheck Inventory').first().json;
const memory = ctx;

let items = [];
const httpItems = $input.all();
if (httpItems.length > 1) {
  items = httpItems.map(i => i.json);
} else if (httpItems.length === 1) {
  const firstJson = httpItems[0].json;
  items = Array.isArray(firstJson) ? firstJson : [firstJson];
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseIphoneModel(raw) {
  const normalized = normalizeText(raw);
  const generation = (normalized.match(/\b(\d{2})\b/) ?? [])[1] ?? null;
  let tier = "base";
  if (/\bpro\s*max\b/.test(normalized)) tier = "pro_max";
  else if (/\bpro\b/.test(normalized)) tier = "pro";
  else if (/\bplus\b/.test(normalized)) tier = "plus";
  else if (/\bse\b/.test(normalized)) tier = "se";
  return { normalized, generation, tier, hasTier: tier !== "base" };
}

const desired = parseIphoneModel(memory.desired_model);
const byFamily = items.filter(item => {
  const parsed = parseIphoneModel(item.model);
  if (!desired.generation) return desired.normalized && normalizeText(item.model).includes(desired.normalized);
  return parsed.generation === desired.generation;
});

const exact = byFamily.filter(item => {
  const parsed = parseIphoneModel(item.model);
  if (!desired.hasTier) return parsed.tier === "base";
  return parsed.tier === desired.tier;
});

const pool = exact.length > 0 ? exact : byFamily;
const modelNames = [...new Set(pool.map(i => i.model).filter(Boolean))];
const capacities = [...new Set(pool.map(i => i.capacity).filter(Boolean))];
const colors = [...new Set(pool.map(i => i.color).filter(Boolean))];
const conditions = [...new Set(pool.map(i => i.condition).filter(Boolean))];
const batteryHealths = [...new Set(pool.map(i => i.battery_health).filter(v => v !== null && v !== undefined && v !== ""))];
const prices = pool.map(i => Number(i.sell_price)).filter(Number.isFinite);

function formatOption(item) {
  return {
    model: item.model ?? null,
    capacity: item.capacity ?? null,
    color: item.color ?? null,
    condition: item.condition ?? null,
    battery_health: item.battery_health ?? null,
    city: item.stores?.city ?? null,
    sell_price: item.sell_price ?? null,
  };
}

// Ambiguidade = modelos DISTINTOS na familia; 2+ unidades do mesmo modelo
// nao sao ambiguidade (devem disparar o fluxo de alternativa proxima).
const familyModelKeys = new Set(byFamily.map(item => {
  const parsed = parseIphoneModel(item.model);
  return parsed.generation + ":" + parsed.tier;
}));
let model_match_status = "not_found";
if (exact.length > 0) model_match_status = "exact";
else if (familyModelKeys.size > 1) model_match_status = "ambiguous";
else if (byFamily.length > 0) model_match_status = "family_only";

let suggested_next_question = null;
if (model_match_status === "ambiguous") suggested_next_question = "clarify_model";
else if (!memory.desired_capacity && capacities.length > 1) suggested_next_question = "desired_capacity";
else if (!memory.desired_color && colors.length > 1) suggested_next_question = "desired_color";
else if (!memory.desired_condition && conditions.length > 1) suggested_next_question = "desired_condition";

return [{
  json: {
    ...ctx,
    pre_inventory: {
      pre_inventory_found: pool.length > 0,
      model_match_status,
      desired_exact_available: model_match_status === "exact",
      only_nearby_alternatives: pool.length > 0 && model_match_status !== "exact" && model_match_status !== "ambiguous",
      available_models: modelNames.slice(0, 8),
      available_capacities: capacities,
      available_colors: colors.slice(0, 8),
      available_conditions: conditions,
      available_battery_healths: batteryHealths,
      suggested_next_question,
      total_found: pool.length,
      note: "Contexto auxiliar para Bia1. Nao confirmar reserva, nao simular, nao prometer separacao."
    },
    last_inventory_context: {
      checked_at: new Date().toISOString(),
      source: "pre_inventory",
      query: {
        desired_model: memory.desired_model ?? null,
        desired_capacity: memory.desired_capacity ?? null,
        desired_color: memory.desired_color ?? null,
        desired_condition: memory.desired_condition ?? null,
        preferred_city: memory.preferred_city ?? null,
      },
      inventory_found: pool.length > 0,
      stock_city: null,
      cross_city_situation: false,
      best_item: null,
      available_items: [],
      available_options: pool.slice(0, 6).map(formatOption),
      available_colors: colors.slice(0, 8),
      available_battery_healths: batteryHealths,
      note: "precheck nao confirma reserva; inventory_search e fonte forte para venda",
    }
  }
}];
