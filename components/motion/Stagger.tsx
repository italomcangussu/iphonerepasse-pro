import React from 'react';
import { m, type Variants } from 'framer-motion';
import { iosSpring, iosStagger } from './transitions';

interface StaggerProps {
  children: React.ReactNode;
  /** Stagger delay between children in seconds (default 0.05). */
  delay?: number;
  /** Initial Y offset for each child in px (default 12). */
  offset?: number;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}

const containerVariants: Variants = {
  hidden: { opacity: 1 },
  show: (delay: number) => ({
    opacity: 1,
    transition: {
      staggerChildren: delay,
      delayChildren: 0.02,
    },
  }),
};

const itemVariants = (offset: number): Variants => ({
  hidden: { opacity: 0, y: offset },
  show: {
    opacity: 1,
    y: 0,
    transition: iosSpring,
  },
});

/**
 * Animates children sequentially with iOS 26 stagger pattern (50ms default).
 * Each direct child should be a `<Stagger.Item>` to inherit the variants.
 *
 * Usage:
 *   <Stagger>
 *     <Stagger.Item>Card 1</Stagger.Item>
 *     <Stagger.Item>Card 2</Stagger.Item>
 *   </Stagger>
 */
const StaggerRoot: React.FC<StaggerProps> & { Item: typeof StaggerItem } = ({
  children,
  delay = iosStagger.default,
  offset: _offset = 12,
  className,
  as: _as = 'div',
}) => {
  // m.div provides the orchestration; rendering as a different element
  // would require typing acrobatics that we don't need today.
  return (
    <m.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="show"
      custom={delay}
    >
      {children}
    </m.div>
  );
};

interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
  /** Override the offset for this item only. */
  offset?: number;
}

const StaggerItem: React.FC<StaggerItemProps> = ({ children, className, offset = 12 }) => {
  return (
    <m.div className={className} variants={itemVariants(offset)}>
      {children}
    </m.div>
  );
};

StaggerRoot.Item = StaggerItem;

export const Stagger = StaggerRoot;
