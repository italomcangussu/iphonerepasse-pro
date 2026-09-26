const onlyDigits = (value: string) => value.replace(/\D/g, '');

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * O cadastro coleta apenas dia e mês. `customers.birth_date` guarda `MM-DD`
 * (texto, sem ano) — nunca inventamos um ano para caber numa coluna `date`.
 */
const STORED_DAY_MONTH = /^(\d{2})-(\d{2})$/;

/** Máscara progressiva `DD/MM` conforme o usuário digita. */
export const formatDayMonth = (value: string): string => {
  const digits = onlyDigits(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

/** `true` somente quando há 4 dígitos e o dia existe no mês informado. */
export const isValidDayMonth = (value: string): boolean => {
  const digits = onlyDigits(value);
  if (digits.length !== 4) return false;
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= DAYS_IN_MONTH[month - 1];
};

/**
 * Valor do banco → `DD/MM`. Aceita `MM-DD` (formato atual), `YYYY-MM-DD`
 * (registros legados, o ano é ignorado) ou já `DD/MM`. Retorna '' quando não dá para ler.
 */
export const storedDateToDayMonth = (stored: string | null | undefined): string => {
  if (!stored) return '';
  const monthDay = STORED_DAY_MONTH.exec(stored);
  if (monthDay) {
    const dayMonth = `${monthDay[2]}/${monthDay[1]}`;
    return isValidDayMonth(dayMonth) ? dayMonth : '';
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(stored);
  if (iso) {
    const dayMonth = `${iso[3]}/${iso[2]}`;
    return isValidDayMonth(dayMonth) ? dayMonth : '';
  }
  const masked = formatDayMonth(stored);
  return isValidDayMonth(masked) ? masked : '';
};

/** `DD/MM` → `MM-DD` para gravar em `customers.birth_date`. Sem ano. */
export const dayMonthToStoredDate = (dayMonth: string): string => {
  if (!isValidDayMonth(dayMonth)) return '';
  const digits = onlyDigits(dayMonth);
  return `${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
};

/** Rótulo de exibição: sempre `DD/MM`, nunca um ano. */
export const formatBirthdayLabel = (stored: string | null | undefined): string =>
  storedDateToDayMonth(stored);
