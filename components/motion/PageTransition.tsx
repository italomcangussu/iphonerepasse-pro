import React from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { iosEase } from './transitions';

interface PageTransitionProps {
  children: React.ReactNode;
}

/**
 * Wraps page content with a crossfade + subtle slide on route change.
 *
 * Uses `useLocation().pathname` as the AnimatePresence key so each route
 * fade-out before the next fades in (`mode="wait"`).
 *
 * iOS 26 motion: 200ms fade + 8px slide. Reduced motion: framer-motion
 * automatically respects via the global <MotionConfig reducedMotion="user">
 * configured in [index.tsx](../../index.tsx).
 *
 * Usage (in Layout.tsx):
 *   <main>
 *     <PageTransition>{children}</PageTransition>
 *   </main>
 */
export const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ ...iosEase, duration: 0.2 }}
        style={{ willChange: 'transform, opacity' }}
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
};
