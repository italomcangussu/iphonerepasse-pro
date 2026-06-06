export const REPLY_CONTEXT_MARKER_START = "// === REPASSE REPLY CONTEXT START ===";
export const REPLY_CONTEXT_MARKER_END = "// === REPASSE REPLY CONTEXT END ===";

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function nullableText(value, max = 300) {
  const text = clean(value);
  return text ? text.slice(0, max).trim() : null;
}

export function normalizeBufferedReplyContext(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const targetProviderMessageId = nullableText(value.target_provider_message_id);
  if (!targetProviderMessageId) return null;
  const previewSource = ["db_lookup", "reply_preview_text", "missing"].includes(clean(value.preview_source))
    ? clean(value.preview_source)
    : "missing";

  return {
    target_provider_message_id: targetProviderMessageId,
    target_message_id: nullableText(value.target_message_id),
    target_text: nullableText(value.target_text),
    target_direction: nullableText(value.target_direction),
    target_sender_type: nullableText(value.target_sender_type),
    target_created_at: nullableText(value.target_created_at),
    preview_source: previewSource,
  };
}

function senderLabel(senderType) {
  const normalized = clean(senderType);
  if (normalized === "ai_inbound") return "mensagem da IA";
  if (normalized === "human") return "mensagem do atendente";
  if (normalized === "customer") return "mensagem anterior do cliente";
  return "mensagem anterior";
}

export function renderReplyHint(replyContext) {
  const ctx = normalizeBufferedReplyContext(replyContext);
  if (!ctx) return "";
  if (!ctx.target_text) return "[Reply: cliente respondeu a uma mensagem anterior]";
  const quoted = ctx.target_text.replace(/"/g, "'");
  return `[Reply: cliente respondeu a ${senderLabel(ctx.target_sender_type)} "${quoted}"]`.slice(0, 360);
}

export function renderBufferedMessagesForAgents(messages) {
  return (Array.isArray(messages) ? messages : [])
    .map((message) => {
      const text = clean(message?.text);
      const hint = renderReplyHint(message?.reply_context);
      return [hint, text].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

export const N8N_REPLY_CONTEXT_BLOCK = `${REPLY_CONTEXT_MARKER_START}
function repasseClean(value) {
  return String(value ?? "").replace(/\\s+/g, " ").trim();
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
  return ("[Reply: cliente respondeu a " + repasseReplySenderLabel(ctx.target_sender_type) + " \\"" + quoted + "\\"]").slice(0, 360);
}

function repasseRenderMessageForAgents(message) {
  const text = repasseClean(message?.text);
  const hint = repasseRenderReplyHint(message?.reply_context);
  return [hint, text].filter(Boolean).join("\\n");
}
${REPLY_CONTEXT_MARKER_END}`;
