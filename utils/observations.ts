/**
 * Utilitários para tratamento e exibição de observações de aparelhos.
 * Permite dividir observações formatadas por linhas, bullets, ponto-e-vírgula ou vírgula
 * para que sejam sempre exibidas uma abaixo da outra de forma legível.
 */

const COMMA_SEPARATOR = /(?<!\d),(?!\d)\s+/;

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

  // 4. Separadores por vírgula (,) — exige contexto.
  // Em pt-BR a vírgula também é separador decimal ("89,5%", "R$ 1.200,00"),
  // então só tratamos como separador de lista quando ela NÃO está entre
  // dígitos e vem seguida de espaço. Sem essa guarda, "Bateria 89,5%" virava
  // "Bateria 89" + "5%" — e esse texto vai para o cliente no compartilhamento
  // do WhatsApp (StockDetailsModal).
  // Limitação conhecida: prosa com vírgula ("em ótimo estado, com marcas")
  // ainda é quebrada em duas linhas. É ambíguo por natureza e não destrói
  // informação, ao contrário do caso decimal.
  if (COMMA_SEPARATOR.test(trimmed)) {
    return trimmed
      .split(COMMA_SEPARATOR)
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
