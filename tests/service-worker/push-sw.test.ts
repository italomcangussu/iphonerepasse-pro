import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type ServiceWorkerListener = (event: any) => void;

function loadServiceWorker() {
  const listeners = new Map<string, ServiceWorkerListener>();
  const showNotification = vi.fn(() => Promise.resolve());
  const matchAll = vi.fn(() => Promise.resolve([]));
  const openWindow = vi.fn(() => Promise.resolve(undefined));

  const self = {
    location: new URL('https://app.iphonerepasse.test/'),
    registration: {
      showNotification,
      navigationPreload: undefined,
    },
    clients: {
      claim: vi.fn(() => Promise.resolve()),
      matchAll,
      openWindow,
    },
    skipWaiting: vi.fn(),
    addEventListener: vi.fn((type: string, listener: ServiceWorkerListener) => {
      listeners.set(type, listener);
    }),
  };

  const caches = {
    open: vi.fn(),
    keys: vi.fn(() => Promise.resolve([])),
    delete: vi.fn(() => Promise.resolve(true)),
  };

  const context = {
    self,
    caches,
    console,
    URL,
    Request,
    Response,
    fetch: vi.fn(),
    setTimeout,
    clearTimeout,
  };

  const swPath = resolve(process.cwd(), 'public/sw.js');
  vm.runInNewContext(readFileSync(swPath, 'utf8'), context, { filename: swPath });

  return {
    listeners,
    showNotification,
    matchAll,
    openWindow,
  };
}

async function dispatchWaitUntil(listener: ServiceWorkerListener, event: Record<string, any>) {
  const waitUntilPromises: Promise<unknown>[] = [];
  listener({
    ...event,
    waitUntil: (promise: Promise<unknown>) => waitUntilPromises.push(promise),
  });
  await Promise.all(waitUntilPromises);
}

describe('service worker push notifications', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('always displays a visible notification and never passes through silent true', async () => {
    const { listeners, showNotification } = loadServiceWorker();

    await dispatchWaitUntil(listeners.get('push')!, {
      data: {
        json: () => ({
          title: 'Novo lead',
          body: 'Cliente interessado',
          url: '/crm/leads/123',
          silent: true,
        }),
      },
    });

    expect(showNotification).toHaveBeenCalledOnce();
    expect(showNotification).toHaveBeenCalledWith(
      'Novo lead',
      expect.objectContaining({
        body: 'Cliente interessado',
        data: { url: '/crm/leads/123' },
        silent: false,
      })
    );
  });
});

describe('service worker notification clicks', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('focuses an existing app window and posts a navigate message', async () => {
    const { listeners, matchAll, openWindow } = loadServiceWorker();
    const focus = vi.fn(() => Promise.resolve());
    const postMessage = vi.fn();
    matchAll.mockResolvedValue([
      {
        url: 'https://app.iphonerepasse.test/crm',
        focus,
        postMessage,
      },
    ]);
    const close = vi.fn();

    await dispatchWaitUntil(listeners.get('notificationclick')!, {
      notification: {
        data: { url: '/crm/leads/123' },
        close,
      },
    });

    expect(close).toHaveBeenCalledOnce();
    expect(matchAll).toHaveBeenCalledWith({ type: 'window', includeUncontrolled: true });
    expect(focus).toHaveBeenCalledOnce();
    expect(postMessage).toHaveBeenCalledWith({ type: 'NAVIGATE', url: '/crm/leads/123' });
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('opens a new window when there is no existing app window', async () => {
    const { listeners, matchAll, openWindow } = loadServiceWorker();
    matchAll.mockResolvedValue([]);

    await dispatchWaitUntil(listeners.get('notificationclick')!, {
      notification: {
        data: { url: '/crm/leads/123' },
        close: vi.fn(),
      },
    });

    expect(openWindow).toHaveBeenCalledWith('/crm/leads/123');
  });
});
