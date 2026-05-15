import React, { useEffect, useMemo, useState } from 'react';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { getPwaState, subscribePwa } from '../../services/pwa';
import { isCRMStandaloneHost } from '../../lib/crmRouting';
import PermissionRequest from './PermissionRequest';

const DISMISSED_KEY_PREFIX = 'push.permission.prompt.dismissed.at';
const DISMISS_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const CRM_PUSH_TOPICS = ['crm_inbox', 'new_lead'];

type PushPromptContext = 'app' | 'crm';

function dismissedKey(context: PushPromptContext): string {
  return `${DISMISSED_KEY_PREFIX}.${context}`;
}

function wasRecentlyDismissed(context: PushPromptContext): boolean {
  try {
    const raw = window.localStorage.getItem(dismissedKey(context));
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_WINDOW_MS;
  } catch (_) {
    return false;
  }
}

function markDismissed(context: PushPromptContext): void {
  try {
    window.localStorage.setItem(dismissedKey(context), String(Date.now()));
  } catch (_) {
    /* ignore */
  }
}

function isCRMContext(): boolean {
  if (typeof window === 'undefined') return false;
  return isCRMStandaloneHost(window.location.hostname) || window.location.hash === '#/crmplus' || window.location.hash.startsWith('#/crmplus/');
}

const PushPermissionPrompt: React.FC = () => {
  const { status, subscribe } = usePushNotifications();
  const [pwa, setPwa] = useState(getPwaState());
  const [open, setOpen] = useState(false);
  const isCrm = isCRMContext();
  const promptContext: PushPromptContext = isCrm ? 'crm' : 'app';
  const [dismissed, setDismissed] = useState(() => wasRecentlyDismissed(promptContext));

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
    markDismissed(promptContext);
    setDismissed(true);
    setOpen(false);
  };

  const handleAllow = (prefetchedPermission?: NotificationPermission) => {
    if (prefetchedPermission === 'default') {
      setOpen(true);
      return;
    }

    setOpen(false);
    void subscribe(isCrm ? CRM_PUSH_TOPICS : undefined, undefined, prefetchedPermission);
  };

  return (
    <PermissionRequest
      permission="notifications"
      open={open}
      status="prompt"
      title={isCrm ? 'Notificações Push do CRM Plus' : undefined}
      reason={isCrm ? 'Receba alertas em tempo real sobre mensagens e leads do CRM, mesmo com o app fechado. Você pode desativar a qualquer momento.' : undefined}
      onAllow={handleAllow}
      onDeny={close}
    />
  );
};

export default PushPermissionPrompt;
