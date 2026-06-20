// reply_attribution.block.js — PURE logic (no $json/$input/$()).
// Canonical source duplicated INLINE into the "Code Parse Memory 2" node.
//
// classifyBiaQuestion: maps a Bia (outbound) question text to the field it asked.
// decideTradeinReclass: when the flash-lite reconciler overwrites desired_model
//   with the client's CURRENT device, restore the desired and move the new model
//   to trade-in — but ONLY when the bot actually asked for the current device
//   (via a quoted reply OR the last assistant message). This gate is what keeps a
//   plain browsing turn ("tem o 15?" ... "e o 16?") from fabricating a phantom
//   trade-in. Returns the patch to Object.assign onto memory, or null (no change).

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

// Explicit "I changed my mind about what I want to BUY" — the escape hatch that
// keeps a genuine switch of desire from being misread as a trade-in device.
const SWITCH_INTENT_RE = /(na verdade|mudei de ideia|muda pra|muda para|prefiro o|quero mesmo o|quero o outro|na real quero|pode ser o)/;

function classifyBiaQuestion(quotedText) {
  const t = normalizeReplyText(quotedText);
  if (!t) return null;
  // cash entry (money/Pix down payment before simulating)
  if (/valor de entrada|entrada no pix|entrada em dinheiro|pix\/dinheiro|algum valor de entrada/.test(t)) return 'cash_entry';
  // current device / trade-in — checked BEFORE desired so the combined opener
  // ("qual deseja comprar? e qual o aparelho atual?") classifies as trade-in.
  if (/aparelho que voce tem|aparelho atual|que voce tem (agora|hoje)|seu aparelho|aparelho de entrada|dar como entrada|dar de entrada|dar de entr|pra dar de entrada/.test(t)) return 'tradein_model';
  // desired model (purchase)
  if (/qual modelo|modelo de iphone|(deseja|quer) comprar|esta procurando|ta procurando|procurando/.test(t)) return 'desired_model';
  // capacity
  if (/armazenamento|capacidade|quantos gb|quantos giga/.test(t)) return 'desired_capacity';
  // color
  if (/\bcor\b|\bcores\b|qual cor/.test(t)) return 'desired_color';
  return null;
}

// Did the bot ask for the CURRENT device this turn? True when the client quoted
// (replied to) that question, OR the last assistant message was that question.
function askedForCurrentDevice(replyContext, lastBotMessage) {
  const ctx = replyContext || {};
  const askedViaReply = !!ctx.target_text
    && (!ctx.target_direction || ctx.target_direction === 'outbound')
    && classifyBiaQuestion(ctx.target_text) === 'tradein_model';
  const askedViaLastMsg = classifyBiaQuestion(lastBotMessage) === 'tradein_model';
  return askedViaReply || askedViaLastMsg;
}

function decideTradeinReclass(args) {
  const a = args || {};
  const memory = a.memory || {};
  const prev = a.prevLeadState || {};
  const prevDesired = prev.desired_model || null;
  const newDesired = memory.desired_model || null;

  // Only relevant when a desired was already locked and the new one differs.
  if (!prevDesired || !newDesired) return null;
  if (normModelKey(prevDesired) === normModelKey(newDesired)) return null;

  // Explicit change of desire wins — never reclassify it as trade-in.
  if (SWITCH_INTENT_RE.test(String(a.currentMessage || '').toLowerCase())) return null;

  // Only when no trade-in is captured yet and the client wants a single device.
  const noTradeinYet = !memory.tradein_model && memory.has_tradein !== true;
  const singleDevice = !memory.desired_devices
    || (Array.isArray(memory.desired_devices) && memory.desired_devices.length <= 1);
  if (!noTradeinYet || !singleDevice) return null;

  // THE GATE: the bot must have actually asked for the current device. Without
  // this, any model change between turns would fabricate a phantom trade-in.
  if (!askedForCurrentDevice(a.replyContext, a.lastBotMessage)) return null;

  return {
    tradein_model: newDesired,
    desired_model: prevDesired,
    desired_capacity: (prev.desired_capacity != null)
      ? prev.desired_capacity
      : (memory.desired_capacity != null ? memory.desired_capacity : null),
    has_tradein: true,
    interest_type: 'trocar',
    tradein_reclassified: true,
  };
}
