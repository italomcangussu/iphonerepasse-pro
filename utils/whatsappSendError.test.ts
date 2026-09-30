import { describe, expect, it } from 'vitest';
import {
  WhatsAppSendError,
  asWhatsAppSendError,
  diagnoseWhatsAppSendError,
  toWhatsAppSendError,
  whatsAppSendErrorToastText
} from './whatsappSendError';

const httpError = (status: number, body: unknown) =>
  Object.assign(new Error('Edge Function returned a non-2xx status code'), {
    name: 'FunctionsHttpError',
    context: new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
  });

const UAZ_NOT_ON_WHATSAPP =
  'uaz_send_failed:500:provider_error:{"error":"the number 5585998739775@s.whatsapp.net is not on WhatsApp"}';
const UAZ_DISCONNECTED =
  'uaz_send_failed:503:provider_error:{"error":true,"message":"WhatsApp disconnected: session is not reconnectable"}';

describe('diagnoseWhatsAppSendError', () => {
  it('explains a number that is not on WhatsApp, formatted, with the next step', () => {
    expect(diagnoseWhatsAppSendError(UAZ_NOT_ON_WHATSAPP)).toEqual({
      kind: 'invalid-number',
      message: 'O número (85) 99873-9775 não está no WhatsApp.',
      hint: 'Confira se o telefone cadastrado do cliente está correto.'
    });
  });

  it('falls back to the provided phone when the provider omits the JID', () => {
    expect(diagnoseWhatsAppSendError('not on WhatsApp', '5585998739775').message).toContain('(85) 99873-9775');
  });

  it('explains a disconnected store channel and where to reconnect', () => {
    const diagnosis = diagnoseWhatsAppSendError(UAZ_DISCONNECTED);
    expect(diagnosis.kind).toBe('disconnected');
    expect(diagnosis.hint).toContain('CRM › Canais');
  });

  it('classifies a store without an active channel', () => {
    expect(diagnoseWhatsAppSendError('Nenhum canal WhatsApp ativo configurado para esta loja.').kind).toBe(
      'no-channel'
    );
  });

  it('treats our own phone validation messages as a number problem the seller can fix', () => {
    expect(diagnoseWhatsAppSendError('Telefone inválido para envio via WhatsApp.').kind).toBe('invalid-number');
  });

  it('recognises a network failure', () => {
    expect(diagnoseWhatsAppSendError('Failed to send a request to the Edge Function').kind).toBe('network');
  });

  it('never shows the generic invoke message to the user', () => {
    const diagnosis = diagnoseWhatsAppSendError('Edge Function returned a non-2xx status code');
    expect(diagnosis.kind).toBe('unknown');
    expect(diagnosis.message).not.toMatch(/non-2xx/i);
  });

  it('keeps unknown-but-specific messages', () => {
    expect(diagnoseWhatsAppSendError('Falha UAZ').message).toBe('Falha UAZ');
  });
});

describe('toWhatsAppSendError', () => {
  it('reads the real reason from the body of a non-2xx response', async () => {
    const err = await toWhatsAppSendError(httpError(502, { error: UAZ_NOT_ON_WHATSAPP }), '5585998739775');
    expect(err).toBeInstanceOf(WhatsAppSendError);
    expect(err.kind).toBe('invalid-number');
    expect(err.message).toBe('O número (85) 99873-9775 não está no WhatsApp.');
  });

  it('uses the plain-text body when it is not JSON', async () => {
    const err = await toWhatsAppSendError(httpError(500, 'boom'));
    expect(err.message).toBe('boom');
  });

  it('falls back to a friendly message when the body cannot be read', async () => {
    const err = await toWhatsAppSendError(new Error('Edge Function returned a non-2xx status code'));
    expect(err.message).not.toMatch(/non-2xx/i);
    expect(err.hint).toBeTruthy();
  });

  it('accepts the string error of a 2xx body', async () => {
    const err = await toWhatsAppSendError(UAZ_DISCONNECTED);
    expect(err.kind).toBe('disconnected');
  });
});

describe('asWhatsAppSendError / toast text', () => {
  it('wraps plain errors and keeps an existing WhatsAppSendError untouched', () => {
    const original = new WhatsAppSendError({ kind: 'disconnected', message: 'a', hint: 'b' });
    expect(asWhatsAppSendError(original)).toBe(original);
    expect(asWhatsAppSendError(new Error('UAZ instance offline')).message).toBe('UAZ instance offline');
  });

  it('joins cause and next step for single-message surfaces', () => {
    const err = new WhatsAppSendError({ kind: 'unknown', message: 'Causa.', hint: 'Faça isto.' });
    expect(whatsAppSendErrorToastText(err)).toBe('Causa. Faça isto.');
  });
});
