import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type ServiceWorkerListener = (event: any) => void;

function loadServiceWorker(hostname = 'app.iphonerepasse.test') {
  const listeners = new Map<string, ServiceWorkerListener>();
  const showNotification = vi.fn(() => Promise.resolve());
  const matchAll = vi.fn(() => Promise.resolve([]));
  const openWindow = vi.fn(() => Promise.resolve(undefined));
  const cacheMatch = vi.fn();
  const cachePut = vi.fn(() => Promise.resolve());
  const setAppBadge = vi.fn(() => Promise.resolve());
  const clearAppBadge = vi.fn(() => Promise.resolve());

  const self = {
    location: new URL(`https://${hostname}/`),
    registration: {
      showNotification,
      navigationPreload: undefined,
    },
    navigator: { setAppBadge, clearAppBadge },
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
    open: vi.fn(() => Promise.resolve({ match: cacheMatch, put: cachePut, keys: vi.fn(() => Promise.resolve([])), delete: vi.fn() })),
    keys: vi.fn(() => Promise.resolve([])),
    delete: vi.fn(() => Promise.resolve(true)),
  };

  const fetchMock = vi.fn();
  const context = {
    self,
    caches,
    console,
    URL,
    Request,
    Response,
    fetch: fetchMock,
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
    caches,
    cacheMatch,
    cachePut,
    fetchMock,
    setAppBadge,
    clearAppBadge,
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

async function dispatchRespondWith(listener: ServiceWorkerListener, request: Request) {
  let responsePromise: Promise<Response> | null = null;
  listener({
    request,
    respondWith: (promise: Promise<Response>) => {
      responsePromise = promise;
    },
  });
  return responsePromise ? await responsePromise : null;
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
        data: expect.objectContaining({ url: '/crm/leads/123' }),
        silent: false,
      })
    );
  });

  it('preserves CRM notification metadata for native Web Push delivery', async () => {
    const { listeners, showNotification } = loadServiceWorker();

    await dispatchWaitUntil(listeners.get('push')!, {
      data: {
        json: () => ({
          title: 'Nova mensagem CRM',
          body: 'Cliente: Oi',
          url: '/#/crmplus/conversations/conversation-1',
          notificationId: 'message-1',
          type: 'crm_inbox',
          icon: '/brand/crm/icon-192.png',
          badge: '/brand/crm/icon-192.png',
        }),
      },
    });

    expect(showNotification).toHaveBeenCalledWith(
      'Nova mensagem CRM',
      expect.objectContaining({
        icon: '/brand/crm/icon-192.png',
        badge: '/brand/crm/icon-192.png',
        data: expect.objectContaining({
          url: '/#/crmplus/conversations/conversation-1',
          notificationId: 'message-1',
          type: 'crm_inbox',
        }),
      })
    );
  });

  it('renders a declarative push envelope in browsers that still depend on the service worker', async () => {
    const { listeners, showNotification } = loadServiceWorker();

    await dispatchWaitUntil(listeners.get('push')!, {
      data: {
        json: () => ({
          web_push: 8030,
          notification: {
            title: 'Nova mensagem CRM',
            body: 'Cliente: Oi',
            navigate: 'https://crm.iphonerepasse.com.br/conversations/conversation-1',
            silent: false,
            icon: '/brand/crm/icon-192.png',
            badge: '/brand/crm/icon-192.png',
            tag: 'crm-message-1',
          },
        }),
      },
    });

    expect(showNotification).toHaveBeenCalledOnce();
    expect(showNotification).toHaveBeenCalledWith(
      'Nova mensagem CRM',
      expect.objectContaining({
        body: 'Cliente: Oi',
        icon: '/brand/crm/icon-192.png',
        badge: '/brand/crm/icon-192.png',
        tag: 'crm-message-1',
        silent: false,
        data: expect.objectContaining({
          url: 'https://crm.iphonerepasse.com.br/conversations/conversation-1',
        }),
      })
    );
  });

  it('maps declarative app_badge to the Badging API', async () => {
    const { listeners, setAppBadge } = loadServiceWorker();

    await dispatchWaitUntil(listeners.get('push')!, {
      data: {
        json: () => ({
          web_push: 8030,
          notification: {
            title: 'Conversas pendentes',
            navigate: 'https://crm.iphonerepasse.com.br/',
            silent: false,
            app_badge: '4',
          },
        }),
      },
    });

    expect(setAppBadge).toHaveBeenCalledWith(4);
  });

  it('shows a fallback notification when the payload cannot be parsed', async () => {
    const { listeners, showNotification } = loadServiceWorker();

    await dispatchWaitUntil(listeners.get('push')!, {
      data: {
        json: () => {
          throw new Error('invalid json');
        },
        text: () => {
          throw new Error('invalid text');
        },
      },
    });

    expect(showNotification).toHaveBeenCalledOnce();
    expect(showNotification).toHaveBeenCalledWith(
      'iPhoneRepasse Pro',
      expect.objectContaining({ silent: false })
    );
  });

  it('shows a default-titled notification when there is no payload data', async () => {
    const { listeners, showNotification } = loadServiceWorker();

    await dispatchWaitUntil(listeners.get('push')!, { data: null });

    expect(showNotification).toHaveBeenCalledOnce();
    expect(showNotification).toHaveBeenCalledWith(
      'iPhoneRepasse Pro',
      expect.objectContaining({ silent: false })
    );
  });

  it('updates the app badge when the payload carries a positive count', async () => {
    const { listeners, setAppBadge } = loadServiceWorker();

    await dispatchWaitUntil(listeners.get('push')!, {
      data: {
        json: () => ({ title: 'Nova mensagem', badgeCount: 3 }),
      },
    });

    expect(setAppBadge).toHaveBeenCalledWith(3);
  });

  it('does not touch the badge when no count is provided', async () => {
    const { listeners, setAppBadge } = loadServiceWorker();

    await dispatchWaitUntil(listeners.get('push')!, {
      data: { json: () => ({ title: 'Nova mensagem' }) },
    });

    expect(setAppBadge).not.toHaveBeenCalled();
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

  it('clears the app badge when a notification is clicked', async () => {
    const { listeners, matchAll, clearAppBadge } = loadServiceWorker();
    matchAll.mockResolvedValue([]);

    await dispatchWaitUntil(listeners.get('notificationclick')!, {
      notification: {
        data: { url: '/crm/leads/123' },
        close: vi.fn(),
      },
    });

    expect(clearAppBadge).toHaveBeenCalledOnce();
  });

  it('prefers an existing CRM Plus window for CRM Plus notification URLs', async () => {
    const { listeners, matchAll, openWindow } = loadServiceWorker();
    const focusMain = vi.fn(() => Promise.resolve());
    const postMain = vi.fn();
    const focusCrm = vi.fn(() => Promise.resolve());
    const postCrm = vi.fn();
    matchAll.mockResolvedValue([
      {
        url: 'https://app.iphonerepasse.test/#/inventory',
        focus: focusMain,
        postMessage: postMain,
      },
      {
        url: 'https://app.iphonerepasse.test/#/crmplus',
        focus: focusCrm,
        postMessage: postCrm,
      },
    ]);

    await dispatchWaitUntil(listeners.get('notificationclick')!, {
      notification: {
        data: { url: '/#/crmplus/conversations/123' },
        close: vi.fn(),
      },
    });

    expect(focusCrm).toHaveBeenCalledOnce();
    expect(postCrm).toHaveBeenCalledWith({ type: 'NAVIGATE', url: '/#/crmplus/conversations/123' });
    expect(focusMain).not.toHaveBeenCalled();
    expect(postMain).not.toHaveBeenCalled();
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

  it('opens absolute CRM Plus URLs directly when no same-origin PWA window exists', async () => {
    const { listeners, matchAll, openWindow } = loadServiceWorker();
    matchAll.mockResolvedValue([]);

    await dispatchWaitUntil(listeners.get('notificationclick')!, {
      notification: {
        data: { url: 'https://crm.iphonerepasse.com.br/conversations/123' },
        close: vi.fn(),
      },
    });

    expect(openWindow).toHaveBeenCalledWith('https://crm.iphonerepasse.com.br/conversations/123');
  });
});

describe('service worker authenticated fetch strategy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not serve cached Supabase REST responses for authenticated GET requests', async () => {
    const { listeners, cacheMatch, cachePut, fetchMock } = loadServiceWorker();
    const cached = new Response(JSON.stringify([{ id: 'old-private-row' }]), { status: 200 });
    const fresh = new Response(JSON.stringify([{ id: 'fresh-private-row' }]), { status: 200 });
    cacheMatch.mockResolvedValue(cached);
    fetchMock.mockResolvedValue(fresh);

    const response = await dispatchRespondWith(
      listeners.get('fetch')!,
      new Request('https://project.supabase.co/rest/v1/stock_items?select=*', {
        headers: { Authorization: 'Bearer user-token' },
      })
    );

    await expect(response?.json()).resolves.toEqual([{ id: 'fresh-private-row' }]);
    expect(cacheMatch).not.toHaveBeenCalled();
    expect(cachePut).not.toHaveBeenCalled();
  });
});

describe('service worker offline fallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the CRM offline page for CRM host navigations', async () => {
    const { listeners, cacheMatch, fetchMock } = loadServiceWorker('crm.iphonerepasse.com.br');
    fetchMock.mockRejectedValue(new Error('offline'));
    cacheMatch.mockImplementation((key: Request | string) => {
      if (key === '/offline/index.html') {
        return Promise.resolve(new Response('CRM Plus está offline', { status: 200 }));
      }
      return Promise.resolve(undefined);
    });

    const response = await dispatchRespondWith(
      listeners.get('fetch')!,
      {
        method: 'GET',
        mode: 'navigate',
        url: 'https://crm.iphonerepasse.com.br/',
      } as Request
    );

    await expect(response?.text()).resolves.toContain('CRM Plus está offline');
    expect(cacheMatch).toHaveBeenCalledWith('/offline/index.html');
  });
});
