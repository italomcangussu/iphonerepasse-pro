/**
 * Com status não-2xx o supabase-js devolve só "Edge Function returned a non-2xx
 * status code" e guarda a resposta em `error.context`. Aqui lemos o `{ error }`
 * do corpo e traduzimos falhas conhecidas do WhatsApp para uma mensagem útil.
 */
const WHATSAPP_DISCONNECTED = /whatsapp disconnected|not reconnectable|not connected|disconnected/i;
const NOT_ON_WHATSAPP = /is not on whatsapp/i;

export const friendlyWhatsAppError = (message: string): string => {
  if (WHATSAPP_DISCONNECTED.test(message)) {
    return 'WhatsApp da loja desconectado. Reconecte o canal no CRM (Canais) e tente reenviar.';
  }
  if (NOT_ON_WHATSAPP.test(message)) {
    return 'Este número não tem WhatsApp. Confira o telefone do cliente.';
  }
  return message;
};

export async function toEdgeFunctionError(error: unknown): Promise<Error> {
  const rawMessage = (error as { message?: unknown } | null)?.message;
  let message = typeof rawMessage === 'string' ? rawMessage : String(error ?? '');
  const context = (error as { context?: unknown } | null)?.context;
  if (context && typeof (context as Response).clone === 'function') {
    try {
      const body = await (context as Response).clone().json();
      if (body && typeof body.error === 'string' && body.error.trim()) message = body.error;
    } catch {
      // corpo não é JSON: mantém a mensagem original
    }
  }
  return new Error(friendlyWhatsAppError(message));
}
