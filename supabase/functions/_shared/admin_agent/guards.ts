// Deterministic honesty guards for the admin agent's free-text (LLM) replies.
//
// The LLM only ever has read + `prepare_*` tools — it can NEVER execute a write
// (money/stock only moves through `executePending`, called deterministically in
// runner.ts after the admin replies SIM). Therefore, in the LLM path any reply
// that:
//   - asks the admin to confirm an operation (SIM/NÃO), or
//   - claims a money/stock operation was completed ("registrado com sucesso"),
// is only trustworthy when it is backed by a real staged pending action. When it
// is not, the model fabricated the confirmation/success and we must neutralize
// it so the agent never implies money moved when it did not.

function norm(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

// "responda sim...", "sim/não", "confirmar ... sim", "digite sim" — the ways the
// model asks for a SIM/NÃO confirmation. A read reply never asks for this.
const CONFIRM_ASK_RE =
  /responda[^.\n]*\bsim\b|\bsim\b\s*(?:ou|\/)\s*\*?nao|confirmar?[^.\n]*\bsim\b|digite[^.\n]*\bsim\b/;

/** True when the reply asks the admin to confirm an operation with SIM/NÃO. */
export function asksConfirmation(reply: string): boolean {
  return CONFIRM_ASK_RE.test(norm(reply));
}

// A success marker (kept case/emoji sensitive) next to an operation word. Tight
// on purpose: a read that merely lists past transactions ("despesa registrada
// em 08/07") has no success marker, so it is not flagged.
const SUCCESS_MARK_RE = /com sucesso|sucesso!|✅|✔️|☑️/;
const OPERATION_WORD_RE =
  /despesa|receita|\bsaida\b|\bentrada\b|transferen|transferid|pagament|\bpago\b|\bpaga\b|recebiment|recebid|lancament|lancad|reserva|reservad|movimenta|estorn|deposit|debitad|creditad|quitad|baixad/;

/** True when the reply asserts a money/stock write was completed. */
export function claimsWriteSuccess(reply: string): boolean {
  return SUCCESS_MARK_RE.test(String(reply ?? "")) && OPERATION_WORD_RE.test(norm(reply));
}

/** True when the reply pretends an operation happened or is staged. */
export function fabricatesOperation(reply: string): boolean {
  return asksConfirmation(reply) || claimsWriteSuccess(reply);
}
