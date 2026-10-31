import { describe, expect, it } from 'vitest';
import {
  formatCpfOrCnpj,
  formatDateTimeBRL,
  formatMomentDateBRL,
  formatTimeBRL,
  formatDecimalBRL,
  formatPercentBRL,
  getCpfOrCnpjLabel,
  maskDecimalInput,
  parseDecimalBRL,
} from './inputMasks';

describe('inputMasks', () => {
  it('keeps CPF formatting for 11-digit documents', () => {
    expect(formatCpfOrCnpj('12345678901')).toBe('123.456.789-01');
  });

  it('switches to CNPJ formatting for 14-digit documents', () => {
    expect(formatCpfOrCnpj('12345678000195')).toBe('12.345.678/0001-95');
  });

  it('identifies the document label from its digit count', () => {
    expect(getCpfOrCnpjLabel('123.456.789-01')).toBe('CPF');
    expect(getCpfOrCnpjLabel('12.345.678/0001-95')).toBe('CNPJ');
    expect(getCpfOrCnpjLabel('')).toBe('CPF/CNPJ');
  });

  describe('maskDecimalInput', () => {
    it('allows typing integers and decimals with comma smoothly', () => {
      expect(maskDecimalInput('1')).toBe('1');
      expect(maskDecimalInput('1,')).toBe('1,');
      expect(maskDecimalInput('1,8')).toBe('1,8');
      expect(maskDecimalInput('1,87')).toBe('1,87');
    });

    it('converts dots to commas automatically', () => {
      expect(maskDecimalInput('1.')).toBe('1,');
      expect(maskDecimalInput('1.87')).toBe('1,87');
    });

    it('handles empty input and leading commas', () => {
      expect(maskDecimalInput('')).toBe('');
      expect(maskDecimalInput(',')).toBe('0,');
      expect(maskDecimalInput('.')).toBe('0,');
      expect(maskDecimalInput(',5')).toBe('0,5');
    });

    it('limits decimal places to maxDecimals (default 2)', () => {
      expect(maskDecimalInput('1,875')).toBe('1,87');
      expect(maskDecimalInput('1,875', { maxDecimals: 1 })).toBe('1,8');
    });

    it('caps value at max limit if provided', () => {
      expect(maskDecimalInput('99,99', { max: 99.99 })).toBe('99,99');
      expect(maskDecimalInput('100', { max: 99.99 })).toBe('99,99');
    });

    it('ignores duplicate commas and non-digit characters', () => {
      expect(maskDecimalInput('1,8,7')).toBe('1,87');
      expect(maskDecimalInput('abc1,8%')).toBe('1,8');
    });
  });

  describe('parseDecimalBRL', () => {
    it('parses brazilian decimal strings into valid numbers', () => {
      expect(parseDecimalBRL('1,87')).toBe(1.87);
      expect(parseDecimalBRL('1,')).toBe(1);
      expect(parseDecimalBRL('0,5')).toBe(0.5);
      expect(parseDecimalBRL('1.500,25')).toBe(1500.25);
      expect(parseDecimalBRL('1500.25')).toBe(1500.25);
      expect(parseDecimalBRL('')).toBe(0);
      expect(parseDecimalBRL(null)).toBe(0);
      expect(parseDecimalBRL(2.5)).toBe(2.5);
    });
  });

  describe('formatDecimalBRL & formatPercentBRL', () => {
    it('formats decimal numbers with pt-BR comma', () => {
      expect(formatDecimalBRL(1.87)).toBe('1,87');
      expect(formatDecimalBRL(0)).toBe('0,00');
      expect(formatDecimalBRL('1.500,5')).toBe('1500,50');
      expect(formatDecimalBRL('1.500,5', 2, true)).toBe('1.500,50');
    });

    it('formats percentage with % suffix', () => {
      expect(formatPercentBRL(1.87)).toBe('1,87%');
      expect(formatPercentBRL('2,5')).toBe('2,50%');
    });
  });
});

describe('formatDateTimeBRL', () => {
  it('mostra data e hora em Fortaleza, sem segundos', () => {
    expect(formatDateTimeBRL('2026-10-31T17:32:45.000Z')).toBe('31/10/2026 às 14:32');
  });

  it('valor só com a data não inventa horário', () => {
    expect(formatDateTimeBRL('2026-10-31')).toBe('31/10/2026');
    expect(formatTimeBRL('2026-10-31')).toBe('');
  });

  it('vazio ou inválido vira traço', () => {
    expect(formatDateTimeBRL(null)).toBe('-');
    expect(formatDateTimeBRL('xyz')).toBe('-');
    expect(formatMomentDateBRL(undefined)).toBe('-');
  });

  it('separa data e hora para listas', () => {
    expect(formatMomentDateBRL('2026-11-01T02:10:00.000Z')).toBe('31/10/2026');
    expect(formatTimeBRL('2026-11-01T02:10:00.000Z')).toBe('23:10');
  });
});
