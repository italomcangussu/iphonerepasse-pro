/**
 * usePermissionState — observes the live state of a browser permission.
 *
 * Returns: 'granted' | 'denied' | 'prompt' | 'unsupported'
 *
 * 'prompt'      — not yet asked; showing the system dialog is safe.
 * 'granted'     — already authorised; call the API directly, no dialog.
 * 'denied'      — user blocked; guide them to device Settings.
 * 'unsupported' — browser / OS does not support this permission (e.g.
 *                 notifications outside a PWA on iOS <16.4).
 *
 * The state is reactive: it updates when the user changes permissions in
 * device Settings while the tab is open.
 *
 * Supported names: 'microphone' | 'camera' | 'notifications'
 */

import { useEffect, useState } from 'react';

export type PermissionStatusValue = 'granted' | 'denied' | 'prompt' | 'unsupported';

type SupportedPermission = 'microphone' | 'camera' | 'notifications';

function getInitialState(name: SupportedPermission): PermissionStatusValue {
  if (typeof window === 'undefined') return 'unsupported';

  if (name === 'notifications') {
    if (!('Notification' in window)) return 'unsupported';
    const p = Notification.permission;
    if (p === 'granted') return 'granted';
    if (p === 'denied') return 'denied';
    return 'prompt';
  }

  // For camera/microphone we rely on the Permissions API below.
  if (!('permissions' in navigator)) return 'prompt'; // assume promptable
  return 'prompt';
}

export function usePermissionState(name: SupportedPermission): PermissionStatusValue {
  const [state, setState] = useState<PermissionStatusValue>(() => getInitialState(name));

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (name === 'notifications') {
      // Notifications permission is synchronously readable.
      if (!('Notification' in window)) { setState('unsupported'); return; }

      const read = () => {
        const p = Notification.permission;
        setState(p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'prompt');
      };
      read();

      // The Permissions API can observe notification changes.
      if (!('permissions' in navigator)) return;
      navigator.permissions.query({ name: 'notifications' }).then((status) => {
        read();
        status.addEventListener('change', read);
        return () => status.removeEventListener('change', read);
      }).catch(() => { /* Firefox/iOS may deny this query */ });
      return;
    }

    if (!('permissions' in navigator)) {
      // Permissions API unavailable — assume promptable (getUserMedia will ask).
      setState('prompt');
      return;
    }

    const permName = name as PermissionName;
    let permStatus: PermissionStatus | null = null;

    navigator.permissions.query({ name: permName }).then((status) => {
      permStatus = status;
      setState(status.state as PermissionStatusValue);
      status.addEventListener('change', () => {
        setState(status.state as PermissionStatusValue);
      });
    }).catch(() => {
      // Some browsers throw for camera/microphone queries — treat as promptable.
      setState('prompt');
    });

    return () => {
      if (permStatus) {
        permStatus.onchange = null;
      }
    };
  }, [name]);

  return state;
}
