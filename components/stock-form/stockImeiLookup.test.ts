import { describe, expect, it } from 'vitest';
import { DeviceType, type DeviceCatalogItem } from '../../types';
import {
  getImeiLookupFailureMessage,
  resolveImeiLookupResponse,
} from './stockImeiLookup';

const catalog: DeviceCatalogItem[] = [
  { id: 'ipad-custom', type: DeviceType.IPAD, model: 'iPad Loja' },
  { id: 'iphone-custom', type: DeviceType.IPHONE, model: 'iPhone Loja' },
];

describe('stockImeiLookup', () => {
  it('identifies a known model with type, capacity and color from the API text', () => {
    expect(resolveImeiLookupResponse({
      model: 'Apple iPhone 16',
      description: 'Ultramarino 128gb',
    }, catalog)).toEqual({
      kind: 'identified',
      apiModel: 'Apple iPhone 16',
      detectedType: DeviceType.IPHONE,
      model: 'iPhone 16',
      capacity: '128 GB',
      color: 'Ultramarino',
    });
  });

  it('detects device family and custom catalog models when they appear in the API text', () => {
    expect(resolveImeiLookupResponse({
      model: 'Apple tablet',
      description: 'iPad Loja 1tb',
    }, catalog)).toMatchObject({
      kind: 'identified',
      detectedType: DeviceType.IPAD,
      model: 'iPad Loja',
      capacity: '1 TB',
      color: null,
    });
  });

  it('returns unmatched when API text has no exact model in the known list', () => {
    expect(resolveImeiLookupResponse({
      model: 'Apple Mystery Device',
      description: 'watch edition',
    }, catalog)).toEqual({
      kind: 'unmatched',
      apiModel: 'Apple Mystery Device',
      detectedType: DeviceType.WATCH,
    });

    expect(resolveImeiLookupResponse({
      model: 'Apple Mystery Device',
      description: 'macbook edition',
    }, catalog)).toMatchObject({
      kind: 'unmatched',
      detectedType: DeviceType.MACBOOK,
    });
  });

  it('does not extract capacity when text between number and unit is not whitespace', () => {
    expect(resolveImeiLookupResponse({
      model: 'Apple iPhone 16',
      description: '128xyzgb Ultramarino',
    }, catalog)).toMatchObject({
      kind: 'identified',
      capacity: null,
    });
  });

  it('returns API error messages without parsing the payload as a device', () => {
    expect(resolveImeiLookupResponse({ error: 'IMEI inválido' }, catalog)).toEqual({
      kind: 'api-error',
      message: 'IMEI inválido',
    });

    expect(resolveImeiLookupResponse(null, catalog)).toEqual({
      kind: 'api-error',
      message: 'IMEI não encontrado.',
    });
  });

  it('maps lookup failures to the same user-facing messages', () => {
    expect(getImeiLookupFailureMessage({ response: { status: 401 } })).toBe(
      'Erro de autenticação: Verifique sua chave da RapidAPI.'
    );
    expect(getImeiLookupFailureMessage({ response: { status: 403 } })).toBe(
      'Erro de autenticação: Verifique sua chave da RapidAPI.'
    );
    expect(getImeiLookupFailureMessage({ response: { status: 429 } })).toBe(
      'Limite de requisições excedido na RapidAPI.'
    );
    expect(getImeiLookupFailureMessage({
      response: { status: 500, data: { message: 'fora do ar' } },
      message: 'network',
    })).toBe('Falha na consulta: fora do ar');
    expect(getImeiLookupFailureMessage({ message: 'network' })).toBe(
      'Falha na consulta: network'
    );
  });
});
