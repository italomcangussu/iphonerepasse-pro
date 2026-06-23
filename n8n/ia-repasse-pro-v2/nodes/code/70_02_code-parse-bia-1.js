// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     Code Parse Bia 1
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    70 agentes-bia
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

// REPASSE DETERMINISTIC BIA1 RESPONSE START

const TRADE_IN_FIELDS = ["tradein_capacity","tradein_color","tradein_scratches","tradein_liquid_contact","tradein_side_marks","tradein_parts_swapped","tradein_has_box_cable","tradein_battery_pct","tradein_apple_warranty","tradein_warranty_until"];
// Caixa/cabo é texto livre informativo: ainda é perguntado uma vez no questionário
// (segue em TRADE_IN_FIELDS), mas NÃO é obrigatório para concluir a avaliação nem
// para simular. Sem isso, uma resposta diferente de sim/não (ex.: "somente caixa")
// deixava o campo null e gerava re-pergunta em loop + bloqueio da simulação.
const REQUIRED_TRADE_IN_FIELDS = TRADE_IN_FIELDS.filter((f) => f !== "tradein_has_box_cable");
const TRADE_IN_QUESTIONS = {"tradein_capacity":"Qual armazenamento?","tradein_color":"Qual a cor do seu aparelho?","tradein_scratches":"Apresenta arranhões?","tradein_liquid_contact":"Aparelho já teve contato com líquido?","tradein_side_marks":"Apresenta marcas de uso na lateral?","tradein_parts_swapped":"Já foi realizada a troca de alguma peça?","tradein_has_box_cable":"Possui caixa e cabo originais?","tradein_battery_pct":"Qual % de bateria?","tradein_apple_warranty":"Está dentro da garantia Apple?","tradein_warranty_until":"Se sim, até quando vai a garantia Apple?"};
function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
function isMissing(value) {
  return value === null || value === undefined || value === '';
}
function getMissingFromList(state, fields) {
  return fields.filter((field) => {
    if (field === 'tradein_warranty_until') {
      return state.tradein_apple_warranty === true && isMissing(state.tradein_warranty_until);
    }
    return isMissing(state[field]);
  });
}
// Questionário (inclui caixa/cabo enquanto não respondido).
function getMissingTradeInFields(state) {
  return getMissingFromList(state, TRADE_IN_FIELDS);
}
// Gating de avaliação completa / simulação (caixa/cabo nunca bloqueia).
function getMissingRequiredTradeInFields(state) {
  return getMissingFromList(state, REQUIRED_TRADE_IN_FIELDS);
}
function hasConsentPrompt(value) {
  const text = normalizeText(value);
  return /(posso|consegue|pode).*(pergunt|avali|responder)/.test(text);
}
function hasQuestionnaire(value) {
  return (String(value ?? '').match(/(?:^|\n)R:/g) || []).length >= 2;
}
function isAffirmative(value) {
  return /^(sim|pode|manda|claro|ok|beleza|bora|vamos|pode mandar)\b/.test(normalizeText(value));
}
function deriveTradeInDecision(state) {
  const missingFields = getMissingTradeInFields(state);            // conteúdo do questionário
  const requiredMissing = getMissingRequiredTradeInFields(state);  // gating (sem caixa/cabo)
  if (state.has_tradein !== true || !state.tradein_model || requiredMissing.length === 0) {
    return {
      status: requiredMissing.length === 0 ? 'complete' : 'not_started',
      action: null,
      missingFields,
      canSimulate: state.has_tradein !== true || (
        state.tradein_disqualified !== true
        && state.tradein_model_accepted !== false
        && requiredMissing.length === 0
      ),
    };
  }

  const lastMessage = state.last_message_content ?? '';
  const currentMessage = state.message_buffered ?? '';
  const collecting = hasQuestionnaire(lastMessage)
    || (hasConsentPrompt(lastMessage) && isAffirmative(currentMessage));
  return {
    status: collecting ? 'collecting' : 'awaiting_consent',
    action: collecting ? 'send_tradein_questionnaire' : 'ask_tradein_consent',
    missingFields,
    canSimulate: false,
  };
}
function buildAtomicTradeInResponse(state, decision = deriveTradeInDecision(state)) {
  if (decision.action === 'ask_tradein_consent') {
    return {
      message: `Pra avaliar seu ${state.tradein_model} e garantir o melhor valor possível de entrada, posso te mandar umas perguntas rápidas?`,
      transfer: false,
      delivery_mode: 'normal',
    };
  }
  const lines = [
    'Perfeito! Copie a mensagem, preencha após cada R: e me envie:',
    ...decision.missingFields.flatMap((field) => ['', TRADE_IN_QUESTIONS[field], 'R:']),
  ];
  return {
    message: lines.join('\n'),
    transfer: false,
    delivery_mode: 'atomic',
  };
}
function resolveSimulationMode(message, deviceCount) {
  if (deviceCount < 2) return 'single';
  const text = normalizeText(message);
  const bundle = /\b(comprar|levar|fechar|reservar)\b.*\b(os dois|dois aparelhos|2 aparelhos|ambos)\b/.test(text);
  const comparison = /\b(ou|versus|vs|comparar|comparativo|qual compensa|diferenca|cada um)\b/.test(text);
  return bundle && !comparison ? 'bundle' : 'comparison';
}

const inputData = $input.first().json;
let context = {};
try { context = $('Edit Fields5').last().json ?? {}; } catch (error) { context = {}; }
const state = {
  ...(context.memory ?? {}),
  ...context,
  last_message_content: context.last_message_content ?? context.memory?.last_message_content ?? "",
  message_buffered: context.message_buffered ?? context.buffer?.message_buffered ?? "",
};
const decision = deriveTradeInDecision(state);
if (decision.action) {
  const router = buildAtomicTradeInResponse(state, decision);
  return [{ json: { ...inputData, router, delivery_mode: router.delivery_mode, router_parse_ok: true } }];
}
let raw = String(inputData.output || "").trim();
raw = raw.replace(/^\`\`\`json\s*/i, "").replace(/^\`\`\`\s*/i, "").replace(/\`\`\`$/i, "").trim();
try {
  const router = JSON.parse(raw);
  if (router && typeof router.message === "string") { router.message = repasseHumanizeMessage(router.message); }
  return [{ json: { ...inputData, router, delivery_mode: router.delivery_mode ?? "normal", router_parse_ok: true } }];
} catch (error) {
  return [{ json: { ...inputData, router_parse_ok: false, router_parse_error: String(error.message || error), router_raw: raw } }];
}
// REPASSE DETERMINISTIC BIA1 RESPONSE END
