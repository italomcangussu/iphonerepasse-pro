import React from 'react';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { formatCurrencyBRL, parseCurrencyBRL } from '../../utils/inputMasks';
import type { ReservationDepositPart, ReservationTradeIn, StockReservation } from '../../types';
import { reservationRemainingAmount, sumDepositParts } from '../../lib/reservationDeposits';

/** Um sinal como o usuário digita: valor com máscara de moeda e a forma escolhida. */
export interface DepositDraft {
  key: string;
  amount: string;
  method: string;
}

export interface TradeInDraft {
  description: string;
  value: string;
}

export type PaymentFieldErrors = Partial<Record<string, string>>;

const DEPOSIT_METHODS = ['Pix', 'Dinheiro', 'Cartão', 'Cartão Débito', 'Outro'];

let draftSequence = 0;
const nextDraftKey = () => `deposit-${++draftSequence}`;

export const emptyDepositDraft = (): DepositDraft => ({ key: nextDraftKey(), amount: '', method: '' });

// Hidrata já formatado (R$ 200,00): o parse do campo é em centavos, então
// um valor cru como "200" seria relido como R$ 2,00 ao salvar a edição.
const formatDraftAmount = (amount: number | null | undefined) =>
  typeof amount === 'number' && amount > 0 ? formatCurrencyBRL(amount) : '';

export const depositDraftsFromReservation = (reservation?: StockReservation | null): DepositDraft[] => {
  const parts = reservation?.depositParts?.length
    ? reservation.depositParts
    : [{ amount: reservation?.depositAmount ?? 0, method: reservation?.depositPaymentMethod || '' }];
  return parts.map((part) => ({ key: nextDraftKey(), amount: formatDraftAmount(part.amount), method: part.method || '' }));
};

export const tradeInDraftFromReservation = (reservation?: StockReservation | null): TradeInDraft => ({
  description: reservation?.tradeIn?.description || '',
  value: formatDraftAmount(reservation?.tradeIn?.value),
});

const parseDraftAmount = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = parseCurrencyBRL(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export const amountFieldId = (index: number) => (index === 0 ? 'reservation-deposit-amount' : `reservation-deposit-amount-${index + 1}`);
export const methodFieldId = (index: number) => (index === 0 ? 'reservation-deposit-method' : `reservation-deposit-method-${index + 1}`);
const amountErrorKey = (index: number) => `amount:${index}`;
const methodErrorKey = (index: number) => `method:${index}`;

/** Sinais preenchidos (sem os vazios) — o que é salvo e o que entra na mensagem. */
export const depositPartsFromDrafts = (drafts: DepositDraft[]): ReservationDepositPart[] =>
  drafts
    .map((draft) => ({ amount: parseDraftAmount(draft.amount) ?? 0, method: draft.method.trim() }))
    .filter((part) => Number.isFinite(part.amount) && part.amount > 0);

export const tradeInFromDraft = (draft: TradeInDraft): ReservationTradeIn | null => {
  const description = draft.description.trim();
  if (!description) return null;
  return { description, value: parseDraftAmount(draft.value) ?? 0 };
};

/** Erros por campo e o id do primeiro campo inválido, para levar o foco até ele. */
export const validatePaymentDrafts = (
  drafts: DepositDraft[],
  tradeIn: TradeInDraft
): { errors: PaymentFieldErrors; firstInvalidId: string | null } => {
  const errors: PaymentFieldErrors = {};
  let firstInvalidId: string | null = null;
  const flag = (key: string, id: string, message: string) => {
    errors[key] = message;
    firstInvalidId = firstInvalidId ?? id;
  };

  drafts.forEach((draft, index) => {
    const amount = parseDraftAmount(draft.amount);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
      flag(amountErrorKey(index), amountFieldId(index), 'Informe um valor de sinal válido.');
    } else if (amount !== null && amount > 0 && !draft.method.trim()) {
      flag(methodErrorKey(index), methodFieldId(index), 'Informe a forma do sinal.');
    }
  });

  const tradeInValue = parseDraftAmount(tradeIn.value);
  if (tradeInValue !== null && tradeInValue > 0 && !tradeIn.description.trim()) {
    flag('tradeIn', 'reservation-trade-in-description', 'Informe o aparelho da troca.');
  }

  return { errors, firstInvalidId };
};

const FieldError = ({ id, children }: { id: string; children: string }) => (
  <p id={id} role="alert" aria-label={children} className="mt-1 flex items-start gap-1.5 text-ios-footnote font-medium text-red-600 dark:text-red-400">
    <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
    <span>{children}</span>
  </p>
);

// Máscara em centavos ao digitar (2-0-0 → R$ 2,00): a vírgula fica sempre
// visível, então o valor salvo é o valor exibido.
const maskCurrency = (value: string) => (/\d/.test(value) ? formatCurrencyBRL(parseCurrencyBRL(value)) : '');

const depositLabel = (index: number) => (index === 0 ? 'Sinal' : `Sinal ${index + 1}`);
const depositMethodLabel = (index: number) => (index === 0 ? 'Forma do sinal' : `Forma do sinal ${index + 1}`);
const errorIdFor = (fieldId: string, error?: string) => (error ? `${fieldId}-error` : undefined);

interface DepositRowProps {
  draft: DepositDraft;
  index: number;
  amountError?: string;
  methodError?: string;
  disabled: boolean;
  onChange: (changes: Partial<DepositDraft>) => void;
  onRemove: () => void;
}

const DepositRow: React.FC<DepositRowProps> = ({ draft, index, amountError, methodError, disabled, onChange, onRemove }) => {
  const label = depositLabel(index);
  const amountId = amountFieldId(index);
  const methodId = methodFieldId(index);
  const hasAmount = (parseDraftAmount(draft.amount) ?? 0) > 0;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 items-start">
      <div className="min-w-0">
        <label className="ios-label" htmlFor={amountId}>{label}</label>
        <input
          id={amountId}
          className={`ios-input ${amountError ? 'ios-input-error' : ''}`}
          inputMode="numeric"
          value={draft.amount}
          onChange={(event) => onChange({ amount: maskCurrency(event.target.value) })}
          placeholder={index === 0 ? 'Opcional' : 'R$ 0,00'}
          disabled={disabled}
          aria-invalid={!!amountError}
          aria-describedby={errorIdFor(amountId, amountError)}
        />
        {amountError && <FieldError id={`${amountId}-error`}>{amountError}</FieldError>}
      </div>
      <div className="min-w-0">
        <label className="ios-label" htmlFor={methodId}>{depositMethodLabel(index)}</label>
        <select
          id={methodId}
          className={`ios-input ${methodError ? 'ios-input-error' : ''}`}
          value={draft.method}
          onChange={(event) => onChange({ method: event.target.value })}
          disabled={disabled || !hasAmount}
          aria-invalid={!!methodError}
          aria-describedby={errorIdFor(methodId, methodError)}
        >
          <option value="">Selecione</option>
          {DEPOSIT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
        </select>
        {methodError && <FieldError id={`${methodId}-error`}>{methodError}</FieldError>}
      </div>
      {index > 0 ? (
        <button
          type="button"
          className="ios-button-secondary mt-6 flex h-11 w-11 items-center justify-center p-0"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remover ${label.toLowerCase()}`}
          title={`Remover ${label.toLowerCase()}`}
        >
          <Trash2 size={18} aria-hidden="true" />
        </button>
      ) : (
        <span className="w-11" aria-hidden="true" />
      )}
    </div>
  );
};

interface TradeInFieldsProps {
  tradeIn: TradeInDraft;
  error?: string;
  disabled: boolean;
  onChange: (tradeIn: TradeInDraft) => void;
}

const TradeInFields: React.FC<TradeInFieldsProps> = ({ tradeIn, error, disabled, onChange }) => (
  <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-3">
    <legend className="ios-label mb-1">Aparelho na troca</legend>
    <div className="min-w-0">
      <label className="ios-label" htmlFor="reservation-trade-in-description">Aparelho da troca</label>
      <input
        id="reservation-trade-in-description"
        className={`ios-input ${error ? 'ios-input-error' : ''}`}
        value={tradeIn.description}
        onChange={(event) => onChange({ ...tradeIn, description: event.target.value })}
        placeholder="Opcional · ex.: iPhone 11 64GB"
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? 'reservation-trade-in-error' : undefined}
      />
      {error && <FieldError id="reservation-trade-in-error">{error}</FieldError>}
    </div>
    <div className="min-w-0">
      <label className="ios-label" htmlFor="reservation-trade-in-value">Valor da troca</label>
      <input
        id="reservation-trade-in-value"
        className="ios-input"
        inputMode="numeric"
        value={tradeIn.value}
        onChange={(event) => onChange({ ...tradeIn, value: maskCurrency(event.target.value) })}
        placeholder="R$ 0,00"
        disabled={disabled}
      />
    </div>
    <p className="md:col-span-2 text-xs app-text-muted">
      A troca entra no estoque só na venda, pelo PDV. Aqui ela serve para a mensagem e o saldo.
    </p>
  </fieldset>
);

const BalanceLine: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between gap-2"><dt className="app-text-muted">{label}</dt><dd className="app-text-primary">{value}</dd></div>
);

interface PaymentBalanceProps {
  price: number;
  parts: ReservationDepositPart[];
  tradeIn: ReservationTradeIn | null;
}

const PaymentBalance: React.FC<PaymentBalanceProps> = ({ price, parts, tradeIn }) => (
  <dl className="rounded-ios-lg border app-border app-surface-soft p-3 text-sm space-y-1" aria-label="Resumo do pagamento">
    <BalanceLine label="Valor do aparelho" value={formatCurrencyBRL(price)} />
    {parts.length > 0 && <BalanceLine label="Sinais" value={`− ${formatCurrencyBRL(sumDepositParts(parts))}`} />}
    {!!tradeIn?.value && <BalanceLine label="Troca" value={`− ${formatCurrencyBRL(tradeIn.value)}`} />}
    <div className="flex justify-between gap-2 border-t app-border pt-1 font-semibold">
      <dt className="app-text-primary">Falta pagar</dt>
      <dd className="app-text-primary">{formatCurrencyBRL(reservationRemainingAmount(price, parts, tradeIn))}</dd>
    </div>
  </dl>
);

interface ReservationPaymentFieldsProps {
  deposits: DepositDraft[];
  tradeIn: TradeInDraft;
  errors: PaymentFieldErrors;
  sellPrice?: number | null;
  disabled?: boolean;
  onDepositsChange: (deposits: DepositDraft[]) => void;
  onTradeInChange: (tradeIn: TradeInDraft) => void;
  onClearError: (...keys: string[]) => void;
}

export const ReservationPaymentFields: React.FC<ReservationPaymentFieldsProps> = ({
  deposits,
  tradeIn,
  errors,
  sellPrice,
  disabled = false,
  onDepositsChange,
  onTradeInChange,
  onClearError,
}) => {
  const updateDeposit = (index: number, changes: Partial<DepositDraft>) => {
    onDepositsChange(deposits.map((draft, position) => (position === index ? { ...draft, ...changes } : draft)));
    onClearError(amountErrorKey(index), methodErrorKey(index));
  };

  const removeDeposit = (index: number) => {
    onDepositsChange(deposits.filter((_, position) => position !== index));
    onClearError(amountErrorKey(index), methodErrorKey(index));
  };

  const updateTradeIn = (next: TradeInDraft) => {
    onTradeInChange(next);
    onClearError('tradeIn');
  };

  const parts = depositPartsFromDrafts(deposits);
  const parsedTradeIn = tradeInFromDraft(tradeIn);
  const price = typeof sellPrice === 'number' && sellPrice > 0 ? sellPrice : 0;
  const showBalance = price > 0 && (parts.length > 0 || !!parsedTradeIn?.value);
  const lastDepositFilled = !!parseDraftAmount(deposits[deposits.length - 1]?.amount ?? '');

  return (
    <div className="space-y-4">
      <fieldset className="space-y-3">
        <legend className="sr-only">Sinais da reserva</legend>
        {deposits.map((draft, index) => (
          <DepositRow
            key={draft.key}
            draft={draft}
            index={index}
            amountError={errors[amountErrorKey(index)]}
            methodError={errors[methodErrorKey(index)]}
            disabled={disabled}
            onChange={(changes) => updateDeposit(index, changes)}
            onRemove={() => removeDeposit(index)}
          />
        ))}
        <button
          type="button"
          className="ios-button-secondary inline-flex h-9 items-center gap-1.5 px-3 text-xs"
          onClick={() => onDepositsChange([...deposits, emptyDepositDraft()])}
          disabled={disabled || !lastDepositFilled}
          title={lastDepositFilled ? 'Registrar mais um sinal em outra forma de pagamento' : 'Preencha o sinal acima primeiro'}
        >
          <Plus size={14} aria-hidden="true" />
          Adicionar outro sinal
        </button>
      </fieldset>

      <TradeInFields tradeIn={tradeIn} error={errors.tradeIn} disabled={disabled} onChange={updateTradeIn} />

      {showBalance && <PaymentBalance price={price} parts={parts} tradeIn={parsedTradeIn} />}
    </div>
  );
};

export default ReservationPaymentFields;
