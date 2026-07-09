import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPwaState,
  handleServiceWorkerControllerChange,
  setPwaAutoReloadBlocked,
} from './pwa';

describe('pwa service worker reload lifecycle', () => {
  beforeEach(() => {
    setPwaAutoReloadBlocked(false);
    getPwaState().updateAvailable = false;
  });

  it('defers an automatic controllerchange reload while local file work is active', () => {
    const reload = vi.fn();

    setPwaAutoReloadBlocked(true);
    const result = handleServiceWorkerControllerChange(reload);

    expect(result).toBe('deferred');
    expect(reload).not.toHaveBeenCalled();
    expect(getPwaState().updateAvailable).toBe(true);
  });
});
