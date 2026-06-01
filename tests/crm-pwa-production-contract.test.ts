import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('CRM production PWA contract', () => {
  it('boots CRM branding before the static manifest link can be parsed', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const bootstrapIndex = html.indexOf('id="crm-pwa-head-bootstrap"');
    const manifestIndex = html.indexOf('rel="manifest"');

    expect(bootstrapIndex).toBeGreaterThan(-1);
    expect(manifestIndex).toBeGreaterThan(-1);
    expect(bootstrapIndex).toBeLessThan(manifestIndex);
  });

  it('ships a real /offline fallback route for static hosts with clean URLs', () => {
    expect(existsSync(resolve(process.cwd(), 'public/offline/index.html'))).toBe(true);
    const sw = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8');
    expect(sw).toContain('/offline/index.html');
  });

  it('configures static serving so service worker updates are not cached for hours', () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), 'serve.json'), 'utf8')) as {
      cleanUrls?: boolean;
      headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
    };
    const swHeaders = config.headers?.find((entry) => entry.source === 'sw.js')?.headers ?? [];

    expect(config.cleanUrls).toBe(false);
    expect(swHeaders).toContainEqual({ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' });
  });

  it('lets push-send authenticate internally instead of being blocked by the function gateway', () => {
    const config = readFileSync(resolve(process.cwd(), 'supabase/config.toml'), 'utf8');

    expect(config).toMatch(/\[functions\.push-send\]\s+verify_jwt\s*=\s*false/);
    expect(config).toMatch(/\[functions\.push-subscribe\]\s+verify_jwt\s*=\s*true/);
  });
});
