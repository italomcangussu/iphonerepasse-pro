import React from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type { Toast } from './ToastProvider';

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
      return 'border-green-200 dark:border-green-900/40';
    case 'error':
      return 'border-red-200 dark:border-red-900/40';
    case 'info':
    default:
      return 'border-gray-200 dark:border-surface-dark-200';
  }
}

export default function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  const handleActionClick = (toast: Toast) => {
    if (!toast.action) return;
    toast.action.onClick();
    if (toast.action.dismissOnClick !== false) {
      onDismiss(toast.id);
    }
  };

  return (
    <div className="fixed z-[60] top-4 right-4 bottom-auto left-auto sm:bottom-auto max-sm:top-auto max-sm:bottom-4 max-sm:left-4 max-sm:right-4 flex flex-col gap-3 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto animate-ios-slide-up w-full sm:w-[360px] max-w-[calc(100vw-2rem)] rounded-ios-2xl border ${chromeFor(
            t.kind
          )} bg-white/90 dark:bg-surface-dark-100/90 backdrop-blur shadow-ios-lg`}
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
              className="p-1 rounded-ios hover:bg-gray-100 dark:hover:bg-surface-dark-200 text-gray-500 dark:text-surface-dark-600"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
