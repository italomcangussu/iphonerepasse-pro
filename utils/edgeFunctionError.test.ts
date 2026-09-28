import { describe, expect, it } from 'vitest';
import { friendlyWhatsAppError, toEdgeFunctionError } from './edgeFunctionError';

const httpError = (body: unknown) => {
  const err = new Error('Edge Function returned a non-2xx status code') as Error & { context: Response };
  err.context = new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 502 });
  return err;
};

describe('toEdgeFunctionError', () => {
  it('troca a mensagem genérica pelo motivo do corpo, traduzindo WhatsApp desconectado', async () => {
    const err = await toEdgeFunctionError(httpError({
      error: 'uaz_send_failed:503:provider_error:{"error":true,"message":"WhatsApp disconnected: session is not reconnectable"}'
    }));
    expect(err.message).toBe('WhatsApp da loja desconectado. Reconecte o canal no CRM (Canais) e tente reenviar.');
  });

  it('usa o erro do corpo quando não é um caso conhecido', async () => {
    const err = await toEdgeFunctionError(httpError({ error: 'Nenhum canal WhatsApp ativo configurado para esta loja.' }));
    expect(err.message).toBe('Nenhum canal WhatsApp ativo configurado para esta loja.');
  });

  it('mantém a mensagem original quando o corpo não é JSON ou não há contexto', async () => {
    expect((await toEdgeFunctionError(httpError('<html>'))).message).toBe('Edge Function returned a non-2xx status code');
    expect((await toEdgeFunctionError(new Error('fetch failed'))).message).toBe('fetch failed');
    expect((await toEdgeFunctionError({ message: 'Canal indisponível' })).message).toBe('Canal indisponível');
  });
});

describe('friendlyWhatsAppError', () => {
  it('traduz número sem WhatsApp', () => {
    expect(friendlyWhatsAppError('the number 5585… is not on WhatsApp')).toBe('Este número não tem WhatsApp. Confira o telefone do cliente.');
  });
});
