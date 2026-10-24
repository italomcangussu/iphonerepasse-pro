import React, { useEffect, useState } from 'react';
import { CalendarClock, Minus, Plus } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import IOSButton from '../../../components/ui/IOSButton';
import {
  clampValidityDays,
  computeQuoteExpiry,
  QUOTE_VALIDITY_DEFAULT_DAYS,
  QUOTE_VALIDITY_MAX_DAYS,
  QUOTE_VALIDITY_MIN_DAYS,
  QUOTE_VALIDITY_PRESETS,
} from './quoteModel';

interface QuoteValidityDialogProps {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onConfirm: (validityDays: number) => void;
}

const daysLabel = (days: number) => (days === 1 ? '1 dia' : `${days} dias`);

const formatExpiry = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);

/** A validade é uma decisão obrigatória a cada orçamento: o diálogo sempre abre em 1 dia e pede confirmação. */
export function QuoteValidityDialog({ open, saving, onClose, onConfirm }: QuoteValidityDialogProps) {
  const [days, setDays] = useState(QUOTE_VALIDITY_DEFAULT_DAYS);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!open) return;
    setDays(QUOTE_VALIDITY_DEFAULT_DAYS);
    setNow(new Date());
  }, [open]);

  const set = (next: number) => setDays(clampValidityDays(next));

  return (
    <Modal
      open={open}
      onClose={saving ? () => undefined : onClose}
      title="Validade do orçamento"
      size="sm"
      footer={(
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={saving} className="ios-button-secondary">Voltar</button>
          <IOSButton type="button" variant="primary" loading={saving} onClick={() => onConfirm(days)}>
            Salvar com {daysLabel(days)}
          </IOSButton>
        </div>
      )}
    >
      <p className="text-sm app-text-secondary">Até quando os valores deste orçamento valem para o cliente?</p>

      <div role="radiogroup" aria-label="Validade rápida" className="mt-4 grid grid-cols-3 gap-2">
        {QUOTE_VALIDITY_PRESETS.map((preset) => (
          <button key={preset} type="button" role="radio" aria-checked={days === preset} onClick={() => set(preset)}
            className={`min-h-11 rounded-xl text-sm font-semibold transition-colors ${days === preset ? 'bg-brand-600 text-white shadow-ios-sm' : 'app-surface-soft app-text-secondary'}`}>
            {daysLabel(preset)}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl app-surface-soft p-2">
        <button type="button" aria-label="Menos um dia" disabled={days <= QUOTE_VALIDITY_MIN_DAYS} onClick={() => set(days - 1)}
          className="grid h-11 w-11 place-items-center rounded-xl app-text-secondary disabled:opacity-40"><Minus size={18} aria-hidden="true" /></button>
        <p aria-live="polite" className="text-center">
          <span className="block text-2xl font-bold tabular-nums app-text-primary">{daysLabel(days)}</span>
          <span className="text-xs app-text-muted">de {QUOTE_VALIDITY_MIN_DAYS} a {QUOTE_VALIDITY_MAX_DAYS} dias</span>
        </p>
        <button type="button" aria-label="Mais um dia" disabled={days >= QUOTE_VALIDITY_MAX_DAYS} onClick={() => set(days + 1)}
          className="grid h-11 w-11 place-items-center rounded-xl app-text-secondary disabled:opacity-40"><Plus size={18} aria-hidden="true" /></button>
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-2xl bg-orange-50 p-3 text-sm text-orange-800 dark:bg-orange-900/20 dark:text-orange-300">
        <CalendarClock size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>Vale até <strong className="font-semibold">{formatExpiry(computeQuoteExpiry(now, days))}</strong>.</span>
      </p>
    </Modal>
  );
}
