import { describe, expect, it } from 'vitest';
import { describeWhatsAppSendError, toWhatsAppSendError } from './whatsappSendError';

const httpError = (status: number, body: unknown) =>
  Object.assign(new Error('Edge Function returned a non-2xx status code'), {
    name: 'FunctionsHttpError',
    context: new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
  });

const UAZ_NOT_ON_WHATSAPP =
  'uaz_send_failed:500:provider_error:{"error":"the number 5585998739775@s.whatsapp.net is not on WhatsApp"}';
const UAZ_DISCONNECTED =
  'uaz_send_failed:503:provider_error:{"error":true,"message":"WhatsApp disconnected: session is not reconnectable"}';

describe('describeWhatsAppSendError', () => {
  it('explains a number that is not on WhatsApp, formatted for the operator', () => {
    expect(describeWhatsAppSendError(UAZ_NOT_ON_WHATSAPP)).toBe(
      'O número (85) 99873-9775 não está no WhatsApp. Confira o telefone cadastrado do cliente.'
    );
  });

  it('falls back to the provided phone when the provider omits the JID', () => {
    expect(describeWhatsAppSendError('not on WhatsApp', '5585998739775')).toContain('(85) 99873-9775');
  });

  it('explains a disconnected store channel', () => {
    expect(describeWhatsAppSendError(UAZ_DISCONNECTED)).toContain('desconectado');
  });

  it('leaves unknown messages untouched', () => {
    expect(describeWhatsAppSendError('Falha UAZ')).toBe('Falha UAZ');
    expect(describeWhatsAppSendError('Nenhum canal WhatsApp ativo configurado para esta loja.')).toBe(
      'Nenhum canal WhatsApp ativo configurado para esta loja.'
    );
  });
});

describe('toWhatsAppSendError', () => {
  it('reads the real reason from the body of a non-2xx response', async () => {
    const err = await toWhatsAppSendError(httpError(502, { error: UAZ_NOT_ON_WHATSAPP }), '5585998739775');
    expect(err.message).toBe(
      'O número (85) 99873-9775 não está no WhatsApp. Confira o telefone cadastrado do cliente.'
    );
  });

  it('uses the plain-text body when it is not JSON', async () => {
    const err = await toWhatsAppSendError(httpError(500, 'boom'));
    expect(err.message).toBe('boom');
  });

  it('keeps the original error when the body cannot be read', async () => {
    const original = new Error('Edge Function returned a non-2xx status code');
    const err = await toWhatsAppSendError(original);
    expect(err).toBe(original);
  });

  it('accepts the string error of a 2xx body', async () => {
    const err = await toWhatsAppSendError(UAZ_DISCONNECTED);
    expect(err.message).toContain('desconectado');
  });
});
