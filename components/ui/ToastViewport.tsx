import React from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import type { Toast } from './ToastProvider';
import { iosSnappySpring } from '../motion/transitions';

function iconFor(kind: Toast['kind']) {
  switch (kind) {
    case 'success':
      return <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />;
    case 'error':
      return <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
    case 'info':
    default:
      return <Info className="w-5 h-5 text-brand-600 dark:text-brand-300" />;
  }
}

function chromeFor(kind: Toast['kind']) {
  switch (kind) {
    case 'success':
      return 'border-green-200/70 dark:border-green-900/40';
    case 'error':
      return 'border-red-200/70 dark:border-red-900/40';
    case 'info':
    default:
      return 'border-gray-200/70 dark:border-surface-dark-200';
  }
}

export default function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  const reducedMotion = useReducedMotion();

  const handleActionClick = (toast: Toast) => {
    if (!toast.action) return;
    toast.action.onClick();
    if (toast.action.dismissOnClick !== false) {
      onDismiss(toast.id);
    }
  };

  return (
    <div className="fixed z-[60] top-4 right-4 bottom-auto left-auto sm:bottom-auto max-sm:top-auto max-sm:bottom-4 max-sm:left-4 max-sm:right-4 flex flex-col gap-3 pointer-events-none">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <m.div
            key={t.id}
            role="status"
            data-testid={`toast-${t.kind}`}
            layout
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.94, transition: { duration: 0.18, ease: [0.32, 0.72, 0, 1] } }}
            transition={iosSnappySpring}
            // Swipe to dismiss — drag horizontally; release past 80px or velocity > 500.
            drag={reducedMotion ? false : 'x'}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.4, right: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.x > 80 || info.velocity.x > 500) {
                onDismiss(t.id);
              }
            }}
            className={`pointer-events-auto liquid-glass w-full sm:w-[360px] max-w-[calc(100vw-2rem)] rounded-ios-2xl border ${chromeFor(
              t.kind
            )} shadow-ios26-lg cursor-grab active:cursor-grabbing will-change-transform`}
          >
            <div className="p-4 flex gap-3 items-start">
              <div className="mt-0.5">{iconFor(t.kind)}</div>
              <div className="flex-1">
                <p className="text-ios-subhead font-medium text-gray-900 dark:text-white leading-snug">{t.message}</p>
                {t.action && (
                  <button
                    type="button"
                    onClick={() => handleActionClick(t)}
                    className="mt-2 text-sm font-semibold text-brand-600 dark:text-brand-300 hover:underline"
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(t.id)}
                className="p-1 rounded-ios hover:bg-gray-100 dark:hover:bg-surface-dark-200 text-gray-500 dark:text-surface-dark-600 transition-colors"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
