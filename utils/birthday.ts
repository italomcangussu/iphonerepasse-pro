const onlyDigits = (value: string) => value.replace(/\D/g, '');

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * O cadastro coleta apenas dia e mês, mas `customers.birth_date` continua sendo
 * uma coluna `date` no Postgres. Para não quebrar o schema, o ano é preenchido
 * com um ano bissexto neutro (aceita 29/02) sempre que não houver um ano prévio.
 */
export const BIRTHDAY_FALLBACK_YEAR = 1904;

const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

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

/** `YYYY-MM-DD` (ou já `DD/MM`) → `DD/MM`. Retorna '' quando não dá para ler. */
export const storedDateToDayMonth = (stored: string | null | undefined): string => {
  if (!stored) return '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(stored);
  if (iso) {
    const dayMonth = `${iso[3]}/${iso[2]}`;
    return isValidDayMonth(dayMonth) ? dayMonth : '';
  }
  const masked = formatDayMonth(stored);
  return isValidDayMonth(masked) ? masked : '';
};

/**
 * `DD/MM` → `YYYY-MM-DD` para gravar na coluna `date`.
 * Preserva o ano já salvo no registro (cadastros antigos com data completa)
 * e só cai no ano neutro quando não há ano prévio válido.
 */
export const dayMonthToStoredDate = (
  dayMonth: string,
  previousStored?: string | null
): string => {
  if (!isValidDayMonth(dayMonth)) return '';
  const digits = onlyDigits(dayMonth);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);

  const previousYear = Number(/^(\d{4})-\d{2}-\d{2}/.exec(previousStored || '')?.[1]);
  const keepsPreviousYear =
    Number.isFinite(previousYear) &&
    !(day === '29' && month === '02' && !isLeapYear(previousYear));

  const year = keepsPreviousYear ? previousYear : BIRTHDAY_FALLBACK_YEAR;
  return `${year}-${month}-${day}`;
};

/** Rótulo de exibição: sempre `DD/MM`, nunca o ano-sentinela. */
export const formatBirthdayLabel = (stored: string | null | undefined): string =>
  storedDateToDayMonth(stored);
