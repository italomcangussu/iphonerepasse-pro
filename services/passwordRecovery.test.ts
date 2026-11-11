import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPasswordRecovery,
  consumeRecoveryLink,
  isPasswordRecoveryPending,
  parseRecoveryHash,
  requestPasswordReset,
} from './passwordRecovery';

const clientWith = (auth: Record<string, unknown>) => ({ auth }) as never;

describe('recuperação de senha', () => {
  beforeEach(() => {
    clearPasswordRecovery();
    window.history.replaceState(null, '', '/');
  });

  it('lê os tokens só de um link de recuperação', () => {
    expect(parseRecoveryHash('#access_token=a&refresh_token=r&type=recovery')).toEqual({ accessToken: 'a', refreshToken: 'r' });
    expect(parseRecoveryHash('#access_token=a&refresh_token=r&type=magiclink')).toBeNull();
    expect(parseRecoveryHash('#/inventory')).toBeNull();
    expect(parseRecoveryHash('#type=recovery')).toBeNull();
  });

  it('abre a sessão, limpa o hash e marca a troca de senha como pendente', async () => {
    window.history.replaceState(null, '', '/#access_token=a&refresh_token=r&type=recovery');
    const setSession = vi.fn().mockResolvedValue({ error: null });

    await consumeRecoveryLink(clientWith({ setSession }));

    expect(setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r' });
    expect(window.location.hash).toBe('');
    expect(isPasswordRecoveryPending()).toBe(true);
  });

  it('não marca pendência quando o link expirou', async () => {
    window.history.replaceState(null, '', '/#access_token=a&refresh_token=r&type=recovery');
    const setSession = vi.fn().mockResolvedValue({ error: new Error('expired') });

    await consumeRecoveryLink(clientWith({ setSession }));

    expect(isPasswordRecoveryPending()).toBe(false);
  });

  it('ignora rotas comuns do app', async () => {
    window.history.replaceState(null, '', '/#/pdv');
    const setSession = vi.fn();

    await consumeRecoveryLink(clientWith({ setSession }));

    expect(setSession).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('#/pdv');
  });

  it('pede o link com retorno para a raiz do app', async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });

    await requestPasswordReset(clientWith({ resetPasswordForEmail }), 'a@b.com');

    expect(resetPasswordForEmail).toHaveBeenCalledWith('a@b.com', { redirectTo: `${window.location.origin}/` });
  });
});
