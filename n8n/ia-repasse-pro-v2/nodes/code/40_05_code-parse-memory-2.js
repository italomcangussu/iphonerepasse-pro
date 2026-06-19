// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     Code Parse Memory 2
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    40 router-memoria
// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.
// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====
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

return [{
  json: {
    ...$json,
    last_message_content: readLastMessageContent(),
    lead_state: readLeadState(),
    memory,
  },
}];
