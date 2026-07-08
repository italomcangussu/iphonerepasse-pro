import { describe, expect, it } from 'vitest';
import { formatCpfOrCnpj, getCpfOrCnpjLabel } from './inputMasks';

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
});
