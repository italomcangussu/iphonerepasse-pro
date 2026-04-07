import React from 'react';
import { m, type HTMLMotionProps } from 'framer-motion';
import { iosSpring } from './transitions';

interface ScaleProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  /** Initial scale (default 0.95 — iOS 26 standard). */
  from?: number;
  /** Optional delay in seconds. */
  delay?: number;
}

/**
 * Scale + fade in. iOS 26 modal-style entry.
 * Uses `m.div` for LazyMotion tree-shaking.
 *
 * Usage:
 *   <Scale><Dialog /></Scale>
 *   <Scale from={0.92} delay={0.05}>Card</Scale>
 */
export const Scale: React.FC<ScaleProps> = ({ children, from = 0.95, delay = 0, ...rest }) => {
  return (
    <m.div
      initial={{ scale: from, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: from, opacity: 0 }}
      transition={{ ...iosSpring, delay }}
      {...rest}
    >
      {children}
    </m.div>
  );
};
