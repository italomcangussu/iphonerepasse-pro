import React, { useId, useState } from 'react';
import { Loader2, RotateCw } from 'lucide-react';
import Banner from './ui/Banner';
import { formatPhone } from '../utils/inputMasks';
import type { WhatsAppSendError } from '../utils/whatsappSendError';

type WhatsAppSendFailureProps = {
  /** O que falhou, como o operador chama: "Comprovante não enviado". */
  title: string;
  error: WhatsAppSendError;
  /** Telefone hoje cadastrado para o cliente (qualquer formato). */
  phone?: string;
  busy?: boolean;
  onRetry: () => void;
  /** Quando informado, número sem WhatsApp vira correção no próprio aviso. */
  onFixPhone?: (phone: string) => void | Promise<void>;
  onDismiss: () => void;
  className?: string;
};

const onlyDigits = (value: string) => value.replace(/\D/g, '');

const primaryButton = 'ios-button-primary disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Falha de envio por WhatsApp que **fica na tela** até ser resolvida.
 *
 * Toast some em segundos, não tem espaço para "o que fazer" e deixa a tela
 * parecendo que nada aconteceu. Aqui: causa + próximo passo + a ação que
 * resolve, perto de onde o operador já está olhando.
 */
const WhatsAppSendFailure: React.FC<WhatsAppSendFailureProps> = ({
  title,
  error,
  phone,
  busy = false,
  onRetry,
  onFixPhone,
  onDismiss,
  className = ''
}) => {
  const fieldId = useId();
  const [draft, setDraft] = useState(() => formatPhone(onlyDigits(phone ?? '').replace(/^55(?=\d{10,11}$)/, '')));
  const [fieldError, setFieldError] = useState<string | null>(null);

  const canFixPhone = error.kind === 'invalid-number' && Boolean(onFixPhone);

  const submitFix = (event: React.FormEvent) => {
    event.preventDefault();
    const digits = onlyDigits(draft);
    if (digits.length < 10 || digits.length > 11) {
      setFieldError('Informe o DDD e o número, por exemplo (85) 99999-0000.');
      return;
    }
    setFieldError(null);
    void onFixPhone?.(draft);
  };

  return (
    <Banner
      kind="error"
      role="alert"
      title={title}
      onClose={busy ? undefined : onDismiss}
      className={`w-full text-left ${className}`}
      message={
        <div className="space-y-3">
          <p>
            {error.message}
            <span className="mt-1 block font-normal text-gray-600 dark:text-surface-dark-500">{error.hint}</span>
          </p>

          {canFixPhone ? (
            <form onSubmit={submitFix} className="space-y-2" noValidate>
              <label htmlFor={fieldId} className="ios-label">
                Telefone do cliente
              </label>
              <input
                id={fieldId}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="(85) 99999-0000"
                value={draft}
                onChange={(event) => {
                  setDraft(formatPhone(event.target.value));
                  if (fieldError) setFieldError(null);
                }}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={fieldError ? `${fieldId}-error` : undefined}
                disabled={busy}
                className={`ios-input min-h-[44px] w-full ${fieldError ? 'ios-input-error' : ''}`}
              />
              {fieldError && (
                <p id={`${fieldId}-error`} role="alert" className="mt-1 text-ios-footnote text-red-600 dark:text-red-400">
                  {fieldError}
                </p>
              )}
              <button type="submit" disabled={busy} className={primaryButton}>
                {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
                {busy ? 'Reenviando…' : 'Salvar e reenviar'}
              </button>
            </form>
          ) : (
            <button type="button" onClick={onRetry} disabled={busy} className={primaryButton}>
              {busy ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <RotateCw size={16} aria-hidden="true" />
              )}
              {busy ? 'Enviando…' : 'Tentar de novo'}
            </button>
          )}
        </div>
      }
    />
  );
};

export default WhatsAppSendFailure;
