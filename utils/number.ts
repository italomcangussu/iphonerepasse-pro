/**
 * Converte valores vindos do banco/mapeamento (que podem chegar como string ou null)
 * em número seguro para aritmética. Qualquer coisa que não seja finita vira 0, para
 * que um registro corrompido não contamine um total inteiro com NaN.
 */
export const toFiniteNumber = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
