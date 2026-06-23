// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     Code Routing Flags
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    50 leadstate-flags
// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.
// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====
// ============================================================================
// Code Routing Flags — node DETERMINÍSTICO de roteamento (Bucket 4).
// Posição: Edit Fields5 -> [Code Routing Flags] -> Switch3.
//
// Por quê: a deleção manual do "Parse Memory" removeu quem computava as flags
// shouldSearchInventory / shouldUseBia1 / shouldUseBia2NoStock /
// shouldUseBia2Continuation / shouldStopAsSpam / shouldPrecheckInventory /
// shouldSimulateNow. O Switch3 lê essas flags de $json e NÃO tem fallbackOutput,
// então com tudo null o item é descartado -> bot mudo. Este node restaura a
// árvore de decisão determinística do antigo Parse Memory, mas SEM reconciliar
// lead_state (o "Memory 2 - Reconciler" é o dono do estado semântico). Ele só
// LÊ o estado já reconciliado (Edit Fields5) e calcula o roteamento do turno.
//
// Contrato n8n: "Run Once for All Items"; retorna [{ json: {...state, flags} }].
// Não persiste nada: POST Lead_State/Update Memory leem de $('Edit Fields5'),
// então as flags aqui são transitórias (recalculadas a cada turno).
// ============================================================================

const state = { ...$input.first().json };
state.needsPickupCity = false; // D1: cidade de retirada só após simulação aceita

// ---- helpers (espelham o Parse Memory removido) ----
function normalizeFreeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isDeviceSalesIntent(intent) {
  return ["aparelho_iphone", "aparelho_outro"].includes(intent);
}

function isIphonePurchaseFlow(m) {
  const deviceIntent = ["aparelho_iphone", "aparelho_outro"].includes(m.intent);
  const buyInterest = ["comprar", "trocar"].includes(m.interest_type);
  // multi-cotação: pedir 2 modelos é intenção de compra mesmo sem interest_type
  // explícito (a info do cliente foi para desired_devices, não para os campos single).
  const multiDevices = Array.isArray(m.desired_devices) &&
    m.desired_devices.filter((d) => d && (d.desired_model || d.model) && (d.desired_capacity || d.capacity)).length > 1;
  return deviceIntent && (buyInterest || multiDevices);
}

function tradeinEvaluationComplete(m) {
  if (!m.has_tradein) return true;
  if (m.tradein_model_accepted === false) return true;
  if (m.tradein_disqualified === true) return true;
  return (
    m.tradein_capacity !== null && m.tradein_capacity !== undefined &&
    m.tradein_color !== null && m.tradein_color !== undefined &&
    m.tradein_scratches !== null && m.tradein_scratches !== undefined &&
    m.tradein_liquid_contact !== null && m.tradein_liquid_contact !== undefined &&
    m.tradein_side_marks !== null && m.tradein_side_marks !== undefined &&
    m.tradein_parts_swapped !== null && m.tradein_parts_swapped !== undefined &&
    // tradein_has_box_cable NÃO entra: é texto livre informativo, não altera a
    // simulação. Exigi-lo aqui travava a cotação quando o cliente respondia algo
    // diferente de sim/não (ex.: "somente caixa").
    m.tradein_battery_pct !== null && m.tradein_battery_pct !== undefined &&
    m.tradein_apple_warranty !== null && m.tradein_apple_warranty !== undefined
  );
}

function shouldRequireDesiredColor(/* m */) {
  // FLUXO: cor não é necessária para simular — vem como sugestão pós-simulação.
  return false;
}

function setMainRoute(flag, decision) {
  state.shouldSearchInventory = false;
  state.shouldUseBia1 = false;
  state.shouldUseBia2NoStock = false;
  state.shouldUseBia2Continuation = false;
  state.shouldStopAsSpam = false;
  state.shouldSendOperationalHandoff = false;
  state[flag] = true;
  if (flag === "shouldUseBia2Continuation") state.shouldUseBia2NoStock = true;
  state.routing_decision = decision;
}

// ---- mensagem atual (para sinais multi-quote bundle/comparison) ----
function readCurrentMessageFromWorkflow() {
  try {
    if (typeof $ === "function") {
      return (
        $("Edit Fields4").last().json?.buffer?.message_buffered ??
        $("Load Buffer Final").last().json?.buffer?.message_buffered ??
        ""
      );
    }
  } catch (e) {
    return "";
  }
  return "";
}
const currentMessageRaw = String(
  state.message_buffered ??
  state.buffer?.message_buffered ??
  readCurrentMessageFromWorkflow() ??
  ""
);
const currentMessageText = normalizeFreeText(currentMessageRaw);

// ---- pré-cálculos ----
const intent = state.intent ?? "";
const tradeinOk = tradeinEvaluationComplete(state);
// D5: "iPhone 13/14/15" sem tier explícito exige confirmar normal/Pro/Pro Max.
function modelLacksTier(model) {
  const s = String(model ?? "").toLowerCase();
  const hasGen = /\biphone\s*1[0-9]\b/.test(s);
  const hasTier = /\b(pro\s*max|pro|plus|se|mini)\b/.test(s);
  return hasGen && !hasTier;
}
const needsModelTier = isIphonePurchaseFlow(state) && modelLacksTier(state.desired_model);
state.needs_model_tier_confirmation = needsModelTier === true;
const cashEntryOk = state.cash_entry_intent !== true || (state.cash_entry_amount !== null && state.cash_entry_amount !== undefined);
// Antes de simular, a IA deve perguntar se o cliente quer dar algum valor de
// entrada (dinheiro/Pix) e financiar o restante no cartão. Consideramos a
// entrada "resolvida" quando já perguntamos (cash_entry_asked) OU o cliente já
// manifestou intenção (cash_entry_intent true/false, com ou sem valor).
const cashEntryAsked = state.cash_entry_asked === true;
// D3 (anti-reask): também consideramos resolvida quando o cliente já informou o
// VALOR (cash_entry_amount), mesmo que o reconciler não tenha setado o intent —
// foi o que travou o caso VD ("Queria dar 500" e a IA reperguntou 4×).
const cashEntryResolved =
  cashEntryAsked === true ||
  state.cash_entry_intent != null ||
  state.cash_entry_amount != null;

// Trade-in (aparelho de entrada/troca): a IA deve perguntar logo apos identificar
// o modelo desejado se o cliente tem um aparelho para dar de entrada/troca, ANTES
// de avancar para capacidade/estoque/simulacao. Espelha o gate de cash_entry.
// "Resolvido" quando ja perguntamos (tradein_asked, latch sticky no upsert) OU o
// cliente ja declarou ter trade-in (has_tradein) OU ja identificamos um modelo de
// entrada (tradein_model). has_tradein=false NAO basta: e o default e nao
// distingue "nunca perguntei" de "perguntei e nao tem".
const tradeinAsked = state.tradein_asked === true;
const tradeinResolved =
  tradeinAsked === true ||
  state.has_tradein === true ||
  (state.tradein_model !== null && state.tradein_model !== undefined && state.tradein_model !== '');

// Bateria suspeita: aparelho antigo (iPhone 13 ou anterior) com % de bateria alta
// declarada e SEM troca de bateria é incoerente (esses aparelhos costumam estar
// perto de 80%). A IA não pode cotar o trade-in nesse caso — exige avaliação
// humana. Aqui NUNCA se promete simulação: força transferência. Respeita também o
// flag tradein_battery_suspect vindo do Memory 2.
function tradeinModelNumber(model) {
  const m = String(model ?? "").match(/iphone\s*(\d{1,2})/i);
  return m ? Number(m[1]) : null;
}
const tradeinModelNum = tradeinModelNumber(state.tradein_model);
const batteryPct = state.tradein_battery_pct == null ? null : Number(state.tradein_battery_pct);
const batteryImplausible = (
  batteryPct != null && !Number.isNaN(batteryPct) && batteryPct >= 90 &&
  tradeinModelNum != null && tradeinModelNum <= 13 &&
  state.tradein_parts_swapped !== true
);
const tradeinBatterySuspect = state.has_tradein === true &&
  state.tradein_model_accepted !== false &&
  state.tradein_disqualified !== true &&
  (state.tradein_battery_suspect === true || batteryImplausible === true);
if (tradeinBatterySuspect === true) state.tradein_battery_suspect = true;
// Condições do aparelho que impedem a COTAÇÃO AUTOMÁTICA do trade-in: contato com
// líquido, arranhões ou peça trocada. Esses casos alteram o valor e não podem ser
// simulados automaticamente — exigem avaliação humana (mesmo tratamento da bateria
// suspeita: nunca simula, transfere). Caixa/cabo NÃO entra (não altera a simulação).
const tradeinConditionBlocks = state.has_tradein === true &&
  state.tradein_model_accepted !== false &&
  state.tradein_disqualified !== true &&
  (state.tradein_liquid_contact === true ||
   state.tradein_scratches === true ||
   state.tradein_parts_swapped === true);
if (tradeinConditionBlocks === true) state.tradein_condition_blocks = true;
const postSimulationFlow = Boolean(
  state.simulation_done === true ||
  Number(state.simulation_count ?? 0) > 0 ||
  (state.last_simulation_total !== null && state.last_simulation_total !== undefined && state.last_simulation_total !== "")
);

// REPASSE V2 MULTI QUOTE READINESS
const repasseV2DesiredDevices = Array.isArray(state.desired_devices)
  ? state.desired_devices.filter(d => d && (d.desired_model || d.model) && (d.desired_capacity || d.capacity)).slice(0, 2)
  : [];
const repasseV2MultiQuoteReady = repasseV2DesiredDevices.length > 1;
const repasseV2BundleSignal = /\b(comprar|levar|fechar|reservar)\b.*\b(os dois|2 aparelhos|dois aparelhos|ambos)\b|\b(um pra mim|um para mim)\b.*\b(outro|outra)\b/.test(currentMessageText);
const repasseV2ComparisonSignal = /\b(ou|versus|vs|comparar|comparativo|qual compensa|quanto fica nos dois|diferenca|em cada um|para os dois)\b/.test(currentMessageText);
if (repasseV2MultiQuoteReady) {
  state.simulation_mode = repasseV2BundleSignal && !repasseV2ComparisonSignal ? "bundle" : "comparison";
}
const repasseV2TradeinReadyForSimulation = state.has_tradein !== true || (
  state.tradein_model_accepted !== false && state.tradein_disqualified !== true && tradeinBatterySuspect !== true && tradeinConditionBlocks !== true && tradeinOk === true
);
const repasseV2CanRequestSimulation = (
  isIphonePurchaseFlow(state) &&
  repasseV2MultiQuoteReady === true &&
  repasseV2TradeinReadyForSimulation === true &&
  cashEntryOk === true &&
  cashEntryResolved === true &&
  tradeinResolved === true &&
  state.simulation_done !== true &&
  Number(state.simulation_count ?? 0) < 3
);

// context_ready determinístico
if (isDeviceSalesIntent(intent)) {
  const interest = state.interest_type;
  if (["comprar", "trocar"].includes(interest)) {
    // FLUXO: cor/condição do DESEJADO NÃO são pré-requisito para simular — são
    // resolvidas pelo estoque (cor vira sugestão pós-simulação). Como a IA parou de
    // perguntar a cor do desejado, exigir desired_color||desired_condition aqui
    // deixava context_ready=false e a conversa presa na Bia 1 (bia1_pre_inventory).
    const desiredOk = !!(state.desired_model && state.desired_capacity) && !needsModelTier;
    state.context_ready = desiredOk && tradeinOk && cashEntryOk;
  } else if (["vender", "avaliar"].includes(interest)) {
    state.context_ready = !!state.tradein_model && tradeinOk;
  } else {
    state.context_ready = false;
  }
} else if (["fora_do_escopo", "suporte", "pos_venda", "administrativo", "garantia"].includes(intent)) {
  state.context_ready = true;
} else {
  state.context_ready = false;
}

// missing_fields determinístico
const missing = [];
if (isDeviceSalesIntent(intent)) {
  const interest = state.interest_type;
  if (!interest) {
    missing.push("interest_type");
  } else {
    if (["comprar", "trocar"].includes(interest)) {
      if (!state.desired_model) missing.push("desired_model");
      if (!state.desired_capacity) missing.push("desired_capacity");
      if (!state.desired_color && shouldRequireDesiredColor(state)) missing.push("desired_color");
    }
    if (["vender", "avaliar"].includes(interest) && !state.tradein_model) missing.push("tradein_model");
  }
  if (state.has_tradein && state.tradein_model && state.tradein_model_accepted !== false && state.tradein_disqualified !== true) {
    if (state.tradein_capacity == null) missing.push("tradein_capacity");
    if (state.tradein_color == null) missing.push("tradein_color");
    if (state.tradein_liquid_contact == null) missing.push("tradein_liquid_contact");
    if (state.tradein_side_marks == null) missing.push("tradein_side_marks");
    if (state.tradein_parts_swapped == null) missing.push("tradein_parts_swapped");
    // tradein_has_box_cable é texto livre informativo (não bloqueia simulação) —
    // não entra em missing_fields.
    if (state.tradein_battery_pct == null) missing.push("tradein_battery_pct");
    if (state.tradein_apple_warranty == null) missing.push("tradein_apple_warranty");
    if (state.tradein_scratches == null) missing.push("tradein_scratches");
  }
  if (state.cash_entry_intent === true && state.cash_entry_amount == null) missing.push("cash_entry_amount");
  if (needsModelTier && !missing.includes("model_tier")) missing.push("model_tier");
}
state.missing_fields = missing;
state.tradein_evaluation_pending = (
  state.has_tradein === true && state.tradein_model_accepted !== false && state.tradein_disqualified !== true && !tradeinOk
);

// gates de inventário
// D1: a consulta de estoque já é consolidada nas duas lojas (HTTP sem filtro de
// cidade) e o Node13 degrada graciosamente sem preferred_city. Por isso a cidade
// deixou de ser pré-requisito para buscar/simular; ela só é pedida pós-simulação.
// FLUXO: cor/condição NÃO gateiam o avanço ao estoque/simulação (resolvidas pelo
// estoque). Exigir desired_color||desired_condition aqui travava eligibleForInventory
// (nunca buscava estoque, nunca perguntava entrada, ficava em bia1_pre_inventory).
const eligibleForInventory = (
  isIphonePurchaseFlow(state) &&
  !!state.desired_model && !!state.desired_capacity &&
  cashEntryOk === true &&
  (tradeinOk === true || (postSimulationFlow === true && state.proposal_accepted === true))
);
// D1: cidade de retirada SÓ após a simulação e com proposta aceita (FLUXO).
const needsPickupCity = (
  postSimulationFlow === true &&
  state.proposal_accepted === true &&
  !state.preferred_city
);
// Pergunta obrigatória sobre entrada ANTES da primeira simulação: o cliente já
// está pronto para simular (aparelho + trade-in avaliado + cidade) mas ainda não
// foi perguntado sobre entrada. Só vale antes da primeira simulação.
// Pergunta obrigatoria sobre o aparelho de entrada/troca ANTES de seguir. Dispara
// assim que o modelo desejado esta definido (antes de capacidade) — ou no fluxo
// multi-aparelho — para coletar o aparelho atual logo na abertura comercial. Nao
// reabre apos resolvido (tradein_asked latch / has_tradein / tradein_model).
const needsTradeinQuestion = (
  isIphonePurchaseFlow(state) &&
  postSimulationFlow !== true &&
  tradeinResolved !== true &&
  needsModelTier !== true &&
  (!!state.desired_model || repasseV2MultiQuoteReady === true)
);
state.must_ask_tradein = needsTradeinQuestion === true;
const needsCashEntryQuestion = (
  isIphonePurchaseFlow(state) &&
  postSimulationFlow !== true &&
  cashEntryResolved !== true &&
  (eligibleForInventory === true || (repasseV2MultiQuoteReady === true && repasseV2TradeinReadyForSimulation === true))
);
state.shouldPrecheckInventory = (
  isIphonePurchaseFlow(state) &&
  postSimulationFlow !== true &&
  eligibleForInventory !== true &&
  !!state.desired_model &&
  state.tradein_disqualified !== true &&
  tradeinBatterySuspect !== true &&
  tradeinConditionBlocks !== true &&
  state.tradein_model_accepted !== false
);

// ---- DECISÃO PRINCIPAL (setMainRoute) ----
if (intent === "spam") {
  setMainRoute("shouldStopAsSpam", "spam_stop");
} else if (intent === "garantia" || state.tradein_disqualified === true || tradeinBatterySuspect === true || tradeinConditionBlocks === true || Number(state.simulation_count) >= 3) {
  setMainRoute("shouldUseBia2Continuation", "bia2_continuation");
  if (tradeinBatterySuspect === true) {
    // bateria suspeita: transferir p/ avaliação humana, NUNCA prometer simulação.
    state.next_best_action = "transferir para avaliacao humana da bateria (nao simular)";
    state.attendance_owner_next = "humano_loja";
  } else if (tradeinConditionBlocks === true) {
    // líquido/arranhões/peça trocada: avaliação humana, NUNCA cotar automaticamente.
    state.routing_decision = "tradein_condition_human_eval";
    state.next_best_action = "transferir para avaliacao humana do aparelho (condicoes: liquido/arranhoes/peca trocada — nao simular)";
    state.attendance_owner_next = "humano_loja";
  }
} else if (needsModelTier) {
  // D5: modelo base ("13"/"14"/"15") sem tier → confirmar antes de buscar/simular.
  setMainRoute("shouldUseBia1", "ask_model_tier");
  state.next_best_action = "confirmar se o modelo é normal, Pro ou Pro Max";
  state.attendance_owner_next = "ia";
} else if (needsTradeinQuestion) {
  setMainRoute("shouldUseBia1", "ask_tradein_before_sim");
  state.next_best_action = "perguntar se o cliente tem um aparelho para dar de entrada/troca (qual o aparelho atual) antes de avancar";
  state.attendance_owner_next = "ia";
  if (!state.missing_fields.includes("tradein_question")) state.missing_fields.push("tradein_question");
} else if (needsPickupCity) {
  state.needsPickupCity = true;
  setMainRoute("shouldUseBia2Continuation", "ask_pickup_city_after_sim");
  state.next_best_action = "perguntar cidade de retirada após simulação aceita";
  state.attendance_owner_next = "ia";
  if (!missing.includes("preferred_city")) missing.push("preferred_city");
} else if (needsCashEntryQuestion) {
  setMainRoute("shouldUseBia2Continuation", "ask_cash_entry_before_sim");
  state.next_best_action = "perguntar se deseja simular com algum valor de entrada (dinheiro/pix) antes de simular";
  state.attendance_owner_next = "ia";
} else if (repasseV2CanRequestSimulation) {
  state.context_ready = true;
  setMainRoute("shouldSearchInventory", "v2_multi_quote_inventory_or_simulator");
} else if (eligibleForInventory) {
  setMainRoute("shouldSearchInventory", "inventory_or_simulator");
} else if (postSimulationFlow !== true && ["aparelho_iphone", "aparelho_outro", "fora_do_escopo"].includes(intent)) {
  setMainRoute("shouldUseBia1", "bia1_pre_inventory");
} else {
  setMainRoute("shouldUseBia2Continuation", "bia2_continuation");
}

// shouldSimulateNow (depende de stock_item_id já carregado em turno anterior)
const simulationActions = new Set(["simular orçamento", "simular orcamento", "re-simular com cor alternativa", "re-simular com PIX 250 como entrada"]);
if (repasseV2CanRequestSimulation) {
  state.context_ready = true;
  state.next_best_action = "simular orçamento";
}
state.shouldSimulateNow = (
  isIphonePurchaseFlow(state) &&
  state.context_ready === true &&
  tradeinOk === true &&
  cashEntryOk === true &&
  cashEntryResolved === true &&
  tradeinResolved === true &&
  !!state.stock_item_id &&
  state.simulation_done !== true &&
  Number(state.simulation_count ?? 0) < 3 &&
  state.tradein_disqualified !== true &&
  tradeinBatterySuspect !== true &&
  tradeinConditionBlocks !== true &&
  state.tradein_model_accepted !== false
);
if (state.shouldSimulateNow === true && !simulationActions.has(state.next_best_action)) {
  state.next_best_action = "simular orçamento";
}

// next_best_action: defaults seguros quando vazio/erro
if (!state.next_best_action || state.next_best_action === "parse error - transferindo para humano") {
  if (intent === "aparelho_outro") {
    state.next_best_action = missing.length > 0 ? `pedir ${missing[0]}` : "consultar estoque via API";
    state.attendance_owner_next = "ia";
  } else if (intent === "garantia") {
    state.next_best_action = "transferir para atendimento imediato";
    state.attendance_owner_next = "humano_loja";
  } else if (intent === "fora_do_escopo") {
    state.next_best_action = state.preferred_city ? "enviar link HDI da cidade correta" : "perguntar cidade do cliente para indicar HDI";
  } else if (state.cash_entry_intent === true && state.cash_entry_amount == null) {
    state.next_best_action = "perguntar valor da entrada";
  } else if (state.shouldSearchInventory === true) {
    state.next_best_action = "consultar estoque via API";
  } else if (missing.length > 0) {
    state.next_best_action = `pedir ${missing[0]}`;
  }
}

if (intent === "fora_do_escopo") state.hdi_city_needed = !state.preferred_city;

// fechamento de venda (reserva / retirada)
if (postSimulationFlow === true && state.proposal_accepted === true) {
  state.reservation_intent = true;
  state.sales_stage_next = "reserva_pendente";
  state.next_best_action = "confirmar disponibilidade/local da loja e orientar reserva";
}
if (state.proposal_accepted === true && state.pix_paid === true && state.cadastro_completo === true && state.pickup_datetime) {
  state.conversation_status_next = "aguardando_retirada";
  state.attendance_owner_next = "humano_loja";
  state.next_best_action = "transferir para humano confirmar reserva final";
}

// defaults de funil
state.conversation_status_next = state.conversation_status_next ?? "em_atendimento_ia";
state.attendance_owner_next = state.attendance_owner_next ?? "ia";
state.sales_stage_next = state.sales_stage_next ?? "triagem";
state.missing_fields = missing;

// FAQ comercial: se o estado já trouxe faq_found=true (futuro matcher), reroteia.
// O matcher determinístico (matchCommercialFaq) será reintroduzido em passo
// separado; aqui apenas respeitamos o que já vier no estado.
if (state.faq_found === true && state.faq_transfer !== true) {
  state.shouldSimulateNow = false;
  state.shouldPrecheckInventory = false;
  setMainRoute("shouldUseBia2Continuation", "bia2_continuation");
  state.next_best_action = state.faq_continue_hint ?? "responder duvida comercial e retomar atendimento";
  state.attendance_owner_next = "ia";
  state.conversation_status_next = "em_atendimento_ia";
}

return [{ json: state }];
