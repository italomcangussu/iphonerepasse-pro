import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { newId } from '../../utils/id';
import ToastViewport from './ToastViewport';
import ConfirmDialog, { ConfirmVariant } from './ConfirmDialog';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export type ToastAction = {
  label: string;
  onClick: () => void;
  dismissOnClick?: boolean;
};

export type Toast = {
  id: string;
  kind: ToastKind;
  title?: string;
  message: string;
  durationMs: number;
  action?: ToastAction;
};

type ToastInput = {
  title?: string;
  message: string;
  durationMs?: number;
  action?: ToastAction;
};

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
};

type FeedbackApi = {
  success: (message: string, opts?: Omit<ToastInput, 'message'>) => void;
  error: (message: string, opts?: Omit<ToastInput, 'message'>) => void;
  info: (message: string, opts?: Omit<ToastInput, 'message'>) => void;
  warning: (message: string, opts?: Omit<ToastInput, 'message'>) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  dismiss: (id: string) => void;
  clear: () => void;
};

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  // Confirmation state
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const dismiss = useCallback((id: string) => {
    const t = timersRef.current.get(id);
    if (t) {
      window.clearTimeout(t);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const clear = useCallback(() => {
    for (const id of timersRef.current.keys()) dismiss(id);
    timersRef.current.clear();
    setToasts([]);
  }, [dismiss]);

  const push = useCallback(
    (kind: ToastKind, input: ToastInput) => {
      const toast: Toast = {
        id: newId('toast'),
        kind,
        title: input.title,
        message: input.message,
        durationMs: input.durationMs ?? 3500,
        action: input.action,
      };

      setToasts((prev) => [toast, ...prev].slice(0, 4));

      const timer = window.setTimeout(() => dismiss(toast.id), toast.durationMs);
      timersRef.current.set(toast.id, timer);
    },
    [dismiss]
  );

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        open: true,
        options: opts,
        resolve,
      });
    });
  }, []);

  const handleConfirmClose = useCallback((value: boolean) => {
    if (confirmState) {
      confirmState.resolve(value);
      setConfirmState(null);
    }
  }, [confirmState]);

  const api = useMemo<FeedbackApi>(
    () => ({
      success: (message, opts) => push('success', { message, ...opts }),
      error: (message, opts) => push('error', { message, ...opts }),
      info: (message, opts) => push('info', { message, ...opts }),
      warning: (message, opts) => push('warning', { message, ...opts }),
      confirm,
      dismiss,
      clear,
    }),
    [dismiss, clear, push, confirm]
  );

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      {confirmState && (
        <ConfirmDialog
          open={confirmState.open}
          onClose={() => handleConfirmClose(false)}
          onConfirm={() => handleConfirmClose(true)}
          title={confirmState.options.title}
          description={confirmState.options.description}
          confirmLabel={confirmState.options.confirmLabel}
          cancelLabel={confirmState.options.cancelLabel}
          variant={confirmState.options.variant}
        />
      )}
    </FeedbackContext.Provider>
  );
}

// Aliases for backward compatibility
export const ToastProvider = FeedbackProvider;

export function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used within a FeedbackProvider');
  return ctx;
}

export function useToast(): FeedbackApi {
  return useFeedback();
}
