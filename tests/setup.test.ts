import { describe, expect, it, vi } from 'vitest';

describe('test setup', () => {
  it('mocks HTMLMediaElement.load for jsdom audio/video components', () => {
    expect(vi.isMockFunction(HTMLMediaElement.prototype.load)).toBe(true);
  });
});
