// Shared toast types — extracted so ToastViewport can consume them without
// importing back from ToastProvider (breaks the ToastProvider ↔ ToastViewport
// import cycle; Clean Architecture: dependencies must be acyclic).

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
