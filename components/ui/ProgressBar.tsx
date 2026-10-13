import React from 'react';

interface ProgressBarProps {
  /** Parte concluída, na mesma unidade de `total`. */
  value: number;
  total: number;
  /** Nome lido por leitores de tela: "Dívida quitada". */
  label: string;
  className?: string;
}

export function progressPercent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

const ProgressBar: React.FC<ProgressBarProps> = ({ value, total, label, className = '' }) => {
  const percent = progressPercent(value, total);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={`ios-progress ${className}`}
    >
      <div className="ios-progress-bar" style={{ width: `${percent}%` }} />
    </div>
  );
};

export default ProgressBar;
