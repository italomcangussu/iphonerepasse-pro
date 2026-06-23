/**
 * useDialogA11y — shared accessibility behaviour for custom dialog/sheet
 * surfaces that don't use the full `components/ui/Modal` chrome (e.g. the
 * Apple-HIG pre-permission sheets and the privacy consent sheet).
 *
 * Mirrors the proven logic in `Modal.tsx` so every dialog in the app behaves
 * the same way, without forcing a visual redesign:
 *   - focus trap (Tab / Shift+Tab cycle inside the dialog)
 *   - Escape closes the *topmost* dialog only (LIFO stack)
 *   - body scroll lock while open
 *   - initial focus into the dialog, focus return to the trigger on close
 *
 * Usage:
 *   const ref = useRef<HTMLDivElement>(null);
 *   useDialogA11y(open, ref, onClose);
 *   <m.div ref={ref} role="dialog" aria-modal="true" tabIndex={-1} …>
 *
 * For forcing-function dialogs (consent) pass `{ closeOnEscape: false }` so the
 * focus trap + scroll lock still apply but Escape can't bypass the decision.
 */

import { useEffect, useId, useRef, type RefObject } from 'react';

interface DialogA11yOptions {
  /** CSS selector for the element to focus first; falls back to first focusable. */
  initialFocusSelector?: string;
  /** When false, Escape does not call onClose (e.g. required consent). Default true. */
  closeOnEscape?: boolean;
}

// LIFO stack of open dialog ids so a single Escape (or Tab) only affects the
// topmost dialog instead of every stacked dialog at once.
const dialogStack: string[] = [];

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useDialogA11y(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  onClose?: () => void,
  options: DialogA11yOptions = {},
): void {
  const { initialFocusSelector, closeOnEscape = true } = options;
  const id = useId();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogStack.push(id);

    const isTopmost = () => dialogStack[dialogStack.length - 1] === id;

    const getFocusable = (): HTMLElement[] => {
      const root = ref.current;
      if (!root) return [];
      const nodes = Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[];
      return nodes.filter(
        (el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'),
      );
    };

    const focusInitial = () => {
      const root = ref.current;
      if (!root) return;
      if (initialFocusSelector) {
        const custom = root.querySelector<HTMLElement>(initialFocusSelector);
        if (custom) {
          custom.focus();
          return;
        }
      }
      const first = getFocusable()[0];
      if (first) first.focus();
      else root.focus();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isTopmost()) return;

      if (e.key === 'Escape') {
        if (closeOnEscape) onCloseRef.current?.();
        return;
      }

      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      const root = ref.current;
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

    focusInitial();
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      const idx = dialogStack.lastIndexOf(id);
      if (idx !== -1) dialogStack.splice(idx, 1);
      previouslyFocused?.focus?.();
    };
  }, [open, id, initialFocusSelector, closeOnEscape, ref]);
}
