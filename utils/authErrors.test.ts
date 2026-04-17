import { describe, expect, it } from 'vitest';
import { normalizeAuthError } from './authErrors';

describe('normalizeAuthError', () => {
  it('maps network errors to a DNS-friendly message', () => {
    const host = 'ubuusaiezpyayqgfujbe.supabase.co';
    const mapped = normalizeAuthError(
      new TypeError('Failed to fetch'),
      `https://${host}`
    );

    expect(mapped.message).toContain('Falha de conexão com o servidor de autenticação');
    expect(mapped.message).toContain(host);
  });

  it('preserves non-network error messages', () => {
    const original = new Error('Invalid login credentials');
    const mapped = normalizeAuthError(original, 'https://example.supabase.co');

    expect(mapped).toBe(original);
    expect(mapped.message).toBe('Invalid login credentials');
  });

  it('falls back to generic message for unknown errors', () => {
    const mapped = normalizeAuthError(null, 'https://example.supabase.co');
    expect(mapped.message).toBe('Não foi possível entrar.');
  });
});
