// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     Calcular Wait Buffer
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    10 buffer-lock
// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.
// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====
// Calcula a janela de debounce do buffer antes do Wait1 (context-aware).
// Base dinâmica (15/20/25s) PRESERVADA; estende p/ 40s só quando há pergunta de
// detalhe pendente (pending_detail) e a resposta única parece parcial.
function normalizeReplyText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// === CLASSIFY-BIA-QUESTION (cópia verbatim do nó vivo Code Parse Memory 2) ===
function classifyBiaQuestion(quotedText) {
  const t = normalizeReplyText(quotedText);
  if (!t) return null;
  if (/valor de entrada|entrada no pix|entrada em dinheiro|pix\/dinheiro|algum valor de entrada/.test(t)) return 'cash_entry';
  if (/aparelho que voce tem|aparelho atual|que voce tem (agora|hoje)|seu aparelho|aparelho de entrada|dar como entrada|dar de entrada|dar de entr|pra dar de entrada|de entrada|parte do pagamento|dar (algum|um|seu) (iphone|aparelho|celular)|na troca|de troca|pra troca|para troca|dar na troca/.test(t)) return 'tradein_model';
  if (/qual modelo|modelo de iphone|(deseja|quer) comprar|esta procurando|ta procurando|procurando/.test(t)) return 'desired_model';
  if (/armazenamento|capacidade|quantos gb|quantos giga/.test(t)) return 'desired_capacity';
  if (/\bcor\b|\bcores\b|qual cor/.test(t)) return 'desired_color';
  return null;
}
// === END CLASSIFY-BIA-QUESTION ===

const IPHONE_MODEL_RE = /\b(\d{1,2})\s?(pro\s?max|pro|plus|max|mini|promax|pm|p|\+)?\b|\b(xr|xs|se)\b/;
const COLOR_RE = /\b(preto|branco|azul|verde|rosa|roxo|lilas|cinza|natural|dourado|gold|deserto|vermelho|titanio|titânio|meia noite|estelar)\b/;

function replyContainsDetail(text, expects) {
  const t = normalizeReplyText(text);
  if (!t) return false;
  if (expects === 'tradein_model' || expects === 'desired_model') return IPHONE_MODEL_RE.test(t);
  if (expects === 'desired_capacity') return /\b\d+\s?(gb|tb)\b/.test(t.replace(/\s/g, ' '));
  if (expects === 'desired_color') return COLOR_RE.test(t);
  if (expects === 'cash_entry') return /\b\d/.test(t) || /\b(nao|sem entrada|nada|so no cartao|tudo no cartao)\b/.test(t);
  return false;
}

function isAffirmative(text) {
  const t = normalizeReplyText(text);
  return /^(s|sim|tenho|quero|aceito|pode|isso|positivo|claro|ok|opa|tenho sim|quero sim)\b/.test(t);
}

function decideBufferWait(input) {
  const messages = Array.isArray(input?.messages) ? input.messages : [];
  const baseSeconds = Number(input?.baseSeconds ?? 25);
  const baseReason = String(input?.baseReason ?? 'fallback_25s');
  const lastBotText = input?.lastBotText ?? '';

  // Só considera estender numa resposta ÚNICA (um único evento neste burst).
  if (messages.length !== 1) return { seconds: baseSeconds, reason: baseReason };

  const expects = classifyBiaQuestion(lastBotText);
  if (!expects) return { seconds: baseSeconds, reason: baseReason };

  const current = messages[0] || {};
  const type = normalizeReplyText(current.type || 'text');
  if (type && !['text', 'extendedtextmessage', 'conversation'].includes(type)) {
    return { seconds: baseSeconds, reason: baseReason };
  }

  const text = current.text || '';
  // Já respondeu o detalhe de uma vez → não atrasa.
  if (replyContainsDetail(text, expects)) return { seconds: baseSeconds, reason: baseReason };

  // Afirmativo nu OU resposta bem curta → provável resposta parcial a caminho.
  const short = isAffirmative(text) || normalizeReplyText(text).length <= 40;
  if (!short) return { seconds: baseSeconds, reason: baseReason };

  return { seconds: 40, reason: 'pending_detail_extend:' + expects };
}

const src = $('Redis Set Buffer').first().json;
const buffer = src.buffer_obj || {};
const messages = Array.isArray(buffer.messages) ? buffer.messages : [];

function isGreetingOnly(text){ return /^(oi|ola|olá|bom dia|boa tarde|boa noite|opa|e ai|e aí)$/.test(text); }
function isSafeShortReply(text){
  if (!text || isGreetingOnly(text)) return false;
  const compact = text.replace(/\s/g,'');
  if (/^(s|sim|nao|não|n|ok|okay|certo|pode|quero|aceito|fechado|combinado)$/.test(text)) return true;
  if (/^(64|128|256|512)gb?$/.test(compact) || /^(1|2)tb$/.test(compact)) return true;
  if (/^(preto|branco|azul|verde|rosa|roxo|lilas|lilás|cinza|natural|dourado|gold|deserto|vermelho)$/.test(text)) return true;
  if (/^(fortaleza|sobral|eusebio|eusébio|maracanau|maracanaú|caucaia|juazeiro|iguatu)$/.test(text)) return true;
  if (/^(pix|cartao|cartão|credito|crédito|debito|débito|dinheiro|a vista|à vista)$/.test(text)) return true;
  if (/^(novo|seminovo|usado|lacrado)$/.test(text)) return true;
  const words = text.split(' ').filter(Boolean);
  return text.length <= 30 && words.length <= 4;
}

const current = messages.length ? messages[messages.length-1] : {};
const ntext = normalizeReplyText(current.text || src.message_buffered || '');
const ntype = normalizeReplyText(current.type || 'text');
const words = ntext.split(' ').filter(Boolean);

let baseSeconds = 25, baseReason = 'fallback_25s';
if (!ntext) baseReason = 'fallback_25s_sem_texto';
else if (ntype && !['text','extendedtextmessage','conversation'].includes(ntype)) baseReason = 'fallback_25s_midia_ou_tipo_complexo';
else if (messages.length > 1) baseReason = 'fallback_25s_buffer_com_multiplas_mensagens';
else if (isSafeShortReply(ntext)) { baseSeconds = 15; baseReason = 'resposta_curta_segura_15s'; }
else if (ntext.length <= 100 && words.length <= 14) { baseSeconds = 20; baseReason = 'resposta_media_texto_unico_20s'; }

let lastBotText = '';
try { lastBotText = String($('Redis Get pending_detail').first().json.pending_detail_raw || ''); } catch (e) { lastBotText = ''; }

const decided = decideBufferWait({ messages, lastBotText, baseSeconds, baseReason });

return [{ json: { ...src, buffer_wait_seconds: decided.seconds, buffer_wait_reason: decided.reason } }];
