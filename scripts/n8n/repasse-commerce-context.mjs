// Commerce Context + deterministic color guard for the repasse v2 workflow.
//
// Two responsibilities (Fase 1 do spec 2026-06-13-repasse-two-agent-consolidation):
//  1. buildCommerceContext(): a stable snapshot the conversational agents read,
//     including allowed_colors (the ONLY colors an agent may mention).
//  2. enforceAllowedColors(): a deterministic post-agent guard that detects color
//     names in the agent reply and, if any is not stock-backed, replaces the whole
//     message with a safe deterministic fallback. Never invents/adds a color.
//
// Exported as plain functions (for unit tests) plus n8n runtime-string builders so
// the same logic can be embedded verbatim in Code nodes (mirrors
// repasse-deterministic-core.mjs / sharedRuntime pattern).

// ---- Apple color lexicon (PT-BR), longest-match first --------------------------
// Used only to DETECT color tokens in free text. Multiword entries must come first.
const COLOR_LEXICON = [
  'titanio natural', 'titanio azul', 'titanio branco', 'titanio preto', 'titanio deserto',
  'azul profundo', 'azul pacifico', 'azul celeste', 'azul sierra', 'azul alpino',
  'verde alpino', 'verde meia noite', 'meia noite', 'cinza espacial', 'roxo profundo',
  'product red', 'ouro rosa',
  'estelar', 'preto', 'branco', 'azul', 'verde', 'amarelo', 'rosa', 'rose', 'vermelho',
  'roxo', 'dourado', 'ouro', 'grafite', 'prateado', 'prata', 'coral', 'ultramarino',
  'pessego', 'titanio',
];

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniq(list) {
  return [...new Set(list)];
}

// Collect stock-backed colors from every available source into a normalized set.
export function buildAllowedColors(sources = {}) {
  const inv = sources.inventory ?? {};
  const last = sources.last_inventory_context ?? sources.lastInventoryContext ?? {};
  const raw = [
    ...(Array.isArray(inv.available_colors) ? inv.available_colors : []),
    ...(Array.isArray(inv.available_colors_same_capacity) ? inv.available_colors_same_capacity : []),
    inv.color_found,
    ...(Array.isArray(inv.available_options) ? inv.available_options.map((o) => o?.color) : []),
    ...(Array.isArray(last.available_colors) ? last.available_colors : []),
    ...(Array.isArray(last.available_options) ? last.available_options.map((o) => o?.color) : []),
  ].filter((c) => typeof c === 'string' && c.trim() !== '');
  // Keep original display strings, dedupe by normalized form.
  const seen = new Set();
  const display = [];
  for (const color of raw) {
    const key = normalizeText(color);
    if (key && !seen.has(key)) {
      seen.add(key);
      display.push(color.trim());
    }
  }
  return display;
}

function deriveStage(memory = {}) {
  if (memory.pix_paid === true || memory.proposal_accepted === true) return 'closing';
  if (memory.simulation_done === true) return 'simulation';
  if (memory.context_ready === true && (memory.stock_item_id || memory.inventory)) return 'presentation';
  return 'collection';
}

export function buildCommerceContext(sources = {}) {
  const memory = sources.memory ?? {};
  const inventory = sources.inventory ?? null;
  const last = sources.last_inventory_context ?? sources.lastInventoryContext ?? null;
  const allowed_colors = buildAllowedColors({ inventory: inventory ?? {}, last_inventory_context: last ?? {} });
  return {
    inventory_checked_this_turn: Boolean(inventory),
    inventory_found: inventory ? Boolean(inventory.inventory_found) : null,
    best_item: inventory?.best_item ?? null,
    available_colors: inventory?.available_colors ?? [],
    available_colors_same_capacity: inventory?.available_colors_same_capacity ?? [],
    available_options: inventory?.available_options ?? [],
    last_inventory_context: last ?? null,
    simulation: {
      done: memory.simulation_done === true,
      count: Number(memory.simulation_count ?? 0),
      last_total: memory.last_simulation_total ?? null,
      error: memory.simulation_error === true,
    },
    allowed_colors,
    stage: deriveStage(memory),
  };
}

// Detect every color token present in the message (normalized, longest-match first).
export function detectColors(message) {
  const norm = normalizeText(message);
  const found = [];
  for (const color of COLOR_LEXICON) {
    // word-boundary-ish: surrounded by start/space/end in the normalized string
    const re = new RegExp(`(^|\\s)${color.replace(/ /g, '\\s')}(\\s|$)`);
    if (re.test(norm)) found.push(color);
  }
  // Drop tokens fully contained in an already-found multiword (e.g. "azul" inside "azul profundo")
  return found.filter((c) => !found.some((other) => other !== c && other.includes(c) && other.split(' ').length > c.split(' ').length));
}

// Deterministic guard. Returns { message, triggered, violations, mentioned }.
// If any mentioned color is not stock-backed, replace the WHOLE message with a
// safe fallback (a hallucinated reply is untrustworthy; determinism > preserving it).
// `extraAllowed` are colors the customer themselves mentioned this turn (echoes are
// never hallucinations) — they suppress triggering but are NOT listed as available.
export function enforceAllowedColors(message, allowedColors = [], extraAllowed = []) {
  const text = String(message ?? '');
  const mentioned = detectColors(text);
  if (mentioned.length === 0) {
    return { message: text, triggered: false, violations: [], mentioned };
  }
  const allowedNorm = new Set([...(allowedColors ?? []), ...(extraAllowed ?? [])]
    .map(normalizeText).filter(Boolean));
  const violations = mentioned.filter((c) => !allowedNorm.has(normalizeText(c)));
  if (violations.length === 0) {
    return { message: text, triggered: false, violations: [], mentioned };
  }
  const safe = allowedColors && allowedColors.length > 0
    ? `Deixa eu confirmar certinho no estoque pra não te passar errado. As cores que tenho disponíveis agora são: ${allowedColors.join(', ')}. Alguma dessas te atende?`
    : 'Deixa eu confirmar a disponibilidade de cores no nosso estoque pra te passar certinho. Tem alguma cor de preferência?';
  return { message: safe, triggered: true, violations, mentioned, original: text };
}

// ---- n8n runtime string (embed verbatim in a Code node) ------------------------
export function buildCommerceContextRuntime() {
  return `
// === REPASSE COMMERCE CONTEXT START ===
const COLOR_LEXICON = ${JSON.stringify(COLOR_LEXICON)};
${normalizeText.toString()}
${buildAllowedColors.toString()}
${deriveStage.toString()}
${buildCommerceContext.toString()}
${detectColors.toString()}
${enforceAllowedColors.toString()}
// === REPASSE COMMERCE CONTEXT END ===
`;
}
