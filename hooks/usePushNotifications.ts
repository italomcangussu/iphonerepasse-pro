import { useCallback, useEffect, useState } from 'react';
import {
  detectPlatform,
  getNotificationPermission,
  getOrCreatePushSubscription,
  hasCachedSubscription,
  requestNotificationPermission,
  revokePushSubscription,
} from '../services/pushClient';
import { detectStandalone, detectIOS } from '../services/pwa';

export type PushStatus =
  | 'unsupported'      // browser doesn't support push (or is iOS Safari NOT installed)
  | 'needs_install'    // iOS Safari, not yet installed as PWA
  | 'default'          // permission not yet requested
  | 'requesting'       // permission dialog open
  | 'subscribing'      // creating subscription
  | 'subscribed'       // active subscription
  | 'denied'           // user denied permission
  | 'error';           // subscribe/unsubscribe failed

interface UsePushNotificationsResult {
  status: PushStatus;
  platform: ReturnType<typeof detectPlatform>;
  subscribe: (topics?: string[], storeId?: string, prefetchedPermission?: NotificationPermission) => Promise<void>;
  unsubscribe: () => Promise<void>;
}

function computePushStatus(): PushStatus {
  if (typeof window === 'undefined') return 'unsupported';

  // iOS Safari requires PWA to be installed before push works.
  if (detectIOS() && !detectStandalone()) return 'needs_install';

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';

  const perm = getNotificationPermission();
  if (perm === 'unsupported') return 'unsupported';
  if (perm === 'denied') return 'denied';
  if (perm === 'granted' && hasCachedSubscription()) return 'subscribed';
  return 'default';
}

export function usePushNotifications(): UsePushNotificationsResult {
  const platform = detectPlatform();

  const [status, setStatus] = useState<PushStatus>(computePushStatus);
  const hydrateStatus = useCallback(() => setStatus(computePushStatus()), []);

  // Keep permission and install state in sync when changed outside this hook.
  useEffect(() => {
    let disposed = false;
    let permissionStatus: PermissionStatus | null = null;
    const onSystemChange = () => hydrateStatus();

    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'notifications' as PermissionName })
        .then((permStatus) => {
          if (disposed) return;
          permissionStatus = permStatus;
          permissionStatus.addEventListener('change', onSystemChange);
        })
        .catch(() => { /* ignore — old Safari */ });
    }

    window.addEventListener('appinstalled', onSystemChange);
    window.addEventListener('pageshow', onSystemChange);
    window.addEventListener('focus', onSystemChange);
    document.addEventListener('visibilitychange', onSystemChange);

    let standaloneMedia: MediaQueryList | null = null;
    try {
      standaloneMedia = window.matchMedia?.('(display-mode: standalone)') ?? null;
      standaloneMedia?.addEventListener?.('change', onSystemChange);
    } catch (_) { /* ignore — old Safari */ }

    return () => {
      disposed = true;
      permissionStatus?.removeEventListener('change', onSystemChange);
      window.removeEventListener('appinstalled', onSystemChange);
      window.removeEventListener('pageshow', onSystemChange);
      window.removeEventListener('focus', onSystemChange);
      document.removeEventListener('visibilitychange', onSystemChange);
      standaloneMedia?.removeEventListener?.('change', onSystemChange);
    };
  }, [hydrateStatus]);

  const subscribe = useCallback(async (topics: string[] = ['crm_inbox', 'new_lead', 'sale'], storeId?: string, prefetchedPermission?: NotificationPermission) => {
    if (status === 'subscribed' || status === 'requesting' || status === 'subscribing') return;

    setStatus('requesting');
    const perm = prefetchedPermission || await requestNotificationPermission();
    if (perm === 'denied' || perm === 'unsupported') {
      setStatus(perm === 'denied' ? 'denied' : 'unsupported');
      return;
    }

    setStatus('subscribing');
    try {
      const sub = await getOrCreatePushSubscription(topics, storeId);
      setStatus(sub ? 'subscribed' : 'error');
    } catch (err) {
      console.error('[push] subscribe error:', err);
      setStatus('error');
    }
  }, [status]);

  const unsubscribe = useCallback(async () => {
    try {
      await revokePushSubscription();
      setStatus('default');
    } catch (err) {
      console.error('[push] unsubscribe error:', err);
      setStatus('error');
    }
  }, []);

  return { status, platform, subscribe, unsubscribe };
}
