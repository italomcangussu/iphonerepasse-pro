/**
 * Utilitários para tratamento e exibição de observações de aparelhos.
 * Permite dividir observações formatadas por linhas, bullets, ponto-e-vírgula ou vírgula
 * para que sejam sempre exibidas uma abaixo da outra de forma legível.
 */

export function splitObservations(raw?: string | null): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // 1. Quebras de linha explícitas (\n ou \r\n)
  if (trimmed.includes('\n') || trimmed.includes('\r')) {
    return trimmed
      .split(/\r?\n/)
      .map((line) => line.replace(/^[\s•\-\*]+/, '').trim())
      .filter(Boolean);
  }

  // 2. Separadores por bullet (•)
  if (trimmed.includes('•')) {
    return trimmed
      .split('•')
      .map((item) => item.replace(/^[\s\-\*]+/, '').trim())
      .filter(Boolean);
  }

  // 3. Separadores por ponto-e-vírgula (;)
  if (trimmed.includes(';')) {
    return trimmed
      .split(';')
      .map((item) => item.replace(/^[\s•\-\*]+/, '').trim())
      .filter(Boolean);
  }

  // 4. Separadores por vírgula (,)
  if (trimmed.includes(',')) {
    return trimmed
      .split(',')
      .map((item) => item.replace(/^[\s•\-\*]+/, '').trim())
      .filter(Boolean);
  }

  return [trimmed.replace(/^[\s•\-\*]+/, '').trim()].filter(Boolean);
}

/**
 * Retorna as observações formatadas com bullet points uma por linha.
 */
export function formatObservationsAsLines(raw?: string | null): string[] {
  return splitObservations(raw);
}
