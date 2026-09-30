/**
 * Traduz falhas das edge functions de envio por WhatsApp em erros que o
 * operador consegue agir em cima: **o que houve** (`message`) + **o que fazer**
 * (`hint`), nunca "Erro 502" nem "non-2xx status code".
 *
 * `supabase.functions.invoke` converte qualquer resposta não-2xx num
 * `FunctionsHttpError` cuja `message` é sempre o texto genérico "Edge Function
 * returned a non-2xx status code". O motivo real (ex.: "o número não está no
 * WhatsApp") viaja no corpo da resposta, em `error.context`.
 */

export type WhatsAppSendErrorKind =
  | 'invalid-number'
  | 'disconnected'
  | 'no-channel'
  | 'network'
  | 'unknown';

export type WhatsAppSendDiagnosis = {
  kind: WhatsAppSendErrorKind;
  /** O que aconteceu, em uma frase, sem culpar o operador. */
  message: string;
  /** O próximo passo concreto. */
  hint: string;
};

export class WhatsAppSendError extends Error {
  readonly kind: WhatsAppSendErrorKind;
  readonly hint: string;

  constructor({ kind, message, hint }: WhatsAppSendDiagnosis) {
    super(message);
    this.name = 'WhatsAppSendError';
    this.kind = kind;
    this.hint = hint;
  }
}

const GENERIC_INVOKE_ERROR = /non-2xx status code/i;
const NETWORK_ERROR = /failed to send a request|failed to fetch|fetch failed|network ?error|load failed/i;

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

export const diagnoseWhatsAppSendError = (raw: string, phone?: string): WhatsAppSendDiagnosis => {
  const inner = unwrapProviderError(String(raw ?? '').trim());

  if (/not on whatsapp/i.test(inner)) {
    const jidDigits = /(\d{10,15})@s\.whatsapp\.net/i.exec(inner)?.[1];
    const digits = jidDigits || String(phone ?? '').replace(/\D/g, '');
    return {
      kind: 'invalid-number',
      message: digits
        ? `O número ${formatBrazilianPhone(digits)} não está no WhatsApp.`
        : 'O número do cliente não está no WhatsApp.',
      hint: 'Confira se o telefone cadastrado do cliente está correto.'
    };
  }

  if (/disconnected|not reconnectable/i.test(inner)) {
    return {
      kind: 'disconnected',
      message: 'O WhatsApp da loja está desconectado, então a mensagem não saiu.',
      hint: 'Reconecte o canal em CRM › Canais e tente de novo.'
    };
  }

  if (/telefone (inválido|do cliente é obrigatório)/i.test(inner)) {
    return {
      kind: 'invalid-number',
      message: inner,
      hint: 'Informe o telefone com DDD, por exemplo (85) 99999-0000.'
    };
  }

  if (/nenhum canal whatsapp ativo/i.test(inner)) {
    return {
      kind: 'no-channel',
      message: 'Nenhum canal WhatsApp ativo configurado para esta loja.',
      hint: 'Conecte um canal em CRM › Canais e tente de novo.'
    };
  }

  if (NETWORK_ERROR.test(inner)) {
    return {
      kind: 'network',
      message: 'Não foi possível falar com o servidor.',
      hint: 'Verifique a internet e tente de novo.'
    };
  }

  if (!inner || GENERIC_INVOKE_ERROR.test(inner)) {
    return {
      kind: 'unknown',
      message: 'O servidor não conseguiu concluir o envio.',
      hint: 'Tente de novo. Se repetir, avise o suporte.'
    };
  }

  return {
    kind: 'unknown',
    message: inner,
    hint: 'Tente de novo. Se repetir, avise o suporte.'
  };
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
 * do corpo de um 2xx) num `WhatsAppSendError` com causa + próximo passo.
 */
export const toWhatsAppSendError = async (
  error: unknown,
  phone?: string
): Promise<WhatsAppSendError> => {
  if (error instanceof WhatsAppSendError) return error;
  if (typeof error === 'string') {
    return new WhatsAppSendError(diagnoseWhatsAppSendError(error, phone));
  }

  const rawMessage = (error as { message?: unknown } | null)?.message;
  const message = typeof rawMessage === 'string' ? rawMessage : '';
  const bodyMessage = await readResponseBody((error as { context?: unknown } | null)?.context);
  return new WhatsAppSendError(diagnoseWhatsAppSendError(bodyMessage || message, phone));
};

/**
 * Normaliza qualquer coisa lançada por um fluxo de envio (inclusive erros que
 * não vieram da edge function, como falha ao gerar o PDF) para o mesmo formato.
 */
export const asWhatsAppSendError = (error: unknown, phone?: string): WhatsAppSendError => {
  if (error instanceof WhatsAppSendError) return error;
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return new WhatsAppSendError(diagnoseWhatsAppSendError(message, phone));
};

/** Texto único para toasts: causa + próximo passo. */
export const whatsAppSendErrorToastText = (error: WhatsAppSendError): string =>
  `${error.message} ${error.hint}`;
