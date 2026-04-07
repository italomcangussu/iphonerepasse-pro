import React from 'react';
import { m, type HTMLMotionProps } from 'framer-motion';
import { iosEase } from './transitions';

interface FadeProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  /** Optional delay in seconds before fade starts. */
  delay?: number;
  /** Optional duration override in seconds. */
  duration?: number;
}

/**
 * Simple fade-in wrapper with iOS 26 default easing (200–250ms).
 * Uses `m.div` (not `motion.div`) for LazyMotion tree-shaking.
 *
 * Usage:
 *   <Fade><Card /></Fade>
 *   <Fade delay={0.1} duration={0.3}>Content</Fade>
 */
export const Fade: React.FC<FadeProps> = ({ children, delay = 0, duration, ...rest }) => {
  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ ...iosEase, delay, ...(duration ? { duration } : {}) }}
      {...rest}
    >
      {children}
    </m.div>
  );
};
