import React from 'react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { iosFastEase, iosSpring } from '../motion/transitions';

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost';

export type IOSButtonProps = {
  variant?: Variant;
  loading?: boolean;
  success?: boolean;
  /** Icon on the left side of the label (hidden during loading/success). */
  leftIcon?: React.ReactNode;
  /** Hide label + swap icon during loading/success. */
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

function baseClassFor(variant: Variant): string {
  switch (variant) {
    case 'primary':
      return 'ios-button-primary';
    case 'secondary':
      return 'ios-button-secondary';
    case 'destructive':
      return 'ios-button-destructive';
    case 'ghost':
      return 'ios-button';
    default:
      return 'ios-button-primary';
  }
}

/**
 * iOS 26 button with tactile press, loading spinner, and success check-in.
 *
 * States:
 *   - idle  → label + optional leftIcon
 *   - loading → rotating Loader2 (label cross-fades out)
 *   - success → green Check with spring scale-in
 *
 * Motion: scale 0.96 on tap (respects prefers-reduced-motion).
 */
export default function IOSButton({
  variant = 'primary',
  loading = false,
  success = false,
  leftIcon,
  children,
  className = '',
  disabled,
  ...rest
}: IOSButtonProps) {
  const reducedMotion = useReducedMotion();
  const base = baseClassFor(variant);
  const isBusy = loading || success;

  return (
    <m.button
      whileTap={reducedMotion || disabled || isBusy ? undefined : { scale: 0.96 }}
      transition={iosFastEase}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-state={loading ? 'loading' : success ? 'success' : 'idle'}
      className={`${base} ${className} relative overflow-hidden`}
      {...rest}
    >
      {/* Left icon — cross-fades out when loading/success */}
      {leftIcon && (
        <AnimatePresence initial={false}>
          {!isBusy && (
            <m.span
              key="left-icon"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={iosFastEase}
              className="inline-flex items-center"
            >
              {leftIcon}
            </m.span>
          )}
        </AnimatePresence>
      )}

      {/* Label / state swap */}
      <span className="relative inline-flex items-center justify-center min-w-[1ch]">
        <AnimatePresence mode="wait" initial={false}>
          {loading && (
            <m.span
              key="loading"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={iosFastEase}
              className="inline-flex items-center gap-2"
              aria-live="polite"
            >
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Processando…</span>
            </m.span>
          )}
          {!loading && success && (
            <m.span
              key="success"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={iosSpring}
              className="inline-flex items-center gap-2"
              aria-live="polite"
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              <span>Pronto</span>
            </m.span>
          )}
          {!loading && !success && (
            <m.span
              key="idle"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={iosFastEase}
              className="inline-flex items-center gap-2"
            >
              {children}
            </m.span>
          )}
        </AnimatePresence>
      </span>
    </m.button>
  );
}
