// Code Parse Memory 2 (v2 — extraction only)
//
// Ownership change (2026-06-14): "Memory 2 - Reconciler" now OWNS the lead_state
// update — its JSON output IS the full reconciled lead_state. This node's ONLY
// job is to EXTRACT the fields the agent already delivered (robust JSON parse
// with markdown strip + unescaped-quote repair) and pass context through. It no
// longer reconciles or rebuilds state, and it no longer hard-throws: a malformed
// agent reply degrades gracefully (memory carries parse_error) so the downstream
// deterministic "Parse Memory" net can fall back to the prior lead_state instead
// of aborting the whole run.

const raw = $json.output;

function extractJsonString(value) {
  if (!value || typeof value !== 'string') return null;
  const markdownMatch = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (markdownMatch) return markdownMatch[1].trim();
  const directMatch = value.match(/\{[\s\S]*\}/);
  return directMatch ? directMatch[0].trim() : null;
}

function nextNonWhitespaceIndex(text, start) {
  for (let i = start; i < text.length; i++) {
    if (!/\s/.test(text[i])) return i;
  }
  return -1;
}

function isStructuralClosingQuote(text, quoteIndex) {
  const nextIndex = nextNonWhitespaceIndex(text, quoteIndex + 1);
  if (nextIndex === -1) return true;
  const next = text[nextIndex];
  if (next === ':' || next === '}' || next === ']') return true;
  if (next === ',') {
    const afterCommaIndex = nextNonWhitespaceIndex(text, nextIndex + 1);
    if (afterCommaIndex === -1) return true;
    const afterComma = text[afterCommaIndex];
    return afterComma === '"' || afterComma === '}' || afterComma === ']';
  }
  return false;
}

function repairUnescapedQuotesInsideStrings(text) {
  let repaired = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (!inString) {
      repaired += char;
      if (char === '"') inString = true;
      continue;
    }
    if (escaped) {
      repaired += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      repaired += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      if (isStructuralClosingQuote(text, i)) {
        repaired += char;
        inString = false;
      } else {
        repaired += '\\"';
      }
      continue;
    }
    repaired += char;
  }
  return repaired;
}

function parseDelivered(value) {
  const jsonString = extractJsonString(value);
  if (!jsonString) return { ok: false, reason: 'json_not_found', data: {} };
  try {
    return { ok: true, data: JSON.parse(jsonString) };
  } catch (originalError) {
    const repaired = repairUnescapedQuotesInsideStrings(jsonString);
    if (repaired !== jsonString) {
      try {
        return { ok: true, data: JSON.parse(repaired) };
      } catch (repairError) {
        return { ok: false, reason: 'json_invalid_after_repair: ' + repairError.message, data: {} };
      }
    }
    return { ok: false, reason: 'json_invalid: ' + originalError.message, data: {} };
  }
}

function firstNonEmptyPlainObject(...values) {
  return values.find((value) =>
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  ) ?? {};
}

// Prior persisted lead_state — passed through only as the safety net `prev` for
// Parse Memory. This node does NOT merge it into `memory`.
function readLeadState() {
  try {
    const crm = $('CRM Leads GET').last().json;
    return firstNonEmptyPlainObject(
      crm.lead_state,
      crm.data?.lead_state,
      crm.data?.items?.[0]?.lead_state
    );
  } catch (e) {
    return {};
  }
}

// Last assistant message — needed by Parse Memory's trade-in/desired guardrails.
function readLastMessageContent() {
  try {
    return $('Edit Fields').last().json?.lead?.last_message_content ?? null;
  } catch (e) {
    return null;
  }
}

const parsed = parseDelivered(raw);
let memory = parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data) ? parsed.data : {};

// If the agent echoed a Router JSON, do not adopt it as state.
if (memory.intent_primary && memory.route && Array.isArray(memory.next_agents)) {
  memory = { parse_error: true, parse_error_reason: 'router_json_received' };
} else if (!parsed.ok) {
  memory = { ...memory, parse_error: true, parse_error_reason: parsed.reason };
}

// Sticky-latch preserve (2026-06-19): cash_entry_asked is a one-way latch — once the AI has asked about a
// cash down payment, it must stay asked. The flash-lite "Memory 2 - Reconciler"
// intermittently drops it back to false on later turns, which makes
// cashEntryResolved=false and BLOCKS the simulation (see
// repasse-code-routing-flags.js). Re-apply prior OR current so it can only flip
// to true, never silently un-ask.
const __priorLeadState = readLeadState();
if (__priorLeadState && __priorLeadState.cash_entry_asked === true) {
  memory.cash_entry_asked = true;
}

// tradein_asked sticky latch (2026-06-20): espelho do cash_entry_asked. Uma vez
// que a IA perguntou sobre o aparelho de entrada/troca, mantenha asked=true para o
// gate determinístico (needsTradeinQuestion) nao reperguntar a cada turno. Tambem
// derive do "sim" do cliente: declarar trade-in (has_tradein) ou nomear um modelo
// de entrada implica que a pergunta foi feita.
if (
  (__priorLeadState && __priorLeadState.tradein_asked === true) ||
  memory.has_tradein === true ||
  (memory.tradein_model !== null && memory.tradein_model !== undefined && memory.tradein_model !== '') ||
  (__priorLeadState && __priorLeadState.has_tradein === true) ||
  (__priorLeadState && __priorLeadState.tradein_model)
) {
  memory.tradein_asked = true;
}

// interest_type normalize (2026-06-19): the reconciler prompt never defines interest_type, so flash-lite
// sometimes copies the Router intent enum (e.g. "aparelho_iphone") into it. Valid
// values are comprar/trocar/vender/avaliar; a bad one poisons isIphonePurchaseFlow
// -> context_ready/eligibleForInventory and blocks the whole sales/simulation flow
// (see repasse-code-routing-flags.js). Coerce any out-of-vocabulary value.
const __validInterest = new Set(['comprar', 'trocar', 'vender', 'avaliar']);
if (!__validInterest.has(memory.interest_type)) {
  const __prev = __priorLeadState || {};
  if (__validInterest.has(__prev.interest_type)) {
    memory.interest_type = __prev.interest_type;
  } else if (memory.has_tradein === true || __prev.has_tradein === true) {
    memory.interest_type = 'trocar';
  } else if (memory.desired_model || __prev.desired_model) {
    memory.interest_type = 'comprar';
  } else if (memory.tradein_model || __prev.tradein_model) {
    memory.interest_type = 'vender';
  } else {
    memory.interest_type = null;
  }
}

// tradein reclass (2026-06-19, gated 2026-06-20): a second iPhone named after the
// desired is already set is the ENTRY/trade-in device, not a desired switch. The
// flash-lite reconciler overwrites desired_model with the client's current device
// when they answer the opener's "qual o aparelho atual?" with a model (desired 17
// Pro Max set -> client says "14pm" -> reconciler wrongly sets desired_model=14 Pro
// Max). Restore the desired and move the new model to trade-in — but ONLY when the
// bot actually ASKED for the current device (via a quoted reply OR the last
// assistant message). Without that gate, a plain browsing turn ("tem o 15?" ... "e
// o 16?") would fabricate a phantom trade-in. Mirror of
// scripts/n8n/tool/parsers/blocks/reply_attribution.block.js (decideTradeinReclass).
function __normModel(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
function __normReplyText(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
function __classifyBiaQuestion(quotedText) {
  const t = __normReplyText(quotedText);
  if (!t) return null;
  if (/valor de entrada|entrada no pix|entrada em dinheiro|pix\/dinheiro|algum valor de entrada/.test(t)) return 'cash_entry';
  if (/aparelho que voce tem|aparelho atual|que voce tem (agora|hoje)|seu aparelho|aparelho de entrada|dar como entrada|dar de entrada|dar de entr|pra dar de entrada|de entrada|parte do pagamento|dar (algum|um|seu) (iphone|aparelho|celular)|na troca|de troca|pra troca|para troca|dar na troca/.test(t)) return 'tradein_model';
  if (/qual modelo|modelo de iphone|(deseja|quer) comprar|esta procurando|ta procurando|procurando/.test(t)) return 'desired_model';
  if (/armazenamento|capacidade|quantos gb|quantos giga/.test(t)) return 'desired_capacity';
  if (/\bcor\b|\bcores\b|qual cor/.test(t)) return 'desired_color';
  return null;
}
const __SWITCH_INTENT_RE = /(na verdade|mudei de ideia|muda pra|muda para|prefiro o|quero mesmo o|quero o outro|na real quero|pode ser o)/;
const __prevDesired = (__priorLeadState && __priorLeadState.desired_model) || null;
const __newDesired = memory.desired_model || null;
let __curMsg = '';
try { __curMsg = String($('Edit Fields4').last().json?.buffer?.message_buffered || '').toLowerCase(); } catch (e) { __curMsg = ''; }
let __replyCtx = null;
try {
  const __msgs = $('Edit Fields4').last().json?.buffer?.messages;
  if (Array.isArray(__msgs) && __msgs.length) __replyCtx = __msgs[__msgs.length - 1]?.reply_context || null;
} catch (e) { __replyCtx = null; }
const __lastBotMsg = readLastMessageContent();
const __askedViaReply = !!(__replyCtx && __replyCtx.target_text)
  && (!__replyCtx.target_direction || __replyCtx.target_direction === 'outbound')
  && __classifyBiaQuestion(__replyCtx.target_text) === 'tradein_model';
const __askedViaLastMsg = __classifyBiaQuestion(__lastBotMsg) === 'tradein_model';
// tradein_asked deterministico (2026-06-21): se a ULTIMA mensagem do bot perguntou
// o aparelho atual/de entrada/troca, a pergunta FOI feita — marque asked=true mesmo
// que o cliente recuse (has_tradein=false, sem model), pois a recusa nao deixa
// sinal "presente" como o cash_entry_intent=false.
if (__askedViaReply || __askedViaLastMsg) {
  memory.tradein_asked = true;
}
const __noTradeinYet = !memory.tradein_model && memory.has_tradein !== true;
const __singleDevice = !memory.desired_devices || (Array.isArray(memory.desired_devices) && memory.desired_devices.length <= 1);
if (
  __prevDesired &&
  __newDesired &&
  __normModel(__prevDesired) !== __normModel(__newDesired) &&
  !__SWITCH_INTENT_RE.test(__curMsg) &&
  __noTradeinYet &&
  __singleDevice &&
  (__askedViaReply || __askedViaLastMsg)
) {
  memory.tradein_model = __newDesired;
  memory.desired_model = __prevDesired;
  memory.desired_capacity = (__priorLeadState && __priorLeadState.desired_capacity) ?? memory.desired_capacity ?? null;
  memory.has_tradein = true;
  memory.interest_type = 'trocar';
  memory.tradein_reclassified = true;
}

// Ad-origin seed (2026-06-26): quando o lead chegou por anúncio Meta/CTWA, o
// criativo do card clicado já define o aparelho desejado (modelo + capacidade).
// Semeia desired_model/desired_capacity/interest_type quando ainda vazios para
// pular reperguntas (inclusive a de tier) e ir direto à simulação/reserva. Nunca
// sobrescreve uma escolha real já capturada (memory ou prev).
function __readAdContext() {
  try {
    const __lead = $('Edit Fields').last().json?.lead;
    const __ad = __lead && __lead.source_ad_context;
    return (__ad && __ad.is_from_ad) ? __ad : null;
  } catch (e) {
    return null;
  }
}
const __adCtx = __readAdContext();
if (__adCtx && __adCtx.product_hint && __adCtx.product_hint.model) {
  const __hasDesired = (memory.desired_model && String(memory.desired_model).trim()) ||
    (__priorLeadState && __priorLeadState.desired_model);
  if (!__hasDesired) {
    memory.desired_model = __adCtx.product_hint.model;
    const __capEmpty = (memory.desired_capacity === null || memory.desired_capacity === undefined ||
      memory.desired_capacity === '') && !(__priorLeadState && __priorLeadState.desired_capacity);
    if (__capEmpty && __adCtx.product_hint.capacity_gb) {
      memory.desired_capacity = String(__adCtx.product_hint.capacity_gb);
    }
    if (!__validInterest.has(memory.interest_type)) {
      memory.interest_type = 'comprar';
    }
  }
}

// Carry-forward determinístico (2026-06-20): o flash-lite "Memory 2 - Reconciler"
// intermitentemente DROPA campos sticky (null/omitido) num turno, fazendo o turno
// enxergar estado vazio (ex.: desired_model null -> context_ready false -> Bia 1
// trava com "vou verificar e já volto"). O preserve() determinístico foi removido
// junto com o "Parse Memory" (2026-06-14). Restaurado aqui: se o reconciler dropou
// (null/undefined) mas o prev tem valor, mantém o prev. Nunca bloqueia troca real
// (troca é SET para valor novo, não null) e espelha o coalesce-preserve da RPC.
// cash_entry_asked fica de fora (tem latch próprio prior-OR-current acima).
const __CARRY_FORWARD = [
  'desired_model', 'desired_capacity', 'desired_color', 'desired_condition',
  'has_tradein', 'tradein_model', 'tradein_capacity', 'tradein_color',
  'tradein_battery_pct', 'tradein_battery_suspect', 'tradein_scratches',
  'tradein_liquid_contact', 'tradein_side_marks', 'tradein_parts_swapped',
  'tradein_has_box_cable', 'tradein_apple_warranty', 'tradein_warranty_until',
  'tradein_disqualified', 'tradein_model_accepted', 'tradein_rejected_reason',
  'cash_entry_intent', 'cash_entry_amount',
  'simulation_done', 'simulation_count', 'last_simulation_total',
  'secondary_color_simulation',
  'preferred_city', 'stock_city', 'stock_item_id',
  'proposal_accepted', 'reservation_intent', 'pix_data_sent', 'pix_paid', 'pix_amount',
  'pickup_datetime', 'pickup_city',
  'cadastro_solicitado', 'cadastro_nome_completo', 'cadastro_data_nascimento',
  'cadastro_cpf', 'cadastro_contato', 'cadastro_completo',
];
if (__priorLeadState && typeof __priorLeadState === 'object') {
  for (const __k of __CARRY_FORWARD) {
    const __cur = memory[__k];
    if (__cur === null || __cur === undefined) {
      const __prevVal = __priorLeadState[__k];
      if (__prevVal !== null && __prevVal !== undefined) memory[__k] = __prevVal;
    }
  }
}

return [{
  json: {
    ...$json,
    last_message_content: readLastMessageContent(),
    lead_state: readLeadState(),
    memory,
  },
}];
