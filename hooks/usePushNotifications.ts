import { useCallback, useEffect, useState } from 'react';
import {
  detectPlatform,
  getCachedTopics,
  getNotificationPermission,
  getOrCreatePushSubscription,
  hasCachedSubscription,
  isPushSupported,
  requestNotificationPermission,
  revokePushSubscription,
  syncPushSubscription,
  updatePushSubscriptionTopics,
} from '../services/pushClient';
import { detectStandalone, detectIOS } from '../services/pwa';
import { getDefaultPushTopics } from '../lib/pushProduct';

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
  updateTopics: (topics?: string[], storeId?: string) => Promise<boolean>;
  unsubscribe: () => Promise<void>;
}

function computePushStatus(): PushStatus {
  if (typeof window === 'undefined') return 'unsupported';

  // iOS Safari requires PWA to be installed before push works.
  if (detectIOS() && !detectStandalone()) return 'needs_install';

  if (!isPushSupported()) return 'unsupported';

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

  useEffect(() => {
    if (status === 'requesting' || status === 'subscribing' || status === 'unsupported' || status === 'needs_install' || status === 'denied') {
      return undefined;
    }
    if (getNotificationPermission() !== 'granted') return undefined;

    let cancelled = false;
    const syncGrantedSubscription = async () => {
      try {
        const sub = await syncPushSubscription(getCachedTopics());
        if (!cancelled) setStatus(sub ? 'subscribed' : computePushStatus());
      } catch (err) {
        console.error('[push] granted subscription sync error:', err);
        if (!cancelled) setStatus('error');
      }
    };

    void syncGrantedSubscription();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const subscribe = useCallback(async (topics: string[] = getDefaultPushTopics(), storeId?: string, prefetchedPermission?: NotificationPermission) => {
    if (status === 'subscribed' || status === 'requesting' || status === 'subscribing') return;
    if (status === 'needs_install' || status === 'unsupported' || status === 'denied') {
      setStatus(computePushStatus());
      return;
    }

    setStatus('requesting');
    const perm = prefetchedPermission ?? await requestNotificationPermission();
    if (perm !== 'granted') {
      setStatus(perm === 'denied' ? 'denied' : perm === 'unsupported' ? 'unsupported' : 'default');
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

  const updateTopics = useCallback(async (topics: string[] = getDefaultPushTopics(), storeId?: string) => {
    if (status !== 'subscribed') return false;
    try {
      const updated = await updatePushSubscriptionTopics(topics, storeId);
      setStatus(computePushStatus());
      return updated;
    } catch (err) {
      console.error('[push] update topics error:', err);
      setStatus('error');
      return false;
    }
  }, [status]);

  return { status, platform, subscribe, updateTopics, unsubscribe };
}
