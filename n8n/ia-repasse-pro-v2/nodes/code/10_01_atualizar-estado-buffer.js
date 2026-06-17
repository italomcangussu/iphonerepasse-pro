// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     Atualizar Estado Buffer
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    10 buffer-lock
// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.
// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====
// ─────────────────────────────────────────────────────────────
// ATUALIZAR ESTADO BUFFER
//
// Recebe dois itens via Merge:
//   1. Resultado do "Redis Get Buffer" → contém o buffer existente
//      (ou nada, se for a primeira mensagem deste cliente)
//   2. Resultado do "Buffer + Data Lead" → contém o novo evento
//      que acabou de chegar, estruturado como objeto "buffer"
//
// Retorna um único item com:
//   - redis_key    → chave que será usada no Redis SET
//   - redis_value  → JSON serializado do buffer mesclado (para salvar no Redis)
//   - buffer_obj   → objeto já parseado (para uso downstream sem re-parsear)
//   - message_buffered → todas as mensagens concatenadas em texto puro
//   - message_count    → quantidade de mensagens no buffer
// ─────────────────────────────────────────────────────────────


// ── Utilitário: parse seguro de JSON ──────────────────────────
// Retorna o valor parseado, ou o fallback se qualquer coisa falhar.
// Também lida com o caso onde o valor já é um objeto (Redis às vezes
// retorna o valor já deserializado dependendo da versão do nó).
function safeParse(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value; // já deserializado
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

// ── Utilitário: normaliza uma mensagem individual ─────────────
// Garante que todos os campos existam e sejam do tipo correto,
// evitando que undefined/null cause problemas mais adiante.

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

function normalizeMessage(msg) {
  return {
    event_id:   String(msg?.event_id  ?? '').trim(),
    text:       String(msg?.text      ?? '').trim(),
    created_at: String(msg?.created_at ?? ''),
    type:       String(msg?.type       ?? 'text'),
    sender_name: String(msg?.sender_name ?? ''),
    reply_context: repasseNormalizeReplyContext(msg?.reply_context),
  };
}


// ═══════════════════════════════════════════════════════════════
// PASSO 1: Identificar os dois itens de entrada
// ═══════════════════════════════════════════════════════════════

const items = $input.all();

// O item do Redis Get Buffer é reconhecido pela presença explícita
// da propriedade "redis_buffer_value" — que foi definida no campo
// "propertyName" do nó Redis Get Buffer.
const redisItem = items.find(item =>
  Object.prototype.hasOwnProperty.call(item.json, 'redis_buffer_value')
);

// O item do Set node (Buffer + Data Lead) é reconhecido pela presença
// do campo "buffer", que foi montado manualmente naquele nó.
const incomingItem = items.find(item =>
  Object.prototype.hasOwnProperty.call(item.json, 'buffer')
);

// Proteção: se o item com o novo evento não chegou, algo deu errado
// antes deste nó e não há como continuar.
if (!incomingItem) {
  throw new Error(
    '[Atualizar Estado Buffer] Item "buffer" não encontrado na entrada. ' +
    'Verifique se o nó "Buffer + Data Lead" está conectado corretamente ao Merge.'
  );
}


// ═══════════════════════════════════════════════════════════════
// PASSO 2: Parsear os dados de entrada
// ═══════════════════════════════════════════════════════════════

// Novo evento que chegou agora
const incoming = safeParse(incomingItem.json.buffer, null);

if (!incoming || !incoming.contact_id) {
  throw new Error(
    '[Atualizar Estado Buffer] O campo "buffer" chegou vazio ou sem contact_id. ' +
    `Valor recebido: ${JSON.stringify(incomingItem.json.buffer)}`
  );
}

// Buffer existente no Redis (pode ser null se for a primeira mensagem)
const existingBufferRaw = redisItem?.json?.redis_buffer_value ?? null;
const existingBuffer = safeParse(existingBufferRaw, null);


// ═══════════════════════════════════════════════════════════════
// PASSO 3: Inicializar o buffer mesclado
//
// Se já existe um buffer no Redis, usamos ele como base para preservar
// o histórico de mensagens anteriores da mesma "rajada".
// Se não existe (primeira mensagem), criamos do zero.
// ═══════════════════════════════════════════════════════════════

let merged;

if (existingBuffer && typeof existingBuffer === 'object' && existingBuffer.contact_id) {
  // Há um buffer existente — usamos ele como base
  merged = {
    contact_id:      String(existingBuffer.contact_id),
    sender_name:     String(existingBuffer.sender_name ?? incoming.sender_name ?? ''),
    last_event_id:   String(existingBuffer.last_event_id ?? incoming.last_event_id),
    last_message_at: String(existingBuffer.last_message_at ?? incoming.last_message_at),
    messages: Array.isArray(existingBuffer.messages)
      ? existingBuffer.messages.map(normalizeMessage)
      : [],
  };
} else {
  // Nenhum buffer existente — este é o primeiro evento desta janela
  merged = {
    contact_id:      String(incoming.contact_id),
    sender_name:     String(incoming.sender_name ?? incoming.messages?.[0]?.sender_name ?? ''),
    last_event_id:   String(incoming.last_event_id),
    last_message_at: String(incoming.last_message_at),
    messages: [],
  };
}


// ═══════════════════════════════════════════════════════════════
// PASSO 4: Adicionar as novas mensagens com deduplicação
//
// Usamos um Set de event_ids já presentes para garantir que a mesma
// mensagem nunca seja adicionada duas vezes, mesmo que o fluxo seja
// acionado mais de uma vez pelo mesmo evento (idempotência).
// ═══════════════════════════════════════════════════════════════

const existingIds = new Set(
  merged.messages
    .map(m => m.event_id)
    .filter(id => id !== '') // ignora IDs vazios para não criar colisões falsas
);

for (const msg of (incoming.messages ?? []).map(normalizeMessage)) {
  // Só adiciona se tiver um event_id válido e ainda não estiver no buffer
  if (!msg.event_id || existingIds.has(msg.event_id)) continue;

  merged.messages.push(msg);
  existingIds.add(msg.event_id);
}


// ═══════════════════════════════════════════════════════════════
// PASSO 5: Ordenar e atualizar os campos de controle
//
// Ordenamos por created_at para garantir que as mensagens apareçam
// na sequência cronológica correta, independentemente da ordem de
// chegada no n8n.
//
// Atualizamos last_event_id e last_message_at SEMPRE com os valores
// do incoming (evento atual), porque este é o mais recente que
// chegou — e é esse event_id que será comparado no "Verificar vencedor"
// para decidir se esta execução é a "vencedora" da janela de debounce.
// ═══════════════════════════════════════════════════════════════

merged.messages.sort((a, b) => {
  const ta = new Date(a.created_at).getTime() || 0;
  const tb = new Date(b.created_at).getTime() || 0;
  return ta - tb;
});

// Atualiza sempre com o evento atual (mais recente desta execução)
merged.last_event_id   = String(incoming.last_event_id);
merged.last_message_at = String(incoming.last_message_at);

// Se o sender_name ainda não foi resolvido, tenta pegar das mensagens
if (!merged.sender_name && merged.messages.length > 0) {
  merged.sender_name = merged.messages[0].sender_name || '';
}


// ═══════════════════════════════════════════════════════════════
// PASSO 6: Montar o output
// ═══════════════════════════════════════════════════════════════

// Texto concatenado de todas as mensagens — é isso que vai para os agentes de IA
const messageBuffered = merged.messages
  .map(m => m.text)
  .filter(text => text !== '')
  .join('\n')
  .trim();

return [
  {
    json: {
      // Chave e valor para o nó Redis Set Buffer logo à frente
      redis_key:   merged.contact_id,
      redis_value: JSON.stringify(merged),

      // Objeto já parseado para uso nos nós seguintes sem re-parsear
      buffer_obj: merged,

      // Conveniências para acesso rápido downstream
      message_buffered: messageBuffered,
      message_count:    merged.messages.length,
    }
  }
];
