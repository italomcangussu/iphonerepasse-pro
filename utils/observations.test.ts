import { describe, expect, it } from 'vitest';
import { splitObservations } from './observations';

describe('splitObservations', () => {
  it('returns an empty array when input is null, undefined, or empty string', () => {
    expect(splitObservations(null)).toEqual([]);
    expect(splitObservations(undefined)).toEqual([]);
    expect(splitObservations('')).toEqual([]);
    expect(splitObservations('   ')).toEqual([]);
  });

  it('splits multiline observations separated by newlines', () => {
    const raw = 'Trocar tela\nTrocar bateria\nTampa traseira trincada';
    expect(splitObservations(raw)).toEqual([
      'Trocar tela',
      'Trocar bateria',
      'Tampa traseira trincada'
    ]);
  });

  it('strips leading bullets and dashes from multiline observations', () => {
    const raw = '- Trocar tela\n• Trocar bateria\n* Tampa traseira';
    expect(splitObservations(raw)).toEqual([
      'Trocar tela',
      'Trocar bateria',
      'Tampa traseira'
    ]);
  });

  it('splits observations separated by bullets on a single line', () => {
    const raw = 'Trocar tela • Bateria 100% • Sem marcas de uso';
    expect(splitObservations(raw)).toEqual([
      'Trocar tela',
      'Bateria 100%',
      'Sem marcas de uso'
    ]);
  });

  it('splits observations separated by semicolons', () => {
    const raw = 'Trocar tela; Bateria 100%; Sem marcas';
    expect(splitObservations(raw)).toEqual([
      'Trocar tela',
      'Bateria 100%',
      'Sem marcas'
    ]);
  });

  it('splits observations separated by commas', () => {
    const raw = 'Trocar tela, Trocar bateria, 100% saude';
    expect(splitObservations(raw)).toEqual([
      'Trocar tela',
      'Trocar bateria',
      '100% saude'
    ]);
  });

  it('does not split decimal numbers written with a comma (pt-BR)', () => {
    // Regressão a7a7366: o split cru por vírgula transformava "89,5%" em
    // "89" + "5%", alterando o sentido do número — e esse texto vai para o
    // cliente pelo compartilhamento do WhatsApp.
    expect(splitObservations('Bateria 89,5% de saude')).toEqual([
      'Bateria 89,5% de saude'
    ]);
  });

  it('does not split currency values written in pt-BR', () => {
    expect(splitObservations('Trocar tela, orcamento R$ 1.200,00')).toEqual([
      'Trocar tela',
      'orcamento R$ 1.200,00'
    ]);
  });

  it('requires whitespace after the comma to treat it as a separator', () => {
    expect(splitObservations('iPhone 13,128GB')).toEqual(['iPhone 13,128GB']);
  });

  it('returns single item for single observation without separators', () => {
    const raw = 'Aparelho impecavel sem detalhes';
    expect(splitObservations(raw)).toEqual(['Aparelho impecavel sem detalhes']);
  });
});
