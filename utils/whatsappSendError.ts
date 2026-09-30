/**
 * Traduz falhas das edge functions de envio por WhatsApp em mensagens que o
 * operador consegue agir em cima.
 *
 * `supabase.functions.invoke` converte qualquer resposta não-2xx num
 * `FunctionsHttpError` cuja `message` é sempre o texto genérico "Edge Function
 * returned a non-2xx status code". O motivo real (ex.: "o número não está no
 * WhatsApp") viaja no corpo da resposta, em `error.context`.
 */

const GENERIC_INVOKE_ERROR = /non-2xx status code/i;

const formatBrazilianPhone = (digits: string): string => {
  const match = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(digits);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : `+${digits}`;
};

const pickText = (parsed: { error?: unknown; message?: unknown } | null): string | null =>
  [parsed?.error, parsed?.message].find(
    (value): value is string => typeof value === 'string' && value.trim() !== ''
  ) ?? null;

/** `uaz_send_failed:500:provider_error:{"error":"..."}` → o texto interno do provedor. */
const unwrapProviderError = (raw: string): string => {
  const braceIndex = raw.indexOf('{');
  if (braceIndex < 0) return raw;
  try {
    return pickText(JSON.parse(raw.slice(braceIndex))) ?? raw;
  } catch {
    return raw;
  }
};

export const describeWhatsAppSendError = (raw: string, phone?: string): string => {
  const inner = unwrapProviderError(raw);

  if (/not on whatsapp/i.test(inner)) {
    const jidDigits = /(\d{10,15})@s\.whatsapp\.net/i.exec(inner)?.[1];
    const digits = jidDigits || String(phone ?? '').replace(/\D/g, '');
    const label = digits ? `O número ${formatBrazilianPhone(digits)}` : 'O número do cliente';
    return `${label} não está no WhatsApp. Confira o telefone cadastrado do cliente.`;
  }

  if (/disconnected|not reconnectable/i.test(inner)) {
    return 'O WhatsApp da loja está desconectado. Reconecte o canal em CRM › Canais e tente de novo.';
  }

  return inner;
};

const readResponseBody = async (context: unknown): Promise<string | null> => {
  if (!context || typeof (context as Response).text !== 'function') return null;
  try {
    const source = typeof (context as Response).clone === 'function'
      ? (context as Response).clone()
      : (context as Response);
    const text = await source.text();
    if (!text) return null;
    try {
      return pickText(JSON.parse(text)) ?? text;
    } catch {
      return text;
    }
  } catch {
    return null;
  }
};

/**
 * Converte o `error` devolvido por `supabase.functions.invoke` (ou o campo `error`
 * do corpo de um 2xx) num `Error` com mensagem legível.
 */
export const toWhatsAppSendError = async (error: unknown, phone?: string): Promise<Error> => {
  if (typeof error === 'string') {
    return new Error(describeWhatsAppSendError(error, phone));
  }

  const rawMessage = (error as { message?: unknown } | null)?.message;
  const message = typeof rawMessage === 'string' ? rawMessage : '';
  const bodyMessage = await readResponseBody((error as { context?: unknown } | null)?.context);
  const raw = bodyMessage || message;

  if (!raw) {
    return error instanceof Error ? error : new Error('Erro ao enviar pelo WhatsApp.');
  }
  if (!bodyMessage && GENERIC_INVOKE_ERROR.test(raw)) {
    return error instanceof Error ? error : new Error(raw);
  }
  return new Error(describeWhatsAppSendError(raw, phone));
};
