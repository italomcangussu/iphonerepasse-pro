import React, { useEffect, useMemo, useState } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { getPwaState, subscribePwa } from '../../services/pwa';
import { isCRMStandaloneHost } from '../../lib/crmRouting';
import { getPushPermissionCopy, namespacedPushKey, type PushProduct } from '../../lib/pushProduct';
import PermissionRequest from './PermissionRequest';

const DISMISSED_KEY_PREFIX = 'push.permission.prompt.dismissed.at';
const DISMISS_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const CRM_PUSH_TOPICS = ['crm_inbox', 'new_lead'];

function dismissedKey(product: PushProduct): string {
  return namespacedPushKey(DISMISSED_KEY_PREFIX, product);
}

function wasRecentlyDismissed(product: PushProduct): boolean {
  try {
    const raw = window.localStorage.getItem(dismissedKey(product));
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_WINDOW_MS;
  } catch (_) {
    return false;
  }
}

function markDismissed(product: PushProduct): void {
  try {
    window.localStorage.setItem(dismissedKey(product), String(Date.now()));
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
  const [bannerOpen, setBannerOpen] = useState(false);
  const [permissionSheetOpen, setPermissionSheetOpen] = useState(false);
  const isCrm = isCRMContext();
  const product: PushProduct = isCrm ? 'crmplus' : 'erp';
  const [dismissed, setDismissed] = useState(() => wasRecentlyDismissed(product));
  const reducedMotion = useReducedMotion();
  const online = useOnlineStatus();
  // Drop below the full-width OfflineBanner (top-0) so the two top-anchored
  // surfaces never overlap when the device is offline.
  const topOffsetClass = online
    ? 'top-[calc(env(safe-area-inset-top,0px)+0.75rem)]'
    : 'top-[calc(env(safe-area-inset-top,0px)+3rem)]';

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
    setBannerOpen(eligible);
    if (!eligible) {
      setPermissionSheetOpen(false);
    }
  }, [eligible]);

  const close = () => {
    markDismissed(product);
    setDismissed(true);
    setBannerOpen(false);
    setPermissionSheetOpen(false);
  };

  const openPermissionSheet = () => {
    setBannerOpen(false);
    setPermissionSheetOpen(true);
  };

  const handleAllow = (prefetchedPermission?: NotificationPermission) => {
    if (prefetchedPermission === 'default') {
      setPermissionSheetOpen(true);
      return;
    }

    setPermissionSheetOpen(false);
    void subscribe(isCrm ? CRM_PUSH_TOPICS : undefined, undefined, prefetchedPermission);
  };

  return (
    <>
      <AnimatePresence>
        {bannerOpen && (
        <m.section
          role="status"
          aria-label="Ativar notificações push"
          initial={reducedMotion ? false : { y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { y: -16, opacity: 0 }}
          transition={reducedMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 360, damping: 32 }}
          className={`fixed inset-x-3 ${topOffsetClass} z-[68] mx-auto max-w-md rounded-2xl border border-slate-200/80 bg-white/95 p-3 pr-2 text-slate-900 shadow-2xl shadow-slate-950/12 backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-950/95 dark:text-slate-50`}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-200">
              <Bell size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">
                {isCrm ? 'Alertas do CRM Plus' : 'Ative notificações'}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {isCrm
                  ? 'Receba alertas sobre mensagens e leads do CRM mesmo com o app fechado.'
                  : 'Receba alertas de vendas finalizadas mesmo com o app fechado.'}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={openPermissionSheet}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-brand-600 px-4 text-xs font-bold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700"
                >
                  Ativar notificações
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-full px-4 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  Agora não
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={close}
              className="hit-target-44 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Fechar banner de notificações"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        </m.section>
        )}
      </AnimatePresence>

      <PermissionRequest
        permission="notifications"
        open={permissionSheetOpen}
        status="prompt"
        {...getPushPermissionCopy(isCrm ? 'crmplus' : 'erp')}
        onAllow={handleAllow}
        onDeny={close}
      />
    </>
  );
};

export default PushPermissionPrompt;
