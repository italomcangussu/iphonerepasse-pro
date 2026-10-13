import React from 'react';

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}

const STROKE = 2;

/** Converte a série em pontos "x,y" dentro da caixa, com folga para o traço. */
export function sparklinePoints(values: number[], width: number, height: number): string {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const step = width / (values.length - 1);
  const usable = height - STROKE * 2;
  return values
    .map((value, index) => {
      const x = index * step;
      const y = STROKE + usable - ((value - min) / range) * usable;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/** Minigráfico decorativo de tendência; herda a cor do texto do contêiner. */
const Sparkline: React.FC<SparklineProps> = ({ values, width = 84, height = 32, className = '' }) => {
  const points = sparklinePoints(values, width, height);
  if (!points) return null;

  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      fill="none"
    >
      <polyline
        points={points}
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default Sparkline;
