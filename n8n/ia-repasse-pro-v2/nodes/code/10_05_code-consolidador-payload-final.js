// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     Code Consolidador Payload Final
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    10 buffer-lock
// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.
// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====
// ═══════════════════════════════════════════════════════════════════════════
// CODE CONSOLIDADOR PAYLOAD FINAL
//
// Responsabilidade: identificar os três inputs do merge (buffer, lock,
// cliente), consolidar todos os campos num único objeto e disponibilizar
// para todos os agentes downstream.
//
// Inputs esperados (identificados por estrutura, não por posição):
//   bufferItem  → tem buffer_obj.messages[]
//   lockItem    → tem lock_key começando com "lock:"
//   clienteItem → tem contact_id + cliente{}
//
// Output: objeto único com cliente, buffer, lock, firstName, senderName,
//         chatid, lead_id, store_id, data e meta.
// ═══════════════════════════════════════════════════════════════════════════


// ── UTILITÁRIOS ──────────────────────────────────────────────────────────

function isEmpty(value) {
  if (value === null) { return true; }
  if (value === undefined) { return true; }
  var s = String(value);
  if (s.length === 0) { return true; }
  return false;
}

// Extrai o primeiro nome a partir do nome completo.
// Capitaliza a primeira letra e descarta nomes genéricos.
// Exemplos:
//   "Ítalo Mendes Cangussu" → "Ítalo"
//   "ANA PAULA"             → "Ana"
//   "joão"                  → "João"
//   "CLIENTE"               → null
//   null                    → null
function extractFirstName(fullName) {
  if (isEmpty(fullName)) { return null; }

  var trimmed = String(fullName).trim();
  if (trimmed.length === 0) { return null; }

  // Pega apenas o primeiro token antes do primeiro espaço
  var first = trimmed.split(" ")[0];
  if (!first || first.length === 0) { return null; }

  // Capitaliza: primeira letra maiúscula, resto minúsculo
  var firstName = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();

  // Descarta se parecer genérico — não é um nome real
  var genericos = [
    "usuario", "cliente", "contato", "user",
    "test", "teste", "null", "undefined",
    "atendimento", "suporte", "loja", "whatsapp"
  ];
  for (var i = 0; i < genericos.length; i++) {
    if (firstName.toLowerCase() === genericos[i]) { return null; }
  }

  return firstName;
}


// ── IDENTIFICAÇÃO DOS INPUTS POR ESTRUTURA ───────────────────────────────
// O Merge do n8n pode entregar os inputs em qualquer ordem dependendo
// de qual ramo terminou primeiro. Identificamos cada um pela estrutura
// dos campos, não pela posição no array.

var items = $input.all();

var bufferItem  = null;
var lockItem    = null;
var clienteItem = null;

for (var i = 0; i < items.length; i++) {
  var item = items[i].json;

  // bufferItem: tem buffer_obj com array de messages
  if (item.buffer_obj && Array.isArray(item.buffer_obj.messages)) {
    bufferItem = item;
    continue;
  }

  // lockItem: tem lock_key começando com "lock:"
  if (item.lock_key && String(item.lock_key).indexOf("lock:") === 0) {
    lockItem = item;
    continue;
  }

  // clienteItem: tem contact_id e objeto cliente
  if (item.contact_id && item.cliente) {
    clienteItem = item;
    continue;
  }
}


// ── VALIDAÇÃO DOS INPUTS ─────────────────────────────────────────────────

var warnings = [];

if (!bufferItem) {
  warnings.push("bufferItem nao identificado — verifique o Merge anterior");
}
if (!lockItem) {
  warnings.push("lockItem nao identificado — verifique o Redis Set Lock");
}
if (!clienteItem) {
  warnings.push("clienteItem nao identificado — verifique o CRM Leads GET ou Load Buffer");
}

if (!bufferItem) {
  throw new Error("[Consolidador] bufferItem ausente. Inputs recebidos: " + items.length);
}


// ── EXTRAÇÃO DO BUFFER ───────────────────────────────────────────────────

var bufferObj = bufferItem.buffer_obj || {};
var messages  = Array.isArray(bufferObj.messages) ? bufferObj.messages : [];

// === REPASSE REPLY CONTEXT START ===
function repasseClean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function repasseNullableText(value, max = 300) {
  const text = repasseClean(value);
  return text ? text.slice(0, max).trim() : null;
}

function repasseNormalizeReplyContext(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const targetProviderMessageId = repasseNullableText(value.target_provider_message_id);
  if (!targetProviderMessageId) return null;
  const rawSource = repasseClean(value.preview_source);
  const previewSource = ["db_lookup", "reply_preview_text", "missing"].includes(rawSource) ? rawSource : "missing";
  return {
    target_provider_message_id: targetProviderMessageId,
    target_message_id: repasseNullableText(value.target_message_id),
    target_text: repasseNullableText(value.target_text),
    target_direction: repasseNullableText(value.target_direction),
    target_sender_type: repasseNullableText(value.target_sender_type),
    target_created_at: repasseNullableText(value.target_created_at),
    preview_source: previewSource,
  };
}

function repasseReplySenderLabel(senderType) {
  const normalized = repasseClean(senderType);
  if (normalized === "ai_inbound") return "mensagem da IA";
  if (normalized === "human") return "mensagem do atendente";
  if (normalized === "customer") return "mensagem anterior do cliente";
  return "mensagem anterior";
}

function repasseRenderReplyHint(replyContext) {
  const ctx = repasseNormalizeReplyContext(replyContext);
  if (!ctx) return "";
  if (!ctx.target_text) return "[Reply: cliente respondeu a uma mensagem anterior]";
  const quoted = ctx.target_text.replace(/"/g, "'");
  return ("[Reply: cliente respondeu a " + repasseReplySenderLabel(ctx.target_sender_type) + " \"" + quoted + "\"]").slice(0, 360);
}

function repasseRenderMessageForAgents(message) {
  const text = repasseClean(message?.text);
  const hint = repasseRenderReplyHint(message?.reply_context);
  return [hint, text].filter(Boolean).join("\n");
}
// === REPASSE REPLY CONTEXT END ===

// Consolida a mensagem buffered: todas as mensagens concatenadas em ordem, preservando contexto de reply
var messageTexts = [];
for (var j = 0; j < messages.length; j++) {
  var rendered = repasseRenderMessageForAgents(messages[j]);
  if (!isEmpty(rendered)) {
    messageTexts.push(String(rendered).trim());
  }
}
var messageBuffered = messageTexts.join("\n");


// ── RESOLUÇÃO DO senderName ──────────────────────────────────────────────
// Ordem de prioridade:
//   1. buffer_obj.sender_name (definido no Code Atualizar Estado Buffer)
//   2. clienteItem.name ou clienteItem.cliente.name
//   3. primeira mensagem do buffer

var senderName = null;

if (!isEmpty(bufferObj.sender_name)) {
  senderName = String(bufferObj.sender_name).trim();
} else if (clienteItem) {
  var clienteNome = (clienteItem.cliente && clienteItem.cliente.name)
    ? clienteItem.cliente.name
    : (clienteItem.name || null);
  if (!isEmpty(clienteNome)) {
    senderName = String(clienteNome).trim();
  }
}

if (!senderName && messages.length > 0) {
  var primeiraMsgSender = messages[0].sender_name || messages[0].pushName || null;
  if (!isEmpty(primeiraMsgSender)) {
    senderName = String(primeiraMsgSender).trim();
  }
}


// ── EXTRAÇÃO DO firstName ────────────────────────────────────────────────
var firstName = extractFirstName(senderName);


// ── EXTRAÇÃO DOS IDENTIFICADORES ────────────────────────────────────────

var chatid   = bufferObj.chatid   || (clienteItem && clienteItem.chatid)   || null;
var leadId   = bufferObj.lead_id  || (clienteItem && clienteItem.lead_id)  ||
               bufferItem.lead_id || null;
var storeId  = bufferObj.store_id || (clienteItem && clienteItem.store_id) ||
               bufferItem.store_id || null;
var contactId   = (clienteItem && clienteItem.contact_id) || bufferObj.contact_id || null;


// ── EXTRAÇÃO DO LOCK ─────────────────────────────────────────────────────

var lockKey   = lockItem ? (lockItem.lock_key   || null) : null;
var lockValue = lockItem ? (lockItem.lock_value || null) : null;


// ── EXTRAÇÃO DO CLIENTE (dados CRM) ─────────────────────────────────────

var clienteData = {};
if (clienteItem && clienteItem.cliente) {
  clienteData = clienteItem.cliente;
} else if (clienteItem) {
  // Fallback: o clienteItem em si pode conter os campos diretos
  clienteData = {
    contact_id:      contactId,
    chatid:       chatid,
    name:         senderName,
    phone_number: clienteItem.phone_number || null
  };
}


// ── EXTRAÇÃO DO STATUS DA LOJA ───────────────────────────────────────────
// O status da loja vem do CRM Leads GET ou do nó de status separado.
// Preservamos o objeto data completo para os agentes.

var storeData = null;

if (clienteItem && clienteItem.data) {
  storeData = clienteItem.data;
} else if (bufferItem.data) {
  storeData = bufferItem.data;
}


// ── TIMESTAMPS ───────────────────────────────────────────────────────────

var firstMessageAt = bufferObj.first_message_at || (messages.length > 0 ? messages[0].created_at : null) || null;
var lastMessageAt  = bufferObj.last_message_at  || (messages.length > 0 ? messages[messages.length - 1].created_at : null) || null;
var eventIdVencedor = bufferItem.event_id_vencedor || bufferObj.last_event_id || null;


// ── RETORNO FINAL ─────────────────────────────────────────────────────────

return [
  {
    json: {

      // Dados do cliente para os agentes e CRM
      cliente: {
        contact_id:      contactId,
        chatid:       chatid,
        name:         senderName,
        phone_number: clienteData.phone_number || null,
        timestamp:    lastMessageAt
      },

      // Dados do buffer consolidado
      buffer: {
        message_buffered:  messageBuffered,
        message_count:     messages.length,
        event_id_vencedor: eventIdVencedor,
        first_message_at:  firstMessageAt,
        last_message_at:   lastMessageAt,
        messages:          messages
      },

      // Dados do lock Redis
      lock: {
        lock_key:   lockKey,
        lock_value: lockValue
      },

      // Campos de conveniência — disponíveis via $('Load Buffer Final').item.json.X
      senderName: senderName,
      firstName:  firstName,
      chatid:     chatid,
      lead_id:    leadId,
      store_id:   storeId,

      // Status operacional da loja
      data: storeData,

      // Metadados de controle
      meta: {
        consolidated_at: new Date().toISOString(),
        warnings:        warnings
      }

    }
  }
];
