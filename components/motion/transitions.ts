/**
 * iOS 26 motion presets — durations & easings aligned to Apple HIG iOS 26.
 *
 * Reference: WWDC25 / iOS 26 Motion HIG.
 *  - Quick interactions (toggles, micro-feedback): < 200ms
 *  - Standard interactions: 200–350ms
 *  - Page / modal transitions: 300–500ms
 *  - Spring physics for entries that need natural inertia
 */

import type { Transition } from 'framer-motion';

/** Default spring for modals, sheets, dialogs. Crisp but settled. */
export const iosSpring: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 30,
  mass: 1,
};

/** Stiffer spring for bottom sheets and full-screen overlays. */
export const iosSheetSpring: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 32,
  mass: 1,
};

/** Snappy spring for layout animations (pill indicators, drag handles). */
export const iosSnappySpring: Transition = {
  type: 'spring',
  stiffness: 480,
  damping: 34,
  mass: 0.9,
};

/** Default ease curve from Apple HIG (≈ cubic-bezier(0.25, 0.1, 0.25, 1)). */
export const iosEase: Transition = {
  type: 'tween',
  ease: [0.25, 0.1, 0.25, 1],
  duration: 0.25,
};

/** Quick ease for toggles, hover, micro-feedback. */
export const iosFastEase: Transition = {
  type: 'tween',
  ease: [0.32, 0.72, 0, 1],
  duration: 0.18,
};

/** Slow emphasized ease for page transitions and large element entries. */
export const iosSlowEase: Transition = {
  type: 'tween',
  ease: [0.2, 0, 0, 1],
  duration: 0.45,
};

/** Stagger preset: how much delay between sequential children. */
export const iosStagger = {
  /** Small lists (≤ 8 items). */
  tight: 0.03,
  /** Default for cards and rows. */
  default: 0.05,
  /** Larger gap for emphasis (hero entries). */
  loose: 0.08,
};
