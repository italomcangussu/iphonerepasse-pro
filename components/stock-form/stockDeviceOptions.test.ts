import { describe, expect, it } from 'vitest';
import { DeviceType, type DeviceCatalogItem } from '../../types';
import {
  getAllKnownDeviceModels,
  getChipOptions,
  getDeviceColors,
  getDeviceModels,
  getImeiLookupState,
  getPredefinedModelColors,
  resolveSelectedChipType,
  supportsDeviceCapacity,
  supportsDeviceChipSelection,
} from './stockDeviceOptions';

const catalog: DeviceCatalogItem[] = [
  { id: 'custom-iphone', type: DeviceType.IPHONE, model: 'iPhone Loja', color: 'Azul Loja' },
  { id: 'custom-iphone-duplicate', type: DeviceType.IPHONE, model: 'iPhone 16', color: 'Cor Loja' },
  { id: 'custom-ipad', type: DeviceType.IPAD, model: 'iPad Loja', color: 'Prata Loja' },
  { id: 'custom-color-empty', type: DeviceType.IPHONE, model: 'iPhone Loja' },
];

describe('stockDeviceOptions', () => {
  it('combines predefined and catalog models without duplicates for the selected type', () => {
    const models = getDeviceModels(DeviceType.IPHONE, catalog);

    expect(models[0]).toBe('iPhone 17 Pro Max');
    expect(models).toContain('iPhone Loja');
    expect(models.filter((model) => model === 'iPhone 16')).toHaveLength(1);
    expect(models).not.toContain('iPad Loja');
  });

  it('defaults model options to iPhone when type is missing', () => {
    expect(getDeviceModels(undefined, catalog)).toContain('iPhone Loja');
  });

  it('combines predefined and custom colors for the selected model', () => {
    const colors = getDeviceColors(DeviceType.IPHONE, 'iPhone 16', catalog);

    expect(colors).toEqual(expect.arrayContaining(['Ultramarino', 'Cor Loja']));
    expect(colors).not.toContain('Azul Loja');
    expect(colors).not.toContain('Prata Loja');
  });

  it('returns no colors while model is empty', () => {
    expect(getDeviceColors(DeviceType.IPHONE, '', catalog)).toEqual([]);
    expect(getDeviceColors(DeviceType.IPHONE, undefined, catalog)).toEqual([]);
  });

  it('lists every known model for IMEI matching without duplicates', () => {
    const models = getAllKnownDeviceModels(catalog);

    expect(models).toContain('iPhone 17 Pro Max');
    expect(models).toContain('iPad Loja');
    expect(models.filter((model) => model === 'iPhone 16')).toHaveLength(1);
  });

  it('exposes predefined model colors for IMEI color matching', () => {
    expect(getPredefinedModelColors('iPhone 16')).toContain('Ultramarino');
    expect(getPredefinedModelColors('Modelo Desconhecido')).toEqual([]);
  });

  it('keeps capacity unavailable only for watches and accessories', () => {
    expect(supportsDeviceCapacity(DeviceType.IPHONE)).toBe(true);
    expect(supportsDeviceCapacity(DeviceType.MACBOOK)).toBe(true);
    expect(supportsDeviceCapacity(undefined)).toBe(true);
    expect(supportsDeviceCapacity(DeviceType.WATCH)).toBe(false);
    expect(supportsDeviceCapacity(DeviceType.ACCESSORY)).toBe(false);
  });

  it('provides chip options by device type', () => {
    expect(getChipOptions(DeviceType.IPHONE)).toEqual(['Physical', 'Virtual', 'Both']);
    expect(getChipOptions(DeviceType.IPAD)).toEqual(['Physical', 'Virtual', 'Both', 'None']);
    expect(getChipOptions(DeviceType.WATCH)).toEqual(['None', 'Virtual']);
    expect(getChipOptions(DeviceType.MACBOOK)).toEqual([]);
  });

  it('resolves selected chip type to a valid option or first default', () => {
    expect(resolveSelectedChipType(DeviceType.IPHONE, 'Virtual')).toBe('Virtual');
    expect(resolveSelectedChipType(DeviceType.IPHONE, 'None')).toBe('Physical');
    expect(resolveSelectedChipType(DeviceType.MACBOOK, 'Virtual')).toBeUndefined();
    expect(supportsDeviceChipSelection(DeviceType.WATCH)).toBe(true);
    expect(supportsDeviceChipSelection(DeviceType.ACCESSORY)).toBe(false);
  });

  it('normalizes IMEI lookup state from the current identifier', () => {
    expect(getImeiLookupState(DeviceType.IPHONE, ' 12345678 ')).toEqual({
      rawIdentifier: '12345678',
      digits: '12345678',
      isOnlyDigits: true,
      supportsLookup: true,
      canLookupByImei: true,
    });

    expect(getImeiLookupState(DeviceType.IPAD, '87654321')).toMatchObject({
      supportsLookup: true,
      canLookupByImei: true,
    });

    expect(getImeiLookupState(DeviceType.IPHONE, undefined)).toMatchObject({
      rawIdentifier: '',
      digits: '',
      isOnlyDigits: false,
      canLookupByImei: false,
    });

    expect(getImeiLookupState(DeviceType.IPHONE, '1234567')).toMatchObject({
      isOnlyDigits: true,
      canLookupByImei: false,
    });

    expect(getImeiLookupState(DeviceType.IPHONE, '1234-5678')).toMatchObject({
      rawIdentifier: '1234-5678',
      digits: '12345678',
      isOnlyDigits: false,
      canLookupByImei: false,
    });

    expect(getImeiLookupState(DeviceType.WATCH, '12345678')).toMatchObject({
      supportsLookup: false,
      canLookupByImei: false,
    });
  });
});
