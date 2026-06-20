// reply_attribution.block.js — PURE logic (no $json/$input/$()).
// Canonical source duplicated INLINE into the "Code Parse Memory 2" node.
// classifyBiaQuestion: maps the quoted Bia question text to the field it asked about.
// applyReplyAttribution: when the client replied to a Bia question, place their
// answer in the right field (authoritative over the LLM reconciler).

function normalizeReplyText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normModelKey(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function classifyBiaQuestion(quotedText) {
  const t = normalizeReplyText(quotedText);
  if (!t) return null;
  // cash entry (money/Pix down payment before simulating)
  if (/valor de entrada|entrada no pix|entrada em dinheiro|pix\/dinheiro|algum valor de entrada/.test(t)) return 'cash_entry';
  // current device / trade-in
  if (/aparelho que voce tem|aparelho atual|que voce tem (agora|hoje)|seu aparelho|aparelho de entrada|dar como entrada|dar de entrada/.test(t)) return 'tradein_model';
  // desired model (purchase)
  if (/qual modelo|modelo de iphone|(deseja|quer) comprar|esta procurando|ta procurando|procurando/.test(t)) return 'desired_model';
  // capacity
  if (/armazenamento|capacidade|quantos gb|quantos giga/.test(t)) return 'desired_capacity';
  // color
  if (/\bcor\b|\bcores\b|qual cor/.test(t)) return 'desired_color';
  return null;
}

function applyReplyAttribution(memory, priorLeadState, replyContext, currentMessage) {
  const out = Object.assign({}, memory || {});
  const ctx = replyContext || {};
  const quoted = ctx.target_text;
  if (!quoted) return out;
  // Only act when the quoted message was a Bia (outbound) question. If direction
  // is unknown (preview-only fallback), still proceed — the text is the signal.
  if (ctx.target_direction && ctx.target_direction !== 'outbound') return out;
  const answer = String(currentMessage || '').trim();
  if (!answer) return out;

  const category = classifyBiaQuestion(quoted);
  if (!category) return out;

  const prev = priorLeadState || {};

  if (category === 'tradein_model') {
    // The freshly recognized model (the client's answer) is the ENTRY device.
    // The reconciler may have wrongly placed it into desired_model; the new model
    // is whatever desired_model the reconciler produced that differs from prev.
    const freshModel =
      (out.desired_model && normModelKey(out.desired_model) !== normModelKey(prev.desired_model))
        ? out.desired_model
        : (out.tradein_model || null);
    if (freshModel) {
      out.tradein_model = freshModel;
      out.has_tradein = true;
      out.interest_type = 'trocar';
      // restore the desired the client actually wants to BUY
      out.desired_model = prev.desired_model
        || (normModelKey(out.desired_model) === normModelKey(freshModel) ? null : out.desired_model);
      out.desired_capacity = (prev.desired_capacity != null) ? prev.desired_capacity : (out.desired_capacity != null ? out.desired_capacity : null);
    }
    out.reply_attributed_category = 'tradein_model';
    return out;
  }

  if (category === 'desired_model') {
    // Keep the freshly recognized model as desired; ensure it wasn't misrouted to trade-in.
    if (out.desired_model) out.reply_attributed_category = 'desired_model';
    return out;
  }

  // capacity / color / cash_entry: record the anchor; the reconciler's own
  // extraction of these is reliable, so we only tag (no risky field rewrites).
  out.reply_attributed_category = category;
  return out;
}
