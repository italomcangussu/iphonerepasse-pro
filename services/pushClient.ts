/**
 * Web Push client utilities.
 *
 * Handles:
 *  - Requesting notification permission
 *  - Creating/destroying push subscriptions via the push-subscribe edge function
 *  - Persisting the current subscription endpoint in localStorage for quick state checks
 */

import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;
const SUB_ENDPOINT_KEY = 'push.sub.endpoint';
const DEFAULT_TOPICS = ['crm_inbox', 'new_lead', 'sale'];

// ─── VAPID helpers ─────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// ─── Platform detection ────────────────────────────────────────────────────────

export function detectPlatform(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && (navigator.maxTouchPoints || 0) > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

// ─── Permission ─────────────────────────────────────────────────────────────────

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    Boolean(VAPID_PUBLIC_KEY)
  );
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

// ─── Subscription ───────────────────────────────────────────────────────────────

export function hasCachedSubscription(): boolean {
  try {
    return Boolean(localStorage.getItem(SUB_ENDPOINT_KEY));
  } catch { return false; }
}

function cacheSub(endpoint: string | null): void {
  try {
    if (endpoint) localStorage.setItem(SUB_ENDPOINT_KEY, endpoint);
    else localStorage.removeItem(SUB_ENDPOINT_KEY);
  } catch { /* ignore */ }
}

export async function getOrCreatePushSubscription(
  topics: string[] = DEFAULT_TOPICS,
  storeId?: string
): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  // Register with our backend.
  await upsertSubscription(sub, topics, storeId);
  cacheSub(sub.endpoint);
  return sub;
}

export async function revokePushSubscription(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await deleteSubscription(endpoint);
    }
  } finally {
    cacheSub(null);
  }
}

// ─── Backend calls ───────────────────────────────────────────────────────────────

async function upsertSubscription(sub: PushSubscription, topics: string[], storeId?: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('push_subscribe_missing_session');

  const raw = sub.toJSON();
  const keys = raw.keys as { p256dh: string; auth: string } | undefined;
  if (!raw.endpoint || !keys?.p256dh || !keys?.auth) {
    throw new Error('push_subscription_incomplete');
  }

  const { error } = await supabase.functions.invoke('push-subscribe', {
    method: 'POST',
    body: {
      endpoint: raw.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: navigator.userAgent.slice(0, 255),
      platform: detectPlatform(),
      topics,
      store_id: storeId,
    },
  });

  if (error) throw error;
}

async function deleteSubscription(endpoint: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { error } = await supabase.functions.invoke('push-subscribe', {
    method: 'DELETE',
    body: { endpoint },
  });
  if (error) console.warn('[push] unsubscribe failed:', error);
}
