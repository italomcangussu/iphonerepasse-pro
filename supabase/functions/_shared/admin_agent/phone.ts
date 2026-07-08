// Pure phone helpers for admin-agent sender recognition.
//
// WhatsApp inbound numbers and the allowlist can disagree on the Brazilian
// 9th digit and on the country code, so matching is done on a canonical key
// (DDD + 8-digit subscriber number) rather than raw string equality.

/** Strip everything but digits. */
export function toDigits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

/**
 * Canonical Brazilian phone key used for allowlist matching.
 * - drops a leading 55 country code
 * - for an 11-digit local number (DDD + 9 + 8) whose 3rd digit is 9, drops the
 *   9 so `88 9 9999-8888` and `88 9999-8888` collapse to the same key
 * Returns the digits unchanged when it doesn't look like a BR mobile.
 */
export function brazilPhoneKey(value: unknown): string {
  let d = toDigits(value);
  if (!d) return "";
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  else if (d.length === 12 && d.startsWith("55")) d = d.slice(2);
  else if (d.length === 13 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11 && d[2] === "9") d = d.slice(0, 2) + d.slice(3);
  return d;
}

/** True when two phone values refer to the same subscriber. */
export function phonesMatch(a: unknown, b: unknown): boolean {
  const ka = brazilPhoneKey(a);
  const kb = brazilPhoneKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  // Fallback: compare the last 8 digits when one side lacks a DDD.
  const tail = (s: string) => s.slice(-8);
  return ka.length >= 8 && kb.length >= 8 && tail(ka) === tail(kb) &&
    // require DDD agreement when both carry one, to avoid cross-city collisions
    (ka.length < 10 || kb.length < 10 || ka.slice(0, 2) === kb.slice(0, 2));
}

const AFFIRM =
  /^(s|sim|isso|isso mesmo|confirmo?|confirmar|confirma|pode|pode sim|manda|manda ver|ok|okay|okey|blz|beleza|claro|com certeza|fecha|fechado|fechou|positivo|aprovado|aprova|autorizo|autorizado)\b/;
const NEGATE =
  /^(n|nao|não|negativo|cancela|cancelar|cancele|para|pare|deixa|deixa pra la|deixa pra lá|esquece|esqueça|nunca)\b/;

// Emojis carry no word boundary, so they are matched by inclusion, not regex.
const AFFIRM_EMOJI = ["👍", "✅", "🆗", "👌"];
const NEGATE_EMOJI = ["❌", "👎", "🚫"];

function normalizeReply(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.!,;:]+$/g, "")
    .trim();
}

/** Strict affirmation of a pending confirmation prompt. */
export function isAffirmation(value: unknown): boolean {
  const s = normalizeReply(value);
  return AFFIRM_EMOJI.some((e) => s.includes(e)) || AFFIRM.test(s);
}

/** Strict negation of a pending confirmation prompt. */
export function isNegation(value: unknown): boolean {
  const s = normalizeReply(value);
  return NEGATE_EMOJI.some((e) => s.includes(e)) || NEGATE.test(s);
}
