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
