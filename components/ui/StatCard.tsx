import React from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import Sparkline from './Sparkline';

export type StatTone = 'primary' | 'success' | 'warning' | 'error';

interface StatCardProps {
  label: string;
  /** Texto pronto ou um nó (ex.: `AnimatedNumber`) para o valor em destaque. */
  value: React.ReactNode;
  tone?: StatTone;
  /** Variação já formatada, com sinal: "+12,4%" ou "-3,1%". */
  change?: string;
  /** Texto que dá sentido à variação: "em relação a setembro". */
  changeLabel?: string;
  trend?: number[];
  icon?: React.ReactNode;
  /** Complemento abaixo do valor (ex.: `ProgressBar` de margem). */
  footer?: React.ReactNode;
  className?: string;
}

const TONE_CLASS: Record<StatTone, string> = {
  primary: '',
  success: 'ios-stat-card-success',
  warning: 'ios-stat-card-warning',
  error: 'ios-stat-card-error',
};

/** Indicador de painel: rótulo, valor em destaque, variação e tendência. */
const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  tone = 'primary',
  change,
  changeLabel,
  trend,
  icon,
  footer,
  className = '',
}) => {
  const isDrop = change?.trim().startsWith('-');
  const ChangeIcon = isDrop ? TrendingDown : TrendingUp;

  return (
    <div className={`ios-stat-card ${TONE_CLASS[tone]} ${className}`}>
      {(icon || change) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          {icon ? <span className="inline-flex">{icon}</span> : <span />}
          {change && (
            <span className="inline-flex items-center gap-1 text-ios-footnote font-bold">
              <ChangeIcon size={16} aria-hidden="true" />
              {change}
            </span>
          )}
        </div>
      )}
      <p className="text-ios-subhead font-semibold">{label}</p>
      <p className="mt-1 whitespace-nowrap text-ios-title-2 font-bold tabular-nums sm:text-ios-title-1">{value}</p>
      {footer && <div className="mt-3">{footer}</div>}
      {(changeLabel || trend) && (
        <div className="mt-2 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
          <p className="min-w-[7rem] flex-1 text-ios-caption opacity-80">{changeLabel}</p>
          {trend && <Sparkline values={trend} className="ml-auto shrink-0" />}
        </div>
      )}
    </div>
  );
};

export default StatCard;
