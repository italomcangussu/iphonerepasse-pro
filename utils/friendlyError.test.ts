import { afterEach, describe, expect, it, vi } from 'vitest';
import { toFriendlyErrorMessage } from './friendlyError';

const FALLBACK = 'Não foi possível registrar o pagamento.';

describe('toFriendlyErrorMessage', () => {
  afterEach(() => vi.restoreAllMocks());
  const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {});

  it('keeps business messages raised by the database', () => {
    expect(toFriendlyErrorMessage({ code: 'P0001', message: 'Saldo insuficiente.' }, FALLBACK)).toBe('Saldo insuficiente.');
  });

  it('translates network, session, permission and size failures', () => {
    quiet();
    expect(toFriendlyErrorMessage(new TypeError('Failed to fetch'), FALLBACK)).toMatch(/Sem conexão/);
    expect(toFriendlyErrorMessage({ message: 'JWT expired' }, FALLBACK)).toMatch(/sessão expirou/);
    expect(toFriendlyErrorMessage({ code: '42501', message: 'new row violates row-level security policy' }, FALLBACK)).toMatch(/permissão/);
    expect(toFriendlyErrorMessage({ statusCode: '413', message: 'Payload too large' }, FALLBACK)).toMatch(/grande demais/);
  });

  it('falls back for unknown technical errors and logs the detail', () => {
    const spy = quiet();
    expect(toFriendlyErrorMessage({ message: 'duplicate key value violates unique constraint' }, FALLBACK)).toBe(FALLBACK);
    expect(spy).toHaveBeenCalled();
  });
});
