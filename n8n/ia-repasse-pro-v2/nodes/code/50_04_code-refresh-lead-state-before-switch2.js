// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     Code Refresh Lead State Before Switch2
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    50 leadstate-flags
// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.
// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====
const inputData = $('Edit Fields5').last().json;
const crmResponse = $input.first().json ?? {};
// REPASSE SWITCH2 ROUTING FLAGS: o Code Routing Flags (após Edit Fields5)
// é o dono das flags transitórias; o spread de inputData não as traz.
const routingFlags = $('Code Routing Flags').last().json ?? {};

function parseMaybeJson(value) {
  if (value == null) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function firstObject(candidates) {
  for (const candidate of candidates) {
    const parsed = parseMaybeJson(candidate);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  }
  return {};
}

function readLeadState(response) {
  const data = response?.data ?? {};
  const firstLead = Array.isArray(data?.leads) ? data.leads[0] : null;
  const firstConversation = Array.isArray(data?.conversations) ? data.conversations[0] : null;
  return firstObject([
    response?.lead_state,
    response?.leadState,
    response?.state,
    data?.lead_state,
    data?.leadState,
    data?.state,
    data?.lead?.lead_state,
    data?.lead?.state,
    firstLead?.lead_state,
    firstLead?.state,
    firstConversation?.lead_state,
    firstConversation?.state,
    firstConversation?.lead?.lead_state,
    firstConversation?.lead?.state,
  ]);
}

function pickFirstPresent(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
}

const leadState = readLeadState(crmResponse);
const persistedInventory = leadState.last_inventory_context ?? leadState.memory?.last_inventory_context ?? null;
const refreshedStockItemId = pickFirstPresent(
  inputData.stock_item_id,
  inputData.memory?.stock_item_id,
  inputData.inventory?.stock_item_id,
  inputData.inventory?.best_item?.stock_item_id,
  leadState.stock_item_id,
  leadState.memory?.stock_item_id,
  leadState.last_inventory_context?.stock_item_id,
  leadState.last_inventory_context?.best_item?.stock_item_id,
  persistedInventory?.stock_item_id,
  persistedInventory?.best_item?.stock_item_id
);
const refreshedStockCity = pickFirstPresent(
  inputData.stock_city,
  inputData.memory?.stock_city,
  leadState.stock_city,
  leadState.memory?.stock_city,
  persistedInventory?.stock_city,
  persistedInventory?.best_item?.city
);
const refreshedCrossCity = pickFirstPresent(
  inputData.cross_city_situation,
  inputData.memory?.cross_city_situation,
  leadState.cross_city_situation,
  leadState.memory?.cross_city_situation,
  persistedInventory?.cross_city_situation
) ?? false;
const lastInventoryContext = inputData.last_inventory_context ?? inputData.memory?.last_inventory_context ?? persistedInventory ?? null;

const nextBestAction = inputData.next_best_action ?? inputData.memory?.next_best_action ?? leadState.next_best_action ?? leadState.memory?.next_best_action ?? null;
const simulationCount = Number(inputData.simulation_count ?? inputData.memory?.simulation_count ?? leadState.simulation_count ?? leadState.memory?.simulation_count ?? 0);
const wantsSimulation = [
  "simular orçamento",
  "simular orcamento",
  "re-simular com cor alternativa",
  "re-simular com PIX 250 como entrada",
].includes(nextBestAction);
const shouldSimulateNow = routingFlags.shouldSimulateNow === true || inputData.shouldSimulateNow === true || inputData.memory?.shouldSimulateNow === true || (
  !!refreshedStockItemId &&
  (routingFlags.context_ready === true || inputData.context_ready === true) &&
  !!inputData.card_brand &&
  inputData.simulation_done !== true &&
  simulationCount < 3 &&
  inputData.tradein_disqualified !== true &&
  inputData.tradein_model_accepted !== false &&
  wantsSimulation
);

return [{
  json: {
    ...inputData,
    lead_state: leadState,
    stock_item_id: refreshedStockItemId,
    stock_city: refreshedStockCity,
    cross_city_situation: refreshedCrossCity,
    last_inventory_context: lastInventoryContext,
    shouldSimulateNow,
    shouldSearchInventory: routingFlags.shouldSearchInventory === true,
    context_ready: (routingFlags.context_ready === true || inputData.context_ready === true),
    next_best_action: routingFlags.next_best_action ?? inputData.next_best_action ?? nextBestAction,
    memory: {
      ...(inputData.memory ?? {}),
      stock_item_id: refreshedStockItemId,
      stock_city: refreshedStockCity,
      cross_city_situation: refreshedCrossCity,
      last_inventory_context: lastInventoryContext,
      shouldSimulateNow,
    },
  },
}];
