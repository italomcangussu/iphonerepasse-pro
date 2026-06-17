// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     Calcular Wait Buffer
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    10 buffer-lock
// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.
// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====
// Calcula a janela de debounce do buffer antes do Wait1.
// Mantem 25s como fallback seguro e encurta apenas respostas textuais simples.
function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function lastMessage(buffer) {
  const messages = Array.isArray(buffer?.messages) ? buffer.messages : [];
  return messages.length > 0 ? messages[messages.length - 1] : null;
}

function isGreetingOnly(text) {
  return /^(oi|ola|olá|bom dia|boa tarde|boa noite|opa|e ai|e aí)$/.test(text);
}

function isSafeShortReply(text) {
  if (!text || isGreetingOnly(text)) return false;

  const compact = text.replace(/\s/g, '');
  if (/^(s|sim|nao|não|n|ok|okay|certo|pode|quero|aceito|fechado|combinado)$/.test(text)) return true;
  if (/^(64|128|256|512)gb?$/.test(compact) || /^(1|2)tb$/.test(compact)) return true;
  if (/^(preto|branco|azul|verde|rosa|roxo|lilas|lilás|cinza|natural|dourado|gold|deserto|vermelho)$/.test(text)) return true;
  if (/^(fortaleza|sobral|eusebio|eusébio|maracanau|maracanaú|caucaia|juazeiro|iguatu)$/.test(text)) return true;
  if (/^(pix|cartao|cartão|credito|crédito|debito|débito|dinheiro|a vista|à vista)$/.test(text)) return true;
  if (/^(novo|seminovo|usado|lacrado)$/.test(text)) return true;

  const words = text.split(' ').filter(Boolean);
  return text.length <= 30 && words.length <= 4;
}

const input = $input.first().json;
const buffer = input.buffer_obj ?? input.buffer ?? {};
const messages = Array.isArray(buffer.messages) ? buffer.messages : [];
const current = lastMessage(buffer) ?? {};
const text = normalize(current.text ?? current.message ?? current.body ?? input.message_buffered ?? '');
const type = normalize(current.type ?? input.type ?? 'text');
const words = text.split(' ').filter(Boolean);

let buffer_wait_seconds = 25;
let buffer_wait_reason = 'fallback_25s';

if (!text) {
  buffer_wait_reason = 'fallback_25s_sem_texto';
} else if (type && !['text', 'extendedtextmessage', 'conversation'].includes(type)) {
  buffer_wait_reason = 'fallback_25s_midia_ou_tipo_complexo';
} else if (messages.length > 1) {
  buffer_wait_reason = 'fallback_25s_buffer_com_multiplas_mensagens';
} else if (isSafeShortReply(text)) {
  buffer_wait_seconds = 15;
  buffer_wait_reason = 'resposta_curta_segura_15s';
} else if (text.length <= 100 && words.length <= 14) {
  buffer_wait_seconds = 20;
  buffer_wait_reason = 'resposta_media_texto_unico_20s';
}

return [
  {
    json: {
      ...input,
      buffer_wait_seconds,
      buffer_wait_reason,
    },
  },
];
