import { describe, expect, it } from 'vitest';
import {
  ERP_COMPACT_CONTENT_MAX_WIDTH,
  ERP_DESKTOP_MIN_WIDTH,
  ERP_PHONE_MAX_WIDTH,
  ERP_TABLET_MAX_WIDTH,
  ERP_TABLET_MIN_WIDTH,
  classifyErpViewport,
  isCompactOperationalViewport,
} from './erpResponsive';

describe('ERP responsive contract', () => {
  it('names the platform breakpoint boundaries', () => {
    expect(ERP_PHONE_MAX_WIDTH).toBe(767);
    expect(ERP_TABLET_MIN_WIDTH).toBe(768);
    expect(ERP_TABLET_MAX_WIDTH).toBe(1279);
    expect(ERP_DESKTOP_MIN_WIDTH).toBe(1280);
    expect(ERP_COMPACT_CONTENT_MAX_WIDTH).toBe(1023);
  });

  it.each([
    [375, 'phone'],
    [767, 'phone'],
    [768, 'tablet'],
    [834, 'tablet'],
    [1024, 'tablet'],
    [1194, 'tablet'],
    [1279, 'tablet'],
    [1280, 'desktop'],
    [1440, 'desktop'],
  ] as const)('classifies %ipx as %s', (width, expected) => {
    expect(classifyErpViewport(width)).toBe(expected);
  });

  it.each([
    [767, true],
    [834, true],
    [1023, true],
    [1024, false],
    [1194, false],
    [1280, false],
  ] as const)('uses compact operational content=%s at %ipx', (width, expected) => {
    expect(isCompactOperationalViewport(width)).toBe(expected);
  });
});
