import React from 'react';
import { m, type HTMLMotionProps } from 'framer-motion';
import { iosSpring } from './transitions';

interface SlideUpProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  /** Initial Y offset in px (default 16). */
  offset?: number;
  /** Optional delay in seconds. */
  delay?: number;
}

/**
 * Slide up + fade in. iOS 26 spring physics by default.
 * Uses `m.div` for LazyMotion tree-shaking.
 *
 * Usage:
 *   <SlideUp><Card /></SlideUp>
 *   <SlideUp offset={24} delay={0.1}>Hero</SlideUp>
 */
export const SlideUp: React.FC<SlideUpProps> = ({ children, offset = 16, delay = 0, ...rest }) => {
  return (
    <m.div
      initial={{ y: offset, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: offset, opacity: 0 }}
      transition={{ ...iosSpring, delay }}
      {...rest}
    >
      {children}
    </m.div>
  );
};
