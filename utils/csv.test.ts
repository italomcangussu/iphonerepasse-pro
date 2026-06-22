import { describe, expect, it } from 'vitest';
import { buildCsv, escapeCsvCell } from './csv';

describe('csv utils', () => {
  it('escapes commas, quotes and line breaks', () => {
    expect(escapeCsvCell('Pagamento, "Hospital"\nLinha 2')).toBe('"Pagamento, ""Hospital""\nLinha 2"');
  });

  it('builds CSV with CRLF row separators', () => {
    expect(buildCsv([
      ['Data', 'Descrição'],
      ['2026-06-22', 'Aporte'],
    ])).toBe('Data,Descrição\r\n2026-06-22,Aporte');
  });
});
