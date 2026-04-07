import React from 'react';

/**
 * Skeleton primitives — CSS-only loading placeholders with shimmer.
 *
 * Variants:
 *   <Skeleton.Text lines={3} />     // Multi-line text placeholder
 *   <Skeleton.Card />               // Card-shaped block
 *   <Skeleton.Row />                // Single horizontal row (table-like)
 *
 * Honors `prefers-reduced-motion` (shimmer disabled, solid color shown).
 */

interface SkeletonBaseProps {
  className?: string;
  /** Override width (default fills container). */
  width?: string | number;
  /** Override height. */
  height?: string | number;
}

const baseClasses =
  'relative overflow-hidden bg-gray-200 dark:bg-surface-dark-100 rounded-md';

const shimmerOverlay =
  'after:absolute after:inset-0 after:skeleton-shimmer after:animate-shimmer';

const Block: React.FC<SkeletonBaseProps & { as?: keyof React.JSX.IntrinsicElements }> = ({
  className = '',
  width,
  height,
  as: As = 'div',
}) => {
  const style: React.CSSProperties = {};
  if (width !== undefined) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height !== undefined) style.height = typeof height === 'number' ? `${height}px` : height;
  return (
    <As
      className={`${baseClasses} ${shimmerOverlay} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
};

interface TextProps {
  /** Number of lines to render (default 3). */
  lines?: number;
  /** Optional className applied to the wrapper. */
  className?: string;
}

const Text: React.FC<TextProps> = ({ lines = 3, className = '' }) => {
  return (
    <div className={`flex flex-col gap-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Block
          key={i}
          height={12}
          // Last line is shorter for natural look
          width={i === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
};

interface CardProps {
  className?: string;
  /** Optional override of card height. */
  height?: string | number;
}

const Card: React.FC<CardProps> = ({ className = '', height = 120 }) => {
  return (
    <div
      className={`ios-card p-4 md:p-5 ${className}`}
      aria-hidden="true"
      style={{ minHeight: typeof height === 'number' ? `${height}px` : height }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <Block width="40%" height={10} />
        <Block width={32} height={32} className="rounded-ios" />
      </div>
      <Block width="60%" height={24} className="mb-2" />
      <Block width="30%" height={10} />
    </div>
  );
};

interface RowProps {
  className?: string;
}

const Row: React.FC<RowProps> = ({ className = '' }) => {
  return (
    <div
      className={`flex items-center gap-3 p-3 ${className}`}
      aria-hidden="true"
    >
      <Block width={40} height={40} className="rounded-full shrink-0" />
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <Block width="50%" height={12} />
        <Block width="80%" height={10} />
      </div>
      <Block width={60} height={20} className="rounded-full shrink-0" />
    </div>
  );
};

export const Skeleton = {
  Block,
  Text,
  Card,
  Row,
};
