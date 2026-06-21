// buffer_pending_detail.block.js — PURE logic (no $json/$input/$()).
// Canonical source duplicated INLINE into the "Calcular Wait Buffer" node.
//
// classifyBiaQuestion: BYTE-COPY dos regexes do nó VIVO "Code Parse Memory 2"
//   (n8n/ia-repasse-pro-v2/nodes/code/40_05_code-parse-memory-2.js). Mais rico que
//   reply_attribution.block.js — inclui "parte do pagamento"/"na troca", que é o
//   phrasing real do opener de entrada. A consistência é travada pelo teste.
// decideBufferWait: estende a janela de debounce de baseSeconds para 40s quando há
//   uma pergunta de detalhe pendente E a resposta é única/curta/parcial que ainda
//   não contém o detalhe pedido. Caso contrário devolve a base intacta.

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
