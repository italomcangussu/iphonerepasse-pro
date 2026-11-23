import { describe, expect, it } from 'vitest';
import { filterProductSearchOptions, filterStockItemsByProductSearch, matchesProductSearch } from './productSearch';

type Device = { id: string; model: string; capacity: string; color: string; imei: string };

const devices: Device[] = [
  { id: '13-128-azul', model: 'iPhone 13', capacity: '128 GB', color: 'Azul', imei: '350000000000013' },
  { id: '13-256-preto', model: 'iPhone 13', capacity: '256 GB', color: 'Meia-noite', imei: '350000000000021' },
  { id: '13pro-256-grafite', model: 'iPhone 13 Pro', capacity: '256 GB', color: 'Grafite', imei: '350000000000039' },
  { id: '13pm-256-azul', model: 'iPhone 13 Pro Max', capacity: '256GB', color: 'Azul-Sierra', imei: '350000000000047' },
  { id: '15-1tb-natural', model: 'iPhone 15 Pro Max', capacity: '1 TB', color: 'Titânio Natural', imei: '359876543210000' },
  { id: '12-256-branco', model: 'iPhone 12', capacity: '256 GB', color: 'Branco', imei: '351300000000000' }
];

const search = (query: string) =>
  filterStockItemsByProductSearch(
    devices,
    query,
    (device) => device.model,
    (device) => `${device.capacity} ${device.color} ${device.imei}`,
    () => 0
  ).map((device) => device.id);

describe('busca inteligente de aparelhos', () => {
  it('entende geração + armazenamento em qualquer ordem', () => {
    expect(search('13 256')).toEqual(['13-256-preto', '13pro-256-grafite', '13pm-256-azul']);
    expect(search('256 13')).toEqual(['13-256-preto', '13pro-256-grafite', '13pm-256-azul']);
    expect(search('iphone 13 256gb')).toEqual(['13-256-preto', '13pro-256-grafite', '13pm-256-azul']);
  });

  it('aceita "13gb" como iPhone 13 e capacidade com unidade colada ou separada', () => {
    expect(search('13gb 256')).toEqual(['13-256-preto', '13pro-256-grafite', '13pm-256-azul']);
    expect(search('15 1tb')).toEqual(['15-1tb-natural']);
    expect(search('15 1 tb')).toEqual(['15-1tb-natural']);
  });

  it('combina modelo, cor e armazenamento', () => {
    expect(search('13 azul')).toEqual(['13-128-azul', '13pm-256-azul']);
    expect(search('13 256 azul')).toEqual(['13pm-256-azul']);
    expect(search('azul 13 pro max')).toEqual(['13pm-256-azul']);
    expect(search('sierra')).toEqual(['13pm-256-azul']);
  });

  it('acha a cor em inglês ou português', () => {
    expect(search('13 midnight')).toEqual(['13-256-preto']);
    expect(search('15 titanio')).toEqual(['15-1tb-natural']);
  });

  it('variante digitada restringe e ordena pela mais próxima', () => {
    expect(search('13')).toEqual(['13-128-azul', '13-256-preto', '13pro-256-grafite', '13pm-256-azul']);
    expect(search('13 pro')).toEqual(['13pro-256-grafite', '13pm-256-azul']);
    expect(search('13pro')).toEqual(['13pro-256-grafite', '13pm-256-azul']);
    expect(search('13 pm')).toEqual(['13pm-256-azul']);
  });

  it('geração não casa com trecho de IMEI, mas IMEI parcial continua funcionando', () => {
    expect(search('13')).not.toContain('12-256-branco');
    expect(search('9876')).toEqual(['15-1tb-natural']);
  });

  it('sem resultado nos termos, cai na busca por trecho antiga', () => {
    expect(search('zzz')).toEqual([]);
    expect(search('')).toHaveLength(devices.length);
  });

  it('opções do PDV usam rótulo e sub-rótulo', () => {
    const options = devices.map((device) => ({
      id: device.id,
      label: `${device.model} ${device.capacity}`,
      subLabel: `IMEI/Serial: ${device.imei} • ${device.color} • R$ 3.900`
    }));
    expect(filterProductSearchOptions(options, '13 256 grafite').map((option) => option.id)).toEqual(['13pro-256-grafite']);
    expect(filterProductSearchOptions(options, '1').map((option) => option.id)).toEqual([]);
  });

  it('matchesProductSearch responde se um aparelho atende à busca', () => {
    expect(matchesProductSearch('iPhone 13', '256 GB Azul', '13 256 azul')).toBe(true);
    expect(matchesProductSearch('iPhone 14', '256 GB Azul', '13 256')).toBe(false);
    expect(matchesProductSearch('iPhone 14', '', '')).toBe(true);
  });
});
