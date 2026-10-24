import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { formatCurrencyBRL, parseCurrencyBRL } from '../../../utils/inputMasks';

interface MoneyInputProps {
  id: string;
  value: number;
  onChange: (value: number) => void;
  ariaLabel?: string;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}

/** Campo de valor em reais: só aceita dígitos e mostra sempre formatado (R$ 1.234,56). */
export function MoneyInput({ id, value, onChange, ariaLabel, invalid, describedBy, className = '' }: MoneyInputProps) {
  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      value={value > 0 ? formatCurrencyBRL(value) : ''}
      placeholder="R$ 0,00"
      onChange={(event) => onChange(parseCurrencyBRL(event.target.value))}
      className={`ios-input text-right tabular-nums ${invalid ? 'ios-input-error' : ''} ${className}`}
    />
  );
}

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="ios-segmented-control">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`ios-segment px-3 ${active ? 'ios-segment-active' : ''}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
}

const MAX_QUANTITY = 99;

export function QuantityStepper({ value, onChange, label }: QuantityStepperProps) {
  const set = (next: number) => onChange(Math.min(MAX_QUANTITY, Math.max(1, next)));
  return (
    <div role="group" aria-label={label} className="inline-flex items-center rounded-xl bg-gray-100 dark:bg-surface-dark-200 p-0.5">
      <button type="button" aria-label="Diminuir quantidade" disabled={value <= 1} onClick={() => set(value - 1)}
        className="grid h-11 w-11 place-items-center rounded-lg app-text-secondary disabled:opacity-40">
        <Minus size={16} aria-hidden="true" />
      </button>
      <span aria-live="polite" className="w-8 text-center text-sm font-semibold tabular-nums app-text-primary">{value}</span>
      <button type="button" aria-label="Aumentar quantidade" disabled={value >= MAX_QUANTITY} onClick={() => set(value + 1)}
        className="grid h-11 w-11 place-items-center rounded-lg app-text-secondary disabled:opacity-40">
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
