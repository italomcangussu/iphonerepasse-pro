const onlyDigits = (value: string) => value.replace(/\D/g, '');

export const parseCurrencyBRL = (value: string): number => {
  const digits = onlyDigits(value);
  if (!digits) return 0;
  return Number(digits) / 100;
};

export const formatCurrencyBRL = (value: number | string | null | undefined): string => {
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? parseCurrencyBRL(value)
        : 0;

  return `R$ ${numericValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const formatCpf = (value: string): string => {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

export const formatPhone = (value: string): string => {
  const digits = onlyDigits(value).slice(0, 11);

  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export const formatCnpj = (value: string): string => {
  const digits = onlyDigits(value).slice(0, 14);

  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
};

export const formatCpfOrCnpj = (value: string): string => {
  const digits = onlyDigits(value);
  return digits.length > 11 ? formatCnpj(value) : formatCpf(value);
};

export const getCpfOrCnpjLabel = (value: string | null | undefined): 'CPF' | 'CNPJ' | 'CPF/CNPJ' => {
  const digits = onlyDigits(value || '');
  if (digits.length === 14) return 'CNPJ';
  if (digits.length === 11) return 'CPF';
  return 'CPF/CNPJ';
};

const TZ = 'America/Fortaleza';

/** Formats a date string (YYYY-MM-DD) to pt-BR locale (DD/MM/YYYY) in Fortaleza timezone. */
export const formatDateBRL = (value?: string | null): string => {
  if (!value) return '-';
  const d = new Date(`${value}T12:00:00-03:00`);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR', { timeZone: TZ });
};

/** Formats an ISO datetime string to pt-BR locale date+time in Fortaleza timezone. */
export const formatDateTimeBRL = (value: string | null | undefined): string => {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('pt-BR', { timeZone: TZ });
};

export const maskCurrencyInput = (value: string, previousValue: string = ''): string => {
  const digits = onlyDigits(value);

  if (!digits) return '';

  // Auto-clear leading zero: if previous value was '0' and new digit is typed, remove the zero
  if (previousValue === '0' && digits.length === 2 && digits[0] === '0') {
    return digits.slice(1);
  }

  // Remove leading zeros but keep at least one digit for display
  const withoutLeadingZeros = digits.replace(/^0+/, '') || '0';

  return withoutLeadingZeros;
};

export interface MaskDecimalOptions {
  maxDecimals?: number;
  max?: number;
}

/**
 * Converte e formata digitação decimal com vírgula em tempo real.
 * Não converte para número prematuramente (evita zerar ao digitar vírgula ou apagar vírgula).
 * Converte pontos digitados em vírgula e respeita o limite de casas decimais.
 */
export const maskDecimalInput = (
  value: string,
  optionsOrMaxDecimals: number | MaskDecimalOptions = {},
  maxParam?: number
): string => {
  const options: MaskDecimalOptions =
    typeof optionsOrMaxDecimals === 'number'
      ? { maxDecimals: optionsOrMaxDecimals, max: maxParam }
      : optionsOrMaxDecimals;
  const { maxDecimals = 2, max } = options;

  if (!value) return '';

  // Converte pontos em vírgulas e elimina caracteres inválidos
  let cleaned = value.replace(/\./g, ',').replace(/[^\d,]/g, '');

  if (!cleaned) return '';

  // Se começou direto com vírgula, prefixa com 0 (ex: "," vira "0,")
  if (cleaned.startsWith(',')) {
    cleaned = `0${cleaned}`;
  }

  // Permite apenas uma vírgula
  const parts = cleaned.split(',');
  let integerPart = parts[0] || '0';
  const decimalPart = parts.length > 1 ? parts.slice(1).join('') : null;

  // Remove zeros à esquerda no inteiro se houver mais dígitos (ex: "05" -> "5")
  if (integerPart.length > 1 && integerPart.startsWith('0')) {
    integerPart = integerPart.replace(/^0+/, '') || '0';
  }

  let result = integerPart;
  if (decimalPart !== null) {
    result += `,${decimalPart.slice(0, maxDecimals)}`;
  }

  if (max !== undefined && max !== null) {
    const numeric = parseDecimalBRL(result);
    if (numeric > max) {
      return formatDecimalBRL(max, maxDecimals);
    }
  }

  return result;
};

/**
 * Converte string pt-BR ("1,87", "1.500,50", "150") em número com segurança.
 * Retorna 0 para entradas vazias ou corrompidas.
 */
export const parseDecimalBRL = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const trimmed = String(value).trim();
  if (!trimmed) return 0;

  let normalized = trimmed;
  if (normalized.includes(',')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else {
    const dotCount = (normalized.match(/\./g) || []).length;
    if (dotCount > 1) {
      normalized = normalized.replace(/\./g, '');
    }
  }

  normalized = normalized.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Formata um número ou string decimal para o padrão pt-BR ("1,87", "1.500,00").
 */
export const formatDecimalBRL = (
  value: number | string | null | undefined,
  decimals: number = 2,
  useGrouping: boolean = false
): string => {
  const numeric = typeof value === 'number' ? value : parseDecimalBRL(value);
  if (!Number.isFinite(numeric)) return `0,${'0'.repeat(decimals)}`;

  return numeric.toLocaleString('pt-BR', {
    useGrouping,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Formata uma taxa/porcentagem no padrão pt-BR ("1,87%").
 */
export const formatPercentBRL = (
  value: number | string | null | undefined,
  decimals: number = 2
): string => {
  return `${formatDecimalBRL(value, decimals)}%`;
};
