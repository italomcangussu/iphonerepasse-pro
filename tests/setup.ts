import * as jestDomMatchers from '@testing-library/jest-dom/matchers';
import { expect, vi } from 'vitest';

// Extending the same Vitest expect instance imported by the suites avoids a
// split-instance resolution edge case in Deno-populated node_modules.
expect.extend(jestDomMatchers);

Object.defineProperty(window, 'scrollTo', {
  configurable: true,
  writable: true,
  value: vi.fn()
});

Object.defineProperty(HTMLMediaElement.prototype, 'load', {
  configurable: true,
  writable: true,
  value: vi.fn()
});
