/**
 * PermissionRequest — pre-permission sheet (Apple HIG compliant).
 *
 * Always shown BEFORE triggering any system permission dialog so the user
 * understands WHY the app needs access. This is required by Apple HIG:
 * "Provide a brief, clear description of the reason your app needs access
 *  to the user's data or capabilities."
 *
 * Usage:
 *   <PermissionRequest
 *     permission="microphone"
 *     open={showMicPrompt}
 *     onAllow={handleAllow}
 *     onDeny={() => setShowMicPrompt(false)}
 *   />
 */

import React, { useRef } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Bell, Camera, Mic, Settings as SettingsIcon, X } from 'lucide-react';
import type { PermissionStatusValue } from '../../hooks/usePermissionState';
import { useDialogA11y } from '../../hooks/useDialogA11y';

type PermissionKind = 'microphone' | 'camera' | 'photos' | 'notifications';

interface PermissionMeta {
  icon: React.ReactNode;
  title: string;
  reason: string;
  allowLabel: string;
  deniedMessage: string;
  deniedSub: string;
}

const META: Record<PermissionKind, PermissionMeta> = {
  microphone: {
    icon: <Mic size={26} />,
    title: 'Acesso ao Microfone',
    reason:
      'Para gravar mensagens de voz, o iPhoneRepasse Pro precisa acessar o microfone deste dispositivo. O áudio é enviado diretamente para o contato selecionado — nunca armazenado sem sua ação.',
    allowLabel: 'Ativar microfone',
    deniedMessage: 'Microfone bloqueado',
    deniedSub:
      'Para habilitar, vá em Ajustes > Safari > Microfone e conceda acesso ao iPhoneRepasse Pro.',
  },
  camera: {
    icon: <Camera size={26} />,
    title: 'Abrir câmera',
    reason:
      'O seletor do sistema abrirá a câmera para fotografar o aparelho. Somente a foto que você confirmar será adicionada ao estoque.',
    allowLabel: 'Abrir câmera',
    deniedMessage: 'Não foi possível abrir a câmera',
    deniedSub:
      'Verifique as permissões do site nos Ajustes do Safari ou use a opção de escolher uma foto existente.',
  },
  photos: {
    icon: <Camera size={26} />,
    title: 'Escolher fotos e vídeos',
    reason:
      'O seletor do sistema será aberto. Somente as fotos e vídeos que você escolher serão compartilhados com o app.',
    allowLabel: 'Escolher fotos e vídeos',
    deniedMessage: 'Não foi possível abrir o seletor',
    deniedSub:
      'Tente novamente ou verifique as configurações do navegador e do dispositivo.',
  },
  notifications: {
    icon: <Bell size={26} />,
    title: 'Notificações Push',
    reason:
      'Receba alertas em tempo real sobre novas mensagens no CRM, leads capturados e vendas finalizadas — mesmo com o app fechado. Você pode desativar a qualquer momento.',
    allowLabel: 'Continuar',
    deniedMessage: 'Notificações bloqueadas',
    deniedSub:
      'Para reativar, vá em Ajustes > Notificações > iPhoneRepasse Pro e ative os alertas.',
  },
};

interface Props {
  permission: PermissionKind;
  open: boolean;
  /** Current permission status — shows denied guidance when 'denied'. */
  status?: PermissionStatusValue;
  title?: string;
  reason?: string;
  deniedMessage?: string;
  deniedSub?: string;
  allowLabel?: string;
  onAllow: (result?: NotificationPermission) => void;
  onDeny: () => void;
}

const PermissionRequest: React.FC<Props> = ({
  permission,
  open,
  status = 'prompt',
  title,
  reason,
  deniedMessage,
  deniedSub,
  allowLabel,
  onAllow,
  onDeny,
}) => {
  const meta = META[permission];
  const isDenied = status === 'denied';
  const resolvedTitle = isDenied ? deniedMessage ?? meta.deniedMessage : title ?? meta.title;
  const resolvedReason = isDenied ? deniedSub ?? meta.deniedSub : reason ?? meta.reason;
  const reducedMotion = useReducedMotion();
  const sheetRef = useRef<HTMLDivElement>(null);
  useDialogA11y(open, sheetRef, onDeny);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <m.div
            className="fixed inset-0 z-[70] bg-slate-950/40 backdrop-blur-[2px]"
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onDeny}
            aria-hidden="true"
          />

          {/* Sheet */}
          <m.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="perm-req-title"
            tabIndex={-1}
            className="fixed inset-x-0 z-[71] mx-auto max-w-md rounded-t-2xl border border-slate-200 bg-white px-5 pb-2 pt-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950 sm:rounded-2xl"
            style={{ bottom: 0, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}
            initial={reducedMotion ? false : { y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { y: 80, opacity: 0 }}
            transition={reducedMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 340, damping: 32 }}
          >
            {/* Close */}
            <button
              type="button"
              onClick={onDeny}
              className="crm-mobile-close-action hit-target-44 absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Fechar"
            >
              <X size={16} />
            </button>

            {/* Icon */}
            <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl shadow-md ${
              isDenied
                ? 'bg-red-100 text-red-600 shadow-red-200/50 dark:bg-red-950 dark:text-red-300 dark:shadow-red-900/30'
                : 'bg-brand-100 text-brand-600 shadow-brand-200/50 dark:bg-brand-950 dark:text-brand-300 dark:shadow-brand-900/30'
            }`}>
              {meta.icon}
            </div>

            {/* Copy */}
            <h3 id="perm-req-title" className="text-base font-bold text-slate-900 dark:text-slate-50">
              {resolvedTitle}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {resolvedReason}
            </p>

            {/* CTA */}
            <div className="mt-5 space-y-2">
              {isDenied ? (
                <button
                  type="button"
                  onClick={() => {
                    // On iOS, the only way to change a denied permission is Settings app.
                    // We can try to open Settings via a custom URL scheme (works in native, not
                    // reliable in Safari PWA — so we just close and show instructions).
                    onDeny();
                  }}
                  className="crm-mobile-sheet-action inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 active:scale-[0.99] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                >
                  <SettingsIcon size={15} /> Entendido
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    if (permission === 'notifications' && 'Notification' in window && Notification.permission === 'default') {
                      try {
                        const result = await Notification.requestPermission();
                        onAllow(result);
                      } catch (err) {
                        console.error('[push] native request failed:', err);
                        onAllow();
                      }
                    } else {
                      onAllow();
                    }
                  }}
                  className="crm-mobile-sheet-action inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 active:scale-[0.99]"
                >
                  {allowLabel ?? meta.allowLabel}
                </button>
              )}
              <button
                type="button"
                onClick={onDeny}
                className="crm-mobile-sheet-action w-full py-1 text-center text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                {isDenied ? 'Fechar' : 'Agora não'}
              </button>
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PermissionRequest;
