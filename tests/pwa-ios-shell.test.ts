import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('iOS standalone shell CSS', () => {
  it('does not add global body safe-area padding in standalone mode', () => {
    const css = readFileSync(resolve(process.cwd(), 'index.css'), 'utf8');
    const standaloneBlock = css.match(/@media \(display-mode: standalone\) \{([\s\S]*?)\n  \}/)?.[1] ?? '';

    expect(standaloneBlock).not.toMatch(/body\s*\{[\s\S]*padding-(top|bottom):\s*env\(safe-area-inset-/);
  });

  it('does not double-reserve the home-indicator area in the main mobile shell', () => {
    const layout = readFileSync(resolve(process.cwd(), 'components/Layout.tsx'), 'utf8');
    const css = readFileSync(resolve(process.cwd(), 'index.css'), 'utf8');

    expect(css).toContain('--app-mobile-tabbar-height: 50px');
    expect(css).toContain('--app-mobile-content-bottom-padding: calc(var(--app-mobile-tabbar-height) + 2rem)');
    expect(layout).toContain('pb-[var(--app-mobile-content-bottom-padding)]');
    expect(layout).toContain('h-[var(--app-mobile-tabbar-height)]');
    expect(layout).toContain('safe-area-bottom');
    expect(layout).not.toContain('pb-[calc(8rem+env(safe-area-inset-bottom,0px))]');
  });
});
