/**
 * iOS 26 motion primitives — central export.
 *
 * Reduced motion is honored automatically via <MotionConfig reducedMotion="user">
 * configured globally in App.tsx (US-023).
 *
 * Examples:
 *
 *   // Simple fade
 *   <Fade><Card /></Fade>
 *
 *   // Stagger children entry
 *   <Stagger>
 *     {items.map(i => <Stagger.Item key={i.id}>{i.label}</Stagger.Item>)}
 *   </Stagger>
 *
 *   // Animated currency count-up
 *   <AnimatedNumber value={total} format={(n) => `R$ ${n.toFixed(2)}`} />
 */

export { Fade } from './Fade';
export { SlideUp } from './SlideUp';
export { Scale } from './Scale';
export { Stagger } from './Stagger';
export { AnimatedNumber } from './AnimatedNumber';
export { PageTransition } from './PageTransition';
export { SaleCelebration } from './SaleCelebration';

export {
  iosSpring,
  iosSheetSpring,
  iosSnappySpring,
  iosEase,
  iosFastEase,
  iosSlowEase,
  iosStagger,
} from './transitions';
