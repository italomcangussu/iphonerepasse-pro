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
  subscribe: (topics?: string[], storeId?: string) => Promise<void>;
  unsubscribe: () => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const platform = detectPlatform();

  function computeInitialStatus(): PushStatus {
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

  const [status, setStatus] = useState<PushStatus>(computeInitialStatus);

  // Keep permission state in sync (handles external revocation).
  useEffect(() => {
    if (!('permissions' in navigator)) return;
    navigator.permissions.query({ name: 'notifications' as PermissionName })
      .then((permStatus) => {
        permStatus.addEventListener('change', () => {
          if (permStatus.state === 'denied') setStatus('denied');
          else if (permStatus.state === 'prompt') setStatus('default');
        });
      })
      .catch(() => { /* ignore — old Safari */ });
  }, []);

  const subscribe = useCallback(async (topics: string[] = ['crm_inbox', 'new_lead', 'sale'], storeId?: string) => {
    if (status === 'subscribed' || status === 'requesting' || status === 'subscribing') return;

    setStatus('requesting');
    const perm = await requestNotificationPermission();
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
