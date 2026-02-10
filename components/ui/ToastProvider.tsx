import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { newId } from '../../utils/id';
import ToastViewport from './ToastViewport';

export type ToastKind = 'success' | 'error' | 'info';

export type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
  durationMs: number;
};

type ToastInput = {
  message: string;
  durationMs?: number;
};

type ToastApi = {
  success: (message: string, opts?: Omit<ToastInput, 'message'>) => void;
  error: (message: string, opts?: Omit<ToastInput, 'message'>) => void;
  info: (message: string, opts?: Omit<ToastInput, 'message'>) => void;
  dismiss: (id: string) => void;
  clear: () => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

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
        message: input.message,
        durationMs: input.durationMs ?? 3500,
      };

      setToasts((prev) => [toast, ...prev].slice(0, 4));

      const timer = window.setTimeout(() => dismiss(toast.id), toast.durationMs);
      timersRef.current.set(toast.id, timer);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, opts) => push('success', { message, ...opts }),
      error: (message, opts) => push('error', { message, ...opts }),
      info: (message, opts) => push('info', { message, ...opts }),
      dismiss,
      clear,
    }),
    [dismiss, clear, push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

