import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: supabaseMock.getSession,
    },
    functions: {
      invoke: supabaseMock.invoke,
    },
  },
}));

function defineServiceWorker(pushManager: unknown) {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      ready: Promise.resolve({ pushManager }),
    },
  });
}

function defineNotification(permission: NotificationPermission = 'granted') {
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: {
      permission,
      requestPermission: vi.fn().mockResolvedValue(permission),
    },
  });
}

describe('pushClient', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'AQID');
    supabaseMock.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    supabaseMock.invoke.mockResolvedValue({ data: { ok: true }, error: null });
  });

  it('does not subscribe when Notification support is missing', async () => {
    const subscribe = vi.fn();
    vi.stubGlobal('PushManager', function PushManager() {});
    defineServiceWorker({
      getSubscription: vi.fn().mockResolvedValue(null),
      subscribe,
    });

    const { getOrCreatePushSubscription } = await import('./pushClient');

    await expect(getOrCreatePushSubscription(['crm_inbox'], 'store-1')).resolves.toBeNull();
    expect(subscribe).not.toHaveBeenCalled();
    expect(supabaseMock.invoke).not.toHaveBeenCalled();
  });

  it('does not subscribe when the VAPID public key is not configured', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '');
    defineNotification();
    const subscribe = vi.fn();
    vi.stubGlobal('PushManager', function PushManager() {});
    defineServiceWorker({
      getSubscription: vi.fn().mockResolvedValue(null),
      subscribe,
    });

    const { getOrCreatePushSubscription } = await import('./pushClient');

    await expect(getOrCreatePushSubscription(['crm_inbox'], 'store-1')).resolves.toBeNull();
    expect(subscribe).not.toHaveBeenCalled();
    expect(supabaseMock.invoke).not.toHaveBeenCalled();
  });

  it('subscribes with userVisibleOnly and persists the complete subscription payload', async () => {
    defineNotification();
    const pushSubscription = {
      endpoint: 'https://push.example/1',
      toJSON: () => ({
        endpoint: 'https://push.example/1',
        keys: { p256dh: 'p256dh', auth: 'auth' },
      }),
    };
    const subscribe = vi.fn().mockResolvedValue(pushSubscription);
    vi.stubGlobal('PushManager', function PushManager() {});
    defineServiceWorker({
      getSubscription: vi.fn().mockResolvedValue(null),
      subscribe,
    });

    const { getOrCreatePushSubscription, hasCachedSubscription } = await import('./pushClient');

    await expect(getOrCreatePushSubscription(['crm_inbox'], 'store-1')).resolves.toBe(pushSubscription);
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array([1, 2, 3]),
    });
    expect(supabaseMock.invoke).toHaveBeenCalledWith('push-subscribe', expect.objectContaining({
      method: 'POST',
      body: expect.objectContaining({
        endpoint: 'https://push.example/1',
        p256dh: 'p256dh',
        auth: 'auth',
        topics: ['crm_inbox'],
        store_id: 'store-1',
      }),
    }));
    expect(hasCachedSubscription()).toBe(true);
  });

  it('unsubscribes the browser subscription and deletes it from the backend', async () => {
    defineNotification();
    localStorage.setItem('push.sub.endpoint', 'https://push.example/1');
    const unsubscribe = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('PushManager', function PushManager() {});
    defineServiceWorker({
      getSubscription: vi.fn().mockResolvedValue({
        endpoint: 'https://push.example/1',
        unsubscribe,
      }),
    });

    const { revokePushSubscription, hasCachedSubscription } = await import('./pushClient');

    await revokePushSubscription();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(supabaseMock.invoke).toHaveBeenCalledWith('push-subscribe', {
      method: 'DELETE',
      body: { endpoint: 'https://push.example/1' },
    });
    expect(hasCachedSubscription()).toBe(false);
  });

  it('updates topics for an existing browser subscription without creating a new subscription', async () => {
    defineNotification();
    const pushSubscription = {
      endpoint: 'https://push.example/1',
      toJSON: () => ({
        endpoint: 'https://push.example/1',
        keys: { p256dh: 'p256dh', auth: 'auth' },
      }),
    };
    const subscribe = vi.fn();
    vi.stubGlobal('PushManager', function PushManager() {});
    defineServiceWorker({
      getSubscription: vi.fn().mockResolvedValue(pushSubscription),
      subscribe,
    });

    const { updatePushSubscriptionTopics } = await import('./pushClient');

    await expect(updatePushSubscriptionTopics(['crm_inbox', 'sale'], 'store-1')).resolves.toBe(true);
    expect(subscribe).not.toHaveBeenCalled();
    expect(supabaseMock.invoke).toHaveBeenCalledWith('push-subscribe', expect.objectContaining({
      method: 'POST',
      body: expect.objectContaining({
        endpoint: 'https://push.example/1',
        topics: ['crm_inbox', 'sale'],
        store_id: 'store-1',
      }),
    }));
  });
});
