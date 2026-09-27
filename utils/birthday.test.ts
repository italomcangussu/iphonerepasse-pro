import { describe, expect, it } from 'vitest';
import {
  dayMonthToStoredDate,
  formatBirthdayLabel,
  formatDayMonth,
  isLegacyBirthDateColumnError,
  isValidDayMonth,
  storedDateToDayMonth,
  toLegacyBirthDateColumn,
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
  it('converte o MM-DD do banco para DD/MM', () => {
    expect(storedDateToDayMonth('12-07')).toBe('07/12');
    expect(storedDateToDayMonth('02-29')).toBe('29/02');
    expect(storedDateToDayMonth('04-31')).toBe('');
  });

  it('lê registros legados com ano, ignorando o ano', () => {
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
  it('grava só mês e dia, sem inventar ano', () => {
    expect(dayMonthToStoredDate('07/12')).toBe('12-07');
    expect(dayMonthToStoredDate('29/02')).toBe('02-29');
  });

  it('retorna vazio para entradas incompletas ou inválidas', () => {
    expect(dayMonthToStoredDate('')).toBe('');
    expect(dayMonthToStoredDate('07/1')).toBe('');
    expect(dayMonthToStoredDate('31/04')).toBe('');
  });
});

describe('formatBirthdayLabel', () => {
  it('nunca expõe ano', () => {
    expect(formatBirthdayLabel('12-07')).toBe('07/12');
    expect(formatBirthdayLabel('1904-12-07')).toBe('07/12');
    expect(formatBirthdayLabel(null)).toBe('');
  });
});

describe('compatibilidade com a coluna legada date', () => {
  it('reconhece o erro do Postgres ao gravar MM-DD numa coluna date', () => {
    expect(isLegacyBirthDateColumnError({ message: 'invalid input syntax for type date: "11-01"' })).toBe(true);
    expect(isLegacyBirthDateColumnError({ message: 'duplicate key' })).toBe(false);
    expect(isLegacyBirthDateColumnError(null)).toBe(false);
  });

  it('converte MM-DD para um ano neutro bissexto', () => {
    expect(toLegacyBirthDateColumn('11-01')).toBe('2000-11-01');
    expect(toLegacyBirthDateColumn('02-29')).toBe('2000-02-29');
    expect(toLegacyBirthDateColumn(null)).toBeNull();
    expect(storedDateToDayMonth(toLegacyBirthDateColumn('11-01'))).toBe('01/11');
  });
});
