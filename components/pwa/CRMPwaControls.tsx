import React, { useEffect, useMemo, useState } from "react";
import { Bell, BellOff, BellRing, Download, Plus, Share, X } from "lucide-react";
import { getPwaState, promptInstall, subscribePwa } from "../../services/pwa";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import PermissionRequest from "./PermissionRequest";

const CRM_PUSH_TOPICS = ["crm_inbox", "new_lead"];

const CRMPwaControls: React.FC = () => {
  const { status, subscribe, unsubscribe } = usePushNotifications();
  const [pwaSnapshot, setPwaSnapshot] = useState(getPwaState());
  const [installSheetOpen, setInstallSheetOpen] = useState(false);
  const [permissionSheetOpen, setPermissionSheetOpen] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("crm_pwa_banner_dismissed") === "true";
    }
    return false;
  });

  const handleDismissBanner = () => {
    setIsBannerDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("crm_pwa_banner_dismissed", "true");
    }
  };

  useEffect(() => {
    const unsubscribePwa = subscribePwa(() => setPwaSnapshot({ ...getPwaState() }));
    setPwaSnapshot({ ...getPwaState() });
    return unsubscribePwa;
  }, []);

  const canInstall = useMemo(
    () => pwaSnapshot.ready && !pwaSnapshot.isStandalone && (pwaSnapshot.isIOS || Boolean(pwaSnapshot.installPromptEvent)),
    [pwaSnapshot],
  );
  const isPushPending = status === "requesting" || status === "subscribing";
  const isPushSubscribed = status === "subscribed";
  const canAskPush = status === "default" || status === "error";
  const showPush = status !== "unsupported";
  const showActivationBanner = pwaSnapshot.ready && pwaSnapshot.isStandalone && canAskPush && !isBannerDismissed;

  const handleInstall = async () => {
    if (pwaSnapshot.isIOS) {
      setInstallSheetOpen(true);
      return;
    }

    await promptInstall();
    setPwaSnapshot({ ...getPwaState() });
  };

  const handlePushClick = () => {
    if (isPushSubscribed) {
      void unsubscribe();
      return;
    }

    if (status === "needs_install") {
      setInstallSheetOpen(true);
      return;
    }

    if (canAskPush || status === "denied") {
      setPermissionSheetOpen(true);
    }
  };

  const handleAllowPush = (prefetchedPermission?: NotificationPermission) => {
    setPermissionSheetOpen(false);
    if (canAskPush) {
      void subscribe(CRM_PUSH_TOPICS, undefined, prefetchedPermission);
    }
  };

  if (!canInstall && !showPush) return null;

  return (
    <>
      <div className="crm-pwa-stack">
        <div className="crm-pwa-controls" aria-label="Controles PWA do CRM">
          {canInstall && (
            <button
              type="button"
              className="crm-icon-btn crm-pwa-action"
              onClick={() => void handleInstall()}
              title="Instalar CRM Plus"
              aria-label="Instalar CRM Plus"
            >
              <Download size={16} />
              <span>Instalar</span>
            </button>
          )}

          {showPush && (
            <button
              type="button"
              className={`crm-icon-btn crm-pwa-action ${isPushSubscribed ? "is-active" : ""}`}
              onClick={handlePushClick}
              disabled={isPushPending}
              title={
                status === "needs_install"
                  ? "Instale na Tela de Início para ativar notificações"
                  : isPushSubscribed
                    ? "Desativar notificações CRM"
                    : "Ativar notificações CRM"
              }
              aria-label={
                status === "needs_install"
                  ? "Instalar CRM Plus antes de ativar notificações"
                  : isPushSubscribed
                    ? "Desativar notificações CRM"
                    : "Abrir controle de notificações CRM"
              }
            >
              {isPushSubscribed ? (
                <BellRing size={16} />
              ) : status === "denied" ? (
                <BellOff size={16} />
              ) : (
                <Bell size={16} />
              )}
              <span>{isPushSubscribed ? "Push ativo" : status === "needs_install" ? "Instale para push" : "Push CRM"}</span>
            </button>
          )}
        </div>

        {showActivationBanner && (
          <div className="crm-push-activation flex items-center justify-between" role="status" aria-label="Ativar notificações CRM">
            <div className="flex items-center gap-2">
              <Bell size={15} aria-hidden="true" />
              <span>Ative notificações para receber novas mensagens.</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPermissionSheetOpen(true)}
                disabled={isPushPending}
                aria-label="Ativar notificações CRM"
              >
                Ativar
              </button>
              <button
                type="button"
                onClick={handleDismissBanner}
                className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 bg-transparent p-0"
                aria-label="Dispensar banner"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {installSheetOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[65] bg-slate-950/35 backdrop-blur-[2px]"
            aria-label="Fechar instalação do CRM"
            onClick={() => setInstallSheetOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="crm-pwa-install-title"
            className="fixed inset-x-0 bottom-0 z-[66] mx-auto max-w-md rounded-t-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950 sm:bottom-6 sm:rounded-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
          >
            <button
              type="button"
              onClick={() => setInstallSheetOpen(false)}
              className="crm-mobile-close-action absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Fechar"
            >
              <X size={16} />
            </button>
            <div className="flex items-start gap-3 pr-8">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                <Download size={20} />
              </div>
              <div>
                <h3 id="crm-pwa-install-title" className="text-base font-bold text-slate-900 dark:text-slate-50">
                  Instalar CRM Plus
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  No iPhone, notificações do CRM funcionam somente quando o CRM Plus é aberto pela Tela de Início.
                </p>
                <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">
                      <Share size={13} />
                    </span>
                    <p>Toque em Compartilhar na barra do Safari.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">
                      <Plus size={13} />
                    </span>
                    <p>Escolha Adicionar à Tela de Início e confirme.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <PermissionRequest
        permission="notifications"
        open={permissionSheetOpen}
        status={status === "denied" ? "denied" : "prompt"}
        onAllow={handleAllowPush}
        onDeny={() => setPermissionSheetOpen(false)}
      />
    </>
  );
};

export default CRMPwaControls;
