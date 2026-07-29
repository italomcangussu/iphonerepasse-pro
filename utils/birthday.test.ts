import { describe, expect, it } from 'vitest';
import {
  BIRTHDAY_FALLBACK_YEAR,
  dayMonthToStoredDate,
  formatBirthdayLabel,
  formatDayMonth,
  isValidDayMonth,
  storedDateToDayMonth,
} from './birthday';

describe('formatDayMonth', () => {
  it('aplica a máscara progressiva DD/MM', () => {
    expect(formatDayMonth('')).toBe('');
    expect(formatDayMonth('0')).toBe('0');
    expect(formatDayMonth('07')).toBe('07');
    expect(formatDayMonth('071')).toBe('07/1');
    expect(formatDayMonth('0712')).toBe('07/12');
  });

  it('ignora caracteres não numéricos e limita a 4 dígitos', () => {
    expect(formatDayMonth('07/12/1990')).toBe('07/12');
    expect(formatDayMonth('a0b7c1d2')).toBe('07/12');
  });
});

describe('isValidDayMonth', () => {
  it('aceita dias válidos, incluindo 29/02', () => {
    expect(isValidDayMonth('01/01')).toBe(true);
    expect(isValidDayMonth('29/02')).toBe(true);
    expect(isValidDayMonth('31/12')).toBe(true);
  });

  it('rejeita incompletos e dias inexistentes', () => {
    expect(isValidDayMonth('')).toBe(false);
    expect(isValidDayMonth('07/1')).toBe(false);
    expect(isValidDayMonth('00/05')).toBe(false);
    expect(isValidDayMonth('31/04')).toBe(false);
    expect(isValidDayMonth('30/02')).toBe(false);
    expect(isValidDayMonth('10/13')).toBe(false);
  });
});

describe('storedDateToDayMonth', () => {
  it('converte a data do banco para DD/MM', () => {
    expect(storedDateToDayMonth('1990-12-07')).toBe('07/12');
    expect(storedDateToDayMonth('1904-02-29')).toBe('29/02');
    expect(storedDateToDayMonth('1990-12-07T00:00:00')).toBe('07/12');
  });

  it('tolera valores vazios ou inválidos', () => {
    expect(storedDateToDayMonth('')).toBe('');
    expect(storedDateToDayMonth(null)).toBe('');
    expect(storedDateToDayMonth(undefined)).toBe('');
    expect(storedDateToDayMonth('1990-13-40')).toBe('');
  });

  it('aceita um valor já no formato DD/MM', () => {
    expect(storedDateToDayMonth('07/12')).toBe('07/12');
  });
});

describe('dayMonthToStoredDate', () => {
  it('usa o ano neutro bissexto quando não há data anterior', () => {
    expect(dayMonthToStoredDate('07/12')).toBe(`${BIRTHDAY_FALLBACK_YEAR}-12-07`);
    expect(dayMonthToStoredDate('29/02')).toBe(`${BIRTHDAY_FALLBACK_YEAR}-02-29`);
  });

  it('preserva o ano já cadastrado no registro', () => {
    expect(dayMonthToStoredDate('07/12', '1990-05-03')).toBe('1990-12-07');
  });

  it('cai no ano bissexto neutro quando 29/02 não existe no ano anterior', () => {
    expect(dayMonthToStoredDate('29/02', '1990-05-03')).toBe(`${BIRTHDAY_FALLBACK_YEAR}-02-29`);
    expect(dayMonthToStoredDate('29/02', '1992-05-03')).toBe('1992-02-29');
  });

  it('retorna vazio para entradas incompletas ou inválidas', () => {
    expect(dayMonthToStoredDate('')).toBe('');
    expect(dayMonthToStoredDate('07/1')).toBe('');
    expect(dayMonthToStoredDate('31/04', '1990-05-03')).toBe('');
  });
});

describe('formatBirthdayLabel', () => {
  it('nunca expõe o ano-sentinela', () => {
    expect(formatBirthdayLabel(`${BIRTHDAY_FALLBACK_YEAR}-12-07`)).toBe('07/12');
    expect(formatBirthdayLabel(null)).toBe('');
  });
});
