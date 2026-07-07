import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('tablet input layout contracts', () => {
  it('removes the intrinsic width of native iOS temporal inputs', () => {
    const css = read('index.css');

    expect(css).toContain(`@supports (-webkit-touch-callout: none) {
    input.ios-input:is([type="date"], [type="datetime-local"], [type="time"], [type="month"], [type="week"]) {
      -webkit-appearance: none;
      appearance: none;
      inline-size: 100%;
      max-inline-size: 100%;
      min-inline-size: 0;
    }`);
    expect(css).toContain(`input.ios-input:is([type="date"], [type="datetime-local"], [type="time"], [type="month"], [type="week"])::-webkit-date-and-time-value {
      min-width: 0;
      text-align: left;
    }`);
  });

  it('keeps Dashboard desktop columns out of tablet widths', () => {
    const dashboard = read('pages/Dashboard.tsx');

    expect(dashboard).toContain('dashboard-metrics-grid grid grid-cols-2 xl:grid-cols-3');
    expect(dashboard).toContain('grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6');
    expect(dashboard).not.toContain('dashboard-metrics-grid grid grid-cols-2 lg:grid-cols-3');
  });

  it('covers Dashboard and representative iPad widths in the responsive smoke suite', () => {
    const smoke = read('tests/smoke/erp-responsive-ui.smoke.spec.ts');

    expect(smoke).toContain("{ path: '/#/', title: 'Dashboard' }");
    for (const width of [768, 820, 834, 1024, 1194]) {
      expect(smoke).toContain(`width: ${width}`);
    }
    expect(smoke).toContain("input[type=\"date\"]");
  });
});
