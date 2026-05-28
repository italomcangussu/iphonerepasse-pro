import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('iOS standalone shell CSS', () => {
  it('does not add global body safe-area padding in standalone mode', () => {
    const css = readFileSync(resolve(process.cwd(), 'index.css'), 'utf8');
    const standaloneBlock = css.match(/@media \(display-mode: standalone\) \{([\s\S]*?)\n  \}/)?.[1] ?? '';

    expect(standaloneBlock).not.toMatch(/body\s*\{[\s\S]*padding-(top|bottom):\s*env\(safe-area-inset-/);
  });
});
