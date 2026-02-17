import { describe, expect, it } from 'vitest';
import { formatWarrantyDevice } from './warrantyDevice';

describe('formatWarrantyDevice', () => {
  it('normalizes shorthand model and splits details into badges', () => {
    const parsed = formatWarrantyDevice({
      model: '16PM 256GB NATURAL 92% (256GB)',
      capacity: '256GB',
      color: '',
      imei: '355706421215560'
    });

    expect(parsed.title).toBe('iPhone 16 Pro Max Natural');
    expect(parsed.capacity).toBe('256GB');
    expect(parsed.battery).toBe('92%');
    expect(parsed.imei).toBe('355706421215560');
    expect(parsed.title).not.toContain('256GB');
  });

  it('prioritizes explicit battery health field when available', () => {
    const parsed = formatWarrantyDevice({
      model: 'iPhone 15 Pro Max',
      color: 'Azul',
      capacity: '512 GB',
      batteryHealth: 89,
      imeiMasked: '***********2345'
    });

    expect(parsed.title).toBe('iPhone 15 Pro Max Azul');
    expect(parsed.capacity).toBe('512GB');
    expect(parsed.battery).toBe('89%');
    expect(parsed.imei).toBe('***********2345');
  });
});
