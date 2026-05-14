import React, { useEffect, useMemo, useState } from 'react';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { getPwaState, subscribePwa } from '../../services/pwa';
import PermissionRequest from './PermissionRequest';

const DISMISSED_KEY = 'push.permission.prompt.dismissed.at';
const DISMISS_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function wasRecentlyDismissed(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_WINDOW_MS;
  } catch (_) {
    return false;
  }
}

function markDismissed(): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch (_) {
    /* ignore */
  }
}

const PushPermissionPrompt: React.FC = () => {
  const { status, subscribe } = usePushNotifications();
  const [pwa, setPwa] = useState(getPwaState());
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => wasRecentlyDismissed());

  useEffect(() => {
    const unsubscribe = subscribePwa(() => setPwa({ ...getPwaState() }));
    setPwa({ ...getPwaState() });
    return unsubscribe;
  }, []);

  const eligible = useMemo(() => (
    pwa.ready &&
    pwa.isStandalone &&
    !dismissed &&
    (status === 'default' || status === 'error')
  ), [dismissed, pwa.isStandalone, pwa.ready, status]);

  useEffect(() => {
    setOpen(eligible);
  }, [eligible]);

  const close = () => {
    markDismissed();
    setDismissed(true);
    setOpen(false);
  };

  const handleAllow = (prefetchedPermission?: NotificationPermission) => {
    setOpen(false);
    void subscribe(undefined, undefined, prefetchedPermission);
  };

  return (
    <PermissionRequest
      permission="notifications"
      open={open}
      status="prompt"
      onAllow={handleAllow}
      onDeny={close}
    />
  );
};

export default PushPermissionPrompt;
