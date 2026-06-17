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
