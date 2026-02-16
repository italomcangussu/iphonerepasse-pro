import React from 'react';
import { ResponsiveContainer, type Props as ResponsiveContainerProps } from 'recharts';

const DEFAULT_INITIAL_DIMENSION = { width: 320, height: 180 } as const;

const StableResponsiveContainer = React.forwardRef<HTMLDivElement, ResponsiveContainerProps>(
  (
    {
      width = '100%',
      height = '100%',
      minWidth = 0,
      minHeight = 1,
      initialDimension = DEFAULT_INITIAL_DIMENSION,
      children,
      ...rest
    },
    ref
  ) => {
    return (
      <ResponsiveContainer
        ref={ref}
        width={width}
        height={height}
        minWidth={minWidth}
        minHeight={minHeight}
        initialDimension={initialDimension}
        {...rest}
      >
        {children}
      </ResponsiveContainer>
    );
  }
);

StableResponsiveContainer.displayName = 'StableResponsiveContainer';

export default StableResponsiveContainer;
