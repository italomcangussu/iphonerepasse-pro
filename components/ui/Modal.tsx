import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { AnimatePresence, m, useDragControls, useReducedMotion } from 'framer-motion';
import { iosSheetSpring, iosSpring } from '../motion/transitions';

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

/**
 * Hook: detects mobile viewport via matchMedia. Used to conditionally
 * enable drag-to-dismiss (bottom sheet gesture) only on touch-first mobile.
 */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(max-width: 767px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    // Safari < 14 fallback
    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, []);

  return isMobile;
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
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const isMobile = useIsMobile();
  const reducedMotion = useReducedMotion();
  const dragControls = useDragControls();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

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

    const getFocusableElements = (): HTMLElement[] => {
      const root = dialogRef.current as HTMLDivElement | null;
      if (!root) return [];
      return Array.from(root.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden')
      );
    };

    const focusInitialElement = () => {
      const root = dialogRef.current as HTMLDivElement | null;
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
        onCloseRef.current();
        return;
      }

      if (e.key !== 'Tab') return;
      const focusable = getFocusableElements();
      const root = dialogRef.current as HTMLDivElement | null;
      if (focusable.length === 0) {
        e.preventDefault();
        root?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (!active || active === first || !root?.contains(active)) {
          e.preventDefault();
          last.focus();
        }
        return;
      }

      if (!active || active === last || !root?.contains(active)) {
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
  }, [open, initialFocusSelector]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Mobile bottom-sheet entry: slide up from below.
  // Desktop centered card: scale + fade.
  const dialogVariants = isMobile
    ? {
        initial: { y: '100%', opacity: 1 },
        animate: { y: 0, opacity: 1, transition: iosSheetSpring },
        exit: { y: '100%', opacity: 1, transition: { type: 'tween', ease: [0.32, 0.72, 0, 1], duration: 0.25 } },
      }
    : {
        initial: { scale: 0.95, opacity: 0 },
        animate: { scale: 1, opacity: 1, transition: iosSpring },
        exit: { scale: 0.96, opacity: 0, transition: { type: 'tween', ease: [0.4, 0, 1, 1], duration: 0.18 } },
      };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 overflow-y-auto">
          {/* Backdrop — Liquid Glass + fade */}
          <m.button
            type="button"
            className="absolute inset-0 liquid-glass-strong"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            onClick={closeOnBackdrop ? onClose : undefined}
            aria-label="Fechar"
          />

          {/* Modal / Bottom Sheet */}
          <m.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            ref={dialogRef}
            data-testid="modal-dialog"
            className={`relative w-full ${maxWidthFor(size)} bg-white dark:bg-surface-dark-100 shadow-ios26-lg border border-gray-200/70 dark:border-surface-dark-200 overflow-hidden
              rounded-t-ios-2xl md:rounded-ios-2xl
              max-h-[92vh] md:max-h-[85vh]
              flex flex-col
              will-change-transform
            `}
            variants={dialogVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            // Drag-to-dismiss: only on mobile, only activated from the grab handle
            drag={isMobile && !reducedMotion ? 'y' : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.velocity.y > 500 || info.offset.y > 100) {
                onClose();
              }
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab Handle — mobile only, activates drag on pointer-down */}
            <div
              className="md:hidden flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing touch-none"
              data-testid="modal-grab-handle"
              onPointerDown={(e) => {
                if (isMobile && !reducedMotion) {
                  dragControls.start(e);
                }
              }}
            >
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
          </m.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
