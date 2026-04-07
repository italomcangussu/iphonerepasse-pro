import React, { useEffect } from 'react';
import { m, useMotionValue, useTransform, animate, useReducedMotion } from 'framer-motion';

interface AnimatedNumberProps {
  /** Target value to animate to. */
  value: number;
  /** Optional formatter for the displayed string. Default: `value.toFixed(decimals)`. */
  format?: (n: number) => string;
  /** Decimal places used by the default formatter. Ignored if `format` is provided. */
  decimals?: number;
  /** Animation duration in seconds (default 0.6 — iOS 26 standard). */
  duration?: number;
  /** Optional className applied to the wrapping span. */
  className?: string;
}

/**
 * Smoothly transitions a number from its previous value to a new target.
 *
 * - Uses framer-motion's `animate()` with `useMotionValue` for 60fps GPU-friendly updates.
 * - Honors `prefers-reduced-motion` — instantly snaps to the final value.
 * - When `value` changes mid-animation, transitions from the current displayed
 *   value to the new target (no reset).
 *
 * Usage:
 *   <AnimatedNumber value={1234.56} format={(n) => `R$ ${n.toFixed(2)}`} />
 *   <AnimatedNumber value={42} duration={0.4} />
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  format,
  decimals = 0,
  duration = 0.6,
  className,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const motionValue = useMotionValue(value);

  const display = useTransform(motionValue, (latest) =>
    format ? format(latest) : latest.toFixed(decimals)
  );

  useEffect(() => {
    if (shouldReduceMotion) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, {
      duration,
      ease: [0.25, 0.1, 0.25, 1],
    });
    return () => controls.stop();
  }, [value, duration, motionValue, shouldReduceMotion]);

  return <m.span className={className}>{display}</m.span>;
};
