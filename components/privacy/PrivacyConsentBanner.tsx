import React from 'react';
import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { useConsents } from '../../hooks/useConsents';
import { useToast } from '../ui/ToastProvider';
import { useDialogA11y } from '../../hooks/useDialogA11y';

interface PrivacyConsentBannerProps {
  userId?: string;
}

export default function PrivacyConsentBanner({ userId }: PrivacyConsentBannerProps) {
  const { needsBanner, loading, grantConsents } = useConsents(userId);
  const [accepting, setAccepting] = React.useState(false);
  const toast = useToast();
  const reducedMotion = useReducedMotion();
  const sheetRef = React.useRef<HTMLDivElement>(null);
  // Required-consent forcing function: trap focus + lock scroll, but Escape
  // must not bypass the decision.
  useDialogA11y(needsBanner, sheetRef, undefined, { closeOnEscape: false });

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await grantConsents(['privacy_accepted', 'terms_accepted']);
    } catch (error) {
      console.error('Failed to accept privacy terms', error);
      toast.error('Não foi possível registrar o aceite. Tente novamente.');
    } finally {
      setAccepting(false);
    }
  };

  // Não mostrar nada enquanto carrega
  if (loading) return null;

  return (
    <AnimatePresence>
      {needsBanner && (
        <>
          {/* Backdrop */}
          <m.div
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            aria-hidden="true"
          />
          {/* Sheet */}
          <m.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="privacy-consent-title"
            tabIndex={-1}
            initial={reducedMotion ? false : { y: '100%' }}
            animate={{ y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { y: '100%' }}
            transition={reducedMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 380, damping: 38 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl px-6 pt-6"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
          >
            {/* Handle bar */}
            <div className="mx-auto w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mb-6" />

            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <Shield className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              </div>
            </div>

            {/* Title */}
            <h2 id="privacy-consent-title" className="text-xl font-bold text-center text-gray-900 dark:text-white mb-3">
              Sua privacidade
            </h2>

            {/* Body */}
            <p className="text-sm text-center text-gray-600 dark:text-gray-300 leading-relaxed mb-2">
              Antes de continuar, confirme que leu e concorda com nossa{' '}
              <a
                href="/#/legal/privacidade"
                className="text-blue-600 dark:text-blue-400 underline underline-offset-2"
              >
                Política de Privacidade
              </a>{' '}
              e nossos{' '}
              <a
                href="/#/legal/termos"
                className="text-blue-600 dark:text-blue-400 underline underline-offset-2"
              >
                Termos de Uso
              </a>
              .
            </p>
            <p className="text-xs text-center text-gray-400 dark:text-gray-500 mb-6">
              Coletamos apenas os dados necessários para operar a plataforma. Nunca vendemos suas informações.
            </p>

            {/* CTA */}
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors text-base"
            >
              {accepting ? 'Registrando...' : 'Aceitar e continuar'}
            </button>
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
}
