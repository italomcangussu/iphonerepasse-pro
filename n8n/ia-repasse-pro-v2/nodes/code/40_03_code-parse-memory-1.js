// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     Code Parse Memory 1
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    40 router-memoria
// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.
// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====
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

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function fallback(parseReason) {
  return {
    intent_signal: 'desconhecida',
    facts: {},
    new_user_info: [],
    open_questions: [],
    summary_delta: '',
    confidence: 0,
    parse_error: true,
    parse_error_reason: parseReason,
  };
}

function parseExtraction(value) {
  const jsonString = extractJsonString(value);
  if (!jsonString) return fallback('json_not_found');
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (originalError) {
    const repaired = repairUnescapedQuotesInsideStrings(jsonString);
    if (repaired !== jsonString) {
      try {
        parsed = JSON.parse(repaired);
      } catch (repairError) {
        return fallback('json_invalid_after_repair: ' + repairError.message);
      }
    } else {
      return fallback('json_invalid: ' + originalError.message);
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback('schema_invalid');
  if (parsed.intent_primary && parsed.route && Array.isArray(parsed.next_agents)) return fallback('router_json_received');
  const expectedFields = ['intent_signal', 'facts', 'new_user_info', 'open_questions', 'summary_delta', 'confidence'];
  if (!expectedFields.some((field) => Object.hasOwn(parsed, field))) return fallback('schema_invalid');
  return parsed;
}

const parsed = parseExtraction(raw);
const memory_extraction = {
  intent_signal: typeof parsed.intent_signal === 'string' ? parsed.intent_signal : 'desconhecida',
  facts: safeObject(parsed.facts),
  new_user_info: safeArray(parsed.new_user_info),
  open_questions: safeArray(parsed.open_questions),
  summary_delta: typeof parsed.summary_delta === 'string' ? parsed.summary_delta : '',
  confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : 0,
};

if (parsed.parse_error === true) {
  memory_extraction.parse_error = true;
  memory_extraction.parse_error_reason = parsed.parse_error_reason ?? 'parse_error';
}

return [{ json: { ...$json, memory_extraction } }];
