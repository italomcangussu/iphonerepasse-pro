// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     Code Parse Bia 2 SEM ESTOQUE1
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    80 links-envio
// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.
// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====
// REPASSE HUMANIZER START
// Sanitiza caguetes de IA na mensagem final (travessão, ponto-e-vírgula, excesso de exclamação).
// Gerado de scripts/n8n/repasse-humanizer.mjs — edite lá e reaplique via apply-repasse-humanizer.mjs.
function repasseHumanizeMessage(text) {
  if (typeof text !== 'string') return text;
  // bullet de início de linha: "— item" → "- item" (no texto inteiro: travessão
  // em início de linha nunca faz parte de URL, e o split abaixo quebraria o ^)
  const bulleted = text.replace(/(^|\n)[ \t]*[—–][ \t]+/g, '$1- ');
  const parts = bulleted.split(/(https?:\/\/[^\s]+)/g);
  for (let i = 0; i < parts.length; i += 1) {
    if (i % 2 === 1) continue; // índices ímpares são URLs (grupo de captura do split)
    let seg = parts[i];
    // faixa numérica: 9h—22h → 9h-22h (antes das regras de vírgula)
    seg = seg.replace(/(\d[a-z]?)[—–](\d)/gi, '$1-$2');
    // travessão com espaços antes de maiúscula → vira ponto
    seg = seg.replace(/[ \t]+[—–][ \t]+(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ])/g, '. ');
    // travessão com espaços nos demais casos → vira vírgula
    seg = seg.replace(/[ \t]+[—–][ \t]+/g, ', ');
    // travessão colado entre palavras → vírgula
    seg = seg.replace(/([^\s])[—–](?=[^\s])/g, '$1, ');
    // ponto-e-vírgula → ponto (ninguém digita ; no WhatsApp)
    seg = seg.replace(/[ \t]*;[ \t]*(?=\S)/g, '. ');
    seg = seg.replace(/[ \t]*;/g, '.');
    parts[i] = seg;
  }
  let out = parts.join('');
  // exclamações: colapsa repetidas e mantém só a primeira da mensagem
  out = out.replace(/!{2,}/g, '!');
  let seenBang = false;
  out = out.replace(/!/g, () => {
    if (!seenBang) { seenBang = true; return '!'; }
    return '.';
  });
  // espaços duplicados criados pelas trocas (preserva \n)
  out = out.replace(/ {2,}/g, ' ');
  return out;
}
// REPASSE HUMANIZER END


// === REPASSE COMMERCE CONTEXT START ===
const COLOR_LEXICON = ["titanio natural","titanio azul","titanio branco","titanio preto","titanio deserto","azul profundo","azul pacifico","azul celeste","azul sierra","azul alpino","verde alpino","verde meia noite","meia noite","cinza espacial","roxo profundo","product red","ouro rosa","estelar","preto","branco","azul","verde","amarelo","rosa","rose","vermelho","roxo","dourado","ouro","grafite","prateado","prata","coral","ultramarino","pessego","titanio"];
function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function buildAllowedColors(sources = {}) {
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
function buildCommerceContext(sources = {}) {
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
function detectColors(message) {
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
function enforceAllowedColors(message, allowedColors = [], extraAllowed = []) {
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
// === REPASSE COMMERCE CONTEXT END ===


function gatherAllowedColors() {
  const candidates = ['Node13-Code Filtrar Resultados Estoque', 'Edit Fields3', 'Edit Fields13', 'Edit Fields10', 'Edit Fields5'];
  let inventory = {};
  let last = {};
  for (const name of candidates) {
    try {
      const j = $(name).last().json ?? {};
      const inv = j.inventory ?? (j.available_colors ? j : null);
      if (!inventory.available_colors && inv) inventory = inv;
      const lic = j.last_inventory_context ?? (j.memory && j.memory.last_inventory_context);
      if (!last.available_colors && lic) last = lic;
    } catch (e) { /* node not executed this turn */ }
  }
  try {
    const cur = $json ?? {};
    if (!inventory.available_colors && cur.inventory) inventory = cur.inventory;
    const lic = cur.last_inventory_context ?? (cur.memory && cur.memory.last_inventory_context);
    if (!last.available_colors && lic) last = lic;
  } catch (e) {}
  return buildAllowedColors({ inventory, last_inventory_context: last });
}

// Colors the customer themselves mentioned this turn (echoes are never hallucinations).
function gatherCustomerColors() {
  const candidates = ['Edit Fields4', 'Edit Fields5', 'Edit Fields13', 'Edit Fields10'];
  let msg = '';
  const stateColors = [];
  const collect = (j) => {
    if (!j) return;
    const m = j.message_buffered ?? (j.buffer && j.buffer.message_buffered) ?? (j.memory && j.memory.message_buffered);
    if (!msg && typeof m === 'string') msg = m;
    const mem = j.memory ?? j;
    for (const f of ['desired_color', 'tradein_color', 'secondary_color_simulation']) {
      const v = mem[f];
      if (typeof v === 'string' && v.trim()) stateColors.push(v);
    }
  };
  for (const name of candidates) { try { collect($(name).last().json); } catch (e) {} }
  try { collect($json); } catch (e) {}
  return [...detectColors(msg), ...stateColors];
}

let raw = $json.output;
raw = String(raw || '').trim();
raw = raw.replace(/^\`\`\`json\s*/i, '').replace(/^\`\`\`\s*/i, '').replace(/\`\`\`$/i, '').trim();

const allowedColors = gatherAllowedColors();
const customerColors = gatherCustomerColors();

try {
  const router = JSON.parse(raw);
  if (router && typeof router.message === "string") { router.message = repasseHumanizeMessage(router.message); }
  let color_guard = null;
  if (router && typeof router.message === 'string') {
    const guard = enforceAllowedColors(router.message, allowedColors, customerColors);
    if (guard.triggered) {
      router.message = guard.message;
      color_guard = { triggered: true, violations: guard.violations, mentioned: guard.mentioned };
    }
  }
  return [{ json: { ...$json, router, router_parse_ok: true, color_guard, allowed_colors: allowedColors } }];
} catch (error) {
  return [{ json: { ...$json, router_parse_ok: false, router_parse_error: String(error.message || error), router_raw: raw } }];
}
