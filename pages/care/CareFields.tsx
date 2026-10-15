import React, { useId } from 'react';
import { maskDecimalInput } from '../../utils/inputMasks';

interface DecimalFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
  maxDecimals?: number;
  max?: number;
  hint?: string;
  error?: string | null;
  disabled?: boolean;
}

const decimalInputClass = (p: Pick<DecimalFieldProps, 'prefix' | 'suffix' | 'error'>): string =>
  ['ios-input w-full tabular-nums', p.prefix && 'pl-10', p.suffix && 'pr-10', p.error && 'border-red-500'].filter(Boolean).join(' ');

const Affix: React.FC<{ side: 'left' | 'right'; text?: string }> = ({ side, text }) =>
  text ? <span className={`pointer-events-none absolute ${side === 'left' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-sm app-text-muted`}>{text}</span> : null;

const HelpText: React.FC<{ id: string; hint?: string; error?: string | null }> = ({ id, hint, error }) => {
  if (!error && !hint) return null;
  return <p id={id} className={`text-xs ${error ? 'text-red-600 dark:text-red-400' : 'app-text-muted'}`}>{error || hint}</p>;
};

// Campo numérico pt-BR (vírgula decimal) com prefixo/sufixo e erro inline ligado por aria.
export const DecimalField: React.FC<DecimalFieldProps> = ({ label, value, onChange, prefix, suffix, maxDecimals = 2, max, hint, error, disabled }) => {
  const id = useId();
  const described = hint || error ? `${id}-help` : undefined;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-semibold app-text-secondary">{label}</label>
      <div className="relative">
        <Affix side="left" text={prefix} />
        <input
          id={id}
          inputMode="decimal"
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(maskDecimalInput(e.target.value, { maxDecimals, max }))}
          aria-invalid={!!error}
          aria-describedby={described}
          className={decimalInputClass({ prefix, suffix, error })}
        />
        <Affix side="right" text={suffix} />
      </div>
      <HelpText id={`${id}-help`} hint={hint} error={error} />
    </div>
  );
};

export const TextField: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; hint?: string }> = ({ label, value, onChange, placeholder, multiline, hint }) => {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-semibold app-text-secondary">{label}</label>
      {multiline ? (
        <textarea id={id} className="ios-input w-full min-h-[84px]" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} className="ios-input w-full" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <p className="text-xs app-text-muted">{hint}</p>}
    </div>
  );
};

// Converte número do banco para texto do campo (vazio quando não configurado).
export const toField = (value: number | null | undefined, decimals = 2): string =>
  value === null || value === undefined ? '' : String(Number(value).toFixed(decimals)).replace(/\.?0+$/, '').replace('.', ',');

export const fromField = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};
