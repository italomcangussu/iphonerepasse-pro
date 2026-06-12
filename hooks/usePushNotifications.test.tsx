import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePushNotifications } from './usePushNotifications';

const mockState = vi.hoisted(() => ({
  permission: 'default' as NotificationPermission,
  hasCachedSubscription: false,
  isIOS: false,
  isStandalone: true,
  isPushSupported: true,
}));

vi.mock('../services/pushClient', () => ({
  detectPlatform: vi.fn(() => 'desktop'),
  getCachedTopics: vi.fn(() => ['crm_inbox', 'new_lead']),
  getNotificationPermission: vi.fn(() => mockState.permission),
  getOrCreatePushSubscription: vi.fn(),
  hasCachedSubscription: vi.fn(() => mockState.hasCachedSubscription),
  isPushSupported: vi.fn(() => mockState.isPushSupported),
  requestNotificationPermission: vi.fn(),
  revokePushSubscription: vi.fn(),
  syncPushSubscription: vi.fn(),
  updatePushSubscriptionTopics: vi.fn(),
}));

vi.mock('../services/pwa', () => ({
  detectIOS: vi.fn(() => mockState.isIOS),
  detectStandalone: vi.fn(() => mockState.isStandalone),
}));

describe('usePushNotifications', () => {
  let permissionStatus: PermissionStatus;
  let permissionChangeHandler: (() => void) | null;

  beforeEach(() => {
    vi.clearAllMocks();
    mockState.permission = 'default';
    mockState.hasCachedSubscription = false;
    mockState.isIOS = false;
    mockState.isStandalone = true;
    mockState.isPushSupported = true;
    permissionChangeHandler = null;

    permissionStatus = {
      state: 'prompt',
      name: 'notifications',
      onchange: null,
      addEventListener: vi.fn((_event: string, handler: EventListenerOrEventListenerObject) => {
        permissionChangeHandler = typeof handler === 'function'
          ? handler as () => void
          : () => handler.handleEvent(new Event('change'));
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as PermissionStatus;

    Object.defineProperty(window, 'PushManager', {
      configurable: true,
      value: vi.fn(),
    });

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {},
    });

    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: vi.fn().mockResolvedValue(permissionStatus),
      },
    });
  });

  it('hydrates to subscribed when the system grants notifications and a cached subscription exists', async () => {
    const pushClient = await import('../services/pushClient');
    vi.mocked(pushClient.syncPushSubscription).mockResolvedValue({ endpoint: 'https://push.example/1' } as PushSubscription);
    const { result } = renderHook(() => usePushNotifications());

    expect(result.current.status).toBe('default');
    await waitFor(() => expect(permissionStatus.addEventListener).toHaveBeenCalledWith('change', expect.any(Function)));

    mockState.permission = 'granted';
    mockState.hasCachedSubscription = true;
    Object.defineProperty(permissionStatus, 'state', { configurable: true, value: 'granted' });

    act(() => {
      permissionChangeHandler?.();
    });

    await waitFor(() => expect(result.current.status).toBe('subscribed'));
  });

  it('silently restores a missing iOS Push API subscription after permission is already granted', async () => {
    mockState.isIOS = true;
    mockState.isStandalone = true;
    mockState.permission = 'granted';
    mockState.hasCachedSubscription = false;
    const pushClient = await import('../services/pushClient');
    vi.mocked(pushClient.syncPushSubscription).mockResolvedValue({ endpoint: 'https://push.example/ios' } as PushSubscription);

    const { result } = renderHook(() => usePushNotifications());

    await waitFor(() => expect(pushClient.syncPushSubscription).toHaveBeenCalledWith(['crm_inbox', 'new_lead']));
    await waitFor(() => expect(result.current.status).toBe('subscribed'));
  });

  it('hydrates from needs_install when iOS enters standalone mode', async () => {
    mockState.isIOS = true;
    mockState.isStandalone = false;

    const { result } = renderHook(() => usePushNotifications());

    expect(result.current.status).toBe('needs_install');

    mockState.isStandalone = true;

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    await waitFor(() => expect(result.current.status).toBe('default'));
  });

  it('does not try to create a push subscription when prefetched permission remains default', async () => {
    const pushClient = await import('../services/pushClient');
    const { result } = renderHook(() => usePushNotifications());

    await act(async () => {
      await result.current.subscribe(undefined, undefined, 'default');
    });

    expect(pushClient.getOrCreatePushSubscription).not.toHaveBeenCalled();
    expect(result.current.status).toBe('default');
  });

  it('does not request permission or subscribe while iOS still needs installation', async () => {
    mockState.isIOS = true;
    mockState.isStandalone = false;
    const pushClient = await import('../services/pushClient');
    vi.mocked(pushClient.requestNotificationPermission).mockResolvedValue('granted');

    const { result } = renderHook(() => usePushNotifications());

    await act(async () => {
      await result.current.subscribe(['crm_inbox'], 'store-1');
    });

    expect(pushClient.requestNotificationPermission).not.toHaveBeenCalled();
    expect(pushClient.getOrCreatePushSubscription).not.toHaveBeenCalled();
    expect(result.current.status).toBe('needs_install');
  });

  it('reports unsupported when VAPID-backed push support is unavailable', () => {
    mockState.isPushSupported = false;

    const { result } = renderHook(() => usePushNotifications());

    expect(result.current.status).toBe('unsupported');
  });

  it('updates notification topics only when already subscribed', async () => {
    mockState.permission = 'granted';
    mockState.hasCachedSubscription = true;
    const pushClient = await import('../services/pushClient');
    vi.mocked(pushClient.updatePushSubscriptionTopics).mockResolvedValue(true);

    const { result } = renderHook(() => usePushNotifications());

    await act(async () => {
      await expect(result.current.updateTopics(['crm_inbox'], 'store-1')).resolves.toBe(true);
    });

    expect(pushClient.updatePushSubscriptionTopics).toHaveBeenCalledWith(['crm_inbox'], 'store-1');
  });
});
