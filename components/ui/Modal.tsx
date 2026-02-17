import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

function maxWidthFor(size: ModalSize): string {
  switch (size) {
    case 'sm':
      return 'md:max-w-sm';
    case 'md':
      return 'md:max-w-md';
    case 'lg':
      return 'md:max-w-2xl';
    case 'xl':
      return 'md:max-w-4xl';
    default:
      return 'md:max-w-md';
  }
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  initialFocusSelector,
  closeOnBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
  initialFocusSelector?: string;
  closeOnBackdrop?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previousFocusedElement = document.activeElement as HTMLElement | null;

    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    const getFocusableElements = () => {
      const root = dialogRef.current;
      if (!root) return [] as HTMLElement[];
      return Array.from(root.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden')
      );
    };

    const focusInitialElement = () => {
      const root = dialogRef.current;
      if (!root) return;

      if (initialFocusSelector) {
        const customTarget = root.querySelector<HTMLElement>(initialFocusSelector);
        if (customTarget) {
          customTarget.focus();
          return;
        }
      }

      const firstFocusable = getFocusableElements()[0];
      if (firstFocusable) {
        firstFocusable.focus();
        return;
      }

      root.focus();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;
      const focusable = getFocusableElements();
      if (focusable.length === 0) {
        e.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (!active || active === first || !dialogRef.current?.contains(active)) {
          e.preventDefault();
          last.focus();
        }
        return;
      }

      if (!active || active === last || !dialogRef.current?.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    focusInitialElement();
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocusedElement?.focus?.();
    };
  }, [open, onClose, initialFocusSelector]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 overflow-y-auto">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-ios-fade"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-label="Fechar"
      />

      {/* Modal / Bottom Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        ref={dialogRef}
        className={`relative w-full ${maxWidthFor(size)} bg-white dark:bg-surface-dark-100 shadow-ios-xl border border-gray-200 dark:border-surface-dark-200 overflow-hidden
          rounded-t-ios-2xl md:rounded-ios-2xl
          max-h-[92vh] md:max-h-[85vh]
          flex flex-col
          animate-ios-sheet md:animate-ios-scale
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab Handle — mobile only (HIG bottom sheet pattern) */}
        <div className="md:hidden flex justify-center pt-2.5 pb-1">
          <div className="w-9 h-[5px] rounded-full bg-gray-300 dark:bg-surface-dark-300" />
        </div>

        {/* Header */}
        {(title || onClose) && (
          <div className="px-6 py-4 md:py-5 border-b border-gray-200 dark:border-surface-dark-200 bg-white dark:bg-surface-dark-100 flex justify-between items-center shrink-0">
            <h3 id={titleId} className="text-[20px] md:text-ios-title-2 font-bold text-gray-900 dark:text-white">
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-surface-dark-200 hover:bg-gray-200 dark:hover:bg-surface-dark-300 text-gray-500 dark:text-surface-dark-500 transition-colors"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content — scrollable */}
        <div className="p-6 overflow-y-auto flex-1 overscroll-contain">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="p-6 border-t border-gray-200 dark:border-surface-dark-200 bg-gray-50 dark:bg-surface-dark-200 shrink-0 safe-area-bottom">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
